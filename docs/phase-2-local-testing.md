# Phase 2 — Local tool smoke tests

With the server running (`npm run dev`) and `RETELL_TOOL_SECRET` set in `.env`:

## Create / update contact

```powershell
$secret = (Get-Content .env | Where-Object { $_ -match '^RETELL_TOOL_SECRET=' }) -replace '^RETELL_TOOL_SECRET=',''
$body = @{
  call = @{ call_id = "test-call-001"; agent_id = "agent-dev" }
  name = "createOrUpdateContact"
  args = @{ name = "Jordan Lee"; phone = "+15551234567"; email = "jordan@example.com" }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri http://localhost:3000/tools `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body $body
```

## Save lead qualification

```powershell
$body = @{
  call = @{ call_id = "test-call-001" }
  name = "saveLeadQualification"
  args = @{
    answers = @(
      @{ question_key = "urgency_level"; answer_value = "high" },
      @{ question_key = "has_insurance"; answer_value = "yes" },
      @{ question_key = "reason_for_visit"; answer_value = "Tooth pain" },
      @{ question_key = "new_or_existing_patient"; answer_value = "existing" }
    )
  }
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Post -Uri http://localhost:3000/tools `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body $body
```

## Retell webhook (call_ended)

```powershell
$wh = @{
  event = "call_ended"
  call = @{ call_id = "test-call-001" }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri http://localhost:3000/webhooks/retell `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body $wh
```

## Google Calendar setup

1. Google Cloud Console → create/select a project → enable **Google Calendar API**
2. IAM → **Service accounts** → Create → download JSON key
3. Google Calendar (personal/Workspace) → create or open the clinic calendar → **Share with** the service account email → permission **Make changes to events**
4. Copy into `.env`:

```env
ENABLE_CALENDAR=true
GOOGLE_CALENDAR_ID=<calendar id from Calendar settings, often an email>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email from JSON>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="<private_key from JSON>"
```

5. Restart `npm run dev`, then:

```powershell
$body = @{
  call = @{ call_id = "cal-test-001" }
  name = "checkAvailability"
  args = @{ date_phrase = "tomorrow afternoon"; service_type = "cleaning" }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri http://localhost:3000/tools `
  -Headers @{ "X-Internal-Tool-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body $body
```

Expect `success: true` and a `slots` array (empty is OK if the day is fully booked / closed).

## Next setup (accounts)

1. Create a Retell AI account + agent; paste `docs/system-prompts.md` into the agent prompt
2. Register custom functions pointing at `https://<public-url>/tools` with header `X-Internal-Tool-Secret`
3. Point Retell call webhooks at `https://<public-url>/webhooks/retell`
4. Enable Google Calendar (steps above) for live booking tools
