import type { SegmentLine } from '../segment.js';
import type { GdsFormat } from '../types.js';

export interface FormatProfile {
  label: string;
  /** Returns a description of what does not fit this format, or null. */
  mismatch(seg: SegmentLine): string | null;
}

export const PROFILES: Readonly<Record<GdsFormat, FormatProfile>> = {
  galileo: {
    label: 'Galileo/Travelport',
    mismatch(seg) {
      if (seg.dowStyle !== 'none') return 'a day-of-week token after the date';
      if (seg.traits.twelveHour) return '12-hour (A/P) times';
      return null;
    },
  },
  sabre: {
    label: 'Sabre',
    mismatch(seg) {
      // Arrival dates are not checked: some Sabre displays (*IA) may print them.
      if (seg.dowStyle === 'digit') return 'a numeric day-of-week (Amadeus style)';
      return null;
    },
  },
  amadeus: {
    label: 'Amadeus',
    mismatch(seg) {
      if (seg.dowStyle === 'letter') return 'a letter day-of-week (Sabre style)';
      if (seg.traits.twelveHour) return '12-hour (A/P) times';
      if (seg.traits.offsetMarker === '#') return 'a `#` arrival marker (Galileo style)';
      return null;
    },
  },
};
