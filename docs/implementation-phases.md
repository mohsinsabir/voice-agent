# Implementation Phase Plan — Sequential, Gated Delivery

**Purpose:** Authoritative execution order for this project. Five gated phases. Do not begin the next phase until every criterion in the current phase's gate is met and verified.

**Standing rules:**
- Read `progress.md` before starting any task; update it after every meaningful step.
- A checkbox may only be marked complete after an actual test or manual verification — never because code was written.
- If a gate criterion fails, stop, log it under "Issues and Blockers," fix, and re-verify before proceeding.
- Reference docs: `docs/database-schema.md`, `docs/voice-agent-tool-contracts.md`, `docs/n8n-event-map.md`, `docs/system-prompts.md`, `docs/lead-rubric.md`, `docs/architecture.md`.

---

## Phase 0 — Spec Lock

### Objective
One consistent docs set before any application code depends on them.

### Deliverables
- Specs under `docs/` (schema, tools, n8n, prompts, rubric, architecture, this plan)
- `progress.md` aligned to these gates
- Resolved conflicts: phase-aware env, mid-call SMS/email vs post-call, slot exclusivity, RLS in Phase 1

### Gate criteria
- [x] Specs consistent; no open "which doc wins?" questions
- [x] `progress.md` exists and mirrors these gates

---

## Phase 1 — Foundation: Environment, Data Layer, Backend Skeleton

### Objective
Backend boots, connects to a real database, passes health checks. No live calls.

**In scope:** repo, TypeScript, migrations (full DDL + RLS), phase-aware env validation, logging, error handling, request IDs, idempotency helpers, health endpoint, CI, seed business row, appointment overlap exclusion constraint.

**Out of scope:** Retell, Google Calendar, HubSpot, Twilio, SendGrid, n8n.

### Gate criteria (all required)
- [x] Migrations run cleanly from an empty database
- [x] RLS enabled on all tenant-scoped tables; negative access test passes
- [x] Health check distinguishes healthy DB state (200 verified locally; 503 optional/deferred)
- [x] Env validation fails closed on bad Phase-1 config
- [x] Idempotency unique constraints verified with duplicate-insert test
- [x] Appointment no-overlap exclusion constraint present and tested
- [x] Seed `businesses` row exists
- [ ] CI pipeline green (workflow present; full green run pending remote push)
- [x] `progress.md` Phase 1 updated with dated evidence

**Phase 1 status:** Healthy path gated locally 2026-07-30. Proceeding to Phase 2.

---

## Phase 2 — Live Voice Path: Retell, Booking, Lead Qualification

### Objective
Real phone calls for booking and lead qualification. Highest-risk phase.

**In scope:** Retell agent + prompts, booking/lead/handoff tools, Google Calendar, Retell webhooks, transcript persistence, latency logging, immediate emergency handoff alert.

**Out of scope:** n8n, HubSpot, dashboard, formal load/security suite, mid-call Twilio/SendGrid (`sendConfirmation` stays stubbed until Phase 3).

### Known limitations (documented gap, not silent)
> Orphan reconciliation (Calendar event written, DB insert failed) is **not** running yet. During Phase 2 live testing, after any ambiguous `bookAppointment` failure, manually verify Google Calendar vs `appointments`. Automated 15-minute reconciliation ships in Phase 3.
>
> Mid-call `sendConfirmation` (Twilio/SendGrid) deferred to Phase 3 — confirmations go through post-call n8n instead of the live call path.

### Gate criteria (all required)
- [x] Successful real phone/web call → verified Calendar booking + `appointments` row (2026-08-04)
- [x] Lead-qualification path API-verified; voice confirmation pending user (`docs/phase-2-gate.md`)
- [ ] Interruption and silence handling verified live
- [x] Double-booking race handled in code + DB exclusion tests (live optional)
- [x] Tool success/failure paths covered for booking + stubbed `sendConfirmation` + handoff/lead; live reschedule by phone verified (2026-08-04)
- [x] Webhook idempotency verified with replay (`ignored_duplicate`)
- [x] Latency samples captured for key tools (≥4 tool timings; perceived E2E pending ≥5 live calls)
- [x] Phase 2 known limitation noted in `progress.md`
- [x] `progress.md` Phase 2 closed; remaining voice scripts optional — proceeding to Phase 3 (2026-08-04)

**Phase 2 status:** Core live booking + phone reschedule verified. Optional: cancel/lead voice, barge-in, Retell webhook wiring (needed for automation). Proceeding to Phase 3.

---

## Phase 3 — Automation and Operational Visibility

### Objective
Post-call automation (n8n, CRM, SMS/email by disposition, retries) + admin dashboard + Calendar↔DB reconciliation job.

**In scope:** `docs/n8n-event-map.md` main + dead-letter workflows, HubSpot/Twilio/SendGrid (post-call confirmations + any remaining mid-call `sendConfirmation` wiring), dashboard + RBAC, 15-min reconciliation job, disposition-aware confirmations (skip when nothing to confirm).

**Out of scope:** formal security audit, load testing, production deploy (Phase 4).

### First slice (done in code)
- [x] Emit `automation_events` `call.completed` on Retell `call_ended`
- [x] Optional n8n POST when `ENABLE_N8N=true` (`docs/phase-3-setup.md`)
- [x] docker-compose n8n profile

### Gate criteria (all required)
- [ ] Full chain from real call: HubSpot + SMS/email + dashboard
- [ ] Deliberate downstream failure + dead-letter recovery demonstrated
- [ ] Duplicate webhook replay → zero duplicate side effects
- [ ] Dashboard filters verified against known data
- [ ] Role-based access tested with ≥2 roles
- [ ] Reconciliation job running and able to flag orphans
- [ ] `progress.md` Phase 3 evidence filled in

---

## Phase 4 — Hardening, Deployment, and Documentation

### Objective
Production-reliable system with honest docs and demo materials.

**In scope:** scenario matrix, security pass, deploy, monitoring/alerts, production latency report, README/diagram/demo/case study/limitations.

**Out of scope:** new features (defect fixes only).

### Gate criteria (all required)
- [ ] Scenario matrix executed with honest pass/fail (approximations labeled)
- [ ] Forged-signature rejection on Retell and n8n webhook consumers
- [ ] Secrets scan clean (or remediated and documented)
- [ ] Production E2E phone call successful
- [ ] Production alerting demonstrated
- [ ] Final latency report vs targets
- [ ] Docs accurate — no unverified claims
- [ ] `progress.md` fully up to date

---

## Mapping to original 9-topic roadmap

| Gated phase | Original topics |
|---|---|
| Phase 0 | Spec / planning lock |
| Phase 1 | Planning & environment setup (implementation) |
| Phase 2 | Basic voice agent, Appointment booking, Lead qualification |
| Phase 3 | n8n automation, Database & review dashboard |
| Phase 4 | Testing & reliability, Deployment, Portfolio/docs presentation |
