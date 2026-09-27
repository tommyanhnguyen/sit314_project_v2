# ShelfSense AWS Ready Design

## Goal:

Complete the planned local features and produce an AWS ready project. Actual AWS credentials, resource creation and CloudWatch evidence remain external because they require the user's account and a live experiment.

## Source of truth:

1. The SIT314 1.2D brief requires Node.js, Node-RED, AWS, event based microservices, automatic scaling and secure deployment.
2. The approved ShelfSense plan commits shelf, fridge and POS simulation, multi-store inventory, replenishment approval, cold-chain alerts, delivery batching by region, nearest-neighbour routing, ETAs, status tracking, MongoDB, Docker, a portal and AWS scaling evidence.
3. Tutor feedback requires before and after measurements for latency, throughput and resource utilisation, supported by AWS and CloudWatch evidence.
4. One physical smart shelf will use an Arduino and a weight sensor. It must publish the same raw shelf contract as the simulator.

## Branch and commit policy:

Work is isolated on `aws-deployment`. The earlier audit branch remains unchanged. The completed implementation will be amended into commit `5f8a5f1` as requested, so the branch presents one reviewable commit on top of `review-fixes`.

## Delivery workflow:

An approved order joins one open batch selected by supplier and region. The store catalogue supplies region and coordinates. A unique batch key prevents two service replicas from opening two batches for the same group.

The delivery lifecycle is `DRAFT`, `PLANNED`, `IN_TRANSIT`, then `DELIVERED`. Dispatch freezes the order list, computes a nearest-neighbour route from the supplier depot and assigns an ETA to every stop. Completing a stop publishes deterministic restock events for its orders and closes those orders. The delivery becomes `DELIVERED` after every stop is complete.

The manager portal approves orders. The supplier view dispatches draft batches. The driver view starts a route and completes individual stops. The same page can show all three roles for the assessment demo.

## Reliability:

Stock application becomes retry safe. A storage adapter records whether a stock event is complete. Applying physical or sales changes is idempotent for the event ID. A retry continues an incomplete event rather than treating it as complete.

Approval publication becomes recoverable. The order stores an approval event as pending. The API or service publishes it, then marks it sent. A retry republishes the same deterministic event ID. A small outbox worker republishes pending approvals after restart.

Delivery batching and stop completion use deterministic keys and storage claims. Concurrent handlers return the same batch. Deterministic restock IDs prevent a completed stop from adding stock twice.

The edge processor exports and restores its shelf and fridge state. Node-RED uses filesystem context and saves this state after accepted readings. A restart therefore does not emit a second opening event for an unchanged shelf.

## Security:

Local security is enabled through environment variables. MQTT clients send configured credentials. The broker validates credentials with timing safe comparison. The API supports HTTPS when certificate paths are supplied.

API mutations require signed HMAC bearer tokens. Claims include subject, role, allowed stores and expiry. Manager tokens approve orders, supplier tokens dispatch matching deliveries and driver tokens update delivery progress. Read routes require a token when `API_AUTH_REQUIRED=true` and filter store scoped data.

Business events can carry an HMAC signature. Service consumers verify signed events when `EVENT_SIGNING_REQUIRED=true`. Secrets and generated certificates remain outside Git. Security checks scan tracked files, validate secure production configuration and test rejected credentials, expired tokens, wrong roles, wrong stores and modified events.

## Arduino shelf:

`hardware/smart-shelf/smart_shelf.ino` reads an HX711 load cell, applies calibration and writes one newline delimited JSON reading over USB serial. It includes `store`, `shelfId`, `skuId`, `grams`, `ts` and `deviceId`.

`src/hardware-gateway.js` reads those lines from a serial device path or standard input, validates them and publishes the existing raw shelf MQTT topic. The gateway requires no Arduino specific Node package because macOS and Linux expose USB serial devices as files. The calibration value and serial device stay in environment variables.

## Cloud simulation and AWS boundary:

The local cloud simulation models a queue, worker replicas and an auto scaling policy. It records processed events, failed events, throughput, median and p95 latency, peak queue depth, worker count over time, CPU time and peak RSS. A Docker profile runs the same simulation in a container. This validates the workload and metric pipeline. It is not AWS evidence.

The repository will contain AWS configuration guidance and a manual deployment workflow contract. AWS access keys, account identifiers, certificate private keys, live resource names and captured CloudWatch evidence stay outside Git. IoT Core, SQS or SNS, ECS Fargate, IAM and CloudWatch still require a live AWS deployment. No local result will be described as automatic scaling on AWS.

## CI and CD:

CI installs locked dependencies, runs unit and integration tests, the local demo, the cloud simulation, configuration validation, dependency audit, secret scan and Docker build. A manual deployment workflow validates required AWS variables, logs in to ECR, builds and pushes the image, then updates named ECS services. It cannot run until the user supplies credentials and deployed resource names.

## Testing:

Every behaviour change follows red, green and refactor. Tests cover batching, route order, ETAs, status transitions, idempotency, concurrent handlers, outbox recovery, edge restart, authentication, authorisation, event signing, MQTT credentials, Arduino input, cloud metrics and configuration validation.

Docker verification must build the images, start MongoDB, broker, Node-RED, services and API, run the simulator, verify health, inspect stored records and shut the stack down. If Docker is unavailable, the report must say so and retain the exact command for the user.

## Completion boundary:

This branch is complete when local tests, demo, security checks, cloud simulation and Docker verification pass, and documentation names the remaining live AWS actions. The project itself is complete only after real AWS deployment, automatic scaling, secure access tests and CloudWatch evidence are captured.
