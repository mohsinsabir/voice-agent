const fs = require("fs");
const path = require("path");

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, "sql", "001_init_schema.sql");
  pgm.sql(fs.readFileSync(sqlPath, "utf8"));
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS audit_log CASCADE;
    DROP TABLE IF EXISTS admin_users CASCADE;
    DROP TABLE IF EXISTS webhook_events CASCADE;
    DROP TABLE IF EXISTS automation_event_attempts CASCADE;
    DROP TABLE IF EXISTS automation_events CASCADE;
    DROP TABLE IF EXISTS call_outcomes CASCADE;
    DROP TABLE IF EXISTS lead_answers CASCADE;
    DROP TABLE IF EXISTS lead_qualifications CASCADE;
    DROP TABLE IF EXISTS appointment_events CASCADE;
    DROP TABLE IF EXISTS appointments CASCADE;
    DROP TABLE IF EXISTS tool_invocations CASCADE;
    DROP TABLE IF EXISTS transcript_segments CASCADE;
    DROP TABLE IF EXISTS calls CASCADE;
    DROP TABLE IF EXISTS callers CASCADE;
    DROP TABLE IF EXISTS businesses CASCADE;
    DROP TYPE IF EXISTS admin_role;
    DROP TYPE IF EXISTS webhook_status;
    DROP TYPE IF EXISTS automation_status;
    DROP TYPE IF EXISTS qualification_status;
    DROP TYPE IF EXISTS appointment_status;
    DROP TYPE IF EXISTS call_disposition;
    DROP TYPE IF EXISTS call_status;
    DROP TYPE IF EXISTS call_direction;
  `);
};
