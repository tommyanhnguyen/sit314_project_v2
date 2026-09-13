const config = require('../shared/config');
const { getSku } = require('../shared/catalogue');
const { createEvent } = require('../shared/events');

function createEdgeProcessor(options = {}) {
  const debounceMs = options.debounceMs ?? config.debounceMs;
  const settleBandItems = options.settleBandItems ?? 0.15;
  const minimumItemDelta = options.minimumItemDelta ?? 0.4;
  const temperatureLimitC = options.temperatureLimitC ?? config.temperatureLimitC;
  const temperatureSamples = options.temperatureSamples ?? config.temperatureSamples;
  const temperatureHysteresisC = options.temperatureHysteresisC ?? config.temperatureHysteresisC;
  const shelves = new Map();
  const fridges = new Map();

  function processShelf(reading) {
    const { store, shelfId, skuId, grams, ts } = reading;
    const wallTs = reading.wallTs ?? ts;
    const item = getSku(skuId);
    const key = store + '/' + shelfId;
    const current = shelves.get(key);

    if (!current) {
      const opening = Math.round(grams / item.unitWeight);
      shelves.set(key, { settledGrams: opening * item.unitWeight, pendingGrams: grams, pendingAt: wallTs });
      if (opening <= 0) return null;
      return createEvent('stock.delta', store, {
        skuId, shelfId, delta: opening, source: 'opening', wallTs
      }, { ts });
    }

    const band = item.unitWeight * settleBandItems;
    if (Math.abs(grams - current.pendingGrams) > band) {
      current.pendingGrams = grams;
      current.pendingAt = wallTs;
      return null;
    }

    current.pendingGrams = (current.pendingGrams + grams) / 2;
    if (wallTs - current.pendingAt < debounceMs) return null;

    const itemDelta = (current.pendingGrams - current.settledGrams) / item.unitWeight;
    if (Math.abs(itemDelta) < minimumItemDelta) return null;

    const delta = Math.round(itemDelta);
    if (delta === 0) return null;

    current.settledGrams += delta * item.unitWeight;
    current.pendingAt = wallTs;
    return createEvent('stock.delta', store, {
      skuId, shelfId, delta, source: 'shelf', wallTs
    }, { ts });
  }

  function processPos(sale) {
    getSku(sale.skuId);
    return createEvent('stock.delta', sale.store, {
      skuId: sale.skuId,
      delta: -Math.abs(sale.qty),
      source: 'pos',
      txnId: sale.txnId,
      wallTs: sale.wallTs ?? Date.now()
    }, { eventId: 'pos-' + sale.txnId, ts: sale.ts });
  }

  function processTemperature(reading) {
    const key = reading.store + '/' + reading.unitId;
    const current = fridges.get(key) || { hotSamples: 0, breached: false };
    fridges.set(key, current);

    if (reading.tempC > temperatureLimitC) {
      current.hotSamples += 1;
      if (current.breached || current.hotSamples < temperatureSamples) return null;
      current.breached = true;
      return createEvent('coldchain.alert', reading.store, {
        unitId: reading.unitId,
        tempC: reading.tempC,
        state: 'BREACH',
        wallTs: reading.wallTs ?? Date.now()
      }, { ts: reading.ts });
    }

    current.hotSamples = 0;
    if (!current.breached || reading.tempC > temperatureLimitC - temperatureHysteresisC) return null;
    current.breached = false;
    return createEvent('coldchain.alert', reading.store, {
      unitId: reading.unitId,
      tempC: reading.tempC,
      state: 'CLEARED',
      wallTs: reading.wallTs ?? Date.now()
    }, { ts: reading.ts });
  }

  return { processShelf, processPos, processTemperature };
}

module.exports = { createEdgeProcessor };
