const config = require('./shared/config');
const { MongoStore } = require('./shared/persistence');
const { handleMessage } = require('./shared/message-handler');
const { connectMqtt, eventTopic, publishJson, subscribe } = require('./shared/mqtt');
const { createInventoryService } = require('./services/inventory');
const { createReplenishmentService } = require('./services/replenishment');
const { createColdChainService } = require('./services/cold-chain');
const { createDeliveryService } = require('./services/delivery');

const DEFINITIONS = {
  inventory: { topic: eventTopic('stock.delta'), expectedType: 'stock.delta' },
  replenishment: { topic: eventTopic('stock.updated'), expectedType: 'stock.updated' },
  'cold-chain': { topic: eventTopic('coldchain.alert'), expectedType: 'coldchain.alert' },
  delivery: { topic: eventTopic('order.approved'), expectedType: 'order.approved' },
  'dead-letter': { topic: 'shelfsense/dead-letter', expectedType: null }
};

function serviceDefinition(name) {
  const definition = DEFINITIONS[name];
  if (!definition) throw new Error('Unknown service: ' + name);
  return { ...definition };
}

function createService(name, store, client) {
  const publish = event => publishJson(client, eventTopic(event.type), event);
  if (name === 'inventory') return createInventoryService({ store, publish });
  if (name === 'replenishment') return createReplenishmentService({ store, publish });
  if (name === 'delivery') return createDeliveryService({ store, publish });
  if (name === 'cold-chain') {
    return createColdChainService({
      store,
      publish: event => publishJson(client, 'shelfsense/notifications/coldchain', event)
    });
  }
  return null;
}

async function startService(name = process.env.SERVICE_NAME) {
  const definition = serviceDefinition(name);
  const store = await MongoStore.connect(config.mongoUri);
  const client = await connectMqtt(config.mqttUrl, 'shelfsense-' + name + '-' + process.pid);
  const service = createService(name, store, client);
  let messageChain = Promise.resolve();

  await subscribe(client, definition.topic);
  client.on('message', (topic, payload) => {
    messageChain = messageChain.then(async () => {
      if (name === 'dead-letter') {
        try {
          await store.saveDeadLetter(JSON.parse(payload.toString()));
        } catch (error) {
          console.error('Dead letter write failed: ' + error.message);
        }
        return;
      }

      await handleMessage({
        topic,
        payload,
        expectedType: definition.expectedType,
        process: event => service.handle ? service.handle(event) : service.handleStockUpdated(event),
        deadLetter: item => publishJson(client, 'shelfsense/dead-letter', item)
      });
    }).catch(error => console.error(name + ' message failed: ' + error.message));
  });

  async function close() {
    await new Promise(resolve => client.end(false, resolve));
    await store.close();
  }

  process.once('SIGTERM', () => close().finally(() => process.exit(0)));
  process.once('SIGINT', () => close().finally(() => process.exit(0)));
  console.log(name + ' service ready');
  return { client, close, store };
}

if (require.main === module) {
  startService().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { serviceDefinition, startService };
