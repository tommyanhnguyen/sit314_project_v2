const { issueToken } = require('./shared/auth');

function createRoleToken({ role, stores, secret }) {
  if (!['manager', 'supplier', 'driver'].includes(role)) throw new Error('Role must be manager, supplier or driver');
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('API_AUTH_SECRET must be at least 32 characters');
  const scope = stores === '*' ? '*' : String(stores || '').split(',').map(value => value.trim()).filter(Boolean);
  if (scope !== '*' && (!scope.length || scope.some(value => !/^store-\d+$/.test(value)))) {
    throw new Error('Store scope must be * or comma separated store IDs');
  }
  return issueToken({ role, stores: scope }, secret);
}

if (require.main === module) {
  try {
    console.log(createRoleToken({ role: process.argv[2], stores: process.argv[3],
      secret: process.env.API_AUTH_SECRET }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { createRoleToken };
