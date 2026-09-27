const test = require('node:test');
const assert = require('node:assert/strict');

const { createEdgeProcessor } = require('../node-red/edge');

test('emits opening stock from the first shelf reading', () => {
  const edge = createEdgeProcessor({ debounceMs: 100 });
  const event = edge.processShelf({
    store: 'store-01', shelfId: 's1', skuId: 'milk-1l',
    grams: 10000, ts: 0, wallTs: 0
  });

  assert.equal(event.type, 'stock.delta');
  assert.equal(event.data.delta, 10);
  assert.equal(event.data.source, 'opening');
});

test('edge events carry the evidence run ID through shelf and fridge processing', () => {
  const edge = createEdgeProcessor({ temperatureSamples: 2 });
  const stock = edge.processShelf({ store: 'store-01', shelfId: 'trial', skuId: 'milk-1l',
    grams: 10000, ts: 0, runId: 'trial1' });
  edge.processTemperature({ store: 'store-01', unitId: 'cold', tempC: 6.1,
    ts: 0, runId: 'trial1' });
  const alert = edge.processTemperature({ store: 'store-01', unitId: 'cold', tempC: 6.4,
    ts: 1, runId: 'trial1' });
  assert.equal(stock.data.runId, 'trial1');
  assert.equal(alert.data.runId, 'trial1');
});

test('emits one stock delta after a shelf change settles', () => {
  const edge = createEdgeProcessor({ debounceMs: 100 });
  edge.processShelf({ store: 'store-01', shelfId: 's1', skuId: 'milk-1l', grams: 10000, ts: 0, wallTs: 0 });
  assert.equal(edge.processShelf({ store: 'store-01', shelfId: 's1', skuId: 'milk-1l', grams: 9000, ts: 10, wallTs: 10 }), null);

  const event = edge.processShelf({
    store: 'store-01', shelfId: 's1', skuId: 'milk-1l',
    grams: 9000, ts: 120, wallTs: 120
  });

  assert.equal(event.data.delta, -1);
  assert.equal(event.data.source, 'shelf');
});

test('converts a POS sale into a demand event', () => {
  const edge = createEdgeProcessor();
  const event = edge.processPos({
    store: 'store-01', skuId: 'milk-1l', qty: 2,
    txnId: 'txn-1', ts: 20, wallTs: 25
  });

  assert.equal(event.eventId, edge.processPos({
    store: 'store-01', skuId: 'milk-1l', qty: 2,
    txnId: 'txn-1', ts: 20, wallTs: 25
  }).eventId);
  assert.equal(event.data.delta, -2);
  assert.equal(event.data.source, 'pos');
});

test('rejects a POS sale with zero quantity', () => {
  const edge = createEdgeProcessor();
  assert.throws(() => edge.processPos({
    store: 'store-01', skuId: 'milk-1l', qty: 0,
    txnId: 'txn-empty', ts: 20
  }), /greater than zero/);
});

test('emits one breach and one clear event with hysteresis', () => {
  const edge = createEdgeProcessor({
    temperatureSamples: 2,
    temperatureLimitC: 5,
    temperatureHysteresisC: 0.8
  });

  assert.equal(edge.processTemperature({ store: 'store-01', unitId: 'f1', tempC: 6, ts: 1 }), null);
  assert.equal(edge.processTemperature({ store: 'store-01', unitId: 'f1', tempC: 6.2, ts: 2 }).data.state, 'BREACH');
  assert.equal(edge.processTemperature({ store: 'store-01', unitId: 'f1', tempC: 6.1, ts: 3 }), null);
  assert.equal(edge.processTemperature({ store: 'store-01', unitId: 'f1', tempC: 4.1, ts: 4 }).data.state, 'CLEARED');
});

test('restores shelf and fridge state after an edge restart', () => {
  const first = createEdgeProcessor({ debounceMs: 100, temperatureSamples: 2 });
  first.processShelf({ store: 'store-01', shelfId: 's1', skuId: 'milk-1l', grams: 10000, ts: 0 });
  first.processTemperature({ store: 'store-01', unitId: 'f1', tempC: 6, ts: 0 });
  const restored = createEdgeProcessor({
    debounceMs: 100,
    temperatureSamples: 2,
    initialState: first.snapshot()
  });
  assert.equal(restored.processShelf({
    store: 'store-01', shelfId: 's1', skuId: 'milk-1l', grams: 10000, ts: 1000
  }), null);
  assert.equal(restored.processTemperature({
    store: 'store-01', unitId: 'f1', tempC: 6, ts: 1
  }).data.state, 'BREACH');
});
