const test = require('node:test');
const assert = require('node:assert/strict');

const { createDeliveryService } = require('../../src/services/delivery');
const { nearestNeighbour } = require('../../src/shared/topology');
const { MemoryStore } = require('../../src/shared/persistence');
const { createEvent } = require('../../src/shared/events');

test('chooses the closest next stop', () => {
  const route = nearestNeighbour(
    { x: 0, y: 0 },
    [{ id: 'far', x: 10, y: 0 }, { id: 'near', x: 1, y: 0 }]
  );

  assert.deepEqual(route.map(stop => stop.id), ['near', 'far']);
});

test('batches approved orders by supplier and region', async () => {
  const store = new MemoryStore();
  const published = [];
  await store.saveOrder({
    orderId: 'order-1', store: 'store-01', supplier: 'Dairy Distribution Centre',
    lines: [{ skuId: 'milk-1l', qty: 12 }], status: 'APPROVED'
  });
  await store.saveOrder({
    orderId: 'order-2', store: 'store-02', supplier: 'Dairy Distribution Centre',
    lines: [{ skuId: 'milk-1l', qty: 6 }], status: 'APPROVED'
  });
  const service = createDeliveryService({
    store,
    publish: async event => published.push(event),
    idFactory: () => 'delivery-1',
    now: () => 1000,
  });
  const first = createEvent('order.approved', 'store-01', {
    orderId: 'order-1', approvedBy: 'manager:tommy'
  }, { ts: 20 });
  const second = createEvent('order.approved', 'store-02', {
    orderId: 'order-2', approvedBy: 'manager:tommy'
  }, { ts: 21 });

  await service.handle(first);
  const delivery = await service.handle(second);

  assert.equal(delivery.deliveryId, 'delivery-1');
  assert.equal(delivery.status, 'DRAFT');
  assert.deepEqual(delivery.orderIds, ['order-1', 'order-2']);
  assert.deepEqual(delivery.stores, ['store-01', 'store-02']);
  assert.equal((await store.listDeliveries()).length, 1);
  assert.equal(published[0].type, 'delivery.created');
});

test('dispatch computes a multi-stop route and ETAs', async () => {
  const store = new MemoryStore();
  const service = createDeliveryService({ store, publish: async () => {}, now: () => 1000, speedKmPerHour: 10 });
  for (const [orderId, storeId] of [['o1', 'store-01'], ['o2', 'store-02']]) {
    await store.saveOrder({ orderId, store: storeId, supplier: 'Dairy Distribution Centre',
      lines: [{ skuId: 'milk-1l', qty: 6 }], status: 'APPROVED' });
    await service.handle(createEvent('order.approved', storeId, { orderId, approvedBy: 'manager' }));
  }
  const delivery = await service.dispatch((await store.listDeliveries())[0].deliveryId);
  assert.equal(delivery.status, 'PLANNED');
  assert.deepEqual(delivery.route, ['store-01', 'store-02']);
  assert.deepEqual(delivery.stops.map(stop => ({ store: stop.store, eta: stop.eta, status: stop.status })), [
    { store: 'store-01', eta: 1801000, status: 'PENDING' },
    { store: 'store-02', eta: 3601000, status: 'PENDING' }
  ]);
});

test('concurrent approval handling creates one delivery and one order membership', async () => {
  const store = new MemoryStore();
  await store.saveOrder({ orderId: 'o1', store: 'store-01', supplier: 'Dairy Distribution Centre',
    lines: [{ skuId: 'milk-1l', qty: 6 }], status: 'APPROVED' });
  let sequence = 0;
  const service = createDeliveryService({ store, publish: async () => {}, idFactory: () => 'd' + (++sequence) });
  const event = createEvent('order.approved', 'store-01', { orderId: 'o1', approvedBy: 'manager' });
  await Promise.all([service.handle(event), service.handle(event)]);
  const deliveries = await store.listDeliveries();
  assert.equal(deliveries.length, 1);
  assert.deepEqual(deliveries[0].orderIds, ['o1']);
});

test('completing stops restocks each order once and closes the batch', async () => {
  const store = new MemoryStore();
  const published = [];
  const service = createDeliveryService({ store, publish: async event => published.push(event), now: () => 2000 });
  for (const [orderId, storeId] of [['o1', 'store-01'], ['o2', 'store-02']]) {
    await store.saveOrder({ orderId, store: storeId, supplier: 'Dairy Distribution Centre', openKey: storeId + '/milk-1l',
      lines: [{ skuId: 'milk-1l', qty: 6 }], status: 'APPROVED' });
    await service.handle(createEvent('order.approved', storeId, { orderId, approvedBy: 'manager' }));
  }
  const id = (await store.listDeliveries())[0].deliveryId;
  await service.dispatch(id);
  await service.start(id);
  await service.completeStop(id, 'store-01');
  await service.completeStop(id, 'store-01');
  const completed = await service.completeStop(id, 'store-02');
  assert.equal(completed.status, 'DELIVERED');
  assert.equal((await store.getOrder('o1')).status, 'DELIVERED');
  assert.equal((await store.getOrder('o2')).status, 'DELIVERED');
  assert.equal(published.filter(event => event.type === 'stock.delta').length, 2);
});
