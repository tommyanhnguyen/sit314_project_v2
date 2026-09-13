module.exports = {
  flowFile: 'flows.json',
  functionExternalModules: false,
  functionGlobalContext: {
    edgeProcessor: require('/data/edge/processor').createEdgeProcessor()
  },
  editorTheme: {
    projects: { enabled: false }
  }
};
