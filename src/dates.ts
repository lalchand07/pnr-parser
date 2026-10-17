/**
 * Calendar helpers. All arithmetic is done on plain calendar dates
 * (via UTC) so results never depend on the host time zone.
 */

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export const MONTHS: Readonly<Record<string, number>> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

export const MONTH_PATTERN = 'JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC';

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidDate(d: CalendarDate): boolean {
  return (
    Number.isInteger(d.year) &&
    d.month >= 1 &&
    d.month <= 12 &&
    d.day >= 1 &&
    d.day <= daysInMonth(d.year, d.month)
  );
}

/** Parses `15DEC` / `5DEC` into day and month. Returns null when impossible in any year. */
export function parseDayMonth(text: string): { day: number; month: number } | null {
  const m = /^(\d{1,2})([A-Z]{3})$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2]!];
  if (!month) return null;
  // Use a leap year so 29FEB is accepted here; inference handles it later.
  if (day < 1 || day > daysInMonth(2024, month)) return null;
  return { day, month };
}

export function toIso(d: CalendarDate): string {
  return `${String(d.year).padStart(4, '0')}-${pad2(d.month)}-${pad2(d.day)}`;
}

export function fromIso(iso: string): CalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  return isValidDate(d) ? d : null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toEpochDay(d: CalendarDate): number {
  return Math.round(Date.UTC(d.year, d.month - 1, d.day) / 86_400_000);
}

function fromEpochDay(n: number): CalendarDate {
  const date = new Date(n * 86_400_000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return toEpochDay(a) - toEpochDay(b);
}

export function addDays(d: CalendarDate, days: number): CalendarDate {
  return fromEpochDay(toEpochDay(d) + days);
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekday(d: CalendarDate): number {
  const js = new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
  return js === 0 ? 7 : js;
}

/**
 * Resolves the `referenceDate` option. Returns the calendar date, or null for
 * an unusable value (caller falls back to today and warns).
 */
export function resolveReferenceDate(
  ref: Date | string | undefined,
  now: Date,
): CalendarDate | null {
  if (ref === undefined) return localCalendarDate(now);
  if (ref instanceof Date) {
    return Number.isNaN(ref.getTime()) ? null : localCalendarDate(ref);
  }
  if (typeof ref === 'string') {
    // Accept a full ISO timestamp too, but only its date part is used.
    const m = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(ref.trim());
    return m ? fromIso(m[1]!) : null;
  }
  return null;
}

function localCalendarDate(d: Date): CalendarDate {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export interface YearInference {
  date: CalendarDate;
  /** True when 29FEB had to move to a later leap year. */
  leapAdjusted: boolean;
}

/**
 * Picks the first occurrence of day/month on or after `ref`.
 * December → January wrap falls out naturally: on 2026-12-20, `05JAN`
 * becomes 2027-01-05. `29FEB` moves to the next leap year.
 */
export function inferYear(day: number, month: number, ref: CalendarDate): YearInference {
  let leapAdjusted = false;
  for (let year = ref.year; year <= ref.year + 8; year++) {
    const candidate = { year, month, day };
    if (!isValidDate(candidate)) {
      leapAdjusted = true;
      continue;
    }
    if (compareDates(candidate, ref) >= 0) return { date: candidate, leapAdjusted };
  }
  // Unreachable for inputs validated by parseDayMonth; keep a safe fallback.
  return { date: { year: ref.year, month, day: Math.min(day, 28) }, leapAdjusted: true };
}

/**
 * Infers the year of a date that must fall on or after `after` and is
 * expected to be close to it (arrival dates).
 */
export function inferYearNear(day: number, month: number, after: CalendarDate): CalendarDate {
  // Allow arrival dates up to 1 day *before* departure (date line), so start
  // the search one day earlier.
  return inferYear(day, month, addDays(after, -1)).date;
}

/**
 * Parses a date of birth like `12MAR25` or `05JAN2018`. Two-digit years are
 * placed in the century that puts the date on or before the reference date.
 */
export function parseDateOfBirth(text: string, ref: CalendarDate): CalendarDate | null {
  const m = new RegExp(`^(\\d{1,2})(${MONTH_PATTERN})(\\d{2}|\\d{4})$`).exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2]!]!;
  let year = Number(m[3]);
  if (m[3]!.length === 2) {
    year += Math.floor(ref.year / 100) * 100;
    if (compareDates({ year, month, day: 1 }, ref) > 0) year -= 100;
  }
  const d = { year, month, day };
  return isValidDate(d) ? d : null;
}

/** Whole days from a to b. */
export function diffDays(a: CalendarDate, b: CalendarDate): number {
  return toEpochDay(b) - toEpochDay(a);
}
