# ShelfSense AWS Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete ShelfSense local features, reliability, security, Arduino input, CI/CD and a measurable cloud simulation while leaving only live AWS account actions and evidence external.

**Architecture:** Preserve Node.js, MQTT, Node-RED and MongoDB boundaries. Add storage claims and pending events for recovery, multi-order regional delivery batches, role scoped API tokens, optional TLS and event signatures, an Arduino serial bridge and a deterministic auto scaling simulation.

**Tech Stack:** Node.js 20 or newer, Node test runner, MQTT, Aedes, MongoDB 7, Node-RED 4, Docker Compose, Arduino C++, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-22-shelfsense-aws-ready-design.md`

## Global Constraints:

1. Follow the SIT314 brief, approved ShelfSense plan and tutor feedback.
2. Use no committed credentials, account identifiers, private keys or generated certificates.
3. Do not describe local simulation as AWS evidence.
4. Keep `main`, `review-fixes` and `audit/final-project-2026-09-22` unchanged.
5. Finish on branch `aws-deployment` and amend commit `5f8a5f1` only after fresh verification.
6. Preserve the physical shelf contract for Arduino, HX711 and USB serial input.

---

### Task 1: Store and route topology:

**Files:**
- Create: `src/shared/topology.js`
- Modify: `src/shared/catalogue.js`
- Test: `test/unit/topology.test.js`

**Interfaces:**
- Produces: `getStore(storeId)`, `getDepot(supplier)`, `batchKey(order)`, `nearestNeighbour(start, stops)` and `routeWithEtas(start, stops, speedKmPerHour, startedAt)`.

- [ ] Write tests with two regions, three stores and hand calculated route distances and ETAs.
- [ ] Run `node --test test/unit/topology.test.js` and confirm missing module failure.
- [ ] Add immutable store and depot records plus pure routing functions.
- [ ] Run the topology test and confirm it passes.

### Task 2: Multi-order delivery batches and tracking:

**Files:**
- Modify: `src/services/delivery.js`
- Modify: `src/shared/persistence.js`
- Modify: `src/shared/events.js`
- Modify: `src/api/server.js`
- Modify: `public/app.js`
- Modify: `public/index.html`
- Test: `test/unit/delivery.test.js`
- Test: `test/integration/api.test.js`
- Test: `test/regression/final-audit.test.js`

**Interfaces:**
- Store produces: `addOrderToDeliveryBatch(order, batch)`, `dispatchDelivery(id, update)`, `startDelivery(id, at)`, `completeDeliveryStop(id, store, at)` and unique indexes on `batchKey` and order IDs.
- Service produces: `handle(event)`, `dispatch(id)`, `start(id)` and `completeStop(id, store)`.

- [ ] Write failing tests for two orders in one regional batch, route order, stop ETA, concurrent handler idempotency and per-stop completion.
- [ ] Run the delivery and API tests and confirm expected failures.
- [ ] Implement storage claims and the delivery lifecycle.
- [ ] Add dispatch, start and complete-stop API routes and portal actions.
- [ ] Run the focused tests until they pass.

### Task 3: Retry safe stock and approval outbox:

**Files:**
- Modify: `src/shared/persistence.js`
- Modify: `src/services/inventory.js`
- Modify: `src/services/replenishment.js`
- Create: `src/outbox-runner.js`
- Modify: `src/api/server.js`
- Modify: `src/service-runner.js`
- Test: `test/regression/reliability.test.js`

**Interfaces:**
- Store produces: `beginStockEvent(event)`, `completeStockEvent(eventId)`, idempotent stock mutations, `approveOrderWithPendingEvent(...)`, `listPendingApprovalEvents()` and `markApprovalPublished(eventId)`.

- [ ] Write failing tests for retry after stock write failure, retry after publish failure and recovery after process restart.
- [ ] Run the reliability tests and confirm the audit failures.
- [ ] Implement retry state and deterministic approval events in both stores.
- [ ] Add the outbox worker and inline publish acknowledgement.
- [ ] Run focused reliability tests until they pass.

### Task 4: Persistent edge state and Arduino gateway:

**Files:**
- Modify: `src/edge/processor.js`
- Modify: `node-red/settings.js`
- Modify: `node-red/flows.json`
- Create: `src/hardware-gateway.js`
- Create: `hardware/smart-shelf/smart_shelf.ino`
- Create: `hardware/smart-shelf/README.md`
- Test: `test/unit/hardware-gateway.test.js`
- Test: `test/unit/edge.test.js`

**Interfaces:**
- Edge produces: `snapshot()` and accepts `initialState`.
- Gateway produces: `parseShelfLine(line)` and `shelfTopic(reading)`.

- [ ] Write failing tests for edge state restoration and newline delimited shelf input.
- [ ] Run focused tests and confirm failures.
- [ ] Implement state export, restore and the serial bridge.
- [ ] Update Node-RED filesystem context and flow state writes.
- [ ] Add a compilable Arduino sketch and calibration guide.
- [ ] Run focused tests until they pass.

### Task 5: Authentication, authorisation, signing and TLS readiness:

**Files:**
- Create: `src/shared/auth.js`
- Create: `src/shared/signing.js`
- Modify: `src/shared/mqtt.js`
- Modify: `src/shared/message-handler.js`
- Modify: `src/broker.js`
- Modify: `src/api/server.js`
- Modify: `src/shared/config.js`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Test: `test/unit/auth.test.js`
- Test: `test/unit/signing.test.js`
- Test: `test/integration/api-security.test.js`
- Test: `test/integration/broker.test.js`

**Interfaces:**
- Auth produces: `issueToken(claims, secret, now)`, `verifyToken(token, secret, now)` and `authorize(claims, role, store)`.
- Signing produces: `signEvent(event, secret)` and `verifyEvent(event, secret)`.

- [ ] Write failing tests for expired tokens, wrong roles, wrong stores, modified events and rejected MQTT credentials.
- [ ] Run focused security tests and confirm failures.
- [ ] Implement HMAC tokens, event signatures, MQTT credentials and optional TLS server creation.
- [ ] Protect mutation routes and filter scoped reads when auth is enabled.
- [ ] Wire secure environment variables into Docker Compose.
- [ ] Run focused security tests until they pass.

### Task 6: Cloud scale simulation and evidence metrics:

**Files:**
- Create: `src/cloud/scale-simulator.js`
- Create: `test/integration/cloud-scale.test.js`
- Modify: `docker-compose.yml`
- Modify: `package.json`

**Interfaces:**
- Produces: `runScaleSimulation(options)` with events, processed, failed, throughput, medianLatencyMs, p95LatencyMs, peakQueueDepth, maxWorkers, scaleEvents, cpuMs and peakRssBytes.

- [ ] Write a failing test with a slow worker and literal scaling expectations.
- [ ] Run the test and confirm missing module failure.
- [ ] Implement queue depth based scale out and idle scale in with deterministic injected work.
- [ ] Add `cloud-sim` and `cloud-sim-evidence` scripts and a Docker profile.
- [ ] Run the focused test and simulation.

### Task 7: CI, CD and security gates:

**Files:**
- Create: `scripts/security-check.js`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-aws.yml`
- Create: `infra/aws/README.md`
- Modify: `src/check-config.js`
- Modify: `package.json`
- Test: `test/unit/security-check.test.js`

