import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRetellSignature } from "../src/services/retell-signature.js";

describe("verifyRetellSignature", () => {
  const apiKey = "key_test_retell";
  const body = JSON.stringify({ event: "call_ended", call: { call_id: "c1" } });

  function sign(raw: string, key: string, ts: number): string {
    const digest = createHmac("sha256", key)
      .update(raw + String(ts), "utf8")
      .digest("hex");
    return `v=${ts},d=${digest}`;
  }

  it("accepts a fresh valid signature", () => {
    const ts = Date.now();
    expect(verifyRetellSignature(body, apiKey, sign(body, apiKey, ts))).toBe(true);
  });

  it("rejects wrong api key", () => {
    const ts = Date.now();
    expect(verifyRetellSignature(body, apiKey, sign(body, "other_key", ts))).toBe(false);
  });

  it("rejects tampered body", () => {
    const ts = Date.now();
    const header = sign(body, apiKey, ts);
    expect(verifyRetellSignature(body + " ", apiKey, header)).toBe(false);
  });

  it("rejects stale timestamp", () => {
    const ts = Date.now() - 10 * 60 * 1000;
    expect(verifyRetellSignature(body, apiKey, sign(body, apiKey, ts))).toBe(false);
  });

  it("rejects malformed header", () => {
    expect(verifyRetellSignature(body, apiKey, "not-a-sig")).toBe(false);
  });
});
