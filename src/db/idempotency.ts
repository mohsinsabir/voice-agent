import type { PoolClient } from "pg";
import { getPool } from "./pool.js";

export type WebhookSource =
  | "retell"
  | "n8n"
  | "google_calendar"
  | "hubspot"
  | "twilio"
  | "sendgrid";

export type RecordWebhookResult =
  | { status: "accepted"; id: string }
  | { status: "ignored_duplicate"; id: string };

/**
 * Insert into webhook_events. On unique conflict, mark ignored_duplicate semantics.
 */
export async function recordWebhookEvent(
  input: {
    source: WebhookSource;
    externalEventId: string;
    eventType: string;
    rawPayload: unknown;
    callId?: string | null;
  },
  client?: PoolClient,
): Promise<RecordWebhookResult> {
  const db = client ?? getPool();
  const useSavepoint = Boolean(client);
  if (useSavepoint) await db.query("SAVEPOINT webhook_dedupe");
  try {
    const result = await db.query<{ id: string }>(
      `INSERT INTO webhook_events (source, external_event_id, event_type, status, call_id, raw_payload)
       VALUES ($1, $2, $3, 'received', $4, $5::jsonb)
       RETURNING id`,
      [
        input.source,
        input.externalEventId,
        input.eventType,
        input.callId ?? null,
        JSON.stringify(input.rawPayload),
      ],
    );
    if (useSavepoint) await db.query("RELEASE SAVEPOINT webhook_dedupe");
    return { status: "accepted", id: result.rows[0]!.id };
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err && "code" in err ? (err as { code: string }).code : "";
    if (code === "23505") {
      if (useSavepoint) await db.query("ROLLBACK TO SAVEPOINT webhook_dedupe");
      const existing = await db.query<{ id: string }>(
        `SELECT id FROM webhook_events WHERE source = $1 AND external_event_id = $2`,
        [input.source, input.externalEventId],
      );
      return { status: "ignored_duplicate", id: existing.rows[0]?.id ?? "" };
    }
    if (useSavepoint) await db.query("ROLLBACK TO SAVEPOINT webhook_dedupe");
    throw err;
  }
}

/**
 * Insert automation_events with dedupe_key unique constraint as backstop.
 */
export async function recordAutomationEvent(
  input: {
    callId: string;
    eventType: string;
    dedupeKey: string;
    payload: unknown;
  },
  client?: PoolClient,
): Promise<{ status: "accepted" | "ignored_duplicate"; id: string }> {
  const db = client ?? getPool();
  const useSavepoint = Boolean(client);
  if (useSavepoint) await db.query("SAVEPOINT automation_dedupe");
  try {
    const result = await db.query<{ id: string }>(
      `INSERT INTO automation_events (call_id, event_type, dedupe_key, status, payload)
       VALUES ($1, $2, $3, 'pending', $4::jsonb)
       RETURNING id`,
      [input.callId, input.eventType, input.dedupeKey, JSON.stringify(input.payload)],
    );
    if (useSavepoint) await db.query("RELEASE SAVEPOINT automation_dedupe");
    return { status: "accepted", id: result.rows[0]!.id };
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err && "code" in err ? (err as { code: string }).code : "";
    if (code === "23505") {
      if (useSavepoint) await db.query("ROLLBACK TO SAVEPOINT automation_dedupe");
      const existing = await db.query<{ id: string }>(
        `SELECT id FROM automation_events WHERE dedupe_key = $1`,
        [input.dedupeKey],
      );
      return { status: "ignored_duplicate", id: existing.rows[0]?.id ?? "" };
    }
    if (useSavepoint) await db.query("ROLLBACK TO SAVEPOINT automation_dedupe");
    throw err;
  }
}
