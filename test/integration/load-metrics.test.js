const test = require('node:test');
const assert = require('node:assert/strict');

const { runLoadTest } = require('../../src/load-test');

test('load result contains the tutor requested local metrics', async () => {
  const result = await runLoadTest({ events: 500, consumers: 2 });

  assert.equal(result.events, 500);
  assert.equal(result.processed, 500);
  assert.ok(result.throughput > 0);
  assert.ok(Number.isFinite(result.medianLatencyMs));
  assert.ok(Number.isFinite(result.p95LatencyMs));
  assert.ok(result.p95LatencyMs >= result.medianLatencyMs);
  assert.ok(result.peakBacklog > 0);
  assert.ok(result.peakBacklog < result.events);
  assert.ok(result.meanBacklog <= result.peakBacklog);
  assert.ok(result.backlogSamples > result.events);
});
