/**
 * Optional enrichment: airport names from a bundled OurAirports snapshot
 * (public domain). Imported separately (`pnr-parser/enrich`) so the core
 * stays small.
 *
 * Airline names are NOT bundled: no clearly licensed airline dataset was
 * available when this was built (see DATA_LICENSES.md). Pass your own map
 * via `options.airlines`.
 */
import type { ParseResult, Segment } from '../types.js';
import { AIRPORTS_TSV, COUNTRIES_TSV } from './data/airports.js';

export interface AirportInfo {
  iata: string;
  name: string;
  /** Municipality as recorded by OurAirports (may be empty). */
  city: string;
  /** ISO 3166-1 alpha-2 country code. */
  countryCode: string;
  country?: string;
}

export interface EnrichOptions {
  /** Airline names by IATA code, or a lookup function. */
  airlines?: Readonly<Record<string, string>> | ((code: string) => string | undefined);
}

export interface EnrichedSegment extends Segment {
  originAirport?: AirportInfo;
  destinationAirport?: AirportInfo;
  /** Only set when `options.airlines` knows the code. */
  airlineName?: string;
  /** Only set when `options.airlines` knows the operating carrier code. */
  operatingCarrierName?: string;
}

export interface EnrichedResult extends Omit<ParseResult, 'segments'> {
  segments: EnrichedSegment[];
}

export const AIRPORT_DATA_SOURCE = {
  name: 'OurAirports',
  url: 'https://ourairports.com/data/',
  license: 'Public Domain',
} as const;

let airports: Map<string, AirportInfo> | undefined;

function airportIndex(): Map<string, AirportInfo> {
  if (airports) return airports;
  const countries = new Map<string, string>();
  for (const line of COUNTRIES_TSV.split('\n')) {
    const [code, name] = line.split('\t');
    if (code && name) countries.set(code, name);
  }
  airports = new Map();
  for (const line of AIRPORTS_TSV.split('\n')) {
    const [iata, name, city, countryCode] = line.split('\t');
    if (!iata || !name || countryCode === undefined) continue;
    const info: AirportInfo = { iata, name, city: city ?? '', countryCode };
    const country = countries.get(countryCode);
    if (country) info.country = country;
    airports.set(iata, info);
  }
  return airports;
}

/** Looks up an airport by IATA code (case-insensitive). */
export function lookupAirport(code: string): AirportInfo | undefined {
  if (typeof code !== 'string') return undefined;
  const found = airportIndex().get(code.trim().toUpperCase());
  return found ? { ...found } : undefined;
}

/** Number of airports in the bundled dataset. */
export function airportCount(): number {
  return airportIndex().size;
}

function airlineLookup(options: EnrichOptions): (code: string) => string | undefined {
  const a = options.airlines;
  if (!a) return () => undefined;
  if (typeof a === 'function') return a;
  return (code) => (Object.hasOwn(a, code) ? a[code] : undefined);
}

/** Returns a copy of `result` with airport (and optionally airline) names added. */
export function enrich(result: ParseResult, options: EnrichOptions = {}): EnrichedResult {
  const airline = airlineLookup(options);
  return {
    ...result,
    segments: result.segments.map((s) => {
      const out: EnrichedSegment = { ...s };
      const origin = lookupAirport(s.origin);
      const destination = lookupAirport(s.destination);
      if (origin) out.originAirport = origin;
      if (destination) out.destinationAirport = destination;
      const name = airline(s.airline);
      if (name) out.airlineName = name;
      const opCode = s.operatingCarrier?.code;
      const opName = opCode ? airline(opCode) : undefined;
      if (opName) out.operatingCarrierName = opName;
      return out;
    }),
  };
}
