const test = require('node:test');
const assert = require('node:assert/strict');
const { createEvent } = require('../../src/shared/events');
const { signEvent } = require('../../src/shared/signing');
const { consumeBatch, publishEvent } = require('../../src/cloud/aws-transport');
const { processQueueBatch } = require('../../src/cloud/sqs-runner');
const { MemoryStore } = require('../../src/shared/persistence');

test('AWS queue deletes a signed event only after its service succeeds', async () => {
  const event = signEvent(createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: 4, source: 'opening'
  }), 'aws-test-secret');
  const sent = [];
  const sqs = { send: async command => {
    sent.push(command.constructor.name);
    return command.constructor.name === 'ReceiveMessageCommand'
      ? { Messages: [{ Body: JSON.stringify(event), ReceiptHandle: 'receipt-1' }] } : {};
  } };
  const handled = [];
  const result = await consumeBatch({ sqs, queueUrl: 'https://example.invalid/queue',
    signingSecret: 'aws-test-secret', expectedType: 'stock.delta',
    handle: async value => handled.push(value.eventId) });

  assert.deepEqual(result, { received: 1, processed: 1, failed: 0 });
  assert.deepEqual(handled, [event.eventId]);
  assert.deepEqual(sent, ['ReceiveMessageCommand', 'DeleteMessageCommand']);
});

test('AWS queue keeps failed messages for SQS retry and dead letter policy', async () => {
  const event = createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: 4, source: 'opening'
  });
  const sent = [];
  const sqs = { send: async command => {
    sent.push(command.constructor.name);
    return { Messages: [{ Body: JSON.stringify(event), ReceiptHandle: 'receipt-1' }] };
  } };
  const result = await consumeBatch({ sqs, queueUrl: 'https://example.invalid/queue',
    expectedType: 'stock.delta', handle: async () => { throw new Error('Atlas unavailable'); } });

  assert.deepEqual(result, { received: 1, processed: 0, failed: 1 });
  assert.deepEqual(sent, ['ReceiveMessageCommand']);
});

test('AWS event publisher sends a signed event with type attribute to SNS', async () => {
  let published;
  const sns = { send: async command => { published = command.input; return { MessageId: 'msg-1' }; } };
  const event = createEvent('stock.updated', 'store-01', {
    skuId: 'milk-1l', qty: 4, velocityPerDay: 0, daysToStockout: null
  });

  await publishEvent({ sns, topicArn: 'arn:aws:sns:ap-southeast-2:123456789012:events',
    event, signingSecret: 'aws-test-secret' });

  assert.equal(published.MessageAttributes.eventType.StringValue, 'stock.updated');
  assert.equal(JSON.parse(published.Message).eventId, event.eventId);
  assert.equal(JSON.parse(published.Message).signature.length > 20, true);
});

test('AWS inventory worker consumes stock delta, saves stock and emits stock update', async () => {
  const store = new MemoryStore();
  const event = createEvent('stock.delta', 'store-01', {
    skuId: 'milk-1l', delta: 10, source: 'opening'
  });
  const published = [];
  let deleted = 0;
  const sqs = { send: async command => {
    if (command.constructor.name === 'ReceiveMessageCommand') {
      return { Messages: [{ Body: JSON.stringify(event), ReceiptHandle: 'r-1' }] };
    }
    deleted += 1;
    return {};
  } };
  const sns = { send: async command => { published.push(JSON.parse(command.input.Message)); return {}; } };

  const result = await processQueueBatch({ name: 'inventory', store, sqs, sns,
    queueUrl: 'https://example.invalid/inventory', topicArn: 'arn:aws:sns:region:account:events' });

  assert.equal(result.processed, 1);
  assert.equal((await store.getStock('store-01', 'milk-1l')).qty, 10);
  assert.equal(published[0].type, 'stock.updated');
  assert.equal(deleted, 1);
});
