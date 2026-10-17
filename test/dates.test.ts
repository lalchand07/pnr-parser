import { describe, expect, it } from 'vitest';
import {
  addDays,
  inferYear,
  inferYearNear,
  isoWeekday,
  parseDateOfBirth,
  parseDayMonth,
  resolveReferenceDate,
  toIso,
} from '../src/dates.js';
import { parsePnr } from '../src/index.js';

const d = (iso: string) => {
  const [y, m, day] = iso.split('-').map(Number);
  return { year: y!, month: m!, day: day! };
};

describe('parseDayMonth', () => {
  it.each([
    ['15DEC', { day: 15, month: 12 }],
    ['5JAN', { day: 5, month: 1 }],
    ['29FEB', { day: 29, month: 2 }],
  ])('%s', (text, expected) => expect(parseDayMonth(text)).toEqual(expected));

  it.each(['32JAN', '31APR', '30FEB', '00MAR', '15XYZ', 'DEC15', ''])('rejects %s', (text) => {
    expect(parseDayMonth(text)).toBeNull();
  });
});

describe('inferYear (next occurrence on or after the reference date)', () => {
  it.each([
    // [day, month, reference, expected]
    [15, 12, '2026-10-15', '2026-12-15'],
    [15, 10, '2026-10-15', '2026-10-15'], // same day counts
    [14, 10, '2026-10-15', '2027-10-14'], // yesterday -> next year
    [5, 1, '2026-12-20', '2027-01-05'], // December -> January wrap
    [31, 12, '2026-12-31', '2026-12-31'],
    [1, 1, '2026-12-31', '2027-01-01'],
    [29, 2, '2026-10-15', '2028-02-29'], // next leap year
    [29, 2, '2028-01-10', '2028-02-29'],
    [29, 2, '2028-03-01', '2032-02-29'],
    [1, 3, '2028-02-29', '2028-03-01'],
  ])('%i/%i from %s -> %s', (day, month, ref, expected) => {
    expect(toIso(inferYear(day, month, d(ref)).date)).toBe(expected);
  });

  it('flags a 29FEB that had to move years', () => {
    expect(inferYear(29, 2, d('2026-10-15')).leapAdjusted).toBe(true);
    expect(inferYear(29, 2, d('2028-01-01')).leapAdjusted).toBe(false);
  });
});

describe('inferYearNear (arrival dates)', () => {
  it('keeps an arrival in the next year when departing on 31 December', () => {
    expect(toIso(inferYearNear(1, 1, d('2026-12-31')))).toBe('2027-01-01');
  });
  it('allows an arrival one day before departure (date line)', () => {
    expect(toIso(inferYearNear(15, 12, d('2026-12-16')))).toBe('2026-12-15');
  });
  it('handles an arrival before departure across the year end', () => {
    expect(toIso(inferYearNear(31, 12, d('2027-01-01')))).toBe('2026-12-31');
  });
});

describe('calendar helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(toIso(addDays(d('2026-12-31'), 1))).toBe('2027-01-01');
    expect(toIso(addDays(d('2028-02-28'), 1))).toBe('2028-02-29');
    expect(toIso(addDays(d('2027-01-01'), -1))).toBe('2026-12-31');
  });
  it('computes ISO weekdays (Mon=1 … Sun=7)', () => {
    expect(isoWeekday(d('2026-10-15'))).toBe(4); // Thursday
    expect(isoWeekday(d('2026-10-18'))).toBe(7); // Sunday
    expect(isoWeekday(d('2026-10-19'))).toBe(1); // Monday
  });
});

describe('parseDateOfBirth', () => {
  const ref = d('2026-10-15');
  it.each([
    ['12MAR25', '2025-03-12'],
    ['05JAN18', '2018-01-05'],
    ['01JAN80', '1980-01-01'], // would be in the future as 2080
    ['15OCT26', '2026-10-15'],
    ['05JAN2018', '2018-01-05'],
  ])('%s -> %s', (text, iso) => expect(toIso(parseDateOfBirth(text, ref)!)).toBe(iso));
  it('rejects nonsense', () => {
    expect(parseDateOfBirth('31FEB20', ref)).toBeNull();
    expect(parseDateOfBirth('XX', ref)).toBeNull();
  });
});

describe('resolveReferenceDate', () => {
  const now = new Date(2026, 9, 15, 23, 59);
  it('defaults to the local calendar date of "now"', () => {
    expect(resolveReferenceDate(undefined, now)).toEqual(d('2026-10-15'));
  });
  it('accepts YYYY-MM-DD strings and ISO timestamps', () => {
    expect(resolveReferenceDate('2027-02-03', now)).toEqual(d('2027-02-03'));
    expect(resolveReferenceDate('2027-02-03T10:00:00Z', now)).toEqual(d('2027-02-03'));
  });
  it('uses the local calendar day of a Date', () => {
    expect(resolveReferenceDate(new Date(2027, 0, 5, 1, 0), now)).toEqual(d('2027-01-05'));
  });
  it('rejects invalid values', () => {
    expect(resolveReferenceDate('2027-02-30', now)).toBeNull();
    expect(resolveReferenceDate('tomorrow', now)).toBeNull();
    expect(resolveReferenceDate(new Date('nope'), now)).toBeNull();
  });
});

describe('year inference through parsePnr', () => {
  const line = ' 1 BA 117Y 15DEC T LHRJFK HK1  1020A  115P /E';
  it('falls back to today with a warning for an invalid referenceDate', () => {
    const r = parsePnr(line, { referenceDate: 'not a date' });
    expect(r.warnings.some((w) => w.code === 'INVALID_OPTION')).toBe(true);
    expect(r.segments).toHaveLength(1);
  });
  it('reports the reference date that was used', () => {
    expect(parsePnr(line, { referenceDate: '2026-10-15' }).referenceDate).toBe('2026-10-15');
    expect(parsePnr(line, { referenceDate: new Date(2026, 11, 1) }).referenceDate).toBe(
      '2026-12-01',
    );
  });
  it('computes the arrival date from the offset, across the year end', () => {
    const r = parsePnr(' 1 BA 117Y 31DEC Q LHRJFK HK1  1020P  115A¥1 /E', {
      referenceDate: '2026-10-15',
    });
    expect(r.segments[0]).toMatchObject({
      departureDate: '2026-12-31',
      arrivalDate: '2027-01-01',
      arrivalDayOffset: 1,
    });
  });
});
