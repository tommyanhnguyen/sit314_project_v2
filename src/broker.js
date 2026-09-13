const net = require('node:net');

async function startBroker(port = Number(process.env.MQTT_PORT || 1883)) {
  const { Aedes } = require('aedes');
  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;
  const options = {};

  if (username && password) {
    options.authenticate = (client, givenUser, givenPassword, done) => {
      const valid = givenUser === username && givenPassword?.toString() === password;
      done(null, valid);
    };
  }

  const aedes = await Aedes.createBroker(options);
  const server = net.createServer(aedes.handle);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, resolve);
  });
  return { aedes, server, port: server.address().port };
}

if (require.main === module) {
  startBroker()
    .then(({ port }) => console.log('Broker ready on port ' + port))
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { startBroker };
