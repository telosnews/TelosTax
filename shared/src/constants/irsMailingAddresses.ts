/**
 * IRS Mailing Addresses for Paper Form 1040 Filing
 *
 * Source: IRS.gov "Where to File Addresses for Taxpayers and Tax Professionals
 * Filing Form 1040" — addresses valid for calendar year 2025 filings.
 *
 * Three processing centers handle Form 1040 without payment:
 *   - Austin, TX 73301-0002
 *   - Kansas City, MO 64999-0002
 *   - Ogden, UT 84201-0002
 *
 * Two processing centers handle Form 1040 with payment:
 *   - Charlotte, NC 28201-1214
 *   - Louisville, KY 40293-1000
 */

// ── No-Payment address groups ───────────────────────────────────

const AUSTIN_NO_PAYMENT = [
  'Department of the Treasury',
  'Internal Revenue Service',
  'Austin, TX 73301-0002',
];

const KANSAS_CITY_NO_PAYMENT = [
  'Department of the Treasury',
  'Internal Revenue Service',
  'Kansas City, MO 64999-0002',
];

const OGDEN_NO_PAYMENT = [
  'Department of the Treasury',
  'Internal Revenue Service',
  'Ogden, UT 84201-0002',
];

// ── Payment address groups ──────────────────────────────────────

const CHARLOTTE_PAYMENT = [
  'Internal Revenue Service',
  'P.O. Box 1214',
  'Charlotte, NC 28201-1214',
];

const LOUISVILLE_PAYMENT = [
  'Internal Revenue Service',
  'P.O. Box 931000',
  'Louisville, KY 40293-1000',
];

// ── State → No-Payment address ──────────────────────────────────

const NO_PAYMENT_MAP: Record<string, readonly string[]> = {
  // Austin group
  AL: AUSTIN_NO_PAYMENT,
  AZ: AUSTIN_NO_PAYMENT,
  AR: AUSTIN_NO_PAYMENT,
  FL: AUSTIN_NO_PAYMENT,
  GA: AUSTIN_NO_PAYMENT,
  LA: AUSTIN_NO_PAYMENT,
  MS: AUSTIN_NO_PAYMENT,
  NM: AUSTIN_NO_PAYMENT,
  NC: AUSTIN_NO_PAYMENT,
  OK: AUSTIN_NO_PAYMENT,
  SC: AUSTIN_NO_PAYMENT,
  TN: AUSTIN_NO_PAYMENT,
  TX: AUSTIN_NO_PAYMENT,

  // Kansas City group
  CT: KANSAS_CITY_NO_PAYMENT,
  DE: KANSAS_CITY_NO_PAYMENT,
  DC: KANSAS_CITY_NO_PAYMENT,
  IL: KANSAS_CITY_NO_PAYMENT,
  IN: KANSAS_CITY_NO_PAYMENT,
  IA: KANSAS_CITY_NO_PAYMENT,
  KY: KANSAS_CITY_NO_PAYMENT,
  ME: KANSAS_CITY_NO_PAYMENT,
  MD: KANSAS_CITY_NO_PAYMENT,
  MA: KANSAS_CITY_NO_PAYMENT,
  MN: KANSAS_CITY_NO_PAYMENT,
  MO: KANSAS_CITY_NO_PAYMENT,
  NH: KANSAS_CITY_NO_PAYMENT,
  NJ: KANSAS_CITY_NO_PAYMENT,
  NY: KANSAS_CITY_NO_PAYMENT,
  PA: KANSAS_CITY_NO_PAYMENT,
  RI: KANSAS_CITY_NO_PAYMENT,
  VT: KANSAS_CITY_NO_PAYMENT,
  VA: KANSAS_CITY_NO_PAYMENT,
  WV: KANSAS_CITY_NO_PAYMENT,
  WI: KANSAS_CITY_NO_PAYMENT,
  SD: OGDEN_NO_PAYMENT,

  // Ogden group
  AK: OGDEN_NO_PAYMENT,
  CA: OGDEN_NO_PAYMENT,
  CO: OGDEN_NO_PAYMENT,
  HI: OGDEN_NO_PAYMENT,
  ID: OGDEN_NO_PAYMENT,
  KS: OGDEN_NO_PAYMENT,
  MI: OGDEN_NO_PAYMENT,
  MT: OGDEN_NO_PAYMENT,
  NE: OGDEN_NO_PAYMENT,
  NV: OGDEN_NO_PAYMENT,
  ND: OGDEN_NO_PAYMENT,
  OH: OGDEN_NO_PAYMENT,
  OR: OGDEN_NO_PAYMENT,
  UT: OGDEN_NO_PAYMENT,
  WA: OGDEN_NO_PAYMENT,
  WY: OGDEN_NO_PAYMENT,
};

// ── State → Payment address ─────────────────────────────────────
// Charlotte serves the southern Austin-group states;
// Louisville serves everything else.

const CHARLOTTE_STATES = new Set([
  'AL', 'FL', 'GA', 'LA', 'MS', 'NC', 'SC', 'TN', 'TX',
]);

// ── Public API ──────────────────────────────────────────────────

export interface IRSMailingAddress {
  lines: string[];
}

/**
 * Look up the IRS mailing address for a paper Form 1040 based on the
 * filer's state and whether they are enclosing a payment.
 *
 * Falls back to Austin (no payment) / Charlotte (payment) for unknown states.
 */
export function getIRSMailingAddress(
  state: string,
  enclosingPayment: boolean,
): IRSMailingAddress {
  const st = (state || '').toUpperCase().trim();

  if (enclosingPayment) {
    return {
      lines: CHARLOTTE_STATES.has(st)
        ? [...CHARLOTTE_PAYMENT]
        : [...LOUISVILLE_PAYMENT],
    };
  }

  const addr = NO_PAYMENT_MAP[st];
  return {
    lines: addr ? [...addr] : [...AUSTIN_NO_PAYMENT],
  };
}
