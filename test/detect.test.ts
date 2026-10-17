import { describe, expect, it } from 'vitest';
import { detectFormat, parsePnr } from '../src/index.js';

describe('detectFormat', () => {
  it('detects each format from a single segment line', () => {
    expect(detectFormat(' 1. BA  117 Y  15DEC LHRJFK HK1  1020   1315 # O*').format).toBe(
      'galileo',
    );
    expect(detectFormat(' 1 BA 117Y 15DEC T LHRJFK HK1  1020A  115P /DCBA /E').format).toBe(
      'sabre',
    );
    expect(detectFormat('  2  BA 117 Y 15DEC 2 LHRJFK HK1  1020 1315   15DEC  E').format).toBe(
      'amadeus',
    );
  });

  it('is confident with a header and several segments', () => {
    const r = detectFormat(
      'RP/LONXX21AB/LONXX21AB  AA/SU  12OCT26/0915Z   ZQ7TKD\n  2  BA 117 Y 15DEC 2 LHRJFK HK1  1020 1315   15DEC  E',
    );
    expect(r.format).toBe('amadeus');
    expect(r.confidence).toBe(1);
  });

  it('returns unknown with zero confidence for non-PNR text', () => {
    expect(detectFormat('hello world')).toEqual({
      format: 'unknown',
      confidence: 0,
      scores: { galileo: 0, sabre: 0, amadeus: 0 },
    });
  });

  it('keeps confidence between 0 and 1', () => {
    const r = detectFormat(' 1.1SAMPLE/JOHN MR');
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it('never throws on odd input', () => {
    expect(() => detectFormat(undefined as unknown as string)).not.toThrow();
    expect(() => detectFormat({} as unknown as string)).not.toThrow();
  });
});

describe('format option', () => {
  const amadeus = '  2  BA 117 Y 15DEC 2 LHRJFK HK1  1020 1315   15DEC  E';

  it('forces a format and reports fit as confidence', () => {
    const r = parsePnr(amadeus, { format: 'galileo', referenceDate: '2026-10-15' });
    expect(r.format).toBe('galileo');
    expect(r.formatForced).toBe(true);
    expect(r.segments).toHaveLength(1);
    expect(r.confidence).toBeLessThan(0.5);
  });

  it('treats auto like no option', () => {
    const r = parsePnr(amadeus, { format: 'auto', referenceDate: '2026-10-15' });
    expect(r.format).toBe('amadeus');
    expect(r.formatForced).toBe(false);
  });

  it('warns about an unknown format value and falls back to detection', () => {
    const r = parsePnr(amadeus, { format: 'worldspan' as never, referenceDate: '2026-10-15' });
    expect(r.format).toBe('amadeus');
    expect(r.warnings[0]).toMatchObject({ code: 'INVALID_OPTION' });
  });
});
