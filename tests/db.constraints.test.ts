import { describe, expect, it, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { loadEnv, resetEnvCache } from "../src/config/env.js";
import { recordAutomationEvent } from "../src/db/idempotency.js";
import { closePool, getPool, withBusinessContext } from "../src/db/pool.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("idempotency constraints", () => {
  let businessId: string;
  let callId: string;

  beforeAll(async () => {
    resetEnvCache();
    loadEnv();
    const pool = getPool();

    // Migrator/superuser connection may bypass RLS; still set GUC for safety.
    const biz = await pool.query<{ id: string }>(
      `SELECT id FROM businesses WHERE name = $1 LIMIT 1`,
      [process.env.DEFAULT_BUSINESS_NAME || "Bright Smile Dental"],
    );
    businessId = biz.rows[0]?.id ?? "";
    if (!businessId) {
      throw new Error("Seed business missing — run migrations first");
    }

    await withBusinessContext(businessId, async (client) => {
      const call = await client.query<{ id: string }>(
        `INSERT INTO calls (business_id, provider_call_id, direction, status)
         VALUES ($1, $2, 'inbound', 'completed')
         RETURNING id`,
        [businessId, `test-call-${Date.now()}`],
      );
      callId = call.rows[0]!.id;
    });
  });

  afterAll(async () => {
    if (businessId && callId) {
      await withBusinessContext(businessId, async (client) => {
        await client.query(`DELETE FROM automation_events WHERE call_id = $1`, [callId]);
        await client.query(`DELETE FROM calls WHERE id = $1`, [callId]);
      });
    }
    await closePool();
  });

  it("rejects duplicate automation_events.dedupe_key via helper", async () => {
    const dedupeKey = `${callId}:call.completed`;
    const first = await withBusinessContext(businessId, (client) =>
      recordAutomationEvent(
        {
          callId,
          eventType: "call.completed",
          dedupeKey,
          payload: { ok: true },
        },
        client,
      ),
    );
    expect(first.status).toBe("accepted");

    const second = await withBusinessContext(businessId, (client) =>
      recordAutomationEvent(
        {
          callId,
          eventType: "call.completed",
          dedupeKey,
          payload: { ok: true },
        },
        client,
      ),
    );
    expect(second.status).toBe("ignored_duplicate");
  });

  it("rejects overlapping booked appointments for the same business", async () => {
    await withBusinessContext(businessId, async (client) => {
      const caller = await client.query<{ id: string }>(
        `INSERT INTO callers (business_id, phone_e164, display_name)
         VALUES ($1, $2, 'Overlap Test')
         ON CONFLICT (business_id, phone_e164) DO UPDATE SET display_name = EXCLUDED.display_name
         RETURNING id`,
        [businessId, "+15550001111"],
      );
      const callerId = caller.rows[0]!.id;
      const start = new Date("2030-01-15T15:00:00Z");
      const end = new Date("2030-01-15T15:30:00Z");

      await client.query(
        `INSERT INTO appointments (
           business_id, caller_id, calendar_event_id, start_time, end_time, timezone, status, service_type
         ) VALUES ($1, $2, $3, $4, $5, 'America/New_York', 'booked', 'cleaning')`,
        [
          businessId,
          callerId,
          `gcal-overlap-a-${Date.now()}`,
          start.toISOString(),
          end.toISOString(),
        ],
      );

      let rejected = false;
      try {
        await client.query("SAVEPOINT overlap_test");
        await client.query(
          `INSERT INTO appointments (
             business_id, caller_id, calendar_event_id, start_time, end_time, timezone, status, service_type
           ) VALUES ($1, $2, $3, $4, $5, 'America/New_York', 'booked', 'cleaning')`,
          [
            businessId,
            callerId,
            `gcal-overlap-b-${Date.now()}`,
            start.toISOString(),
            end.toISOString(),
          ],
        );
        await client.query("RELEASE SAVEPOINT overlap_test");
      } catch (err: unknown) {
        const code =
          typeof err === "object" && err && "code" in err ? (err as { code: string }).code : "";
        rejected = code === "23P01" || code === "23505";
        await client.query("ROLLBACK TO SAVEPOINT overlap_test");
      }
      expect(rejected).toBe(true);

      await client.query(`DELETE FROM appointments WHERE caller_id = $1`, [callerId]);
      await client.query(`DELETE FROM callers WHERE id = $1`, [callerId]);
    });
  });
});

describe.runIf(hasDb)("RLS negative access", () => {
  it("returns no businesses when app.current_business_id is unset (voice_app)", async () => {
    const appUrl = process.env.DATABASE_URL_APP;
    if (!appUrl) {
      // Skip softly if only superuser URL is configured.
      expect(true).toBe(true);
      return;
    }
    const client = new pg.Client({ connectionString: appUrl });
    await client.connect();
    try {
      const result = await client.query("SELECT count(*)::int AS n FROM businesses");
      expect(result.rows[0]?.n).toBe(0);
    } finally {
      await client.end();
    }
  });
});
