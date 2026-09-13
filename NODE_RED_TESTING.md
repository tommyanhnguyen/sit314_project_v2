# Node-RED testing

## Automated check

Run:

```bash
node --test test/integration/node-red-flow.test.js
```

The tests execute the real function code stored in `flows.json`. They cover valid input, unsettled shelf input, malformed JSON, unknown SKU, invalid POS quantity, and a temperature breach.

## Local editor

Start the stack:

```bash
docker compose up --build -d
```

Open `http://localhost:1880`. The three MQTT inputs must show as connected.

## Live flow

Publish the simulator stream:

```bash
docker compose --profile demo run --rm simulator
```

Open `http://localhost:3000` and confirm that stock, orders, alerts, and deliveries appear.

Malformed JSON must reach `shelfsense/dead-letter`. Raw MQTT topics are not retained, so start Node-RED before the simulator.
