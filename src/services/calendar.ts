import { google, type calendar_v3 } from "googleapis";
import { getEnv } from "../config/env.js";

export type BusyInterval = { start: Date; end: Date };

export class CalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarError";
  }
}

function privateKey(): string {
  const raw = getEnv().GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!;
  return raw.replace(/\\n/g, "\n");
}

function calendarClient(): calendar_v3.Calendar {
  const env = getEnv();
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!email) throw new CalendarError("GOOGLE_SERVICE_ACCOUNT_EMAIL is not configured");
  const auth = new google.auth.JWT({
    email,
    key: privateKey(),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

async function withTimeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new CalendarError("Calendar request timed out")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function queryFreeBusy(
  timeMin: Date,
  timeMax: Date,
  timeoutMs = 4000,
): Promise<BusyInterval[]> {
  const env = getEnv();
  const calendarId = env.GOOGLE_CALENDAR_ID!;
  try {
    const calendar = calendarClient();
    const res = await withTimeout(
      timeoutMs,
      calendar.freebusy.query({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: [{ id: calendarId }],
        },
      }),
    );
    const busy = res.data.calendars?.[calendarId]?.busy ?? [];
    return busy
      .filter((b): b is { start: string; end: string } => Boolean(b.start && b.end))
      .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  } catch (err) {
    if (err instanceof CalendarError) throw err;
    throw new CalendarError(err instanceof Error ? err.message : "Calendar freebusy failed");
  }
}

export async function createCalendarEvent(input: {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timeZone: string;
  attendeeEmail?: string;
  timeoutMs?: number;
}): Promise<string> {
  const env = getEnv();
  try {
    const calendar = calendarClient();
    const requestBody: calendar_v3.Schema$Event = {
      summary: input.summary,
      start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
      end: { dateTime: input.end.toISOString(), timeZone: input.timeZone },
    };
    if (input.description) requestBody.description = input.description;
    if (input.attendeeEmail) requestBody.attendees = [{ email: input.attendeeEmail }];

    const res = await withTimeout(
      input.timeoutMs ?? 5000,
      calendar.events.insert({
        calendarId: env.GOOGLE_CALENDAR_ID!,
        requestBody,
      }),
    );
    const id = res.data.id;
    if (!id) throw new CalendarError("Calendar create returned no event id");
    return id;
  } catch (err) {
    if (err instanceof CalendarError) throw err;
    throw new CalendarError(err instanceof Error ? err.message : "Calendar create failed");
  }
}

export async function updateCalendarEvent(input: {
  eventId: string;
  start: Date;
  end: Date;
  timeZone: string;
  timeoutMs?: number;
}): Promise<void> {
  const env = getEnv();
  try {
    const calendar = calendarClient();
    await withTimeout(
      input.timeoutMs ?? 5000,
      calendar.events.patch({
        calendarId: env.GOOGLE_CALENDAR_ID!,
        eventId: input.eventId,
        requestBody: {
          start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
          end: { dateTime: input.end.toISOString(), timeZone: input.timeZone },
        },
      }),
    );
  } catch (err) {
    if (err instanceof CalendarError) throw err;
    throw new CalendarError(err instanceof Error ? err.message : "Calendar update failed");
  }
}

export async function deleteCalendarEvent(eventId: string, timeoutMs = 5000): Promise<void> {
  const env = getEnv();
  try {
    const calendar = calendarClient();
    await withTimeout(
      timeoutMs,
      calendar.events.delete({ calendarId: env.GOOGLE_CALENDAR_ID!, eventId }),
    );
  } catch (err) {
    if (err instanceof CalendarError) throw err;
    // 404 / 410 = already gone → treat as success for cancel idempotency
    const status = (err as { code?: number })?.code;
    if (status === 404 || status === 410) return;
    throw new CalendarError(err instanceof Error ? err.message : "Calendar delete failed");
  }
}

export function isSlotFree(slotStart: Date, slotEnd: Date, busy: BusyInterval[]): boolean {
  return !busy.some((b) => slotStart < b.end && b.start < slotEnd);
}
