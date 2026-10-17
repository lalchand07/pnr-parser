import { describe, expect, it } from 'vitest';
import { parseNameLine } from '../src/names.js';
import { parsePnr } from '../src/index.js';

const ref = { year: 2026, month: 10, day: 15 };

describe('parseNameLine', () => {
  it('returns null for lines that are not name lines', () => {
    expect(parseNameLine(' 1 BA 117Y 15DEC T LHRJFK HK1', true, ref)).toBeNull();
    expect(parseNameLine('REMARK 1.SMITH/JOHN', true, ref)).toBeNull();
    expect(parseNameLine('  6 AP LON 020', true, ref)).toBeNull();
  });

  it('only accepts Amadeus-style names when allowed', () => {
    expect(parseNameLine('  1.SAMPLE/JOHN MR', false, ref)).toBeNull();
    expect(parseNameLine('  1.SAMPLE/JOHN MR', true, ref)?.style).toBe('element');
    expect(parseNameLine(' 1.1SAMPLE/JOHN MR', false, ref)?.style).toBe('party');
  });

  it('reads multi-word given names and titles', () => {
    const r = parseNameLine('  1.SAMPLE/JOHN PAUL MR', true, ref)!;
    expect(r.passengers[0]).toMatchObject({
      surname: 'SAMPLE',
      givenName: 'JOHN PAUL',
      title: 'MR',
    });
  });

  it('marks MSTR as a child derived from the title', () => {
    const r = parseNameLine(' 1.1SAMPLE/ADAM MSTR', false, ref)!;
    expect(r.passengers[0]).toMatchObject({ type: 'CHD', typeSource: 'title' });
  });

  it('keeps MISS as an adult unless a marker says otherwise', () => {
    const r = parseNameLine(' 1.1SAMPLE/ANNA MISS', false, ref)!;
    expect(r.passengers[0]).toMatchObject({ type: 'ADT', typeSource: 'default', title: 'MISS' });
  });

  it('reads CHD / INF words as explicit markers', () => {
    const r = parseNameLine('  1.SAMPLE/ADAM MSTR CHD  2.SAMPLE/BABY INF', true, ref)!;
    expect(r.passengers.map((p) => [p.type, p.typeSource, p.title])).toEqual([
      ['CHD', 'explicit', 'MSTR'],
      ['INF', 'explicit', undefined],
    ]);
  });

  it('reads Sabre *INS (infant with seat) and *CNN', () => {
    const r = parseNameLine(' 1.1SAMPLE/BABY*INS  2.1SAMPLE/KID*CNN', false, ref)!;
    expect(r.passengers.map((p) => [p.type, p.typeCode])).toEqual([
      ['INF', 'INS'],
      ['CHD', 'CNN'],
    ]);
  });

  it('does not strip MS glued to a given name (too ambiguous)', () => {
    const r = parseNameLine(' 1.1SAMPLE/WILLIAMS', false, ref)!;
    expect(r.passengers[0]).toMatchObject({ givenName: 'WILLIAMS' });
    expect(r.passengers[0]!.title).toBeUndefined();
  });

  it('reads an Amadeus infant with no name, only a date of birth', () => {
    const r = parseNameLine('  1.SAMPLE/JANE MRS(INF/12MAR26)', true, ref)!;
    expect(r.passengers[1]).toMatchObject({
      id: '1.INF',
      surname: 'SAMPLE',
      givenName: '',
      type: 'INF',
      dateOfBirth: '2026-03-12',
      associatedPassengerId: '1',
    });
  });

  it('ignores unknown bracketed data such as customer IDs', () => {
    const r = parseNameLine('  1.SAMPLE/JANE MRS(IDX123456)', true, ref)!;
    expect(r.passengers).toHaveLength(1);
    expect(r.passengers[0]!.raw).toContain('IDX123456');
  });

  it('reports a party count that does not match the given names', () => {
    const r = parseNameLine(' 1.3SAMPLE/JOHN MR/JANE MRS', false, ref)!;
    expect(r.passengers).toHaveLength(2);
    expect(r.notes[0]).toMatch(/announces 3 passenger/);
  });
});

describe('names through parsePnr', () => {
  it('warns about a count mismatch with the line number', () => {
    const r = parsePnr(' 1.3SAMPLE/JOHN MR/JANE MRS\n 1 BA 117Y 15DEC T LHRJFK HK1  1020A  115P', {
      referenceDate: '2026-10-15',
    });
    expect(r.warnings).toContainEqual(expect.objectContaining({ code: 'NAME_UNPARSED', line: 1 }));
  });
  it('does not read Sabre remarks as passenger names', () => {
    const r = parsePnr(
      ' 1.1SAMPLE/JOHN MR\n 1 BA 117Y 15DEC T LHRJFK HK1  1020A  115P\nREMARKS\n  1.CALL/CUSTOMER BACK',
      { referenceDate: '2026-10-15' },
    );
    expect(r.passengers).toHaveLength(1);
    expect(r.unparsedLines.at(-1)).toMatchObject({ category: 'remark', line: 4 });
  });
});
