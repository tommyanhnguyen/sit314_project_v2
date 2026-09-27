# ShelfSense:

ShelfSense is the SIT314 IoT Distinction project. It tracks shelf stock and fridge temperature, predicts replenishment needs, batches supplier orders, and shows delivery progress. The local system uses Node.js, MQTT, Node-RED and MongoDB. The AWS deployment targets AWS Learner Lab with EC2, SQS, SNS, an Application Load Balancer, an Auto Scaling Group and CloudWatch.

## Code flow:

```text
Simulator
  → raw MQTT topics
  → Node-RED validation, debounce and temperature logic
  → signed business events
  → local MQTT services, or SQS workers on AWS
  → inventory, replenishment, cold chain and delivery services
  → MongoDB Atlas
  → authenticated API and portal
```

The core file map is:

| Stage | Code | What to inspect |
| --- | --- | --- |
| Shelf, POS and fridge input | `src/simulator.js`, `src/cloud/workload.js` | Raw MQTT data |
| Edge logic | `node-red/flows.json`, `src/edge/processor.js` | Debounce and breach transitions |
| Local messaging | `src/broker.js`, `src/service-runner.js` | MQTT routing and validation |
| AWS messaging | `src/cloud/sqs-runner.js`, `src/cloud/aws-transport.js` | SQS and SNS |
| Stock and order rules | `src/services/` | Inventory, replenishment and delivery |
| Persistence | `src/shared/persistence.js` | `stock_events`, `stock_levels`, `orders`, `deliveries`, `coldchain` |
| Portal | `src/api/server.js`, `public/` | Scoped reads and role actions |

## Run locally:

```bash
npm ci
npm run check-ci
docker compose up --build -d
docker compose --profile demo run --rm simulator
```

Open `http://localhost:3000` for the portal and `http://localhost:1880` for Node-RED. The broker and both UIs bind to your computer only. The Docker stack uses local MongoDB by default. To use Atlas, set `DOCKER_MONGODB_URI` in an ignored `.env` file. `docker compose down` stops the stack.

The `npm run demo` result uses an in memory database. It proves the business loop without Docker. `npm run load-test` is an in process baseline. Its numbers are not AWS scaling evidence.

## Prepare AWS evidence:

The AWS Learner Lab deployment is being rebuilt. The earlier CloudFormation stack needed its own IAM roles, Route 53, ACM and GitHub OIDC. Learner Lab does not allow those, so the new path uses EC2 setup scripts and the lab role. [The evidence checklist](docs/EVIDENCE_CAPTURE_6.3D.md) lists the screenshots for the report.

Run `npm run security-check` to scan project files for likely credentials. Run `npm audit --omit=dev --audit-level=high` for dependency advisories. The API can require signed, one hour role tokens. Create an operator token with `npm run auth-token -- manager store-01` after setting `API_AUTH_SECRET` securely.

The code has local checks. AWS deployment, Docker runtime, Atlas connectivity and actual scaling still need live verification.
