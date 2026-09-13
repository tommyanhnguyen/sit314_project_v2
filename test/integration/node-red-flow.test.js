const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createEdgeProcessor } = require('../../src/edge/processor');
const { validateEvent } = require('../../src/shared/events');

const flow = JSON.parse(fs.readFileSync(path.join(__dirname, '../../node-red/flows.json'), 'utf8'));

function findNode(name) {
  const node = flow.find(item => item.name === name);
  assert.ok(node, 'Missing Node-RED node: ' + name);
  return node;
}

function runFunctionNode(name, msg, edge) {
  const body = new Function('msg', 'global', findNode(name).func);
  return body(msg, { get: key => key === 'edgeProcessor' ? edge : undefined });
}

function shelfMessage(payload) {
  return { topic: 'shelfsense/raw/store-01/shelf/shelf-1', payload };
}

test('flow contains three inputs, three functions and two outputs', () => {
  assert.equal(flow.filter(node => node.type === 'mqtt in').length, 3);
  assert.equal(flow.filter(node => node.type === 'function').length, 3);
  assert.equal(flow.filter(node => node.type === 'mqtt out').length, 2);
});

test('every MQTT input passes UTF-8 text to its function', () => {
  for (const node of flow.filter(item => item.type === 'mqtt in')) {
    assert.equal(node.datatype, 'utf8');
  }
});

test('valid shelf JSON leaves on the business output', () => {
  const [business, rejected] = runFunctionNode('Settle shelf reading', shelfMessage(JSON.stringify({
    store: 'store-01', shelfId: 'shelf-1', skuId: 'milk-1l', grams: 10000, ts: 0, wallTs: Date.now()
  })), createEdgeProcessor());

  assert.equal(rejected, null);
  assert.equal(business.topic, 'shelfsense/events/stock.delta');
  validateEvent(JSON.parse(business.payload));
});

test('unsettled shelf reading produces no output', () => {
  const edge = createEdgeProcessor({ debounceMs: 800 });
  runFunctionNode('Settle shelf reading', shelfMessage(JSON.stringify({
    store: 'store-01', shelfId: 'shelf-1', skuId: 'milk-1l', grams: 10000, ts: 0
  })), edge);

  const result = runFunctionNode('Settle shelf reading', shelfMessage(JSON.stringify({
    store: 'store-01', shelfId: 'shelf-1', skuId: 'milk-1l', grams: 2000, ts: 100
  })), edge);
  assert.equal(result, null);
});

test('malformed JSON leaves on the dead letter output', () => {
  const [business, rejected] = runFunctionNode('Convert POS sale', {
    topic: 'shelfsense/raw/store-01/pos', payload: 'not json'
  }, createEdgeProcessor());

  assert.equal(business, null);
  assert.equal(rejected.topic, 'shelfsense/dead-letter');
  assert.equal(JSON.parse(rejected.payload).payload, 'not json');
});

test('unknown SKU leaves on the dead letter output', () => {
  const [business, rejected] = runFunctionNode('Settle shelf reading', shelfMessage(JSON.stringify({
    store: 'store-01', shelfId: 'shelf-1', skuId: 'unknown', grams: 500, ts: 0
  })), createEdgeProcessor());

  assert.equal(business, null);
  assert.match(JSON.parse(rejected.payload).reason, /Unknown SKU/);
});

test('zero POS quantity leaves on the dead letter output', () => {
  const [business, rejected] = runFunctionNode('Convert POS sale', {
    topic: 'shelfsense/raw/store-01/pos',
    payload: JSON.stringify({ store: 'store-01', skuId: 'milk-1l', qty: 0, txnId: 'empty', ts: 1 })
  }, createEdgeProcessor());

  assert.equal(business, null);
  assert.match(JSON.parse(rejected.payload).reason, /greater than zero/);
});

test('temperature breach leaves on the business output', () => {
  const edge = createEdgeProcessor({ temperatureSamples: 2 });
  const message = tempC => ({
    topic: 'shelfsense/raw/store-01/fridge/fridge-1',
    payload: JSON.stringify({ store: 'store-01', unitId: 'fridge-1', tempC, ts: 1 })
  });

  assert.equal(runFunctionNode('Filter temperature', message(6.1), edge), null);
  const [business] = runFunctionNode('Filter temperature', message(6.4), edge);
  assert.equal(JSON.parse(business.payload).data.state, 'BREACH');
});
