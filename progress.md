# AI Voice Agent — Project Progress

## Project Summary

AI-powered phone agent for a dental clinic (sample business) that handles inbound calls, checks real-time Google Calendar availability, books appointments, qualifies leads, hands off to a human when needed, and triggers post-call automation (HubSpot, SMS/email, transcript storage, sentiment/outcome logging) via n8n. Voice: Retell AI. Backend: Node.js/TypeScript. DB: Supabase/Postgres.

## Current Status

- Current phase: **Phase 2 — Live Voice Path** (Google Calendar code ready; needs GCP credentials)
- Overall completion estimate: ~50%
- Last updated: 2026-08-03

## Architecture Decisions

| Decision | Selected Option | Reason | Date |
|---|---|---|---|
| Voice platform | Retell AI | Barge-in, webhooks, custom tools | 2026-07-30 |
| Scheduling | Google Calendar | Real-time freebusy + event write | 2026-07-30 |
| CRM | HubSpot | Free tier, simpler than Salesforce | 2026-07-30 |
| Database | Supabase project `voice-agent` (`xffzulhvfqcigbmbnhcv`, ap-south-1) | Active hosted Postgres + RLS | 2026-07-30 |
| Local DB access | Session pooler (`aws-1-ap-south-1.pooler.supabase.com`) | Direct host is IPv6-only on free tier | 2026-07-30 |
| Automation | n8n (Docker) | Post-call CRM/SMS/email without blocking calls | 2026-07-30 |
| Delivery model | 5 gated phases | Spec lock → foundation → voice → automation → harden | 2026-07-30 |
| RLS | Required in Phase 1 gate | Cheap now; hard to retrofit later | 2026-07-30 |
| Slot exclusivity | Calendar re-check + DB exclusion constraint | Unique on `calendar_event_id` alone does not prevent double-book | 2026-07-30 |
| Frontend web call | Vite React + `retell-client-js-sdk` | Browser test before phone + tools | 2026-08-01 |
| Calendar auth | Service account + shared calendar | Server-to-server; no user OAuth in call path | 2026-08-03 |

## Environment and Accounts

- [x] Voice platform configured (Retell AI) — agent + web call API verified
- [ ] Phone number configured — Phase 2 (optional after web call)
- [x] AI model API configured (via Retell)
- [ ] Calendar API configured — Phase 2 (code ready; enable with GCP SA + `.env`)
- [ ] CRM configured (HubSpot) — Phase 3
- [ ] Twilio SMS configured — Phase 2 / Phase 3
- [ ] SendGrid configured — Phase 2 / Phase 3
- [x] Database configured (Supabase `voice-agent` / `xffzulhvfqcigbmbnhcv`)
- [x] Local app `DATABASE_URL` (Session pooler) working
- [ ] n8n configured — Phase 3
- [ ] Deployment environment configured — Phase 4

## Phase 0: Spec Lock

- [x] Complete

## Phase 1: Foundation

- [x] Repository initialized
- [x] Project structure created
- [x] Environment variables documented (phase-aware)
- [x] Database migrations applied (DDL + RLS + overlap exclusion + seed)
- [x] Development tools configured (lint, format, test, CI)
- [x] Health check verified locally (`200` + `database: up`) — 2026-07-30
- [x] Env fail-closed verified (unit tests)
- [x] Idempotency unique constraints verified (SQL on Supabase)
- [x] Overlap exclusion verified (SQL on Supabase)
- [x] RLS negative test verified
- [ ] Health `503` when DB unreachable — deferred optional check (healthy path verified)

### Seeded business
- Name: Bright Smile Dental
- ID: `646d931b-a83c-4a68-837e-3d6f7167e351`
- URL: https://xffzulhvfqcigbmbnhcv.supabase.co

## Phase 2: Live Voice Path

- [x] Retell agent created + system prompt
- [x] Web frontend (`web/`) + `POST /api/web-call` (create-web-call returns access token)
- [x] Browser web call verified end-to-end by user (mic + greeting)
- [x] Custom function tools registered in Retell
- [x] Tool path verified (`checkAvailability` → `CALENDAR_UNAVAILABLE` before Calendar enable)
- [ ] Google Calendar credentials + live booking verified
- [ ] Mid-call sendConfirmation (Twilio/SendGrid)
- [ ] Retell call webhooks wired in dashboard
- [ ] Live booking call verified
- [ ] Live qualification call verified

