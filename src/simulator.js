const config = require('./shared/config');
const { connectMqtt, publishJson } = require('./shared/mqtt');

function createSimulation(options = {}) {
  const stores = options.stores || 2;
  const publish = options.publish;

  async function run() {
    for (let index = 1; index <= stores; index += 1) {
      const store = 'store-' + String(index).padStart(2, '0');
      const shelfTopic = `shelfsense/raw/${store}/shelf/shelf-1`;
      const posTopic = `shelfsense/raw/${store}/pos`;
      const fridgeTopic = `shelfsense/raw/${store}/fridge/fridge-1`;

      await publish(shelfTopic, { store, shelfId: 'shelf-1', skuId: 'milk-1l', grams: 10000, ts: 0, wallTs: Date.now() });
      await publish(shelfTopic, { store, shelfId: 'shelf-1', skuId: 'milk-1l', grams: 2000, ts: 100, wallTs: Date.now() });
      await publish(shelfTopic, { store, shelfId: 'shelf-1', skuId: 'milk-1l', grams: 2000, ts: 1000, wallTs: Date.now() });

      for (let sale = 0; sale < 3; sale += 1) {
        await publish(posTopic, {
          store,
          skuId: 'milk-1l',
          qty: 1,
          txnId: store + '-txn-' + (sale + 1),
          ts: sale * 60 * 60 * 1000,
          wallTs: Date.now()
        });
      }

      await publish(fridgeTopic, { store, unitId: 'fridge-1', tempC: 6.1, ts: 1, wallTs: Date.now() });
      await publish(fridgeTopic, { store, unitId: 'fridge-1', tempC: 6.4, ts: 2, wallTs: Date.now() });
      await publish(fridgeTopic, { store, unitId: 'fridge-1', tempC: 4.1, ts: 3, wallTs: Date.now() });
    }
  }

  return { run };
}

async function runSimulator() {
  const startupDelayMs = Number(process.env.STARTUP_DELAY_MS || 0);
  if (startupDelayMs > 0) {
    console.log('Waiting ' + startupDelayMs + ' ms for Node-RED');
    await new Promise(resolve => setTimeout(resolve, startupDelayMs));
  }

  const client = await connectMqtt(config.mqttUrl, 'shelfsense-simulator-' + process.pid);
  const simulation = createSimulation({
    stores: Number(process.env.STORES || 2),
    publish: (topic, payload) => publishJson(client, topic, payload)
  });
  await simulation.run();
  await new Promise(resolve => client.end(false, resolve));
  console.log('Simulation published');
}

if (require.main === module) {
  runSimulator().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { createSimulation, runSimulator };
