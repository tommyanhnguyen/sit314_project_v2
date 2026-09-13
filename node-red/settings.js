const path = require('node:path');

function loadEdgeProcessor() {
  const candidates = [
    process.env.EDGE_PROCESSOR_PATH,
    '/data/edge/processor',
    path.join(__dirname, '../src/edge/processor')
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate).createEdgeProcessor();
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND' || !error.message.includes(candidate)) throw error;
    }
  }
  throw new Error('Cannot load the edge processor');
}

module.exports = {
  flowFile: 'flows.json',
  functionExternalModules: false,
  functionGlobalContext: {
    edgeProcessor: loadEdgeProcessor()
  },
  editorTheme: {
    projects: { enabled: false }
  }
};
