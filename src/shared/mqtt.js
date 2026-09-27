const fs = require('node:fs');

function eventTopic(type) {
  return 'shelfsense/events/' + type;
}

function buildMqttOptions(clientId, options = {}) {
  const result = {
    clientId,
    reconnectPeriod: options.reconnectPeriod ?? 1000,
    username: Object.hasOwn(options, 'username') ? options.username : process.env.MQTT_USERNAME,
    password: Object.hasOwn(options, 'password') ? options.password : process.env.MQTT_PASSWORD
  };
  const certFile = options.certFile ?? process.env.MQTT_CERT_FILE;
  const keyFile = options.keyFile ?? process.env.MQTT_KEY_FILE;
  const caFile = options.caFile ?? process.env.MQTT_CA_FILE;
  if (Boolean(certFile) !== Boolean(keyFile)) throw new Error('MQTT certificate and key must be supplied together');
  if (certFile) result.cert = fs.readFileSync(certFile);
  if (keyFile) result.key = fs.readFileSync(keyFile);
  if (caFile) result.ca = fs.readFileSync(caFile);
  if (certFile || caFile) result.rejectUnauthorized = true;
  return result;
}

async function connectMqtt(url, clientId, options = {}) {
  const mqtt = require('mqtt');
  const client = mqtt.connect(url, buildMqttOptions(clientId, options));
  await new Promise((resolve, reject) => {
    const connected = () => { client.off('error', failed); resolve(); };
    const failed = error => {
      client.off('connect', connected);
      client.end(true);
      reject(error);
    };
    client.once('connect', connected);
    client.once('error', failed);
  });
  return client;
}

function publishJson(client, topic, value, options = {}) {
  const secret = options.signingSecret ?? (process.env.EVENT_SIGNING_REQUIRED === 'true'
    ? process.env.EVENT_SIGNING_SECRET : null);
  if (topic.startsWith('shelfsense/events/') && process.env.EVENT_SIGNING_REQUIRED === 'true' && !secret) {
    return Promise.reject(new Error('Event signing secret is required'));
  }
  const payload = topic.startsWith('shelfsense/events/') && secret
    ? require('./signing').signEvent(value, secret) : value;
  return new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function subscribe(client, topic) {
  return new Promise((resolve, reject) => {
    client.subscribe(topic, { qos: 1 }, error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

module.exports = { buildMqttOptions, connectMqtt, eventTopic, publishJson, subscribe };
