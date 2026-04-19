# FHIR Multi-Tenant Isolation Architecture

Managing secure, HIPAA-compliant clinical boundaries across thousands of clinics requires strict isolation. However, cloud provider billing models fundamentally dictate how this isolation is implemented.

## 1. The AWS HealthLake Challenge (Hourly Flat Fees)
AWS HealthLake charges a relatively high base rate (upwards of $150 to $400+ per month) **just for keeping a single Datastore running**, regardless of how much data is inside.
* If we deployed a dedicated Datastore for every single user/organization that signed up, we would lose hundreds of dollars per user.
* **The AWS Solution (Shared Multi-Tenancy):** Instead, ClinikAPI operates **two massive, shared HealthLake Datastores**: one for Sandbox (`clk_test`) and one for Production (`clk_live`). Our Hono Gateway enforces multi-tenancy dynamically. When Organization A queries its database, the gateway forcefully intercepts the FHIR query and appends logical security tags (like mapping `organization=OrgA_ID`) to ensure Organization A can **never** see Organization B's data. Everything safely lives in one centralized AWS pool, vastly reducing costs.

## 2. The Google Cloud Alternative (GCP Healthcare API)
Google Cloud Healthcare API takes a fundamentally different billing approach: **Consumption-Based**.
They charge pennies per GiB of storage and per 10k operations, with **no massive flat hourly fee** per FHIR store.
* **The GCP Solution (Datastore-per-Tenant):** If ClinikAPI migrated to Google Cloud, we *could* actually spin up a brand new, physically isolated FHIR dataset/store for every individual organization. Since empty stores cost virtually nothing, you could have 10,000 completely separate organizational vaults without going bankrupt.

## 3. The ClinikAPI Hybrid SaaS Strategy
To maximize profit margins while offering maximum compliance guarantees, ClinikAPI utilizes an **Architecture-as-a-Service** model mapped directly to Stripe subscription tiers.

### Tier 1: Pro Plan (Shared Multi-Tenant)
* **Infrastructure:** Maps to a massive, centralized AWS HealthLake Datastore.
* **Separation:** Logical. The Hono Edge Gateway forcefully injects `organization=OrgID` into every FHIR payload.
* **Cost Factor:** Extremely high-margin. Adding 100 organizations to this plan costs ClinikAPI practically $0 in extra AWS baseline fees.
* **Use Case:** Perfect for startups and mid-market organizations who want interconnected health intelligence.

### Tier 2: Enterprise Vault (Datastore-per-Tenant)
* **Infrastructure:** Maps to a dynamically provisioned, brand new AWS HealthLake Datastore specifically for that single customer.
* **Separation:** Physical. It is cryptographically impossible for data bleeding to occur.
* **Cost Factor:** The high enterprise subscription fee ($1,500+/month) easily absorbs the fixed ~$400/month AWS HealthLake penalty.
* **Use Case:** Designed for massive hospital networks and heavily regulated state entities that require physical data siloing and federated interoperability.

**The SDK Magic:** Because this routing logic is entirely handled at the Hono Edge Gateway, developers using the `@clinikapi/sdk` experience zero friction. If an organization upgrades from Pro to Enterprise, the backend automatically migrations their data to a physical vault, and their existing SDK code (`clinik.patients.create()`) continues working without a single code change.
