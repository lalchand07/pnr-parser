import type { CalendarDate } from './dates.js';
import { parseDateOfBirth, toIso } from './dates.js';
import type { Passenger, PassengerType, Title } from './types.js';

export type NameStyle = 'party' | 'element';

export interface NameLineResult {
  passengers: Omit<Passenger, 'line'>[];
  /** Name items that could not be read (raw text). */
  problems: string[];
  /** Readable items with an inconsistency worth a warning. */
  notes: string[];
  /** `party` = Galileo/Sabre `1.1SMITH/…`, `element` = Amadeus `1.SMITH/…`. */
  style: NameStyle;
}

const TITLES: readonly Title[] = ['MSTR', 'MISS', 'MRS', 'MR', 'MS', 'DR'];
// Titles that may be glued to the given name (`JOHNMR`). `MS` and `DR` are
// excluded because many given names end with those letters.
const JOINABLE_TITLES: readonly Title[] = ['MSTR', 'MISS', 'MRS', 'MR'];

// Start of a name item: `1.1SMITH`, `3.I/1SMITH` (party) or `1.SMITH` (element).
const ITEM_START = /(?:^|\s)(\d{1,3})\.(?:(I\/)?(\d{1,2}))?(?=[A-Z])/g;
const SURNAME = /^[A-Z][A-Z' -]*[A-Z]$|^[A-Z]$/;
const GIVEN = /^[A-Z][A-Z' .-]*$/;

/**
 * Tries to read a passenger name line. Returns null if the line is not a
 * name line (so it can be classified elsewhere).
 */
export function parseNameLine(
  text: string,
  allowElementStyle: boolean,
  ref: CalendarDate,
): NameLineResult | null {
  const starts = [...text.matchAll(ITEM_START)];
  if (starts.length === 0) return null;
  // Everything before the first item must be blank.
  if (text.slice(0, starts[0]!.index).trim() !== '') return null;

  const isParty = starts[0]![3] !== undefined;
  if (!isParty && !allowElementStyle) return null;
  // Mixed styles on one line: not a name line we understand.
  if (starts.some((s) => (s[3] !== undefined) !== isParty)) return null;

  const result: NameLineResult = {
    passengers: [],
    problems: [],
    notes: [],
    style: isParty ? 'party' : 'element',
  };

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const end = i + 1 < starts.length ? starts[i + 1]!.index : text.length;
    const body = text.slice(start.index + start[0].length, end).trim();
    const element = start[1]!;
    const raw = text.slice(start.index, end).trim();
    const parsed = isParty
      ? readPartyItem(body, element, Number(start[3]), Boolean(start[2]), raw, ref)
      : { passengers: readElementItem(body, element, raw, ref) };
    if (parsed.passengers.length === 0) result.problems.push(raw);
    if (parsed.note) result.notes.push(parsed.note);
    result.passengers.push(...parsed.passengers);
  }

  // A line where nothing parsed is not treated as a name line.
  if (result.passengers.length === 0) return null;
  return result;
}

type PassengerDraft = Omit<Passenger, 'line'>;

/** Galileo/Sabre: `SMITH/JOHN MR/JANE MRS*C08`, infants via `I/` prefix. */
function readPartyItem(
  body: string,
  element: string,
  count: number,
  infant: boolean,
  raw: string,
  ref: CalendarDate,
): { passengers: PassengerDraft[]; note?: string } {
  const slash = body.indexOf('/');
  if (slash < 1) return { passengers: [] };
  const surname = body.slice(0, slash).trim();
  if (!SURNAME.test(surname)) return { passengers: [] };
  const chunks = body.slice(slash + 1).split('/');
  const out: PassengerDraft[] = [];
  chunks.forEach((chunk, idx) => {
    const [namePart = '', ...markers] = chunk.split('*');
    const p = buildPassenger(surname, namePart, raw);
    if (!p) return;
    p.id = `${element}.${idx + 1}`;
    if (infant) setType(p, 'INF', 'explicit', 'INF');
    for (const marker of markers) applyStarMarker(p, marker.trim(), ref);
    out.push(p);
  });
  if (out.length !== chunks.length) return { passengers: [] };
  // `1.2SMITH/A/B` announces two passengers; report a different count.
  if (count !== out.length) {
    return {
      passengers: out,
      note: `name item ${raw} announces ${count} passenger(s) but lists ${out.length}`,
    };
  }
  return { passengers: out };
}

/** Amadeus: `SMITH/JOHN MR(CHD/05JAN18)(INFLUCY/02MAY24)`. */
function readElementItem(
  body: string,
  element: string,
  raw: string,
  ref: CalendarDate,
): PassengerDraft[] {
  const groups: string[] = [];
  const name = body.replace(/\(([^)]*)\)?/g, (_m, inner: string) => {
    groups.push(inner.trim());
    return ' ';
  });
  const slash = name.indexOf('/');
  if (slash < 1) return [];
  const surname = name.slice(0, slash).trim();
  if (!SURNAME.test(surname)) return [];
  const p = buildPassenger(surname, name.slice(slash + 1), raw);
  if (!p) return [];
  p.id = element;
  const out: PassengerDraft[] = [p];

  for (const g of groups) {
    if (/^INF/.test(g)) {
      const inf = readAmadeusInfant(g, p, element, ref);
      if (inf) out.push(inf);
      else setType(p, 'INF', 'explicit', 'INF');
    } else if (/^(CHD|CNN|C\d{2})(\/|$)/.test(g)) {
      const [code = 'CHD', dob] = g.split('/');
      setType(p, 'CHD', 'explicit', code);
      readAge(p, code);
      if (dob) setDob(p, dob, ref);
    } else if (/^(ADT|YTH|SRC|STU|MIL|YCD)$/.test(g)) {
      p.typeCode = g;
      setType(p, 'ADT', 'explicit', g);
    }
    // Other bracketed data (customer IDs, etc.) stays in `raw`.
  }
  return out;
}

