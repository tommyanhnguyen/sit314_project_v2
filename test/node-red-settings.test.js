const test = require('node:test');
const assert = require('node:assert/strict');
const settings = require('../node-red/settings');
const { createEvent, verifyEvent } = require('../src/shared/events');

test('Node-RED global signer signs events when required', () => {
  const beforeRequired = process.env.EVENT_SIGNING_REQUIRED;
  const beforeSecret = process.env.EVENT_SIGNING_SECRET;
  process.env.EVENT_SIGNING_REQUIRED = 'true';
  process.env.EVENT_SIGNING_SECRET = 'edge-test-secret';
  try {
    const event = createEvent('stock.delta', 'store-01', {
      skuId: 'milk-1l', delta: 1, source: 'opening'
    });
    const signed = settings.functionGlobalContext.signBusinessEvent(event);
    assert.equal(verifyEvent(signed, 'edge-test-secret'), true);
  } finally {
    if (beforeRequired === undefined) delete process.env.EVENT_SIGNING_REQUIRED;
    else process.env.EVENT_SIGNING_REQUIRED = beforeRequired;
    if (beforeSecret === undefined) delete process.env.EVENT_SIGNING_SECRET;
    else process.env.EVENT_SIGNING_SECRET = beforeSecret;
  }
});

test('Node-RED editor requires the configured admin password hash', () => {
  const before = process.env.NODE_RED_ADMIN_PASSWORD_HASH;
  process.env.NODE_RED_ADMIN_PASSWORD_HASH = '$2b$08$example-hash';
  try {
    delete require.cache[require.resolve('../node-red/settings')];
    const protectedSettings = require('../node-red/settings');
    assert.equal(protectedSettings.adminAuth.users[0].username, 'admin');
    assert.equal(protectedSettings.adminAuth.users[0].password, '$2b$08$example-hash');
  } finally {
    if (before === undefined) delete process.env.NODE_RED_ADMIN_PASSWORD_HASH;
    else process.env.NODE_RED_ADMIN_PASSWORD_HASH = before;
    delete require.cache[require.resolve('../node-red/settings')];
  }
});
