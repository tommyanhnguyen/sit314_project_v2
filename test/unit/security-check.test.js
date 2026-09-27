const test = require('node:test');
const assert = require('node:assert/strict');
const { scanText } = require('../../scripts/security-check');

test('security scan reports credentials without repeating their values', () => {
  const secret = 'AKIA' + 'ABCDEFGHIJKLMNOP';
  const findings = scanText('example.js', `const key = '${secret}';`);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 1);
  assert.equal(JSON.stringify(findings).includes(secret), false);
});

test('security scan accepts blank sample variables and detects embedded Mongo credentials', () => {
  assert.deepEqual(scanText('.env.example', 'MONGODB_URI=\nAPI_AUTH_SECRET=\n'), []);
  assert.equal(scanText('config.js', 'mongodb+srv://' + 'person:password@cluster.example/test').length, 1);
});
