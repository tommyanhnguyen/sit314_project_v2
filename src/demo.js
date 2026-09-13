const fs = require('node:fs');
const path = require('node:path');
const { MemoryStore } = require('./shared/persistence');
const { createEdgeProcessor } = require('./edge/processor');
const { createInventoryService } = require('./services/inventory');
const { createReplenishmentService } = require('./services/replenishment');
const { createColdChainService } = require('./services/cold-chain');
const { createDeliveryService } = require('./services/delivery');
const { createSimulation } = require('./simulator');

async function runLocalDemo(options = {}) {
  const store = options.store || new MemoryStore();
  const edge = createEdgeProcessor({ debounceMs: 800 });
  const published = [];
  const notifications = [];
  let deliveryNumber = 0;
  let orderNumber = 0;

  let inventory;
  let replenishment;
  let coldChain;
  let delivery;

  async function dispatch(event) {
    published.push(event);
    if (event.type === 'stock.delta') return inventory.handle(event);
    if (event.type === 'stock.updated') return replenishment.handleStockUpdated(event);
    if (event.type === 'coldchain.alert') return coldChain.handle(event);
    if (event.type === 'order.approved') return delivery.handle(event);
    return event;
  }

  inventory = createInventoryService({ store, publish: dispatch, clock: Date.now });
  replenishment = createReplenishmentService({
    store,
    publish: dispatch,
    autoApproveUnder: 0,
    idFactory: () => 'order-' + (++orderNumber)
  });
  coldChain = createColdChainService({
    store,
    publish: async event => notifications.push(event)
  });
  delivery = createDeliveryService({
    store,
    publish: dispatch,
    idFactory: () => 'delivery-' + (++deliveryNumber),
    locations: {
      depot: { x: 0, y: 0 },
      'store-01': { x: 3, y: 4 },
      'store-02': { x: 6, y: 8 },
      'store-03': { x: 4, y: 3 },
      'store-04': { x: 8, y: 6 }
    }
  });

  async function processRaw(topic, payload) {
    let event = null;
    if (topic.includes('/shelf/')) event = edge.processShelf(payload);
    else if (topic.endsWith('/pos')) event = edge.processPos(payload);
    else if (topic.includes('/fridge/')) event = edge.processTemperature(payload);
    if (event) await dispatch(event);
  }

  const simulation = createSimulation({ stores: options.stores || 2, publish: processRaw });
  await simulation.run();

  for (const order of await store.listOrders()) {
    if (order.status === 'PENDING_APPROVAL') {
      await replenishment.approve(order.orderId, 'manager:tommy');
    }
  }

  const result = {
    stock: (await store.listStock()).length,
    orders: (await store.listOrders()).length,
    alerts: (await store.listAlerts()).length,
    deliveries: (await store.listDeliveries()).length,
    deadLetters: (await store.listDeadLetters()).length,
    events: published.length,
    notifications: notifications.length
  };

  if (options.evidenceDir) {
    fs.mkdirSync(options.evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(options.evidenceDir, 'local-demo.json'), JSON.stringify(result, null, 2));
  }
  return result;
}

if (require.main === module) {
  runLocalDemo({
    stores: Number(process.env.STORES || 2),
    evidenceDir: process.env.REPORT_EVIDENCE_DIR
  }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { runLocalDemo };
