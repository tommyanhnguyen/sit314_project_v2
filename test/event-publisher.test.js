const test = require('node:test');
const assert = require('node:assert/strict');
const { createEvent } = require('../src/shared/events');
const { createPublisher } = require('../src/shared/transport');

test('AWS API publisher sends approval events to SNS', async () => {
  let sent;
  const publisher = createPublisher({ mode: 'aws', sns: {
    send: async command => { sent = command.input; return {}; }
  }, topicArn: 'arn:aws:sns:region:account:events' });
  const event = createEvent('order.approved', 'store-01', {
    orderId: 'order-1', approvedBy: 'manager:tommy'
  });

  await publisher(event);

  assert.equal(JSON.parse(sent.Message).eventId, event.eventId);
  assert.equal(sent.MessageAttributes.eventType.StringValue, 'order.approved');
});
