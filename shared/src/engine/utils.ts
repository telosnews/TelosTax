/**
 * Shared Engine Utilities
 *
 * Common helper functions used across multiple tax calculation modules.
 * Consolidated to eliminate duplication and ensure consistent rounding behavior.
 */

/**
 * Round a number to two decimal places (cents).
 * Used throughout the tax engine for dollar-amount rounding.
 *
 * Uses Math.round (round half away from zero for .5) which matches
 * IRS rounding convention for tax calculations.
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Parse a date string into { year, month (0-based), day } without relying on
 * `new Date(string)` which is locale/browser-dependent for date-only strings.
 *
 * Accepts "YYYY-MM-DD", "YYYY/MM/DD", and ISO 8601 ("YYYY-MM-DDTHH:mm…").
 * Returns null if the string cannot be parsed.
 */
/**
 * Immutably set a value at a dot-notation path in an object.
 * Creates missing intermediary objects along the path.
 *
 * Example: setDeepPath({ a: { b: 1 } }, 'a.c', 2) => { a: { b: 1, c: 2 } }
 *
 * Does not handle array bracket syntax — array updates should use
 * full-array replacement (existing pattern used by wizard steps).
 */
export function setDeepPath<T extends Record<string, unknown>>(obj: T, path: string, value: unknown): T {
  const parts = path.split('.');
  if (parts.length === 1) {
    return { ...obj, [parts[0]]: value };
  }

  const [head, ...rest] = parts;
  const child = (obj[head] != null && typeof obj[head] === 'object')
    ? obj[head] as Record<string, unknown>
    : {};
  return {
    ...obj,
    [head]: setDeepPath(child, rest.join('.'), value),
  };
}

export function parseDateString(dateStr: string): { year: number; month: number; day: number } | null {
  const parts = dateStr.split(/[-\/T]/);
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-based
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  // Range validation: reject nonsensical dates that would silently produce wrong results
  if (year < 1900 || year > 2100) return null;
  if (month < 0 || month > 11) return null;   // 0-based after subtracting 1
  if (day < 1 || day > 31) return null;
  return { year, month, day };
}
