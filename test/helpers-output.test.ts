import { describe, expect, it } from 'vitest';
import { parsePnr, segmentsToCsv, toSimpleItinerary } from '../src/index.js';
import type { ParseResult } from '../src/index.js';

const text = `RP/LONXX21AB/LONXX21AB            AA/SU  10OCT26/1015Z   T4CPLX
  1.PLACEHOLDER/ANNA MRS   2.PLACEHOLDER/ADAM MSTR(CHD/01JAN18)
  3  BA1511 Y 12NOV 4 LHRJFK HK2  0905 1210   12NOV  E  BA/HW2QAZ
     OPERATED BY AMERICAN AIRLINES
  4  AA 104 Y 19NOV 4 JFKLHR HL2  1830 0635+1 20NOV  E  AA/JX7TRE`;

const result = parsePnr(text, { referenceDate: '2026-10-15' });

describe('toSimpleItinerary', () => {
  const simple = toSimpleItinerary(result);

  it('formats passengers for display', () => {
    expect(simple.passengers).toEqual(['MRS ANNA PLACEHOLDER', 'MSTR ADAM PLACEHOLDER (child)']);
  });

  it('formats rows', () => {
    expect(simple.recordLocator).toBe('T4CPLX');
    expect(simple.segments[1]).toEqual({
      segment: 4,
      flight: 'AA 104',
      date: '2026-11-19',
      from: 'JFK',
      to: 'LHR',
      departs: '18:30',
      arrives: '06:35 +1',
      bookingClass: 'Y',
      status: 'Waitlisted (HL)',
      note: '',
    });
    expect(simple.segments[0]!.note).toBe('Operated by AMERICAN AIRLINES');
  });

  it('renders an aligned text table', () => {
    expect(simple.text).toMatchInlineSnapshot(`
      "Booking reference: T4CPLX
      Passengers: MRS ANNA PLACEHOLDER, MSTR ADAM PLACEHOLDER (child)

      #  Flight   Date        From  To   Departs  Arrives   Class  Status
      3  BA 1511  2026-11-12  LHR   JFK  09:05    12:10     Y      Confirmed (HK) - Operated by AMERICAN AIRLINES
      4  AA 104   2026-11-19  JFK   LHR  18:30    06:35 +1  Y      Waitlisted (HL)"
    `);
  });

  it('handles a result with no flights', () => {
    expect(toSimpleItinerary(parsePnr('')).text).toContain('(no flights found)');
  });
});

describe('segmentsToCsv', () => {
  it('writes a header and one row per segment', () => {
    const csv = segmentsToCsv(result);
    const rows = csv.trimEnd().split('\r\n');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toBe(
      'recordLocator,segmentNumber,airline,flightNumber,bookingClass,departureDate,departureTime,origin,destination,arrivalDate,arrivalTime,arrivalDayOffset,status,statusMeaning,seats,operatingCarrierCode,operatingCarrierName,equipment,airlineLocator',
    );
    expect(rows[2]).toBe(
      'T4CPLX,4,AA,104,Y,2026-11-19,18:30,JFK,LHR,2026-11-20,06:35,1,HL,Waitlisted,2,,,,JX7TRE',
    );
  });

  it('supports delimiter, eol and header options', () => {
    const csv = segmentsToCsv(result, { delimiter: ';', eol: '\n', header: false });
    expect(csv.split('\n')[0]).toMatch(/^T4CPLX;3;BA;1511;/);
  });

  it('quotes delimiters and neutralises spreadsheet formulas', () => {
    const evil: ParseResult = {
      ...result,
      recordLocator: 'ABC123',
      segments: [
        {
          ...result.segments[0]!,
          operatingCarrier: { name: '=HYPERLINK("http://x","y")' },
          arrivalDayOffset: -1,
          statusMeaning: 'Confirmed, really',
        },
      ],
    };
    const row = segmentsToCsv(evil, { header: false }).trimEnd();
    expect(row).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(row).toContain(',-1,'); // plain negative numbers stay numeric
    expect(row).toContain('"Confirmed, really"');
  });
});
