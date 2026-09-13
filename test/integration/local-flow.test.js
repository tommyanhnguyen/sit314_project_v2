const test = require('node:test');
const assert = require('node:assert/strict');

const { runLocalDemo } = require('../../src/demo');

test('local flow creates every planned record type', async () => {
  const result = await runLocalDemo({ stores: 2 });

  assert.ok(result.stock > 0);
  assert.ok(result.orders > 0);
  assert.ok(result.alerts > 0);
  assert.ok(result.deliveries > 0);
  assert.equal(result.deadLetters, 0);
});
