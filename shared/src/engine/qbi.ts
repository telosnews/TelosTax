import { FilingStatus, QBIBusinessEntry } from '../types/index.js';
import { QBI } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Qualified Business Income (QBI) deduction.
 *
 * Below threshold: deduction = lesser of 20% QBI or 20% (taxable income − net capital gain).
 *
 * Above threshold (within phase-in range):
 *   - SSTB: deduction phases down linearly to $0.
 *   - Non-SSTB: deduction phases from tentative amount toward the W-2/UBIA limit.
 *
 * Above threshold + phase-in range:
 *   - SSTB: $0 (fully phased out).
 *   - Non-SSTB: lesser of 20% QBI or greater of (50% W-2 wages) or (25% W-2 wages + 2.5% UBIA).
 *
 * The W-2/UBIA alternative ensures non-SSTB businesses with significant payroll
 * or capital still receive a deduction even at high income levels.
 *
 * @authority
 *   IRC: Section 199A(a)(2) — QBI deduction limited to 20% of (taxable income − net capital gain)
 *   IRC: Section 1(h) — net capital gain = max(0, net LTCG) + qualified dividends
 *   Rev. Proc: 2024-40, Section 3.29 — QBI threshold amounts
 *   Form: Form 8995 / Form 8995-A
 * @scope 20% QBI deduction for pass-through income
 * @limitations Simplified (no per-business SSTB/W-2/UBIA phase-in computation)
 */
export function calculateQBIDeduction(
  qualifiedBusinessIncome: number,
  taxableIncomeBeforeQBI: number,
  filingStatus: FilingStatus,
  isSSTB: boolean = true,
  w2WagesPaid: number = 0,
  ubiaOfQualifiedProperty: number = 0,
  netCapitalGain: number = 0,
): number {
  if (qualifiedBusinessIncome <= 0) return 0;

  const threshold = getQBIThreshold(filingStatus);
  const phaseInRange = getQBIPhaseInRange(filingStatus);

  // IRC §199A(a)(2): QBI deduction is lesser of 20% of QBI or 20% of (taxable income − net capital gain)
  // Net capital gain per §1(h) = max(0, net LTCG) + qualified dividends
  // Note: threshold/phase-in uses full taxableIncomeBeforeQBI (not reduced by net capital gain)
  const tentativeQBI = round2(qualifiedBusinessIncome * QBI.RATE);
  const taxableIncomeForLimit = Math.max(0, taxableIncomeBeforeQBI - netCapitalGain);
  const taxableIncomeLimit = round2(taxableIncomeForLimit * QBI.RATE);
  const fullDeduction = Math.min(tentativeQBI, taxableIncomeLimit);

  // Below threshold — full deduction, no limitation
  if (taxableIncomeBeforeQBI <= threshold) {
    return Math.max(0, fullDeduction);
  }

  const excessOverThreshold = taxableIncomeBeforeQBI - threshold;

  // W-2 wages / UBIA limitation (only applies to non-SSTB, or during phase-in for all)
  // Greater of: (a) 50% of W-2 wages, or (b) 25% of W-2 wages + 2.5% of UBIA
  const wageLimit = round2(Math.max(
    w2WagesPaid * 0.50,
    w2WagesPaid * 0.25 + ubiaOfQualifiedProperty * 0.025,
  ));

  if (excessOverThreshold >= phaseInRange) {
    // Fully above phase-in range
    if (isSSTB) {
      // SSTB: fully phased out
      return 0;
    }
    // Non-SSTB: lesser of 20% QBI or W-2/UBIA limit, capped by taxable income limit
    const deduction = Math.min(tentativeQBI, wageLimit);
    return Math.max(0, round2(Math.min(deduction, taxableIncomeLimit)));
  }

  // Within phase-in range — partial phase
  const phaseInFraction = excessOverThreshold / phaseInRange;

  if (isSSTB) {
    // SSTB: reduce QBI, wages, and UBIA proportionally, then apply limits
    const reducedQBI = round2(qualifiedBusinessIncome * (1 - phaseInFraction));
    const reducedTentative = round2(reducedQBI * QBI.RATE);
    const reducedWages = round2(w2WagesPaid * (1 - phaseInFraction));
    const reducedUBIA = round2(ubiaOfQualifiedProperty * (1 - phaseInFraction));
    const reducedWageLimit = round2(Math.max(
      reducedWages * 0.50,
      reducedWages * 0.25 + reducedUBIA * 0.025,
    ));
    // Excess amount = tentative - wage limit (if positive, this is reduced by phase-in fraction)
    const excessAmount = Math.max(0, reducedTentative - reducedWageLimit);
    const phaseInReduction = round2(excessAmount * phaseInFraction);
    const deduction = round2(reducedTentative - phaseInReduction);
    return Math.max(0, round2(Math.min(deduction, taxableIncomeLimit)));
  } else {
    // Non-SSTB: phase between full deduction and W-2/UBIA-limited deduction
    // The "excess" above the wage limit is reduced by the phase-in fraction
    const excessAmount = Math.max(0, fullDeduction - wageLimit);
    const phaseInReduction = round2(excessAmount * phaseInFraction);
    const deduction = round2(fullDeduction - phaseInReduction);
    return Math.max(0, round2(Math.min(deduction, taxableIncomeLimit)));
  }
}

