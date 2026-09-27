const config = require('./shared/config');
const { MongoStore } = require('./shared/persistence');
const { openEventPublisher } = require('./shared/event-publisher');
const { assertProductionConfig } = require('./shared/production-config');

async function drainApprovalOutbox({ store, publish }) {
  const events = await store.listPendingApprovalEvents();
  let sent = 0;
  for (const event of events) {
    await publish(event);
    await store.markApprovalPublished(event.eventId);
    sent += 1;
  }
  return sent;
}

async function startOutbox() {
  if (process.env.EVENT_TRANSPORT === 'aws') assertProductionConfig(process.env, 'worker');
  const store = await MongoStore.connect(config.mongoUri);
  const transport = await openEventPublisher('shelfsense-outbox-' + process.pid);
  const publish = transport.publish;
  const intervalMs = Number(process.env.OUTBOX_INTERVAL_MS || 2000);
  const timer = setInterval(() => drainApprovalOutbox({ store, publish })
    .catch(error => console.error('Outbox retry failed: ' + error.message)), intervalMs);
  timer.unref();
  await drainApprovalOutbox({ store, publish });
  return { transport, store, close: async () => {
    clearInterval(timer);
    await transport.close();
    await store.close();
  } };
}

if (require.main === module) {
  startOutbox().then(() => console.log('Approval outbox ready')).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { drainApprovalOutbox, startOutbox };
