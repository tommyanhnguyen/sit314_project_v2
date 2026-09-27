const test = require('node:test');
const assert = require('node:assert/strict');

const { createApiServer } = require('../../src/api/server');
const { issueToken } = require('../../src/shared/auth');
const { MemoryStore } = require('../../src/shared/persistence');

async function setup() {
  const store = new MemoryStore();
  await store.saveStock({ store: 'store-01', skuId: 'milk-1l', qty: 1 });
  await store.saveStock({ store: 'store-02', skuId: 'milk-1l', qty: 2 });
  await store.saveOrder({ orderId: 'o1', store: 'store-01', status: 'PENDING_APPROVAL',
    lines: [{ skuId: 'milk-1l', qty: 6 }] });
  const server = createApiServer({ store, publish: async () => {}, authRequired: true,
    authSecret: 'api-secret', now: () => 100000 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, store, baseUrl: 'http://127.0.0.1:' + server.address().port };
}

function token(role, stores) {
  return issueToken({ sub: role, role, stores, exp: 200 }, 'api-secret', 100000);
}

test('API requires a token and filters reads by store scope', async t => {
  const api = await setup();
  t.after(() => new Promise(resolve => api.server.close(resolve)));
  assert.equal((await fetch(api.baseUrl + '/api/stock')).status, 401);
  const response = await fetch(api.baseUrl + '/api/stock', {
    headers: { authorization: 'Bearer ' + token('manager', ['store-01']) }
  });
  const rows = await response.json();
  assert.deepEqual(rows.map(row => row.store), ['store-01']);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('strict-transport-security'), /max-age=/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('API rejects wrong role and wrong store mutations', async t => {
  const api = await setup();
  t.after(() => new Promise(resolve => api.server.close(resolve)));
  let response = await fetch(api.baseUrl + '/api/orders/o1/approve', {
    method: 'POST', headers: { authorization: 'Bearer ' + token('driver', ['store-01']), 'content-type': 'application/json' },
    body: JSON.stringify({ approvedBy: 'driver' })
  });
  assert.equal(response.status, 403);
  response = await fetch(api.baseUrl + '/api/orders/o1/approve', {
    method: 'POST', headers: { authorization: 'Bearer ' + token('manager', ['store-02']), 'content-type': 'application/json' },
    body: JSON.stringify({ approvedBy: 'manager' })
  });
  assert.equal(response.status, 403);
});

test('supplier and driver cannot mutate a route containing an unauthorised store', async t => {
  const api = await setup();
  t.after(() => new Promise(resolve => api.server.close(resolve)));
  await api.store.saveDelivery({ deliveryId: 'route-1', status: 'DRAFT', stores: ['store-01', 'store-02'],
    orderIds: ['o1'], supplier: 'Dairy Distribution Centre', region: 'metro', stops: [] });

  const listing = await fetch(api.baseUrl + '/api/deliveries', {
    headers: { authorization: 'Bearer ' + token('supplier', ['store-01']) }
  });
  assert.deepEqual(await listing.json(), []);

  let response = await fetch(api.baseUrl + '/api/deliveries/route-1/dispatch', {
    method: 'POST', headers: { authorization: 'Bearer ' + token('supplier', ['store-01']) }
  });
  assert.equal(response.status, 403);
  response = await fetch(api.baseUrl + '/api/deliveries/route-1/start', {
    method: 'POST', headers: { authorization: 'Bearer ' + token('driver', ['store-01']) }
  });
  assert.equal(response.status, 403);
});
