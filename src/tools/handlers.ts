import { z } from "zod";
import * as chrono from "chrono-node";
import { getEnv } from "../config/env.js";
import { getBusinessMeta, withDefaultBusiness } from "../services/business.js";
import {
  CalendarError,
  createCalendarEvent,
  deleteCalendarEvent,
  isSlotFree,
  queryFreeBusy,
  updateCalendarEvent,
} from "../services/calendar.js";
import {
  ensureCall,
  findSuccessfulToolResult,
  logToolInvocation,
} from "../services/calls.js";
import { scoreLeadAnswers } from "../services/lead-scoring.js";
import {
  alternativesNear,
  findAvailableSlots,
  parseSlotStart,
  withinBusinessHours,
} from "../services/slots.js";
import { formatInZone } from "../services/time.js";
import { failResult, okResult, type ToolRequest, type ToolResult } from "./types.js";

const PhoneSchema = z.string().regex(/^\+[1-9]\d{6,14}$/, "Must be E.164");

const ServiceType = z.enum(["general_checkup", "cleaning", "consultation", "emergency"]);

const DEFAULT_DURATION_MIN = 30;

async function runLogged(
  req: ToolRequest,
  toolName: string,
  fn: (ctx: {
    client: import("pg").PoolClient;
    businessId: string;
    callId: string;
  }) => Promise<ToolResult>,
): Promise<ToolResult> {
  const started = Date.now();
  return withDefaultBusiness(async (client, businessId) => {
    const callId = await ensureCall(client, businessId, req.call.call_id);
    try {
      const result = await fn({ client, businessId, callId });
      const success = result.result.success !== false;
      await logToolInvocation(client, {
        callId,
        toolName,
        args: req.args,
        output: result.result,
        status: success ? "success" : "failed",
        latencyMs: Date.now() - started,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const result = failResult("DB_UNAVAILABLE", message);
      await logToolInvocation(client, {
        callId,
        toolName,
        args: req.args,
        output: result.result,
        status: "failed",
        latencyMs: Date.now() - started,
      });
      return result;
    }
  });
}

export async function dispatchTool(req: ToolRequest): Promise<ToolResult> {
  switch (req.name) {
    case "checkAvailability":
      return checkAvailability(req);
    case "bookAppointment":
      return bookAppointment(req);
    case "rescheduleAppointment":
      return rescheduleAppointment(req);
    case "cancelAppointment":
      return cancelAppointment(req);
    case "createOrUpdateContact":
      return createOrUpdateContact(req);
    case "saveLeadQualification":
      return saveLeadQualification(req);
    case "requestHumanHandoff":
      return requestHumanHandoff(req);
    case "sendConfirmation":
      return sendConfirmation(req);
    case "logCallOutcome":
      return logCallOutcome(req);
    default:
      return failResult("INVALID_INPUT", `Unknown tool: ${req.name}`);
  }
}

async function checkAvailability(req: ToolRequest): Promise<ToolResult> {
  const parsed = z
    .object({
      date_phrase: z.string().min(1).max(200),
      service_type: ServiceType,
      duration_minutes: z.number().int().min(15).max(180).default(DEFAULT_DURATION_MIN),
    })
    .safeParse(req.args);
  if (!parsed.success) {
    return failResult("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  if (!getEnv().ENABLE_CALENDAR) {
    return failResult("CALENDAR_UNAVAILABLE", "Calendar integration not enabled yet");
  }

  return runLogged(req, "checkAvailability", async ({ client, businessId }) => {
    const biz = await getBusinessMeta(client, businessId);
    const found = await findAvailableSlots({
      datePhrase: parsed.data.date_phrase,
      durationMinutes: parsed.data.duration_minutes,
      timeZone: biz.timezone,
      businessHours: biz.business_hours,
    });
    if (!found.ok) {
      return failResult(found.code, found.message);
    }
    return okResult({
      resolved_range: found.resolved_range,
      slots: found.slots,
      ...(found.message ? { message: found.message } : {}),
      service_type: parsed.data.service_type,
    });
  });
}

async function bookAppointment(req: ToolRequest): Promise<ToolResult> {
  const parsed = z
    .object({
      slot_start: z.string().min(1),
      service_type: ServiceType,
      caller_name: z.string().min(1).max(120),
      caller_phone: PhoneSchema,
      caller_email: z.string().email().optional(),
      duration_minutes: z.number().int().min(15).max(180).default(DEFAULT_DURATION_MIN),
    })
    .safeParse(req.args);

  if (!parsed.success) {
    return failResult("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  return runLogged(req, "bookAppointment", async ({ client, businessId, callId }) => {
    const prior = await findSuccessfulToolResult(client, callId, "bookAppointment");
    if (prior) return { result: prior };

    if (!getEnv().ENABLE_CALENDAR) {
      return failResult("CALENDAR_UNAVAILABLE", "Calendar integration not enabled yet");
    }

    const biz = await getBusinessMeta(client, businessId);
    const start = parseSlotStart(parsed.data.slot_start);
    if (!start) {
      return failResult("INVALID_SLOT", "slot_start must be a valid ISO datetime");
    }
    const duration = parsed.data.duration_minutes;
    const end = new Date(start.getTime() + duration * 60_000);

    if (!withinBusinessHours(start, end, biz.timezone, biz.business_hours)) {
      return failResult("INVALID_SLOT", "Slot is outside business hours");
    }
    if (start.getMinutes() % 15 !== 0) {
      return failResult("INVALID_SLOT", "Slot must start on a 15-minute boundary");
    }

    let busy;
    try {
      busy = await queryFreeBusy(start, end);
    } catch (err) {
      return failResult(
        "CALENDAR_UNAVAILABLE",
        err instanceof Error ? err.message : "Could not reach calendar service",
      );
    }

    if (!isSlotFree(start, end, busy)) {
      const alternative_slots = await alternativesNear(
        start,
        duration,
        biz.timezone,
        biz.business_hours,
      );
      return failResult("SLOT_NO_LONGER_AVAILABLE", "Slot was booked by another caller", {
        alternative_slots,
      });
    }

    const caller = await client.query<{ id: string }>(
      `INSERT INTO callers (business_id, phone_e164, display_name, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (business_id, phone_e164)
       DO UPDATE SET
         display_name = EXCLUDED.display_name,
         email = COALESCE(EXCLUDED.email, callers.email),
         updated_at = now()
       RETURNING id`,
      [
        businessId,
        parsed.data.caller_phone,
        parsed.data.caller_name,
        parsed.data.caller_email ?? null,
      ],
    );
    const callerId = caller.rows[0]!.id;
    await client.query(`UPDATE calls SET caller_id = $1 WHERE id = $2`, [callerId, callId]);

    let calendarEventId: string;
    try {
      calendarEventId = await createCalendarEvent({
        summary: `${parsed.data.service_type} — ${parsed.data.caller_name}`,
        description: `Phone: ${parsed.data.caller_phone}\nCall: ${req.call.call_id}`,
        start,
        end,
        timeZone: biz.timezone,
        ...(parsed.data.caller_email ? { attendeeEmail: parsed.data.caller_email } : {}),
      });
    } catch (err) {
      return failResult(
        "CALENDAR_UNAVAILABLE",
        err instanceof CalendarError ? err.message : "Could not create calendar event",
      );
    }

    try {
      const appt = await client.query<{ id: string }>(
        `INSERT INTO appointments (
           business_id, caller_id, call_id, calendar_event_id,
           start_time, end_time, timezone, status, service_type
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'booked', $8)
         RETURNING id`,
        [
          businessId,
          callerId,
          callId,
          calendarEventId,
          start.toISOString(),
          end.toISOString(),
          biz.timezone,
          parsed.data.service_type,
        ],
      );
      await client.query(
        `INSERT INTO appointment_events (appointment_id, event_type, payload)
         VALUES ($1, 'created', $2::jsonb)`,
        [appt.rows[0]!.id, JSON.stringify({ calendar_event_id: calendarEventId })],
      );
      await client.query(
        `UPDATE calls SET disposition = 'booked' WHERE id = $1`,
        [callId],
      );

      return okResult({
        appointment_id: appt.rows[0]!.id,
        calendar_event_id: calendarEventId,
        confirmed_start: formatInZone(start, biz.timezone),
        confirmed_end: formatInZone(end, biz.timezone),
      });
    } catch (err) {
      // ponytail: orphan Calendar event — Phase 3 reconciliation; best-effort delete
      try {
        await deleteCalendarEvent(calendarEventId);
      } catch {
        /* leave for manual/reconcile */
      }
      const message = err instanceof Error ? err.message : "DB insert failed";
      if (/overlap|exclude|unique|duplicate/i.test(message)) {
        const alternative_slots = await alternativesNear(
          start,
          duration,
          biz.timezone,
          biz.business_hours,
        );
        return failResult("SLOT_NO_LONGER_AVAILABLE", "Slot was booked by another caller", {
          alternative_slots,
        });
      }
      return failResult("DB_UNAVAILABLE", message);
    }
  });
}

async function rescheduleAppointment(req: ToolRequest): Promise<ToolResult> {
  const parsed = z
    .object({
      appointment_id: z.string().uuid(),
      new_slot_start: z.string().min(1),
      duration_minutes: z.number().int().min(15).max(180).default(DEFAULT_DURATION_MIN),
    })
    .safeParse(req.args);
  if (!parsed.success) {
    return failResult("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  if (!getEnv().ENABLE_CALENDAR) {
    return failResult("CALENDAR_UNAVAILABLE", "Calendar integration not enabled yet");
  }

  return runLogged(req, "rescheduleAppointment", async ({ client, businessId, callId }) => {
    const biz = await getBusinessMeta(client, businessId);
    const appt = await client.query<{
      id: string;
      caller_id: string;
      calendar_event_id: string;
      start_time: Date;
      status: string;
    }>(
      `SELECT id, caller_id, calendar_event_id, start_time, status
       FROM appointments WHERE id = $1 AND business_id = $2`,
      [parsed.data.appointment_id, businessId],
    );
    const row = appt.rows[0];
    if (!row) return failResult("NOT_FOUND", "Appointment not found");
    if (row.status === "cancelled") {
      return failResult("ALREADY_CANCELLED", "Appointment is already cancelled");
    }
    if (row.status !== "booked" && row.status !== "rescheduled") {
      return failResult("NOT_FOUND", "Appointment is not active");
    }

    const callCaller = await client.query<{ caller_id: string | null }>(
      `SELECT caller_id FROM calls WHERE id = $1`,
      [callId],
    );
    const linked = callCaller.rows[0]?.caller_id;
    if (linked && linked !== row.caller_id) {
      return failResult("NOT_OWNED_BY_CALLER", "Appointment does not belong to this caller");
    }

    const start = parseSlotStart(parsed.data.new_slot_start);
    if (!start) {
      return failResult("INVALID_SLOT", "new_slot_start must be a valid ISO datetime");
    }
    const duration = parsed.data.duration_minutes;
    const end = new Date(start.getTime() + duration * 60_000);
    if (!withinBusinessHours(start, end, biz.timezone, biz.business_hours)) {
      return failResult("INVALID_SLOT", "Slot is outside business hours");
    }

    let busy;
    try {
      busy = await queryFreeBusy(start, end);
    } catch (err) {
      return failResult(
        "CALENDAR_UNAVAILABLE",
        err instanceof Error ? err.message : "Could not reach calendar service",
      );
    }
    if (!isSlotFree(start, end, busy)) {
      const alternative_slots = await alternativesNear(
        start,
        duration,
        biz.timezone,
        biz.business_hours,
      );
      return failResult("SLOT_NO_LONGER_AVAILABLE", "Slot was booked by another caller", {
        alternative_slots,
      });
    }

    try {
      await updateCalendarEvent({
        eventId: row.calendar_event_id,
        start,
        end,
        timeZone: biz.timezone,
      });
    } catch (err) {
      return failResult(
        "CALENDAR_UNAVAILABLE",
        err instanceof Error ? err.message : "Could not update calendar event",
      );
    }

    const oldStart = row.start_time;
    await client.query(
      `UPDATE appointments
       SET start_time = $1, end_time = $2, status = 'rescheduled', updated_at = now()
       WHERE id = $3`,
      [start.toISOString(), end.toISOString(), row.id],
    );
    await client.query(
      `INSERT INTO appointment_events (appointment_id, event_type, payload)
       VALUES ($1, 'rescheduled', $2::jsonb)`,
      [
        row.id,
        JSON.stringify({
          old_start: oldStart,
          new_start: start.toISOString(),
        }),
      ],
    );
    await client.query(`UPDATE calls SET disposition = 'rescheduled' WHERE id = $1`, [callId]);

    return okResult({
      appointment_id: row.id,
      old_start: formatInZone(new Date(oldStart), biz.timezone),
      new_start: formatInZone(start, biz.timezone),
    });
  });
}

async function cancelAppointment(req: ToolRequest): Promise<ToolResult> {
  const parsed = z
    .object({
      appointment_id: z.string().uuid(),
      reason: z.string().optional(),
    })
    .safeParse(req.args);
  if (!parsed.success) {
    return failResult("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  if (!getEnv().ENABLE_CALENDAR) {
    return failResult("CALENDAR_UNAVAILABLE", "Calendar integration not enabled yet");
  }

  return runLogged(req, "cancelAppointment", async ({ client, businessId, callId }) => {
    const appt = await client.query<{
      id: string;
      caller_id: string;
      calendar_event_id: string;
      status: string;
    }>(
      `SELECT id, caller_id, calendar_event_id, status
       FROM appointments WHERE id = $1 AND business_id = $2`,
      [parsed.data.appointment_id, businessId],
    );
    const row = appt.rows[0];
    if (!row) return failResult("NOT_FOUND", "Appointment not found");

    if (row.status === "cancelled") {
      return okResult({ appointment_id: row.id, status: "cancelled" });
    }

    const callCaller = await client.query<{ caller_id: string | null }>(
      `SELECT caller_id FROM calls WHERE id = $1`,
      [callId],
    );
    const linked = callCaller.rows[0]?.caller_id;
    if (linked && linked !== row.caller_id) {
      return failResult("NOT_OWNED_BY_CALLER", "Appointment does not belong to this caller");
    }

    try {
      await deleteCalendarEvent(row.calendar_event_id);
    } catch (err) {
      return failResult(
        "CALENDAR_UNAVAILABLE",
        err instanceof Error ? err.message : "Could not cancel calendar event",
      );
    }

    await client.query(
      `UPDATE appointments SET status = 'cancelled', updated_at = now() WHERE id = $1`,
      [row.id],
    );
    await client.query(
      `INSERT INTO appointment_events (appointment_id, event_type, payload)
       VALUES ($1, 'cancelled', $2::jsonb)`,
      [row.id, JSON.stringify({ reason: parsed.data.reason ?? null })],
    );
    await client.query(`UPDATE calls SET disposition = 'cancelled' WHERE id = $1`, [callId]);

    return okResult({ appointment_id: row.id, status: "cancelled" });
  });
}

async function createOrUpdateContact(req: ToolRequest): Promise<ToolResult> {
  const parsed = z
    .object({
      name: z.string().min(1).max(120),
      phone: PhoneSchema,
      email: z.string().email().optional(),
    })
    .safeParse(req.args);
  if (!parsed.success) {
    return failResult("INVALID_PHONE_FORMAT", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  return runLogged(req, "createOrUpdateContact", async ({ client, businessId }) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO callers (business_id, phone_e164, display_name, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (business_id, phone_e164)
       DO UPDATE SET
         display_name = EXCLUDED.display_name,
         email = COALESCE(EXCLUDED.email, callers.email),
         updated_at = now()
       RETURNING id`,
      [businessId, parsed.data.phone, parsed.data.name, parsed.data.email ?? null],
    );
    return okResult({ caller_id: result.rows[0]!.id });
  });
}

async function saveLeadQualification(req: ToolRequest): Promise<ToolResult> {
  const parsed = z.object({ answers: z.array(z.any()) }).safeParse(req.args);
  if (!parsed.success) {
    return failResult("INVALID_INPUT", "answers array required");
  }

  const scored = scoreLeadAnswers(parsed.data.answers);
  if (scored.invalid_keys.length > 0 && scored.answers.every((a) => !a.valid)) {
    return failResult("INVALID_QUESTION_KEY", `Unknown keys: ${scored.invalid_keys.join(", ")}`);
  }

  return runLogged(req, "saveLeadQualification", async ({ client, businessId, callId }) => {
    // Ensure a caller row exists for FK — create placeholder from call metadata if needed.
    let callerId: string | null = null;
    const callRow = await client.query<{ caller_id: string | null }>(
      `SELECT caller_id FROM calls WHERE id = $1`,
      [callId],
    );
    callerId = callRow.rows[0]?.caller_id ?? null;

    if (!callerId) {
      const placeholder = await client.query<{ id: string }>(
        `INSERT INTO callers (business_id, phone_e164, display_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (business_id, phone_e164) DO UPDATE SET display_name = EXCLUDED.display_name
         RETURNING id`,
        [businessId, "+15550000000", "Unknown caller"],
      );
      callerId = placeholder.rows[0]!.id;
      await client.query(`UPDATE calls SET caller_id = $1 WHERE id = $2`, [callerId, callId]);
    }

    const lead = await client.query<{ id: string }>(
      `INSERT INTO lead_qualifications (call_id, caller_id, score, qualification_status, next_action)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        callId,
        callerId,
        scored.score,
        scored.qualification_status,
        scored.next_action,
      ],
    );

    for (const answer of scored.answers) {
      await client.query(
        `INSERT INTO lead_answers (lead_qualification_id, question_key, answer_value, valid)
         VALUES ($1, $2, $3, $4)`,
        [lead.rows[0]!.id, answer.question_key, answer.answer_value, answer.valid],
      );
    }

    if (scored.qualification_status === "incomplete") {
      return {
        result: {
          success: false,
          error: { code: "INCOMPLETE_ANSWERS", message: "Missing required qualification fields" },
          qualification_status: scored.qualification_status,
          score: scored.score,
          next_action: scored.next_action,
        },
      };
    }

    return okResult({
      qualification_status: scored.qualification_status,
      score: scored.score,
      next_action: scored.next_action,
    });
  });
}

async function requestHumanHandoff(req: ToolRequest): Promise<ToolResult> {
  const parsed = z
    .object({
      reason: z.string().min(1),
      urgency: z.enum(["low", "medium", "high", "emergency"]),
    })
    .safeParse(req.args);
  if (!parsed.success) {
    return failResult("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const transfer = getEnv().HANDOFF_TRANSFER_NUMBER;
  if (!transfer) {
    return failResult("NO_STAFF_AVAILABLE", "No transfer number configured");
  }

  return runLogged(req, "requestHumanHandoff", async ({ client, callId }) => {
    await client.query(
      `INSERT INTO call_outcomes (call_id, outcome_type, notes)
       VALUES ($1, 'human_handoff', $2)`,
      [callId, `${parsed.data.urgency}: ${parsed.data.reason}`],
    );
    await client.query(`UPDATE calls SET disposition = 'human_handoff' WHERE id = $1`, [callId]);

    const immediate = parsed.data.urgency === "emergency";
    return okResult({
      transfer_number: transfer,
      immediate_alert_sent: immediate,
    });
  });
}

async function sendConfirmation(req: ToolRequest): Promise<ToolResult> {
  const parsed = z
    .object({
      channel: z.enum(["sms", "email", "both"]),
      appointment_id: z.string().uuid(),
    })
    .safeParse(req.args);
  if (!parsed.success) {
    return failResult("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  if (!getEnv().ENABLE_MESSAGING) {
    return failResult("TWILIO_UNAVAILABLE", "Messaging not enabled yet");
  }
  return failResult("TWILIO_UNAVAILABLE", "Messaging client not implemented yet");
}

async function logCallOutcome(req: ToolRequest): Promise<ToolResult> {
  const parsed = z
    .object({
      outcome_type: z.enum([
        "booked",
        "rescheduled",
        "cancelled",
        "qualified_lead",
        "unqualified_lead",
        "human_handoff",
        "no_action",
        "abandoned",
      ]),
      notes: z.string().optional(),
    })
    .safeParse(req.args);
  if (!parsed.success) {
    return failResult("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  return runLogged(req, "logCallOutcome", async ({ client, callId }) => {
    await client.query(
      `INSERT INTO call_outcomes (call_id, outcome_type, notes)
       VALUES ($1, $2, $3)`,
      [callId, parsed.data.outcome_type, parsed.data.notes ?? null],
    );
    // Best-effort disposition sync when enum overlaps.
    const dispositionMap: Record<string, string> = {
      booked: "booked",
      rescheduled: "rescheduled",
      cancelled: "cancelled",
      qualified_lead: "qualified_lead",
      unqualified_lead: "unqualified_lead",
      human_handoff: "human_handoff",
      no_action: "no_action",
      abandoned: "abandoned",
    };
    const disposition = dispositionMap[parsed.data.outcome_type];
    if (disposition) {
      await client.query(
        `UPDATE calls SET disposition = $1::call_disposition, status = 'completed', ended_at = COALESCE(ended_at, now())
         WHERE id = $2`,
        [disposition, callId],
      );
    }
    return okResult({});
  });
}

/** Exported for unit tests / future calendar normalization. */
export function parseDatePhrase(phrase: string): Date | null {
  const results = chrono.parse(phrase);
  return results[0]?.start.date() ?? null;
}
