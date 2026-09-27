function validateProductionConfig(env, role = 'worker') {
  const errors = [];
  if (!/^mongodb\+srv:\/\//.test(env.MONGODB_URI || '')) {
    errors.push('MONGODB_URI must use an Atlas mongodb+srv URI');
  }
  if (!env.AWS_REGION) errors.push('AWS_REGION is required');
  if (env.EVENT_SIGNING_REQUIRED !== 'true') errors.push('EVENT_SIGNING_REQUIRED must be true');
  if ((env.EVENT_SIGNING_SECRET || '').length < 32) {
    errors.push('EVENT_SIGNING_SECRET must be at least 32 characters');
  }
  if (role === 'api') {
    if (env.API_AUTH_REQUIRED !== 'true') errors.push('API_AUTH_REQUIRED must be true');
    if ((env.API_AUTH_SECRET || '').length < 32) {
      errors.push('API_AUTH_SECRET must be at least 32 characters');
    }
  }
  return errors;
}

function assertProductionConfig(env, role) {
  const errors = validateProductionConfig(env, role);
  if (errors.length) throw new Error('Unsafe production configuration: ' + errors.join('; '));
}

module.exports = { validateProductionConfig, assertProductionConfig };
