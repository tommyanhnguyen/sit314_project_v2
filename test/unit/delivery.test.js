const test = require('node:test');
const assert = require('node:assert/strict');

const { createDeliveryService, nearestNeighbour } = require('../../src/services/delivery');
const { MemoryStore } = require('../../src/shared/persistence');
const { createEvent } = require('../../src/shared/events');

test('chooses the closest next stop', () => {
  const route = nearestNeighbour(
    { x: 0, y: 0 },
    [{ id: 'far', x: 10, y: 0 }, { id: 'near', x: 1, y: 0 }]
  );

  assert.deepEqual(route.map(stop => stop.id), ['near', 'far']);
});

test('creates one delivery from an approved order', async () => {
  const store = new MemoryStore();
  const published = [];
  await store.saveOrder({
    orderId: 'order-1', store: 'store-01', supplier: 'Dairy Distribution Centre',
    lines: [{ skuId: 'milk-1l', qty: 12 }], status: 'APPROVED'
  });
  const service = createDeliveryService({
    store,
    publish: async event => published.push(event),
    idFactory: () => 'delivery-1',
    now: () => 1000,
    locations: {
      depot: { x: 0, y: 0 },
      'store-01': { x: 3, y: 4 }
    }
  });
  const approved = createEvent('order.approved', 'store-01', {
    orderId: 'order-1', approvedBy: 'manager:tommy'
  }, { ts: 20 });

  const delivery = await service.handle(approved);

  assert.equal(delivery.deliveryId, 'delivery-1');
  assert.deepEqual(delivery.route, ['store-01']);
  assert.equal((await store.listDeliveries()).length, 1);
  assert.equal(published[0].type, 'delivery.created');
});
