# Data sources and licenses

The core parser (`pnr-parser`) contains no third-party data apart from short
code tables written for this project (segment status codes, IATA aircraft type
designators), which are MIT-licensed with the rest of the code.

## Airports — `pnr-parser/enrich`

- **Source:** [OurAirports](https://ourairports.com/data/) (`airports.csv`,
  `countries.csv`), via the mirror at
  `https://github.com/davidmegginson/ourairports-data`.
- **License:** released by OurAirports to the **Public Domain** ("All data is
  released to the Public Domain").
- **What is bundled:** airports with a 3-letter IATA code that are `large_airport`
  or `medium_airport`, plus `small_airport` entries with scheduled service. For
  each: IATA code, name, municipality, ISO country code; plus country names.
- **Regenerate:** `npm run data:airports` (downloads the latest CSVs) or
  `node scripts/build-airports.mjs airports.csv countries.csv`.

## Airline names — not bundled

No airline-name dataset is bundled. The candidates considered:

| Source                                   | License                             | Status                                                                                                                                                                |
| ---------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenFlights `airlines.dat`               | ODbL 1.0 (share-alike, attribution) | Not used: share-alike obligations would apply to the bundled database.                                                                                                |
| Wikidata (IATA airline designator, P229) | CC0                                 | Clearly licensed, but could not be fetched from the build environment for v0.1; needs de-duplication because IATA codes are reused over time. Tracked on the roadmap. |

Until then, pass your own names: `enrich(result, { airlines: { BA: '…' } })`.