### Phase 2 known limitation
Orphan Calendar↔DB reconciliation job ships in Phase 3. During Phase 2, manually verify Calendar vs `appointments` after ambiguous booking failures.

## Completed Work

### 2026-07-30

- Phase 1: Supabase project, migrations, RLS, constraints, Session pooler `DATABASE_URL`, health `200`
- Phase 2 scaffold: `POST /tools`, `POST /webhooks/retell`, lead scoring, DB-backed contact/lead/handoff/outcome tools

### 2026-08-01

- Added Retell web call path: `POST /api/web-call`, CORS, Vite React client in `web/`
- Verified create-web-call API returns `accessToken` for agent `agent_939b9ab29676675d8b13a4aea5`

### 2026-08-03

- Retell custom functions + ngrok path verified (`checkAvailability` logged)
- Google Calendar integration code: freebusy, create/update/delete, slot resolution, book/reschedule/cancel handlers
- Unit tests for slots + calendar env fail-closed

## In Progress

- Current task: User adds GCP service account + shares calendar, sets `ENABLE_CALENDAR=true`, verifies live slots/booking
- Blockers: Waiting on Google Calendar credentials in `.env`

## Issues and Blockers

| Issue | Impact | Proposed Solution | Status |
|---|---|---|---|
| Docker not on PATH | Local compose unavailable | Using Supabase instead | Resolved |
| Direct host IPv6-only | Direct URI unusable | Session pooler | Resolved |
| `DATABASE_URL` typo `postgresql:postgresql://` | Empty host | Fixed | Resolved |
| Password auth failures during setup | Blocked local health | Reset + Session pooler URI | Resolved |

## Test Results

| Test | Expected Result | Actual Result | Status | Date |
|---|---|---|---|---|
| loadEnv Phase 1 core | Loads | Pass | Pass | 2026-07-30 |
| Migrations / RLS / overlap / dedupe | Pass | Pass | Pass | 2026-07-30 |
| GET /health (healthy) | 200 database up | Pass | Pass | 2026-07-30 |
| POST /api/web-call | accessToken + callId | Pass | Pass | 2026-08-01 |
| Browser Start call → agent greeting | Hear agent | Pass | Pass | 2026-08-03 |
| Retell tool → `/tools` | checkAvailability logged | Pass | Pass | 2026-08-03 |
| Slot helpers unit tests | Pass | Pass | Pass | 2026-08-03 |
| Live Calendar checkAvailability | slots from GCal | Pending credentials | Pending | — |

## Latency Measurements

| Call Stage | Target | Actual | Status |
|---|---:|---:|---|
| End of caller speech to transcript | Under 500 ms | Not tested | Pending |
| Transcript to model response | Under 800 ms | Not tested | Pending |
| Model response to first audio | Under 500 ms | Not tested | Pending |
| Total perceived response latency | Under 1.5 seconds | Not tested | Pending |

## API and Integration Status

| Integration | Status | Last Test | Notes |
|---|---|---|---|
| Retell AI | Tools + web call OK | 2026-08-03 | Agent published; ngrok `/tools` working |
| Google Calendar | Code ready | 2026-08-03 | Needs SA + `ENABLE_CALENDAR=true` |
| HubSpot | Not configured | — | Phase 3 |
| Twilio SMS | Not configured | — | Phase 2+ |
| SendGrid | Not configured | — | Phase 2+ |
| Supabase/Postgres | Active + healthy locally | 2026-07-30 | Session pooler |
| n8n | Not configured | — | Phase 3 |

## Change Log

| Date | Change | Reason |
|---|---|---|
| 2026-07-30 | Spec lock + Phase 1 scaffold | Kickoff |
| 2026-07-30 | Supabase `voice-agent`; schema/RLS/seed; pooler health OK | Phase 1 DB gate |
| 2026-07-30 | Phase 1 healthy path verified; begin Phase 2 tools scaffold | Move on |
| 2026-08-01 | Retell web call frontend + `/api/web-call` | Browser voice before tools |
| 2026-08-03 | Google Calendar client + booking tools wired | Live availability/booking |
