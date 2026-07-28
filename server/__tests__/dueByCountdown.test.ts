import { describe, it, expect } from "vitest";
import { addWeeks, countdown, isAutoSeeded, DUE_BY_LEAD_WEEKS_MAX, WEEK_MS } from "@shared/dueByCountdown";

describe("dueByCountdown", () => {
  it("addWeeks advances by the right number of milliseconds", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    const plus9 = addWeeks(base, 9);
    expect(plus9.getTime() - base.getTime()).toBe(9 * WEEK_MS);
  });

  it("countdown returns null for missing target", () => {
    expect(countdown(null)).toBeNull();
    expect(countdown(undefined)).toBeNull();
  });

  it("countdown breaks down a future delta into weeks/days/hours/minutes/seconds", () => {
    const now = new Date("2026-01-01T00:00:00Z").getTime();
    const target = now + (2 * WEEK_MS) + (3 * 24 * 60 * 60 * 1000) + (4 * 60 * 60 * 1000) + (5 * 60 * 1000) + (6 * 1000);
    const c = countdown(new Date(target), now)!;
    expect(c.overdue).toBe(false);
    expect(c.weeks).toBe(2);
    expect(c.days).toBe(3);
    expect(c.hours).toBe(4);
    expect(c.minutes).toBe(5);
    expect(c.seconds).toBe(6);
  });

  it("countdown flags overdue when target is in the past", () => {
    const now = new Date("2026-01-10T00:00:00Z").getTime();
    const c = countdown(new Date(now - 3 * 24 * 60 * 60 * 1000), now)!;
    expect(c.overdue).toBe(true);
    expect(c.days).toBe(3);
    expect(c.weeks).toBe(0);
  });

  it("isAutoSeeded recognises target ≈ artworkApprovedAt + 9 weeks", () => {
    const aa = new Date("2026-02-01T12:00:00Z");
    const seeded = addWeeks(aa, DUE_BY_LEAD_WEEKS_MAX);
    expect(isAutoSeeded(aa, seeded)).toBe(true);
    // within 1 day tolerance
    expect(isAutoSeeded(aa, new Date(seeded.getTime() + 12 * 60 * 60 * 1000))).toBe(true);
    // outside tolerance → manual override
    expect(isAutoSeeded(aa, new Date(seeded.getTime() + 5 * 24 * 60 * 60 * 1000))).toBe(false);
    expect(isAutoSeeded(null, seeded)).toBe(false);
    expect(isAutoSeeded(aa, null)).toBe(false);
  });
});
