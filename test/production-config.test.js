const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProductionConfig } = require('../src/shared/config');

const base = { MONGODB_URI: 'mongodb+srv://example.net/shelfsense', AWS_REGION: 'ap-southeast-2',
  EVENT_SIGNING_REQUIRED: 'true', EVENT_SIGNING_SECRET: 'x'.repeat(32) };

test('production worker needs Atlas, AWS region and event signing', () => {
  assert.deepEqual(validateProductionConfig(base, 'worker'), []);
  const errors = validateProductionConfig({ ...base, EVENT_SIGNING_SECRET: 'short', AWS_REGION: '' }, 'worker');
  assert.ok(errors.includes('EVENT_SIGNING_SECRET must be at least 32 characters'));
  assert.ok(errors.includes('AWS_REGION is required'));
});

test('production API requires scoped authentication', () => {
  assert.deepEqual(validateProductionConfig({ ...base, API_AUTH_REQUIRED: 'true',
    API_AUTH_SECRET: 'y'.repeat(32) }, 'api'), []);
  assert.ok(validateProductionConfig(base, 'api').includes('API_AUTH_REQUIRED must be true'));
});
