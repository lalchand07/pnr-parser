import { classifyLine, sectionHeading } from './classify.js';
import type { CalendarDate } from './dates.js';
import {
  addDays,
  diffDays,
  inferYear,
  inferYearNear,
  isoWeekday,
  parseDayMonth,
  resolveReferenceDate,
  toIso,
} from './dates.js';
import { confidenceFor, detectFromLines, FORMATS } from './detect.js';
import { PROFILES } from './formats/profiles.js';
import { findLocator } from './locator.js';
import { parseNameLine } from './names.js';
import type { InputLine } from './normalize.js';
import { splitLines } from './normalize.js';
import type { SegmentLine } from './segment.js';
import {
  looksLikeExtrasContinuation,
  looksLikeSegmentStart,
  looksLikeTailContinuation,
  parseSegmentLine,
  readExtras,
} from './segment.js';
import { describeStatus, isKnownStatus } from './status.js';
import type {
  DetectedFormat,
  OperatingCarrier,
  ParseOptions,
  ParseResult,
  ParseWarning,
  Segment,
  UnparsedCategory,
  WarningCode,
} from './types.js';

export const DEFAULT_MAX_INPUT_LENGTH = 200_000;

const WEEKDAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const OPERATED_BY = /^\s*[*/]?\s*OPERATED\s+BY\s*[:/]?\s*(.+?)\s*$/;

interface SegmentDraft {
  parsed: SegmentLine;
  lines: InputLine[];
  operating?: OperatingCarrier;
}

class WarningSink {
  readonly list: ParseWarning[] = [];
  add(code: WarningCode, message: string, line?: number): void {
    if (line === undefined) this.list.push({ code, message });
    else this.list.push({ code, message: `Line ${line}: ${message}`, line });
  }
}

/**
 * Parses pasted GDS itinerary text. Never throws: problems are reported in
 * `warnings`, and every non-blank line not turned into a segment or passenger
 * is returned in `unparsedLines`.
 */
export function parsePnr(input: string, options: ParseOptions = {}): ParseResult {
  const sink = new WarningSink();
  const ref = safeReferenceDate(options, sink);
  const result: ParseResult = {
    format: 'unknown',
    confidence: 0,
    formatForced: false,
    referenceDate: toIso(ref),
    passengers: [],
    segments: [],
    warnings: sink.list,
    unparsedLines: [],
  };
  let lines: InputLine[] = [];
  try {
    const text = toText(input, options, sink);
    lines = splitLines(text);
    run(lines, options, ref, result, sink);
  } catch (error) {
    // Defensive: a bug must never lose the user's text.
    sink.add(
      'INTERNAL_ERROR',
      `Internal parser error (${describeError(error)}). All lines were returned unparsed; please report this with an anonymized sample.`,
    );
    result.passengers = [];
    result.segments = [];
    delete result.recordLocator;
    result.unparsedLines = lines
      .filter((l) => l.text.trim() !== '')
      .map((l) => ({ line: l.number, text: l.original, category: 'unknown' as const }));
  }
  result.warnings = sortWarnings(sink.list);
  return result;
}

function safeReferenceDate(options: ParseOptions, sink: WarningSink): CalendarDate {
  const now = new Date();
  let ref: CalendarDate | null = null;
  try {
    ref = resolveReferenceDate(options?.referenceDate, now);
  } catch {
    ref = null;
  }
  if (!ref) {
    sink.add(
      'INVALID_OPTION',
      `referenceDate ${JSON.stringify(String(options?.referenceDate))} is not a valid date (expected YYYY-MM-DD or a Date); using today instead.`,
    );
    ref = resolveReferenceDate(undefined, now)!;
  }
  return ref;
}

function toText(input: unknown, options: ParseOptions, sink: WarningSink): string {
  let text: string;
  if (typeof input === 'string') text = input;
  else if (input === null || input === undefined) text = '';
  else text = String(input);
  const max =
    typeof options?.maxInputLength === 'number' && options.maxInputLength > 0
      ? Math.floor(options.maxInputLength)
      : DEFAULT_MAX_INPUT_LENGTH;
  if (text.length > max) {
    sink.add(
      'INPUT_TRUNCATED',
      `Input is ${text.length} characters; only the first ${max} were parsed (see the maxInputLength option).`,
    );
    text = text.slice(0, max);
  }
  return text;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 200);
  return 'unknown error';
}

