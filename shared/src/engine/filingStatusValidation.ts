import { FilingStatus, TaxReturn, HoHValidationResult } from '../types/index.js';

/**
 * Validate Head of Household filing status requirements.
 *
 * IRC §2(b) requires ALL of the following:
 *   1. Unmarried (or "considered unmarried") at end of tax year
 *   2. Paid more than half the cost of maintaining a household for the year
 *   3. A qualifying person lived with the taxpayer for more than half the year
 *
 * Qualifying persons (IRC §2(b)(1)(A)):
 *   - Qualifying child (dependent) who lived with taxpayer > 6 months
 *   - Qualifying relative (dependent parent) — exception: parent need NOT live with taxpayer
 *
 * "Considered unmarried" for MFS:
 *   - Lived apart from spouse for last 6 months of the year (IRC §7703(b))
 *   - Paid > 50% of household costs
 *   - Has qualifying dependent in the home
 *
 * This is a warning/flag approach — validation errors do NOT block the calculation.
 * The caller decides whether to surface these warnings to the user.
 *
 * @authority
 *   IRC: Section 2(b) — definition of head of household
 *   IRC: Section 7703(b) — determination of marital status ("considered unmarried")
 *   Form: Form 1040, Filing Status checkbox
 *   Publication: Pub 501 — Dependents, Standard Deduction, and Filing Information
 * @scope HoH filing status eligibility validation
 * @limitations
 *   Does not verify marital status documentation
 *   Does not model temporary absence rules (e.g., school, illness)
 *   Does not model the parent-not-living-with-you exception for dependent parent
 *   Does not verify actual household costs vs. contributions
 */
export function validateHeadOfHousehold(taxReturn: TaxReturn): HoHValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Only validate if HoH is the selected filing status
  if (taxReturn.filingStatus !== FilingStatus.HeadOfHousehold) {
    return { isValid: true, errors: [], warnings: [] };
  }

  // ── Check 1: Must have at least one dependent (qualifying person) ──
  const dependents = taxReturn.dependents || [];
  if (dependents.length === 0) {
    errors.push(
      'Head of Household requires a qualifying person. No dependents were claimed.',
    );
  }

  // ── Check 2: At least one dependent must have lived with taxpayer > 6 months ──
  // IRC §2(b)(1)(A): qualifying child must have lived with taxpayer "for more than one-half of such taxable year"
  // That's > 6 months, i.e. ≥ 7 months.
  // Exception: dependent parent does NOT need to live with taxpayer (qualifying relative under §152(d))
  if (dependents.length > 0) {
    const hasQualifyingResident = dependents.some(d => d.monthsLivedWithYou >= 7);
    const hasDependentParent = dependents.some(
      d => d.relationship.toLowerCase() === 'parent' ||
           d.relationship.toLowerCase() === 'mother' ||
           d.relationship.toLowerCase() === 'father',
    );

    if (!hasQualifyingResident && !hasDependentParent) {
      errors.push(
        'No qualifying person lived with you for more than half the year (at least 7 months). ' +
        'Exception: a dependent parent does not need to live with you.',
      );
    }

    if (!hasQualifyingResident && hasDependentParent) {
      warnings.push(
        'Head of Household qualification is based on a dependent parent who does not need to live with you. ' +
        'Ensure you paid more than half the cost of maintaining the parent\'s home.',
      );
    }
  }

  // ── Check 3: Must have paid over half the cost of maintaining the household ──
  // IRC §2(b)(1)(A): "has maintained as his home a household which constitutes
  // for more than one-half of such taxable year the principal place of abode"
  if (taxReturn.paidOverHalfHouseholdCost === false) {
    errors.push(
      'Head of Household requires paying more than half the cost of maintaining your household for the year.',
    );
  } else if (taxReturn.paidOverHalfHouseholdCost === undefined) {
    warnings.push(
      'Unable to verify whether you paid more than half of household maintenance costs. ' +
      'This is required for Head of Household filing status.',
    );
  }

  // ── Check 4: Incompatible with MFJ ──
  // HoH is only for unmarried or "considered unmarried" taxpayers
  // If filingStatus is already HoH, this is mainly a sanity check —
  // but we warn if spouse info suggests they may be married
  if (taxReturn.spouseFirstName && taxReturn.spouseLastName &&
      taxReturn.livedApartFromSpouse !== true) {
    warnings.push(
      'Spouse information is present. Head of Household generally requires being unmarried. ' +
      'If married, you must have lived apart from your spouse for the last 6 months of the year ' +
      'to be "considered unmarried" under IRC §7703(b).',
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
