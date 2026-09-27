# AWS deployment and evidence:

## What the stack creates:

`template.json` creates an ECS Fargate cluster with API, inventory, replenishment, cold chain, delivery and approval outbox services. It also creates four SQS queues with dead letter queues, an SNS event topic, an SNS alert topic, two AWS IoT Core rules, a limited IoT bridge policy, an HTTPS Application Load Balancer, a Route 53 record, a private S3 bucket, a CloudFront portal, CloudWatch log groups and inventory scaling alarms.

The local Node-RED flow remains on the edge computer. The bridge sends signed events to AWS IoT Core with an X.509 certificate. IoT rules send shelf and cold chain events to SQS. ECS workers consume them and store results in MongoDB Atlas. CloudFront serves the portal from private S3 and proxies `/api/*` over HTTPS to the API domain. CloudFront does not cache API responses.

## Prepare the account:

1. Create an ECR repository. Record its full URI.
2. Select a VPC with two public subnets and two private subnets. The private subnets need NAT egress. Give the NAT gateway a fixed public IP. Allow that IP in Atlas Network Access.
3. Create an Atlas database user with only the database permissions this application needs. Store the full `mongodb+srv` URI as a plaintext string in AWS Secrets Manager. Store a separate random signing key and API token key there. Each key needs at least 32 characters. Never put their values in GitHub variables, screenshots or source files.
4. Create or use a Route 53 public hosted zone and a domain name for the API, such as `shelfsense.example.com`. Request an ACM certificate in the deployment region for that name. Complete DNS validation before deployment.
5. Create a GitHub OIDC deployment role with the needed ECR, CloudFormation, IAM, ECS, SQS, SNS, IoT, ALB, Route 53 and CloudWatch permissions. Restrict its trust policy to this repository and the `production` environment. Add an approval rule to that environment if required.