function run(
  lines: InputLine[],
  options: ParseOptions,
  ref: CalendarDate,
  result: ParseResult,
  sink: WarningSink,
): void {
  if (lines.every((l) => l.text.trim() === '')) {
    sink.add('EMPTY_INPUT', 'Input is empty; nothing to parse.');
    return;
  }

  // ---- Format -----------------------------------------------------------
  const detection = detectFromLines(lines);
  let format: DetectedFormat = detection.format;
  let confidence = detection.confidence;
  const requested = options?.format;
  if (requested !== undefined && requested !== 'auto') {
    if ((FORMATS as readonly string[]).includes(requested)) {
      format = requested;
      confidence = confidenceFor(requested, detection.scores);
      result.formatForced = true;
      if (
        detection.format !== requested &&
        detection.format !== 'unknown' &&
        detection.confidence >= 0.5
      ) {
        sink.add(
          'FORMAT_MISMATCH',
          `Format was forced to ${PROFILES[requested].label}, but the text looks like ${PROFILES[detection.format].label} (confidence ${detection.confidence}).`,
        );
      }
    } else {
      sink.add(
        'INVALID_OPTION',
        `Unknown format ${JSON.stringify(String(requested))}; expected one of auto, ${FORMATS.join(', ')}. Auto-detection was used.`,
      );
    }
  }
  result.format = format;
  result.confidence = confidence;

  // ---- Line walk --------------------------------------------------------
  const drafts: SegmentDraft[] = [];
  let section: UnparsedCategory | null = null;
  let lastSegment: SegmentDraft | null = null;
  let nonBlank = 0;
  const allowElementNamesEverywhere = format === 'amadeus' || format === 'unknown';

  const markUnparsed = (line: InputLine, category: UnparsedCategory): void => {
    result.unparsedLines.push({ line: line.number, text: line.original, category });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const text = line.text;
    if (text.trim() === '') continue;
    const position = nonBlank++;

    // Sabre section headings (PHONES, REMARKS, …).
    const heading = sectionHeading(text);
    if (heading) {
      section = heading;
      lastSegment = null;
      markUnparsed(line, heading);
      continue;
    }

    // `OPERATED BY …` continuation of the previous segment.
    const op = OPERATED_BY.exec(text);
    if (op) {
      if (lastSegment) {
        lastSegment.operating = readOperatingCarrier(op[1]!);
        lastSegment.lines.push(line);
      } else {
        markUnparsed(line, 'unknown');
      }
      continue;
    }

    // Sabre qualifiers (`/DCBA*ABC123 /E`) wrapped onto their own line.
    if (lastSegment && looksLikeExtrasContinuation(text)) {
      readExtras(text, lastSegment.parsed);
      lastSegment.lines.push(line);
      sink.add(
        'WRAPPED_LINE_JOINED',
        `joined with line ${line.number} to read a wrapped segment.`,
        lastSegment.lines[0]!.number,
      );
      continue;
    }

    // Air segment (possibly wrapped over two lines).
    const seg = readSegment(lines, i, sink);
    if (seg) {
      drafts.push(seg.draft);
      lastSegment = seg.draft;
      section = null;
      i += seg.consumed - 1;
      nonBlank += seg.consumed - 1;
      continue;
    }

    // Passenger names.
    if (section === null) {
      const allowElement = allowElementNamesEverywhere || drafts.length === 0;
      const names = parseNameLine(text, allowElement, ref);
      if (names) {
        for (const p of names.passengers) result.passengers.push({ ...p, line: line.number });
        for (const problem of names.problems) {
          sink.add('NAME_UNPARSED', `could not read passenger name "${problem}"`, line.number);
        }
        for (const note of names.notes) sink.add('NAME_UNPARSED', note, line.number);
        lastSegment = null;
        continue;
      }
    }

    // Record locator (the line itself is still reported as a header).
    const loc = findLocator(text, position);
    if (loc) {
      if (result.recordLocator === undefined) result.recordLocator = loc.locator;
      markUnparsed(line, 'header');
      lastSegment = null;
      continue;
    }

    markUnparsed(line, classifyLine(text, section));
    lastSegment = null;
  }

  // ---- Segments: numbering, year inference, validation -------------------
  let mismatchReported = false;
  let previousNumber = 0;
  for (const draft of drafts) {
    const segment = buildSegment(draft, ref, sink, previousNumber);
    previousNumber = segment.segmentNumber;
    result.segments.push(segment);
    if (!mismatchReported && format !== 'unknown') {
      const why = PROFILES[format].mismatch(draft.parsed);
      if (why) {
        mismatchReported = true;
        sink.add(
          'FORMAT_MISMATCH',
          `segment uses ${why}, which is unusual for ${PROFILES[format].label}; parsed anyway.`,
          segment.lines[0],
        );
      }
    }
  }
  checkChronology(result.segments, result.referenceDate, sink);

  // ---- Summary warnings --------------------------------------------------
  if (result.segments.length === 0) {
    sink.add('NO_SEGMENTS', 'No air segments were found.');
  }
  if (format === 'unknown') {
    sink.add(
      'UNKNOWN_FORMAT',
      'Could not recognise the GDS format; a generic grammar was used. Pass the format option if you know it.',
    );
  } else if (!result.formatForced && confidence < 0.5) {
    sink.add(
      'LOW_CONFIDENCE',
      `Format detected as ${PROFILES[format].label} with low confidence (${confidence}).`,
    );
  }
}

