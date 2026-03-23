import { FilingStatus } from '../types/index.js';
import { CAPITAL_GAINS_RATES } from '../constants/tax2025.js';
import { calculateProgressiveTax } from './brackets.js';
import { round2 } from './utils.js';

/**
 * Calculate income tax with preferential rates for qualified dividends and LTCG,
 * including the 25% rate zone for unrecaptured Section 1250 gain.
 *
 * Implements the IRS Schedule D Tax Worksheet logic:
 *   1. Compute "special" tax:
 *      - Progressive rates on ordinary income
 *      - 25% on unrecaptured §1250 gain (stacked on top of ordinary)
 *      - 0%/15%/20% on remaining LTCG + qualified dividends
 *   2. Compute "regular" tax: all progressive rates on taxable income
 *   3. Tax = min(special, regular)
 *
 * This ensures the preferential computation never results in MORE tax than
 * the regular computation (IRC §1(h) is a maximum rate provision).
 *
 * @authority
 *   IRC: Section 1(h) — maximum capital gains rate
 *   IRC: Section 1(h)(1)(E) — 25% rate on unrecaptured Section 1250 gain
 *   Rev. Proc: 2024-40, Section 3.12 — inflation-adjusted rate thresholds
 *   Form: Form 1040, Qualified Dividends and Capital Gain Tax Worksheet
 *   Form: Schedule D Tax Worksheet (when Section 1250 gain present)
 * @scope Preferential rate tax for qualified dividends and LTCG (0%/15%/20%) plus 25% Section 1250 zone
 * @limitations Does not compute 28% rate on collectibles gain
 */
export function calculatePreferentialRateTax(
  taxableIncome: number,
  qualifiedDividends: number,
  longTermCapitalGains: number,
  filingStatus: FilingStatus,
  unrecapturedSection1250Gain: number = 0,
): { ordinaryTax: number; preferentialTax: number; section1250Tax: number; totalTax: number; marginalRate: number } {
  if (taxableIncome <= 0) {
    return { ordinaryTax: 0, preferentialTax: 0, section1250Tax: 0, totalTax: 0, marginalRate: 0 };
  }

  // Cap unrecaptured 1250 gain to actual LTCG (can't exceed the long-term gains)
  // and to taxable income
  const effective1250 = Math.min(
    Math.max(0, unrecapturedSection1250Gain),
    Math.max(0, longTermCapitalGains),
    taxableIncome,
  );

  // Total preferential = QD + LTCG, capped at taxable income
  // (LTCG already includes the 1250 gain — we carve it out below)
  const totalPreferential = Math.min(
    round2(qualifiedDividends + longTermCapitalGains),
    taxableIncome,
  );

  // Regular tax: all at progressive rates (the baseline comparison)
  const regularResult = calculateProgressiveTax(taxableIncome, filingStatus);
  const regularTax = regularResult.tax;

  // If no preferential income, fall back to normal progressive calculation
  if (totalPreferential <= 0) {
    return {
      ordinaryTax: regularTax,
      preferentialTax: 0,
      section1250Tax: 0,
      totalTax: regularTax,
      marginalRate: regularResult.marginalRate,
    };
  }

  // ─── "Special" computation per Schedule D Tax Worksheet ───

  // Ordinary portion = taxable income minus all preferential income
  const ordinaryTaxableIncome = round2(taxableIncome - totalPreferential);

  // Tax on ordinary income at progressive rates
  const ordinaryResult = calculateProgressiveTax(ordinaryTaxableIncome, filingStatus);
  const ordinaryTax = ordinaryResult.tax;

  // ── Section 1250 gain (25% zone) ──────────────────────
  // Stacks on top of ordinary income, before the 0%/15%/20% zones
  // Per Schedule D Tax Worksheet Line 36: flat 25% rate
  const section1250Tax = round2(effective1250 * CAPITAL_GAINS_RATES.RATE_25);

  // ── Remaining preferential income (0%/15%/20% zones) ──
  // The non-1250 preferential income stacks on top of ordinary + 1250
  const remainingPreferential = round2(totalPreferential - effective1250);

  let preferentialTax = 0;

  if (remainingPreferential > 0) {
    const threshold0 = CAPITAL_GAINS_RATES.THRESHOLD_0[filingStatus];
    const threshold15 = CAPITAL_GAINS_RATES.THRESHOLD_15[filingStatus];

    // Remaining preferential starts after ordinary + 1250
    const prefStart = round2(ordinaryTaxableIncome + effective1250);
    const prefEnd = taxableIncome; // = ordinaryTaxableIncome + totalPreferential

    // Portion in 0% zone: from prefStart to min(prefEnd, threshold0)
    const in0Zone = Math.max(0, Math.min(prefEnd, threshold0) - prefStart);
    // Portion in 15% zone: from max(prefStart, threshold0) to min(prefEnd, threshold15)
    const in15Zone = Math.max(0, Math.min(prefEnd, threshold15) - Math.max(prefStart, threshold0));
    // Portion in 20% zone: from max(prefStart, threshold15) to prefEnd
    const in20Zone = Math.max(0, prefEnd - Math.max(prefStart, threshold15));

    preferentialTax = round2(
      in0Zone * CAPITAL_GAINS_RATES.RATE_0 +
      in15Zone * CAPITAL_GAINS_RATES.RATE_15 +
      in20Zone * CAPITAL_GAINS_RATES.RATE_20,
    );
  }

  // Special tax = ordinary + 25% on 1250 + preferential rates on rest
  const specialTax = round2(ordinaryTax + section1250Tax + preferentialTax);

  // IRC §1(h): take the lesser of special vs regular tax
  // This ensures preferential rates never INCREASE total tax
  const totalTax = Math.min(specialTax, regularTax);

  // If regular tax is lower (meaning 25% rate exceeds the ordinary bracket rate),
  // allocate the reduction proportionally
  if (totalTax < specialTax && specialTax > 0) {
    // Regular tax is lower — the 1250 gain would have been cheaper at ordinary rates
    // Allocate: total = regularTax, section1250Tax adjusted down
    const effectiveSection1250Tax = round2(
      Math.max(0, regularTax - ordinaryTax - preferentialTax),
    );
    return {
      ordinaryTax,
      preferentialTax,
      section1250Tax: effectiveSection1250Tax,
      totalTax,
      marginalRate: regularResult.marginalRate,
    };
  }

  return {
    ordinaryTax,
    preferentialTax,
    section1250Tax,
    totalTax,
    marginalRate: regularResult.marginalRate,
  };
}
