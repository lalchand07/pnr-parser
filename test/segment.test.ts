import { describe, expect, it } from 'vitest';
import { parseSegmentLine } from '../src/segment.js';

describe('parseSegmentLine', () => {
  it('reads a Galileo line', () => {
    const s = parseSegmentLine(' 1. BA  117 Y  15DEC LHRJFK HK1  1020   1315 # O*  E  TU')!;
    expect(s).toMatchObject({
      segmentNumber: 1,
      airline: 'BA',
      flightNumber: '117',
      bookingClass: 'Y',
      dateRaw: '15DEC',
      dowStyle: 'none',
      origin: 'LHR',
      destination: 'JFK',
      status: 'HK',
      seats: 1,
      departureTime: '10:20',
      arrivalTime: '13:15',
      explicitOffset: 1,
    });
    expect(s.traits).toMatchObject({ dotAfterNumber: true, offsetMarker: '#' });
  });

  it('reads a Sabre line', () => {
    const s = parseSegmentLine(' 2 BA 112Y 22DEC T JFKLHR HK1   700P  655A¥1 /DCBA*ABC123 /E')!;
    expect(s).toMatchObject({
      dowStyle: 'letter',
      printedWeekday: 2,
      departureTime: '19:00',
      arrivalTime: '06:55',
      explicitOffset: 1,
      airlineLocator: 'ABC123',
    });
    expect(s.traits).toMatchObject({ twelveHour: true, dcLocator: true, flightClassJoined: true });
  });

  it('reads an Amadeus line', () => {
    const s = parseSegmentLine(
      '  5  BA 112 Y 22DEC 2 JFKLHR HK2  1900 0655+1 23DEC  E  BA/ABC123',
    )!;
    expect(s).toMatchObject({
      segmentNumber: 5,
      dowStyle: 'digit',
      printedWeekday: 2,
      explicitOffset: 1,
      arrivalDateRaw: '23DEC',
      airlineLocator: 'ABC123',
    });
  });

  it('accepts airline codes with a digit', () => {
    expect(parseSegmentLine(' 1 9W 123Y 15DEC T BOMDEL HK1 1000A 1200P')?.airline).toBe('9W');
    expect(parseSegmentLine(' 1 U21234 Y 15DEC LGWGVA HK1 1000 1230')?.airline).toBe('U2');
  });

  it('strips leading zeros from flight numbers', () => {
    expect(parseSegmentLine(' 1 BA 0007 Y 15DEC LHRJFK HK1 1000 1230')?.flightNumber).toBe('7');
  });

  it('reads inline OPERATED BY text', () => {
    const s = parseSegmentLine(' 1 BA1511Y 12NOV Q LHRJFK HK2 905A 1210P OPERATED BY AMERICAN')!;
    expect(s.operatingCarrierText).toBe('AMERICAN');
  });

  it('reports missing pieces instead of rejecting the line', () => {
    const s = parseSegmentLine(' 1. BA 117 Y 15DEC LHRJFK')!;
    expect(s.issues.map((i) => i.field)).toEqual(['status', 'departure time', 'arrival time']);
  });

  it('reports a missing arrival time only', () => {
    const s = parseSegmentLine(' 1. BA 117 Y 15DEC LHRJFK HK1 1020')!;
    expect(s.issues).toEqual([{ kind: 'missing', field: 'arrival time' }]);
  });

  it.each([
    'HELLO WORLD',
    ' 1 BA 117Y 32DEC T LHRJFK HK1',
    ' 1 BA 117Y 15DEC T LHRLHR HK1', // same origin and destination
    ' 1 12 117Y 15DEC T LHRJFK HK1', // airline cannot be two digits
    '  5 AP LON 020 7946 0000',
    '  3 ARNK',
  ])('rejects %j', (line) => expect(parseSegmentLine(line)).toBeNull());
});
