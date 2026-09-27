# SIT314 6.3D evidence capture:

The OnTrack 6.3D task sheet checked on 27 September 2026 asks for a four to five page final report, code and configuration evidence, and a tutor discussion. The current upload slot accepts one report PDF. Keep raw screenshots and code evidence in the appendix, then submit only after every claim has a matching result.

## Capture in this order:

1. `01_ontrack.png`: task sheet, target and PDF upload requirement. Keep the submission state visible.
2. `02_flow.png`: full Node-RED flow with three raw inputs, three decisions, business output and dead letter output.
3. `03_mqtt.png`: one raw shelf reading and its signed `stock.delta` event. Hide passwords and the signing key.
4. `04_atlas.png`: Atlas collection list plus one `stock_events` record and its `stock_levels` result. Show the run ID and timestamps.
5. `05_business.png`: portal stock, an alert, an order and a delivery route. Show the user role and store scope without showing the token.
6. `06_aws.png`: EC2 instances, Auto Scaling Group settings and healthy ALB targets.
7. `07_scaling_before.png` and `08_scaling_after.png`: equal workload shape, time range and chart scale. Show inventory instance count, SQS depth, CPU and processed events per second.
8. `09_security.png`: security group rules, MQTT password rejection, encrypted queues, API 401 and 403 results. Use several readable panels if one image is too small.
9. `10_code.png`: GitHub commit or branch, CI result and key code paths. A local test output alone does not prove live AWS behavior.

## Report layout:

1. Page 1: problem, approved scope and architecture. Explain the sensor, MQTT, Node-RED, AWS and Atlas flow.
2. Page 2: implemented logic. Explain stock, replenishment, cold chain, multi-order delivery and the portal with one business example.
3. Page 3: deployment and scaling. Put a before and after table with measured latency, throughput, queue depth, instance count and CPU. State whether automatic scale out was observed.
4. Page 4: security, failure handling, testing and limits. Show controls and the exact test boundary.
5. Page 5 if needed: results, reflection, code link and tutor feedback response.

Do not claim an AWS latency target or automatic scaling until Atlas and CloudWatch measurements prove it. Keep the local load test separate from cloud measurements. The report can link to the code and attach the evidence appendix, but the upload action remains yours.
