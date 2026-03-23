/**
 * ZIP code / state mismatch validation.
 *
 * Uses USPS ZIP-3 prefix ranges to detect when a user's ZIP code
 * doesn't match their selected state. Returns a warning (not error)
 * since edge cases exist at state borders.
 *
 * Entirely client-side — no network calls. Works offline.
 */

/** [startPrefix, endPrefix, validStateCodes[]] */
const ZIP_STATE_RANGES: [number, number, string[]][] = [
  [5, 5, ['NY']],
  [6, 9, ['PR', 'VI']],
  [10, 27, ['MA']],
  [28, 29, ['RI']],
  [30, 38, ['NH']],
  [39, 49, ['ME']],
  [50, 59, ['VT']],
  [60, 69, ['CT']],
  [70, 89, ['NJ']],
  [90, 99, ['AE']],
  [100, 149, ['NY']],
  [150, 196, ['PA']],
  [197, 199, ['DE']],
  [200, 205, ['DC', 'VA', 'MD']],
  [206, 219, ['MD']],
  [220, 246, ['VA']],
  [247, 268, ['WV']],
  [270, 289, ['NC']],
  [290, 299, ['SC']],
  [300, 319, ['GA']],
  [320, 339, ['FL']],
  [340, 340, ['AA']],
  [341, 349, ['FL']],
  [350, 369, ['AL']],
  [370, 385, ['TN']],
  [386, 397, ['MS']],
  [398, 399, ['GA']],
  [400, 427, ['KY']],
  [430, 458, ['OH']],
  [460, 479, ['IN']],
  [480, 499, ['MI']],
  [500, 528, ['IA']],
  [530, 549, ['WI']],
  [550, 567, ['MN']],
  [570, 577, ['SD']],
  [580, 588, ['ND']],
  [590, 599, ['MT']],
  [600, 629, ['IL']],
  [630, 658, ['MO']],
  [660, 679, ['KS']],
  [680, 693, ['NE']],
  [700, 714, ['LA']],
  [716, 729, ['AR']],
  [730, 749, ['OK']],
  [750, 799, ['TX']],
  [800, 816, ['CO']],
  [820, 831, ['WY']],
  [832, 838, ['ID']],
  [840, 847, ['UT']],
  [850, 865, ['AZ']],
  [870, 884, ['NM']],
  [885, 885, ['TX']],
  [889, 898, ['NV']],
  [900, 961, ['CA']],
  [962, 966, ['AP']],
  [967, 968, ['HI']],
  [969, 969, ['GU', 'AS', 'MP']],
  [970, 979, ['OR']],
  [980, 994, ['WA']],
  [995, 999, ['AK']],
];

/**
 * Look up valid state codes for a 3-digit ZIP prefix.
 * Returns undefined if the prefix isn't in our table (gap or unknown).
 */
function statesForZip3(prefix: number): string[] | undefined {
  for (const [lo, hi, states] of ZIP_STATE_RANGES) {
    if (prefix >= lo && prefix <= hi) return states;
  }
  return undefined;
}

/**
 * Validate that a ZIP code and state are consistent.
 * Returns a warning message if they appear mismatched, undefined if OK.
 */
export function validateZipStateMatch(
  zip: string | undefined,
  state: string | undefined,
): string | undefined {
  if (!zip || !state) return undefined;

  // Extract digits only (handles "94102-1234" → "941021234")
  const digits = zip.replace(/\D/g, '');
  if (digits.length < 3) return undefined;

  const prefix = parseInt(digits.slice(0, 3), 10);
  const validStates = statesForZip3(prefix);

  // If we don't have data for this prefix, don't warn
  if (!validStates) return undefined;

  const upperState = state.toUpperCase();
  if (validStates.includes(upperState)) return undefined;

  const expected = validStates.length === 1
    ? validStates[0]
    : validStates.join(' or ');

  return `ZIP ${digits.slice(0, 3)}xx is typically in ${expected}, not ${upperState}. Please double-check.`;
}
