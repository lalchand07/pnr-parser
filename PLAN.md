# pnr-parser — implementation plan

Goal: turn pasted GDS itinerary text (Galileo/Travelport, Sabre, Amadeus) into
typed JSON, **never throw**, and be explicit (via `warnings`) about anything
that was not understood.

## Guiding principles

1. **Line accounting.** Every non-blank input line ends up in exactly one place:
   a segment (`segment.lines`), a passenger (`passenger.line`) or
   `unparsedLines`. Nothing is silently dropped. This is enforced by a
   property test.
2. **Partial results over failures.** A segment whose core (airline, flight,
   class, date, city pair) is readable is emitted even if e.g. the arrival
   time is not; the gap is reported as a warning ("Line 4: could not read
   arrival time").
3. **No hidden guessing.** Anything inferred (year, passenger type from a
   title, generic-grammar fallback) is either flagged on the object
   (`typeSource`) or reported as a warning.
4. **Zero runtime dependencies, no Node APIs in the core** — the same code runs
   in the browser playground.

## Module structure

```
src/
  index.ts              public API (parsePnr, detectFormat, helpers, types)
  types.ts              all exported types
  parse.ts              pipeline: normalize → detect → classify lines → post-process
  normalize.ts          line splitting, uppercasing, tab/NBSP cleanup, prompt stripping
  detect.ts             format scoring + confidence
  dates.ts              month parsing, year inference, day offsets, DOW checks
  time.ts               24h / 12h (A/P/N/M) time parsing
  status.ts             segment status code table (HK, KK, TK, UN, ...)
  segment.ts            segment core grammar + tolerant tail parser
  names.ts              passenger name grammars (Galileo/Sabre "1.1", Amadeus "1.")
  locator.ts            record locator patterns
  classify.ts           category for unparsed lines (remark, ssr, ticketing, ...)
  formats/profiles.ts   per-format profile (DOW style, time style, headers, element codes)
  aircraft.ts           IATA aircraft type codes used to spot equipment tokens
  helpers/simple.ts     toSimpleItinerary()
  helpers/csv.ts        segmentsToCsv() (RFC 4180, spreadsheet-formula safe)
  enrich/index.ts       separate entry: pnr-parser/enrich (airport + airline names)
  enrich/airports.ts    generated compact OurAirports dataset
  enrich/airlines.ts    generated airline dataset (only if a clearly licensed source exists)
  cli.ts                Node CLI (not part of the browser core)
scripts/
  build-airports.mjs    regenerates enrich data from OurAirports CSV
test/
  fixtures/{galileo,sabre,amadeus,mixed}/*.txt   synthetic samples with front matter
  *.test.ts             unit, fixture, property tests
playground/             Vite static app (no backend)
docs/FORMAT_NOTES.md    every format assumption, referenced by ID from fixtures
```

## Grammar approach

All three GDSs print air segments with the same skeleton:

```
<segNo> <airline><flight> <class> <ddMMM> [dow] <ORG><DST> <status><seats> <dep> <arr>[offset] [arrDate] [extras…]
```

Parsing therefore happens in two stages:

1. **Core regex** (shared, whitespace tolerant): segment number, airline,
   flight number, class, date, optional day-of-week token, city pair. If the
   core does not match, the line is not a segment.
2. **Tail parser** (token based): status+seats, departure/arrival time,
   day offset, optional arrival date, then extras (airline locator,
   equipment, operating carrier, e-ticket marker). Each missing piece becomes a
   specific warning rather than a rejected line.

Per-format **profiles** describe what each GDS normally prints, and are used
both for detection scoring and for validation warnings:

|                | Galileo/Travelport `*I`/`*R`                           | Sabre `*I`/`*IA`                                                | Amadeus `RT`                                        |
| -------------- | ------------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------- |
| Segment number | `1.` (dot)                                             | `1`                                                             | `3` (shared element numbering)                      |
| Flight/class   | `BA  117 Y`                                            | `BA 117Y`                                                       | `BA 117 Y`                                          |
| Day of week    | trailing `MO`…`SU` (not validated)                     | letter after date `M T W Q F J S`                               | digit after date `1`–`7` (Mon=1)                    |
| Times          | 24h `1020`                                             | 12h `1020A`/`700P`/`1200N`, 24h accepted                        | 24h `1020`                                          |
| Day offset     | `#` (= +1) or `+n`                                     | `¥1`, `‡1`, `+1`                                                | `+1`, plus arrival date `16DEC`                     |
| Names          | `1.1SMITH/JOHN MR`, `2.2DOE/JANE MRS/JIM MSTR`, `I/1…` | same as Galileo, `*C08`, `*INF`                                 | `1.SMITH/JOHN MR(CHD/05JAN18)` `(INFBABY/01JAN25)`  |
| Record locator | first-line header `ABC123/XX …`                        | `….*AXX 1234/15OCT26 ABCDEF`                                    | `RP/…/… … ABC123`                                   |
| Other elements | `FONE-`, `TKTG-`, `NOTE-`, `GFAX-`                     | `PHONES`, `TKT/TIME LIMIT`, `REMARKS`, `GENERAL FACTS` sections | numbered `AP`, `TK`, `SSR`, `OSI`, `RM`, `FE`, `FP` |

When the selected format's expectations are not met (e.g. 12h times in an
Amadeus display) the segment is still parsed and a `FORMAT_MISMATCH` warning
is recorded once.

Wrapped lines: if a line starts like a segment but the core fails, the parser
tries joining it with the following line and reports `WRAPPED_LINE_JOINED`.
`OPERATED BY …` lines attach to the previous segment.

## Format detection

Each line contributes weighted evidence to galileo/sabre/amadeus scores
(header patterns, DOW style, time style, offset markers, element prefixes).
`confidence = share × strength`, where `share = best / total` and
`strength = min(1, best / 8)`. No evidence → `format: "unknown"`,
confidence 0, a warning, and a best-effort generic parse. `options.format`
forces a profile; confidence then reports how well the text fits it.

## Year inference

GDS dates omit the year. For each departure date pick the first occurrence
**on or after** `referenceDate` (default: today, local calendar). 29FEB moves
to the next leap year. Arrival date = departure date + day offset; when an
explicit arrival date is printed (Amadeus) it is cross-checked. Warnings:
non-chronological segment order (likely wrong reference date) and
day-of-week mismatch (Sabre/Amadeus print DOW).

## Output types (summary)

```ts
interface ParseResult {
  format: 'galileo' | 'sabre' | 'amadeus' | 'unknown';
  confidence: number; // 0..1
  formatForced: boolean;
  referenceDate: string; // YYYY-MM-DD actually used
  recordLocator?: string;
  passengers: Passenger[];
  segments: Segment[];
  warnings: ParseWarning[]; // { code, message, line? }
  unparsedLines: UnparsedLine[]; // { line, text, category }
}
```

Segment: number, airline, flightNumber, bookingClass, departureDate (ISO),
departureDateRaw, origin, destination, departureTime/arrivalTime (HH:MM),
arrivalDayOffset, arrivalDate, status, statusMeaning, statusCategory, seats,
operatingCarrier, equipment, airlineLocator, lines, raw.

Passenger: id, surname, givenName, title, type (ADT/CHD/INF), typeSource
(explicit/title/default), typeCode, age, dateOfBirth, associatedPassengerId,
line, raw.

## Tooling

TypeScript strict, tsup (ESM + CJS + d.ts), vitest (+ fast-check for property
tests), eslint (typescript-eslint flat config), prettier, GitHub Actions
(lint, typecheck, test on Node 20 and 22; Pages deploy for the playground).
