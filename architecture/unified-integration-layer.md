# The Unified Integration Layer (Connectivity Abstraction)

One of the primary value propositions of ClinikAPI is eliminating "Integration Fatigue." Traditionally, healthcare developers must integrate with 5-10 disparate vendors (Stedi, HealthGorilla, DrFirst, etc.), each with their own authentication, rate limits, and non-standard data formats.

ClinikAPI solves this by acting as a **Unified Clinical Proxy**.

## 1. Zero-Vendor Integration (The "Last Mile" Abstraction)

Developers **never** integrate directly with third-party vendors. Instead, they interact exclusively with the Clinik SDK using standard FHIR R4 resources. 

| Functional Area | Vendor (Behind the Scenes) | Clinik SDK Interface |
| :--- | :--- | :--- |
| **Insurance & Claims** | Stedi / Change Healthcare | `clrk.insurance.*` |
| **Prescriptions (eRx)** | DrFirst / DoseSpot | `clrk.medications.*` |
| **Labs & Diagnostics** | HealthGorilla / Quest / Labcorp | `clrk.labs.*` |
| **Identity Verification** | LexisNexis / ID.me | `clrk.patients.verify()` |

---

## 2. Gateway Transformation Engine

When a developer calls `clrk.labs.order()`, the request hits our Hono.js Edge Gateway. The platform then executes a **Vendor-Specific Relay**:

1.  **Normalization:** The Gateway receives a clean FHIR `ServiceRequest`.
2.  **Identity Resolution:** We retrieve the Organization's vendor-specific credentials (e.g., their Labcorp Account ID) from our encrypted vault.
3.  **Transformation:** We transform the FHIR R4 payload into the proprietary format required by the downstream vendor (e.g., HL7, specialized JSON, or SOAP).
4.  **Execution:** We perform the request on the developer's behalf.
5.  **Reverse Mapping:** When the vendor returns data (e.g., a PDF report or raw results), we map it back into a standard FHIR `DiagnosticReport` before returning it to the SDK.

---

## 3. Provider-Level Configuration (The "Switchboard")

Inside the **ClinikAPI Developer Dashboard**, headers/routing is handled via a "Switchboard" UI.

*   **Hot-Swapping Vendors:** If a developer wants to switch from DrFirst to DoseSpot for prescriptions, they simply update their credentials in the Clinik Dashboard. **The code in their application remains 100% unchanged.**
*   **Failover Logic:** ClinikAPI can provide "Intelligent Routing." If Quest is down, the Gateway can automatically route a lab order to Labcorp if the clinic has accounts with both.

---

## 4. The "One Signature" Unified Security Model

*   **Unified Auth:** Developers manage one API Key (`clrk_live_...`). ClinikAPI handles the complex Oauth2, JWT, and API-Key handshakes for the 10+ downstream vendors.
*   **Unified Billing:** Instead of 5 separate invoices from 5 separate companies, developers receive one unified invoice from ClinikAPI, with metered usage across all clinical services.

---

## 6. The Integration Ecosystem (Who builds what?)

This is a two-phase strategic model designed for maximum market penetration and ecosystem scaling.

### Phase 1: Clinik-Managed Adapters (High Performance)
Initially, **ClinikAPI builds the integrations**. Our core team develops high-performance "Adapters" (Hono.js micro-services) for the "Big Three" in every category:
*   **eRx:** DrFirst, DoseSpot.
*   **Labs:** HealthGorilla, Quest, Labcorp.
*   **Insurance:** Stedi, Change Healthcare.
This guarantees that developers have a "Tier 1" experience with the most common industry giants out of the box.

### Phase 2: The Open Connector Marketplace (Self-Service)
As ClinikAPI grows into the industry-standard developer platform, we shift to a **Marketplace Model**. 
Instead of us building to them, **the vendors build to us.**

*   **The Clinik Protocol:** We provide a standardized "Integration Specification." Any new vendor (e.g., a niche biotech startup or a specialized genomics lab) can build their own "Clinik Connector" that receives our standard FHIR R4 exports and transforms them into their internal format.
*   **Self-Service Onboarding:** Vendors submit their Connector for verification, and it instantly appears as a "One-Click Install" in our Developer Dashboard for 1,000+ clinical applications to use.

This hybrid approach ensures that we control the quality of critical integrations while allowing the "Long Tail" of healthcare services to join our data highway independently.






