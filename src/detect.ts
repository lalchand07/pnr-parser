import { sectionHeading } from './classify.js';
import { LOCATOR_PATTERNS } from './locator.js';
import { parseNameLine } from './names.js';
import type { InputLine } from './normalize.js';
import { splitLines } from './normalize.js';
import { parseSegmentLine } from './segment.js';
import type { FormatDetection, GdsFormat } from './types.js';

export const FORMATS: readonly GdsFormat[] = ['galileo', 'sabre', 'amadeus'];

type Scores = Record<GdsFormat, number>;

/** Evidence needed for full "strength"; below this confidence is scaled down. */
const FULL_STRENGTH = 8;
const DUMMY_REF = { year: 2000, month: 1, day: 1 };

const AMADEUS_ELEMENT = /^\s*\d{1,3}\s+(?:AP|APE|APM|APN|TK|SSR|OSI|RM|RX|RC|RIR|FA|FB|FE|FP|FV|FM|OPW|OPC)\b/;
const AMADEUS_MARKER = /^\s*-{2,}\s*(?:RLR|TST|SFP|ETR|SFT)\b/;
const GALILEO_ELEMENT = /^\s*(?:FONE|TKTG|ADDR|NOTE|GFAX|RMKS|ATFQ|FQ|DLVR|FOP|ADRS|ACT|RCVD)-/;
const GALILEO_BANNER = /^\s*\*\*\s.*\s\*\*\s*$/;
const GALILEO_AGENCY_HEADER = /^\s*[A-Z0-9]{6}\/[A-Z0-9]{2,3}\s+\S+\s+AG\b/;
const SABRE_TAW = /^\s*\d{1,2}\.TAW/;

/** Adds the evidence one line provides to `scores`. */
export function scoreLine(line: InputLine, scores: Scores): void {
  const t = line.text;
  if (t.trim() === '') return;

  if (LOCATOR_PATTERNS.AMADEUS_HEADER.test(t) || /^\s*RP\/[A-Z0-9]+/.test(t)) scores.amadeus += 6;
  if (AMADEUS_MARKER.test(t)) scores.amadeus += 3;
  if (AMADEUS_ELEMENT.test(t)) scores.amadeus += 1.5;

  if (GALILEO_AGENCY_HEADER.test(t)) scores.galileo += 6;
  else if (LOCATOR_PATTERNS.GALILEO_HEADER.test(t)) scores.galileo += 3;
  if (GALILEO_ELEMENT.test(t)) scores.galileo += 1.5;
  if (GALILEO_BANNER.test(t)) scores.galileo += 1;

  if (LOCATOR_PATTERNS.SABRE_HEADER.test(t)) scores.sabre += 6;
  if (sectionHeading(t) || /^\s*RECEIVED FROM\b/.test(t)) scores.sabre += 2;
  if (SABRE_TAW.test(t)) scores.sabre += 1.5;

  const seg = parseSegmentLine(t);
  if (seg) {
    const tr = seg.traits;
    if (seg.dowStyle === 'letter') scores.sabre += 3;
    else if (seg.dowStyle === 'digit') scores.amadeus += 3;
    else scores.galileo += 1.5;
    if (tr.dotAfterNumber) scores.galileo += 2;
    if (tr.twelveHour) scores.sabre += 2;
    if (tr.offsetMarker === '#') scores.galileo += 2;
    if (tr.offsetMarker === '¥' || tr.offsetMarker === '‡') scores.sabre += 2;
    if (tr.arrivalDatePrinted) scores.amadeus += 2;
    if (tr.dcLocator) scores.sabre += 2;
    if (tr.slashLocator) scores.amadeus += 1.5;
    if (tr.flightClassJoined) scores.sabre += 1;
    return;
  }

  const names = parseNameLine(t, true, DUMMY_REF);
  if (names) {
    if (names.style === 'element') scores.amadeus += 1.5;
    else {
      scores.galileo += 0.5;
      scores.sabre += 0.5;
    }
  }
}

export function confidenceFor(format: GdsFormat, scores: Scores): number {
  const total = scores.galileo + scores.sabre + scores.amadeus;
  const own = scores[format];
  if (total <= 0 || own <= 0) return 0;
  const share = own / total;
  const strength = Math.min(1, own / FULL_STRENGTH);
  return Math.round(share * strength * 100) / 100;
}

export function detectFromLines(lines: readonly InputLine[]): FormatDetection {
  const scores: Scores = { galileo: 0, sabre: 0, amadeus: 0 };
  for (const line of lines) scoreLine(line, scores);
  let best: GdsFormat | undefined;
  for (const f of FORMATS) {
    if (scores[f] > 0 && (best === undefined || scores[f] > scores[best])) best = f;
  }
  if (!best) return { format: 'unknown', confidence: 0, scores };
  return { format: best, confidence: confidenceFor(best, scores), scores };
}

/**
 * Detects the GDS format of pasted text without parsing it fully.
 * Never throws.
 */
export function detectFormat(text: string): FormatDetection {
  try {
    return detectFromLines(splitLines(typeof text === 'string' ? text : String(text ?? '')));
  } catch {
    return { format: 'unknown', confidence: 0, scores: { galileo: 0, sabre: 0, amadeus: 0 } };
  }
}
