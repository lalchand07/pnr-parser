import { AIRCRAFT_TYPES } from './aircraft.js';
import { MONTH_PATTERN, parseDayMonth } from './dates.js';
import { isTwelveHourToken, parseGdsTime } from './time.js';

/** Day-of-week token styles seen between the date and the city pair. */
export type DowStyle = 'letter' | 'digit' | 'none';

/** Raw facts read from one segment line, before year inference. */
export interface SegmentLine {
  segmentNumber?: number;
  airline: string;
  flightNumber: string;
  bookingClass: string;
  dateRaw: string;
  day: number;
  month: number;
  /** ISO weekday (Mon = 1) printed on the line, when recognisable. */
  printedWeekday?: number;
  dowStyle: DowStyle;
  origin: string;
  destination: string;
  status?: string;
  seats?: number;
  departureTime?: string;
  arrivalTime?: string;
  /** Explicit offset printed next to the arrival time. */
  explicitOffset?: number;
  /** Arrival date printed after the arrival time (Amadeus), e.g. `16DEC`. */
  arrivalDateRaw?: string;
  airlineLocator?: string;
  equipment?: string;
  operatingCarrierText?: string;
  /** Evidence about which GDS printed the line. */
  traits: SegmentTraits;
  /** Problems found while reading the tail; caller adds line numbers. */
  issues: SegmentIssue[];
}

export interface SegmentTraits {
  dotAfterNumber: boolean;
  twelveHour: boolean;
  offsetMarker?: '#' | '+' | '-' | '¥' | '‡';
  arrivalDatePrinted: boolean;
  dcLocator: boolean;
  slashLocator: boolean;
  flightClassJoined: boolean;
}

export type SegmentIssueField =
  | 'status'
  | 'departure time'
  | 'arrival time'
  | 'arrival date';

export interface SegmentIssue {
  kind: 'missing' | 'invalid';
  field: SegmentIssueField;
  detail?: string;
}

// Sabre prints M T W Q F J S; Amadeus prints 1-7 (Mon = 1).
const SABRE_DOW: Readonly<Record<string, number>> = { M: 1, T: 2, W: 3, Q: 4, F: 5, J: 6, S: 7 };

const CORE = new RegExp(
  [
    '^\\s*',
    // Segment / element number, followed by a dot (Galileo) or whitespace.
    '(?:(?<seg>\\d{1,3})(?<dot>\\.)?\\s*)?',
    // Marketing airline: two characters, not both digits.
    '(?<air>[A-Z][A-Z0-9]|[0-9][A-Z])',
    '\\s*(?<flt>\\d{1,4})(?<sep>\\s*)(?<cls>[A-Z])',
    `\\s*(?<date>\\d{1,2}(?:${MONTH_PATTERN}))`,
    // Optional day-of-week token: Sabre letter or Amadeus digit.
    '(?:\\s+(?<dow>[A-Z1-7]))?',
    '\\s+(?<org>[A-Z]{3})\\s?(?<dst>[A-Z]{3})',
    '(?<tail>(?:\\s.*)?)$',
  ].join(''),
);

/** A line that begins like a segment (used to detect wrapped lines). */
const SEGMENT_START = /^\s*\d{1,3}\.?\s*(?:[A-Z][A-Z0-9]|[0-9][A-Z])\s*\d{1,4}\s*[A-Z](?:\s|\d|$)/;

