const test = require('node:test');
const assert = require('node:assert/strict');

const { runLoadTest } = require('../../src/load-test');

test('load result contains the tutor requested local metrics', async () => {
  const result = await runLoadTest({ events: 500, consumers: 2 });

  assert.equal(result.events, 500);
  assert.ok(result.throughput > 0);
  assert.ok(Number.isFinite(result.medianLatencyMs));
  assert.ok(Number.isFinite(result.p95LatencyMs));
  assert.equal(result.peakBacklog, 500);
});
