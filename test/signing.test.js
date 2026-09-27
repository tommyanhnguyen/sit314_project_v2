const test = require('node:test');
const assert = require('node:assert/strict');

const { createEvent, signEvent, verifyEvent } = require('../src/shared/events');

test('verifies an unchanged signed event', () => {
  const signed = signEvent(createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: 1, source: 'opening'
  }, { eventId: 'signed-1', ts: 1 }), 'secret');
  assert.equal(verifyEvent(signed, 'secret'), true);
});

test('rejects a modified or unsigned event', () => {
  const signed = signEvent(createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: 1, source: 'opening'
  }, { eventId: 'signed-2', ts: 1 }), 'secret');
  signed.data.delta = 999;
  assert.throws(() => verifyEvent(signed, 'secret'), /signature/);
  assert.throws(() => verifyEvent({ eventId: 'x' }, 'secret'), /signature/);
});
