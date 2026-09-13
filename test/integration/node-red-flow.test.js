const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Node-RED flow contains raw inputs, processing nodes, and outputs', () => {
  const file = path.join(__dirname, '../../node-red/flows.json');
  const flow = JSON.parse(fs.readFileSync(file, 'utf8'));

  assert.equal(flow.filter(node => node.type === 'mqtt in').length, 3);
  assert.equal(flow.filter(node => node.type === 'function').length, 3);
  assert.equal(flow.filter(node => node.type === 'mqtt out').length, 2);
  assert.ok(flow.some(node => node.name === 'Rejected input'));
});
