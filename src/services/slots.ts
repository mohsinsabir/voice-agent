import * as chrono from "chrono-node";
import {
  addDaysYmd,
  dayCandidateSlots,
  formatInZone,
  overlaps,
  type BusinessHours,
  type Slot,
  zonedLocalToUtc,
  zonedParts,
} from "./time.js";
import { isSlotFree, queryFreeBusy, type BusyInterval } from "./calendar.js";

const MAX_DAYS_OUT = 60;
const MAX_SLOTS_RETURN = 6;

export type ResolvedRange = { start: string; end: string };

function offsetMinutesAt(date: Date, timeZone: string): number {
  const name =
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
      year: "numeric",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  if (name === "GMT" || name === "UTC") return 0;
  const m = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

export function resolveDatePhrase(
  phrase: string,
  timeZone: string,
  now = new Date(),
): { rangeStart: Date; rangeEnd: Date } | { error: string } {
  const results = chrono.parse(
    phrase,
    { instant: now, timezone: offsetMinutesAt(now, timeZone) },
    { forwardDate: true },
  );
  if (!results[0]) {
    return { error: "Could not understand that date. Please try again with a day and time window." };
  }

  const start = results[0].start.date();
  const end = results[0].end?.date();

  const startParts = zonedParts(start, timeZone);
  let rangeStart: Date;
  let rangeEnd: Date;

  if (end) {
    rangeStart = start;
    rangeEnd = end;
  } else if (results[0].start.isCertain("hour")) {
    // Specific time → ±0 window of one slot length handled by caller; use 1h window
    rangeStart = start;
    rangeEnd = new Date(start.getTime() + 60 * 60_000);
  } else {
    // Date-only: full business day; "afternoon"/"morning" via implied hour from chrono text
    const lower = phrase.toLowerCase();
    if (lower.includes("afternoon") || lower.includes("evening")) {
      rangeStart = zonedLocalToUtc(startParts.year, startParts.month, startParts.day, 12, 0, timeZone);
      rangeEnd = zonedLocalToUtc(startParts.year, startParts.month, startParts.day, 17, 0, timeZone);
    } else if (lower.includes("morning")) {
      rangeStart = zonedLocalToUtc(startParts.year, startParts.month, startParts.day, 9, 0, timeZone);
      rangeEnd = zonedLocalToUtc(startParts.year, startParts.month, startParts.day, 12, 0, timeZone);
    } else {
      rangeStart = zonedLocalToUtc(startParts.year, startParts.month, startParts.day, 0, 0, timeZone);
      rangeEnd = zonedLocalToUtc(startParts.year, startParts.month, startParts.day, 23, 59, timeZone);
    }
  }

  const maxOut = new Date(now.getTime() + MAX_DAYS_OUT * 24 * 60 * 60_000);
  if (rangeStart > maxOut) {
    return { error: "That date is more than 60 days out. Please pick a nearer date." };
  }
  if (rangeEnd < now) {
    return { error: "That time is in the past. Please pick a future date." };
  }

  return { rangeStart, rangeEnd };
}

export async function findAvailableSlots(input: {
  datePhrase: string;
  durationMinutes: number;
  timeZone: string;
  businessHours: BusinessHours;
  now?: Date;
}): Promise<
  | { ok: true; resolved_range: ResolvedRange; slots: Slot[]; message?: string }
  | { ok: false; code: string; message: string }
> {
  const now = input.now ?? new Date();
  const resolved = resolveDatePhrase(input.datePhrase, input.timeZone, now);
  if ("error" in resolved) {
    return { ok: false, code: "INVALID_DATE_PHRASE", message: resolved.error };
  }

  const { rangeStart, rangeEnd } = resolved;
  let busy: BusyInterval[];
  try {
    busy = await queryFreeBusy(rangeStart, rangeEnd);
  } catch (err) {
    return {
      ok: false,
      code: "CALENDAR_UNAVAILABLE",
      message: err instanceof Error ? err.message : "Could not reach calendar service",
    };
  }

  const startP = zonedParts(rangeStart, input.timeZone);
  const endP = zonedParts(rangeEnd, input.timeZone);
  const candidates: Slot[] = [];

  let cursor = { year: startP.year, month: startP.month, day: startP.day };
  const last = { year: endP.year, month: endP.month, day: endP.day };
  for (let i = 0; i < 14; i++) {
    candidates.push(
      ...dayCandidateSlots(
        cursor.year,
        cursor.month,
        cursor.day,
        input.businessHours,
        input.timeZone,
        input.durationMinutes,
        rangeStart,
        rangeEnd,
        now,
      ),
    );
    if (cursor.year === last.year && cursor.month === last.month && cursor.day === last.day) break;
    cursor = addDaysYmd(cursor.year, cursor.month, cursor.day, 1);
  }

  const open = candidates
    .filter((s) => {
      const a = new Date(s.start);
      const b = new Date(s.end);
      return isSlotFree(a, b, busy);
    })
    .slice(0, MAX_SLOTS_RETURN);

  const resolved_range: ResolvedRange = {
    start: formatInZone(rangeStart, input.timeZone),
    end: formatInZone(rangeEnd, input.timeZone),
  };

  if (open.length === 0) {
    return {
      ok: true,
      resolved_range,
      slots: [],
      message: "No availability in that window. Suggest offering the next business day.",
    };
  }

  return { ok: true, resolved_range, slots: open };
}

export async function alternativesNear(
  slotStart: Date,
  durationMinutes: number,
  timeZone: string,
  businessHours: BusinessHours,
): Promise<Slot[]> {
  const day = zonedParts(slotStart, timeZone);
  const dayStart = zonedLocalToUtc(day.year, day.month, day.day, 0, 0, timeZone);
  const dayEnd = zonedLocalToUtc(day.year, day.month, day.day, 23, 59, timeZone);
  let busy: BusyInterval[] = [];
  try {
    busy = await queryFreeBusy(dayStart, dayEnd);
  } catch {
    return [];
  }
  return dayCandidateSlots(
    day.year,
    day.month,
    day.day,
    businessHours,
    timeZone,
    durationMinutes,
    dayStart,
    dayEnd,
    new Date(0),
  )
    .filter((s) => isSlotFree(new Date(s.start), new Date(s.end), busy))
    .filter((s) => !overlaps(new Date(s.start), new Date(s.end), slotStart, new Date(slotStart.getTime() + durationMinutes * 60_000)))
    .slice(0, 3);
}

export function parseSlotStart(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function withinBusinessHours(
  start: Date,
  end: Date,
  timeZone: string,
  hours: BusinessHours,
): boolean {
  const p = zonedParts(start, timeZone);
  const window = hours[p.weekday];
  if (!window || window.length < 2) return false;
  const [openHm, closeHm] = window;
  const [oh, om] = openHm!.split(":").map(Number);
  const [ch, cm] = closeHm!.split(":").map(Number);
  const open = zonedLocalToUtc(p.year, p.month, p.day, oh!, om!, timeZone);
  const close = zonedLocalToUtc(p.year, p.month, p.day, ch!, cm!, timeZone);
  return start >= open && end <= close;
}
