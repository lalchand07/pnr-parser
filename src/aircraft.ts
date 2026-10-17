/**
 * IATA aircraft type designators that may appear as an equipment token on
 * a segment line (e.g. `77W`). Only designators unlikely to be confused with
 * other tokens are listed; see docs/FORMAT_NOTES.md (A9).
 */
// prettier-ignore
export const AIRCRAFT_TYPES: ReadonlySet<string> = new Set([
  // Airbus
  '318', '319', '320', '321', '32A', '32B', '32N', '32Q', '31N', '32S', '221', '223',
  '332', '333', '338', '339', '330', '342', '343', '345', '346', '351', '359', '35K',
  '380', '388', 'AB6', 'BCS', 'BCS1', 'BCS3',
  // Boeing
  '733', '734', '735', '736', '737', '738', '739', '73G', '73H', '73J', '73W', '7M8', '7M9',
  '7M7', '744', '747', '74H', '752', '753', '757', '762', '763', '764', '767', '772', '773',
  '777', '77L', '77W', '778', '779', '787', '788', '789', '78J', '78X',
  // Embraer / Bombardier / ATR / others
  'E70', 'E75', 'E90', 'E95', 'E7W', 'E290', 'E295', 'ER4', 'ERJ', 'CR7', 'CR9', 'CRK', 'CRJ',
  'DH4', 'DH8', 'AT4', 'AT5', 'AT7', 'AT76', 'ATR', 'SU9', 'C919', 'F70',
]);