function readSegment(
  lines: InputLine[],
  i: number,
  sink: WarningSink,
): { draft: SegmentDraft; consumed: number } | null {
  const line = lines[i]!;
  const next = lines[i + 1];
  const parsed = parseSegmentLine(line.text);

  if (!parsed) {
    // A segment that wrapped before the city pair.
    if (next && next.text.trim() !== '' && looksLikeSegmentStart(line.text)) {
      const joined = parseSegmentLine(`${line.text} ${next.text.trim()}`);
      if (joined && !joined.issues.some((x) => x.field === 'status')) {
        sink.add(
          'WRAPPED_LINE_JOINED',
          `joined with line ${next.number} to read a wrapped segment.`,
          line.number,
        );
        return { draft: { parsed: joined, lines: [line, next] }, consumed: 2 };
      }
    }
    return null;
  }

  // A segment whose status/times wrapped onto the next line.
  if (
    parsed.issues.length > 0 &&
    next &&
    looksLikeTailContinuation(next.text) &&
    !parseSegmentLine(next.text)
  ) {
    const joined = parseSegmentLine(`${line.text} ${next.text.trim()}`);
    if (joined && joined.issues.length < parsed.issues.length) {
      sink.add(
        'WRAPPED_LINE_JOINED',
        `joined with line ${next.number} to read a wrapped segment.`,
        line.number,
      );
      return { draft: { parsed: joined, lines: [line, next] }, consumed: 2 };
    }
  }
  return { draft: { parsed, lines: [line] }, consumed: 1 };
}

function readOperatingCarrier(text: string): OperatingCarrier {
  const cleaned = text.replace(/^[/:\s]+|[.\s]+$/g, '');
  if (/^(?:[A-Z][A-Z0-9]|[0-9][A-Z])$/.test(cleaned)) return { code: cleaned };
  const withCode = /^((?:[A-Z][A-Z0-9]|[0-9][A-Z]))\s*\/\s*(.+)$/.exec(cleaned);
  if (withCode) return { code: withCode[1]!, name: withCode[2]!.trim() };
  return { name: cleaned };
}

