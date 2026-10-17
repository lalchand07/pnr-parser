import type { SegmentLine } from '../segment.js';
import type { GdsFormat } from '../types.js';

export interface FormatProfile {
  label: string;
  /** Whether Amadeus-style `1.SURNAME/GIVEN` names are expected anywhere. */
  elementStyleNames: boolean;
  /** Returns a description of what does not fit this format, or null. */
  mismatch(seg: SegmentLine): string | null;
}

export const PROFILES: Readonly<Record<GdsFormat, FormatProfile>> = {
  galileo: {
    label: 'Galileo/Travelport',
    elementStyleNames: false,
    mismatch(seg) {
      if (seg.dowStyle !== 'none') return 'a day-of-week token after the date';
      if (seg.traits.twelveHour) return '12-hour (A/P) times';
      return null;
    },
  },
  sabre: {
    label: 'Sabre',
    elementStyleNames: false,
    mismatch(seg) {
      if (seg.dowStyle === 'digit') return 'a numeric day-of-week (Amadeus style)';
      if (seg.traits.arrivalDatePrinted) return 'an arrival date after the arrival time (Amadeus style)';
      return null;
    },
  },
  amadeus: {
    label: 'Amadeus',
    elementStyleNames: true,
    mismatch(seg) {
      if (seg.dowStyle === 'letter') return 'a letter day-of-week (Sabre style)';
      if (seg.traits.twelveHour) return '12-hour (A/P) times';
      if (seg.traits.offsetMarker === '#') return 'a `#` arrival marker (Galileo style)';
      return null;
    },
  },
};
