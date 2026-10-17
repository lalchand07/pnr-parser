import type { UnparsedCategory } from './types.js';

/** Sabre-style section headings and the category of the lines below them. */
const SECTION_HEADINGS: readonly [RegExp, UnparsedCategory][] = [
  [/^PHONES?$/, 'contact'],
  [/^PASSENGER EMAIL DATA$/, 'contact'],
  [/^TKT\/TIME LIMIT$/, 'ticketing'],
  [/^(?:GENERAL|AA|[A-Z0-9]{2}) FACTS$/, 'ssr'],
  [/^SECURITY INFO$/, 'ssr'],
  [/^REMARKS$/, 'remark'],
  [/^PRICE QUOTE RECORD.*$/, 'fare'],
  [/^FORM OF PAYMENT$/, 'fare'],
];

export function sectionHeading(text: string): UnparsedCategory | null {
  const t = text.trim();
  for (const [re, category] of SECTION_HEADINGS) if (re.test(t)) return category;
  return null;
}

// Ordered: first match wins. Patterns run on the line with any leading
// element number (`5 `, `5.`) removed.
const RULES: readonly [RegExp, UnparsedCategory][] = [
  [/^(?:RP\/|-{2,}|RLR\b|\*\*|RECEIVED FROM\b|RECORD LOCATOR\b|PNR\b)/, 'header'],
  [/^(?:\*[A-Z]{1,3}|RT[A-Z]*|\*I[A-Z]?|\*R)$/, 'header'],
  [/^ARNK\b|\sARNK\b/, 'arnk'],
  [/^(?:HHL|HTL|HHPR|CCR|CAR|MIS|TUR|OTH|SUR|RAIL|TRN|OPEN|ATX|INS)\b/, 'non-air-segment'],
  [/^(?:SSR|GFAX-?SSR|\*?SSR)\b|^GFAX-/, 'ssr'],
  [/^(?:OSI|GFAX-?OSI)\b/, 'osi'],
  [
    /^(?:TK|TKT|TKTG|TKTD|TKTL|TAW|ATKT|FA|FB|FH|TICKET(?:ING)?|TKT\/TIME LIMIT)\b|^T-|^TKTG-|^TL\s/,
    'ticketing',
  ],
  [
    /^(?:FE|FP|FV|FM|FT|FZ|FQ|FS|FN|FO|FG|FQV|ATFQ|FARE|TST|PQ|FOP|PRICE QUOTE|FCMI)\b|^ATFQ-|^FOP-|^FQ-/,
    'fare',
  ],
  [
    /^(?:AP|APE|APM|APN|APB|APH|APT|APA|FONE|PHONE|PHONES|EMAIL|E-MAIL|CTCE|CTCM|CTCP|ADDR|ADRS|AB|AM)\b|^FONE-|^ADDR-|^P\d*\.|^[A-Z]{3}\s?\d{2,}[\d -]*-?[A-Z]?$/,
    'contact',
  ],
  [/^(?:RM|RX|RC|RI|RIR|RII|RIF|RQ|NOTE|NOTES|RMK|RMKS|REMARKS?|NP|\*?SI)\b|^NOTE-|^RMKS?-/, 'remark'],
];

export function classifyLine(text: string, section: UnparsedCategory | null): UnparsedCategory {
  const t = text.trim();
  const stripped = t.replace(/^\d{1,3}\s*\.?\s*(?=[A-Z*/-])/, '');
  for (const [re, category] of RULES) {
    if (re.test(stripped) || re.test(t)) return category;
  }
  // Inside a Sabre section, numbered entries (`  1.…`) belong to it.
  if (section && /^\d{1,3}\./.test(t)) return section;
  return 'unknown';
}
