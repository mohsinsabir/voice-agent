/** Minimal TZ helpers via Intl (no luxon). */

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export type BusinessHours = Partial<Record<DayKey, [string, string] | []>>;

export type Slot = { start: string; end: string };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Wall-clock in `timeZone` → UTC Date. */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(new Date(utcGuess))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(utcGuess - (asUtc - utcGuess));
}

export function zonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: DayKey } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const weekdayMap: Record<string, DayKey> = {
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
  };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday!] ?? "mon",
  };
}

export function formatInZone(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const offset = offsetIso(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:00${offset}`;
}

function offsetIso(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    hour: "2-digit",
  });
  const tzName = dtf.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  if (tzName === "GMT" || tzName === "UTC") return "+00:00";
  const m = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return "+00:00";
  return `${m[1]}${pad(Number(m[2]))}:${m[3] ?? "00"}`;
}

function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(":").map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Candidate slots on a calendar day in business hours, stepped by duration. */
export function dayCandidateSlots(
  year: number,
  month: number,
  day: number,
  hours: BusinessHours,
  timeZone: string,
  durationMinutes: number,
  rangeStart: Date,
  rangeEnd: Date,
  now: Date,
): Slot[] {
  const weekday = zonedParts(
    zonedLocalToUtc(year, month, day, 12, 0, timeZone),
    timeZone,
  ).weekday;
  const window = hours[weekday];
  if (!window || window.length < 2) return [];

  const open = parseHm(window[0]!);
  const close = parseHm(window[1]!);
  const slots: Slot[] = [];

  let cursor = zonedLocalToUtc(year, month, day, open.hour, open.minute, timeZone);
  const dayClose = zonedLocalToUtc(year, month, day, close.hour, close.minute, timeZone);

  while (cursor.getTime() + durationMinutes * 60_000 <= dayClose.getTime()) {
    const end = new Date(cursor.getTime() + durationMinutes * 60_000);
    if (cursor >= rangeStart && end <= rangeEnd && cursor > now) {
      slots.push({ start: formatInZone(cursor, timeZone), end: formatInZone(end, timeZone) });
    }
    cursor = new Date(cursor.getTime() + durationMinutes * 60_000);
  }
  return slots;
}

export function addDaysYmd(
  year: number,
  month: number,
  day: number,
  days: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
