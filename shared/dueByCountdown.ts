export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const DUE_BY_LEAD_WEEKS_MIN = 6;
export const DUE_BY_LEAD_WEEKS_MAX = 9;

export function addWeeks(date: Date | string | number, weeks: number): Date {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  d.setTime(d.getTime() + weeks * WEEK_MS);
  return d;
}

export interface CountdownParts {
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  overdue: boolean;
}

export function countdown(target: Date | string | number | null | undefined, now: Date | number = Date.now()): CountdownParts | null {
  if (target == null) return null;
  const t = target instanceof Date ? target.getTime() : new Date(target).getTime();
  if (!Number.isFinite(t)) return null;
  const n = typeof now === "number" ? now : now.getTime();
  const diff = t - n;
  const abs = Math.abs(diff);
  const weeks = Math.floor(abs / WEEK_MS);
  let rem = abs - weeks * WEEK_MS;
  const days = Math.floor(rem / (24 * 60 * 60 * 1000));
  rem -= days * 24 * 60 * 60 * 1000;
  const hours = Math.floor(rem / (60 * 60 * 1000));
  rem -= hours * 60 * 60 * 1000;
  const minutes = Math.floor(rem / (60 * 1000));
  rem -= minutes * 60 * 1000;
  const seconds = Math.floor(rem / 1000);
  return { weeks, days, hours, minutes, seconds, totalMs: diff, overdue: diff < 0 };
}

// True when the target date is within ~1 day of artworkApprovedAt + 9 weeks,
// i.e. it looks auto-seeded rather than manually overridden by staff.
export function isAutoSeeded(
  artworkApprovedAt: Date | string | null | undefined,
  targetCompletionDate: Date | string | null | undefined,
): boolean {
  if (!artworkApprovedAt || !targetCompletionDate) return false;
  const aa = new Date(artworkApprovedAt).getTime();
  const tcd = new Date(targetCompletionDate).getTime();
  if (!Number.isFinite(aa) || !Number.isFinite(tcd)) return false;
  const expected = aa + DUE_BY_LEAD_WEEKS_MAX * WEEK_MS;
  return Math.abs(tcd - expected) <= 24 * 60 * 60 * 1000;
}
