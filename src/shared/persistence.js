function stockKey(store, skuId) {
  return store + '/' + skuId;
}

function newStockRow(store, skuId) {
  return {
    store,
    skuId,
    qty: 0,
    soldUnits: 0,
    saleCount: 0,
    firstSaleTs: null,
    lastSaleTs: null,
    velocityPerDay: 0,
    daysToStockout: null,
    updatedAt: null
  };
}

class MemoryStore {
  constructor() {
    this.stockEvents = new Map();
    this.stock = new Map();
    this.orders = new Map();
    this.alerts = new Map();
    this.deliveries = new Map();
    this.deadLetters = [];
  }

  async recordStockEvent(event) {
    if (this.stockEvents.has(event.eventId)) return { duplicate: true };
    this.stockEvents.set(event.eventId, structuredClone(event));
    return { duplicate: false };
  }

  async applyPhysicalDelta(event) {
    const { skuId, delta } = event.data;
    const key = stockKey(event.store, skuId);
    const row = this.stock.get(key) || newStockRow(event.store, skuId);
    row.qty += delta;
    row.updatedAt = event.ts;
    this.stock.set(key, row);
    return structuredClone(row);
  }

  async recordSale(event) {
    const { skuId, delta } = event.data;
    const key = stockKey(event.store, skuId);
    const row = this.stock.get(key) || newStockRow(event.store, skuId);
    row.soldUnits += Math.abs(delta);
    row.saleCount += 1;
    row.firstSaleTs = row.firstSaleTs === null ? event.ts : Math.min(row.firstSaleTs, event.ts);
    row.lastSaleTs = row.lastSaleTs === null ? event.ts : Math.max(row.lastSaleTs, event.ts);
    row.updatedAt = event.ts;
    this.stock.set(key, row);
    return structuredClone(row);
  }

  async getStock(store, skuId) {
    const row = this.stock.get(stockKey(store, skuId));
    return row ? structuredClone(row) : null;
  }

  async saveStock(row) {
    this.stock.set(stockKey(row.store, row.skuId), structuredClone(row));
    return structuredClone(row);
  }

  async listStock() {
    return [...this.stock.values()].map(row => structuredClone(row));
  }

  async saveOrder(order) {
    if (order.openKey) {
      const existing = [...this.orders.values()].find(item =>
        item.openKey === order.openKey && item.orderId !== order.orderId
      );
      if (existing) {
        const error = new Error('Duplicate open order');
        error.code = 11000;
        throw error;
      }
    }
    this.orders.set(order.orderId, structuredClone(order));
    return structuredClone(order);
  }

  async getOrder(orderId) {
    const order = this.orders.get(orderId);
    return order ? structuredClone(order) : null;
  }

  async findOpenOrder(store, skuId) {
    const open = new Set(['PENDING_APPROVAL', 'APPROVED', 'IN_DELIVERY']);
    const order = [...this.orders.values()].find(item =>
      item.store === store && open.has(item.status) && item.lines.some(line => line.skuId === skuId)
    );
    return order ? structuredClone(order) : null;
  }

  async approveOrder(orderId, approvedBy, approvedAt = Date.now()) {
    const order = this.orders.get(orderId);
    if (!order) return null;
    if (order.status === 'PENDING_APPROVAL') {
      order.status = 'APPROVED';
      order.approvedBy = approvedBy;
      order.approvedAt = approvedAt;
    }
    return structuredClone(order);
  }

  async listOrders() {
    return [...this.orders.values()].map(order => structuredClone(order));
  }

  async saveAlert(alert) {
    this.alerts.set(alert.eventId, structuredClone(alert));
    return structuredClone(alert);
  }

  async listAlerts() {
    return [...this.alerts.values()].map(alert => structuredClone(alert));
  }

  async saveDelivery(delivery) {
    this.deliveries.set(delivery.deliveryId, structuredClone(delivery));
    return structuredClone(delivery);
  }

  async listDeliveries() {
    return [...this.deliveries.values()].map(delivery => structuredClone(delivery));
  }

  async saveDeadLetter(item) {
    this.deadLetters.push(structuredClone(item));
    return structuredClone(item);
  }

  async listDeadLetters() {
    return this.deadLetters.map(item => structuredClone(item));
  }

  async close() {}
}

class MongoStore {
  constructor(uri) {
    this.uri = uri;
    this.connection = null;
  }

  static async connect(uri) {
    const store = new MongoStore(uri);
    await store.connect();
    return store;
  }

  async connect() {
    const mongoose = require('mongoose');
    this.connection = await mongoose.createConnection(this.uri, {
      serverSelectionTimeoutMS: 8000
    }).asPromise();
    this.db = this.connection.db;
    await Promise.all([
      this.db.collection('stock_events').createIndex({ eventId: 1 }, { unique: true }),
      this.db.collection('stock_levels').createIndex({ store: 1, skuId: 1 }, { unique: true }),
      this.db.collection('orders').createIndex({ orderId: 1 }, { unique: true }),
      this.db.collection('orders').createIndex(
        { openKey: 1 },
        { unique: true, partialFilterExpression: { openKey: { $type: 'string' } } }
      ),
      this.db.collection('coldchain').createIndex({ eventId: 1 }, { unique: true }),
      this.db.collection('deliveries').createIndex({ deliveryId: 1 }, { unique: true })
    ]);
    return this;
  }

