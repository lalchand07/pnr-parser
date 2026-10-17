export interface LocatorMatch {
  locator: string;
  /** `header` = a GDS header line, `label` = "RECORD LOCATOR: …", `bare` = a lone code. */
  source: 'header' | 'label' | 'bare';
}

// Amadeus: `RP/LONBA2100/LONBA2100   AA/SU  15OCT26/1012Z   ABC123`
const AMADEUS_HEADER = /^\s*RP\/[A-Z0-9]+(?:\/[A-Z0-9]+)?\b.*\s([A-Z0-9]{6})\s*$/;
// Galileo/Travelport: `QXZ7KD/WS LHRGB AG 99999992 15OCT`
const GALILEO_HEADER = /^\s*([A-Z0-9]{6})\/[A-Z0-9]{2,3}(?:\s|$)/;
// Sabre received / creation line: `A1B2.A1B2*AWS 1234/15OCT26 ABCDEF H`
const SABRE_HEADER = /^\s*[A-Z0-9]{4}\.[A-Z0-9]{4}\*A[A-Z0-9]{2}\s+\d{3,4}\/\d{1,2}[A-Z]{3}\d{2}\s+([A-Z]{6})\b/;
const LABELLED =
  /\b(?:RECORD\s+LOCATOR|REC\s*LOC|RLOC|PNR(?:\s+(?:LOCATOR|REF(?:ERENCE)?|NO))?|BOOKING\s+(?:REF(?:ERENCE)?|CODE)|CONFIRMATION\s+(?:NO|NUMBER|CODE))\s*[:#.=-]?\s*([A-Z0-9]{6})\b/;
const BARE = /^\s*([A-Z0-9]{6})\s*$/;

function plausible(code: string): boolean {
  // Must contain a letter; all-digit tokens are times, dates or ticket numbers.
  return /[A-Z]/.test(code);
}

/**
 * Looks for a record locator on one normalized line.
 * `nonBlankIndex` is the 0-based position among non-blank lines; bare codes
 * are only accepted near the top of the paste.
 */
export function findLocator(text: string, nonBlankIndex: number): LocatorMatch | null {
  for (const re of [AMADEUS_HEADER, SABRE_HEADER, GALILEO_HEADER]) {
    const m = re.exec(text);
    if (m && plausible(m[1]!)) return { locator: m[1]!, source: 'header' };
  }
  const l = LABELLED.exec(text);
  if (l && plausible(l[1]!)) return { locator: l[1]!, source: 'label' };
  if (nonBlankIndex < 2) {
    const b = BARE.exec(text);
    // A lone code needs both letters and digits so words like PHONES don't match.
    if (b && /[A-Z]/.test(b[1]!) && /\d/.test(b[1]!)) return { locator: b[1]!, source: 'bare' };
  }
  return null;
}

export const LOCATOR_PATTERNS = { AMADEUS_HEADER, GALILEO_HEADER, SABRE_HEADER } as const;
