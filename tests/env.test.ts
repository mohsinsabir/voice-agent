import { describe, expect, it, afterEach } from "vitest";
import { loadEnv, resetEnvCache } from "../src/config/env.js";

describe("loadEnv", () => {
  afterEach(() => {
    resetEnvCache();
  });

  it("loads Phase 1 core config", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://voice:voice@localhost:5432/voice_agent",
      ENABLE_RETELL: "false",
      ENABLE_CALENDAR: "false",
      ENABLE_MESSAGING: "false",
      ENABLE_N8N: "false",
      ENABLE_HUBSPOT: "false",
    });
    expect(env.DATABASE_URL).toContain("postgres://");
    expect(env.PORT).toBe(3000);
    expect(env.ENABLE_RETELL).toBe(false);
  });

  it("fails closed when DATABASE_URL is missing", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "test",
        ENABLE_RETELL: "false",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("requires Retell API key and agent id when ENABLE_RETELL=true", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "test",
        DATABASE_URL: "postgres://voice:voice@localhost:5432/voice_agent",
        ENABLE_RETELL: "true",
      }),
    ).toThrow(/Retell/);

    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://voice:voice@localhost:5432/voice_agent",
      ENABLE_RETELL: "true",
      RETELL_API_KEY: "key_test",
      RETELL_AGENT_ID: "agent_test",
      ENABLE_CALENDAR: "false",
      ENABLE_MESSAGING: "false",
      ENABLE_N8N: "false",
      ENABLE_HUBSPOT: "false",
    });
    expect(env.RETELL_AGENT_ID).toBe("agent_test");
  });

  it("requires Google Calendar vars when ENABLE_CALENDAR=true", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "test",
        DATABASE_URL: "postgres://voice:voice@localhost:5432/voice_agent",
        ENABLE_CALENDAR: "true",
      }),
    ).toThrow(/Google Calendar/);

    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://voice:voice@localhost:5432/voice_agent",
      ENABLE_CALENDAR: "true",
      GOOGLE_CALENDAR_ID: "clinic@example.com",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "sa@project.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n",
      ENABLE_RETELL: "false",
      ENABLE_MESSAGING: "false",
      ENABLE_N8N: "false",
      ENABLE_HUBSPOT: "false",
    });
    expect(env.GOOGLE_CALENDAR_ID).toBe("clinic@example.com");
  });
});
