const test = require('node:test');
const assert = require('node:assert/strict');

const { createApiServer } = require('../../src/api/server');
const { MemoryStore } = require('../../src/shared/persistence');

async function startTestApi() {
  const store = new MemoryStore();
  const published = [];
  await store.saveStock({ store: 'store-01', skuId: 'milk-1l', qty: 4, velocityPerDay: 3 });
  await store.saveOrder({
    orderId: 'order-1', store: 'store-01', lines: [{ skuId: 'milk-1l', qty: 12 }],
    value: 38.4, status: 'PENDING_APPROVAL'
  });
  const server = createApiServer({ store, publish: async event => published.push(event) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    store,
    published,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

test('serves stock through the API', async t => {
  const api = await startTestApi();
  t.after(() => new Promise(resolve => api.server.close(resolve)));

  const response = await fetch(api.baseUrl + '/api/stock');
  const rows = await response.json();

  assert.equal(response.status, 200);
  assert.equal(rows[0].qty, 4);
});

test('health reports unavailable when the database connection is lost', async t => {
  const api = await startTestApi();
  t.after(() => new Promise(resolve => api.server.close(resolve)));
  api.store.isReady = () => false;
  const response = await fetch(api.baseUrl + '/health');
  assert.equal(response.status, 503);
});

test('approves a pending order and publishes the decision', async t => {
  const api = await startTestApi();
  t.after(() => new Promise(resolve => api.server.close(resolve)));

  const response = await fetch(api.baseUrl + '/api/orders/order-1/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ approvedBy: 'manager:tommy' })
  });
  const order = await response.json();

  assert.equal(response.status, 200);
  assert.equal(order.status, 'APPROVED');
  assert.equal(api.published[0].type, 'order.approved');
});

test('completes a delivery and releases its order', async t => {
  const api = await startTestApi();
  t.after(() => new Promise(resolve => api.server.close(resolve)));
  await api.store.saveOrder({
    orderId: 'order-2',
    store: 'store-01',
    openKey: 'store-01/milk-1l',
    lines: [{ skuId: 'milk-1l', qty: 6 }],
    status: 'IN_DELIVERY'
  });
  await api.store.saveDelivery({
    deliveryId: 'delivery-2', orderId: 'order-2', store: 'store-01', status: 'PLANNED'
  });

  const response = await fetch(api.baseUrl + '/api/deliveries/delivery-2/complete', { method: 'POST' });
  const delivery = await response.json();
  const order = await api.store.getOrder('order-2');

  assert.equal(response.status, 200);
  assert.equal(delivery.status, 'DELIVERED');
  assert.equal(order.openKey, undefined);
  assert.ok(api.published.some(event => event.type === 'stock.delta'));
});

test('returns 404 for an unknown delivery', async t => {
  const api = await startTestApi();
  t.after(() => new Promise(resolve => api.server.close(resolve)));

  const response = await fetch(api.baseUrl + '/api/deliveries/missing/complete', { method: 'POST' });
  assert.equal(response.status, 404);
});

test('dispatches, starts and completes one stop in a delivery batch', async t => {
  const api = await startTestApi();
  t.after(() => new Promise(resolve => api.server.close(resolve)));
  for (const [orderId, storeId] of [['batch-o1', 'store-01'], ['batch-o2', 'store-02']]) {
    await api.store.saveOrder({ orderId, store: storeId, supplier: 'Dairy Distribution Centre',
      openKey: storeId + '/milk-1l', lines: [{ skuId: 'milk-1l', qty: 6 }], status: 'IN_DELIVERY' });
  }
  await api.store.saveDelivery({
    deliveryId: 'batch-1', batchKey: 'dairy:east', supplier: 'Dairy Distribution Centre',
    region: 'melbourne-east', orderIds: ['batch-o1', 'batch-o2'], stores: ['store-01', 'store-02'],
    route: [], stops: [], status: 'DRAFT', createdAt: 1
  });

  let response = await fetch(api.baseUrl + '/api/deliveries/batch-1/dispatch', { method: 'POST' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).stops.length, 2);
  response = await fetch(api.baseUrl + '/api/deliveries/batch-1/start', { method: 'POST' });
  assert.equal((await response.json()).status, 'IN_TRANSIT');
  response = await fetch(api.baseUrl + '/api/deliveries/batch-1/stops/store-01/complete', { method: 'POST' });
  const delivery = await response.json();
  assert.equal(delivery.status, 'IN_TRANSIT');
  assert.equal(delivery.stops[0].status, 'DELIVERED');
});

test('serves the manager portal', async t => {
  const api = await startTestApi();
  t.after(() => new Promise(resolve => api.server.close(resolve)));

  const response = await fetch(api.baseUrl + '/');
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /ShelfSense/);
});
