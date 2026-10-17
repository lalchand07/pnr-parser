import type { SegmentStatusCategory } from './types.js';

export interface StatusInfo {
  meaning: string;
  category: SegmentStatusCategory;
}

/**
 * Common AIRIMP / GDS segment status (action/advice) codes.
 * Wording is intentionally plain so it can be shown to end customers.
 * See docs/FORMAT_NOTES.md for codes that are deliberately not mapped.
 */
export const SEGMENT_STATUS: Readonly<Record<string, StatusInfo>> = {
  HK: { meaning: 'Confirmed', category: 'confirmed' },
  KK: { meaning: 'Confirmed by airline', category: 'confirmed' },
  KL: { meaning: 'Confirmed from waitlist', category: 'confirmed' },
  TK: { meaning: 'Confirmed after schedule change', category: 'confirmed' },
  RR: { meaning: 'Reconfirmed', category: 'confirmed' },
  SS: { meaning: 'Sold (confirmed)', category: 'confirmed' },
  GK: { meaning: 'Passive segment, confirmed', category: 'confirmed' },
  HL: { meaning: 'Waitlisted', category: 'waitlisted' },
  LL: { meaning: 'Waitlist requested', category: 'waitlisted' },
  TL: { meaning: 'Waitlisted after schedule change', category: 'waitlisted' },
  US: { meaning: 'Unable to confirm, waitlisted', category: 'waitlisted' },
  UU: { meaning: 'Unable to confirm, waitlisted', category: 'waitlisted' },
  GL: { meaning: 'Passive segment, waitlisted', category: 'waitlisted' },
  HN: { meaning: 'Requested, awaiting airline reply', category: 'requested' },
  NN: { meaning: 'Requested', category: 'requested' },
  PN: { meaning: 'Pending airline reply', category: 'requested' },
  TN: { meaning: 'Requested after schedule change, awaiting reply', category: 'requested' },
  GN: { meaning: 'Passive segment, requested', category: 'requested' },
  IN: { meaning: 'Requested if not already held', category: 'requested' },
  UC: { meaning: 'Unable to confirm, not waitlisted', category: 'unconfirmed' },
  NO: { meaning: 'No action taken by airline', category: 'unconfirmed' },
  SC: { meaning: 'Schedule change, action required', category: 'unconfirmed' },
  UN: { meaning: 'Flight not operating / unable', category: 'cancelled' },
  HX: { meaning: 'Cancelled by airline', category: 'cancelled' },
  XX: { meaning: 'Cancelled', category: 'cancelled' },
  XK: { meaning: 'Cancelled by airline, no further action', category: 'cancelled' },
  XL: { meaning: 'Waitlist cancelled', category: 'cancelled' },
  IX: { meaning: 'Cancellation requested', category: 'cancelled' },
  WK: { meaning: 'Was confirmed (superseded by schedule change)', category: 'cancelled' },
  WL: { meaning: 'Was waitlisted (superseded by schedule change)', category: 'cancelled' },
  WN: { meaning: 'Was requested (superseded by schedule change)', category: 'cancelled' },
};

export function describeStatus(code: string): StatusInfo {
  return SEGMENT_STATUS[code] ?? { meaning: `Unknown status code ${code}`, category: 'unknown' };
}

export function isKnownStatus(code: string): boolean {
  return Object.hasOwn(SEGMENT_STATUS, code);
}