/**
 * Calculate QBI deduction for multiple businesses (Form 8995-A).
 *
 * Below threshold: simple 20% of combined QBI (no per-business limitation).
 * Above threshold: compute per-business (each with its own SSTB, W-2, UBIA),
 *   then aggregate. Combined deduction still capped at 20% of taxable income.
 *
 * @authority IRC §199A(a)(2) — QBI deduction limited to 20% of (taxable income − net capital gain)
 */
export function calculateMultiBusinessQBIDeduction(
  businesses: QBIBusinessEntry[],
  taxableIncomeBeforeQBI: number,
  filingStatus: FilingStatus,
  netCapitalGain: number = 0,
): number {
  if (!businesses || businesses.length === 0) return 0;

  const totalQBI = businesses.reduce((sum, b) => sum + Math.max(0, b.qualifiedBusinessIncome), 0);
  if (totalQBI <= 0) return 0;

  const taxableIncomeForLimit = Math.max(0, taxableIncomeBeforeQBI - netCapitalGain);
  const taxableIncomeLimit = round2(taxableIncomeForLimit * QBI.RATE);
  const threshold = getQBIThreshold(filingStatus);

  // Below threshold: simple 20% of combined QBI — no per-business limitation
  if (taxableIncomeBeforeQBI <= threshold) {
    const tentativeQBI = round2(totalQBI * QBI.RATE);
    return Math.max(0, Math.min(tentativeQBI, taxableIncomeLimit));
  }

  // At or above threshold: compute per-business, then aggregate
  let totalDeduction = 0;
  for (const biz of businesses) {
    if (biz.qualifiedBusinessIncome <= 0) continue;
    totalDeduction += calculateQBIDeduction(
      biz.qualifiedBusinessIncome,
      taxableIncomeBeforeQBI,
      filingStatus,
      biz.isSSTB,
      biz.w2WagesPaid,
      biz.ubiaOfQualifiedProperty,
      netCapitalGain,
    );
  }

  // Combined deduction still capped at 20% of (taxable income − net capital gain)
  return Math.max(0, round2(Math.min(totalDeduction, taxableIncomeLimit)));
}

// QBI threshold: MFJ and QSS use the higher threshold per IRS Form 8995 worksheet.
// Note: IRC §199A(e)(2) says "joint return" but IRS practice groups QSS with MFJ.
function getQBIThreshold(filingStatus: FilingStatus): number {
  switch (filingStatus) {
    case FilingStatus.MarriedFilingJointly:
    case FilingStatus.QualifyingSurvivingSpouse:
      return QBI.THRESHOLD_MFJ;
    default:
      return QBI.THRESHOLD_SINGLE;
  }
}

function getQBIPhaseInRange(filingStatus: FilingStatus): number {
  switch (filingStatus) {
    case FilingStatus.MarriedFilingJointly:
    case FilingStatus.QualifyingSurvivingSpouse:
      return QBI.PHASE_IN_RANGE_MFJ;
    default:
      return QBI.PHASE_IN_RANGE_SINGLE;
  }
}
