const test = require('node:test');
const assert = require('node:assert/strict');

const { MemoryStore, MongoStore, newStockRow } = require('../../src/shared/persistence');

function stockEvent(overrides = {}) {
  return {
    eventId: 'evt-1',
    type: 'stock.delta',
    store: 'store-01',
    ts: 10,
    data: { skuId: 'milk-1l', delta: -1, source: 'shelf' },
    ...overrides
  };
}

test('records a stock event only once', async () => {
  const store = new MemoryStore();
  const event = stockEvent();

  assert.deepEqual(await store.recordStockEvent(event), { duplicate: false });
  assert.deepEqual(await store.recordStockEvent(event), { duplicate: true });
});

test('applies a physical stock delta', async () => {
  const store = new MemoryStore();
  await store.applyPhysicalDelta(stockEvent());

  const rows = await store.listStock();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].qty, -1);
});

test('records POS demand without changing physical quantity', async () => {
  const store = new MemoryStore();
  const event = stockEvent({
    eventId: 'pos-1',
    ts: 20,
    data: { skuId: 'milk-1l', delta: -2, source: 'pos' }
  });

  await store.recordSale(event);
  const row = await store.getStock('store-01', 'milk-1l');

  assert.equal(row.qty, 0);
  assert.equal(row.soldUnits, 2);
  assert.equal(row.saleCount, 1);
});

test('memory and Mongo adapters expose the same service methods', () => {
  const methods = [
    'recordStockEvent', 'applyPhysicalDelta', 'recordSale', 'getStock',
    'saveStock', 'listStock', 'saveOrder', 'getOrder', 'findOpenOrder',
    'approveOrder', 'closeOrder', 'listOrders', 'saveAlert', 'listAlerts',
    'saveDelivery', 'getDelivery', 'listDeliveries', 'saveDeadLetter', 'listDeadLetters', 'close'
  ];

  for (const name of methods) {
    assert.equal(typeof MemoryStore.prototype[name], 'function', 'MemoryStore.' + name);
    assert.equal(typeof MongoStore.prototype[name], 'function', 'MongoStore.' + name);
  }
});

test('Mongo stock upsert includes complete defaults without overwriting counters', async () => {
  const store = new MongoStore('unused');
  let update;
  store.db = {
    collection: () => ({
      updateOne: async (query, value) => { update = value; }
    })
  };

  await store.saveStock(newStockRow('store-01', 'milk-1l'));

  assert.equal(update.$setOnInsert.qty, 0);
  assert.equal(update.$setOnInsert.soldUnits, 0);
  assert.equal(update.$setOnInsert.saleCount, 0);
  assert.equal(update.$set.qty, undefined);
  assert.equal(update.$set.soldUnits, undefined);
});

test('Mongo index migration tolerates another process removing the old index', async () => {
  const store = new MongoStore('unused');
  let created = false;
  store.db = {
    collection: () => ({
      indexes: async () => [{ name: 'openKey_1', key: { openKey: 1 } }],
      dropIndex: async () => {
        const error = new Error('index not found');
        error.code = 27;
        throw error;
      },
      createIndex: async () => { created = true; }
    })
  };

  await store.ensureOpenOrderIndex();
  assert.equal(created, true);
});
