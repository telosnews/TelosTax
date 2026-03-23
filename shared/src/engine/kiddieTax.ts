import { KiddieTaxInfo } from '../types/index.js';
import { KIDDIE_TAX } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Kiddie Tax (Form 8615).
 *
 * Applies to children under 19 (or under 24 if full-time student) with
 * unearned income above the threshold.
 *
 * For 2025:
 *   - First $1,350 of unearned income: tax-free (covered by standard deduction)
 *   - Next $1,350: taxed at child's rate
 *   - Above $2,700: taxed at parent's marginal rate
 *
 * Returns the additional tax due to kiddie tax (above what child's rate would be).
 *
 * @authority
 *   IRC: Section 1(g) — certain unearned income of children taxed as if parent's income
 *   Rev. Proc: 2024-40, Section 3.03 — kiddie tax thresholds
 *   Form: Form 8615
 * @scope Unearned income of children taxed at parent's rate
 * @limitations None
 */
export interface KiddieTaxResult {
  applies: boolean;
  unearnedIncomeAboveThreshold: number;
  additionalTax: number;
}

export function calculateKiddieTax(info: KiddieTaxInfo): KiddieTaxResult {
  const zero: KiddieTaxResult = {
    applies: false,
    unearnedIncomeAboveThreshold: 0,
    additionalTax: 0,
  };

  if (!info) return zero;

  // Check age eligibility
  const ageLimit = info.isFullTimeStudent
    ? KIDDIE_TAX.STUDENT_AGE_LIMIT
    : KIDDIE_TAX.AGE_LIMIT;

  if (info.childAge >= ageLimit) return zero;

  // Unearned income above threshold
  const unearnedAbove = Math.max(0, info.childUnearnedIncome - KIDDIE_TAX.UNEARNED_INCOME_THRESHOLD);

  if (unearnedAbove <= 0) return zero;

  // The excess is taxed at parent's marginal rate instead of child's rate
  // Default parent rate = 37% (top bracket) if not provided
  const parentRate = info.parentMarginalRate || 0.37;
  const childRate = 0.10; // Child likely in 10% bracket

  // Additional tax = excess × (parent rate - child rate)
  const additionalTax = round2(unearnedAbove * Math.max(0, parentRate - childRate));

  return {
    applies: true,
    unearnedIncomeAboveThreshold: round2(unearnedAbove),
    additionalTax,
  };
}
