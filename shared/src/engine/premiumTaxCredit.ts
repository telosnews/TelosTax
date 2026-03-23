import { FilingStatus, PremiumTaxCreditInfo, PremiumTaxCreditResult } from '../types/index.js';
import { PREMIUM_TAX_CREDIT } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Premium Tax Credit (Form 8962).
 *
 * The PTC is a refundable credit to help individuals and families afford
 * health insurance purchased through the Marketplace.
 *
 * For 2025 (with ARP/IRA enhanced subsidies):
 *   - No upper income cliff at 400% FPL
 *   - Applicable percentages range from 0% (≤150% FPL) to 8.5% (≥400% FPL)
 *   - Monthly PTC = lesser of (enrollment premium) or (SLCSP - expected contribution)
 *   - If APTC > PTC, taxpayer must repay excess (capped for <400% FPL)
 *   - If PTC > APTC, taxpayer gets additional refundable credit
 *
 * MFS filers are generally ineligible, except domestic abuse / spousal abandonment.
 *
 * @authority
 *   IRC: Section 36B — refundable credit for coverage under a qualified health plan
 *   ACA: Section 1401 — refundable tax credit providing premium assistance
 *   IRA: Section 12001 — extension of premium tax credit enhancements
 *   Rev. Proc: 2024-35 — applicable percentage table
 *   Rev. Proc: 2024-40, Table 5 — repayment caps
 *   Form: Form 8962
 * @scope Premium Tax Credit with FPL calculation, applicable figures, APTC reconciliation
 * @limitations Assumes annual coverage (no monthly proration for coverage gaps)
 */
export function calculatePremiumTaxCredit(
  info: PremiumTaxCreditInfo,
  householdIncome: number,
  filingStatus: FilingStatus,
): PremiumTaxCreditResult {
  const zero: PremiumTaxCreditResult = {
    annualPTC: 0,
    totalAPTC: 0,
    netPTC: 0,
    excessAPTC: 0,
    repaymentCap: Infinity,
    excessAPTCRepayment: 0,
    householdIncome: 0,
    fplPercentage: 0,
    applicableFigure: 0,
    expectedContribution: 0,
    monthlyDetails: [],
  };

  if (!info || !info.forms1095A || info.forms1095A.length === 0) return zero;

  // MFS ineligibility check (with exceptions)
  if (filingStatus === FilingStatus.MarriedFilingSeparately) {
    if (!info.isVictimOfDomesticAbuse && !info.isSpousalAbandonment) {
      // Ineligible for PTC but still must repay APTC received
      const totalAPTC = sumAPTC(info);
      return {
        ...zero,
        totalAPTC,
        excessAPTC: totalAPTC,
        repaymentCap: Infinity, // No cap when ineligible
        excessAPTCRepayment: totalAPTC,
        householdIncome,
      };
    }
  }

  // ─── Step 1: Calculate FPL percentage ───────────────
  const familySize = Math.max(1, info.familySize || 1);
  const fpl = getFPL(familySize, info.state);
  const fplPercentage = householdIncome > 0 ? round2((householdIncome / fpl) * 100) : 0;

  // Below 100% FPL: generally ineligible (Medicaid eligible)
  // But still must repay APTC received
  if (fplPercentage < PREMIUM_TAX_CREDIT.MIN_FPL_PERCENTAGE) {
    const totalAPTC = sumAPTC(info);
    return {
      ...zero,
      totalAPTC,
      excessAPTC: totalAPTC,
      repaymentCap: Infinity,
      excessAPTCRepayment: totalAPTC,
      householdIncome,
      fplPercentage,
    };
  }

  // ─── Step 2: Calculate applicable figure ────────────
  const applicableFigure = getApplicableFigure(fplPercentage);

  // ─── Step 3: Calculate expected annual contribution ─
  const expectedContribution = round2(householdIncome * applicableFigure);
  const monthlyExpectedContribution = round2(expectedContribution / 12);

  // ─── Step 4: Calculate monthly PTC ──────────────────
  // Aggregate all 1095-A forms
  const monthlyDetails: PremiumTaxCreditResult['monthlyDetails'] = [];
  let annualPTC = 0;
  let totalAPTC = 0;

  // Aggregate monthly data across all 1095-A forms
  const aggregatedMonths = aggregateMonthlyData(info);

  for (let month = 0; month < 12; month++) {
    const monthData = aggregatedMonths[month];
    const hasCoverage = monthData.hasCoverage;
    const enrollmentPremium = monthData.enrollmentPremium;
    const slcspPremium = monthData.slcspPremium;
    const advancePTC = monthData.advancePTC;

    totalAPTC = round2(totalAPTC + advancePTC);

    let monthlyPTC = 0;
    if (hasCoverage && slcspPremium > 0) {
      // PTC = lesser of enrollment premium or (SLCSP - expected contribution)
      const benchmarkBasedPTC = Math.max(0, round2(slcspPremium - monthlyExpectedContribution));
      monthlyPTC = round2(Math.min(enrollmentPremium, benchmarkBasedPTC));
    }

    annualPTC = round2(annualPTC + monthlyPTC);

    monthlyDetails.push({
      month: month + 1,
      enrollmentPremium,
      slcspPremium,
      monthlyPTC,
      advancePTC,
      hasCoverage,
    });
  }

  // ─── Step 5: Reconciliation ─────────────────────────
  let netPTC = 0;
  let excessAPTC = 0;

  if (annualPTC > totalAPTC) {
    // Taxpayer gets additional credit (refundable)
    netPTC = round2(annualPTC - totalAPTC);
  } else if (totalAPTC > annualPTC) {
    // Taxpayer must repay excess
    excessAPTC = round2(totalAPTC - annualPTC);
  }

  // ─── Step 6: Repayment cap ─────────────────────────
  const isSingle = filingStatus === FilingStatus.Single ||
    filingStatus === FilingStatus.MarriedFilingSeparately;
  const repaymentCap = getRepaymentCap(fplPercentage, isSingle);
  const excessAPTCRepayment = round2(Math.min(excessAPTC, repaymentCap));

  return {
    annualPTC,
    totalAPTC,
    netPTC,
    excessAPTC,
    repaymentCap,
    excessAPTCRepayment,
    householdIncome,
    fplPercentage,
    applicableFigure: round2(applicableFigure * 10000) / 10000, // 4 decimal places
    expectedContribution,
    monthlyDetails,
  };
}

