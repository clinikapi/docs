# Comparison: ClinikAPI vs. SMART on FHIR

A common question from clinical developers is: *"How does ClinikAPI differ from the SMART on FHIR standard?"* While both utilize FHIR R4 as the data language, they serve fundamentally different architectural purposes.

## Summary Comparison Table

| Feature | SMART on FHIR | ClinikAPI |
| :--- | :--- | :--- |
| **Type** | An open-source **Standard** for UI integration. | A **Headless Infrastructure Platform**. |
| **Primary Use Case** | Building an app that lives *inside* Epic/Cerner. | Building a standalone health product/EHR. |
| **Discovery** | Developer must find 10,000+ hospital endpoints. | One Unified API URL. No discovery needed. |
| **Data Persistence** | None. You read/write to the hospital's database. | **Managed Clinical Storage** (AWS HealthLake). |
| **Integrations** | Limited to the EHR's internal data. | Unified Labs, eRx, and Insurance (Stedi/HG). |
| **Auth** | Patient/Provider context-based (OAuth2). | Developer-first API Keys & Org Secrets. |

---

## 1. Discovery vs. Unified Abstraction
*   **SMART on FHIR**: If you want your app to work at 5 different hospitals using SMART, you have to register your app at each hospital, manage 5 different client IDs, and implement discovery logic to find each hospital's specific FHIR base URL.
*   **ClinikAPI**: You integrate once. Our **Hono Gateway** handles the routing to different organizations and vaults behind the scenes. You call `GET /Patient` on one URL, and we handle the resolution of *where* that patient data actually lives.

## 2. UI Widgets vs. Headless SDKs
*   **SMART on FHIR**: Designed for "Launched Apps." It expects an iframe or a redirect inside an existing EHR UI.
*   **ClinikAPI**: Designed for **Headless Developers.** We give you the primitives (SDK, React Widgets, API) to build your own entire user experience from scratch. We don't dictate *where* your app lives.

## 3. Data Ownership & Sovereignty
*   **SMART on FHIR**: You are effectively a "guest" in the hospital's database. You cannot easily store your own custom clinical data or perform long-term analytics without syncing it to your own separate database (which creates a massive HIPAA/security burden).
*   **ClinikAPI**: Provides **Instant Zero-Trust Infrastructure.** Every developer gets their own isolated clinical vault (AWS HealthLake). ClinikAPI handles the database, the encryption at rest, and the HIPAA compliance so you can focus on your code.

## 4. Beyond the EHR (The "Last Mile" Problem)
SMART on FHIR only connects to the **EHR**. It does **not** connect you to:
*   **Stedi** for real-time insurance eligibility.
*   **HealthGorilla** for ordering labs at Quest/Labcorp.
*   **DrFirst** for electronic prescriptions.
**ClinikAPI abstracts these vendors into the same SDK.** We solve the "Last Mile" of clinical operations that the SMART standard doesn't touch.

## Conclusion
Use **SMART on FHIR** if you want to build a widget for doctors to use *inside* of Epic. 
Use **ClinikAPI** if you want to build the **next** Epic, a modern patient portal, or a specialized remote-care platform.
