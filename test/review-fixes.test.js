const test = require('node:test');
const assert = require('node:assert/strict');

const { MemoryStore } = require('./memory-store');
const { createEvent } = require('../src/shared/events');
const { createEdgeProcessor } = require('../node-red/edge');
const { createInventoryService } = require('../src/services/inventory');
const { createReplenishmentService } = require('../src/services/replenishment');
const { createDeliveryService } = require('../src/services/delivery');
const { createSimulation } = require('../src/workload');

function lowStock() {
  return createEvent('stock.updated', 'store-01', {
    skuId: 'milk-1l',
    qty: 2,
    velocityPerDay: 4,
    daysToStockout: 0.5
  }, { ts: 100 });
}

async function seedDelivery(store, status = 'PLANNED') {
  await store.saveOrder({
    orderId: 'order-1',
    store: 'store-01',
    openKey: 'store-01/milk-1l',
    lines: [{ skuId: 'milk-1l', qty: 12, unitPrice: 3.2 }],
    value: 38.4,
    status: 'IN_DELIVERY'
  });
  await store.saveDelivery({
    deliveryId: 'delivery-1',
    orderId: 'order-1',
    store: 'store-01',
    status
  });
}

test('a delivered order allows a later order for the same SKU', async () => {
  const store = new MemoryStore();
  let sequence = 0;
  const service = createReplenishmentService({
    store,
    publish: async () => {},
    autoApproveUnder: 0,
    idFactory: () => 'order-' + (++sequence)
  });

  const first = await service.handleStockUpdated(lowStock());
  await store.closeOrder(first.orderId);
  const second = await service.handleStockUpdated(lowStock());

  assert.equal(second.orderId, 'order-2');
  assert.equal((await store.listOrders()).length, 2);
});

test('only one open order is allowed for a store and SKU', async () => {
  const store = new MemoryStore();
  const service = createReplenishmentService({
    store,
    publish: async () => {},
    autoApproveUnder: 0,
    idFactory: () => 'order-1'
  });

  await service.handleStockUpdated(lowStock());
  assert.equal(await service.handleStockUpdated(lowStock()), null);
});

test('delivery completion closes the order and publishes deterministic restock', async () => {
  const store = new MemoryStore();
  const published = [];
  await seedDelivery(store);
  const service = createDeliveryService({ store, publish: async event => published.push(event), now: () => 500 });

  const delivery = await service.complete('delivery-1');
  const order = await store.getOrder('order-1');
  const restock = published.find(event => event.type === 'stock.delta');

  assert.equal(delivery.status, 'DELIVERED');
  assert.equal(order.status, 'DELIVERED');
  assert.equal(order.openKey, undefined);
  assert.equal(restock.eventId, 'delivery-delivery-1-milk-1l');
  assert.equal(restock.data.delta, 12);
});

test('failed restock remains retryable and does not close the order', async () => {
  const store = new MemoryStore();
  const published = [];
  let failOnce = true;
  await seedDelivery(store);
  const service = createDeliveryService({
    store,
    now: () => 500,
    publish: async event => {
      if (event.type === 'stock.delta' && failOnce) {
        failOnce = false;
        throw new Error('MQTT unavailable');
      }
      published.push(event);
    }
  });

  await assert.rejects(() => service.complete('delivery-1'), /MQTT unavailable/);
  assert.equal((await store.getDelivery('delivery-1')).status, 'RESTOCK_PENDING');
  assert.equal((await store.getOrder('order-1')).status, 'IN_DELIVERY');

  const completed = await service.complete('delivery-1');
  assert.equal(completed.status, 'DELIVERED');
  assert.equal(published.find(event => event.type === 'stock.delta').eventId, 'delivery-delivery-1-milk-1l');
});

test('unknown stock source is rejected before inventory writes it', async () => {
  const store = new MemoryStore();
  const service = createInventoryService({ store, publish: async () => {} });
  const event = createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: 1, source: 'manual'
  });

  await assert.rejects(() => service.handle(event), /source/);
  assert.equal((await store.listStock()).length, 0);
});

test('shelf debounce uses sensor time while latency uses wall time', async () => {
  const edge = createEdgeProcessor({ debounceMs: 800 });
  const now = Date.now();
  const reading = grams => ({
    store: 'store-01', shelfId: 'shelf-1', skuId: 'milk-1l', grams, ts: 0, wallTs: now
  });

  assert.ok(edge.processShelf(reading(10000)));
  assert.equal(edge.processShelf({ ...reading(2000), ts: 100 }), null);
  assert.equal(edge.processShelf({ ...reading(2000), ts: 1000 }).data.delta, -8);
});

test('simulator uses a real wall timestamp on every message', async () => {
  const messages = [];
  const floor = Date.now() - 1000;
  await createSimulation({ stores: 1, publish: async (topic, payload) => messages.push({ topic, payload }) }).run();

  assert.ok(messages.length > 0);
  for (const message of messages) {
    assert.ok(message.payload.wallTs >= floor, message.topic + ' has an invalid wallTs');
  }
});