/** A line that looks like the rest of a wrapped segment line. */
const TAIL_CONTINUATION =
  /^\s*(?:[A-Z]{2}\s?\d{1,3}\s+)?(?:\d{3,4}[APNM]?|\d{1,2}[APNM])(?:\s|$|[#+¥‡-])/;

/** A line holding only Sabre slash qualifiers, e.g. `/DCBA*ABC123 /E`. */
const EXTRAS_CONTINUATION = /^\s*\/DC[A-Z0-9]{2}\S*(?:\s+\/\S+)*\s*$/;

export function looksLikeExtrasContinuation(text: string): boolean {
  return EXTRAS_CONTINUATION.test(text);
}

export function looksLikeSegmentStart(text: string): boolean {
  return SEGMENT_START.test(text);
}

export function looksLikeTailContinuation(text: string): boolean {
  return TAIL_CONTINUATION.test(text);
}

export function parseSegmentLine(text: string): SegmentLine | null {
  const m = CORE.exec(text);
  if (!m?.groups) return null;
  const g = m.groups;
  const dm = parseDayMonth(g.date!);
  if (!dm) return null;
  if (g.org === g.dst) return null;

  let dowStyle: DowStyle = 'none';
  let printedWeekday: number | undefined;
  if (g.dow) {
    if (/\d/.test(g.dow)) {
      dowStyle = 'digit';
      printedWeekday = Number(g.dow);
    } else {
      dowStyle = 'letter';
      printedWeekday = SABRE_DOW[g.dow];
    }
  }

  const seg: SegmentLine = {
    airline: g.air!,
    flightNumber: String(Number(g.flt)),
    bookingClass: g.cls!,
    dateRaw: g.date!,
    day: dm.day,
    month: dm.month,
    dowStyle,
    origin: g.org!,
    destination: g.dst!,
    traits: {
      dotAfterNumber: Boolean(g.dot),
      twelveHour: false,
      arrivalDatePrinted: false,
      dcLocator: false,
      slashLocator: false,
      flightClassJoined: g.sep === '',
    },
    issues: [],
  };
  if (g.seg !== undefined) seg.segmentNumber = Number(g.seg);
  if (printedWeekday !== undefined) seg.printedWeekday = printedWeekday;

  parseTail(g.tail ?? '', seg);
  return seg;
}

const STATUS = /^\s*(?<status>[A-Z]{2})\s?(?<seats>\d{1,3})(?=\s|$)/;
const TIMES = new RegExp(
  [
    '^\\s+(?<dep>\\d{1,4}[APNM]?)(?=\\s|$|[#+¥‡-])',
    '(?:\\s+(?<arr>\\d{1,4}[APNM]?)(?=\\s|$|[#+¥‡*-]))?',
    // Day offset: `+1`, `-1`, `¥1`, `‡1`, `#` (Galileo, +1) or `#2`.
    '(?:\\s*(?<off>[+¥‡-]\\s?\\d|#\\d?))?',
    // Amadeus prints the arrival date after the arrival time.
    `(?:\\s+(?<arrDate>\\d{1,2}(?:${MONTH_PATTERN}))(?=\\s|$))?`,
  ].join(''),
);

function parseTail(tail: string, seg: SegmentLine): void {
  let rest = tail;

  const s = STATUS.exec(rest);
  if (s?.groups) {
    seg.status = s.groups.status!;
    seg.seats = Number(s.groups.seats);
    rest = rest.slice(s[0].length);
  } else {
    seg.issues.push({ kind: 'missing', field: 'status' });
  }

  const t = TIMES.exec(rest);
  if (t?.groups) {
    rest = rest.slice(t[0].length);
    const { dep, arr, off, arrDate } = t.groups;
    readTime(dep!, 'departure time', seg);
    if (arr) readTime(arr, 'arrival time', seg);
    else seg.issues.push({ kind: 'missing', field: 'arrival time' });
    if (off) readOffset(off, seg);
    if (arrDate) {
      seg.arrivalDateRaw = arrDate;
      seg.traits.arrivalDatePrinted = true;
    }
  } else {
    seg.issues.push({ kind: 'missing', field: 'departure time' });
    seg.issues.push({ kind: 'missing', field: 'arrival time' });
  }

  readExtras(rest, seg);
}

function readTime(token: string, field: 'departure time' | 'arrival time', seg: SegmentLine): void {
  const time = parseGdsTime(token);
  if (isTwelveHourToken(token)) seg.traits.twelveHour = true;
  if (!time) {
    seg.issues.push({ kind: 'invalid', field, detail: token });
    return;
  }
  if (field === 'departure time') seg.departureTime = time;
  else seg.arrivalTime = time;
}

function readOffset(token: string, seg: SegmentLine): void {
  const compact = token.replace(/\s/g, '');
  const marker = compact[0] as '#' | '+' | '-' | '¥' | '‡';
  seg.traits.offsetMarker = marker;
  const digits = compact.slice(1);
  if (marker === '#') {
    seg.explicitOffset = digits ? Number(digits) : 1;
  } else {
    seg.explicitOffset = marker === '-' ? -Number(digits) : Number(digits);
  }
}

const DC_LOCATOR = /^\/DC([A-Z0-9]{2})(?:\*([A-Z0-9]{5,8}))?$/;
const SLASH_LOCATOR = /^([A-Z][A-Z0-9]|[0-9][A-Z])\/([A-Z0-9]{5,8})$/;
const EQUIPMENT_PREFIX = /^(?:EQP|EQ|EQUIP)[:/]?([A-Z0-9]{3,4})?$/;

export function readExtras(rest: string, seg: SegmentLine): void {
  const operated = /\bOPERATED\s+BY\s+(.+)$/.exec(rest);
  if (operated) {
    seg.operatingCarrierText = operated[1]!.trim();
    rest = rest.slice(0, operated.index);
  }
  const tokens = rest.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const dc = DC_LOCATOR.exec(token);
    if (dc) {
      seg.traits.dcLocator = true;
      if (dc[2]) seg.airlineLocator = dc[2];
      continue;
    }
    const sl = SLASH_LOCATOR.exec(token);
    if (sl && /[A-Z]/.test(sl[2]!)) {
      seg.traits.slashLocator = true;
      seg.airlineLocator = sl[2]!;
      continue;
    }
    const eq = EQUIPMENT_PREFIX.exec(token);
    if (eq) {
      const code = eq[1] ?? tokens[i + 1];
      if (code && AIRCRAFT_TYPES.has(code)) {
        seg.equipment = code;
        if (!eq[1]) i++;
      }
      continue;
    }
    const bare = token.replace(/^\//, '');
    if (seg.equipment === undefined && AIRCRAFT_TYPES.has(bare)) {
      seg.equipment = bare;
    }
  }
}