**Interfaces:**
- Security script scans tracked project content supplied as paths and reports secret patterns without printing secret values.
- Deployment workflow consumes AWS role, region, ECR repository, ECS cluster and service names from GitHub environment secrets and variables.

- [ ] Write failing tests for secret detection and safe sample values.
- [ ] Run the focused test and confirm missing module failure.
- [ ] Implement the scanner and production configuration checks.
- [ ] Add CI and manual CD workflows with explicit required inputs.
- [ ] Run `npm run security-check`, `npm audit --omit=dev` and configuration validation.

### Task 8: Demo, Docker and documentation:

**Files:**
- Modify: `src/demo.js`
- Modify: `src/simulator.js`
- Modify: `README.md`
- Modify: `docs/FINAL_PROJECT_AUDIT.md`
- Modify: `docs/FINAL_PROJECT_CHECKLIST.md`
- Test: `test/integration/local-flow.test.js`

**Interfaces:**
- Demo proves at least two stores share one regional delivery batch with multiple stops and all orders close after stop completion.

- [ ] Update the local-flow test to require one multi-stop delivery and the full delivery lifecycle.
- [ ] Run the test and confirm failure before demo changes.
- [ ] Update demo and documentation, including the Arduino shelf and exact AWS boundary.
- [ ] Run `npm run check` with local networking permission.
- [ ] Build and run the Docker stack, execute the simulator and cloud profile, inspect health and records, then stop the stack.
- [ ] Inspect Git diff, run dash checks and confirm evidence folders remain ignored.
- [ ] Amend commit `5f8a5f1` with the verified implementation.
