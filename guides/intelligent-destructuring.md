# Guide: Intelligent FHIR Destructuring

Working with native FHIR APIs directly can be exceptionally cumbersome. When you query a resource and its relationships, exactly like a JOIN in SQL, FHIR returns a highly nested schema known as a **Searchset Bundle**.

## The Problem with Raw FHIR

Normally, if you ping the raw REST endpoint:
`GET /fhir/Patient/7821-ax?_revinclude=Encounter:subject`

FHIR returns a flat `entry` array mixing all the resource types together:

```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "entry": [
    { "resource": { "resourceType": "Patient", "id": "7821-ax" } },
    { "resource": { "resourceType": "Encounter", "id": "enc-1", "status": "finished" } },
    { "resource": { "resourceType": "Encounter", "id": "enc-2", "status": "planned" } }
  ]
}
```

To use this data in a UI dashboard, a frontend engineer has to manually map, filter, and cast the objects before they are actually usable. This wastes time, drops TypeScript safety, and introduces runtime errors.

## The ClinikAPI Solution

The **Clinik SDK** acts as an intelligent parser middleware. It shields you from bundle management entirely. 

When you use the `clinik.patients.read(id, { include: [...] })` method, the SDK automatically handles the query execution and iterates over the bundled results, pushing each resource type into distinct, strongly-typed arrays.

```typescript
// Look how beautiful this is.
const { patient, encounters, observations, appointments } = await clinik.patients.read('7821-ax', {
  include: ['Encounter', 'Observation', 'Appointment']
});
```

Under the hood, the SDK processes the `rawBundle.entry` array via an intelligent switch statement based on the `resourceType`. It guarantees that `encounters` is always an array of typed `Encounter` objects, skipping the hassle.

### Supported Includes
Currently, the intelligent destructuring engine natively handles:
- `Encounter` -> `encounters[]`
- `Observation` -> `observations[]`
- `Medication` -> `medications[]`
- `Appointment` -> `appointments[]`

More resources will automatically be added as the platform expands!
