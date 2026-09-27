const test = require('node:test');
const assert = require('node:assert/strict');

const { createEvent, getSku, validateEvent } = require('../src/shared/events');

test('creates the common event envelope', () => {
  const event = createEvent(
    'stock.delta',
    'store-01',
    { skuId: 'milk-1l', delta: -1, source: 'shelf' },
    { eventId: 'evt-1', ts: 10 }
  );

  assert.deepEqual(event, {
    eventId: 'evt-1',
    type: 'stock.delta',
    store: 'store-01',
    ts: 10,
    data: { skuId: 'milk-1l', delta: -1, source: 'shelf' }
  });
});

test('rejects a stock delta with missing or invalid fields', () => {
  const event = {
    eventId: 'evt-1',
    type: 'stock.delta',
    store: 'store-01',
    ts: 10,
    data: { delta: 'bad' }
  };

  assert.throws(() => validateEvent(event), /skuId|delta/);
});

test('rejects an unknown event type', () => {
  const event = createEvent('unknown.event', 'store-01', {});
  assert.throws(() => validateEvent(event), /Unknown event type/);
});

test('rejects an unknown stock source', () => {
  const event = createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: 1, source: 'manual'
  });
  assert.throws(() => validateEvent(event), /source/);
});

test('returns known SKU data and rejects unknown SKUs', () => {
  assert.equal(getSku('milk-1l').unitWeight, 1000);
  assert.throws(() => getSku('missing'), /Unknown SKU/);
});
