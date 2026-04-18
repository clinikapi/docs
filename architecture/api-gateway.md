# ClinikAPI Edge Gateway Architecture

To guarantee the "sub-100ms FHIR execution" promise while maintaining rapid dashboard iteration, ClinikAPI utilizes a **Hybrid Edge-Cache Architecture**.

## The Execution Flow

1. **The Management Plane (Supabase)**
   The ClinikAPI Developer Dashboard is powered by Supabase. When a developer registers and hits "Generate API Key," the dashboard natively leverages Supabase Auth and inserts the new hashed API key into the Supabase PostgreSQL database.

2. **The Sync Pipeline (AWS DynamoDB Cache)**
   To prevent the API Gateway from taking a massive latency hit by querying Supabase across the public internet on every API call, we implement a sync pipeline. When a key is generated or revoked in Supabase, a webhook/edge function immediately pushes that updated key state into **AWS DynamoDB**, securely located inside our main VPC.

3. **The Data Plane (AWS HealthLake & Hono on AWS Lambda)**
   When the Clinik SDK executes `clinik.patients.create()`, the traffic hits our Hono.js Gateway running natively on **AWS Lambda**. 
   * **Sub-millisecond Validation:** The Gateway checks the `x-api-key` against DynamoDB directly within the AWS internal network. 
   * **Payload Routing:** If valid, it immediately transforms the request and pushes it to the customer's isolated AWS HealthLake Datastore using native AWS IAM permissions.

## Execution Environment: AWS Lambda vs Cloudflare Workers
We run the Hono.js gateway on **AWS Lambda** rather than Cloudflare Workers for three critical reasons:
1. **Zero Egress Latency:** Running Lambda inside the same AWS VPC as DynamoDB and HealthLake ensures that traffic never traverses the public internet, eliminating cross-platform latency penalties.
2. **Native IAM Security:** Lambda generates short-lived execution credentials that natively authenticate with HealthLake. If we used Cloudflare, we would have to inject long-lived, high-risk AWS IAM keys into Cloudflare's environment.
3. **No Cold-Start Penalty:** Hono.js is specifically designed to be ultra-lightweight, eliminating traditional Node.js Lambda cold-start delays.

## Why We Chose This
* **Developer Experience:** Supabase allows us to build the developer dashboard, billing integration, and analytics UI 10x faster than writing custom AWS AppSync resolvers.
* **0ms Latency Penalty:** By syncing keys to DynamoDB, our core FHIR engine never has to wait on an external database to validate an API key.
## Core Gateway Responsibilities

To protect the underlying AWS HealthLake infrastructure and ensure enterprise reliability, the Hono.js Edge Gateway serves as a "Zero-Trust" protective boundary. It is strictly responsible for executing the following operations before any traffic is passed to the clinical datastore:

### 1. Rate Limiting & Quota Management
The Gateway prevents DDoS and runaway developer scripts from ballooning AWS HealthLake costs by enforcing distributed rate limits at the edge.
* **Throttle Limits:** Enforced via `upstash/redis` or DynamoDB. If a developer exceeds their Stripe tier limits (e.g., >100 requests/second on the Pro plan), the gateway immediately drops the request with a `429 Too Many Requests`.
* **Cost Protection:** This guarantees a rogue script never triggers an unexpected $10,000 AWS bill.

### 2. Idempotency (Safe Retries)
Clinical APIs must guarantee that retrying a dropped connection doesn't accidentally double-bill a patient or schedule two identical appointments.
* **Idempotency Keys:** The Gateway strictly parses the `Idempotency-Key` HTTP header for all `POST` and `PATCH` operations.
* **Deduplication:** If a slow network causes the SDK to retry a `POST /Encounter`, the Gateway checks the Redis idempotency cache. If the key exists, it returns the previously cached `200 OK` response without executing a duplicate write on HealthLake.

### 3. Request Sanitization & Schema Validation
Before the Gateway executes FHIR tagging, it must forcefully ensure the payload is clean and non-malicious.
* **Payload Trimming:** The gateway explicitly strips unknown or deeply nested recursive JSON fields to prevent buffer overflow attacks.
* **Parameter Sanitization:** It scrubs URL search parameters to ensure developers haven't illegally injected malicious FHIR queries (e.g., wiping out `_security` constraints).
* **Strict Schema:** If the request payload fails basic FHIR structure validation at the edge, it returns a `400 Bad Request`, sparing HealthLake the computational overhead of rejecting the invalid payload itself.

### 4. Graceful Degradation & Intelligent Error Handling
A premier developer platform must never return cryptic cloud-provider stack traces to the end developer. The Gateway acts as a translation layer for all failure scenarios.
* **AWS Error Masking:** If HealthLake goes down or returns a raw AWS XML `502 Bad Gateway` error, the Hono gateway intercepts the error, masks the internal AWS stack trace, and gracefully degrades to return a standardized, human-readable JSON error (e.g., `"code": "datastore_unavailable"`).
* **Network Fallbacks:** If the primary HealthLake Region experiences an outage, the Gateway has the logic to temporarily queue requests in a "dead-letter queue" (DLQ) rather than permanently dropping the patient data.
* **Granular Developer Feedback:** When a developer submits a malformed FHIR payload, the Gateway parses the complex HealthLake rejection error and transforms it into a clean, Stripe-like error message (e.g., `"message": "The 'Patient' resource is missing the required 'name' array."`), ensuring incredible developer ergonomics.
