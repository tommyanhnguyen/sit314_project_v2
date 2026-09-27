const test = require('node:test');
const assert = require('node:assert/strict');
const { createEvent } = require('../../src/shared/events');
const { buildMqttOptions, publishJson } = require('../../src/shared/mqtt');
const { verifyEvent } = require('../../src/shared/signing');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('publishing a business event signs its actual MQTT payload', async () => {
  let sent;
  const client = {
    publish(topic, payload, options, callback) {
      sent = { topic, payload: JSON.parse(payload), qos: options.qos };
      callback();
    }
  };
  const event = createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: 2, source: 'opening'
  });

  await publishJson(client, 'shelfsense/events/stock.delta', event, {
    signingSecret: 'test-signing-secret'
  });

  assert.equal(sent.qos, 1);
  assert.equal(sent.topic, 'shelfsense/events/stock.delta');
  assert.equal(verifyEvent(sent.payload, 'test-signing-secret'), true);
});

test('MQTT TLS options load client certificate, key and trusted CA', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfsense-mqtt-'));
  try {
    for (const [file, contents] of [['cert.pem', 'certificate'], ['key.pem', 'private-key'],
      ['ca.pem', 'trusted-ca']]) {
      fs.writeFileSync(path.join(directory, file), contents);
    }
    const options = buildMqttOptions('iot-edge', {
      certFile: path.join(directory, 'cert.pem'), keyFile: path.join(directory, 'key.pem'),
      caFile: path.join(directory, 'ca.pem')
    });
    assert.equal(options.cert.toString(), 'certificate');
    assert.equal(options.key.toString(), 'private-key');
    assert.equal(options.ca.toString(), 'trusted-ca');
    assert.equal(options.rejectUnauthorized, true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('AWS IoT client can omit local broker username and password', () => {
  const priorUser = process.env.MQTT_USERNAME;
  const priorPassword = process.env.MQTT_PASSWORD;
  process.env.MQTT_USERNAME = 'local-user';
  process.env.MQTT_PASSWORD = 'local-password';
  try {
    const options = buildMqttOptions('iot-uplink', { username: undefined, password: undefined });
    assert.equal(options.username, undefined);
    assert.equal(options.password, undefined);
  } finally {
    if (priorUser === undefined) delete process.env.MQTT_USERNAME;
    else process.env.MQTT_USERNAME = priorUser;
    if (priorPassword === undefined) delete process.env.MQTT_PASSWORD;
    else process.env.MQTT_PASSWORD = priorPassword;
  }
});
