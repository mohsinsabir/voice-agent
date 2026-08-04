# Phase 3 — Post-call automation (first slice)

Backend now writes `automation_events` (`call.completed`) on Retell `call_ended`, and POSTs to n8n when enabled.

## 1. Close Phase 2 leftovers (optional)

- Wire Retell webhooks → `https://<ngrok>/webhooks/retell` + `X-Internal-Tool-Secret` (needed for `call_ended` → automation)
- Cancel / lead / barge-in live tests if you still want them on the gate list

## 2. Run n8n locally

Requires Docker:

```powershell
docker compose --profile n8n up -d n8n
```

Open http://localhost:5678 → create account → new workflow:

1. **Webhook** trigger (POST) — copy the Test/Production URL  
2. (Optional) IF node: header `X-Automation-Secret` equals your secret  
3. **Respond to Webhook** 200  
4. For now: log/set body so you can see the payload

## 3. Enable in `.env`

```env
ENABLE_N8N=true
N8N_WEBHOOK_URL=http://localhost:5678/webhook/<your-path>
N8N_WEBHOOK_SECRET=change-me-phase-3
```

Restart `npm run dev`.

## 4. Smoke test without a live call

```powershell
$secret = (Get-Content .env | Where-Object { $_ -match '^RETELL_TOOL_SECRET=' }) -replace '^RETELL_TOOL_SECRET=',''
$wh = @{ event = "call_ended"; call = @{ call_id = "phase3-auto-001" } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri http://localhost:3000/webhooks/retell `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body $wh
```

Check Supabase `automation_events` for `event_type = call.completed`.  
If `ENABLE_N8N=true` and n8n is up, status should become `sent`.

Replay the same payload → webhook `ignored_duplicate`; automation row stays one.

## 5. Still to build in Phase 3

| Slice | What |
|---|---|
| n8n workflow branches | HubSpot / SMS / email by disposition |
| HubSpot + Twilio + SendGrid accounts | Paid/trial credentials |
| Dashboard + RBAC | Review calls / leads |
| Calendar↔DB reconciliation | 15-min orphan job |
| Backend ack endpoint | n8n → `acknowledged` / `failed` |

See `docs/n8n-event-map.md` for the full payload and workflow design.
