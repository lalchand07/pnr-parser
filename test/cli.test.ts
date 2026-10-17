import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { FIXTURE_DIR } from './helpers.js';

const ROOT = join(FIXTURE_DIR, '..', '..');
const CLI = join(ROOT, 'dist', 'cli.js');

const SABRE = ' 1.1SAMPLE/JOHN MR\n 1 BA 117Y 15DEC T LHRJFK HK1  1020A  115P /DCBA*YT4KQ9 /E\n';

function cli(args: string[], input?: string) {
  const r = spawnSync(process.execPath, [CLI, ...args], { input: input ?? '', encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('cli', () => {
  beforeAll(() => {
    if (!existsSync(CLI)) execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'ignore' });
  }, 60_000);

  it('prints JSON for stdin input', () => {
    const r = cli(['--reference-date', '2026-10-15'], SABRE);
    expect(r.code).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.format).toBe('sabre');
    expect(json.segments[0].departureDate).toBe('2026-12-15');
    expect(json.passengers[0].surname).toBe('SAMPLE');
  });

  it('reads a file argument and honours --format', () => {
    const r = cli([
      '-f',
      'galileo',
      '-r',
      '2026-10-15',
      join(FIXTURE_DIR, 'sabre/01-oneway-single.txt'),
    ]);
    expect(r.code).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.format).toBe('galileo');
    expect(json.formatForced).toBe(true);
  });

  it('prints CSV with --csv and warnings on stderr', () => {
    const r = cli(
      ['--csv', '-r', '2026-10-15'],
      `${SABRE} 2 BA 112Y 22DEC T JFKLHR ZZ1  700P  655A\n`,
    );
    expect(r.code).toBe(0);
    const rows = r.stdout.trimEnd().split('\r\n');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatch(/^,1,BA,117,Y,2026-12-15,10:20,LHR,JFK,/);
    expect(r.stderr).toMatch(/warning: Line 3: unknown segment status code "ZZ"/);
  });

  it('prints a table with --text and adds airports with --enrich', () => {
    expect(cli(['--text', '-r', '2026-10-15'], SABRE).stdout).toMatch(/BA 117 {2}2026-12-15/);
    const json = JSON.parse(cli(['--enrich', '--compact', '-r', '2026-10-15'], SABRE).stdout);
    expect(json.segments[0].originAirport.iata).toBe('LHR');
  });

  it('rejects bad arguments with exit code 1', () => {
    expect(cli(['--format', 'worldspan']).code).toBe(1);
    expect(cli(['--reference-date', '15/10/2026']).code).toBe(1);
    expect(cli(['--csv', '--text']).code).toBe(1);
    expect(cli(['--bogus']).code).toBe(1);
    expect(cli(['does-not-exist.txt']).code).toBe(1);
  });

  it('prints help and version', () => {
    expect(cli(['--help']).stdout).toMatch(/Usage: pnr-parser/);
    expect(cli(['--version']).stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('handles empty input', () => {
    const r = cli([], '');
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).warnings[0].code).toBe('EMPTY_INPUT');
  });
});