function readAmadeusInfant(
  group: string,
  adult: PassengerDraft,
  element: string,
  ref: CalendarDate,
): PassengerDraft | null {
  const parts = group
    .slice(3)
    .replace(/^\//, '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  let dob: string | undefined;
  const last = parts[parts.length - 1];
  if (last && /^\d{1,2}[A-Z]{3}\d{2,4}$/.test(last)) {
    dob = last;
    parts.pop();
  }
  let surname = adult.surname;
  let given = '';
  if (parts.length === 1) given = parts[0]!;
  else if (parts.length >= 2) {
    surname = parts[0]!;
    given = parts.slice(1).join(' ');
  }
  if (parts.length === 0 && !dob) return null;
  const inf = buildPassenger(surname, given, `(${group})`) ?? {
    id: '',
    surname,
    givenName: given,
    type: 'INF' as PassengerType,
    typeSource: 'explicit' as const,
    raw: `(${group})`,
  };
  inf.id = `${element}.INF`;
  inf.associatedPassengerId = element;
  setType(inf, 'INF', 'explicit', 'INF');
  if (dob) setDob(inf, dob, ref);
  return inf;
}

function buildPassenger(
  surname: string,
  givenRaw: string,
  raw: string,
): PassengerDraft | null {
  const words = givenRaw.trim().split(/\s+/).filter(Boolean);
  let title: Title | undefined;
  let marker: 'CHD' | 'INF' | undefined;

  // Trailing markers and titles, in any order: `ADAM MSTR CHD`.
  for (let guard = 0; guard < 3 && words.length > 0; guard++) {
    const last = words[words.length - 1]!;
    if ((last === 'CHD' || last === 'INF') && !marker) {
      marker = last;
      words.pop();
    } else if (!title && (TITLES as readonly string[]).includes(last)) {
      title = last as Title;
      words.pop();
    } else break;
  }
  // Title glued to the given name: `JOHNMR`.
  if (!title && words.length > 0) {
    const last = words[words.length - 1]!;
    for (const t of JOINABLE_TITLES) {
      if (last.endsWith(t) && last.length - t.length >= 2) {
        title = t;
        words[words.length - 1] = last.slice(0, -t.length);
        break;
      }
    }
  }
  const givenName = words.join(' ');
  if (givenName !== '' && !GIVEN.test(givenName)) return null;
  if (givenName === '' && !title) return null;

  const p: PassengerDraft = {
    id: '',
    surname: surname.replace(/\s+/g, ' '),
    givenName,
    type: 'ADT',
    typeSource: 'default',
    raw,
  };
  if (title) p.title = title;
  if (marker) setType(p, marker, 'explicit', marker);
  else if (title === 'MSTR') setType(p, 'CHD', 'title');
  return p;
}

/** Sabre/Galileo name remarks after `*`: `C08`, `CNN`, `CHD`, `INF`, `INS`, `ADT`, `12MAR25`. */
function applyStarMarker(p: PassengerDraft, marker: string, ref: CalendarDate): void {
  if (marker === '') return;
  if (/^C\d{2}$/.test(marker) || marker === 'CNN' || marker === 'CHD') {
    setType(p, 'CHD', 'explicit', marker);
    readAge(p, marker);
  } else if (marker === 'INF' || marker === 'INS') {
    setType(p, 'INF', 'explicit', marker);
  } else if (marker === 'ADT') {
    setType(p, 'ADT', 'explicit', marker);
  } else if (/^\d{1,2}[A-Z]{3}\d{2,4}$/.test(marker)) {
    setDob(p, marker, ref);
  }
}

function setType(
  p: PassengerDraft,
  type: PassengerType,
  source: Passenger['typeSource'],
  code?: string,
): void {
  // An explicit marker always wins over a title-derived type.
  if (p.typeSource === 'explicit' && source !== 'explicit') return;
  // Keep the most specific code (e.g. `INS` over a generic `INF`).
  if (p.typeSource === 'explicit' && p.type === type && p.typeCode && p.typeCode !== type) return;
  p.type = type;
  p.typeSource = source;
  if (code) p.typeCode = code;
}

function readAge(p: PassengerDraft, code: string): void {
  const m = /^C(\d{2})$/.exec(code);
  if (m) p.age = Number(m[1]);
}

function setDob(p: PassengerDraft, text: string, ref: CalendarDate): void {
  const d = parseDateOfBirth(text, ref);
  if (d) p.dateOfBirth = toIso(d);
}
