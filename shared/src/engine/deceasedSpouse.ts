import { FilingStatus, TaxReturn, DeceasedSpouseValidationResult } from '../types/index.js';

/**
 * Validate filing status for returns involving a deceased spouse.
 *
 * IRC §6013(a)(2): A joint return may be filed for the year of death.
 * The surviving spouse may file as MFJ for the year the spouse died,
 * reporting all income for both spouses for the full year.
 *
 * IRC §2(a): Qualifying Surviving Spouse (QSS) status is available for
 * the 2 tax years following the year of death, provided:
 *   - The surviving spouse has not remarried
 *   - The surviving spouse maintains a household for a qualifying child
 *   - The surviving spouse was eligible to file a joint return in the year of death
 *
 * This is a non-blocking validation — errors are returned as warnings/errors
 * but do not prevent calculation.
 *
 * @authority
 *   IRC: Section 6013(a)(2) — Joint return with deceased spouse (year of death)
 *   IRC: Section 2(a) — Qualifying surviving spouse (2 years after death)
 *   IRC: Section 6013(d)(1)(B) — Executor may revoke joint return election
 *   Form: Form 1040, Filing Status line
 * @scope Validates MFJ for year of death and QSS for subsequent 2 years
 * @limitations Does not verify remarriage status or executor consent;
 *   relies on user attestation for QSS qualifying child requirement
 */
export function validateDeceasedSpouse(taxReturn: TaxReturn): DeceasedSpouseValidationResult {
  const result: DeceasedSpouseValidationResult = {
    isValid: true,
    spouseDiedDuringTaxYear: false,
    qualifiesForMFJ: false,
    qualifiesForQSS: false,
    errors: [],
    warnings: [],
  };

  const filingStatus = taxReturn.filingStatus || FilingStatus.Single;
  const spouseDateOfDeath = taxReturn.spouseDateOfDeath;

  if (!spouseDateOfDeath) {
    return result; // No deceased spouse info — nothing to validate
  }

  const deathDate = new Date(spouseDateOfDeath);
  if (isNaN(deathDate.getTime())) {
    result.isValid = false;
    result.errors.push('Invalid spouse date of death format');
    return result;
  }

  const taxYear = taxReturn.taxYear;
  // Use UTC year to avoid timezone-related off-by-one errors
  // (e.g., '2025-01-01' parsed as UTC midnight → Dec 31, 2024 in local time)
  const deathYear = deathDate.getUTCFullYear();
  const yearsSinceDeath = taxYear - deathYear;

  // ─── Year of death: MFJ is allowed ─────────────────
  // IRC §6013(a)(2): Joint return allowed for year of death
  if (deathYear === taxYear) {
    result.spouseDiedDuringTaxYear = true;
    result.qualifiesForMFJ = true;

    if (filingStatus === FilingStatus.MarriedFilingJointly) {
      result.warnings.push(
        `Spouse died during ${taxYear}. MFJ is allowed for the year of death per IRC §6013(a)(2). ` +
        `Full-year income for both spouses is reported on this joint return.`,
      );
    } else if (filingStatus === FilingStatus.MarriedFilingSeparately) {
      result.warnings.push(
        `Spouse died during ${taxYear}. You may choose MFJ for the year of death per IRC §6013(a)(2), ` +
        `which often produces a lower tax. MFS is also permitted.`,
      );
    } else if (filingStatus === FilingStatus.QualifyingSurvivingSpouse) {
      result.isValid = false;
      result.errors.push(
        `QSS filing status is not available for the year of death (${taxYear}). ` +
        `Use MFJ or MFS for the year the spouse died. QSS is available for the 2 subsequent years.`,
      );
    }
  }

  // ─── 1-2 years after death: QSS may be available ───
  // IRC §2(a): QSS for 2 years after year of death
  if (yearsSinceDeath >= 1 && yearsSinceDeath <= 2) {
    // QSS requires: qualifying child (dependent), maintained household, not remarried
    const hasQualifyingChild = (taxReturn.dependents || []).some(d => {
      const monthsReq = d.monthsLivedWithYou >= 7; // More than half the year
      return monthsReq;
    });

    if (hasQualifyingChild) {
      result.qualifiesForQSS = true;
    }

    if (filingStatus === FilingStatus.QualifyingSurvivingSpouse) {
      if (!hasQualifyingChild) {
        result.isValid = false;
        result.errors.push(
          'QSS filing status requires a qualifying dependent child who lived with you for more than half the year.',
        );
      } else {
        result.warnings.push(
          `QSS filing status is valid for ${taxYear} (${yearsSinceDeath} year(s) after spouse's death in ${deathYear}). ` +
          `This provides the MFJ standard deduction and tax brackets.`,
        );
      }
    } else if (filingStatus === FilingStatus.MarriedFilingJointly) {
      result.isValid = false;
      result.errors.push(
        `MFJ is not available ${yearsSinceDeath} year(s) after spouse's death. ` +
        `MFJ is only allowed for the year of death (${deathYear}). ` +
        `Consider QSS if you have a qualifying child, or Single/HoH.`,
      );
    }
  }

  // ─── 3+ years after death: QSS is no longer available ──
  if (yearsSinceDeath >= 3) {
    if (filingStatus === FilingStatus.QualifyingSurvivingSpouse) {
      result.isValid = false;
      result.errors.push(
        `QSS filing status is only available for 2 tax years following the year of death (${deathYear}). ` +
        `${taxYear} is ${yearsSinceDeath} years after death. Use Single or Head of Household.`,
      );
    } else if (filingStatus === FilingStatus.MarriedFilingJointly) {
      result.isValid = false;
      result.errors.push(
        `MFJ is not available ${yearsSinceDeath} years after spouse's death. ` +
        `Use Single or Head of Household.`,
      );
    }
  }

  // ─── Death before tax year but not MFJ/QSS situation ──
  if (deathYear < taxYear && filingStatus === FilingStatus.MarriedFilingSeparately) {
    result.warnings.push(
      `MFS is typically for the year of death only. For subsequent years, ` +
      `consider QSS (if eligible) or Single/HoH.`,
    );
  }

  return result;
}
