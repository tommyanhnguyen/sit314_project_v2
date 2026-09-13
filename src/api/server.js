const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../shared/config');
const { MongoStore } = require('../shared/persistence');
const { createEvent } = require('../shared/events');
const { connectMqtt, eventTopic, publishJson } = require('../shared/mqtt');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16384) throw new Error('Request body is too large');
  }
  return body ? JSON.parse(body) : {};
}

function createApiServer(options) {
  const { store, publish } = options;
  const publicDir = path.resolve(options.publicDir || path.join(__dirname, '../../public'));

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');

      if (request.method === 'GET' && url.pathname === '/health') {
        return sendJson(response, 200, { status: 'ok' });
      }

      const readers = {
        '/api/stock': () => store.listStock(),
        '/api/orders': () => store.listOrders(),
        '/api/alerts': () => store.listAlerts(),
        '/api/deliveries': () => store.listDeliveries()
      };
      if (request.method === 'GET' && readers[url.pathname]) {
        return sendJson(response, 200, await readers[url.pathname]());
      }

      const approval = url.pathname.match(/^\/api\/orders\/([^/]+)\/approve$/);
      if (request.method === 'POST' && approval) {
        const input = await readJson(request);
        if (typeof input.approvedBy !== 'string' || !input.approvedBy.trim()) {
          return sendJson(response, 400, { error: 'approvedBy is required' });
        }

        const current = await store.getOrder(decodeURIComponent(approval[1]));
        if (!current) return sendJson(response, 404, { error: 'Order not found' });
        if (current.status !== 'PENDING_APPROVAL') {
          return sendJson(response, 409, { error: 'Order is not pending approval' });
        }

        const order = await store.approveOrder(current.orderId, input.approvedBy.trim());
        const event = createEvent('order.approved', order.store, {
          orderId: order.orderId,
          approvedBy: order.approvedBy
        });
        await publish(event);
        return sendJson(response, 200, order);
      }

      if (request.method !== 'GET') return sendJson(response, 404, { error: 'Not found' });
      const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const filePath = path.resolve(publicDir, relative);
      if (!filePath.startsWith(publicDir + path.sep) || !fs.existsSync(filePath)) {
        return sendJson(response, 404, { error: 'Not found' });
      }

      response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
  });
}

async function startApi() {
  const store = await MongoStore.connect(config.mongoUri);
  const client = await connectMqtt(config.mqttUrl, 'shelfsense-api-' + process.pid);
  const server = createApiServer({
    store,
    publish: event => publishJson(client, eventTopic(event.type), event)
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, resolve);
  });
  console.log('API ready on port ' + config.port);
  return { client, server, store };
}

if (require.main === module) {
  startApi().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { createApiServer, readJson, startApi };
