const test = require('node:test');
const assert = require('node:assert/strict');

const { createInventoryService } = require('../src/services/inventory');
const { MemoryStore } = require('./memory-store');
const { createEvent } = require('../src/shared/events');

function delta(eventId, source, amount, ts) {
  return createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l',
    delta: amount,
    source,
    wallTs: ts
  }, { eventId, ts });
}

test('does not subtract POS and shelf events twice', async () => {
  const store = new MemoryStore();
  const service = createInventoryService({ store, publish: async () => {}, clock: () => 20 });

  await service.handle(delta('open-1', 'opening', 10, 1));
  await service.handle(delta('shelf-1', 'shelf', -1, 10));
  await service.handle(delta('pos-1', 'pos', -1, 15));

  assert.equal((await store.getStock('store-01', 'milk-1l')).qty, 9);
});

test('ignores a duplicate event', async () => {
  const store = new MemoryStore();
  const published = [];
  const service = createInventoryService({ store, publish: async event => published.push(event) });
  const opening = delta('open-1', 'opening', 10, 1);

  assert.equal((await service.handle(opening)).duplicate, false);
  assert.equal((await service.handle(opening)).duplicate, true);
  assert.equal((await store.getStock('store-01', 'milk-1l')).qty, 10);
  assert.equal(published.length, 1);
});

test('computes sales velocity after enough history', async () => {
  const store = new MemoryStore();
  const published = [];
  const service = createInventoryService({
    store,
    publish: async event => published.push(event),
    minSales: 3,
    minWindowMs: 60 * 60 * 1000,
    clock: () => 3 * 60 * 60 * 1000
  });

  await service.handle(delta('open-1', 'opening', 10, 0));
  await service.handle(delta('pos-1', 'pos', -1, 0));
  await service.handle(delta('pos-2', 'pos', -1, 30 * 60 * 1000));
  await service.handle(delta('pos-3', 'pos', -1, 60 * 60 * 1000));

  const row = await store.getStock('store-01', 'milk-1l');
  assert.equal(row.velocityPerDay, 72);
  assert.equal(row.daysToStockout, 0.14);
  assert.equal(published.at(-1).type, 'stock.updated');
});
