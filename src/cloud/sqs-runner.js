const { SQSClient } = require('@aws-sdk/client-sqs');
const { SNSClient } = require('@aws-sdk/client-sns');
const config = require('../shared/config');
const { MongoStore } = require('../shared/persistence');
const { createInventoryService } = require('../services/inventory');
const { createReplenishmentService } = require('../services/replenishment');
const { createColdChainService } = require('../services/cold-chain');
const { createDeliveryService } = require('../services/delivery');
const { consumeBatch, publishEvent } = require('./aws-transport');
const { assertProductionConfig } = require('../shared/production-config');

const DEFINITIONS = {
  inventory: { expectedType: 'stock.delta', queueEnvironment: 'SQS_INVENTORY_QUEUE_URL' },
  replenishment: { expectedType: 'stock.updated', queueEnvironment: 'SQS_REPLENISHMENT_QUEUE_URL' },
  'cold-chain': { expectedType: 'coldchain.alert', queueEnvironment: 'SQS_COLDCHAIN_QUEUE_URL' },
  delivery: { expectedType: 'order.approved', queueEnvironment: 'SQS_DELIVERY_QUEUE_URL' }
};

function businessService(name, store, publish, notify) {
  if (name === 'inventory') return createInventoryService({ store, publish });
  if (name === 'replenishment') return createReplenishmentService({ store, publish });
  if (name === 'delivery') return createDeliveryService({ store, publish });
  if (name === 'cold-chain') return createColdChainService({ store, publish: notify });
  throw new Error('Unknown AWS service: ' + name);
}

async function processQueueBatch(options) {
  const { name, store, sqs, sns, queueUrl, topicArn, alertTopicArn, signingSecret } = options;
  const definition = DEFINITIONS[name];
  if (!definition) throw new Error('Unknown AWS service: ' + name);
  const publish = event => publishEvent({ sns, topicArn, event, signingSecret });
  const notify = event => publishEvent({ sns, topicArn: alertTopicArn, event, signingSecret });
  const service = businessService(name, store, publish, notify);
  return consumeBatch({
    sqs,
    queueUrl,
    expectedType: definition.expectedType,
    signingSecret,
    handle: event => name === 'replenishment'
      ? service.handleStockUpdated(event) : service.handle(event),
    onError: options.onError || (error => console.error(name + ' message failed: ' + error.message))
  });
}

async function startQueueService(name = process.env.SERVICE_NAME) {
  assertProductionConfig(process.env, 'worker');
  const definition = DEFINITIONS[name];
  if (!definition) throw new Error('Unknown AWS service: ' + name);
  const queueUrl = process.env[definition.queueEnvironment];
  const topicArn = process.env.SNS_EVENT_TOPIC_ARN;
  const alertTopicArn = process.env.SNS_ALERT_TOPIC_ARN;
  if (!queueUrl || !topicArn || (name === 'cold-chain' && !alertTopicArn)) {
    throw new Error('AWS queue and SNS destinations are required for ' + name);
  }
  const signingSecret = config.eventSigningRequired ? config.eventSigningSecret : undefined;
  if (config.eventSigningRequired && !signingSecret) throw new Error('Event signing secret is required');
  const region = process.env.AWS_REGION;
  const store = await MongoStore.connect(config.mongoUri);
  const sqs = new SQSClient({ region });
  const sns = new SNSClient({ region });
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  console.log(name + ' AWS queue service ready');
  try {
    while (!stopping) {
      try {
        const started = Date.now();
        const result = await processQueueBatch({ name, store, sqs, sns, queueUrl, topicArn,
          alertTopicArn, signingSecret });
        if (result.received) console.log(JSON.stringify({ kind: 'queue_batch', service: name,
          ...result, durationMs: Date.now() - started, at: new Date().toISOString() }));
      } catch (error) {
        console.error(name + ' queue poll failed: ' + error.message);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } finally {
    sqs.destroy();
    sns.destroy();
    await store.close();
  }
}

if (require.main === module) {
  startQueueService().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { DEFINITIONS, processQueueBatch, startQueueService };
