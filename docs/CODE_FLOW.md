# ShelfSense code flow:

## 1. Sensor to event:

`src/simulator.js` produces JSON readings. Shelf, POS and fridge messages use `shelfsense/raw/...` MQTT topics. `src/broker.js` accepts local MQTT clients and can require a username and password.

`node-red/flows.json` has three MQTT inputs and three function nodes. Each function calls `src/edge/processor.js`. A shelf opening creates a `stock.delta` event. Later weight changes need two stable readings across the debounce interval. POS sales create demand events. Two hot fridge readings create one `coldchain.alert` breach. Cooling below the hysteresis threshold creates a clear event. Bad input goes to `shelfsense/dead-letter`.

Node-RED signs business events with `src/shared/signing.js` when signing is enabled. `node-red/settings.js` saves edge state to disk so a restart keeps shelf and fridge state.

## 2. Event to data:

In the local stack, `src/service-runner.js` and `src/shared/message-handler.js` subscribe to business MQTT topics. In AWS, `src/cloud/sqs-runner.js` consumes the four service queues. A successful message is deleted from SQS. A failed message stays for retry and can reach its dead letter queue.

`src/services/inventory.js` records each stock event once, changes physical stock or POS demand, and publishes `stock.updated`. `src/services/replenishment.js` uses sales velocity and supplier lead time to create an order. An inexpensive order can be approved automatically. A manager can approve another order through the API. `src/outbox-runner.js` retries an approval event if publication fails. `src/services/delivery.js` groups compatible orders by supplier and region, dispatches a route, records each stop, and emits a deterministic restock event. `src/services/cold-chain.js` stores alerts and sends them to SNS in AWS.

`src/shared/persistence.js` writes to Atlas collections `stock_events`, `stock_levels`, `orders`, `deliveries` and `coldchain`. `stock_events.appliedAt` and `coldchain.receivedAt` support latency checks. A unique event ID and indexes make retries safer.

## 3. Data to portal:

`src/api/server.js` reads Atlas and serves stock, orders, alerts and deliveries. It validates a signed token for every `/api/` request in AWS. Roles and store scope restrict reads and actions. `public/app.js` keeps the token in memory and sends it as a Bearer header.

## 4. Where to watch each stage:

| Stage | Live check |
| --- | --- |
| Raw input | MQTT subscription to `shelfsense/raw/#` |
| Edge decision | Node-RED function nodes and `shelfsense/events/#` |
| Work queue | SQS visible messages and dead letter count |
| Processing | Worker instance count and CloudWatch `queue_batch` logs |
| Stored outcome | Atlas collections and run ID filter |
| User outcome | Portal and role scoped API |

`src/cloud/workload.js` publishes the same 20 store and 50 shelf workload for both scaling runs. `runId` is included in shelf and fridge IDs. Compare its expected event count with Atlas applied records. The in process `src/load-test.js` is a separate local benchmark.
