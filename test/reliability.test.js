const test = require('node:test');
const assert = require('node:assert/strict');

const { createInventoryService } = require('../src/services/inventory');
const { createReplenishmentService } = require('../src/services/replenishment');
const { drainApprovalOutbox } = require('../src/api');
const { createEvent } = require('../src/shared/events');
const { MemoryStore } = require('./memory-store');

test('stock event retry continues after a storage failure', async () => {
  const store = new MemoryStore();
  const inventory = createInventoryService({ store, publish: async () => {} });
  const original = store.applyPhysicalDelta.bind(store);
  let fail = true;
  store.applyPhysicalDelta = async event => {
    if (fail) { fail = false; throw new Error('storage unavailable'); }
    return original(event);
  };
  const event = createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', source: 'opening', delta: 10
  }, { eventId: 'reliable-stock-1' });
  await assert.rejects(inventory.handle(event), /storage unavailable/);
  assert.equal((await inventory.handle(event)).duplicate, false);
  assert.equal((await store.getStock('store-01', 'milk-1l')).qty, 10);
});

test('stock retry after publish failure does not apply the delta twice', async () => {
  const store = new MemoryStore();
  let fail = true;
  const events = [];
  const inventory = createInventoryService({ store, publish: async event => {
    if (fail) { fail = false; throw new Error('mqtt unavailable'); }
    events.push(event);
  } });
  const event = createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', source: 'opening', delta: 10
  }, { eventId: 'reliable-stock-2' });
  await assert.rejects(inventory.handle(event), /mqtt unavailable/);
  await inventory.handle(event);
  assert.equal((await store.getStock('store-01', 'milk-1l')).qty, 10);
  assert.equal(events[0].eventId, 'stock-updated-reliable-stock-2');
});

test('approval publish failure remains in the outbox and recovers after restart', async () => {
  const store = new MemoryStore();
  await store.saveOrder({ orderId: 'order-1', store: 'store-01', status: 'PENDING_APPROVAL',
    lines: [{ skuId: 'milk-1l', qty: 6 }] });
  const service = createReplenishmentService({ store, publish: async () => {
    throw new Error('mqtt unavailable');
  }, now: () => 100 });
  await assert.rejects(service.approve('order-1', 'manager:tommy'), /mqtt unavailable/);
  assert.equal((await store.listPendingApprovalEvents()).length, 1);
  const published = [];
  const count = await drainApprovalOutbox({ store, publish: async event => published.push(event) });
  assert.equal(count, 1);
  assert.equal(published[0].eventId, 'order-approved-order-1');
  assert.equal((await store.listPendingApprovalEvents()).length, 0);
});
