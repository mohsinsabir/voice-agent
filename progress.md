# AI Voice Agent — Project Progress

## Project Summary

AI-powered phone agent for a dental clinic (sample business) that handles inbound calls, checks real-time Google Calendar availability, books appointments, qualifies leads, hands off to a human when needed, and triggers post-call automation (HubSpot, SMS/email, transcript storage, sentiment/outcome logging) via n8n. Voice: Retell AI. Backend: Node.js/TypeScript. DB: Supabase/Postgres.

## Current Status

- Current phase: **Phase 3 — Automation** (emit `call.completed`; n8n/HubSpot/dashboard next)
- Overall completion estimate: ~70%
- Last updated: 2026-08-04

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
| SMS/email timing | Post-call via n8n (Phase 3); skip mid-call Twilio/SendGrid in Phase 2 | Avoid paid trials now; keep live call path lean | 2026-08-04 |
| Emergency handoff alert | `automation_events` + log (+ optional `STAFF_ALERT_WEBHOOK_URL`) | Honest Phase 2 alert without n8n yet | 2026-08-04 |
| n8n hosting | n8n Cloud (`softsinc.app.n8n.cloud`) | No local Docker n8n | 2026-08-04 |

## Environment and Accounts

- [x] Voice platform configured (Retell AI) — agent + web call API verified
- [ ] Phone number configured — Phase 2 (optional after web call)
- [x] AI model API configured (via Retell)
- [x] Calendar API configured — Phase 2 (live booking verified 2026-08-04)
- [ ] CRM configured (HubSpot) — Phase 3
- [ ] Twilio SMS configured — Phase 3 (mid-call messaging skipped)
- [ ] SendGrid configured — Phase 3 (mid-call messaging skipped)
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
- [x] Google Calendar credentials + live booking verified (2026-08-04)
- [x] Mid-call sendConfirmation deferred → Phase 3 (n8n / Twilio / SendGrid)
- [x] Emergency handoff → `automation_events` + log (`immediate_alert_sent`)
- [x] System prompt updated (no mid-call confirm; reschedule/cancel same-call)
- [x] Webhook idempotency API-verified (`processed` then `ignored_duplicate`)
- [x] Lead qualification API-verified (`saveLeadQualification`)
- [x] `sendConfirmation` failure path verified (`TWILIO_UNAVAILABLE`)
- [x] Live booking call verified (`checkAvailability` → `bookAppointment` → Calendar + `appointment_events`)
- [x] Live reschedule by phone verified (`caller_phone` + `new_slot_start`, 2026-08-04)
- [ ] Live qualification call verified (voice) — optional / can retest in Phase 3 demos
- [ ] Live cancel verified (voice) — optional
- [ ] Interruption / silence verified live — optional
- [ ] Retell call webhooks wired in dashboard — **needed for Phase 3 automation**
- [ ] ≥5-call latency samples pasted below from `tool_invocations`

### Phase 2 known limitation
Orphan Calendar↔DB reconciliation job ships in Phase 3. During Phase 2 live testing, after any ambiguous `bookAppointment` failure, manually verify Calendar vs `appointments`. Automated 15-minute reconciliation ships in Phase 3.

Mid-call Twilio/SendGrid `sendConfirmation` is **out of Phase 2 scope** (2026-08-04). Tool remains stubbed (`ENABLE_MESSAGING=false`); confirmations ship in Phase 3 via n8n.

**Phase 2 closed for delivery** (2026-08-04): booking + phone reschedule live; remaining voice scripts optional.

## Phase 3: Automation and Operational Visibility

- [x] `call.completed` → `automation_events` on Retell `call_ended`
- [x] Optional n8n dispatch (`ENABLE_N8N`)
- [x] Cloud n8n chosen (not local Docker); starter workflow in `n8n/voice-agent-call-completed.json`
- [x] Cloud workflow smoke-test: `call_ended` → n8n Succeeded (2026-08-05)
- [x] Payload uses `contact` (n8n-safe; not `caller`)
- [ ] HubSpot Private App + n8n HubSpot upsert node
- [ ] n8n workflow branches (deals / SMS / email)
- [ ] HubSpot configured
- [ ] Twilio + SendGrid (post-call confirmations)
- [ ] Admin dashboard + RBAC
- [ ] Calendar↔DB reconciliation job
- [ ] Dead-letter / ack callback path

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

### 2026-08-04

- Live booking verified (Calendar event + `appointment_events`)
- Decision: skip mid-call Twilio/SendGrid; confirmations in Phase 3 via n8n
- Emergency handoff alert + prompt refresh + `docs/phase-2-gate.md`
- API gates: webhook replay, lead save, handoff, sendConfirmation fail
- Live reschedule by `caller_phone` verified
- Phase 3 start: `emitCallCompleted` on `call_ended` + n8n compose profile + `docs/phase-3-setup.md`

## In Progress

- Current task: HubSpot Private App + add HubSpot upsert node in n8n (`docs/phase-3-setup.md` §B)
- Blockers: None

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
| Live Calendar checkAvailability | slots from GCal | Pass | Pass | 2026-08-04 |
| Live bookAppointment | Calendar event + DB row | Pass | Pass | 2026-08-04 |
| Webhook replay | ignored_duplicate | Pass | Pass | 2026-08-04 |
| saveLeadQualification API | score/status | Pass (unqualified/4) | Pass | 2026-08-04 |
| requestHumanHandoff emergency | alert + automation_events | Pass | Pass | 2026-08-04 |
| sendConfirmation stub | TWILIO_UNAVAILABLE | Pass | Pass | 2026-08-04 |

## Latency Measurements

Sample tool latencies from live/API calls (ms):

| Tool | Example latency_ms | Status |
|---|---:|---|
| checkAvailability | 4680 | Captured |
| createOrUpdateContact | 1538 | Captured |
| bookAppointment | 3817 | Captured |
| logCallOutcome | 840 | Captured |
| Perceived voice E2E (speech→audio) | — | Pending ≥5 live calls |

| Call Stage | Target | Actual | Status |
|---|---:|---:|---|
| End of caller speech to transcript | Under 500 ms | Not tested | Pending |
| Transcript to model response | Under 800 ms | Not tested | Pending |
| Model response to first audio | Under 500 ms | Not tested | Pending |
| Total perceived response latency | Under 1.5 seconds | Not tested | Pending |

## API and Integration Status

| Integration | Status | Last Test | Notes |
|---|---|---|---|
| Retell AI | Tools + web call OK | 2026-08-04 | Republish prompt; wire call webhooks |
| Google Calendar | Live booking OK | 2026-08-04 | SA + shared Bright Smile Dental calendar |
| HubSpot | Not configured | — | Phase 3 |
| Twilio SMS | Deferred | — | Phase 3 (skip mid-call in Phase 2) |
| SendGrid | Deferred | — | Phase 3 (skip mid-call in Phase 2) |
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
| 2026-08-04 | Live Calendar booking verified | Phase 2 booking path |
| 2026-08-04 | Defer mid-call Twilio/SendGrid to Phase 3 | Skip messaging for now |
| 2026-08-04 | Phase 2 gate prep (handoff alert, prompts, API checks) | Close Phase 2 |
| 2026-08-04 | Live reschedule by phone; start Phase 3 automation emit | Post-call n8n path |
