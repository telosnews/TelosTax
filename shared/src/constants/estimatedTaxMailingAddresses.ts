/**
 * IRS Mailing Addresses for Form 1040-ES Estimated Tax Payment Vouchers
 *
 * Source: IRS "Correction to the mailing addresses in the 2026 Form 1040-ES"
 * (irs.gov/forms-pubs/correction-to-the-mailing-addresses-in-the-2026-form-1040-es)
 * Published February 25, 2026.
 *
 * IMPORTANT: These addresses differ from Form 1040 filing addresses.
 * 1040-ES vouchers are mailed to different P.O. boxes at different cities.
 *
 * Two processing centers:
 *   - Charlotte, NC 28201-1300 (29 states)
 *   - Louisville, KY 40293-1100 (22 jurisdictions)
 */

import type { IRSMailingAddress } from './irsMailingAddresses.js';

// ── Address constants ────────────────────────────────────────────

const CHARLOTTE_1040ES: readonly string[] = [
  'Internal Revenue Service',
  'P.O. Box 1300',
  'Charlotte, NC 28201-1300',
];

const LOUISVILLE_1040ES: readonly string[] = [
  'Internal Revenue Service',
  'P.O. Box 931100',
  'Louisville, KY 40293-1100',
];

// ── Charlotte group (29 states) ─────────────────────────────────

const CHARLOTTE_STATES = new Set([
  'AL', 'AK', 'AZ', 'CA', 'CO', 'FL', 'GA', 'HI', 'ID', 'KS',
  'LA', 'MI', 'MS', 'MT', 'NE', 'NV', 'NM', 'NC', 'ND', 'OH',
  'OR', 'PA', 'SC', 'SD', 'TN', 'TX', 'UT', 'WA', 'WY',
]);

// Louisville group is everything else: AR, CT, DE, DC, IL, IN, IA, KY,
// ME, MD, MA, MN, MO, NH, NJ, NY, OK, RI, VT, VA, WV, WI

// ── Public API ──────────────────────────────────────────────────

/**
 * Look up the IRS mailing address for Form 1040-ES estimated tax payment
 * vouchers based on the filer's state.
 *
 * Falls back to Louisville for unknown states.
 */
export function get1040ESMailingAddress(state: string): IRSMailingAddress {
  const st = (state || '').toUpperCase().trim();
  return {
    lines: CHARLOTTE_STATES.has(st)
      ? [...CHARLOTTE_1040ES]
      : [...LOUISVILLE_1040ES],
  };
}
