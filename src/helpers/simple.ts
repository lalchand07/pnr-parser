import type { Passenger, ParseResult, Segment } from '../types.js';

export interface SimpleItineraryRow {
  segment: number;
  /** `BA 117` */
  flight: string;
  /** `YYYY-MM-DD` */
  date: string;
  from: string;
  to: string;
  /** `HH:MM`, or empty when not shown. */
  departs: string;
  /** `HH:MM`, with `+1` / `-1` when arriving on another day. */
  arrives: string;
  bookingClass: string;
  /** `Confirmed (HK)` */
  status: string;
  /** `Operated by AMERICAN AIRLINES`, when codeshare info was shown. */
  note: string;
}

export interface SimpleItinerary {
  recordLocator?: string;
  /** `MR JOHN SMITH`, `MSTR ADAM SMITH (child)` */
  passengers: string[];
  segments: SimpleItineraryRow[];
  /** The same data as an aligned plain-text table. */
  text: string;
}

const TYPE_LABEL: Record<Passenger['type'], string> = {
  ADT: '',
  CHD: ' (child)',
  INF: ' (infant)',
};

export function passengerDisplayName(p: Passenger): string {
  const parts = [p.title, p.givenName, p.surname].filter((x): x is string => Boolean(x));
  return parts.join(' ') + TYPE_LABEL[p.type];
}

function row(s: Segment): SimpleItineraryRow {
  let arrives = s.arrivalTime ?? '';
  if (arrives && s.arrivalDayOffset !== 0) {
    arrives += s.arrivalDayOffset > 0 ? ` +${s.arrivalDayOffset}` : ` ${s.arrivalDayOffset}`;
  }
  const op = s.operatingCarrier;
  const note = op ? `Operated by ${op.name ?? op.code ?? ''}`.trim() : '';
  return {
    segment: s.segmentNumber,
    flight: `${s.airline} ${s.flightNumber}`,
    date: s.departureDate,
    from: s.origin,
    to: s.destination,
    departs: s.departureTime ?? '',
    arrives,
    bookingClass: s.bookingClass,
    status: s.status ? `${s.statusMeaning} (${s.status})` : s.statusMeaning,
    note,
  };
}

/** Reduces a parse result to display-ready strings. */
export function toSimpleItinerary(result: ParseResult): SimpleItinerary {
  const segments = result.segments.map(row);
  const passengers = result.passengers.map(passengerDisplayName);
  const out: SimpleItinerary = {
    passengers,
    segments,
    text: renderText(result, passengers, segments),
  };
  if (result.recordLocator) out.recordLocator = result.recordLocator;
  return out;
}

function renderText(result: ParseResult, passengers: string[], rows: SimpleItineraryRow[]): string {
  const lines: string[] = [];
  if (result.recordLocator) lines.push(`Booking reference: ${result.recordLocator}`);
  if (passengers.length) lines.push(`Passengers: ${passengers.join(', ')}`);
  if (lines.length) lines.push('');
  const header = ['#', 'Flight', 'Date', 'From', 'To', 'Departs', 'Arrives', 'Class', 'Status'];
  const table = rows.map((r) => [
    String(r.segment),
    r.flight,
    r.date,
    r.from,
    r.to,
    r.departs,
    r.arrives,
    r.bookingClass,
    r.note ? `${r.status} - ${r.note}` : r.status,
  ]);
  const widths = header.map((h, c) => Math.max(h.length, ...table.map((t) => t[c]!.length)));
  const fmt = (cells: string[]): string =>
    cells
      .map((cell, c) => (c === cells.length - 1 ? cell : cell.padEnd(widths[c]!)))
      .join('  ')
      .trimEnd();
  lines.push(fmt(header));
  for (const t of table) lines.push(fmt(t));
  if (rows.length === 0) lines.push('(no flights found)');
  return lines.join('\n');
}
