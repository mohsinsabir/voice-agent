# Phase 3 — Post-call automation (cloud n8n)

Backend writes `automation_events` (`call.completed`) on Retell `call_ended`, then POSTs to **n8n Cloud** when `ENABLE_N8N=true`.

Payload uses **`contact`** (not `caller`) — n8n blocks the property name `caller`.

---

## Done so far

- [x] Emit `call.completed` + POST to n8n  
- [x] Cloud webhook smoke-test  
- [x] HubSpot **contact** upsert (terminal + Contacts UI, 2026-08-05)

---

## A. Retell webhooks

`https://<ngrok>/webhooks/retell` — Retell signs with `x-retell-signature` (verified via `RETELL_API_KEY`). Manual tests may still send `X-Internal-Tool-Secret`.

---

## B. HubSpot contact (done)

Normalize → HubSpot **Create or update a contact**:

| HubSpot field | Expression |
|---|---|
| Email | `{{ $json.contact_email }}` |
| First Name | `{{ $json.contact_name }}` |
| Phone Number | `{{ $json.contact_phone }}` |

Terminal smoke (unique `$callId` each run):

```powershell
$secret = (Get-Content .env | Where-Object { $_ -match '^RETELL_TOOL_SECRET=' }) -replace '^RETELL_TOOL_SECRET=',''
$callId = "phase3-hs-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Invoke-RestMethod -Method Post -Uri http://localhost:3000/tools `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body (@{
    call = @{ call_id = $callId; agent_id = "agent-dev" }
    name = "createOrUpdateContact"
    args = @{ name = "Jordan Lee"; phone = "+15551234567"; email = "jordan+voice@example.com" }
  } | ConvertTo-Json -Depth 5)

Invoke-RestMethod -Method Post -Uri http://localhost:3000/webhooks/retell `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body (@{ event = "call_ended"; call = @{ call_id = $callId } } | ConvertTo-Json -Depth 5)
```

---

## C. HubSpot deal (next)

When the payload includes `appointment`, create/update a HubSpot **Deal** linked to the contact.

### C1. Expand Normalize

Add fields (same pattern as contact_*):

| Name | Expression |
|---|---|
| `appointment_id` | `{{ ($json.body['appointment'] \|\| $json['appointment'] \|\| {})['appointment_id'] \|\| '' }}` |
| `appointment_status` | `{{ ($json.body['appointment'] \|\| $json['appointment'] \|\| {})['status'] \|\| '' }}` |
| `service_type` | `{{ ($json.body['appointment'] \|\| $json['appointment'] \|\| {})['service_type'] \|\| '' }}` |
| `appointment_start` | `{{ ($json.body['appointment'] \|\| $json['appointment'] \|\| {})['start_time'] \|\| '' }}` |

### C2. Branch after contact upsert

1. After **Create or update a contact**, add **IF** → **Has appointment?**  
   - Condition: `{{ $json.appointment_id }}` **is not empty**  
   - **Important:** IF input must still have Normalize fields. If HubSpot output replaces them, either:  
     - turn on HubSpot **Include Other Input Fields** (if available), or  
     - use expressions from Normalize: `{{ $('Normalize').item.json.appointment_id }}`
2. **true** → HubSpot **Create a deal** (or Create or update deal)  
3. **false** → skip to **Respond 200**  
4. Deal success → **Respond 200**

### C3. Create a deal — map fields

| Field | Value |
|---|---|
| Deal name | `{{ $('Normalize').item.json.contact_name }} — {{ $('Normalize').item.json.service_type }}` |
| Pipeline / stage | Default pipeline; stage e.g. **Appointment scheduled** (or first open stage) |
| Associate contact | Contact id from upsert node (often `{{ $json.id }}` or `{{ $json.vid }}` — pick from HubSpot OUTPUT schema) |
| Optional note | `status={{ $('Normalize').item.json.appointment_status }} start={{ $('Normalize').item.json.appointment_start }}` |

Ensure Service Key / Private App has **deals** read + write scopes. Re-auth credential if deals were not enabled at create time.

### C4. Terminal test (needs Calendar)

`ENABLE_CALENDAR=true`. Use one new `$callId`:

```powershell
$secret = (Get-Content .env | Where-Object { $_ -match '^RETELL_TOOL_SECRET=' }) -replace '^RETELL_TOOL_SECRET=',''
$callId = "phase3-deal-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Contact
Invoke-RestMethod -Method Post -Uri http://localhost:3000/tools `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body (@{
    call = @{ call_id = $callId; agent_id = "agent-dev" }
    name = "createOrUpdateContact"
    args = @{ name = "Jordan Lee"; phone = "+15551234567"; email = "jordan+voice@example.com" }
  } | ConvertTo-Json -Depth 5)

# Pick a free slot
$avail = Invoke-RestMethod -Method Post -Uri http://localhost:3000/tools `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body (@{
    call = @{ call_id = $callId }
    name = "checkAvailability"
    args = @{ date_phrase = "tomorrow afternoon"; service_type = "cleaning" }
  } | ConvertTo-Json -Depth 5)
$slot = $avail.result.slots[0].start
if (-not $slot) { throw "No free slot — try another date_phrase" }

# Book (links appointment to this call_id)
Invoke-RestMethod -Method Post -Uri http://localhost:3000/tools `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body (@{
    call = @{ call_id = $callId }
    name = "bookAppointment"
    args = @{
      slot_start = $slot
      service_type = "cleaning"
      caller_name = "Jordan Lee"
      caller_phone = "+15551234567"
      caller_email = "jordan+voice@example.com"
    }
  } | ConvertTo-Json -Depth 5)

# Fire automation → n8n → contact + deal
Invoke-RestMethod -Method Post -Uri http://localhost:3000/webhooks/retell `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body (@{ event = "call_ended"; call = @{ call_id = $callId } } | ConvertTo-Json -Depth 5)
```

**Expect:** n8n Succeeded; HubSpot → **Deals** shows e.g. `Jordan Lee — cleaning`.

---

## D. Later Phase 3

| Slice | What |
|---|---|
| IF skip HubSpot when no email | Avoid bad-request on phone-only calls |
| Twilio + SendGrid | SMS/email confirmations |
| Ack callback | n8n → `acknowledged` |
| Dashboard | Staff UI |
| Reconciliation | Calendar↔DB orphans |

Design: `docs/n8n-event-map.md`. Starter: `n8n/voice-agent-call-completed.json`.
