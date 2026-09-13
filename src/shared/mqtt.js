function eventTopic(type) {
  return 'shelfsense/events/' + type;
}

async function connectMqtt(url, clientId) {
  const mqtt = require('mqtt');
  const client = mqtt.connect(url, { clientId, reconnectPeriod: 1000 });
  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('error', reject);
  });
  return client;
}

function publishJson(client, topic, value) {
  return new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(value), { qos: 1 }, error => {
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

module.exports = { connectMqtt, eventTopic, publishJson, subscribe };
