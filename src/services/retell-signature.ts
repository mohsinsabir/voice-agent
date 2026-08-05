import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify Retell `x-retell-signature` (HMAC-SHA256 of rawBody + timestamp, keyed by API key).
 * Header format: `v={unix_ms},d={hex_digest}`
 * @see https://docs.retellai.com/features/secure-webhook
 */
export function verifyRetellSignature(
  rawBody: string,
  apiKey: string,
  signatureHeader: string,
  maxAgeMs = 5 * 60 * 1000,
): boolean {
  const match = /^v=(\d+),d=(.*)$/.exec(signatureHeader.trim());
  if (!match) return false;

  const timestamp = match[1]!;
  const digest = match[2]!;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > maxAgeMs) {
    return false;
  }

  const expected = createHmac("sha256", apiKey)
    .update(rawBody + timestamp, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(digest, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
