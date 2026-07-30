const fs = require("fs");
const path = require("path");

exports.up = (pgm) => {
  pgm.sql(fs.readFileSync(path.join(__dirname, "sql", "002_rls.sql"), "utf8"));
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP POLICY IF EXISTS audit_log_insert ON audit_log;
    DROP POLICY IF EXISTS audit_log_select ON audit_log;
    DROP POLICY IF EXISTS webhook_events_tenant ON webhook_events;
    DROP POLICY IF EXISTS automation_event_attempts_tenant ON automation_event_attempts;
    DROP POLICY IF EXISTS appointment_events_tenant ON appointment_events;
    DROP POLICY IF EXISTS lead_answers_tenant ON lead_answers;
    DROP POLICY IF EXISTS lead_qualifications_tenant ON lead_qualifications;
    DROP POLICY IF EXISTS automation_events_tenant ON automation_events;
    DROP POLICY IF EXISTS call_outcomes_tenant ON call_outcomes;
    DROP POLICY IF EXISTS tool_invocations_tenant ON tool_invocations;
    DROP POLICY IF EXISTS transcript_segments_tenant ON transcript_segments;
    DROP POLICY IF EXISTS admin_users_tenant_isolation ON admin_users;
    DROP POLICY IF EXISTS appointments_tenant_isolation ON appointments;
    DROP POLICY IF EXISTS calls_tenant_isolation ON calls;
    DROP POLICY IF EXISTS callers_tenant_isolation ON callers;
    DROP POLICY IF EXISTS businesses_tenant_isolation ON businesses;
    DROP FUNCTION IF EXISTS app_current_business_id();
  `);
};
