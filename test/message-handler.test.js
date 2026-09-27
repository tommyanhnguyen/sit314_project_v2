const test = require('node:test');
const assert = require('node:assert/strict');
const { createEvent, signEvent } = require('../src/shared/events');

const { handleMessage } = require('../src/shared/transport');

test('sends invalid JSON to the dead letter handler', async () => {
  const rejected = [];
  const result = await handleMessage({
    topic: 'shelfsense/events/stock.delta',
    payload: Buffer.from('{bad'),
    expectedType: 'stock.delta',
    process: async () => {},
    deadLetter: async item => rejected.push(item)
  });

  assert.equal(result.accepted, false);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].reason, /JSON/);
});

test('catches a service error without rejecting the consumer promise', async () => {
  const rejected = [];
  const event = createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: -1, source: 'shelf'
  });
  const result = await handleMessage({
    topic: 'shelfsense/events/stock.delta',
    payload: Buffer.from(JSON.stringify(event)),
    expectedType: 'stock.delta',
    process: async () => { throw new Error('service failure'); },
    deadLetter: async item => rejected.push(item)
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'service failure');
  assert.equal(rejected.length, 1);
});

test('accepts one valid event', async () => {
  const processed = [];
  const event = createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: -1, source: 'shelf'
  });
  const result = await handleMessage({
    topic: 'shelfsense/events/stock.delta',
    payload: Buffer.from(JSON.stringify(event)),
    expectedType: 'stock.delta',
    process: async value => processed.push(value),
    deadLetter: async () => {}
  });

  assert.deepEqual(result, { accepted: true });
  assert.equal(processed[0].eventId, event.eventId);
});

test('signed consumer accepts a valid event and rejects a modified event', async () => {
  const event = signEvent(createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: -1, source: 'shelf'
  }), 'test-signing-secret');
  const processed = [];
  const rejected = [];
  const options = {
    topic: 'shelfsense/events/stock.delta',
    expectedType: 'stock.delta',
    signingSecret: 'test-signing-secret',
    process: async value => processed.push(value),
    deadLetter: async item => rejected.push(item)
  };

  assert.equal((await handleMessage({ ...options, payload: event })).accepted, true);
  assert.equal(processed.length, 1);
  const modified = { ...event, data: { ...event.data, delta: -5 } };
  assert.equal((await handleMessage({ ...options, payload: modified })).accepted, false);
  assert.equal(processed.length, 1);
  assert.match(rejected[0].reason, /signature/);
});
