const test = require('node:test');
const assert = require('node:assert/strict');

const { authorize, issueToken, verifyToken } = require('../src/shared/auth');

test('issues and verifies a scoped token', () => {
  const token = issueToken({ sub: 'tommy', role: 'manager', stores: ['store-01'], exp: 200 }, 'secret', 100000);
  const claims = verifyToken(token, 'secret', 150000);
  assert.equal(claims.sub, 'tommy');
  assert.equal(authorize(claims, 'manager', 'store-01'), true);
});

test('rejects expired, modified, wrong role and wrong store tokens', () => {
  const token = issueToken({ sub: 'driver-1', role: 'driver', stores: ['store-01'], exp: 120 }, 'secret', 100000);
  assert.throws(() => verifyToken(token, 'secret', 121000), /expired/);
  assert.throws(() => verifyToken(token + 'x', 'secret', 110000), /signature/);
  const claims = verifyToken(token, 'secret', 110000);
  assert.throws(() => authorize(claims, 'manager', 'store-01'), /role/);
  assert.throws(() => authorize(claims, 'driver', 'store-02'), /store/);
});
