export interface InputLine {
  /** 1-based line number in the original input. */
  number: number;
  /** Original text with trailing whitespace removed. */
  original: string;
  /** Uppercased, whitespace-normalized text used for matching. */
  text: string;
}

// Unicode space separators, tabs and other whitespace that terminals or
// e-mail clients put into copied text.
const ODD_SPACES = /[\t\v\f\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
// Zero-width and other invisible characters.
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/g;
// C0/C1 control characters (except tab/newline handled elsewhere).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000E-\u001F\u007F-\u009F]/g;

export function splitLines(input: string): InputLine[] {
  const raw = input.split(/\r\n|\r|\n|\u2028|\u2029/);
  return raw.map((line, index) => ({
    number: index + 1,
    original: line.replace(/\s+$/u, ''),
    text: normalizeLine(line),
  }));
}

export function normalizeLine(line: string): string {
  let text = line.normalize('NFKC');
  text = text.replace(INVISIBLE, '').replace(ODD_SPACES, ' ').replace(CONTROL, '');
  text = text.toUpperCase().trimEnd();
  // Terminal prompt characters copied along with the display.
  text = text.replace(/^\s*>+\s?/, ' ');
  return text;
}
