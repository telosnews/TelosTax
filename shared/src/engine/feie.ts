import { ForeignEarnedIncomeInfo } from '../types/index.js';
import { FEIE } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Foreign Earned Income Exclusion (Form 2555).
 *
 * For 2025: up to $130,000 of foreign earned income can be excluded.
 * If the taxpayer was present for less than a full year, the exclusion
 * is prorated based on qualifying days.
 *
 * The housing exclusion allows additional exclusion for foreign housing
 * expenses above the base amount.
 *
 * Returns the total exclusion amount (reduces total income).
 *
 * @authority
 *   IRC: Section 911 — citizens or residents of the United States living abroad
 *   Rev. Proc: 2024-40, Section 3.36 — foreign earned income exclusion amount
 *   Form: Form 2555
 * @scope Foreign earned income exclusion ($130k) and housing exclusion
 * @limitations None — stacking rule (§911(f)) is implemented in calculateIncomeTaxSection
 */
export interface FEIEResult {
  incomeExclusion: number;
  housingExclusion: number;
  totalExclusion: number;
}

const FULL_YEAR_DAYS = 365;

export function calculateFEIE(info: ForeignEarnedIncomeInfo): FEIEResult {
  const zero: FEIEResult = {
    incomeExclusion: 0,
    housingExclusion: 0,
    totalExclusion: 0,
  };

  if (!info || info.foreignEarnedIncome <= 0) return zero;

  // Prorate exclusion if less than full year
  const qualifyingDays = Math.min(info.qualifyingDays || FULL_YEAR_DAYS, FULL_YEAR_DAYS);
  const dailyExclusion = FEIE.EXCLUSION_AMOUNT / FULL_YEAR_DAYS;
  const maxExclusion = round2(dailyExclusion * qualifyingDays);

  // Income exclusion: lesser of foreign earned income or prorated max
  const incomeExclusion = round2(Math.min(info.foreignEarnedIncome, maxExclusion));

  // Housing exclusion: expenses above base, capped at max exclusion
  let housingExclusion = 0;
  if (info.housingExpenses && info.housingExpenses > 0) {
    const housingBase = round2(FEIE.HOUSING_BASE * (qualifyingDays / FULL_YEAR_DAYS));
    const housingMax = round2(FEIE.HOUSING_MAX_EXCLUSION * (qualifyingDays / FULL_YEAR_DAYS));
    const eligibleHousing = Math.max(0, Math.min(info.housingExpenses, housingMax) - housingBase);
    housingExclusion = round2(eligibleHousing);
  }

  const totalExclusion = round2(incomeExclusion + housingExclusion);

  return {
    incomeExclusion,
    housingExclusion,
    totalExclusion,
  };
}
