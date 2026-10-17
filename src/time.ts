/**
 * Parses GDS times into `HH:MM`.
 *
 * - 24-hour: `1020`, `0655`, `655` (3 digits = H:MM)
 * - 12-hour (Sabre): `1020A`, `700P`, `1200N` (noon), `1200M` (midnight).
 *   A bare hour with suffix (`7P`) is accepted too.
 *
 * Returns null when the value is not a real time of day.
 */
export function parseGdsTime(token: string): string | null {
  const m = /^(\d{1,4})([APNM])?$/.exec(token);
  if (!m) return null;
  const digits = m[1]!;
  const suffix = m[2];
  let hours: number;
  let minutes: number;
  if (digits.length <= 2) {
    // Only meaningful with a 12-hour suffix: `7P`.
    if (!suffix) return null;
    hours = Number(digits);
    minutes = 0;
  } else {
    hours = Number(digits.slice(0, -2));
    minutes = Number(digits.slice(-2));
  }
  if (minutes > 59) return null;

  if (suffix) {
    if (hours < 1 || hours > 12) return null;
    switch (suffix) {
      case 'A':
        if (hours === 12) hours = 0;
        break;
      case 'P':
        if (hours !== 12) hours += 12;
        break;
      case 'N':
        // Noon: only 12:00 makes sense.
        if (hours !== 12 || minutes !== 0) return null;
        break;
      case 'M':
        // Midnight.
        if (hours !== 12 || minutes !== 0) return null;
        hours = 0;
        break;
    }
  } else if (hours > 23) {
    // `2400` is sometimes printed for midnight.
    if (hours === 24 && minutes === 0) hours = 0;
    else return null;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** True when the token uses a 12-hour suffix (a Sabre trait). */
export function isTwelveHourToken(token: string): boolean {
  return /^\d{1,4}[APNM]$/.test(token);
}