  async recordStockEvent(event) {
    try {
      await this.db.collection('stock_events').insertOne(event);
      return { duplicate: false };
    } catch (error) {
      if (error.code === 11000) return { duplicate: true };
      throw error;
    }
  }

  async applyPhysicalDelta(event) {
    const { skuId, delta } = event.data;
    await this.db.collection('stock_levels').updateOne(
      { store: event.store, skuId },
      [
        {
          $set: {
            store: event.store,
            skuId,
            qty: { $add: [{ $ifNull: ['$qty', 0] }, delta] },
            soldUnits: { $ifNull: ['$soldUnits', 0] },
            saleCount: { $ifNull: ['$saleCount', 0] },
            firstSaleTs: { $ifNull: ['$firstSaleTs', null] },
            lastSaleTs: { $ifNull: ['$lastSaleTs', null] },
            velocityPerDay: { $ifNull: ['$velocityPerDay', 0] },
            daysToStockout: { $ifNull: ['$daysToStockout', null] },
            updatedAt: event.ts
          }
        }
      ],
      { upsert: true }
    );
    return this.getStock(event.store, skuId);
  }

  async recordSale(event) {
    const { skuId, delta } = event.data;
    const sold = Math.abs(delta);
    await this.db.collection('stock_levels').updateOne(
      { store: event.store, skuId },
      [
        {
          $set: {
            store: event.store,
            skuId,
            qty: { $ifNull: ['$qty', 0] },
            soldUnits: { $add: [{ $ifNull: ['$soldUnits', 0] }, sold] },
            saleCount: { $add: [{ $ifNull: ['$saleCount', 0] }, 1] },
            firstSaleTs: { $cond: [{ $eq: [{ $ifNull: ['$firstSaleTs', null] }, null] }, event.ts, { $min: ['$firstSaleTs', event.ts] }] },
            lastSaleTs: { $cond: [{ $eq: [{ $ifNull: ['$lastSaleTs', null] }, null] }, event.ts, { $max: ['$lastSaleTs', event.ts] }] },
            velocityPerDay: { $ifNull: ['$velocityPerDay', 0] },
            daysToStockout: { $ifNull: ['$daysToStockout', null] },
            updatedAt: event.ts
          }
        }
      ],
      { upsert: true }
    );
    return this.getStock(event.store, skuId);
  }

  async getStock(store, skuId) {
    return this.db.collection('stock_levels').findOne({ store, skuId }, { projection: { _id: 0 } });
  }

  async saveStock(row) {
    await this.db.collection('stock_levels').updateOne(
      { store: row.store, skuId: row.skuId },
      {
        $set: {
          velocityPerDay: row.velocityPerDay,
          daysToStockout: row.daysToStockout,
          updatedAt: row.updatedAt
        }
      },
      { upsert: true }
    );
    return row;
  }

  async listStock() {
    return this.db.collection('stock_levels').find({}, { projection: { _id: 0 } }).toArray();
  }

  async saveOrder(order) {
    await this.db.collection('orders').updateOne({ orderId: order.orderId }, { $set: order }, { upsert: true });
    return order;
  }

  async getOrder(orderId) {
    return this.db.collection('orders').findOne({ orderId }, { projection: { _id: 0 } });
  }

  async findOpenOrder(store, skuId) {
    return this.db.collection('orders').findOne({
      openKey: stockKey(store, skuId),
      status: { $in: ['PENDING_APPROVAL', 'APPROVED', 'IN_DELIVERY'] }
    }, { projection: { _id: 0 } });
  }

  async approveOrder(orderId, approvedBy, approvedAt = Date.now()) {
    return this.db.collection('orders').findOneAndUpdate(
      { orderId, status: 'PENDING_APPROVAL' },
      { $set: { status: 'APPROVED', approvedBy, approvedAt } },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
  }

  async listOrders() {
    return this.db.collection('orders').find({}, { projection: { _id: 0 } }).toArray();
  }

  async saveAlert(alert) {
    await this.db.collection('coldchain').updateOne({ eventId: alert.eventId }, { $setOnInsert: alert }, { upsert: true });
    return alert;
  }

  async listAlerts() {
    return this.db.collection('coldchain').find({}, { projection: { _id: 0 } }).toArray();
  }

  async saveDelivery(delivery) {
    await this.db.collection('deliveries').updateOne({ deliveryId: delivery.deliveryId }, { $set: delivery }, { upsert: true });
    return delivery;
  }

  async listDeliveries() {
    return this.db.collection('deliveries').find({}, { projection: { _id: 0 } }).toArray();
  }

  async saveDeadLetter(item) {
    await this.db.collection('dead_letters').insertOne(item);
    return item;
  }

  async listDeadLetters() {
    return this.db.collection('dead_letters').find({}, { projection: { _id: 0 } }).toArray();
  }

  async close() {
    if (this.connection) await this.connection.close();
  }
}

module.exports = { MemoryStore, MongoStore, stockKey };
