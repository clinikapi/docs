# ClinikAPI Documentation

This repository contains the source files for the [ClinikAPI documentation](https://docs.clinikapi.com), powered by [Mintlify](https://mintlify.com).

## Auto-Synced

This repo is automatically synced from the private `clinikapi/clinikapi` monorepo via GitHub Actions. **Do not edit files here directly** — changes will be overwritten on the next sync.

To update the docs, edit files in the `docs/` folder of the main monorepo and push to `main`.

## Structure

```
docs/
├── mint.json                    # Mintlify configuration
├── introduction.mdx             # Landing page
├── quickstart.mdx               # Getting started guide
├── authentication.mdx           # Auth & API keys
├── errors.mdx                   # Error handling
├── api-reference/               # OpenAPI-linked API reference (14 resources)
│   ├── openapi.yaml             # OpenAPI 3.1 spec
│   └── {resource}/              # CRUD pages per resource
├── sdk/                         # TypeScript SDK reference
├── guides/                      # Usage guides (patients, encounters, webhooks, etc.)
├── components/                  # React component docs
└── legal/                       # BAA, privacy, terms
```

## 131 Pages

- 4 Getting Started pages
- 17 Guides (all 14 resources + webhooks, bulk ops, raw FHIR)
- 81 API Reference pages (CRUD for 14 resources + bulk + FHIR passthrough)
- 18 SDK Reference pages
- 10 React Component pages
- 3 Legal pages

## Links

- Live docs: [docs.clinikapi.com](https://docs.clinikapi.com)
- SDK: [npmjs.com/package/@clinikapi/sdk](https://www.npmjs.com/package/@clinikapi/sdk)
- React: [npmjs.com/package/@clinikapi/react](https://www.npmjs.com/package/@clinikapi/react)
- Dashboard: [dashboard.clinikapi.com](https://dashboard.clinikapi.com)
