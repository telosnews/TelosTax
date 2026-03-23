/**
 * Deduction Finder — Return Context Builder
 *
 * Maps the full TaxReturn + CalculationResult into a slim ReturnContext
 * object for pattern gating. Pure function, no side effects.
 */

import type { TaxReturn, CalculationResult } from '@telostax/engine';
import type { ReturnContext } from './deductionFinderTypes';

export function buildReturnContext(
  taxReturn: TaxReturn,
  calculation: CalculationResult | null,
): ReturnContext {
  const taxYear = taxReturn.taxYear ?? new Date().getFullYear();
  const dependents = taxReturn.dependents || [];
  const minorDependentCount = dependents.filter((d) => isUnderAge(d.dateOfBirth, 13, taxYear)).length;
  const childUnder17Count = dependents.filter((d) => isUnderAge(d.dateOfBirth, 17, taxYear)).length;

  const hasSE = (taxReturn.income1099NEC?.length ?? 0) > 0 ||
    (taxReturn.income1099K?.length ?? 0) > 0 ||
    (taxReturn.income1099MISC?.length ?? 0) > 0 ||
    (taxReturn.businesses?.length ?? 0) > 0;

  const itemized = taxReturn.itemizedDeductions;

  const standardDed = calculation?.form1040?.standardDeduction ?? 0;
  const itemizedDed = calculation?.form1040?.itemizedDeduction ?? 0;

  return {
    filingStatus: taxReturn.filingStatus ?? null,
    dependentCount: dependents.length,
    minorDependentCount,
    childUnder17Count,
    deductionMethod: taxReturn.deductionMethod || 'standard',
    hasScheduleC: hasSE,
    hasHomeOffice: !!taxReturn.homeOffice?.method,
    hasHSA: (taxReturn.hsaDeduction ?? 0) > 0 || !!taxReturn.hsaContribution,
    hasStudentLoanInterest: (taxReturn.studentLoanInterest ?? 0) > 0,
    hasMortgageInterest: (itemized?.mortgageInterest ?? 0) > 0,
    hasCharitableDeductions:
      ((itemized?.charitableCash ?? 0) + (itemized?.charitableNonCash ?? 0)) > 0,
    hasMedicalExpenses: (itemized?.medicalExpenses ?? 0) > 0,
    hasSEHealthInsurance:
      (taxReturn.selfEmploymentDeductions?.healthInsurancePremiums ?? 0) > 0,
    hasGamblingWinnings: (taxReturn.incomeW2G?.length ?? 0) > 0,
    hasSALT:
      (itemized?.stateLocalIncomeTax ?? 0) > 0 ||
      (itemized?.realEstateTax ?? 0) > 0,
    itemizingDelta: itemizedDed - standardDed,
    agi: calculation?.form1040?.agi ?? 0,
    marginalRate: calculation?.form1040?.marginalTaxRate ?? 0,
  };
}

/** Check if dependent is under a given age as of Dec 31 of the tax year. */
function isUnderAge(dateOfBirth: string | undefined, age: number, taxYear: number): boolean {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return false;
  const cutoff = new Date(taxYear - age, 11, 31); // Dec 31, `age` years ago
  return dob > cutoff;
}
