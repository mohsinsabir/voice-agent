# Phase 2 — Gate verification

Keep `npm run dev` + `ngrok http 3000` running. Paste updated `docs/system-prompts.md` into Retell and **Publish**.

## A. Retell webhook (dashboard)

1. Retell → Agent / Account → **Webhooks**
2. URL: `https://<your-ngrok>/webhooks/retell`
3. Header: `X-Internal-Tool-Secret: <RETELL_TOOL_SECRET from .env>`
4. Events: `call_started`, `call_ended`, `call_analyzed` (or “all”)
5. After any test call, check Supabase `webhook_events` + `transcript_segments`

### Replay idempotency (API)

```powershell
$secret = (Get-Content .env | Where-Object { $_ -match '^RETELL_TOOL_SECRET=' }) -replace '^RETELL_TOOL_SECRET=',''
$wh = @{ event = "call_ended"; call = @{ call_id = "phase2-gate-wh-001" } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri http://localhost:3000/webhooks/retell -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } -Body $wh
Invoke-RestMethod -Method Post -Uri http://localhost:3000/webhooks/retell -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } -Body $wh
```

First response: `processed`. Second: `ignored_duplicate`.

## B. Live voice scripts

### B1. Booking (already verified)
Ask for a cleaning next weekday afternoon → confirm name/phone → expect Calendar + `appointments` row.

### B2. Reschedule then cancel (same call)
1. Book a slot.
2. “Actually move that to [later same day].”
3. Confirm agent calls `rescheduleAppointment` → Calendar time updates.
4. “Cancel that appointment.”
5. Confirm `cancelAppointment` → Calendar event gone / cancelled; DB `status=cancelled`.

### B3. Lead qualification (no booking)
“I’m not ready to book — just comparing dentists.”
Answer urgency / reason / new-or-existing / insurance.
Expect `saveLeadQualification` + row in `lead_qualifications` with score/status.

### B4. Interruption / silence
Talk over the agent (barge-in); pause ~5s. Agent should recover without inventing a booking.

### B5. sendConfirmation failure path
If agent offers text/email, it should **not** call `sendConfirmation` (prompt updated). Manual fail check:

```powershell
$body = @{ call = @{ call_id = "phase2-msg-fail" }; name = "sendConfirmation"; args = @{ channel = "sms"; appointment_id = "00000000-0000-4000-8000-000000000001" } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri http://localhost:3000/tools -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } -Body $body
```

Expect `TWILIO_UNAVAILABLE`.

### B6. Handoff
“I need to talk to a person.” Expect `requestHumanHandoff` + `automation_events` row `handoff.requested`.

## C. Latency (≥5 calls)

After ≥5 tool-using calls, from Supabase:

```sql
SELECT tool_name, COUNT(*), ROUND(AVG(latency_ms)) AS avg_ms, MAX(latency_ms) AS max_ms
FROM tool_invocations
GROUP BY 1
ORDER BY 1;
```

Paste averages into `progress.md` Latency table (or note tool_invocations as evidence).

## D. Double-booking

Already covered by unit/DB exclusion tests. Optional live: book a slot, then try to book the same ISO `slot_start` again via `/tools` — expect `SLOT_NO_LONGER_AVAILABLE` or overlap error → alternatives.

## Gate checklist

- [ ] Webhook URL + secret in Retell
- [ ] Webhook replay → `ignored_duplicate`
- [ ] Reschedule live
- [ ] Cancel live
- [ ] Lead qualification live
- [ ] Barge-in / silence OK
- [ ] ≥5 calls latency noted
- [ ] Prompt republished (no mid-call confirm)
