# Format notes and assumptions

GDS display formats vary by host system, agency profile, terminal emulator and
version, and none of them is fully documented in public. pnr-parser was built
from general knowledge of these displays and **entirely synthetic** samples.
Wherever a detail was uncertain, it is written down here as an assumption
with an ID. Fixtures that depend on an assumption say so in their front
matter (`# ASSUMPTION A6`), and a test checks that every ID used in a fixture
is listed below.

**If you work with real displays and something here is wrong, please open an
"Unparsed format" issue with an anonymized sample** (see
[CONTRIBUTING.md](../CONTRIBUTING.md)). Corrections from real-world users are
the most valuable contribution this project can get.

Status legend: **confident** (widely seen), **likely** (seen, but variants
probably exist), **unverified** (best guess).

## Galileo / Travelport (`*I`, `*R`)

| ID  | Assumption                                                                                                                                                                                                                       | Status                      | What the parser does                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Segment lines print a dot after the segment number (` 1. BA  117 Y  15DEC LHRJFK HK1 …`) and **no** day-of-week token between the date and the city pair. A two-letter day name (`MO`…`SU`) may appear near the end of the line. | likely                      | The dot and the absence of a DOW token count as Galileo evidence. Trailing day names are ignored and **not** validated against the inferred date. |
| A2  | `#` right after the arrival time means arrival the next day. `#2` / `+2` mean two days later.                                                                                                                                    | `#` likely, `#2` unverified | `#` → offset 1, `#n` and `+n` → offset n.                                                                                                         |
| A3  | The `*R` header line starts with the record locator followed by `/` and agent/PCC data: `ZQGAL1/WS LHRGB AG 99999992 12OCT`.                                                                                                     | likely                      | The first 6 characters become `recordLocator`; the line is kept in `unparsedLines` as `header`.                                                   |
| A18 | Non-air fields use `NAME-` prefixes: `FONE-`, `TKTG-`, `ADDR-`, `NOTE-`, `GFAX-` (SSR/OSI), `ATFQ-`, `FOP-`. `** … **` lines are banners.                                                                                        | likely                      | Used for detection and for `unparsedLines` categories.                                                                                            |

## Sabre (`*I`, `*IA`, `*A`)

| ID  | Assumption                                                                                                                                                                                                          | Status                                      | What the parser does                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A6  | A single-letter day of week follows the date: `M T W Q F J S` = Monday … Sunday.                                                                                                                                    | likely                                      | Validated against the inferred date (`DAY_OF_WEEK_MISMATCH`).                                                                                          |
| A7  | Times are 12-hour with a suffix: `1020A`, `700P`, `1200N` (noon). `1200M` is read as midnight.                                                                                                                      | `A/P` confident, `N` likely, `M` unverified | Converted to 24-hour `HH:MM`.                                                                                                                          |
| A8  | The day-change marker is `¥1` (yen sign). Some emulators render it as `‡1`; `+1` is also accepted.                                                                                                                  | `¥` likely, `‡` unverified                  | Read as the arrival day offset.                                                                                                                        |
| A10 | The record locator appears on the creation/received line at the bottom of `*A`: `A1B2.A1B2*AWS 0915/12OCT26 ZQSABR H`.                                                                                              | likely                                      | The 6-letter token after the date becomes `recordLocator`.                                                                                             |
| A16 | Segment lines may end with `/DCxx*LOCATOR` (airline locator) and `/E` (e-ticket).                                                                                                                                   | likely                                      | `/DCxx*ABC123` → `airlineLocator`. `/E` is ignored.                                                                                                    |
| A17 | `*A` displays group other data under headings: `TKT/TIME LIMIT`, `PHONES`, `PASSENGER EMAIL DATA`, `GENERAL FACTS`, `REMARKS`, `PRICE QUOTE RECORD`, `RECEIVED FROM`. Entries below a heading are numbered `  1.…`. | likely                                      | Numbered lines under a heading take its category. Name parsing is disabled inside a section, so remarks like `1.CALL/BACK` are not read as passengers. |
| A19 | Some agency profiles show 24-hour times (`0720`) instead of 12-hour.                                                                                                                                                | unverified                                  | Both styles are accepted on any format.                                                                                                                |

## Amadeus (`RT`)

| ID  | Assumption                                                                                                                                            | Status    | What the parser does                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| A11 | A digit day of week (1 = Monday … 7 = Sunday) follows the date: `BA 117 Y 15DEC 2 LHRJFK`.                                                            | likely    | Validated against the inferred date.                                                                                                    |
| A12 | The arrival date is printed after the arrival time (`1315   15DEC`); a day change is printed as `+1` / `-1` attached to the arrival time.             | likely    | An explicit offset wins; otherwise the offset is computed from the printed arrival date. A disagreement raises `ARRIVAL_DATE_CONFLICT`. |
| A13 | An infant is attached to an adult name: `(INFLILY/02MAY26)` (same surname) or `(INFROE/BABY/01SEP26)` (different surname). Children: `(CHD/05JAN18)`. | likely    | Infants become separate passengers with id `<adult>.INF` and `associatedPassengerId`.                                                   |
| A14 | Names, segments and other elements share one numbering sequence (names 1–2, segments 3–4, AP 5 …).                                                    | confident | `segmentNumber` is the element number as printed, so Amadeus segment numbers often do not start at 1.                                   |
| A16 | Segment lines may end with `XX/LOCATOR` (airline locator).                                                                                            | likely    | → `airlineLocator`.                                                                                                                     |

