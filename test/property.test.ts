import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ParseResult } from '../src/index.js';
import { parsePnr, segmentsToCsv, toSimpleItinerary } from '../src/index.js';
import { loadFixtures } from './helpers.js';

const fixtures = loadFixtures();
const fixtureTexts = fixtures.map((f) => f.text);

/**
 * Invariants that must hold for *any* input:
 * - never throws, always returns the documented shape;
 * - every non-blank line is in exactly one of segments / passengers / unparsedLines;
 * - numbers are sane.
 */
function checkInvariants(input: string, result: ParseResult): void {
  expect(['galileo', 'sabre', 'amadeus', 'unknown']).toContain(result.format);
  expect(result.confidence).toBeGreaterThanOrEqual(0);
  expect(result.confidence).toBeLessThanOrEqual(1);
  expect(Array.isArray(result.segments)).toBe(true);
  expect(Array.isArray(result.passengers)).toBe(true);
  expect(Array.isArray(result.warnings)).toBe(true);
  for (const w of result.warnings) {
    expect(typeof w.code).toBe('string');
    expect(w.message.length).toBeGreaterThan(0);
  }
  if (result.warnings.some((w) => w.code === 'INPUT_TRUNCATED')) return;

  const lines = input.split(/\r\n|\r|\n|\u2028|\u2029/);
  const nonBlank = new Set<number>();
  lines.forEach((l, i) => {
    if (normalizedBlank(l)) return;
    nonBlank.add(i + 1);
  });

  const owner = new Map<number, string>();
  const claim = (line: number, who: string): void => {
    // A passenger line can hold several passengers; anything else is exclusive.
    const prev = owner.get(line);
    if (prev !== undefined && !(prev === 'pax' && who === 'pax')) {
      throw new Error(`line ${line} claimed by both ${prev} and ${who}`);
    }
    owner.set(line, who);
  };
  for (const s of result.segments) {
    expect(s.lines.length).toBeGreaterThan(0);
    for (const l of s.lines) claim(l, 'segment');
    expect(s.departureDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    if (s.departureTime) expect(s.departureTime).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    if (s.arrivalTime) expect(s.arrivalTime).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    expect(Math.abs(s.arrivalDayOffset)).toBeLessThanOrEqual(9);
  }
  for (const p of result.passengers) claim(p.line, 'pax');
  for (const u of result.unparsedLines) claim(u.line, 'unparsed');

  expect(new Set(owner.keys())).toEqual(nonBlank);
}

function normalizedBlank(line: string): boolean {
  // Mirrors normalizeLine: invisible characters and odd spaces count as blank.
  const t = line
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/^\s*>+\s?/, ' ');
  return t.trim() === '';
}

const run = (input: string): ParseResult => {
  const result = parsePnr(input, { referenceDate: '2026-10-15' });
  checkInvariants(input, result);
  // Helpers must also cope with whatever came out.
  toSimpleItinerary(result);
  segmentsToCsv(result);
  return result;
};

// Tokens that look like PNR fragments, to reach deeper parser paths than
// purely random strings do.
const pnrToken = fc.constantFrom(
  ' 1.',
  ' 1 ',
  '1.1',
  'SMITH/JOHN MR',
  '(INF/BABY/01JAN26)',
  '(CHD/05JAN18)',
  '*C08',
  'I/1',
  'BA',
  '117',
  'Y',
  '15DEC',
  '29FEB',
  'T',
  '2',
  'LHRJFK',
  'HK1',
  'XX9',
  '1020',
  '1315',
  '700P',
  '+1',
  '-1',
  '#',
  '¥1',
  '‡1',
  '16DEC',
  '/DCBA*ABC123',
  'BA/ABC123',
  '/E',
  'OPERATED BY',
  'RP/LON/LON',
  'ABC123',
  'PHONES',
  'REMARKS',
  'ARNK',
  '77W',
  'EQP:',
  '\t',
  '  ',
  '\n',
  '\r\n',
  '\u00a0',
  '\u200b',
);

const pnrLike = fc.array(pnrToken, { maxLength: 60 }).map((parts) => parts.join(' '));

