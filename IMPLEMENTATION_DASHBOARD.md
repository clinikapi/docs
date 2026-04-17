# Implementation: Developer Dashboard (`apps/dashboard`)

The dashboard is the central hub for developers to manage their clinical integrations.

## Tech Stack
- **Framework**: Next.js 15 (App Router).
- **Authentication**: Supabase Auth (Magic Links / Google).
- **Styling**: Tailwind CSS + Hugeicons.
- **State Management**: React Server Components + SWR.

## Core Workflows

### 1. API Key Management
- Users can generate `clrk_live_*` and `clrk_test_*` keys.
- Keys are hashed using `argon2` or `sha256` (with salt) before being stored in Supabase.
- Only the prefix and snippet are shown after creation.

### 2. Webhook Configuration
- Register absolute URLs for event notifications.
- Secret rotation for cryptographic signature verification (`X-Clinik-Signature`).
- Selection of specific event types (e.g., `patient.created`, `encounter.updated`).

### 3. Usage & Billing
- Visualization of API throughput.
- Integration with Stripe for metered billing based on active patient count or API calls.
- Credits management for startup tier users.