function buildSegment(
  draft: SegmentDraft,
  ref: CalendarDate,
  sink: WarningSink,
  previousNumber: number,
): Segment {
  const p = draft.parsed;
  const lineNo = draft.lines[0]!.number;

  let segmentNumber = p.segmentNumber;
  if (segmentNumber === undefined) {
    segmentNumber = previousNumber + 1;
    sink.add(
      'SEGMENT_NUMBER_MISSING',
      `segment has no number; numbered ${segmentNumber} by position.`,
      lineNo,
    );
  }

  // Departure date.
  const inferred = inferYear(p.day, p.month, ref);
  const dep = inferred.date;
  if (inferred.leapAdjusted) {
    sink.add(
      'INVALID_DATE',
      `${p.dateRaw} does not exist in ${ref.year}; using the next leap year (${dep.year}).`,
      lineNo,
    );
  }

  // Field-level problems found while reading the line.
  for (const issue of p.issues) {
    if (issue.kind === 'missing') {
      sink.add('SEGMENT_FIELD_MISSING', `could not read ${issue.field}`, lineNo);
    } else {
      sink.add('INVALID_TIME', `invalid ${issue.field} "${issue.detail ?? ''}"`, lineNo);
    }
  }

  // Arrival day offset and date.
  let offset = p.explicitOffset ?? 0;
  let arrival: CalendarDate | undefined;
  if (p.arrivalDateRaw) {
    const dm = parseDayMonth(p.arrivalDateRaw);
    if (dm) {
      const printed = inferYearNear(dm.day, dm.month, dep);
      const printedOffset = diffDays(dep, printed);
      if (p.explicitOffset !== undefined && p.explicitOffset !== printedOffset) {
        sink.add(
          'ARRIVAL_DATE_CONFLICT',
          `arrival offset ${formatOffset(p.explicitOffset)} conflicts with printed arrival date ${p.arrivalDateRaw}; using the offset.`,
          lineNo,
        );
      } else if (Math.abs(printedOffset) <= 3) {
        offset = printedOffset;
      } else {
        sink.add(
          'ARRIVAL_DATE_CONFLICT',
          `printed arrival date ${p.arrivalDateRaw} is ${printedOffset} days after departure; ignored.`,
          lineNo,
        );
      }
    }
  }
  if (p.arrivalTime !== undefined || p.arrivalDateRaw !== undefined) arrival = addDays(dep, offset);

  // Day-of-week printed on the line (Sabre letters, Amadeus digits).
  if (p.printedWeekday !== undefined) {
    const actual = isoWeekday(dep);
    if (actual !== p.printedWeekday) {
      sink.add(
        'DAY_OF_WEEK_MISMATCH',
        `printed day of week (${WEEKDAYS[p.printedWeekday]}) does not match the inferred date ${toIso(dep)} (${WEEKDAYS[actual]}); check referenceDate.`,
        lineNo,
      );
    }
  }

  // Status.
  const status = describeStatus(p.status ?? '');
  if (p.status !== undefined && !isKnownStatus(p.status)) {
    sink.add('UNKNOWN_STATUS', `unknown segment status code "${p.status}"`, lineNo);
  }

  const segment: Segment = {
    segmentNumber,
    airline: p.airline,
    flightNumber: p.flightNumber,
    bookingClass: p.bookingClass,
    departureDate: toIso(dep),
    departureDateRaw: p.dateRaw,
    origin: p.origin,
    destination: p.destination,
    arrivalDayOffset: offset,
    status: p.status ?? '',
    statusMeaning: p.status === undefined ? 'Status not shown' : status.meaning,
    statusCategory: p.status === undefined ? 'unknown' : status.category,
    lines: draft.lines.map((l) => l.number),
    raw: draft.lines.map((l) => l.original).join('\n'),
  };
  if (p.departureTime !== undefined) segment.departureTime = p.departureTime;
  if (p.arrivalTime !== undefined) segment.arrivalTime = p.arrivalTime;
  if (arrival) segment.arrivalDate = toIso(arrival);
  if (p.seats !== undefined) segment.seats = p.seats;
  const operating =
    draft.operating ??
    (p.operatingCarrierText ? readOperatingCarrier(p.operatingCarrierText) : undefined);
  if (operating) segment.operatingCarrier = operating;
  if (p.equipment !== undefined) segment.equipment = p.equipment;
  if (p.airlineLocator !== undefined) segment.airlineLocator = p.airlineLocator;
  return segment;
}

function formatOffset(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function checkChronology(segments: Segment[], referenceDate: string, sink: WarningSink): void {
  for (let k = 1; k < segments.length; k++) {
    const prev = segments[k - 1]!;
    const cur = segments[k]!;
    if (cur.departureDate < prev.departureDate) {
      sink.add(
        'NON_CHRONOLOGICAL',
        `segment ${cur.segmentNumber} (${cur.departureDate}) departs before segment ${prev.segmentNumber} (${prev.departureDate}). Years are inferred as the next occurrence on or after the reference date ${referenceDate}; if this trip has already started, pass an earlier referenceDate.`,
        cur.lines[0],
      );
    }
  }
}

function sortWarnings(list: ParseWarning[]): ParseWarning[] {
  return list
    .map((w, index) => ({ w, index }))
    .sort((a, b) => {
      const la = a.w.line ?? -1;
      const lb = b.w.line ?? -1;
      return la - lb || a.index - b.index;
    })
    .map((x) => x.w);
}
