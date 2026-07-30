# Architecture — AI Voice Agent (Dental Clinic)

## 1. System boundary

```
Caller phone
    ↔ Retell AI (STT / LLM / TTS / barge-in / telephony)
        ↔ Backend (Node/TS)  — custom tools + call webhooks
            ↔ Postgres (Supabase)
            ↔ Google Calendar
            ↔ Twilio / SendGrid (mid-call sendConfirmation only)
        ──post-call──► automation_events
            ↔ n8n → HubSpot, Twilio SMS, SendGrid, Slack/email alerts
Admin browser ↔ Dashboard (Phase 3) ↔ Backend ↔ Postgres
```

**Rule:** Live call path never waits on n8n or HubSpot. CRM and most SMS/email run after `call.completed`.

## 2. Runtime components

| Component | Role |
|---|---|
| Retell AI | Inbound number, conversation, barge-in, tool calls, call webhooks |
| Backend | Tool handlers, webhook consumers, persistence, automation dispatch |
| Postgres | Source of truth for calls, leads, appointments, transcripts, idempotency |
| Google Calendar | Availability + event create/update/cancel |
| n8n | Post-call CRM/SMS/email/alerts/retries |
| Dashboard | Staff review of calls/leads/appointments |

## 3. Latency budget (targets)

| Stage | Target | Who owns measurement |
|---|---:|---|
| End of caller speech → transcript | < 500 ms | Mostly Retell; log if metadata available |
| Transcript → model response (incl. tool RTT) | < 800 ms | Retell + our tool `latency_ms` |
| Model response → first audio | < 500 ms | Mostly Retell |
| **Total perceived response** | **< 1.5 s** | End-to-end observation |
| Single tool handler (our code + Calendar) | < 300–500 ms ideal; hard timeout 8 s at Retell | `tool_invocations.latency_ms` |

Instrument every tool invocation with `latency_ms`. Capture raw numbers in Phase 2; compare to targets in Phase 4 (production path).

## 4. Idempotency

- Inbound webhooks → `webhook_events (source, external_event_id)` unique
- Outbound automation → `automation_events.dedupe_key` unique (`${call_id}:${event_type}`)
- `bookAppointment` → `${call_id}:bookAppointment` via prior successful `tool_invocations`
- Slot exclusivity → re-check Calendar before write + DB exclusion constraint on overlapping booked ranges per `business_id`

## 5. Phase-aware configuration

Env vars are validated by phase. Phase 1 only requires DB + server basics. Retell/Calendar/Twilio/etc. become required when those features are enabled (see `.env.example` and `src/config/env.ts`).

## 6. Security baseline

- Tool endpoints: `X-Internal-Tool-Secret`
- Retell webhooks: signature verification
- n8n webhooks: `X-Automation-Secret`
- RLS on tenant tables keyed by `business_id` (Phase 1 gate)
- PII redaction before logs and `content_redacted` transcripts
- No secrets in git; service role never in browser
