# Gateway Security & IDOR Prevention Architecture

When building a high-scale clinical platform via a "Shared Multi-Tenant" architecture, the risk of cross-tenant data leakage is immense. This document outlines ClinikAPI's strict security mechanisms for preventing data breaches and avoiding fundamental API vulnerabilities.

## The Threat: IDOR (Insecure Direct Object Reference)
A common (and dangerous) approach to multi-tenancy is relying on the client (the SDK) to specify their organization.

**The Vulnerability:**
If the SDK expected developers to pass an organization ID:
`clinik.patients.read('patient-123', { organizationId: 'Org_A' })`

A malicious actor could easily intercept or modify the code executing on their servers:
`clinik.patients.read('patient-123', { organizationId: 'Org_B' })`

If the backend trusted the SDK's payload, the malicious actor would instantly steal Organization B's entire database. In cybersecurity, this is known as an IDOR attack. **ClinikAPI fundamentally operates on a Zero-Trust relationship with the SDK.**

## The Solution: Gateway Authentication Resolution
ClinikAPI completely strips organization routing logic from the SDK surface. The SDK only transmits a single secret: the `x-api-key` (e.g., `clk_live_abcd...`).

1. **Blind Transmission**: The SDK simply requests `GET /Patient`.
2. **Secure Resolution**: The Hono API Gateway intercepts the request, blocks it, and runs an internal query against our heavily protected AWS DynamoDB cache.
3. **Implicit Trust**: DynamoDB maps that specific hashed API key directly to a specific `Organization_ID`. The Gateway forcefully assigns this context server-side, making spoofing mathematically impossible. 

## FHIR Security Enforcement: Logical Tags
Once the API Gateway knows the correct `Organization_ID`, it completely alters the FHIR payload before forwarding it to the shared AWS HealthLake Datastore.

### 1. Intercepting Writes (Preventing Orphaned Data)
When the SDK requests `POST /Patient` with a JSON payload, the Gateway cracks open the payload and **forcefully injects standard FHIR security labels** (`meta.security`) before execution:

```json
{
  "resourceType": "Patient",
  "meta": {
    "security": [
      {
        "system": "https://clinikapi.com/security",
        "code": "ORG_UUID_HERE"
      }
    ]
  },
  "name": [{"given": ["Jane"]}]
}
```
This permanently "tattoos" the record to that organization.

### 2. Intercepting Reads (Preventing Data Bleed)
When the SDK requests a search (`GET /Patient`), the Gateway forcefully appends standard FHIR search constraints onto the backend AWS request query parameters:

`GET /Patient?_security=https://clinikapi.com/security|ORG_UUID_HERE`

AWS HealthLake natively evaluates this FHIR constraint layer, instantly filtering the results of the massive shared database to guarantee only appropriately tattooed records are ever returned to the requesting developer.

---

## The Magic of Interoperability (Cross-Tenant Data Sharing)

What happens if Organization A wants to securely share patient records with Organization B? Because they live on the Shared Multi-Tenant architecture, building an integration is completely frictionless.

**The Secure 'Invite Token' Authorization Flow:**
To protect B2B confidentiality (preventing a public directory of all organizations exposing customer lists), ClinikAPI utilizes a highly secure point-to-point Token Handshake:
1. **Token Generation:** Organization A logs into their Developer Dashboard and generates a secure, one-time "Connection Code" (e.g. `conn_8f92bd`).
2. **The Handshake:** Organization A safely emails that code to the administrator at Organization B. Organization B logs into their own Dashboard, pastes the `conn_8f92bd` token into the "Add Integration" portal, and explicitly clicks "Authorize Read/Write Access".
3. **The DynamoDB Update:** Supabase logs this agreement and updates Organization A's profile in the DynamoDB Edge Cache to reflect their newly expanded permissions: `authorized_scopes: ["OrgA_ID", "OrgB_ID"]`.
3. **The Gateway Magic:** The next time Organization A runs `clinik.patients.read('patient-123')`, the Hono Gateway verifies their expanded permissions. Instead of restricting them to just their own data, Hono dynamically expands the FHIR query constraint:
   `GET /Patient?_security=OrgA_ID,OrgB_ID`
4. **Instant Interoperability:** Without writing a single line of backend integration code, Organization A's SDK instantly starts returning merged patient records from both facilities safely and securely.

### What about Enterprise Accounts?
If an Enterprise customer (who paid for a physically separated, dedicated AWS HealthLake Vault) wants to integrate with Organization A, it requires more work. Because their data physically lives in a different database URL, the Hono Gateway has to execute a **Federated Query**. It queries the Shared Database and the Enterprise Database simultaneously, merges the two JSON responses in memory, and then returns the single unified response to the SDK.

---

## Performance Impact & Edge Cases

A frequent architectural concern is whether the Gateway interception process impacts latency or introduces brittle routing.

### 1. The Interception Latency Penalty
Because AWS Lambda, DynamoDB, and HealthLake operate within the same ultra-fast AWS Region backbone, the actual latency penalty for this interception is practically imperceptible:
* **Lookup Phase:** DynamoDB sub-millisecond point-reads take ~1-2ms.
* **Compute Phase:** Hono intercepting, parsing, injecting `meta.security`, and re-stringifying a standard FHIR JSON payload takes ~0.5ms.
* **Total Penalty:** Usually **< 5ms**. 

### 2. Edge Case: Massive FHIR Bundles (Historical Imports)
**The Problem:** If a clinic uses the SDK to upload a massive 10MiB FHIR `Bundle` containing 5,000 historical records, the API Gateway has to parse the entire 10MiB tree into memory to inject `meta.security` into every record. This CPU spike can exhaust Lambda memory and introduce heavy latency (hundreds of milliseconds).
**The Solution:** The API Gateway should enforce upload limits (e.g., standard API routes handle 1MB max). For massive historical syncs, developers must use a secondary async Bulk Import API which dumps the raw file into AWS S3, triggering an SQS background worker to slowly process and tag the records.

### 3. Edge Case: Throttling & DDoS
**The Problem:** If a client script goes rogue and fires 10,000 requests per second, querying DynamoDB 10,000 times will trigger AWS read-capacity throttling and potentially crash the Gateway execution.
**The Solution:** The Gateway utilizes ephemeral Lambda RAM caching (LRU Cache). Once an API Key is validated by DynamoDB, it is held in RAM for 60 seconds. 99% of requests skip DynamoDB entirely, achieving 0ms latency lookup.

### 4. Edge Case: Conflicting Query Parameters
**The Problem:** If a developer's SDK maliciously or accidentally tries to explicitly pass `&_security=fake_org`, and the Gateway uses dumb string concatenation (`url += '&_security=real_org'`), HealthLake might fail parsing multiple parameters.
**The Solution:** The Hono Gateway must utilize strict URL parsing (`URLSearchParams`). It systematically deletes any existing `_security` keys from the incoming request before forcefully applying the authenticated one, guaranteeing clean URL execution.
