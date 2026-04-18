# Hybrid SaaS Routing Implementation Guide

This document provides the technical implementation details for the "Architecture-as-a-Service" model, wherein developers can upgrade from the Pro (Multi-Tenant) plan to the Enterprise Vault (Datastore-per-Tenant) plan seamlessly.

## 1. Supabase Database Schema (Management Plane)

The developer dashboard will manage the billing tiers and store the underlying infrastructure mapping.

```sql
-- Create the Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  stripe_customer_id TEXT,
  plan_tier TEXT CHECK (plan_tier IN ('pro', 'enterprise')),
  
  -- The AWS HealthLake destination
  -- If 'pro', this points to the master shared datastore
  -- If 'enterprise', this points to their newly provisioned vault
  healthlake_endpoint_id TEXT NOT NULL
);

-- Create the API Keys table
CREATE TABLE api_keys (
  key_id TEXT PRIMARY KEY, -- e.g. clk_live_abcd1234
  organization_id UUID REFERENCES organizations(id),
  is_active BOOLEAN DEFAULT TRUE
);
```

## 2. DynamoDB Schema (Edge Synchronization)

To ensure the API Gateway achieves sub-100ms latency, the active keys from Supabase are synced to AWS DynamoDB via a webhook.

**Table Name:** `ClinikAPI_EdgeKeys`
*   **Partition Key (`PK`):** `api_key` (String)
*   **Attributes:**
    *   `org_id` (String)
    *   `plan_tier` (String)
    *   `datastore_id` (String)

## 3. The Hono.js Edge Gateway Logic

This is the core routing engine running on AWS Lambda. It intercepts all SDK requests, authorizes them via DynamoDB, and enforces the physical or logical boundaries based on the customer's payment tier.

```typescript
import { Hono } from 'hono';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const app = new Hono();
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });

app.use('*', async (c, next) => {
  const apiKey = c.req.header('x-api-key');
  
  // 1. Validate API Key against DynamoDB (Sub-millisecond lookup)
  const keyData = await dynamoClient.send(new GetItemCommand({
    TableName: 'ClinikAPI_EdgeKeys',
    Key: { 'api_key': { S: apiKey } }
  }));

  if (!keyData.Item) return c.json({ error: 'Unauthorized' }, 401);

  const orgId = keyData.Item.org_id.S;
  const planTier = keyData.Item.plan_tier.S;
  let datastoreId = keyData.Item.datastore_id.S;

  // 2. ENFORCE TEST VS LIVE ENVIRONMENT ROUTING
  // If the developer is using a test key, forcefully route to the Global Sandbox Database
  // This keeps enterprise production vaults completely clean of test data.
  if (apiKey.startsWith('clk_test_')) {
    datastoreId = process.env.GLOBAL_SANDBOX_DATASTORE_ID;
  }

  // 3. Set the routing context for the downstream AWS HealthLake proxy
  c.set('orgId', orgId);
  c.set('planTier', planTier);
  c.set('isTestKey', apiKey.startsWith('clk_test_'));
  c.set('healthlakeEndpoint', `https://healthlake.us-east-1.amazonaws.com/datastore/${datastoreId}/r4`);

  await next();
});

// Example Proxy Route: Reading Patients
app.get('/v1/patients/:id', async (c) => {
  const orgId = c.get('orgId');
  const planTier = c.get('planTier');
  const isTestKey = c.get('isTestKey');
  const url = new URL(`${c.get('healthlakeEndpoint')}/Patient/${c.req.param('id')}`);

  // 4. ENFORCE LOGICAL ISOLATION (For Pro Multi-Tenant & ALL Sandbox Users)
  // We MUST apply security filtering if they are on the shared 'pro' plan,
  // OR if they are using a test key (since all test keys share the global sandbox).
  if (planTier === 'pro' || isTestKey) {
    url.searchParams.append('_security', `organization|${orgId}`);
  }
  // ONLY if it is a 'clk_live_' key and the plan is 'enterprise' does it bypass 
  // logical isolation (because it is routing to a dedicated physical database).

  // 4. Proxy request using standard AWS SDK v3 Signature V4...
  const response = await fetch(url.toString(), { /* SigV4 Headers */ });
  return c.json(await response.json());
});

export default app;
```

## 4. The Upgrade Automation (Stripe Webhook)

When a customer upgrades in the billing portal from `$299/mo` to `$1499/mo`:
1.  Supabase instantly fires an Edge Function (Stripe Webhook).
2.  The Function triggers an AWS Step Function that executes: `healthlake:CreateFHIRDatastore`.
3.  Once the physical vault finishes provisioning (~15 mins), the backend executes a massive data-migration script (exporting the tenant's exact data from the Shared Datastore and importing to the Vault).
4.  The backend updates the `healthlake_endpoint_id` in Supabase to the new vault ID.
5.  DynamoDB is synced. The next time the SDK calls `clinik.patients.create()`, the data magically drops into the Enterprise Vault without the developer knowing.
