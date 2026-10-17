/** GDS display formats the parser understands. */
export type GdsFormat = 'galileo' | 'sabre' | 'amadeus';

/** Detected format, or `unknown` when there was no usable evidence. */
export type DetectedFormat = GdsFormat | 'unknown';

export interface ParseOptions {
  /**
   * Force a format instead of auto-detecting it. `auto` (the default) detects.
   */
  format?: GdsFormat | 'auto';
  /**
   * Date used to infer the year of departure dates, which GDS displays omit.
   * Each departure date becomes its first occurrence on or after this date.
   * Accepts a `Date` (its local calendar day is used) or a `YYYY-MM-DD` string.
   * Defaults to today.
   */
  referenceDate?: Date | string;
  /**
   * Inputs longer than this many characters are truncated (with a warning).
   * Defaults to 200 000.
   */
  maxInputLength?: number;
}

export type SegmentStatusCategory =
  'confirmed' | 'waitlisted' | 'requested' | 'cancelled' | 'unconfirmed' | 'unknown';

export interface OperatingCarrier {
  /** Two-character IATA code, when the display printed one. */
  code?: string;
  /** Carrier name as printed (e.g. `AMERICAN AIRLINES`). */
  name?: string;
}

export interface Segment {
  /** Segment / element number as printed in the display. */
  segmentNumber: number;
  /** Marketing airline IATA code. */
  airline: string;
  flightNumber: string;
  bookingClass: string;
  /** Inferred ISO date `YYYY-MM-DD` (see year inference rules). */
  departureDate: string;
  /** Date exactly as printed, e.g. `15DEC`. */
  departureDateRaw: string;
  origin: string;
  destination: string;
  /** `HH:MM`, 24-hour, local time at origin. */
  departureTime?: string;
  /** `HH:MM`, 24-hour, local time at destination. */
  arrivalTime?: string;
  /** Days between departure and arrival dates (0, 1, 2, or -1). */
  arrivalDayOffset: number;
  /** Inferred ISO arrival date, when an arrival time was read. */
  arrivalDate?: string;
  /** Two-letter status code, e.g. `HK`; empty string when not shown. */
  status: string;
  /** Human-readable meaning of `status`. */
  statusMeaning: string;
  statusCategory: SegmentStatusCategory;
  /** Number of seats (passengers) on this segment, when shown. */
  seats?: number;
  operatingCarrier?: OperatingCarrier;
  /** IATA aircraft type code when shown, e.g. `77W`. */
  equipment?: string;
  /** Airline-side record locator when printed on the segment line. */
  airlineLocator?: string;
  /** 1-based input line numbers consumed by this segment. */
  lines: number[];
  /** Original text of the consumed lines. */
  raw: string;
}

export type PassengerType = 'ADT' | 'CHD' | 'INF';

export type Title = 'MR' | 'MRS' | 'MS' | 'MSTR' | 'MISS' | 'DR';

export interface Passenger {
  /** Name element reference as printed (`1.1`, `2.2`, `1`, `1.INF`). */
  id: string;
  surname: string;
  givenName: string;
  title?: Title;
  type: PassengerType;
  /**
   * Where `type` came from: an explicit marker (`*C08`, `(INF…)`, `CHD`),
   * a title that implies it (`MSTR` → CHD), or the default (ADT).
   */
  typeSource: 'explicit' | 'title' | 'default';
  /** Raw type code when printed (`C08`, `CNN`, `INS`, `CHD`, …). */
  typeCode?: string;
  /** Child age when printed (`*C08` → 8). */
  age?: number;
  /** ISO date of birth when printed (infants/children). */
  dateOfBirth?: string;
  /** For infants attached to an adult name element. */
  associatedPassengerId?: string;
  /** 1-based input line number. */
  line: number;
  /** The name item text as printed. */
  raw: string;
}

export type WarningCode =
  | 'EMPTY_INPUT'
  | 'INPUT_TRUNCATED'
  | 'UNKNOWN_FORMAT'
  | 'LOW_CONFIDENCE'
  | 'FORMAT_MISMATCH'
  | 'NO_SEGMENTS'
  | 'SEGMENT_FIELD_MISSING'
  | 'INVALID_TIME'
  | 'INVALID_DATE'
  | 'UNKNOWN_STATUS'
  | 'DAY_OF_WEEK_MISMATCH'
  | 'NON_CHRONOLOGICAL'
  | 'ARRIVAL_DATE_CONFLICT'
  | 'WRAPPED_LINE_JOINED'
  | 'SEGMENT_NUMBER_MISSING'
  | 'NAME_UNPARSED'
  | 'INVALID_OPTION'
  | 'INTERNAL_ERROR';

export interface ParseWarning {
  code: WarningCode;
  /** Human-readable, prefixed with `Line N:` when tied to a line. */
  message: string;
  line?: number;
}

export type UnparsedCategory =
  | 'header'
  | 'remark'
  | 'ssr'
  | 'osi'
  | 'ticketing'
  | 'fare'
  | 'contact'
  | 'arnk'
  | 'non-air-segment'
  | 'unknown';

export interface UnparsedLine {
  /** 1-based input line number. */
  line: number;
  /** Original text (trailing whitespace removed). */
  text: string;
  /** Best-effort classification. `unknown` when nothing matched. */
  category: UnparsedCategory;
}

export interface ParseResult {
  format: DetectedFormat;
  /** 0..1 — how strongly the text matches `format`. */
  confidence: number;
  /** True when `options.format` forced the format. */
  formatForced: boolean;
  /** Reference date actually used for year inference, `YYYY-MM-DD`. */
  referenceDate: string;
  recordLocator?: string;
  passengers: Passenger[];
  segments: Segment[];
  warnings: ParseWarning[];
  unparsedLines: UnparsedLine[];
}

export interface FormatDetection {
  format: DetectedFormat;
  confidence: number;
  scores: Record<GdsFormat, number>;
}
