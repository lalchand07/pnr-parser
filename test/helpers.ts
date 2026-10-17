import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GdsFormat, Passenger, Segment } from '../src/index.js';

export const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
export const DEFAULT_REFERENCE_DATE = '2026-10-15';

export interface Fixture {
  /** Path relative to the fixtures directory, e.g. `sabre/01-oneway-single.txt`. */
  name: string;
  /** Lines of front matter (comments). */
  notes: string[];
  /** Assumption IDs referenced by the fixture (`# ASSUMPTION A3 A4`). */
  assumptions: string[];
  referenceDate: string;
  format?: GdsFormat;
  /** The PNR text handed to the parser. */
  text: string;
}

/**
 * Fixture files start with `#` comment lines (front matter), then a line
 * containing only `---`, then the raw PNR text.
 */
export function parseFixtureFile(name: string, content: string): Fixture {
  const lines = content.split('\n');
  const sep = lines.indexOf('---');
  if (sep < 0) throw new Error(`${name}: missing --- separator`);
  const notes = lines.slice(0, sep);
  const fixture: Fixture = {
    name,
    notes,
    assumptions: [],
    referenceDate: DEFAULT_REFERENCE_DATE,
    text: lines.slice(sep + 1).join('\n'),
  };
  for (const note of notes) {
    if (!note.startsWith('#')) throw new Error(`${name}: front matter lines must start with #`);
    const ref = /^#\s*referenceDate:\s*(\S+)/.exec(note);
    if (ref) fixture.referenceDate = ref[1]!;
    const fmt = /^#\s*format:\s*(\S+)/.exec(note);
    if (fmt) fixture.format = fmt[1] as GdsFormat;
    const as = /^#\s*ASSUMPTION\s+((?:A\d+\s*)+)/.exec(note);
    if (as) fixture.assumptions.push(...as[1]!.trim().split(/\s+/));
  }
  return fixture;
}

export function loadFixtures(): Fixture[] {
  const out: Fixture[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.txt')) {
        const name = relative(FIXTURE_DIR, full).split('\\').join('/');
        out.push(parseFixtureFile(name, readFileSync(full, 'utf8')));
      }
    }
  };
  walk(FIXTURE_DIR);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Compact, readable signature of a segment for expectation tables. */
export function segSig(s: Segment): string {
  const off = s.arrivalDayOffset >= 0 ? `+${s.arrivalDayOffset}` : String(s.arrivalDayOffset);
  let sig =
    `${s.segmentNumber} ${s.airline}${s.flightNumber} ${s.bookingClass} ${s.departureDate} ` +
    `${s.origin}${s.destination} ${s.departureTime ?? '?'}-${s.arrivalTime ?? '?'}${off} ` +
    `${s.status || '--'}${s.seats ?? ''}`;
  if (s.operatingCarrier) sig += ` op=${s.operatingCarrier.name ?? s.operatingCarrier.code}`;
  if (s.equipment) sig += ` eq=${s.equipment}`;
  if (s.airlineLocator) sig += ` rl=${s.airlineLocator}`;
  return sig;
}

/** Compact signature of a passenger. */
export function paxSig(p: Passenger): string {
  let sig = `${p.id} ${p.surname}/${p.givenName} ${p.title ?? '-'} ${p.type}`;
  if (p.age !== undefined) sig += ` age=${p.age}`;
  if (p.dateOfBirth) sig += ` dob=${p.dateOfBirth}`;
  return sig;
}
