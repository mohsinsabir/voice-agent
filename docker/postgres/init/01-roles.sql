-- App runtime role (no BYPASSRLS, no DDL). Password matches local docker-compose defaults.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'voice_app') THEN
    CREATE ROLE voice_app LOGIN PASSWORD 'voice_app' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE voice_agent TO voice_app;