## All formats

| ID  | Assumption                                                                                                                                                                                                                                     | Status                               | What the parser does                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A4  | Galileo/Sabre infants use an `I/` prefix: `4.I/1TESTER/ZAINAB*12MAR26`, with the date of birth after `*`.                                                                                                                                      | likely (Sabre), unverified (Galileo) | Type `INF`, `dateOfBirth` set. Which adult the infant travels with is not known from the name line.                                                                              |
| A5  | Galileo/Sabre children carry `*C08` (age 8), `*CNN` or `*CHD` after the given name.                                                                                                                                                            | likely (Sabre), unverified (Galileo) | Type `CHD`, `age` from `Cnn`.                                                                                                                                                    |
| A9  | Equipment is not part of the default `*I`/`RT` displays. When a line does show it (bare `77W`, or `EQP:789`), it is recognised only from a curated list of IATA aircraft type codes, to avoid mistaking other 3-character tokens for aircraft. | unverified                           | Unknown aircraft codes are left in `raw`.                                                                                                                                        |
| A15 | Codeshares are shown as an `OPERATED BY …` line directly after the segment.                                                                                                                                                                    | likely                               | Attached to the previous segment as `operatingCarrier` (`{ code }` for a 2-character code, else `{ name }`).                                                                     |
| A20 | Titles are sometimes typed without a space: `SAMPLE/JOHNMR`.                                                                                                                                                                                   | likely                               | `MR`, `MRS`, `MSTR` and `MISS` are split off a glued given name. `MS` and `DR` are **not**, because many given names end in those letters.                                       |
| A21 | One Galileo/Sabre name item can hold several passengers who share a surname: `2.2QAPASS/FATIMA MRS/ALI MSTR`.                                                                                                                                  | confident                            | Passengers get ids `2.1`, `2.2`. A count that does not match the names raises `NAME_UNPARSED`.                                                                                   |
| A22 | Status code meanings (see table below).                                                                                                                                                                                                        | mostly confident                     | Unknown codes keep their value with category `unknown` and raise `UNKNOWN_STATUS`.                                                                                               |
| A23 | E-mail clients and narrow terminals wrap long segment lines.                                                                                                                                                                                   | —                                    | A segment line that is incomplete is joined with the next line only if that line looks like the missing remainder (`WRAPPED_LINE_JOINED`). Wrapped name lines are not re-joined. |

## Status codes (A22)

| Code       | Meaning                                                                | Category    |
| ---------- | ---------------------------------------------------------------------- | ----------- |
| HK         | Confirmed                                                              | confirmed   |
| KK         | Confirmed by airline                                                   | confirmed   |
| KL         | Confirmed from waitlist                                                | confirmed   |
| TK         | Confirmed after schedule change                                        | confirmed   |
| RR         | Reconfirmed                                                            | confirmed   |
| SS         | Sold (confirmed)                                                       | confirmed   |
| GK         | Passive segment, confirmed                                             | confirmed   |
| HL         | Waitlisted                                                             | waitlisted  |
| LL         | Waitlist requested                                                     | waitlisted  |
| TL         | Waitlisted after schedule change                                       | waitlisted  |
| US, UU     | Unable to confirm, waitlisted                                          | waitlisted  |
| GL         | Passive segment, waitlisted                                            | waitlisted  |
| HN         | Requested, awaiting airline reply                                      | requested   |
| NN         | Requested                                                              | requested   |
| PN         | Pending airline reply                                                  | requested   |
| TN         | Requested after schedule change                                        | requested   |
| GN         | Passive segment, requested                                             | requested   |
| IN         | Requested if not already held                                          | requested   |
| UC         | Unable to confirm, not waitlisted                                      | unconfirmed |
| NO         | No action taken by airline                                             | unconfirmed |
| SC         | Schedule change, action required                                       | unconfirmed |
| UN         | Flight not operating / unable                                          | cancelled   |
| HX         | Cancelled by airline                                                   | cancelled   |
| XX         | Cancelled                                                              | cancelled   |
| XK         | Cancelled by airline, no further action                                | cancelled   |
| XL         | Waitlist cancelled                                                     | cancelled   |
| IX         | Cancellation requested                                                 | cancelled   |
| WK, WL, WN | Was confirmed / waitlisted / requested (superseded by schedule change) | cancelled   |

Deliberately **not** mapped because their meaning differs between systems:
`DK`, `PK`, `PB`, `MM`, `HQ`. They come back with category `unknown`.

## Known gaps (v0.1)

- Ticket (`FA`/`TKT`) and EMD lines are classified but not parsed into fields.
- Hotel, car, rail and other non-air segments are classified as
  `non-air-segment` but not parsed.
- `ARNK` and `OPEN` segments are reported in `unparsedLines`, not as segments.
- Worldspan and other GDS displays are not supported.
- Year inference ignores the issue/creation date printed in headers.
