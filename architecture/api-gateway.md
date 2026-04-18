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
* **Path to Scale:** Because the keys already live in DynamoDB, migrating the entire developer portal to pure AWS in the future requires zero downtime for the actual API layer.
