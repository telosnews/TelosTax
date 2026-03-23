import { TaxReturn, CalculationResult, StateReturnConfig, StateCalculationResult } from '../../types/index.js';
import { round2 } from '../utils.js';

/**
 * State Income Allocation — Part-Year and Nonresident Filers
 *
 * Determines the portion of federal AGI that is taxable in a given state
 * based on residency type:
 *
 *   - **Resident**: All income taxable (no allocation needed)
 *   - **Part-year**: Prorated by days: allocatedAGI = federalAGI × (daysLivedInState / daysInYear)
 *   - **Nonresident**: Only state-source income is taxable (W-2 wages for that state,
 *     rental income in state, business income with nexus)
 *
 * @authority
 *   IRC: Various — state income tax is governed by individual state statutes
 *   Uniform: UDITPA §§ 3-8 — Uniform Division of Income for Tax Purposes Act
 *   Common state rules: NY IT-203, CA 540NR, NJ-1040NR
 * @scope Part-year proration, nonresident source income, credit for taxes paid to other states
 * @limitations Simplified model — does not handle state-specific allocation nuances
 */

export interface StateIncomeAllocation {
  /** State-taxable portion of federal AGI */
  allocatedAGI: number;
  /** For part-year: days/daysInYear; for nonresident: source/total; for resident: 1.0 */
  allocationRatio: number;
  /** W-2 wages from this state (W-2 Box 15 matches state) */
  sourceWages: number;
  /** Schedule C/K-1 business income attributable to state (override or estimate) */
  sourceBusinessIncome: number;
  /** Rental income from property located in state (override) */
  sourceRentalIncome: number;
  /** Other state-source income (override) */
  sourceOtherIncome: number;
}

/**
 * Allocate income to a state based on residency type.
 *
 * For residents, returns full federal AGI with ratio 1.0.
 * For part-year filers, prorates by days lived in state.
 * For nonresidents, sums state-source income only.
 */
export function allocateStateIncome(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
): StateIncomeAllocation {
  const federalAGI = federalResult.form1040.agi;
  const stateCode = config.stateCode.toUpperCase();

  // Resident: all income taxable
  if (config.residencyType === 'resident') {
    return {
      allocatedAGI: federalAGI,
      allocationRatio: 1.0,
      sourceWages: getWagesForState(taxReturn, stateCode),
      sourceBusinessIncome: 0,
      sourceRentalIncome: 0,
      sourceOtherIncome: 0,
    };
  }

  // Part-year: prorate by days lived in state
  if (config.residencyType === 'part_year') {
    const daysInYear = isLeapYear(taxReturn.taxYear) ? 366 : 365;
    const daysLived = Math.min(Math.max(0, config.daysLivedInState || 0), daysInYear);
    const ratio = daysInYear > 0 ? Math.round((daysLived / daysInYear) * 1000000) / 1000000 : 0;

    // Also consider state-source income earned while non-resident in that state
    // (e.g., commuter wages). For simplicity, prorate all income by days ratio.
    const sourceWages = getWagesForState(taxReturn, stateCode);
    const allocatedAGI = round2(federalAGI * ratio);

    return {
      allocatedAGI,
      allocationRatio: ratio,
      sourceWages,
      sourceBusinessIncome: 0,
      sourceRentalIncome: 0,
      sourceOtherIncome: 0,
    };
  }

  // Nonresident: only state-source income
  const sourceWages = getWagesForState(taxReturn, stateCode);
  const sourceRentalIncome = (config.stateSpecificData?.sourceRentalIncome as number) || 0;
  const sourceBusinessIncome = (config.stateSpecificData?.sourceBusinessIncome as number) || 0;
  const sourceOtherIncome = (config.stateSpecificData?.sourceOtherIncome as number) || 0;

  const totalSourceIncome = round2(
    sourceWages + sourceRentalIncome + sourceBusinessIncome + sourceOtherIncome,
  );

  // Allocation ratio = source income / total income (for use in credit calculations)
  const ratio = federalAGI > 0 ? Math.round((totalSourceIncome / federalAGI) * 1000000) / 1000000 : 0;
  const clampedRatio = Math.min(1.0, Math.max(0, ratio));

  return {
    allocatedAGI: round2(Math.min(totalSourceIncome, federalAGI)),
    allocationRatio: clampedRatio,
    sourceWages,
    sourceBusinessIncome,
    sourceRentalIncome,
    sourceOtherIncome,
  };
}

/**
 * Calculate credit for taxes paid to another state (for resident state returns).
 *
 * When a resident pays tax to another state as a nonresident, the resident state
 * typically allows a credit equal to the lesser of:
 *   (a) Tax actually paid to the other state, or
 *   (b) Resident state tax × (other-state income / total income)
 *
 * This prevents double taxation of the same income.
 */
export function calculateOtherStateCredit(
  residentStateTax: number,
  otherStateTaxPaid: number,
  otherStateIncome: number,
  totalIncome: number,
): number {
  if (otherStateTaxPaid <= 0 || otherStateIncome <= 0 || totalIncome <= 0) return 0;

  const proportionateTax = round2(residentStateTax * (otherStateIncome / totalIncome));
  return round2(Math.min(otherStateTaxPaid, proportionateTax));
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Sum W-2 wages for a specific state (W-2 Box 15 state match).
 */
function getWagesForState(taxReturn: TaxReturn, stateCode: string): number {
  return round2(
    (taxReturn.w2Income || [])
      .filter(w => w.state?.toUpperCase() === stateCode)
      .reduce((sum, w) => sum + (w.stateWages ?? w.wages ?? 0), 0),
  );
}

/**
 * Get rental income attributable to a specific state.
 * RentalProperty does not currently have a stateCode field, so this reads
 * from `stateSpecificData.sourceRentalIncome` on the StateReturnConfig.
 * Returns 0 unless overridden — this will be enhanced when stateCode is added to RentalProperty.
 */
function getRentalIncomeForState(_taxReturn: TaxReturn, _stateCode: string): number {
  // Placeholder: RentalProperty lacks stateCode. Nonresident rental income
  // should be specified via config.stateSpecificData.sourceRentalIncome.
  return 0;
}

/**
 * Determine if a year is a leap year.
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
