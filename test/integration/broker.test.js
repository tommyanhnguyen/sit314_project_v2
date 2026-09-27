const test = require('node:test');
const assert = require('node:assert/strict');
const mqtt = require('mqtt');

const { startBroker } = require('../../src/broker');
const { connectMqtt } = require('../../src/shared/mqtt');

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

test('broker rejects a wrong password and accepts configured MQTT client credentials', { timeout: 5000 }, async t => {
  const broker = await startBroker(0, { username: 'edge', password: 'test-password' });
  t.after(async () => {
    await new Promise(resolve => broker.server.close(resolve));
    await broker.aedes.close();
  });
  const url = 'mqtt://127.0.0.1:' + broker.port;
  let badClient;
  try {
    badClient = await connectMqtt(url, 'wrong-password', {
      username: 'edge', password: 'wrong', reconnectPeriod: 0
    });
    assert.fail('Broker accepted the wrong password');
  } catch (error) {
    assert.match(error.message, /auth|refus|password|connect|accepted the wrong/i);
    assert.notEqual(error.message, 'Broker accepted the wrong password');
  } finally {
    if (badClient) await new Promise(resolve => badClient.end(true, resolve));
  }
  const client = await connectMqtt(url, 'right-password', {
    username: 'edge', password: 'test-password', reconnectPeriod: 0
  });
  await new Promise(resolve => client.end(false, resolve));
});