## NEW CONVERSATION

This is a product strategy question more than a code question. Let me give you my honest take as a solutions architect.

**The unified integration layer is the hardest part of your entire platform.** It's also the most valuable. Here's how to approach it without burning 18 months and $2M before shipping:

## The Phased Approach

**Don't build all adapters at once.** Pick ONE vertical, nail it, then expand.

### Phase 0: What You Have Now (Ship This First)
Your current platform is already valuable without vendor integrations. Developers get:
- Managed FHIR R4 storage (HealthLake)
- Multi-tenant isolation
- Type-safe SDK
- Pre-built UI widgets

This alone is a product. Ship it. Get paying customers. The integration layer is Phase 2.

### Phase 1: Labs (Start Here)
Labs is the best first integration because:
- Highest developer demand ("I need to order labs and get results back")
- Clearest FHIR mapping (ServiceRequest → DiagnosticReport)
- HealthGorilla already has a FHIR R4 API — you're not translating from HL7v2
- Results flow is async (webhook-friendly), not real-time blocking

**Architecture for Labs:**

```
Developer calls: clinik.labs.order({ patientId, code: '24331-1' })
  ↓
Hono route: POST /v1/labs/order
  ↓
1. Validate request (Zod)
2. Look up org's lab vendor config from api_integrations table
3. Get vendor credentials from encrypted vault
4. Transform FHIR ServiceRequest → vendor format
5. Send to vendor (HealthGorilla/Quest API)
6. Store a pending DiagnosticReport in HealthLake (status: 'registered')
7. Return the pending report ID to the developer
  ↓
[Later, async via webhook from vendor]
  ↓
8. Vendor sends results back to our webhook endpoint
9. Transform vendor results → FHIR DiagnosticReport + Observations
10. Update the report in HealthLake (status: 'final')
11. Fire webhook to developer's registered endpoint
```

### Phase 2: eRx (Prescriptions)
After labs works, prescriptions are next. DrFirst/DoseSpot have APIs. The flow is similar but synchronous — you send a prescription, get a confirmation back immediately.

### Phase 3: Insurance/Eligibility
Stedi is the cleanest here. They already have a modern JSON API. You'd wrap their eligibility check behind `clinik.insurance.checkEligibility()`.

## How to Build the Adapter Layer

The key architectural decision: **where do adapters live?**

**Option A: In the same Lambda (monolith)**
- Pros: Simple, one deployment, shared auth
- Cons: Cold starts get worse, vendor SDK dependencies bloat the bundle

**Option B: Separate Lambda per adapter (microservices)**
- Pros: Independent scaling, isolated failures, vendor-specific timeouts
- Cons: More infra, inter-service auth needed

**My recommendation: Option B with a shared adapter interface.**

You'd create a `packages/adapters/` directory with a standard interface:

```ts
interface VendorAdapter {
  name: string;
  category: 'labs' | 'erx' | 'insurance' | 'identity';
  
  // Outbound: ClinikAPI → Vendor
  sendOrder(fhirRequest: ServiceRequest, credentials: VendorCredentials): Promise<VendorResponse>;
  
  // Inbound: Vendor → ClinikAPI (webhook handler)
  handleWebhook(payload: unknown, signature: string): Promise<FhirResource[]>;
  
  // Status check
  checkStatus(orderId: string, credentials: VendorCredentials): Promise<string>;
}
```

Each vendor gets its own implementation file (`adapters/labs/healthgorilla.ts`, `adapters/erx/drfirst.ts`). The Hono route looks up which adapter to use from the org's `api_integrations` table and dispatches to it.

## What to Build Right Now

If you want to start laying the groundwork without committing to a specific vendor yet:

1. The `api_integrations` table already exists in your Supabase schema — it stores vendor credentials per org
2. Add a `ServiceRequest` FHIR resource type to the SDK (this is the standard "order" resource in FHIR R4)
3. Add a `/v1/labs/order` route that creates a ServiceRequest + pending DiagnosticReport
4. Add a `/v1/webhooks/inbound/:provider` route for receiving vendor callbacks

The actual vendor-specific transformation code can come later. The plumbing (routing, credential lookup, webhook handling) is what takes time to get right.

Want me to implement any of this, or would you rather focus on shipping the core platform first?