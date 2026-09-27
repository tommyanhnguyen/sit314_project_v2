const test = require('node:test');
const assert = require('node:assert/strict');

const { parseShelfLine, shelfTopic } = require('../../src/hardware-gateway');

test('parses the Arduino shelf contract and builds its raw topic', () => {
  const reading = parseShelfLine(JSON.stringify({
    store: 'store-01', shelfId: 'physical-01', skuId: 'milk-1l',
    grams: 4250.5, ts: 1234, deviceId: 'arduino-01'
  }));
  assert.equal(reading.grams, 4250.5);
  assert.equal(shelfTopic(reading), 'shelfsense/raw/store-01/shelf/physical-01');
});

test('rejects malformed or incomplete Arduino readings', () => {
  assert.throws(() => parseShelfLine('not json'), /JSON/);
  assert.throws(() => parseShelfLine('{"store":"store-01"}'), /shelfId/);
  assert.throws(() => parseShelfLine(JSON.stringify({
    store: 'store-01', shelfId: 's1', skuId: 'milk-1l', grams: -1, ts: 1, deviceId: 'a1'
  })), /grams/);
});
