# ClinikAPI Documentation

Source files for the [ClinikAPI documentation](https://docs.clinikapi.com), powered by [Mintlify](https://mintlify.com).

## Auto-Synced

This directory is automatically synced from the private `clinikapi/clinikapi` monorepo via GitHub Actions. Do not edit files here directly — changes will be overwritten on the next sync.

To update the docs, edit files in the `docs/` folder of the main monorepo and push to `main`.

## Structure

```
docs/
├── mint.json                    # Mintlify configuration and navigation
├── introduction.mdx             # Landing page
├── quickstart.mdx               # Getting started guide
├── authentication.mdx           # Auth and API keys
├── errors.mdx                   # Error handling
├── api-reference/
│   ├── overview.mdx             # API reference landing
│   ├── openapi.yaml             # OpenAPI 3.1 spec (62 resources)
│   └── fhir/                    # FHIR passthrough docs
├── sdk/                         # TypeScript SDK reference (62 namespaces)
├── guides/                      # Usage guides by resource
├── components/                  # React component docs (9 widgets)
└── legal/                       # BAA, privacy, terms
```

## 62 FHIR R4 Resources

Organized by domain:

| Domain | Resources |
|--------|-----------|
| Individuals | Patient, Practitioner, PractitionerRole, Person, FamilyMemberHistory |
| Entities | Organization, Location, HealthcareService, Device |
| Clinical — Summary | Condition, AllergyIntolerance, ClinicalImpression |
| Clinical — Diagnostics | Observation, DiagnosticReport, Specimen, ImagingStudy, Media, RiskAssessment |
| Clinical — Medications | Medication, MedicationRequest, MedicationDispense, MedicationStatement, MedicationKnowledge, Immunization, ImmunizationEvaluation, ImmunizationRecommendation, NutritionOrder, VisionPrescription |
| Clinical — Care Provision | Encounter, CarePlan, CareTeam, Goal, ServiceRequest, DeviceRequest, DeviceUseStatement, Consent |
| Documents and Forms | DocumentReference, Composition, QuestionnaireResponse |
| Scheduling | Appointment, AppointmentResponse, Schedule, Slot |
| Workflow | Task, ActivityDefinition, PlanDefinition |
| Financial — Billing | Account, ChargeItem, Invoice |
| Financial — Claims | Claim, ClaimResponse, ExplanationOfBenefit, PaymentNotice, PaymentReconciliation |
| Financial — Insurance | Coverage, CoverageEligibilityRequest, CoverageEligibilityResponse, EnrollmentRequest, EnrollmentResponse |
| Quality and Audit | Measure, MeasureReport, AuditEvent |

## Page Count

- 4 Getting Started pages
- 65 Guides (62 resources + webhooks, bulk ops, raw FHIR)
- 315+ API Reference pages (CRUD+search for 62 resources + bulk + FHIR passthrough)
- 66 SDK Reference pages (installation, client, 62 resources, FHIR passthrough, error handling)
- 10 React Component pages
- 3 Legal pages

## Links

- Live docs: [docs.clinikapi.com](https://docs.clinikapi.com)
- SDK: [npmjs.com/package/@clinikapi/sdk](https://www.npmjs.com/package/@clinikapi/sdk)
- React: [npmjs.com/package/@clinikapi/react](https://www.npmjs.com/package/@clinikapi/react)
- Dashboard: [dashboard.clinikapi.com](https://dashboard.clinikapi.com)
