const test = require('node:test');
const assert = require('node:assert/strict');

const { eventTopic } = require('../src/shared/transport');
const { serviceDefinition } = require('../src/service');

test('maps an event type to its MQTT topic', () => {
  assert.equal(eventTopic('stock.updated'), 'shelfsense/events/stock.updated');
});

test('defines the input contract for every local service', () => {
  assert.deepEqual(serviceDefinition('inventory'), {
    topic: 'shelfsense/events/stock.delta',
    expectedType: 'stock.delta'
  });
  assert.deepEqual(serviceDefinition('replenishment'), {
    topic: 'shelfsense/events/stock.updated',
    expectedType: 'stock.updated'
  });
  assert.deepEqual(serviceDefinition('cold-chain'), {
    topic: 'shelfsense/events/coldchain.alert',
    expectedType: 'coldchain.alert'
  });
  assert.deepEqual(serviceDefinition('delivery'), {
    topic: 'shelfsense/events/order.approved',
    expectedType: 'order.approved'
  });
});

test('rejects an unknown service name', () => {
  assert.throws(() => serviceDefinition('missing'), /Unknown service/);
});
