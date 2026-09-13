const { MemoryStore } = require('./shared/persistence');
const { createEvent } = require('./shared/events');
const { createInventoryService } = require('./services/inventory');

const STORE_COUNT = 20;
const OPENING_QTY = 100000;

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function mean(values) {
  if (!values.length) return null;
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function storeName(index) {
  return 'store-' + String(index % STORE_COUNT).padStart(2, '0');
}

function yieldToLoop() {
  return new Promise(resolve => setImmediate(resolve));
}

async function runLoadTest(options = {}) {
  const eventCount = options.events || 5000;
  const consumers = options.consumers || 2;
  const arrivalBatch = options.arrivalBatch || 100;
  const store = new MemoryStore();
  const latencies = [];
  const service = createInventoryService({
    store,
    clock: Date.now,
    publish: async event => {
      if (Number.isFinite(event.data.latencyMs)) latencies.push(event.data.latencyMs);
    }
  });

  for (let index = 0; index < STORE_COUNT; index += 1) {
    await service.handle(createEvent('stock.delta', storeName(index), {
      skuId: 'milk-1l',
      delta: OPENING_QTY,
      source: 'opening',
      wallTs: Date.now()
    }, { eventId: 'open-' + index, ts: index }));
  }
  latencies.length = 0;

  const queue = [];
  const backlogSamples = [];
  let peakBacklog = 0;
  let processed = 0;
  let producing = true;

  function sampleBacklog() {
    const depth = queue.length;
    backlogSamples.push(depth);
    if (depth > peakBacklog) peakBacklog = depth;
  }

  const startedAt = process.hrtime.bigint();
  const producer = (async () => {
    for (let index = 0; index < eventCount; index += 1) {
      queue.push(createEvent('stock.delta', storeName(index), {
        skuId: 'milk-1l',
        delta: -1,
        source: 'shelf',
        wallTs: Date.now()
      }, { eventId: 'load-' + index, ts: index }));
      sampleBacklog();
      if ((index + 1) % arrivalBatch === 0) await yieldToLoop();
    }
    producing = false;
  })();

  const workers = Array.from({ length: consumers }, async () => {
    while (producing || queue.length) {
      const event = queue.shift();
      if (!event) {
        await yieldToLoop();
        continue;
      }
      sampleBacklog();
      await service.handle(event);
      processed += 1;
    }
  });

  await Promise.all([producer, ...workers]);
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  return {
    events: eventCount,
    processed,
    consumers,
    arrivalBatch,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    throughput: Number((processed / (elapsedMs / 1000)).toFixed(2)),
    medianLatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    peakBacklog,
    meanBacklog: mean(backlogSamples),
    backlogSamples: backlogSamples.length
  };
}

if (require.main === module) {
  runLoadTest({
    events: Number(process.env.EVENTS || 5000),
    consumers: Number(process.env.CONSUMERS || 2),
    arrivalBatch: Number(process.env.ARRIVAL_BATCH || 100)
  }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { mean, percentile, runLoadTest, storeName };
