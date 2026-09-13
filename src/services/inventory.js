const { createEvent, validateEvent } = require('../shared/events');

const DAY_MS = 24 * 60 * 60 * 1000;
const PHYSICAL_SOURCES = new Set(['shelf', 'opening', 'delivery']);

function createInventoryService(options) {
  const { store, publish } = options;
  const clock = options.clock || Date.now;
  const minSales = options.minSales ?? 3;
  const minWindowMs = options.minWindowMs ?? 60 * 60 * 1000;

  async function handle(event) {
    validateEvent(event);
    if (event.type !== 'stock.delta') throw new Error('Inventory expects stock.delta');

    const result = await store.recordStockEvent(event);
    if (result.duplicate) return result;

    if (PHYSICAL_SOURCES.has(event.data.source)) {
      await store.applyPhysicalDelta(event);
    } else if (event.data.source === 'pos' && event.data.delta < 0) {
      await store.recordSale(event);
    }

    const row = await store.getStock(event.store, event.data.skuId);
    updateVelocity(row, minSales, minWindowMs);
    row.updatedAt = event.ts;
    await store.saveStock(row);

    const wallTs = event.data.wallTs;
    const latencyMs = Number.isFinite(wallTs) ? Math.max(0, clock() - wallTs) : null;
    const update = createEvent('stock.updated', event.store, {
      skuId: row.skuId,
      qty: row.qty,
      velocityPerDay: row.velocityPerDay,
      daysToStockout: row.daysToStockout,
      latencyMs
    }, { ts: event.ts });

    await publish(update);
    return { duplicate: false, row, event: update };
  }

  return { handle };
}

function updateVelocity(row, minSales, minWindowMs) {
  const windowMs = row.firstSaleTs === null || row.lastSaleTs === null
    ? 0
    : row.lastSaleTs - row.firstSaleTs;

  if (row.saleCount < minSales || windowMs < minWindowMs) {
    row.velocityPerDay = 0;
    row.daysToStockout = null;
    return row;
  }

  row.velocityPerDay = Number((row.soldUnits / (windowMs / DAY_MS)).toFixed(2));
  row.daysToStockout = row.velocityPerDay > 0
    ? Number((Math.max(row.qty, 0) / row.velocityPerDay).toFixed(2))
    : null;
  return row;
}

module.exports = { DAY_MS, PHYSICAL_SOURCES, createInventoryService, updateVelocity };
