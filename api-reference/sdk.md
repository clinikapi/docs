# ClinikAPI TypeScript SDK Reference

The official TypeScript SDK for interacting seamlessly with ClinikEHR's Managed FHIR Engine. Our SDK wraps the verbose HL7 FHIR R4 standard in a developer-friendly abstraction.

## Installation

```bash
npm install @clinikehr/sdk
```

## Initialization

```typescript
import { Clinik } from '@clinikehr/sdk';

const clinik = new Clinik('your_live_api_key');
```

---

## `clinik.patients`

### `create(data: PatientCreateRequest)`

Securely creates a patient via ClinikAPI. Data is strictly validated and routed to your isolated FHIR store.

**Parameters:**
*   `firstName` (string) - Patient's first name
*   `lastName` (string) - Patient's last name
*   `email` (string) - Patient's contact email

**Returns:** 
Returns the created patient object including the newly generated AWS HealthLake `id`.

**Example:**
```typescript
const newPatient = await clinik.patients.create({
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com'
});
console.log('Created Patient ID:', newPatient.id);
```

---

### `update(id: string, data: Partial<PatientCreateRequest>)`

Safely updates an existing patient record. To avoid data destruction and concurrent modification conflicts, this uses a partial FHIR `PATCH` operation under the hood rather than a destructive `PUT` overwrite.

**Parameters:**
*   `id` (string) - The unique FHIR ID of the patient.
*   `data` (object) - An object containing only the fields you wish to update (e.g., just the `email`).

**Example:**
```typescript
const updatedPatient = await clinik.patients.update('7821-ax', {
  email: 'jane.new.email@example.com'
});
console.log('Updated Patient:', updatedPatient);
```

---

### `read(id: string, options?: ReadOptions)`

Intelligently queries a patient by ID and automatically pulls in associated clinical records via FHIR reverse-chaining (`_revinclude`).

**Parameters:**
*   `id` (string) - The unique FHIR ID of the patient.
*   `options` (object) - Configuration options.
    *   `include` (string[]) - Array of related FHIR Resource Types to include in the query (e.g., `['Encounter', 'Observation', 'Medication', 'Appointment']`).

**Returns:**
Returns a `PatientReadResponse` object. The SDK automatically destructures the raw FHIR `Searchset Bundle` into highly-typed arrays.

*   `patient` (Patient) - The primary patient resource.
*   `encounters` (Encounter[]) - Array of related visits.
*   `observations` (Observation[]) - Array of related vitals/labs.
*   `medications` (Medication[]) - Array of related medications.
*   `appointments` (Appointment[]) - Array of related upcoming or past appointments.

**Example:**
```typescript
const { patient, encounters, appointments } = await clinik.patients.read('7821-ax', {
  include: ['Encounter', 'Appointment']
});

console.log(`Loaded patient: ${patient.name[0].given[0]}`);
console.log(`They have ${encounters.length} completed visits and ${appointments.length} upcoming appointments.`);
```

---

## `clinik.intakes`

### `submit(data: any)`

Submits a completed patient intake form. The platform automatically orchestrates this payload into a standard FHIR `QuestionnaireResponse` resource and binds it to the specified patient context.

**Example:**
```typescript
const intakeResponse = await clinik.intakes.submit({
  patientId: "7821-ax",
  questionnaireId: "intake-v2",
  answers: [
    { linkId: "allergies", answer: ["Penicillin"] }
  ]
});
```

---

## `clinik.consents`

### `sign(data: any)`

Digitally signs and immutably logs a HIPAA/Treatment consent document using the official FHIR `Consent` resource.

**Example:**
```typescript
const consent = await clinik.consents.sign({
  patientId: "7821-ax",
  type: "HIPAA Privacy Notice",
  status: "active",
  signatureTimestamp: new Date().toISOString()
});
```
