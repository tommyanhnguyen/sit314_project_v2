const { connectMqtt, subscribe } = require('../shared/mqtt');
const { parsePayload } = require('../shared/message-handler');
const { validateEvent } = require('../shared/events');
const { verifyEvent } = require('../shared/signing');

async function forwardBusinessEvent({ topic, payload, cloudClient, signingSecret }) {
  const event = parsePayload(payload);
  validateEvent(event);
  if (topic !== 'shelfsense/events/' + event.type) {
    throw new Error('Business event topic does not match type');
  }
  if (signingSecret) verifyEvent(event, signingSecret);
  return new Promise((resolve, reject) => cloudClient.publish(topic, JSON.stringify(event),
    { qos: 1 }, error => error ? reject(error) : resolve()));
}

async function startBridge() {
  const endpoint = process.env.IOT_ENDPOINT;
  const certFile = process.env.IOT_CERT_FILE;
  const keyFile = process.env.IOT_KEY_FILE;
  const caFile = process.env.IOT_CA_FILE;
  const signingSecret = process.env.EVENT_SIGNING_SECRET;
  if (!endpoint || !certFile || !keyFile || !caFile || !signingSecret) {
    throw new Error('IoT endpoint, certificate files and signing secret are required');
  }
  const localClient = await connectMqtt(process.env.LOCAL_MQTT_URL || 'mqtt://localhost:1883',
    'shelfsense-local-bridge-' + process.pid);
  let cloudClient;
  try {
    cloudClient = await connectMqtt('mqtts://' + endpoint + ':8883',
      process.env.IOT_CLIENT_ID || 'shelfsense-bridge',
      { username: undefined, password: undefined, certFile, keyFile, caFile });
    await subscribe(localClient, 'shelfsense/events/+');
  } catch (error) {
    localClient.end(true);
    throw error;
  }
  localClient.on('message', (topic, payload) => forwardBusinessEvent({ topic, payload,
    cloudClient, signingSecret }).catch(error => console.error('IoT uplink failed: ' + error.message)));
  console.log('Node-RED to AWS IoT Core bridge ready');
  return { close: async () => {
    await new Promise(resolve => localClient.end(false, resolve));
    await new Promise(resolve => cloudClient.end(false, resolve));
  } };
}

if (require.main === module) {
  startBridge().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { forwardBusinessEvent, startBridge };
