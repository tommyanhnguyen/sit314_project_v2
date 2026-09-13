const { MemoryStore } = require('./shared/persistence');
const { createEvent } = require('./shared/events');
const { createInventoryService } = require('./services/inventory');

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

async function runLoadTest(options = {}) {
  const eventCount = options.events || 5000;
  const consumers = options.consumers || 2;
  const store = new MemoryStore();
  const latencies = [];
  const queue = [];
  const service = createInventoryService({
    store,
    clock: Date.now,
    publish: async event => {
      if (Number.isFinite(event.data.latencyMs)) latencies.push(event.data.latencyMs);
    }
  });

  for (let index = 0; index < eventCount; index += 1) {
    queue.push(createEvent('stock.delta', 'store-' + String(index % 20).padStart(2, '0'), {
      skuId: 'milk-1l',
      delta: index < 20 ? 100 : -1,
      source: index < 20 ? 'opening' : 'shelf',
      wallTs: Date.now()
    }, { eventId: 'load-' + index, ts: index }));
  }

  const peakBacklog = queue.length;
  const startedAt = process.hrtime.bigint();
  const workers = Array.from({ length: consumers }, async () => {
    while (queue.length) {
      const event = queue.shift();
      if (event) await service.handle(event);
    }
  });
  await Promise.all(workers);
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  return {
    events: eventCount,
    consumers,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    throughput: Number((eventCount / (elapsedMs / 1000)).toFixed(2)),
    medianLatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    peakBacklog
  };
}

if (require.main === module) {
  runLoadTest({
    events: Number(process.env.EVENTS || 5000),
    consumers: Number(process.env.CONSUMERS || 2)
  }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { percentile, runLoadTest };
