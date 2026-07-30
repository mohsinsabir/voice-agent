-- Core schema for AI voice agent (see docs/database-schema.md)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE TABLE businesses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    timezone text NOT NULL DEFAULT 'America/New_York',
    business_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE callers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    phone_e164 text NOT NULL,
    email text,
    display_name text,
    hubspot_contact_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT callers_phone_format CHECK (phone_e164 ~ '^\+[1-9][0-9]{6,14}$')
);

CREATE UNIQUE INDEX callers_business_phone_uidx ON callers (business_id, phone_e164);
CREATE INDEX callers_hubspot_contact_idx ON callers (hubspot_contact_id) WHERE hubspot_contact_id IS NOT NULL;

CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE call_status AS ENUM ('in_progress', 'completed', 'failed', 'no_answer', 'voicemail');
CREATE TYPE call_disposition AS ENUM (
    'booked', 'rescheduled', 'cancelled', 'qualified_lead', 'unqualified_lead',
    'human_handoff', 'no_action', 'error', 'abandoned'
);

CREATE TABLE calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    caller_id uuid REFERENCES callers(id) ON DELETE SET NULL,
    provider_call_id text NOT NULL,
    direction call_direction NOT NULL,
    status call_status NOT NULL DEFAULT 'in_progress',
    disposition call_disposition,
    recording_url text,
    sentiment_score numeric(4,3),
    sentiment_label text CHECK (sentiment_label IN ('positive','neutral','negative')),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX calls_provider_call_id_uidx ON calls (provider_call_id);
CREATE INDEX calls_business_started_idx ON calls (business_id, started_at DESC);
CREATE INDEX calls_disposition_idx ON calls (disposition);

CREATE TABLE transcript_segments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    sequence int NOT NULL,
    speaker text NOT NULL CHECK (speaker IN ('agent','caller')),
    content_redacted text NOT NULL,
    content_raw_encrypted bytea,
    contains_pii boolean NOT NULL DEFAULT false,
    spoken_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX transcript_segments_call_seq_uidx ON transcript_segments (call_id, sequence);

CREATE TABLE tool_invocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    tool_name text NOT NULL,
    input jsonb NOT NULL,
    output jsonb,
    status text NOT NULL CHECK (status IN ('pending','success','failed','timeout')),
    latency_ms int,
    invoked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tool_invocations_call_idx ON tool_invocations (call_id);
CREATE INDEX tool_invocations_tool_status_idx ON tool_invocations (tool_name, status);

CREATE TYPE appointment_status AS ENUM ('booked','rescheduled','cancelled','completed','no_show');

CREATE TABLE appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    caller_id uuid NOT NULL REFERENCES callers(id) ON DELETE CASCADE,
    call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
    calendar_event_id text NOT NULL,
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    timezone text NOT NULL,
    status appointment_status NOT NULL DEFAULT 'booked',
    service_type text NOT NULL DEFAULT 'general_checkup',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    time_range tstzrange GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED,
    CONSTRAINT appointments_time_order CHECK (end_time > start_time)
);

CREATE UNIQUE INDEX appointments_calendar_event_uidx ON appointments (calendar_event_id);
CREATE INDEX appointments_business_time_idx ON appointments (business_id, start_time);
CREATE INDEX appointments_caller_idx ON appointments (caller_id);
CREATE INDEX appointments_time_range_gist ON appointments USING gist (business_id, time_range);

ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
    EXCLUDE USING gist (
        business_id WITH =,
        time_range WITH &&
    ) WHERE (status = 'booked');

CREATE TABLE appointment_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    event_type text NOT NULL CHECK (event_type IN ('created','rescheduled','cancelled','reminder_sent','completed','no_show')),
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE qualification_status AS ENUM ('qualified','unqualified','needs_review','incomplete');

CREATE TABLE lead_qualifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    caller_id uuid NOT NULL REFERENCES callers(id) ON DELETE CASCADE,
    score int NOT NULL DEFAULT 0,
    qualification_status qualification_status NOT NULL DEFAULT 'incomplete',
    next_action text NOT NULL CHECK (next_action IN ('book','transfer','callback','follow_up','none')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lead_answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_qualification_id uuid NOT NULL REFERENCES lead_qualifications(id) ON DELETE CASCADE,
    question_key text NOT NULL,
    answer_value text NOT NULL,
    valid boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lead_answers_lead_idx ON lead_answers (lead_qualification_id);

CREATE TABLE call_outcomes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    outcome_type text NOT NULL,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE automation_status AS ENUM ('pending','sent','acknowledged','failed','dead_letter');

CREATE TABLE automation_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    dedupe_key text NOT NULL,
    status automation_status NOT NULL DEFAULT 'pending',
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX automation_events_dedupe_uidx ON automation_events (dedupe_key);
CREATE INDEX automation_events_status_idx ON automation_events (status);

CREATE TABLE automation_event_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_event_id uuid NOT NULL REFERENCES automation_events(id) ON DELETE CASCADE,
    attempt_number int NOT NULL,
    status text NOT NULL CHECK (status IN ('success','failed')),
    error_message text,
    attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX automation_event_attempts_event_idx ON automation_event_attempts (automation_event_id);

CREATE TYPE webhook_status AS ENUM ('received','processing','processed','ignored_duplicate','failed');

CREATE TABLE webhook_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source text NOT NULL CHECK (source IN ('retell','n8n','google_calendar','hubspot','twilio','sendgrid')),
    external_event_id text NOT NULL,
    event_type text NOT NULL,
    status webhook_status NOT NULL DEFAULT 'received',
    call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
    raw_payload jsonb NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);

CREATE UNIQUE INDEX webhook_events_source_external_id_uidx ON webhook_events (source, external_event_id);

CREATE TYPE admin_role AS ENUM ('admin','staff','read_only');

CREATE TABLE admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role admin_role NOT NULL DEFAULT 'staff',
    business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type text NOT NULL CHECK (actor_type IN ('admin_user','system','agent')),
    actor_id text,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    before_state jsonb,
    after_state jsonb,
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_resource_idx ON audit_log (resource_type, resource_id);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'voice_app') THEN
    GRANT USAGE ON SCHEMA public TO voice_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO voice_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO voice_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO voice_app;
  END IF;
END
$$;
