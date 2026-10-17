import { describe, expect, it } from 'vitest';
import { parsePnr, toSimpleItinerary } from '../src/index.js';

// Keeps the "30-second example" in README.md honest.
const text = `
RP/LONXX21AB/LONXX21AB            AA/SU  12OCT26/0915Z   ZQ7TKD
  1.SAMPLE/JOHN MR   2.SAMPLE/ADAM MSTR(CHD/05JAN18)
  3  BA 117 Y 15DEC 2 LHRJFK HK2  1020 1315   15DEC  E  BA/YT4KQ9
  4  BA 112 Y 22DEC 2 JFKLHR HK2  1900 0655+1 23DEC  E  BA/YT4KQ9
  5 AP LON 020 7946 0000 - A
`;

describe('README example', () => {
  const result = parsePnr(text, { referenceDate: '2026-10-15' });

  it('matches the documented output', () => {
    expect(result).toMatchObject({ format: 'amadeus', confidence: 1, recordLocator: 'ZQ7TKD' });
    expect(result.passengers[1]).toMatchObject({
      id: '2',
      surname: 'SAMPLE',
      givenName: 'ADAM',
      title: 'MSTR',
      type: 'CHD',
      dateOfBirth: '2018-01-05',
    });
    expect(result.segments[1]).toEqual({
      segmentNumber: 4,
      airline: 'BA',
      flightNumber: '112',
      bookingClass: 'Y',
      departureDate: '2026-12-22',
      departureDateRaw: '22DEC',
      origin: 'JFK',
      destination: 'LHR',
      departureTime: '19:00',
      arrivalTime: '06:55',
      arrivalDayOffset: 1,
      arrivalDate: '2026-12-23',
      status: 'HK',
      statusMeaning: 'Confirmed',
      statusCategory: 'confirmed',
      seats: 2,
      airlineLocator: 'YT4KQ9',
      lines: [5],
      raw: '  4  BA 112 Y 22DEC 2 JFKLHR HK2  1900 0655+1 23DEC  E  BA/YT4KQ9',
    });
    expect(result.unparsedLines.map((u) => [u.line, u.category])).toEqual([
      [2, 'header'],
      [6, 'contact'],
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('renders the documented table', () => {
    expect(toSimpleItinerary(result).text).toBe(
      [
        'Booking reference: ZQ7TKD',
        'Passengers: MR JOHN SAMPLE, MSTR ADAM SAMPLE (child)',
        '',
        '#  Flight  Date        From  To   Departs  Arrives   Class  Status',
        '3  BA 117  2026-12-15  LHR   JFK  10:20    13:15     Y      Confirmed (HK)',
        '4  BA 112  2026-12-22  JFK   LHR  19:00    06:55 +1  Y      Confirmed (HK)',
      ].join('\n'),
    );
  });
});
