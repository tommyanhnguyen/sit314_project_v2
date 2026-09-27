function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

module.exports = {
  mqttUrl: process.env.MQTT_URL || 'mqtt://localhost:1883',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shelfsense',
  port: numberFromEnv('PORT', 3000),
  debounceMs: numberFromEnv('DEBOUNCE_MS', 800),
  temperatureLimitC: numberFromEnv('TEMPERATURE_LIMIT_C', 5),
  temperatureSamples: numberFromEnv('TEMPERATURE_SAMPLES', 2),
  temperatureHysteresisC: numberFromEnv('TEMPERATURE_HYSTERESIS_C', 0.8),
  autoApproveUnder: numberFromEnv('AUTO_APPROVE_UNDER', 150),
  safetyDays: numberFromEnv('SAFETY_DAYS', 1),
  apiAuthRequired: process.env.API_AUTH_REQUIRED === 'true',
  apiAuthSecret: process.env.API_AUTH_SECRET || '',
  eventSigningRequired: process.env.EVENT_SIGNING_REQUIRED === 'true',
  eventSigningSecret: process.env.EVENT_SIGNING_SECRET || '',
  tlsKeyFile: process.env.TLS_KEY_FILE || '',
  tlsCertFile: process.env.TLS_CERT_FILE || ''
};
