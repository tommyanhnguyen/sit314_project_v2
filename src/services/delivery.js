const { randomUUID } = require('node:crypto');
const { createEvent, validateEvent } = require('../shared/events');

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function nearestNeighbour(start, stops) {
  const pending = stops.map(stop => ({ ...stop }));
  const route = [];
  let current = start;

  while (pending.length) {
    pending.sort((a, b) => distance(current, a) - distance(current, b));
    current = pending.shift();
    route.push(current);
  }
  return route;
}

function createDeliveryService(options) {
  const { store, publish } = options;
  const locations = options.locations || {};
  const idFactory = options.idFactory || randomUUID;
  const now = options.now || Date.now;
  const speedKmPerHour = options.speedKmPerHour || 40;

  async function handle(event) {
    validateEvent(event);
    if (event.type !== 'order.approved') throw new Error('Delivery expects order.approved');

    const existing = (await store.listDeliveries()).find(item => item.orderId === event.data.orderId);
    if (existing) return existing;

    const order = await store.getOrder(event.data.orderId);
    if (!order) throw new Error('Unknown order: ' + event.data.orderId);

    const depot = locations.depot || { x: 0, y: 0 };
    const target = locations[order.store] || { x: 1, y: 1 };
    const stops = nearestNeighbour(depot, [{ id: order.store, ...target }]);
    const travelHours = distance(depot, stops[0]) / speedKmPerHour;
    const delivery = {
      deliveryId: idFactory(),
      orderId: order.orderId,
      store: order.store,
      route: stops.map(stop => stop.id),
      eta: Math.round(now() + travelHours * 60 * 60 * 1000),
      status: 'PLANNED',
      createdAt: now()
    };

    order.status = 'IN_DELIVERY';
    await store.saveOrder(order);
    await store.saveDelivery(delivery);
    await publish(createEvent('delivery.created', delivery.store, delivery, { ts: event.ts }));
    return delivery;
  }

  async function complete(deliveryId) {
    const delivery = await store.getDelivery(deliveryId);
    if (!delivery) throw new Error('Unknown delivery: ' + deliveryId);
    if (delivery.status === 'DELIVERED') return delivery;
    if (!['PLANNED', 'RESTOCK_PENDING'].includes(delivery.status)) {
      throw new Error('Delivery cannot be completed from status: ' + delivery.status);
    }

    const order = await store.getOrder(delivery.orderId);
    if (!order) throw new Error('Unknown order: ' + delivery.orderId);

    if (delivery.status === 'PLANNED') {
      delivery.status = 'RESTOCK_PENDING';
      delivery.deliveredAt = now();
      await store.saveDelivery(delivery);
    }

    for (const line of order.lines) {
      await publish(createEvent('stock.delta', delivery.store, {
        skuId: line.skuId,
        delta: line.qty,
        source: 'delivery',
        deliveryId: delivery.deliveryId,
        wallTs: Date.now()
      }, { eventId: 'delivery-' + delivery.deliveryId + '-' + line.skuId }));
    }

    await publish(createEvent('delivery.status', delivery.store, {
      deliveryId: delivery.deliveryId,
      status: 'DELIVERED'
    }, { eventId: 'delivery-status-' + delivery.deliveryId + '-delivered' }));

    await store.closeOrder(delivery.orderId, 'DELIVERED', delivery.deliveredAt);
    delivery.status = 'DELIVERED';
    await store.saveDelivery(delivery);
    return delivery;
  }

  return { complete, handle };
}

module.exports = { createDeliveryService, nearestNeighbour };