/** A fixture with random lines deleted, duplicated, swapped or mangled. */
const mutatedFixture = fc
  .tuple(
    fc.constantFrom(...fixtureTexts),
    fc.array(
      fc.record({
        op: fc.constantFrom('delete', 'duplicate', 'swap', 'truncate', 'insert', 'case'),
        at: fc.nat(),
        text: fc.string({ maxLength: 20 }),
      }),
      { maxLength: 6 },
    ),
  )
  .map(([text, ops]) => {
    const lines = text.split('\n');
    for (const { op, at, text: extra } of ops) {
      if (lines.length === 0) break;
      const i = at % lines.length;
      const line = lines[i]!;
      if (op === 'delete') lines.splice(i, 1);
      else if (op === 'duplicate') lines.splice(i, 0, line);
      else if (op === 'swap') {
        const j = (i + 1) % lines.length;
        [lines[i], lines[j]] = [lines[j]!, line];
      } else if (op === 'truncate') lines[i] = line.slice(0, at % (line.length + 1));
      else if (op === 'insert') lines.splice(i, 0, extra);
      else lines[i] = line.toLowerCase();
    }
    return lines.join('\n');
  });

describe('parser robustness (property-based)', () => {
  it('never throws on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (s) => void run(s)),
      { numRuns: 400 },
    );
  });

  it('never throws on arbitrary unicode', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 300 }), (s) => void run(s)),
      { numRuns: 300 },
    );
  });

  it('never throws on PNR-like token soup', () => {
    fc.assert(
      fc.property(fc.array(pnrLike, { maxLength: 12 }), (lines) => void run(lines.join('\n'))),
      { numRuns: 500 },
    );
  });

  it('never throws on mutated fixtures and keeps every line accounted for', () => {
    fc.assert(
      fc.property(mutatedFixture, (s) => void run(s)),
      { numRuns: 500 },
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(mutatedFixture, (s) => {
        expect(parsePnr(s, { referenceDate: '2026-10-15' })).toEqual(
          parsePnr(s, { referenceDate: '2026-10-15' }),
        );
      }),
      { numRuns: 100 },
    );
  });

  it('accounts for every line of every fixture', () => {
    for (const text of fixtureTexts) run(text);
  });
});

describe('hostile and unusual inputs', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['number', 42],
    ['object', { a: 1 }],
    ['array', [' 1. BA 117 Y 15DEC LHRJFK HK1 1020 1315']],
  ])('accepts %s without throwing', (_label, value) => {
    const r = parsePnr(value as unknown as string, { referenceDate: '2026-10-15' });
    expect(Array.isArray(r.warnings)).toBe(true);
  });

  it('reports an internal error instead of throwing when input conversion fails', () => {
    const hostile = {
      toString() {
        throw new Error('boom');
      },
    };
    const r = parsePnr(hostile as unknown as string);
    expect(r.warnings.map((w) => w.code)).toContain('INTERNAL_ERROR');
  });

  it('survives hostile options', () => {
    const r = parsePnr(' 1. BA 117 Y 15DEC LHRJFK HK1 1020 1315', {
      referenceDate: 12345 as unknown as string,
      maxInputLength: Number.NaN,
      format: null as unknown as 'auto',
    });
    expect(r.segments).toHaveLength(1);
    expect(r.warnings.map((w) => w.code)).toContain('INVALID_OPTION');
  });

  it('truncates very large input with a warning', () => {
    const big = ' 1. BA  117 Y  15DEC LHRJFK HK1  1020   1315\n'.repeat(10_000);
    const r = parsePnr(big, { referenceDate: '2026-10-15', maxInputLength: 50_000 });
    expect(r.warnings[0]).toMatchObject({ code: 'INPUT_TRUNCATED' });
    expect(r.segments.length).toBeGreaterThan(1000);
  });

  it('handles CRLF, CR-only, NBSP, tabs, zero-width characters and a BOM', () => {
    const text =
      '\ufeff 1.1SAMPLE/JOHN\u00a0MR\r\n 1.\tBA\u200b  117 Y  15DEC LHRJFK HK1  1020   1315\r 2. BA  112 Y  22DEC JFKLHR HK1  1900   0655 #';
    const r = run(text);
    expect(r.passengers).toHaveLength(1);
    expect(r.segments.map((s) => s.lines[0])).toEqual([2, 3]);
  });

  it('strips terminal prompt characters', () => {
    const r = run('> 1. BA  117 Y  15DEC LHRJFK HK1  1020   1315');
    expect(r.segments).toHaveLength(1);
  });

  it('runs in linear-ish time on pathological lines (no catastrophic backtracking)', () => {
    const nasty = [
      ' 1'.repeat(5000),
      `1.${'A'.repeat(20_000)}`,
      `${'1.1A/'.repeat(5000)}`,
      `RP/${'A/'.repeat(10_000)}`,
      ` 1 BA 117Y 15DEC T LHRJFK HK1 ${'1'.repeat(30_000)}`,
      `OPERATED BY ${' '.repeat(30_000)}X`,
      `(${'('.repeat(10_000)}`,
    ];
    for (const line of nasty) {
      const start = performance.now();
      run(line);
      expect(performance.now() - start).toBeLessThan(1000);
    }
  });
});
