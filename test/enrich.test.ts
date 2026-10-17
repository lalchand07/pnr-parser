import { describe, expect, it } from 'vitest';
import { airportCount, enrich, lookupAirport } from '../src/enrich/index.js';
import { parsePnr } from '../src/index.js';

describe('enrich', () => {
  it('bundles a few thousand airports', () => {
    expect(airportCount()).toBeGreaterThan(3000);
  });

  it.each([
    ['LHE', 'Lahore', 'PK'],
    ['JED', 'Jeddah', 'SA'],
    ['MED', 'Medina', 'SA'],
    ['LHR', 'London', 'GB'],
    ['MAN', 'Manchester', 'GB'],
  ])('knows %s', (code, city, country) => {
    const a = lookupAirport(code)!;
    expect(a.city).toContain(city);
    expect(a.countryCode).toBe(country);
    expect(a.country).toBeTruthy();
  });

  it('is case-insensitive and safe on unknown input', () => {
    expect(lookupAirport('lhr')?.iata).toBe('LHR');
    expect(lookupAirport('ZZZ')).toBeUndefined();
    expect(lookupAirport(42 as unknown as string)).toBeUndefined();
  });

  it('adds airport names and caller-supplied airline names without mutating the input', () => {
    const result = parsePnr(
      ' 1 BA1511Y 12NOV Q LHRJFK HK2   905A 1210P /DCBA*HW2QAZ /E\nOPERATED BY /AA',
      { referenceDate: '2026-10-15' },
    );
    const before = JSON.stringify(result);
    const e = enrich(result, { airlines: { BA: 'Example Airways', AA: 'Sample Air' } });
    expect(JSON.stringify(result)).toBe(before);
    expect(e.segments[0]).toMatchObject({
      originAirport: { iata: 'LHR', countryCode: 'GB' },
      destinationAirport: { iata: 'JFK', countryCode: 'US' },
      airlineName: 'Example Airways',
      operatingCarrierName: 'Sample Air',
    });
  });

  it('accepts an airline lookup function and leaves names out when unknown', () => {
    const result = parsePnr(' 1. XQ  117 Y  15DEC LHRJFK HK1  1020   1315', {
      referenceDate: '2026-10-15',
    });
    expect(enrich(result).segments[0]!.airlineName).toBeUndefined();
    expect(enrich(result, { airlines: (c) => `Airline ${c}` }).segments[0]!.airlineName).toBe(
      'Airline XQ',
    );
  });
});
