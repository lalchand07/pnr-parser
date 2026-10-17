import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { enrich } from './enrich/index.js';
import { parsePnr, segmentsToCsv, toSimpleItinerary } from './index.js';
import type { GdsFormat, ParseOptions } from './types.js';

const HELP = `Usage: pnr-parser [options] [file]

Parses GDS itinerary text (Galileo/Travelport, Sabre, Amadeus) from a file
or standard input and prints JSON.

Options:
  -f, --format <name>          auto (default), galileo, sabre or amadeus
  -r, --reference-date <date>  YYYY-MM-DD used to infer years (default: today)
      --csv                    print segments as CSV instead of JSON
      --text                   print a plain-text itinerary table
      --enrich                 add airport names (bundled OurAirports data)
      --compact                print JSON on one line
  -h, --help                   show this help
  -v, --version                show the version

Examples:
  npx pnr-parser < itinerary.txt
  npx pnr-parser --reference-date 2026-10-15 --csv itinerary.txt > segments.csv
  pbpaste | npx pnr-parser --text

Warnings are written to stderr in --csv and --text modes. Nothing is sent
over the network; parsing happens locally.
`;

const FORMATS = ['auto', 'galileo', 'sabre', 'amadeus'];

function version(): string {
  try {
    const require = createRequire(import.meta.url);
    return (require('../package.json') as { version: string }).version;
  } catch {
    return 'unknown';
  }
}

function fail(message: string): never {
  process.stderr.write(`pnr-parser: ${message}\nRun "pnr-parser --help" for usage.\n`);
  process.exit(1);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        format: { type: 'string', short: 'f' },
        'reference-date': { type: 'string', short: 'r' },
        csv: { type: 'boolean' },
        text: { type: 'boolean' },
        enrich: { type: 'boolean' },
        compact: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (error) {
    fail((error as Error).message);
  }
  const { values, positionals } = parsed;

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }
  if (values.version) {
    process.stdout.write(`${version()}\n`);
    return;
  }
  if (positionals.length > 1) fail('expected at most one input file');
  if (values.csv && values.text) fail('--csv and --text cannot be combined');

  const options: ParseOptions = {};
  if (values.format !== undefined) {
    if (!FORMATS.includes(values.format)) {
      fail(`unknown format "${values.format}" (expected ${FORMATS.join(', ')})`);
    }
    options.format = values.format as GdsFormat | 'auto';
  }
  if (values['reference-date'] !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values['reference-date'])) {
      fail(`--reference-date must be YYYY-MM-DD, got "${values['reference-date']}"`);
    }
    options.referenceDate = values['reference-date'];
  }

  let input: string;
  const file = positionals[0];
  if (file !== undefined && file !== '-') {
    try {
      input = readFileSync(file, 'utf8');
    } catch (error) {
      fail(`cannot read ${file}: ${(error as Error).message}`);
    }
  } else {
    if (process.stdin.isTTY && file === undefined) {
      process.stdout.write(HELP);
      process.exitCode = 1;
      return;
    }
    input = await readStdin();
  }

  const result = parsePnr(input, options);
  const output = values.enrich ? enrich(result) : result;

  if (values.csv || values.text) {
    for (const w of result.warnings) process.stderr.write(`warning: ${w.message}\n`);
    process.stdout.write(
      values.csv ? segmentsToCsv(result) : `${toSimpleItinerary(result).text}\n`,
    );
    return;
  }
  process.stdout.write(`${JSON.stringify(output, null, values.compact ? undefined : 2)}\n`);
}

main().catch((error: unknown) => fail((error as Error).message ?? String(error)));
