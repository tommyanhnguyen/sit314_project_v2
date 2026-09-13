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

test('serves the manager portal', async t => {
  const api = await startTestApi();
  t.after(() => new Promise(resolve => api.server.close(resolve)));

  const response = await fetch(api.baseUrl + '/');
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /ShelfSense/);
});
