const fs = require('node:fs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const flows = JSON.parse(fs.readFileSync('node-red/flows.json', 'utf8'));
const requiredScripts = [
  'test', 'demo', 'load-test', 'broker', 'api', 'simulator',
  'inventory', 'replenishment', 'cold-chain', 'delivery', 'dead-letter'
];

for (const name of requiredScripts) {
  if (!packageJson.scripts[name]) throw new Error('Missing package script: ' + name);
}
if (!flows.some(node => node.type === 'mqtt in')) throw new Error('Node-RED has no MQTT input');
if (!flows.some(node => node.type === 'mqtt out')) throw new Error('Node-RED has no MQTT output');

console.log('Configuration files are valid');
