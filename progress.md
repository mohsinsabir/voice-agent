# AI Voice Agent — Project Progress

## Project Summary

AI-powered phone agent for a dental clinic (sample business) that handles inbound calls, checks real-time Google Calendar availability, books appointments, qualifies leads, hands off to a human when needed, and triggers post-call automation (HubSpot, SMS/email, transcript storage, sentiment/outcome logging) via n8n. Voice: Retell AI. Backend: Node.js/TypeScript. DB: Supabase/Postgres.

## Current Status

- Current phase: **Phase 1 — Foundation** (nearly gated; awaiting local `DATABASE_URL` password for health endpoint test)
- Overall completion estimate: ~25%
- Last updated: 2026-07-30

## Architecture Decisions

| Decision | Selected Option | Reason | Date |
|---|---|---|---|
| Voice platform | Retell AI | Barge-in, webhooks, custom tools | 2026-07-30 |
| Scheduling | Google Calendar | Real-time freebusy + event write | 2026-07-30 |
| CRM | HubSpot | Free tier, simpler than Salesforce | 2026-07-30 |
| Database | Supabase project `voice-agent` (`xffzulhvfqcigbmbnhcv`, ap-south-1) | Active hosted Postgres + RLS | 2026-07-30 |
| Automation | n8n (Docker) | Post-call CRM/SMS/email without blocking calls | 2026-07-30 |
| Delivery model | 5 gated phases | Spec lock → foundation → voice → automation → harden | 2026-07-30 |
| RLS | Required in Phase 1 gate | Cheap now; hard to retrofit later | 2026-07-30 |
| Slot exclusivity | Calendar re-check + DB exclusion constraint | Unique on `calendar_event_id` alone does not prevent double-book | 2026-07-30 |

## Environment and Accounts

- [ ] Voice platform configured (Retell AI) — Phase 2
- [ ] Phone number configured — Phase 2
- [ ] AI model API configured (via Retell) — Phase 2
- [ ] Calendar API configured — Phase 2
- [ ] CRM configured (HubSpot) — Phase 3
- [ ] Twilio SMS configured — Phase 2 / Phase 3
- [ ] SendGrid configured — Phase 2 / Phase 3
- [x] Database configured (Supabase `voice-agent` / `xffzulhvfqcigbmbnhcv`) — schema + RLS + seed applied
- [ ] Local app `DATABASE_URL` password filled in `.env` — **user action**
- [ ] n8n configured — Phase 3
- [ ] Deployment environment configured — Phase 4

## Phase 0: Spec Lock

- [x] Use case selected (dental clinic)
- [x] Architecture + tool contracts + schema + n8n map in `docs/`
- [x] System prompts + lead rubric written
- [x] Implementation phase plan written
- [x] Conflicts resolved

## Phase 1: Foundation

- [x] Repository initialized
- [x] Project structure created
- [x] Environment variables documented (phase-aware)
- [x] Database migrations applied (DDL + RLS + overlap exclusion + seed) via Supabase MCP
- [x] Development tools configured (lint, format, test, CI)
- [ ] Health check verified locally (needs `DATABASE_URL` password)
- [x] Env fail-closed verified (unit tests)
- [x] Idempotency unique constraints verified (SQL on Supabase)
- [x] Overlap exclusion verified (SQL on Supabase)
- [x] RLS negative test verified (`voice_app` without GUC → 0 businesses; with GUC → 1)

### Seeded business
- Name: Bright Smile Dental
- ID: `646d931b-a83c-4a68-837e-3d6f7167e351`
- URL: https://xffzulhvfqcigbmbnhcv.supabase.co

## Phase 2 known limitation
Orphan Calendar↔DB reconciliation job ships in Phase 3. During Phase 2, manually verify Calendar vs `appointments` after ambiguous booking failures.

## Completed Work

### 2026-07-30

- Created Supabase project `voice-agent` (ref `xffzulhvfqcigbmbnhcv`, region `ap-south-1`, $0/mo)
- Applied migrations: `init_schema`, `enable_rls`, `seed_business`
- Verified: tables + RLS on; dedupe unique; overlap exclusion; RLS deny/allow with `voice_app`
- Files: `.env`, `.env.example`, `progress.md`, `src/config/env.ts`

## In Progress

- Current task: Wire local backend to Supabase (`DATABASE_URL`) and verify `GET /health`
- Blockers: Need database password from Supabase Dashboard → Project Settings → Database

## Issues and Blockers

| Issue | Impact | Proposed Solution | Status |
|---|---|---|---|
| Docker not on PATH | Local compose unavailable | Using Supabase instead | Resolved |
| `.env` pooler URL format OK; password auth still fails (28P01) | Local health check blocked | Reset DB password in Supabase; paste into Session pooler URI carefully | Open |
| Direct host IPv6-only | Direct URI unusable from this network | Use Session pooler (now configured in `.env`) | Resolved |
| `DATABASE_URL` had typo `postgresql:postgresql://` | URL parsed as empty host | Fixed automatically | Resolved |

## Test Results

| Test | Expected Result | Actual Result | Status | Date |
|---|---|---|---|---|
| loadEnv Phase 1 core | Loads | Pass | Pass | 2026-07-30 |
| loadEnv missing DATABASE_URL | Throws | Pass | Pass | 2026-07-30 |
| loadEnv ENABLE_RETELL without secrets | Throws | Pass | Pass | 2026-07-30 |
| Migrations on empty Supabase DB | Clean apply | Success | Pass | 2026-07-30 |
| Duplicate automation_events.dedupe_key | unique_violation on 2nd insert | Pass | Pass | 2026-07-30 |
| appointments_no_overlap | exclusion_violation on overlap | Pass | Pass | 2026-07-30 |
| RLS without business GUC as voice_app | 0 businesses | 0 | Pass | 2026-07-30 |
| RLS with business GUC as voice_app | 1 business | 1 / Bright Smile Dental | Pass | 2026-07-30 |
| Health 200 / 503 | Distinguishes DB up/down | Not run locally yet | Pending | — |

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
| Retell AI | Not configured | — | Phase 2 |
| Google Calendar | Not configured | — | Phase 2 |
| HubSpot | Not configured | — | Phase 3 |
| Twilio SMS | Not configured | — | Phase 2+ |
| SendGrid | Not configured | — | Phase 2+ |
| Supabase/Postgres | Active + migrated | 2026-07-30 | ref `xffzulhvfqcigbmbnhcv` |
| n8n | Not configured | — | Phase 3 |

## Change Log

| Date | Change | Reason |
|---|---|---|
| 2026-07-30 | Spec lock + Phase 1 scaffold | Kickoff |
| 2026-07-30 | Created Supabase `voice-agent`; applied schema/RLS/seed; verified constraints | Unblock Phase 1 DB gate |
