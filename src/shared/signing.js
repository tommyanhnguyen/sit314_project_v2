const { createHmac, timingSafeEqual } = require('node:crypto');

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function digest(event, secret) {
  const unsigned = { ...event };
  delete unsigned.signature;
  return createHmac('sha256', secret).update(stable(unsigned)).digest('base64url');
}

function signEvent(event, secret) {
  const signed = structuredClone(event);
  signed.signature = digest(signed, secret);
  return signed;
}

function verifyEvent(event, secret) {
  if (typeof event?.signature !== 'string') throw new Error('Event signature is required');
  const expected = Buffer.from(digest(event, secret));
  const supplied = Buffer.from(event.signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new Error('Invalid event signature');
  }
  return true;
}

module.exports = { signEvent, stable, verifyEvent };
