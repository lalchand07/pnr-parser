# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-17

### Added

- `parsePnr()` for Galileo/Travelport (`*I`, `*R`), Sabre (`*I`, `*IA`, `*A`)
  and Amadeus (`RT`) itinerary displays. It reads air segments (number,
  airline, flight, class, date, city pair, times, day offset, status with its
  meaning, seats, operating carrier, equipment, airline locator), passengers
  (name, title, ADT/CHD/INF with source, age, date of birth, infant
  association) and the record locator.
- Format auto-detection with a confidence score, plus a `format` option to force one.
- Year inference from `referenceDate`, with warnings for 29FEB, day-of-week
  mismatches, non-chronological segments and arrival-date conflicts.
- Specific, line-numbered warnings. Every non-blank line is returned in a
  segment, a passenger or `unparsedLines` (with a category).
- `detectFormat()`, `toSimpleItinerary()`, `segmentsToCsv()` (formula-injection
  safe), `describeStatus()`.
- `pnr-parser/enrich`: airport names from a bundled OurAirports snapshot (public
  domain) and caller-supplied airline names.
- CLI: `npx pnr-parser` with `--format`, `--reference-date`, `--csv`, `--text`,
  `--enrich`, `--compact`.
- Browser playground (Vite, no backend, CSP without network access) and a
  GitHub Pages deployment workflow.
- 53 synthetic fixtures, unit tests and property-based tests.

[Unreleased]: https://github.com/lalchand07/pnr-parser/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lalchand07/pnr-parser/releases/tag/v0.1.0
