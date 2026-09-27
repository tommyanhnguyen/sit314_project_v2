const { validateEvent } = require('./events');
const { verifyEvent } = require('./signing');

async function handleMessage(options) {
  const { topic, payload, expectedType, process: processEvent, deadLetter } = options;

  try {
    const event = parsePayload(payload);
    validateEvent(event);
    const signingSecret = options.signingSecret ?? (process.env.EVENT_SIGNING_REQUIRED === 'true'
      ? process.env.EVENT_SIGNING_SECRET : null);
    if (process.env.EVENT_SIGNING_REQUIRED === 'true' && !signingSecret) {
      throw new Error('Event signing secret is required');
    }
    if (signingSecret) verifyEvent(event, signingSecret);
    const acceptedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];
    if (!acceptedTypes.includes(event.type)) {
      throw new Error('Unexpected event type: ' + event.type);
    }
    await processEvent(event);
    return { accepted: true };
  } catch (error) {
    const item = {
      sourceTopic: topic,
      reason: error.message,
      payload: Buffer.isBuffer(payload) ? payload.toString() : payload,
      ts: Date.now()
    };
    try {
      await deadLetter(item);
    } catch (deadLetterError) {
      item.deadLetterError = deadLetterError.message;
    }
    return { accepted: false, reason: error.message };
  }
}

function parsePayload(payload) {
  if (Buffer.isBuffer(payload)) return JSON.parse(payload.toString());
  if (typeof payload === 'string') return JSON.parse(payload);
  if (payload && typeof payload === 'object') return payload;
  throw new Error('Payload must contain JSON');
}

module.exports = { handleMessage, parsePayload };
