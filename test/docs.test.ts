import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePnr, SEGMENT_STATUS } from '../src/index.js';
import { FIXTURE_DIR, loadFixtures } from './helpers.js';

const notes = readFileSync(join(FIXTURE_DIR, '..', '..', 'docs', 'FORMAT_NOTES.md'), 'utf8');

describe('docs/FORMAT_NOTES.md', () => {
  it('documents every assumption referenced by a fixture', () => {
    const ids = new Set(loadFixtures().flatMap((f) => f.assumptions));
    expect(ids.size).toBeGreaterThan(10);
    for (const id of ids) expect(notes, `missing ${id}`).toMatch(new RegExp(`\\|\\s*${id}\\s*\\|`));
  });

  it('lists every status code the parser knows', () => {
    for (const code of Object.keys(SEGMENT_STATUS)) {
      expect(notes, `missing ${code}`).toMatch(new RegExp(`\\b${code}\\b`));
    }
  });
});

describe('fixtures are synthetic', () => {
  // Guards against real passenger data slipping into the fixture set.
  it('use only placeholder surnames', () => {
    const allowed = new Set([
      'SAMPLE',
      'DOE',
      'EXAMPLE',
      'ROE',
      'PLACEHOLDER',
      'FICTIVE',
      'NOBODY',
      'TESTCASE',
      'MOCK',
      'DUMMY',
      'BLOGGS',
      'MUSTERMANN',
      'TESTER',
      'QAPASS',
      'VAN DER TEST',
      'O NEILL',
    ]);
    for (const f of loadFixtures()) {
      for (const p of parsePnr(f.text, { referenceDate: f.referenceDate }).passengers) {
        expect(allowed, `${f.name}: ${p.surname}`).toContain(p.surname);
      }
    }
  });
});
