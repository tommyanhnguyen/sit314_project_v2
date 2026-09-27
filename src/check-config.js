const fs = require('node:fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const flows = JSON.parse(fs.readFileSync('node-red/flows.json', 'utf8'));
const template = JSON.parse(fs.readFileSync('infra/aws/template.json', 'utf8'));
const { buildTemplate } = require('../infra/aws/template');
const { assertProductionConfig } = require('./shared/production-config');
const requiredScripts = [
  'test', 'demo', 'load-test', 'evidence', 'broker', 'api', 'simulator',
  'node-red', 'watch',
  'inventory', 'replenishment', 'cold-chain', 'delivery', 'dead-letter'
];

for (const name of requiredScripts) {
  if (!packageJson.scripts[name]) throw new Error('Missing package script: ' + name);
}
if (!flows.some(node => node.type === 'mqtt in')) throw new Error('Node-RED has no MQTT input');
if (!flows.some(node => node.type === 'mqtt out')) throw new Error('Node-RED has no MQTT output');
if (JSON.stringify(template) !== JSON.stringify(buildTemplate())) throw new Error('AWS template is stale');
if (process.env.EVENT_TRANSPORT === 'aws') assertProductionConfig(process.env,
  process.env.SERVICE_NAME === 'api' ? 'api' : 'worker');

console.log('Configuration files are valid');
