# External Integrations & Data Connectivity

This document architecturally defines how third-party developers, startups, and enterprise partners integrate with existing clinical data hosted within the ClinikEHR ecosystem.

## 1. Clinik Connect (The Authorization Flow)

For developers building applications meant to be used by *existing* ClinikEHR customers, we utilize an OAuth2-inspired "Connect" flow. This ensures no API Keys are ever shared between the organization and the developer.

### The Handshake Workflow:
1.  **Initiation:** The developer's app redirects the healthcare administrator to the ClinikAPI Authorization Portal:
    `https://clinikapi.com/connect?client_id=[APP_ID]&scope=patients.read,labs.write`
2.  **Consent:** The administrator logs into their ClinikEHR dashboard, selects the specific **Organization (OrgID)** they wish to authorize, and approves the requested permissions.
3.  **Callback:** ClinikAPI redirects back to the developer's `redirect_uri` with a temporary code.
4.  **Exchange:** The developer exchanges the code for a permanent `AccessToken`.

---

## 2. Token-Based Routing (Hono Gateway)

When an integrated app makes a request, the Hono Edge Gateway treats the `Authorization: Bearer [TOKEN]` just like a standard API Key, but with **Dynamic Scope Enforcement**.

*   **Internal Resolution:** The Gateway resolves the Token in the DynamoDB Cache to find the linked `OrgID` and `ApprovedScopes`.
*   **Forceful Filtering:** Even if the developer tries to query all patients, the Gateway forcefully appends the `_security` tag filter for that specific `OrgID` only.

---

## 3. The "Clinik Backbone" (Master Registry)

For users trying to integrate into the "Main ClinikEHR" infrastructure (global practitioners, pharmacy directories, or insurance payor lists), we provide a **Read-Only Public Registry**.

### Registry Access:
*   **Global Resources:** Data like `Practitioner`, `Organization` (Healthcare ServiceProviders), and `Location` (Clinics/Pharmacies) are stored in a non-isolated "Backbone" HealthLake vault.
*   **Scoped Access:** All API Keys have default `READ` access to the Backbone for lookups (e.g., finding a doctor's NPI or a pharmacy's NCPDP id) but `ZERO` write access to maintain directory integrity.

---

## 4. Webhooks & Real-time Sync

Integrations are often event-driven. Developers can register webhook listeners via the Dashboard to receive real-time updates when data changes within an authorized organization.

*   **Security:** Every webhook payload is signed with a unique `HMAC-SHA256` signature.
*   **Guarantee:** We guarantee **at-least-once delivery** for all clinical events (e.g., `lab_result.finalized`, `appointment.booked`).

---

## 5. Low-Code & AI Automation Connectors

To empower healthcare providers who aren't developers but need to automate workflows (e.g., "When a lab is final, notify me on Slack" or "Send this patient summary to Gemini for an AI breakdown"), we provide **Integration Secrets**.

### The Automation Flow (Zapier / n8n / AI Agents):
1.  **Secret Generation:** A Provider Admin logs into their **ClinikEHR Settings** and generates an **Integration Secret** (e.g., `clrk_auto_...`). 
2.  **Scoping:** These secrets are forcefully scoped to that exact `OrgID` and cannot be used for cross-tenant operations.
3.  **Tooling Integration:**
    *   **Zapier/n8n:** Providers paste the secret into the official "ClinikAPI Connector". The connector handles the FHIR complex headers, while the provider just interacts with simple JSON triggers (e.g., "New Patient created").
    *   **AI Agents (OpenAI/Gemini):** The secret is passed to the AI as a "Tool" or "Function Call" credential. The AI can then securely query `clinik.patients.read()` to retrieve the context it needs for a medical summary.

### Webhook Forwarding:
Providers can bypass the developer dashboard and register "Self-Service Webhooks" directly in their EHR settings to pipe event data to external relay URLs (e.g., a Zapier Webhook Trigger), enabling instant automation without a single line of code.
