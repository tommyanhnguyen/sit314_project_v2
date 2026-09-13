const test = require('node:test');
const assert = require('node:assert/strict');
const mqtt = require('mqtt');

const { startBroker } = require('../../src/broker');

test('local broker accepts one MQTT message', { timeout: 5000 }, async t => {
  const broker = await startBroker(0);
  const subscriber = mqtt.connect('mqtt://127.0.0.1:' + broker.port);
  const publisher = mqtt.connect('mqtt://127.0.0.1:' + broker.port);

  const subscriberConnected = new Promise((resolve, reject) => {
    subscriber.once('connect', resolve);
    subscriber.once('error', reject);
  });
  const publisherConnected = new Promise((resolve, reject) => {
    publisher.once('connect', resolve);
    publisher.once('error', reject);
  });

  t.after(async () => {
    subscriber.end(true);
    publisher.end(true);
    await new Promise(resolve => broker.server.close(resolve));
    await broker.aedes.close();
  });

  await Promise.all([subscriberConnected, publisherConnected]);
  await new Promise((resolve, reject) => subscriber.subscribe('test/topic', error => error ? reject(error) : resolve()));

  const received = new Promise(resolve => subscriber.once('message', (topic, payload) => resolve({ topic, payload: payload.toString() })));
  publisher.publish('test/topic', 'hello');

  assert.deepEqual(await received, { topic: 'test/topic', payload: 'hello' });
});
