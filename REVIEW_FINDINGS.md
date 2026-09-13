# V2 review fixes

This update applies five verified findings from the V3 review without copying the V3 folder into the main project.

## Fixed defects

1. Completed orders now release their unique open order key.
2. Inventory rejects unknown stock sources and invalid POS quantities.
3. Sensor time and wall clock time now have separate responsibilities.
4. The local load test measures queue depth while work is running.
5. Node-RED sends malformed JSON to the dead letter topic.

Delivery completion also uses a retryable `RESTOCK_PENDING` state. A failed MQTT publication does not permanently close the order. Restock events use deterministic IDs so inventory can reject duplicates.

## Verified local behavior

Run `npm run check` for the full local logic check. Run `npm run evidence` only when preparing the report. Generated evidence stays inside the ignored `report_evidence/` directory.

## Known limits

1. The current load test runs in one process without MQTT or MongoDB.
2. One service instance processes messages in sequence.
3. Multiple inventory instances still need concurrency control for velocity updates.
4. Node-RED edge state is kept in memory.
5. API authentication belongs to the secure deployment phase.
6. AWS, CloudWatch, IAM, TLS, and X.509 are not implemented yet.
