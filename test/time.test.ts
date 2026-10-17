import { describe, expect, it } from 'vitest';
import { parseGdsTime } from '../src/time.js';

describe('parseGdsTime', () => {
  it.each([
    ['1020', '10:20'],
    ['0655', '06:55'],
    ['655', '06:55'],
    ['0000', '00:00'],
    ['2359', '23:59'],
    ['2400', '00:00'],
    ['1020A', '10:20'],
    ['1200A', '00:00'],
    ['1215A', '00:15'],
    ['700P', '19:00'],
    ['1200P', '12:00'],
    ['1159P', '23:59'],
    ['7P', '19:00'],
    ['1200N', '12:00'],
    ['1200M', '00:00'],
  ])('%s -> %s', (token, expected) => expect(parseGdsTime(token)).toBe(expected));

  it.each([
    '2575',
    '2401',
    '1360',
    '1300P',
    '000A',
    '1230N',
    '1230M',
    '7',
    '12',
    '',
    'ABCD',
    '12345',
  ])('rejects %s', (token) => expect(parseGdsTime(token)).toBeNull());
});
