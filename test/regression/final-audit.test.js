const test = require('node:test');
const assert = require('node:assert/strict');
const { createEdgeProcessor } = require('../../src/edge/processor');
const { createInventoryService } = require('../../src/services/inventory');
const { MemoryStore } = require('../../src/shared/persistence');
const { createEvent } = require('../../src/shared/events');

test('invalid shelf input cannot poison the next valid opening reading', () => {
  const edge = createEdgeProcessor();
  const reading = { store: 'store-01', shelfId: 's1', skuId: 'milk-1l', ts: 0 };
  for (const grams of [undefined, NaN, Infinity, -1000, '10000']) {
    assert.throws(() => edge.processShelf({ ...reading, grams }));
  }
  assert.equal(edge.processShelf({ ...reading, grams: 10000 }).data.delta, 10);
});

test('invalid temperature cannot clear an active breach', () => {
  const edge = createEdgeProcessor({ temperatureSamples: 1 });
  const reading = { store: 'store-01', unitId: 'f1', ts: 0 };
  assert.equal(edge.processTemperature({ ...reading, tempC: 7 }).data.state, 'BREACH');
  assert.throws(() => edge.processTemperature({ ...reading, tempC: NaN }));
  assert.equal(edge.processTemperature({ ...reading, tempC: 4 }).data.state, 'CLEARED');
});

test('POS deduplication preserves separate stores and separate SKU lines', async () => {
  const edge = createEdgeProcessor();
  const store = new MemoryStore();
  const inventory = createInventoryService({ store, publish: async () => {} });
  const sale = { txnId: 'receipt-1', qty: 1, ts: 0 };
  const first = edge.processPos({ ...sale, store: 'store-01', skuId: 'milk-1l' });
  await inventory.handle(first);
  await inventory.handle(first);
  await inventory.handle(edge.processPos({ ...sale, store: 'store-02', skuId: 'milk-1l' }));
  await inventory.handle(edge.processPos({ ...sale, store: 'store-01', skuId: 'rice-1kg' }));
  assert.equal((await store.getStock('store-01', 'milk-1l')).soldUnits, 1);
  assert.equal((await store.getStock('store-02', 'milk-1l'))?.soldUnits, 1);
  assert.equal((await store.getStock('store-01', 'rice-1kg'))?.soldUnits, 1);
});

test('POS without a transaction identifier is rejected', () => {
  const edge = createEdgeProcessor();
  assert.throws(() => edge.processPos({ store: 'store-01', skuId: 'milk-1l', qty: 1, ts: 0 }));
});

test('invalid business stock events are rejected before ledger or stock writes', async () => {
  for (const data of [
    { skuId: 'missing', source: 'opening', delta: 1 },
    { skuId: 'toString', source: 'opening', delta: 1 },
    { skuId: 'milk-1l', source: 'pos', delta: 0 },
    { skuId: 'milk-1l', source: 'pos', delta: 1 }
  ]) {
    const store = new MemoryStore();
    const published = [];
    const inventory = createInventoryService({ store, publish: async event => published.push(event) });
    await assert.rejects(inventory.handle(createEvent('stock.delta', 'store-01', data)));
    assert.equal(store.stockEvents.size, 0);
    assert.deepEqual(await store.listStock(), []);
    assert.deepEqual(published, []);
  }
});
