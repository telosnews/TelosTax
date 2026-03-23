import { Form8606Info } from '../types/index.js';
import { round2 } from './utils.js';

/**
 * Calculate taxable portions of Roth conversions AND regular IRA distributions
 * using the pro-rata rule (Form 8606).
 *
 * When you have non-deductible (after-tax) basis in traditional IRAs, ALL
 * distributions (both regular and Roth conversions) must use the pro-rata rule
 * to determine the non-taxable portion.
 *
 * Pro-rata rule (Form 8606 Lines 9-12):
 *   Line 9: totalIRAValue = yearEndBalance + conversions + regularDistributions
 *   Line 10: nonTaxableRatio = totalBasis / totalIRAValue
 *   Line 11: nonTaxableConversion = conversionAmount × nonTaxableRatio
 *   Line 12: nonTaxableDistributions = regularDistributions × nonTaxableRatio
 *   Line 14: remainingBasis = totalBasis - Line 11 - Line 12
 *
 * @authority
 *   IRC: Section 408(d)(1)-(2) — taxability of IRA distributions
 *   IRC: Section 408A — Roth IRAs
 *   Form: Form 8606, Lines 1-15
 * @scope Nondeductible IRA basis tracking, Roth conversion and distribution pro-rata
 * @limitations Does not track multi-year basis accumulation
 */
export interface Form8606Result {
  totalBasis: number;              // Total non-deductible basis (prior + current year)
  nonTaxableRatio: number;         // Pro-rata non-taxable ratio (Line 10)
  taxableConversion: number;       // Taxable portion of Roth conversion (Line 18)
  nonTaxableDistributions: number; // Non-taxable portion of regular distributions (Line 12)
  taxableDistributions: number;    // Taxable portion of regular distributions (Line 15b)
  regularDistributions: number;    // Input: total regular IRA distributions used (Line 7)
  remainingBasis: number;          // Basis carried forward (Line 14)
}

export function calculateForm8606(info: Form8606Info, regularDistributions = 0): Form8606Result {
  const safeRegularDist = Math.max(0, regularDistributions);

  const zero: Form8606Result = {
    totalBasis: 0,
    nonTaxableRatio: 0,
    taxableConversion: 0,
    nonTaxableDistributions: 0,
    taxableDistributions: safeRegularDist,
    regularDistributions: safeRegularDist,
    remainingBasis: 0,
  };

  if (!info) return zero;

  const currentYearContrib = Math.max(0, info.nondeductibleContributions || 0);
  const priorBasis = Math.max(0, info.priorYearBasis || 0);
  const totalBasis = round2(currentYearContrib + priorBasis);
  const conversionAmount = Math.max(0, info.rothConversionAmount || 0);
  const iraBalance = Math.max(0, info.traditionalIRABalance || 0);

  // Nothing to convert or distribute — just preserve basis
  if (conversionAmount <= 0 && safeRegularDist <= 0) {
    return {
      totalBasis,
      nonTaxableRatio: 0,
      taxableConversion: 0,
      nonTaxableDistributions: 0,
      taxableDistributions: 0,
      regularDistributions: 0,
      remainingBasis: totalBasis,
    };
  }

  // No basis — everything is fully taxable
  if (totalBasis <= 0) {
    return {
      totalBasis: 0,
      nonTaxableRatio: 0,
      taxableConversion: conversionAmount,
      nonTaxableDistributions: 0,
      taxableDistributions: safeRegularDist,
      regularDistributions: safeRegularDist,
      remainingBasis: 0,
    };
  }

  // Form 8606 Line 9: year-end balance + conversion + regular distributions
  const totalIRAValue = round2(iraBalance + conversionAmount + safeRegularDist);

  if (totalIRAValue <= 0) {
    return {
      totalBasis,
      nonTaxableRatio: 0,
      taxableConversion: conversionAmount,
      nonTaxableDistributions: 0,
      taxableDistributions: safeRegularDist,
      regularDistributions: safeRegularDist,
      remainingBasis: 0,
    };
  }

  // Line 10: Pro-rata non-taxable ratio = basis / total IRA value
  const nonTaxableRatio = Math.min(1, totalBasis / totalIRAValue);

  // Line 11: Non-taxable portion of Roth conversion
  const nonTaxableConversion = round2(conversionAmount * nonTaxableRatio);
  const taxableConversion = round2(conversionAmount - nonTaxableConversion);

  // Line 12: Non-taxable portion of regular distributions
  const nonTaxableDistributions = round2(safeRegularDist * nonTaxableRatio);
  const taxableDistributions = round2(safeRegularDist - nonTaxableDistributions);

  // Line 14: Remaining basis = totalBasis - Line 11 - Line 12
  const remainingBasis = round2(Math.max(0, totalBasis - nonTaxableConversion - nonTaxableDistributions));

  return {
    totalBasis,
    nonTaxableRatio: round2(nonTaxableRatio * 10000) / 10000, // 4 decimal places
    taxableConversion,
    nonTaxableDistributions,
    taxableDistributions,
    regularDistributions: safeRegularDist,
    remainingBasis,
  };
}
