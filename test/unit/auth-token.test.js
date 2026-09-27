const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoleToken } = require('../../src/auth-token');
const { verifyToken } = require('../../src/shared/auth');

test('operator can issue a short lived scoped portal token', () => {
  const secret = 'a'.repeat(32);
  const token = createRoleToken({ role: 'manager', stores: 'store-01,store-02', secret });
  const claims = verifyToken(token, secret);
  assert.equal(claims.role, 'manager');
  assert.deepEqual(claims.stores, ['store-01', 'store-02']);
  assert.ok(claims.exp - claims.iat <= 3600);
  assert.throws(() => createRoleToken({ role: 'manager', stores: 'store-01', secret: 'short' }));
});
