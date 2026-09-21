// Diagnostic probes for open findings. Exit 1 means at least one gap remains.
// These use real domain services and MemoryStore, not a live MongoDB deployment.
const { MemoryStore } = require('../src/shared/persistence');
const { createInventoryService } = require('../src/services/inventory');
const { createReplenishmentService } = require('../src/services/replenishment');
const { createDeliveryService } = require('../src/services/delivery');
const { createEdgeProcessor } = require('../src/edge/processor');
const { createEvent } = require('../src/shared/events');

async function main() {
  const results = [];
  {
    const store = new MemoryStore();
    const service = createInventoryService({ store, publish: async () => {} });
    const apply = store.applyPhysicalDelta.bind(store);
    store.applyPhysicalDelta = async () => { throw new Error('Injected storage outage'); };
    const event = createEvent('stock.delta', 'store-01', {
      skuId: 'milk-1l', source: 'opening', delta: 10
    }, { eventId: 'audit-outage' });
    try { await service.handle(event); } catch (error) {
      if (error.message !== 'Injected storage outage') throw error;
    }
    store.applyPhysicalDelta = apply;
    const retry = await service.handle(event);
    const row = await store.getStock('store-01', 'milk-1l');
    results.push({ id: 'A1', finding: 'Ledger entry suppresses retry after stock write failure',
      expectedQty: 10, actualQty: row?.qty ?? null, retryDuplicate: retry.duplicate,
      gapObserved: row?.qty !== 10 });
  }
  {
    const store = new MemoryStore();
    const service = createInventoryService({ store, publish: async () => {} });
    const reading = { store: 'store-01', shelfId: 's1', skuId: 'milk-1l', grams: 10000, ts: 0 };
    await service.handle(createEdgeProcessor().processShelf(reading));
    await service.handle(createEdgeProcessor().processShelf({ ...reading, ts: 1000 }));
    const row = await store.getStock('store-01', 'milk-1l');
    results.push({ id: 'A2', finding: 'Edge restart adds the same opening stock twice',
      expectedQty: 10, actualQty: row.qty, gapObserved: row.qty !== 10 });
  }
  {
    const store = new MemoryStore();
    await store.saveOrder({ orderId: 'o1', store: 'store-01', status: 'PENDING_APPROVAL',
      lines: [{ skuId: 'milk-1l', qty: 6 }] });
    let offline = true;
    const published = [];
    const service = createReplenishmentService({ store, publish: async event => {
      if (offline) throw new Error('Injected publish outage');
      published.push(event);
    } });
    try { await service.approve('o1', 'manager:audit'); } catch (error) {
      if (error.message !== 'Injected publish outage') throw error;
    }
    offline = false;
    await service.approve('o1', 'manager:audit');
    results.push({ id: 'A3', finding: 'Approval cannot republish after publication failure',
      status: (await store.getOrder('o1')).status, expectedEvents: 1,
      actualEvents: published.length, gapObserved: published.length !== 1 });
  }
  {
    const store = new MemoryStore();
    await store.saveOrder({ orderId: 'o1', store: 'store-01', status: 'APPROVED',
      lines: [{ skuId: 'milk-1l', qty: 6 }] });
    const service = createDeliveryService({ store, publish: async () => {} });
    const event = createEvent('order.approved', 'store-01', { orderId: 'o1', approvedBy: 'manager:audit' });
    await Promise.all([service.handle(event), service.handle(event)]);
    const count = (await store.listDeliveries()).length;
    results.push({ id: 'A4', finding: 'Concurrent approval handlers create duplicate deliveries',
      expectedDeliveries: 1, actualDeliveries: count, gapObserved: count !== 1 });
  }
  console.log(JSON.stringify({ adapter: 'MemoryStore', results }, null, 2));
  if (results.some(result => result.gapObserved)) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 2; });
