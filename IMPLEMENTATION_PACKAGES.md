# Implementation: Shared Packages

The ClinikAPI monorepo provides shared logic and UI components through the `packages/` directory.

## 1. Core SDK (`packages/sdk`)
- **Technology**: TypeScript, Fetch API.
- **Pattern**: Resource-based client.
- **Example**:
  ```typescript
  const clinik = new Clinik(apiKey);
  await clinik.patients.list();
  ```
- **Build System**: Tsup / Rollup for ESM+CJS output.

## 2. React Components (`packages/react`)
- **Technology**: React 18+, Tailwind CSS, Framer Motion.
- **Design System**: Consistent with ClinikEHR (Hugeicons, Inter font).
- **Core Components**:
    - `PatientDashboard`: Fully managed view of a patient resource.
    - `ClinicalProvider`: Context provider for managing authentication and API state.
- **Styling**: Uses `@clinikapi/tailwind-config` (shared) to ensure design consistency.

## 3. Shared Configs
- **Tailwind Config**: Centralized tokens for colors, typography, and shadows.
- **TypeScript Config**: Standardized compiler options for strict safety.
- **ESLint/Prettier**: Shared linting rules to maintain code quality across apps.
