const path = require('node:path');
const fs = require('node:fs');

const edgeStateFile = process.env.EDGE_STATE_FILE || path.join(__dirname, 'edge-state.json');

function loadEdgeState() {
  try {
    return JSON.parse(fs.readFileSync(edgeStateFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return {};
  }
}

function saveEdgeState(state) {
  const temporary = edgeStateFile + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(state));
  fs.renameSync(temporary, edgeStateFile);
}

function loadEdgeProcessor() {
  const candidates = [
    process.env.EDGE_PROCESSOR_PATH,
    '/data/edge/processor',
    path.join(__dirname, '../src/edge/processor')
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate).createEdgeProcessor({ initialState: loadEdgeState() });
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND' || !error.message.includes(candidate)) throw error;
    }
  }
  throw new Error('Cannot load the edge processor');
}

function signBusinessEvent(event) {
  if (process.env.EVENT_SIGNING_REQUIRED !== 'true') return event;
  const secret = process.env.EVENT_SIGNING_SECRET;
  if (!secret) throw new Error('Event signing secret is required');
  const modulePath = fs.existsSync('/data/shared/signing.js')
    ? '/data/shared/signing' : path.join(__dirname, '../src/shared/signing');
  return require(modulePath).signEvent(event, secret);
}

module.exports = {
  flowFile: 'flows.json',
  credentialSecret: process.env.NODE_RED_EPHEMERAL_CREDENTIALS === 'true' ? false : undefined,
  adminAuth: process.env.NODE_RED_ADMIN_PASSWORD_HASH ? {
    type: 'credentials',
    users: [{ username: 'admin', password: process.env.NODE_RED_ADMIN_PASSWORD_HASH,
      permissions: '*' }]
  } : undefined,
  functionExternalModules: false,
  functionGlobalContext: {
    edgeProcessor: loadEdgeProcessor(),
    saveEdgeState,
    signBusinessEvent
  },
  editorTheme: {
    projects: { enabled: false }
  }
};
