# ClinikAPI Roadmap

Building the operating system for modern healthcare integrations.

## Phase 1: Foundation (Q2 2026) - Current
- [x] **Monorepo Setup**: Turbo workspace configuration.
- [x] **Landing Page (`apps/www`)**: High-fidelity marketing site with interactive code snippets.
- [x] **Dashboard (`apps/dashboard`)**: Initial workspace for user management.
- [x] **Core SDK (`packages/sdk`)**: Basic API client for clinik resources.
- [x] **Database Schema**: Supabase integration for API keys and webhooks.

## Phase 2: FHIR Gateway & AWS HealthLake (Q3 2026)
- [ ] **API Gateway**: V1 implementation of FHIR R4 proxy.
- [ ] **AWS HealthLake Provisioning**: Automated SST deployments for HealthLake datastores.
- [ ] **Identity Management**: OAuth2/OIDC support for clinical staff.
- [ ] **Transformation Layer**: JSON -> FHIR R4 mapping engine in Lambda.

## Phase 3: Developer Experience (Q4 2026)
- [ ] **Pre-built UI Components (`packages/react`)**: Drop-in appointment and patient components.
- [ ] **Webhook System**: Event-driven architecture using SNS/SQS.
- [ ] **CLI Tool**: `clinik-cli` for local testing and schema validation.
- [ ] **Documentation Portal**: Interactive API reference (Swagger/OpenAPI).

## Phase 4: Enterprise & Compliance (2027)
- [ ] **SOC2/ISO Compliance Automation**: Integrated audit logging.
- [ ] **Multi-region Support**: Data residency for Global health startups.
- [ ] **Custom FHIR Profiles**: Support for US Core and other local profiles.
- [ ] **Marketplace**: Third-party integration ecosystem.
