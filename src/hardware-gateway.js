const fs = require('node:fs');
const readline = require('node:readline');
const config = require('./shared/config');
const { getSku } = require('./shared/catalogue');
const { connectMqtt, publishJson } = require('./shared/mqtt');

function requiredString(reading, field) {
  if (typeof reading[field] !== 'string' || !reading[field].trim()) {
    throw new Error(field + ' is required');
  }
}

function parseShelfLine(line) {
  const reading = JSON.parse(line);
  for (const field of ['store', 'shelfId', 'skuId', 'deviceId']) requiredString(reading, field);
  getSku(reading.skuId);
  if (!Number.isFinite(reading.grams) || reading.grams < 0) throw new Error('grams must be nonnegative');
  if (!Number.isFinite(reading.ts) || reading.ts < 0) throw new Error('ts must be nonnegative');
  return reading;
}

function shelfTopic(reading) {
  return `shelfsense/raw/${reading.store}/shelf/${reading.shelfId}`;
}

async function runHardwareGateway(options = {}) {
  const device = options.device || process.env.SERIAL_DEVICE;
  const input = options.input || (device ? fs.createReadStream(device, { encoding: 'utf8' }) : process.stdin);
  const client = options.client || await connectMqtt(config.mqttUrl, 'shelfsense-hardware-' + process.pid);
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let published = 0;
  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      const reading = parseShelfLine(line);
      reading.wallTs = Date.now();
      await publishJson(client, shelfTopic(reading), reading);
      published += 1;
    } catch (error) {
      console.error('Rejected Arduino reading: ' + error.message);
    }
  }
  if (!options.client) await new Promise(resolve => client.end(false, resolve));
  return published;
}

if (require.main === module) {
  runHardwareGateway().then(count => console.log('Published ' + count + ' shelf readings')).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { parseShelfLine, runHardwareGateway, shelfTopic };
