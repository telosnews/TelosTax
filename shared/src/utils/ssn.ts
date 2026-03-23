/**
 * SSN utility functions.
 *
 * Full 9-digit SSNs are stored encrypted at rest. These helpers handle
 * formatting, masking, and validation for display and form-filling.
 */

/** Format a raw 9-digit SSN as XXX-XX-XXXX */
export function formatSSN(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length !== 9) return ssn;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/** Mask an SSN, showing only the last 4 digits: ***-**-XXXX */
export function maskSSN(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length !== 9) return ssn;
  return `***-**-${digits.slice(5)}`;
}

/** Validate that a value is exactly 9 digits */
export function isValidSSN(value: string): boolean {
  return /^\d{9}$/.test(value.replace(/\D/g, ''));
}

/**
 * Get a display-ready SSN string.
 * - If full SSN available: formatted XXX-XX-XXXX
 * - If only last 4: XXX-XX-{last4}
 * - Otherwise: em dash
 */
export function getDisplaySSN(ssn?: string, ssnLastFour?: string): string {
  if (ssn) {
    const digits = ssn.replace(/\D/g, '');
    if (digits.length === 9) return formatSSN(digits);
  }
  if (ssnLastFour) return `XXX-XX-${ssnLastFour}`;
  return '—';
}