/**
 * Calculate Federal Poverty Level for a given family size and state.
 */
function getFPL(familySize: number, state?: string): number {
  const c = PREMIUM_TAX_CREDIT;

  let base: number;
  let increment: number;

  if (state === 'AK') {
    base = c.FPL_BASE_AK;
    increment = c.FPL_INCREMENT_AK;
  } else if (state === 'HI') {
    base = c.FPL_BASE_HI;
    increment = c.FPL_INCREMENT_HI;
  } else {
    base = c.FPL_BASE_48;
    increment = c.FPL_INCREMENT_48;
  }

  return base + increment * Math.max(0, familySize - 1);
}

/**
 * Get the applicable figure (expected contribution percentage) from Table 2.
 * Uses linear interpolation within each bracket.
 */
function getApplicableFigure(fplPercentage: number): number {
  const table = PREMIUM_TAX_CREDIT.APPLICABLE_FIGURE_TABLE;

  for (const bracket of table) {
    if (fplPercentage < bracket.ceiling || bracket.ceiling === Infinity) {
      if (fplPercentage <= bracket.floor) {
        return bracket.initialPct;
      }

      // Linear interpolation within bracket
      const bracketRange = bracket.ceiling === Infinity ? 1 : bracket.ceiling - bracket.floor;
      const position = (fplPercentage - bracket.floor) / bracketRange;
      const pctRange = bracket.finalPct - bracket.initialPct;
      return bracket.initialPct + position * pctRange;
    }
  }

  // Above all brackets: use the max rate
  return 0.085;
}

/**
 * Get the repayment cap for excess APTC based on FPL percentage and filing status.
 */
function getRepaymentCap(fplPercentage: number, isSingle: boolean): number {
  const caps = PREMIUM_TAX_CREDIT.REPAYMENT_CAPS;

  for (const cap of caps) {
    if (fplPercentage < cap.ceiling) {
      return isSingle ? cap.singleCap : cap.otherCap;
    }
  }

  // 400%+ FPL: no cap (full repayment)
  return Infinity;
}

/**
 * Sum total APTC across all 1095-A forms.
 */
function sumAPTC(info: PremiumTaxCreditInfo): number {
  let total = 0;
  for (const form of info.forms1095A) {
    for (let m = 0; m < 12; m++) {
      total += form.advancePTC[m] || 0;
    }
  }
  return round2(total);
}

/**
 * Aggregate monthly data from all 1095-A forms into 12 monthly totals.
 */
function aggregateMonthlyData(info: PremiumTaxCreditInfo): Array<{
  enrollmentPremium: number;
  slcspPremium: number;
  advancePTC: number;
  hasCoverage: boolean;
}> {
  const months = Array.from({ length: 12 }, () => ({
    enrollmentPremium: 0,
    slcspPremium: 0,
    advancePTC: 0,
    hasCoverage: false,
  }));

  for (const form of info.forms1095A) {
    for (let m = 0; m < 12; m++) {
      if (form.coverageMonths[m]) {
        months[m].hasCoverage = true;
        months[m].enrollmentPremium = round2(months[m].enrollmentPremium + (form.enrollmentPremiums[m] || 0));
        // For SLCSP: use the maximum across plans (benchmark is per-family, not additive)
        months[m].slcspPremium = Math.max(months[m].slcspPremium, form.slcspPremiums[m] || 0);
        months[m].advancePTC = round2(months[m].advancePTC + (form.advancePTC[m] || 0));
      }
    }
  }

  return months;
}

/**
 * Calculate household MAGI for PTC purposes.
 * Household income = AGI + excluded foreign income + tax-exempt interest + non-taxable SS
 *
 * @authority
 *   IRC: Section 36B — refundable credit for coverage under a qualified health plan
 *   ACA: Section 1401 — refundable tax credit providing premium assistance
 *   IRA: Section 12001 — extension of premium tax credit enhancements
 *   Rev. Proc: 2024-35 — applicable percentage table
 *   Rev. Proc: 2024-40, Table 5 — repayment caps
 *   Form: Form 8962
 * @scope Premium Tax Credit household income calculation
 * @limitations Assumes annual coverage (no monthly proration for coverage gaps)
 */
export function calculatePTCHouseholdIncome(
  agi: number,
  feieExclusion: number = 0,
  taxExemptInterest: number = 0,
  nonTaxableSocialSecurity: number = 0,
): number {
  return round2(agi + feieExclusion + taxExemptInterest + nonTaxableSocialSecurity);
}
