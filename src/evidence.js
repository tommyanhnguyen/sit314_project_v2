const fs = require('node:fs');
const path = require('node:path');
const { runLocalDemo } = require('./demo');
const { runLoadTest } = require('./load-test');

const CONSUMER_SETTINGS = [1, 2, 4, 8];

function renderMarkdown(evidence) {
  const rows = evidence.load.map(result => [
    result.consumers,
    result.events,
    result.elapsedMs,
    result.throughput,
    result.medianLatencyMs,
    result.p95LatencyMs,
    result.peakBacklog,
    result.meanBacklog
  ].join(' | '));

  return [
    '# Local evidence',
    '',
    'Collected ' + evidence.collectedAt + ' on Node ' + evidence.node + '.',
    '',
    '## Closed loop demo',
    '',
    '| Measure | Value |',
    '| --- | --- |',
    ...Object.entries(evidence.demo).map(([key, value]) => '| ' + key + ' | ' + value + ' |'),
    '',
    '## Inventory service throughput',
    '',
    'This is an in-process baseline without MQTT or MongoDB. It is not AWS scaling evidence.',
    '',
    '| Consumers | Events | Elapsed ms | Events per second | Median latency ms | p95 latency ms | Peak backlog | Mean backlog |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => '| ' + row + ' |'),
    ''
  ].join('\n');
}

async function collectEvidence(options = {}) {
  const outputDir = path.resolve(options.outputDir || 'report_evidence');
  const events = options.events || 5000;
  const demo = await runLocalDemo({ stores: options.stores || 2 });
  const load = [];

  for (const consumers of CONSUMER_SETTINGS) {
    load.push(await runLoadTest({ events, consumers, arrivalBatch: options.arrivalBatch || 100 }));
  }

  const evidence = {
    collectedAt: new Date().toISOString(),
    node: process.version,
    demo,
    load
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'evidence.json'), JSON.stringify(evidence, null, 2));
  fs.writeFileSync(path.join(outputDir, 'evidence.md'), renderMarkdown(evidence));
  return { evidence, outputDir };
}

if (require.main === module) {
  collectEvidence({
    outputDir: process.env.REPORT_EVIDENCE_DIR,
    events: Number(process.env.EVENTS || 5000),
    arrivalBatch: Number(process.env.ARRIVAL_BATCH || 100)
  }).then(({ outputDir }) => console.log('Evidence written to ' + outputDir)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { CONSUMER_SETTINGS, collectEvidence, renderMarkdown };
