# Contributing to pnr-parser

Thanks for helping! The most valuable contribution is an **anonymized
real-world sample** that the parser gets wrong, together with what the right
answer should be. Code contributions are welcome too.

## Anonymization checklist

PNR displays are full of personal data. **Never** paste a real, unedited PNR
into an issue, pull request, commit, chat or the playground screenshot you
share. Go through every item below, for every line, before sharing anything:

- [ ] **Names.** Replace every surname and given name, including infants and
      children, names inside SSRs (`SSR DOCS`, `SSR INFT`, `SSR CHLD`), OSIs,
      remarks, `RECEIVED FROM` and e-mail addresses. Use obvious placeholders:
      `SAMPLE`, `DOE`, `ROE`, `EXAMPLE`, `TESTER`, `PLACEHOLDER`, `BLOGGS`,
      `MUSTERMANN`. Keep the _shape_ (number of words, hyphens, titles).
- [ ] **Record locators.** Replace the GDS locator and every airline locator
      (`/DCxx*ABC123`, `BA/ABC123`, `VLOC`, `*VL`) with invented 6-character codes.
- [ ] **Phone numbers.** Replace with fictional ranges, e.g. UK `020 7946 0xxx`,
      US `555-01xx`, or just `0000000`.
- [ ] **E-mail addresses.** Replace with `something@example.com` (reserved for
      examples).
- [ ] **Ticket and EMD numbers.** Replace the 13-digit numbers in `FA`, `FH`,
      `TKT`, `EMD`, `FO` lines with zeros or obviously fake numbers.
- [ ] **Documents.** Replace passport, visa, national ID and redress numbers,
      nationalities if unusual, and dates of birth in `SSR DOCS`/`DOCO`/`DOCA`.
- [ ] **Payment data.** Remove card numbers (even masked ones), expiry dates,
      approval codes and `FP` details.
- [ ] **Addresses.** Replace street addresses (`ADDR-`, `AB`, `AM`, `SSR DOCA`).
- [ ] **Agency and agent identifiers.** Replace office IDs / PCCs / pseudo
      city codes, IATA numbers, agent sines and signatures (`RP/LONXX21AB/…`,
      `A1B2.A1B2*AWS`, `AG 99999992`).
- [ ] **Frequent flyer numbers** (`SSR FQTV`, `*FF`) and corporate IDs.
- [ ] **Free text.** Read every remark (`RM`, `NOTE-`, `REMARKS`) for names,
      phone numbers, hotel bookings or anything else that identifies a person.
- [ ] **Dates.** If the trip itself could identify someone (e.g. a public
      figure's travel), shift all dates by the same number of days (and fix
      weekday tokens accordingly).
- [ ] **Final read-through.** Read the whole sample once more, line by line.

Keep everything else exactly as it was: **spacing, column alignment, line
breaks, symbols (`¥`, `‡`, `#`, `*`), status codes, flight numbers, cities and
times.** Those details are what the parser needs.

## Reporting an unparsed format

Open an issue with the **Unparsed format** template. Include:

1. The anonymized text, in a code block.
2. Which GDS and which display/command produced it (e.g. Sabre `*I`, Amadeus `RT`).
3. What pnr-parser returned, and what it should have returned.
4. Whether any assumption in [docs/FORMAT_NOTES.md](docs/FORMAT_NOTES.md) is
   wrong. Corrections to that file are very welcome.

## Adding a fixture

1. Create `test/fixtures/<galileo|sabre|amadeus|mixed>/NN-short-name.txt`:

   ```text
   # One line saying what this sample covers.
   # referenceDate: 2026-10-15        (optional, default 2026-10-15)
   # format: sabre                    (optional, forces the format)
   # ASSUMPTION A6 A7                 (IDs from docs/FORMAT_NOTES.md, if any)
   ---
   <anonymized PNR text, exactly as displayed>
   ```

2. Add a hand-written expectation for it to `EXPECTED` in
   `test/fixtures.test.ts`. Write what the result **should** be, not whatever
   the parser currently prints.
3. If the sample relies on a new format detail, add it to
   `docs/FORMAT_NOTES.md` with a new ID.
4. Only placeholder surnames are allowed. `test/docs.test.ts` enforces this.

## Development

```sh
npm install
npm test              # unit, fixture and property-based tests
npm run lint          # eslint + prettier --check
npm run format        # prettier --write
npm run typecheck     # library, browser core (no Node types) and playground
npm run build         # ESM + CJS + .d.ts into dist/
npm run playground:dev
```

Guidelines:

- The core (`src/`, except `src/cli.ts`) must not use Node-only APIs or add
  runtime dependencies. `tsconfig.core.json` and eslint enforce this.
- `parsePnr` must never throw. Report problems as warnings with a line number
  and a message a travel agent can understand.
- Every non-blank input line must end up in a segment, a passenger or
  `unparsedLines`. The property tests enforce this.
- Prefer a specific warning over a guess.
- Keep regular expressions linear: no nested quantifiers over overlapping
  input. The property tests include a timing check.
- Small, focused commits and pull requests, please.

## Code of conduct

Be kind, assume good intent, and keep discussions about the code and the data.
