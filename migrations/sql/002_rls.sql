-- RLS policies keyed on app.current_business_id session setting

CREATE OR REPLACE FUNCTION app_current_business_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_business_id', true), '')::uuid;
$$;

-- Tenant tables with business_id
-- FORCE so table owners cannot silently bypass RLS in local/dev.
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses FORCE ROW LEVEL SECURITY;
ALTER TABLE callers ENABLE ROW LEVEL SECURITY;
ALTER TABLE callers FORCE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls FORCE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users FORCE ROW LEVEL SECURITY;

CREATE POLICY businesses_tenant_isolation ON businesses
  FOR ALL
  USING (id = app_current_business_id())
  WITH CHECK (id = app_current_business_id());

CREATE POLICY callers_tenant_isolation ON callers
  FOR ALL
  USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY calls_tenant_isolation ON calls
  FOR ALL
  USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY appointments_tenant_isolation ON appointments
  FOR ALL
  USING (business_id = app_current_business_id())
  WITH CHECK (business_id = app_current_business_id());

CREATE POLICY admin_users_tenant_isolation ON admin_users
  FOR ALL
  USING (business_id IS NULL OR business_id = app_current_business_id())
  WITH CHECK (business_id IS NULL OR business_id = app_current_business_id());

-- Child tables via parent call / appointment / lead
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments FORCE ROW LEVEL SECURITY;
ALTER TABLE tool_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_invocations FORCE ROW LEVEL SECURITY;
ALTER TABLE call_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_outcomes FORCE ROW LEVEL SECURITY;
ALTER TABLE automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_events FORCE ROW LEVEL SECURITY;
ALTER TABLE lead_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_qualifications FORCE ROW LEVEL SECURITY;
ALTER TABLE lead_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_answers FORCE ROW LEVEL SECURITY;
ALTER TABLE appointment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_events FORCE ROW LEVEL SECURITY;
ALTER TABLE automation_event_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_event_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY transcript_segments_tenant ON transcript_segments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = transcript_segments.call_id
        AND c.business_id = app_current_business_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = transcript_segments.call_id
        AND c.business_id = app_current_business_id()
    )
  );

CREATE POLICY tool_invocations_tenant ON tool_invocations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = tool_invocations.call_id
        AND c.business_id = app_current_business_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = tool_invocations.call_id
        AND c.business_id = app_current_business_id()
    )
  );

CREATE POLICY call_outcomes_tenant ON call_outcomes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = call_outcomes.call_id
        AND c.business_id = app_current_business_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = call_outcomes.call_id
        AND c.business_id = app_current_business_id()
    )
  );

CREATE POLICY automation_events_tenant ON automation_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = automation_events.call_id
        AND c.business_id = app_current_business_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = automation_events.call_id
        AND c.business_id = app_current_business_id()
    )
  );

CREATE POLICY lead_qualifications_tenant ON lead_qualifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = lead_qualifications.call_id
        AND c.business_id = app_current_business_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = lead_qualifications.call_id
        AND c.business_id = app_current_business_id()
    )
  );

CREATE POLICY lead_answers_tenant ON lead_answers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lead_qualifications lq
      JOIN calls c ON c.id = lq.call_id
      WHERE lq.id = lead_answers.lead_qualification_id
        AND c.business_id = app_current_business_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lead_qualifications lq
      JOIN calls c ON c.id = lq.call_id
      WHERE lq.id = lead_answers.lead_qualification_id
        AND c.business_id = app_current_business_id()
    )
  );

CREATE POLICY appointment_events_tenant ON appointment_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_events.appointment_id
        AND a.business_id = app_current_business_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_events.appointment_id
        AND a.business_id = app_current_business_id()
    )
  );

CREATE POLICY automation_event_attempts_tenant ON automation_event_attempts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM automation_events ae
      JOIN calls c ON c.id = ae.call_id
      WHERE ae.id = automation_event_attempts.automation_event_id
        AND c.business_id = app_current_business_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM automation_events ae
      JOIN calls c ON c.id = ae.call_id
      WHERE ae.id = automation_event_attempts.automation_event_id
        AND c.business_id = app_current_business_id()
    )
  );

CREATE POLICY webhook_events_tenant ON webhook_events
  FOR ALL
  USING (
    call_id IS NULL
    OR EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = webhook_events.call_id
        AND c.business_id = app_current_business_id()
    )
  )
  WITH CHECK (
    call_id IS NULL
    OR EXISTS (
      SELECT 1 FROM calls c
      WHERE c.id = webhook_events.call_id
        AND c.business_id = app_current_business_id()
    )
  );

-- audit_log: readable when business context set; inserts allowed for system
CREATE POLICY audit_log_select ON audit_log
  FOR SELECT
  USING (app_current_business_id() IS NOT NULL);

CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT
  WITH CHECK (true);
