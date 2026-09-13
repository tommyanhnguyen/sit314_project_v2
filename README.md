# ShelfSense V2

ShelfSense is a local IoT stock management system for the SIT314 Distinction project.

This version completes the local phase. AWS deployment, CloudWatch scaling evidence, IAM, and X.509 certificates remain in the next phase.

## What is included

1. Node.js shelf, POS, and fridge simulation.
2. Node-RED edge processing.
3. Inventory, replenishment, cold-chain, and delivery services.
4. MQTT event communication.
5. MongoDB persistence with Atlas support.
6. A small manager portal.
7. Unit, integration, resilience, and local load checks.

## Local data flow

```text
Simulators
    ↓
MQTT broker
    ↓
Node-RED edge flow
    ↓
Business event topics
    ↓
Four Node.js services
    ↓
MongoDB
    ↓
API and manager portal
```

## Quick logic demo

This command runs without Docker or MongoDB:

```bash
npm install
npm test
npm run demo
npm run load-test
```

The demo uses the same domain services with an in memory adapter. It creates stock rows, replenishment orders, cold-chain alerts, and deliveries.

## Full local system

Start the broker, MongoDB, Node-RED, four services, dead letter consumer, and API:

```bash
docker compose up --build
```

Publish the sample sensor stream:

```bash
docker compose --profile demo run --rm simulator
```

Open these local pages:

1. Manager portal: `http://localhost:3000`
2. Node-RED editor: `http://localhost:1880`

Stop the system:

```bash
docker compose down
```

## MongoDB Atlas

Docker Compose uses local MongoDB by default. To use Atlas outside Docker, set `MONGODB_URI` in your local `.env` or terminal environment.

Never place an Atlas username or password in source code. `.env.example` contains safe variable names only.

## Main event topics

| Topic | Purpose |
| --- | --- |
| `shelfsense/raw/+/shelf/+` | Raw shelf weights |
| `shelfsense/raw/+/pos` | Raw POS sales |
| `shelfsense/raw/+/fridge/+` | Raw temperatures |
| `shelfsense/events/stock.delta` | Physical and demand stock events |
| `shelfsense/events/stock.updated` | Current stock projection |
| `shelfsense/events/coldchain.alert` | Temperature state changes |
| `shelfsense/events/order.approved` | Approved replenishment orders |
| `shelfsense/dead-letter` | Rejected messages |

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Process health |
| GET | `/api/stock` | Current stock |
| GET | `/api/orders` | Replenishment orders |
| GET | `/api/alerts` | Cold-chain alerts |
| GET | `/api/deliveries` | Planned deliveries |
| POST | `/api/orders/:id/approve` | Manager approval |

Approval body:

```json
{
  "approvedBy": "manager:tommy"
}
```

## Local metrics

`npm run load-test` reports event count, elapsed time, throughput, median latency, p95 latency, and peak backlog. These values prepare the later AWS comparison. They are not AWS scaling evidence.

## Current security boundary

Secrets come from environment variables. Input is validated. Bad messages use the dead letter path. The local broker can use a username and password through `MQTT_USERNAME` and `MQTT_PASSWORD`.

TLS, user authentication, store scoped authorisation, IAM, X.509, and Secrets Manager belong to the AWS secure deployment phase.
