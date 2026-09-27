# ShelfSense V2:

ShelfSense is the SIT314 IoT Distinction project. It tracks shelf stock and fridge temperature, predicts replenishment needs, batches supplier orders, and shows delivery progress. The local system uses Node.js, MQTT, Node-RED and MongoDB. The AWS path uses IoT Core, SQS, SNS, ECS Fargate, an HTTPS load balancer, S3, CloudFront and CloudWatch.

## Code flow:

```text
Arduino or simulator
  → raw MQTT topics
  → Node-RED validation, debounce and temperature logic
  → signed business events
  → local Node.js services or AWS IoT Core and SQS workers
  → inventory, replenishment, cold chain and delivery services
  → MongoDB Atlas
  → authenticated API and portal
```

The core file map is:

| Stage | Code | What to inspect |
| --- | --- | --- |
| Shelf and fridge input | `hardware/smart-shelf/`, `src/simulator.js` | Raw MQTT data |
| Edge logic | `node-red/flows.json`, `src/edge/processor.js` | Debounce and breach transitions |
| Local messaging | `src/broker.js`, `src/service-runner.js` | MQTT routing and validation |
| AWS messaging | `src/cloud/iot-bridge.js`, `src/cloud/sqs-runner.js` | IoT Core, SQS and SNS |
| Stock and order rules | `src/services/` | Inventory, replenishment and delivery |
| Persistence | `src/shared/persistence.js` | `stock_events`, `stock_levels`, `orders`, `deliveries`, `coldchain` |
| Portal | `src/api/server.js`, `public/` | Scoped reads and role actions through CloudFront |
| Cloud resources | `infra/aws/template.json` | ECS, queues, scaling, HTTPS and logging |

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

Follow [the AWS deployment and evidence guide](infra/aws/README.md). It lists account prerequisites, the edge bridge, the before and after scaling workload, Atlas queries and security screenshots. The GitHub workflow builds an ECR image and deploys the CloudFormation stack after the required environment variables are set.

Run `npm run security-check` to scan project files for likely credentials. Run `npm audit --omit=dev --audit-level=high` for dependency advisories. The AWS API requires signed, one hour role tokens. Create an operator token with `npm run auth-token -- manager store-01` after setting `API_AUTH_SECRET` securely.

The code and generated infrastructure template have local checks. AWS deployment, Docker runtime, Atlas connectivity and actual scaling still require live verification in your account. The older [audit](docs/FINAL_PROJECT_AUDIT.md) is dated 22 September 2026 and records the earlier project state.
