# AI Voice Agent — Appointment Booking & Lead Qualification

Node.js/TypeScript backend + React web client for a Retell-powered dental clinic voice agent.

## Status

See [`progress.md`](./progress.md) and [`docs/implementation-phases.md`](./docs/implementation-phases.md).

**Current focus:** Phase 2 — Retell web call frontend connected; custom tools next.

## Quick start

### Prerequisites

- Node.js 20.9+ (20.19+ recommended)
- Supabase Postgres (or local Docker)
- Retell AI account + published agent

### Backend

```bash
cp .env.example .env
# Fill DATABASE_URL (Session pooler), RETELL_API_KEY, RETELL_AGENT_ID, ENABLE_RETELL=true
npm install
npm run migrate   # if using local migrations
npm run dev
```

Health: `GET http://localhost:3000/health`

### Web call frontend

```bash
npm --prefix web install
npm run dev:web
```

Open `http://localhost:5173` → **Start call** (allow microphone).

Or run both:

```bash
npm run dev:all
```

`POST /api/web-call` creates a Retell access token on the server (API key never ships to the browser).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | API (port 3000) |
| `npm run dev:web` | Vite frontend (port 5173) |
| `npm run dev:all` | API + frontend |
| `npm test` | Backend tests |
| `npm run typecheck` | Backend TypeScript |

## Docs

- [`docs/architecture.md`](./docs/architecture.md)
- [`docs/system-prompts.md`](./docs/system-prompts.md)
- [`docs/voice-agent-tool-contracts.md`](./docs/voice-agent-tool-contracts.md)
- [`docs/phase-2-local-testing.md`](./docs/phase-2-local-testing.md)