Set these GitHub `production` environment variables: `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `ECR_REPOSITORY_URI`, `STACK_NAME`, `VPC_ID`, `PUBLIC_SUBNET_A`, `PUBLIC_SUBNET_B`, `PRIVATE_SUBNET_A`, `PRIVATE_SUBNET_B`, `API_CERTIFICATE_ARN`, `API_DOMAIN_NAME`, `HOSTED_ZONE_ID`, `MONGO_SECRET_ARN`, `SIGNING_SECRET_ARN` and `API_AUTH_SECRET_ARN`. The last three are secret ARNs, not secret values.

The workflow in `.github/workflows/deploy-aws.yml` runs tests, builds and pushes an image to ECR, asks CloudFormation to validate the template, then deploys the stack. It uses the pushed image digest. It uploads `public/` to the private S3 bucket and waits for a CloudFront invalidation. A deployment is complete only when the stack status is `CREATE_COMPLETE` or `UPDATE_COMPLETE`, the ECS services are healthy, and both the API and CloudFront portal respond.

## Connect Node-RED to AWS IoT Core:

Create an active AWS IoT certificate and save its certificate and private key under the ignored `iot-certs/` directory. Download Amazon Root CA 1 from the official Amazon Trust Services repository. Attach the stack output `BridgeIotPolicyName` to the certificate. The policy allows one client ID, `shelfsense-bridge`, to publish only under `shelfsense/events/*`. Set `IOT_ENDPOINT` to the AWS IoT data endpoint. Set `IOT_CERT_DIR` to the certificate directory.

Create a local `.env` from `.env.example`. Set `MQTT_USERNAME`, `MQTT_PASSWORD`, `EVENT_SIGNING_REQUIRED=true`, `EVENT_SIGNING_SECRET` and `NODE_RED_ADMIN_PASSWORD_HASH`. The signing key must equal the value stored in AWS Secrets Manager. The API token key is separate. Generate the Node-RED password hash with `node-red admin hash-pw` and copy the hash only.

Run:

```bash
docker compose --profile aws-edge up --build -d
docker compose ps
docker compose logs --tail=50 node-red iot-bridge
```

Check that Node-RED shows the raw shelf, POS and fridge inputs and the event and dead letter outputs. Publish the small demo first:

```bash
docker compose --profile demo run --rm simulator
```

The IoT bridge must log that it is ready. The four ECS workers must be running. Check the Atlas collections `stock_events`, `stock_levels`, `orders`, `deliveries` and `coldchain`. The SNS email subscription, if configured, must be confirmed by its recipient before email notifications can arrive.

## Capture the scaling comparison:

The tutor asked for a before and after comparison with latency, throughput and resource use. Keep the workload shape and CloudWatch time range equivalent in both runs. Give each run a unique ID so its Atlas records can be separated.

1. Run the GitHub deployment workflow with `inventory_max_tasks=1`. Wait until all ECS services are healthy. Capture the stack status and one running inventory task.
2. Run this workload. Capture its JSON result and clock time.

```bash
RUN_ID=baseline01 STORES=20 SHELVES_PER_STORE=50 BURSTS=10 docker compose --profile workload run --rm cloud-workload
```

3. Capture CloudWatch SQS queue depth, ECS inventory desired and running task count, CPU and memory use, and the `queue_batch` log rows. Capture the Atlas query result below.
4. Run the workflow again with `inventory_max_tasks=4`. Wait for a healthy stack. Run the same workload with `RUN_ID=scaled01`.
5. Capture the same metrics. Confirm the desired and running inventory task count rose above one. If it did not, report that scaling was not observed. A CloudFormation setting alone is not scaling evidence.

Use CloudWatch Logs Insights on the inventory log group:

```text
fields @timestamp, service, processed, durationMs
| filter kind = "queue_batch" and service = "inventory"
| stats sum(processed) as events, sum(processed)/60 as eventsPerSecond by bin(1m)
```

Use the CloudWatch `AWS/SQS` metric `ApproximateNumberOfMessagesVisible` for queue depth. Use ECS Container Insights for CPU and memory. Use the Application Auto Scaling activity history and ECS service task count for scale events. Compare the same period length for both runs.

In Atlas, select the `shelfsense` database and run this in `mongosh`. Change the run ID each time. `wallTs` is the raw sensor time and `appliedAt` is the inventory commit time.

```javascript
const runId = 'baseline01';
const rows = db.stock_events.find({
  status: 'APPLIED',
  'event.data.runId': runId
}, { event: 1, appliedAt: 1 }).toArray();
const latencies = rows.map(row => row.appliedAt - row.event.data.wallTs)
  .filter(Number.isFinite).sort((a, b) => a - b);
const p95 = latencies.length ? latencies[Math.ceil(latencies.length * 0.95) - 1] : null;
printjson({ runId, processed: latencies.length, p95LatencyMs: p95,
  maximumLatencyMs: latencies.at(-1) ?? null });
const alerts = db.coldchain.find({ 'data.runId': runId }).toArray();
printjson({ coldchainAlerts: alerts.length,
  coldchainLatencyMs: alerts.map(row => row.receivedAt - row.data.wallTs) });
```

The workload expects `20 × 50 × 11 = 11000` stock events and `40` cold chain transitions. It sends `21060` raw MQTT messages. Check actual counts and explain missing or duplicate events. Do not use the in process load test as AWS evidence.

## Capture the security check:

Save one screenshot or command result for each control: HTTPS certificate and domain, private ECS subnet and task security group, Secrets Manager references in the task definition, restricted IoT policy, encrypted SQS queues, private S3 access through CloudFront, API response without a token returning 401, wrong role returning 403, and a valid role token showing only its assigned store. Hide token values, certificate private keys and the Atlas URI. The token tool uses a one hour expiry:

```bash
API_AUTH_SECRET='<read securely from Secrets Manager>' npm run auth-token -- manager store-01
```

Paste the generated token into the portal password field. Do not include it in the report. Run `npm run security-check` and `npm audit --omit=dev --audit-level=high` for source and dependency evidence.

## Current verification boundary:

The template, workflow and AWS transport have local tests. They still need a real CloudFormation validation, deployment and live service check in your AWS account. A private NAT route, Atlas allowlist, ACM certificate, Route 53 zone, ECR repository, OIDC role, Secrets Manager values and IoT certificate are external prerequisites.
