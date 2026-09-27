const { randomUUID } = require('node:crypto');

const STOCK_SOURCES = new Set(['opening', 'shelf', 'delivery', 'pos']);

const RULES = {
  'stock.delta': {
    skuId: 'string',
    delta: 'number',
    source: 'stockSource'
  },
  'stock.updated': {
    skuId: 'string',
    qty: 'number',
    velocityPerDay: 'number',
    daysToStockout: 'nullableNumber'
  },
  'temperature.reading': {
    unitId: 'string',
    tempC: 'number'
  },
  'coldchain.alert': {
    unitId: 'string',
    tempC: 'number',
    state: 'string'
  },
  'order.created': {
    orderId: 'string',
    lines: 'array',
    status: 'string'
  },
  'order.approved': {
    orderId: 'string',
    approvedBy: 'string'
  },
  'delivery.created': {
    deliveryId: 'string',
    orderIds: 'array',
    route: 'array',
    stops: 'array'
  },
  'delivery.status': {
    deliveryId: 'string',
    status: 'string'
  }
};

function createEvent(type, store, data, options = {}) {
  return {
    eventId: options.eventId || randomUUID(),
    type,
    store,
    ts: options.ts ?? Date.now(),
    data
  };
}

function isValidType(value, expected) {
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'number') return Number.isFinite(value);
  if (expected === 'nullableNumber') return value === null || Number.isFinite(value);
  if (expected === 'stockSource') return STOCK_SOURCES.has(value);
  return typeof value === expected && value.length > 0;
}

function validateEvent(event) {
  if (!event || typeof event !== 'object') throw new Error('Event must be an object');
  if (typeof event.eventId !== 'string' || !event.eventId) throw new Error('Invalid eventId');
  if (typeof event.store !== 'string' || !event.store) throw new Error('Invalid store');
  if (!Number.isFinite(event.ts)) throw new Error('Invalid ts');
  if (!event.data || typeof event.data !== 'object') throw new Error('Invalid data');

  const rules = RULES[event.type];
  if (!rules) throw new Error('Unknown event type: ' + event.type);

  const invalid = Object.entries(rules)
    .filter(([field, type]) => !isValidType(event.data[field], type))
    .map(([field]) => field);

  if (invalid.length) throw new Error('Invalid fields: ' + invalid.join(', '));
  return event;
}

module.exports = { RULES, STOCK_SOURCES, createEvent, validateEvent };
