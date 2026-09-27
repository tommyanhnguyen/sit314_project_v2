const { DeleteMessageCommand, ReceiveMessageCommand } = require('@aws-sdk/client-sqs');
const { PublishCommand } = require('@aws-sdk/client-sns');
const { validateEvent } = require('../shared/events');
const { parsePayload } = require('../shared/message-handler');
const { signEvent, verifyEvent } = require('../shared/signing');

async function consumeBatch(options) {
  const { sqs, queueUrl, expectedType, signingSecret, handle, onError = () => {} } = options;
  if (!queueUrl) throw new Error('SQS queue URL is required');
  const response = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: options.waitTimeSeconds ?? 10,
    VisibilityTimeout: options.visibilityTimeout ?? 60
  }));
  const messages = response.Messages || [];
  let processed = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      const event = parsePayload(message.Body);
      validateEvent(event);
      if (event.type !== expectedType) throw new Error('Unexpected event type: ' + event.type);
      if (signingSecret) verifyEvent(event, signingSecret);
      await handle(event);
      await sqs.send(new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle
      }));
      processed += 1;
    } catch (error) {
      failed += 1;
      onError(error, message);
    }
  }
  return { received: messages.length, processed, failed };
}

async function publishEvent({ sns, topicArn, event, signingSecret }) {
  if (!topicArn) throw new Error('SNS topic ARN is required');
  validateEvent(event);
  const message = signingSecret ? signEvent(event, signingSecret) : event;
  return sns.send(new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify(message),
    MessageAttributes: {
      eventType: { DataType: 'String', StringValue: event.type }
    }
  }));
}

module.exports = { consumeBatch, publishEvent };
