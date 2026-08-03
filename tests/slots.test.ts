import { describe, expect, it } from "vitest";
import {
  dayCandidateSlots,
  formatInZone,
  zonedLocalToUtc,
  type BusinessHours,
} from "../src/services/time.js";
import { resolveDatePhrase, withinBusinessHours } from "../src/services/slots.js";

const hours: BusinessHours = {
  mon: ["09:00", "17:00"],
  tue: ["09:00", "17:00"],
  wed: ["09:00", "17:00"],
  thu: ["09:00", "17:00"],
  fri: ["09:00", "17:00"],
  sat: ["09:00", "13:00"],
  sun: [],
};

describe("time / slots", () => {
  it("builds weekday slots inside business hours", () => {
    // 2026-08-04 is a Tuesday
    const rangeStart = zonedLocalToUtc(2026, 8, 4, 9, 0, "America/New_York");
    const rangeEnd = zonedLocalToUtc(2026, 8, 4, 17, 0, "America/New_York");
    const now = zonedLocalToUtc(2026, 8, 3, 10, 0, "America/New_York");
    const slots = dayCandidateSlots(
      2026,
      8,
      4,
      hours,
      "America/New_York",
      30,
      rangeStart,
      rangeEnd,
      now,
    );
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]!.start).toContain("2026-08-04T09:00:00");
    expect(slots[0]!.end).toContain("2026-08-04T09:30:00");
  });

  it("rejects Sunday (closed)", () => {
    const rangeStart = zonedLocalToUtc(2026, 8, 2, 0, 0, "America/New_York");
    const rangeEnd = zonedLocalToUtc(2026, 8, 2, 23, 59, "America/New_York");
    const slots = dayCandidateSlots(
      2026,
      8,
      2,
      hours,
      "America/New_York",
      30,
      rangeStart,
      rangeEnd,
      new Date(0),
    );
    expect(slots).toEqual([]);
  });

  it("formats ISO with zone offset", () => {
    const d = zonedLocalToUtc(2026, 8, 4, 14, 0, "America/New_York");
    const s = formatInZone(d, "America/New_York");
    expect(s).toMatch(/^2026-08-04T14:00:00-0[45]:00$/);
  });

  it("resolves afternoon phrase to afternoon window", () => {
    const now = zonedLocalToUtc(2026, 8, 3, 10, 0, "America/New_York");
    const resolved = resolveDatePhrase("tomorrow afternoon", "America/New_York", now);
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.rangeStart.getTime()).toBeLessThan(resolved.rangeEnd.getTime());
  });

  it("withinBusinessHours matches seed hours", () => {
    const start = zonedLocalToUtc(2026, 8, 4, 14, 0, "America/New_York");
    const end = zonedLocalToUtc(2026, 8, 4, 14, 30, "America/New_York");
    expect(withinBusinessHours(start, end, "America/New_York", hours)).toBe(true);
    const late = zonedLocalToUtc(2026, 8, 4, 18, 0, "America/New_York");
    expect(
      withinBusinessHours(late, new Date(late.getTime() + 30 * 60_000), "America/New_York", hours),
    ).toBe(false);
  });
});
