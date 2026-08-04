# Phase 3 — Post-call automation (cloud n8n)

Backend writes `automation_events` (`call.completed`) on Retell `call_ended`, then POSTs to your **n8n Cloud** webhook when `ENABLE_N8N=true`.

**Do not run n8n locally** — use your cloud instance (e.g. `https://softsinc.app.n8n.cloud`).

---

## 1. Retell webhooks (required for real calls)

Point Retell → `https://<your-ngrok>/webhooks/retell`  
Header: `X-Internal-Tool-Secret: <RETELL_TOOL_SECRET>`  
Events: at least `call_ended` (also `call_started`, `call_analyzed` if available).

---

## 2. Import starter workflow in n8n Cloud

1. Open your empty workflow (or **Workflows → Add workflow**)
2. **⋯ menu → Import from file** (or paste)
3. Import: [`n8n/voice-agent-call-completed.json`](../n8n/voice-agent-call-completed.json)
4. Open the **Webhook** node → copy **Production URL** (and Test URL if testing)
5. Open the **IF** node → set your secret to match `.env` `N8N_WEBHOOK_SECRET` (default in import: `change-me-phase-3`)
6. Rename workflow to `Voice Agent — call.completed`
7. Toggle **Publish / Active** ON

Webhook path in the import: `voice-agent-call-completed`  
Example production URL:

`https://softsinc.app.n8n.cloud/webhook/voice-agent-call-completed`

---

## 3. Enable in `.env`

```env
ENABLE_N8N=true
N8N_WEBHOOK_URL=https://softsinc.app.n8n.cloud/webhook/voice-agent-call-completed
N8N_WEBHOOK_SECRET=change-me-phase-3
```

Use the **exact** Production URL from the Webhook node. Restart `npm run dev`.

---

## 4. Smoke test (no live call)

```powershell
$secret = (Get-Content .env | Where-Object { $_ -match '^RETELL_TOOL_SECRET=' }) -replace '^RETELL_TOOL_SECRET=',''
$wh = @{ event = "call_ended"; call = @{ call_id = "phase3-auto-001" } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri http://localhost:3000/webhooks/retell `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body $wh
```

**Pass when:**
- Supabase `automation_events` has `call.completed` (status `sent` if n8n returned 2xx)
- n8n **Executions** shows a successful run

For a first Test URL try: put n8n in listen/test mode, or use Production URL after Publish.

Replay the same `call_ended` → webhook `ignored_duplicate`; still only one automation row.

---

## 5. Manual webhook ping (optional)

```powershell
$n8nSecret = "change-me-phase-3"
$body = @{ event_type = "call.completed"; call = @{ disposition = "booked" }; caller = @{ name = "Test"; phone_e164 = "+923000000000" } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "https://softsinc.app.n8n.cloud/webhook/voice-agent-call-completed" `
  -Headers @{ "Content-Type" = "application/json"; "X-Automation-Secret" = $n8nSecret } `
  -Body $body
```

---

## 6. Still to build

| Slice | What |
|---|---|
| HubSpot nodes | Upsert contact + deal by disposition |
| Twilio / SendGrid | Post-call SMS/email |
| Ack callback | n8n → backend `acknowledged` / `failed` |
| Dead-letter cron | Retry failed events |
| Dashboard + RBAC | Staff review UI |
| Calendar reconciliation | Orphan Calendar↔DB job |

Design reference: `docs/n8n-event-map.md`.
