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

  it("requires Retell secrets when ENABLE_RETELL=true", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "test",
        DATABASE_URL: "postgres://voice:voice@localhost:5432/voice_agent",
        ENABLE_RETELL: "true",
      }),
    ).toThrow(/Retell/);
  });
});
