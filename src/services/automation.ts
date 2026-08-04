import type { PoolClient } from "pg";
import { getEnv } from "../config/env.js";
import { logger } from "../config/logger.js";
import { recordAutomationEvent } from "../db/idempotency.js";

export type CallCompletedPayload = {
  event_id: string;
  event_type: "call.completed";
  dedupe_key: string;
  call: {
    call_id: string;
    provider_call_id: string;
    business_id: string;
    direction: string | null;
    disposition: string | null;
    sentiment_label: string | null;
    started_at: string | null;
    ended_at: string | null;
  };
  caller: {
    caller_id: string;
    name: string | null;
    phone_e164: string;
    email: string | null;
    hubspot_contact_id: string | null;
  } | null;
  appointment: {
    appointment_id: string;
    start_time: string;
    end_time: string;
    service_type: string;
    status: string;
  } | null;
  lead_qualification: {
    qualification_status: string;
    score: number;
    next_action: string;
  } | null;
  handoff_requested: boolean;
  transcript_url: string | null;
  meta: { source: "backend"; schema_version: "1" };
};

async function buildPayload(
  client: PoolClient,
  businessId: string,
  callId: string,
  providerCallId: string,
  eventId: string,
  dedupeKey: string,
): Promise<CallCompletedPayload> {
  const call = await client.query<{
    direction: string | null;
    disposition: string | null;
    sentiment_label: string | null;
    started_at: Date | null;
    ended_at: Date | null;
    caller_id: string | null;
  }>(
    `SELECT direction, disposition::text, sentiment_label, started_at, ended_at, caller_id
     FROM calls WHERE id = $1`,
    [callId],
  );
  const c = call.rows[0];

  let caller: CallCompletedPayload["caller"] = null;
  if (c?.caller_id) {
    const row = await client.query<{
      id: string;
      display_name: string | null;
      phone_e164: string;
      email: string | null;
      hubspot_contact_id: string | null;
    }>(
      `SELECT id, display_name, phone_e164, email, hubspot_contact_id
       FROM callers WHERE id = $1`,
      [c.caller_id],
    );
    const cl = row.rows[0];
    if (cl) {
      caller = {
        caller_id: cl.id,
        name: cl.display_name,
        phone_e164: cl.phone_e164,
        email: cl.email,
        hubspot_contact_id: cl.hubspot_contact_id,
      };
    }
  }

  const appt = await client.query<{
    id: string;
    start_time: Date;
    end_time: Date;
    service_type: string;
    status: string;
  }>(
    `SELECT id, start_time, end_time, service_type, status::text
     FROM appointments
     WHERE call_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [callId],
  );
  const a = appt.rows[0];
  const appointment = a
    ? {
        appointment_id: a.id,
        start_time: a.start_time.toISOString(),
        end_time: a.end_time.toISOString(),
        service_type: a.service_type,
        status: a.status,
      }
    : null;

  const lead = await client.query<{
    qualification_status: string;
    score: number;
    next_action: string;
  }>(
    `SELECT qualification_status::text, score, next_action
     FROM lead_qualifications
     WHERE call_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [callId],
  );
  const l = lead.rows[0];
  const lead_qualification = l
    ? {
        qualification_status: l.qualification_status,
        score: l.score,
        next_action: l.next_action,
      }
    : null;

  const handoff = await client.query<{ ok: number }>(
    `SELECT 1 AS ok FROM call_outcomes
     WHERE call_id = $1 AND outcome_type = 'human_handoff'
     LIMIT 1`,
    [callId],
  );

  return {
    event_id: eventId,
    event_type: "call.completed",
    dedupe_key: dedupeKey,
    call: {
      call_id: callId,
      provider_call_id: providerCallId,
      business_id: businessId,
      direction: c?.direction ?? null,
      disposition: c?.disposition ?? null,
      sentiment_label: c?.sentiment_label ?? null,
      started_at: c?.started_at?.toISOString() ?? null,
      ended_at: c?.ended_at?.toISOString() ?? null,
    },
    caller,
    appointment,
    lead_qualification,
    handoff_requested: Boolean(handoff.rows[0]),
    transcript_url: null,
    meta: { source: "backend", schema_version: "1" },
  };
}

async function dispatchToN8n(payload: CallCompletedPayload): Promise<boolean> {
  const env = getEnv();
  if (!env.ENABLE_N8N || !env.N8N_WEBHOOK_URL || !env.N8N_WEBHOOK_SECRET) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Automation-Secret": env.N8N_WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      logger.warn({ status: res.status, eventId: payload.event_id }, "n8n webhook non-OK");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, eventId: payload.event_id }, "n8n webhook failed");
    return false;
  }
}

/**
 * Write call.completed automation_events (deduped) and optionally POST to n8n.
 * Safe to call more than once for the same call.
 */
export async function emitCallCompleted(
  client: PoolClient,
  businessId: string,
  callId: string,
  providerCallId: string,
): Promise<{ status: "accepted" | "ignored_duplicate"; dispatched: boolean }> {
  const dedupeKey = `${callId}:call.completed`;
  const recorded = await recordAutomationEvent(
    {
      callId,
      eventType: "call.completed",
      dedupeKey,
      payload: { provider_call_id: providerCallId },
    },
    client,
  );

  if (recorded.status === "ignored_duplicate") {
    return { status: "ignored_duplicate", dispatched: false };
  }

  const payload = await buildPayload(
    client,
    businessId,
    callId,
    providerCallId,
    recorded.id,
    dedupeKey,
  );

  await client.query(`UPDATE automation_events SET payload = $2::jsonb WHERE id = $1`, [
    recorded.id,
    JSON.stringify(payload),
  ]);

  // Fire-and-forget after commit would be nicer; dispatch here is best-effort within request.
  const dispatched = await dispatchToN8n(payload);
  if (dispatched) {
    await client.query(
      `UPDATE automation_events SET status = 'sent', updated_at = now() WHERE id = $1`,
      [recorded.id],
    );
  }

  logger.info(
    { callId, providerCallId, eventId: recorded.id, dispatched },
    "call.completed automation event",
  );

  return { status: "accepted", dispatched };
}
