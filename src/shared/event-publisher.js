const { SNSClient } = require('@aws-sdk/client-sns');
const { publishEvent } = require('../cloud/aws-transport');
const { connectMqtt, eventTopic, publishJson } = require('./mqtt');

function createPublisher({ mode, mqttClient, sns, topicArn, signingSecret }) {
  if (mode === 'aws') {
    if (!sns || !topicArn) throw new Error('SNS client and event topic are required');
    return event => publishEvent({ sns, topicArn, event, signingSecret });
  }
  if (mode !== 'mqtt' || !mqttClient) throw new Error('MQTT client is required');
  return event => publishJson(mqttClient, eventTopic(event.type), event, { signingSecret });
}

async function openEventPublisher(clientId) {
  const mode = process.env.EVENT_TRANSPORT || 'mqtt';
  const signingSecret = process.env.EVENT_SIGNING_REQUIRED === 'true'
    ? process.env.EVENT_SIGNING_SECRET : undefined;
  if (process.env.EVENT_SIGNING_REQUIRED === 'true' && !signingSecret) {
    throw new Error('Event signing secret is required');
  }
  if (mode === 'aws') {
    const sns = new SNSClient({ region: process.env.AWS_REGION });
    return {
      publish: createPublisher({ mode, sns, topicArn: process.env.SNS_EVENT_TOPIC_ARN, signingSecret }),
      close: async () => sns.destroy()
    };
  }
  if (mode !== 'mqtt') throw new Error('Unknown event transport: ' + mode);
  const mqttClient = await connectMqtt(process.env.MQTT_URL || 'mqtt://localhost:1883', clientId);
  return {
    publish: createPublisher({ mode, mqttClient, signingSecret }),
    close: () => new Promise(resolve => mqttClient.end(false, resolve))
  };
}

module.exports = { createPublisher, openEventPublisher };
