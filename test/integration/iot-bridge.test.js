const test = require('node:test');
const assert = require('node:assert/strict');
const { createEvent } = require('../../src/shared/events');
const { signEvent } = require('../../src/shared/signing');
const { forwardBusinessEvent } = require('../../src/cloud/iot-bridge');

test('IoT bridge forwards a valid signed Node-RED event to the same topic', async () => {
  const event = signEvent(createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: 5, source: 'opening'
  }), 'edge-secret');
  let sent;
  const cloudClient = { publish(topic, payload, options, callback) {
    sent = { topic, payload: JSON.parse(payload), qos: options.qos };
    callback();
  } };
  await forwardBusinessEvent({ topic: 'shelfsense/events/stock.delta',
    payload: Buffer.from(JSON.stringify(event)), cloudClient, signingSecret: 'edge-secret' });
  assert.equal(sent.topic, 'shelfsense/events/stock.delta');
  assert.equal(sent.payload.eventId, event.eventId);
  assert.equal(sent.qos, 1);
});

test('IoT bridge rejects a modified signed event before cloud publication', async () => {
  const event = signEvent(createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: 5, source: 'opening'
  }), 'edge-secret');
  event.data.delta = 100;
  let publishes = 0;
  await assert.rejects(forwardBusinessEvent({ topic: 'shelfsense/events/stock.delta',
    payload: JSON.stringify(event), cloudClient: { publish() { publishes += 1; } },
    signingSecret: 'edge-secret' }), /signature/);
  assert.equal(publishes, 0);
});
