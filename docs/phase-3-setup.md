# Phase 3 — Post-call automation (cloud n8n)

Backend writes `automation_events` (`call.completed`) on Retell `call_ended`, then POSTs to **n8n Cloud** when `ENABLE_N8N=true`.

Payload uses **`contact`** (not `caller`) — n8n blocks the property name `caller`.

---

## Done so far

- [x] Emit `call.completed` + POST to n8n  
- [x] Cloud webhook workflow smoke-tested (Succeeded execution)

---

## A. Keep Retell webhooks pointed at your API

`https://<ngrok>/webhooks/retell` + header `X-Internal-Tool-Secret`

---

## B. HubSpot (next)

### B1. Create a free HubSpot account
1. Go to [hubspot.com](https://www.hubspot.com/products/crm) → Free CRM  
2. Finish signup

### B2. Create a Private App (API token)
1. HubSpot → ⚙️ **Settings** → **Integrations** → **Private Apps**  
2. **Create a private app**  
3. Name: `voice-agent`  
4. Scopes (minimum):  
   - `crm.objects.contacts.read`  
   - `crm.objects.contacts.write`  
   - `crm.objects.deals.read`  
   - `crm.objects.deals.write`  
5. **Create app** → copy the **access token** (show once)

### B3. Put token in `.env` (optional for n8n — n8n can store its own credential)

```env
ENABLE_HUBSPOT=true
HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx
```

For **n8n Cloud**, you usually add the token as an **n8n Credential**, not only in `.env`.

### B4. Add HubSpot node in n8n
1. Open workflow **Voice Agent — call.completed** → **Editor**  
2. Between **Normalize** and **Respond 200**, click **+**  
3. Search **HubSpot** → add node  
4. Create credential → paste Private App token  
5. Resource: **Contact**  
6. Operation: **Create or update** (upsert)  
7. Map fields from Normalize output:  
   - Phone → `{{ $json.contact_phone }}`  
   - Email → `{{ $json.contact_email }}` (if present)  
   - First name / name → `{{ $json.contact_name }}`  
8. Connect: Normalize → HubSpot → Respond 200  
9. **Publish**

### B5. Test with a call that has a contact
Smoke `call_ended` alone often has `contact: null` (no tools ran). Prefer:

1. Live Retell call that runs `createOrUpdateContact`, then ends, **or**  
2. Tool call contact first, then `call_ended` for that same Retell `call_id`

Check HubSpot → **Contacts** for the phone/name.

---

## C. Smoke webhook again (after HubSpot node)

```powershell
$secret = (Get-Content .env | Where-Object { $_ -match '^RETELL_TOOL_SECRET=' }) -replace '^RETELL_TOOL_SECRET=',''
$wh = @{ event = "call_ended"; call = @{ call_id = "phase3-hubspot-001" } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri http://localhost:3000/webhooks/retell `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body $wh
```

---

## D. Still later in Phase 3

| Slice | What |
|---|---|
| HubSpot deals | Booked / lead stages |
| Twilio + SendGrid | SMS/email confirmations |
| Ack callback | n8n → `acknowledged` |
| Dashboard | Staff UI |
| Reconciliation | Calendar↔DB orphans |

Design: `docs/n8n-event-map.md`. Starter import: `n8n/voice-agent-call-completed.json` (updated with `contact_*` fields).
