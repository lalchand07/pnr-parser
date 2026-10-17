import type { ParseResult, Segment } from '../types.js';

export interface CsvOptions {
  /** Field delimiter. Default `,`. */
  delimiter?: string;
  /** Line ending. Default `\r\n` (RFC 4180). */
  eol?: string;
  /** Include the header row. Default true. */
  header?: boolean;
}

const COLUMNS: readonly [string, (s: Segment, r: ParseResult) => string | number | undefined][] = [
  ['recordLocator', (_s, r) => r.recordLocator],
  ['segmentNumber', (s) => s.segmentNumber],
  ['airline', (s) => s.airline],
  ['flightNumber', (s) => s.flightNumber],
  ['bookingClass', (s) => s.bookingClass],
  ['departureDate', (s) => s.departureDate],
  ['departureTime', (s) => s.departureTime],
  ['origin', (s) => s.origin],
  ['destination', (s) => s.destination],
  ['arrivalDate', (s) => s.arrivalDate],
  ['arrivalTime', (s) => s.arrivalTime],
  ['arrivalDayOffset', (s) => s.arrivalDayOffset],
  ['status', (s) => s.status],
  ['statusMeaning', (s) => s.statusMeaning],
  ['seats', (s) => s.seats],
  ['operatingCarrierCode', (s) => s.operatingCarrier?.code],
  ['operatingCarrierName', (s) => s.operatingCarrier?.name],
  ['equipment', (s) => s.equipment],
  ['airlineLocator', (s) => s.airlineLocator],
];

/**
 * Serialises segments as CSV (one row per segment).
 * Cells that a spreadsheet would treat as a formula (`=`, `+`, `-`, `@`, tab,
 * CR) are prefixed with `'` unless they are plain numbers.
 */
export function segmentsToCsv(result: ParseResult, options: CsvOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const eol = options.eol ?? '\r\n';
  const rows: string[] = [];
  if (options.header !== false) rows.push(COLUMNS.map(([name]) => name).join(delimiter));
  for (const s of result.segments) {
    rows.push(COLUMNS.map(([, get]) => cell(get(s, result), delimiter)).join(delimiter));
  }
  return rows.join(eol) + eol;
}

function cell(value: string | number | undefined, delimiter: string): string {
  if (value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(?:\.\d+)?$/.test(text)) text = `'${text}`;
  if (text.includes(delimiter) || /["\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}
