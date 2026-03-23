/**
 * Date validation utilities for TelosTax.
 *
 * Provides context-specific validation for different date field types:
 *   - Date of birth (filer, spouse, dependent)
 *   - Transaction sale/disposition dates (should be in the tax year)
 *   - Transaction acquisition dates (must be before sale date)
 *
 * Returns warning messages (amber) rather than errors (red) because
 * edge cases exist — e.g. a corrected form with a prior-year date.
 */

const TAX_YEAR = 2025;

/** Parse a date string (YYYY-MM-DD) into a Date, or null if invalid. */
function parse(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Validate a date of birth (filer, spouse, or dependent).
 * - Must not be in the future
 * - Must not be before 1900 (unreasonable)
 */
export function validateDateOfBirth(dateStr: string): string | undefined {
  const d = parse(dateStr);
  if (!d) return undefined; // empty or unparseable — let required-field validation handle it

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (d > today) {
    return 'Date of birth cannot be in the future.';
  }
  if (d.getFullYear() < 1900) {
    return 'Please check this date — year seems too far in the past.';
  }
  return undefined;
}

/**
 * Validate a transaction sale / disposition date (1099-B, 1099-DA, etc.).
 * - Should be in the current tax year
 * - Must not be in the future
 */
export function validateSaleDate(dateStr: string): string | undefined {
  const d = parse(dateStr);
  if (!d) return undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (d > today) {
    return 'This date is in the future — please double-check.';
  }
  if (d.getFullYear() !== TAX_YEAR) {
    return `This return is for tax year ${TAX_YEAR}. Sale dates from other years may not belong on this return.`;
  }
  return undefined;
}

/**
 * Validate a transaction acquisition date (when the asset was purchased).
 * - Must not be in the future
 * - If a sale date is provided, acquired date must be on or before it
 */
/**
 * Compute holding period from dates.
 * Long-term = held for more than 1 year (> 365 days, accounting for leap years).
 * Returns null if either date is missing or invalid.
 */
export function computeHoldingPeriod(dateAcquired: string, dateSold: string): 'long' | 'short' | null {
  const acquired = parse(dateAcquired);
  const sold = parse(dateSold);
  if (!acquired || !sold) return null;

  // Long-term: sold more than 1 year after acquired.
  // IRS rule: "more than 1 year" means the sold date is after the 1-year anniversary.
  const oneYearLater = new Date(acquired.getTime());
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  return sold > oneYearLater ? 'long' : 'short';
}

/**
 * Validate the holding period selection against the dates.
 * Returns a warning if the user's isLongTerm selection contradicts the dates.
 */
export function validateHoldingPeriod(
  dateAcquired: string,
  dateSold: string,
  isLongTerm: boolean,
): string | undefined {
  const computed = computeHoldingPeriod(dateAcquired, dateSold);
  if (!computed) return undefined; // can't validate without both dates

  if (isLongTerm && computed === 'short') {
    return 'Based on the dates entered, this appears to be a short-term holding (1 year or less).';
  }
  if (!isLongTerm && computed === 'long') {
    return 'Based on the dates entered, this appears to be a long-term holding (more than 1 year).';
  }
  return undefined;
}

/**
 * Check if a person is age 65 or older by end of the tax year.
 * IRS rule: you are considered 65 on the day before your 65th birthday.
 */
export function isAge65OrOlder(dateOfBirth: string | undefined, taxYear: number = TAX_YEAR): boolean {
  if (!dateOfBirth) return false;
  const dob = parse(dateOfBirth);
  if (!dob) return false;
  const age65Birthday = new Date(dob.getFullYear() + 65, dob.getMonth(), dob.getDate());
  age65Birthday.setDate(age65Birthday.getDate() - 1);
  const endOfTaxYear = new Date(taxYear, 11, 31);
  return age65Birthday <= endOfTaxYear;
}

/**
 * Get a person's age at end of the tax year (Dec 31).
 * Returns undefined if DOB is missing or unparseable.
 */
export function getAgeAtEndOfYear(dateOfBirth: string | undefined, taxYear: number = TAX_YEAR): number | undefined {
  if (!dateOfBirth) return undefined;
  const dob = parse(dateOfBirth);
  if (!dob) return undefined;
  const endOfYear = new Date(taxYear, 11, 31);
  let age = endOfYear.getFullYear() - dob.getFullYear();
  const monthDiff = endOfYear.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && endOfYear.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Validate a charitable contribution date (Form 8283, noncash donations).
 * - Must not be in the future
 * - Should be in the current tax year
 * - If an acquisition date is provided, contribution must be on or after it
 */
export function validateContributionDate(dateStr: string, dateAcquiredStr?: string): string | undefined {
  const d = parse(dateStr);
  if (!d) return undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (d > today) {
    return 'Contribution date is in the future — please double-check.';
  }
  if (d.getFullYear() !== TAX_YEAR) {
    return `This return is for tax year ${TAX_YEAR}. Contributions from other years should be reported on that year's return.`;
  }

  if (dateAcquiredStr) {
    const acquired = parse(dateAcquiredStr);
    if (acquired && d < acquired) {
      return 'Contribution date is before the date you acquired this property — please double-check.';
    }
  }

  return undefined;
}

export function validateAcquiredDate(dateStr: string, saleDateStr?: string): string | undefined {
  const d = parse(dateStr);
  if (!d) return undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (d > today) {
    return 'Acquisition date is in the future — please double-check.';
  }

  if (saleDateStr) {
    const saleDate = parse(saleDateStr);
    if (saleDate && d > saleDate) {
      return 'Acquisition date is after the sale date — please double-check.';
    }
  }

  return undefined;
}

/**
 * Validate a tax-year event date (Form 4797 sale, 1099-C cancellation, etc.).
 * - Must not be in the future
 * - Should be in the current tax year
 */
export function validateTaxYearEventDate(dateStr: string): string | undefined {
  const d = parse(dateStr);
  if (!d) return undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (d > today) {
    return 'This date is in the future — please double-check.';
  }
  if (d.getFullYear() !== TAX_YEAR) {
    return `This return is for tax year ${TAX_YEAR}. Events from other years may not belong on this return.`;
  }
  return undefined;
}

/**
 * Validate a divorce/separation agreement date.
 * - Must not be in the future
 * - Must not be before 1900 (unreasonable)
 */
export function validateDivorceDate(dateStr: string): string | undefined {
  const d = parse(dateStr);
  if (!d) return undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (d > today) {
    return 'Divorce/separation date is in the future — please double-check.';
  }
  if (d.getFullYear() < 1900) {
    return 'Please check this date — year seems too far in the past.';
  }
  return undefined;
}

/**
 * Validate a spouse date of death.
 * - Must not be in the future
 * - Should be in the current tax year (filing for year of death)
 */
export function validateDeathDate(dateStr: string): string | undefined {
  const d = parse(dateStr);
  if (!d) return undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (d > today) {
    return 'Date of death is in the future — please double-check.';
  }
  if (d.getFullYear() !== TAX_YEAR) {
    return `This return is for tax year ${TAX_YEAR}. If the date of death was in a different year, that year's return should be filed instead.`;
  }
  return undefined;
}

/**
 * Validate a "placed in service" or "first used" date.
 * - Must not be in the future
 */
export function validatePlacedInServiceDate(dateStr: string): string | undefined {
  const d = parse(dateStr);
  if (!d) return undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (d > today) {
    return 'This date is in the future — please double-check.';
  }
  return undefined;
}
