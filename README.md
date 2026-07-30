# AI Voice Agent — Appointment Booking & Lead Qualification

Node.js/TypeScript backend for a Retell-powered dental clinic phone agent: live booking via Google Calendar, lead qualification, post-call automation through n8n (HubSpot, SMS, email), and a review dashboard.

## Status

See [`progress.md`](./progress.md) and [`docs/implementation-phases.md`](./docs/implementation-phases.md).

**Current gate:** Phase 1 — Foundation

## Quick start (Phase 1)

### Prerequisites

- Node.js 20.19+ recommended (20.9+ minimum)
- Docker Desktop (for local Postgres)

### Setup

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run migrate
npm run dev
```

Health check: `GET http://localhost:3000/health`

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start API with reload |
| `npm run migrate` | Apply DB migrations |
| `npm test` | Unit + DB constraint tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |

## Docs

- [`docs/architecture.md`](./docs/architecture.md)
- [`docs/database-schema.md`](./docs/database-schema.md)
- [`docs/voice-agent-tool-contracts.md`](./docs/voice-agent-tool-contracts.md)
- [`docs/n8n-event-map.md`](./docs/n8n-event-map.md)
- [`docs/system-prompts.md`](./docs/system-prompts.md)
- [`docs/lead-rubric.md`](./docs/lead-rubric.md)
