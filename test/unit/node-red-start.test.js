const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareFlow } = require('../../node-red/start');

test('Node-RED launcher puts broker credentials only in a temporary private file', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelfsense-red-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  prepareFlow(dir, path.join(__dirname, '../../node-red/flows.json'), 'reader', 'secret-password');
  const credentials = JSON.parse(fs.readFileSync(path.join(dir, 'flows_cred.json'), 'utf8'));
  assert.deepEqual(credentials['local-broker'], { user: 'reader', password: 'secret-password' });
  const flow = fs.readFileSync(path.join(dir, 'flows.json'), 'utf8');
  assert.equal(flow.includes('secret-password'), false);
  assert.equal(fs.statSync(path.join(dir, 'flows_cred.json')).mode & 0o777, 0o600);
});
