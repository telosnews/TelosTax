/**
 * Import Helpers — shared utilities for CSV and PDF import.
 *
 * All parsing runs client-side. Data never leaves the browser.
 */

/**
 * Parse a currency string into a number.
 * Handles: "$1,234.56", "(500.00)" (negative), "1234", "-$500", blank → 0.
 */
export function parseCurrencyString(value: string | null | undefined): number {
  if (!value || typeof value !== 'string') return 0;

  let cleaned = value.trim();
  if (cleaned === '' || cleaned === '-' || cleaned === '$') return 0;

  // Detect negative: parentheses or leading minus
  const isNegative = (cleaned.startsWith('(') && cleaned.endsWith(')')) || cleaned.startsWith('-');

  // Strip currency symbols, commas, spaces, parentheses
  cleaned = cleaned.replace(/[$,\s()]/g, '');

  // Remove leading minus (we already tracked negativity)
  if (cleaned.startsWith('-')) cleaned = cleaned.slice(1);

  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;

  return isNegative ? -Math.round(num * 100) / 100 : Math.round(num * 100) / 100;
}

/**
 * Parse a date string in various formats into YYYY-MM-DD (HTML date input format).
 * Accepts: "01/15/2025", "1/15/25", "2025-01-15", "01-15-2025", "Jan 15, 2025".
 * Returns null if unparseable.
 */
export function parseDateString(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Try YYYY-MM-DD first (ISO format — most reliable)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return formatDate(parseInt(y), parseInt(m), parseInt(d));
  }

  // Try MM/DD/YYYY or MM-DD-YYYY
  const usMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return formatDate(parseInt(y), parseInt(m), parseInt(d));
  }

  // Try MM/DD/YY or M/D/YY (2-digit year)
  const shortYearMatch = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})$/);
  if (shortYearMatch) {
    const [, m, d, yy] = shortYearMatch;
    const year = parseInt(yy) + (parseInt(yy) > 50 ? 1900 : 2000);
    return formatDate(year, parseInt(m), parseInt(d));
  }

  // Try "Jan 15, 2025" or "January 15, 2025"
  const monthNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12,
  };
  const namedMatch = trimmed.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (namedMatch) {
    const [, monthStr, d, y] = namedMatch;
    const month = monthNames[monthStr.toLowerCase()];
    if (month) {
      return formatDate(parseInt(y), month, parseInt(d));
    }
  }

  // Fallback: try JS Date constructor
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) {
    return formatDate(
      fallback.getFullYear(),
      fallback.getMonth() + 1,
      fallback.getDate(),
    );
  }

  return null;
}

/** Format year/month/day into YYYY-MM-DD, with validation */
function formatDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Infer holding period from acquisition and sale dates.
 * Returns true if held > 365 days (long-term), false otherwise.
 * Returns false (short-term) if either date is missing.
 */
export function inferHoldingPeriod(
  dateAcquired: string | null | undefined,
  dateSold: string | null | undefined,
): boolean {
  if (!dateAcquired || !dateSold) return false;

  const acquired = new Date(dateAcquired);
  const sold = new Date(dateSold);
  if (isNaN(acquired.getTime()) || isNaN(sold.getTime())) return false;

  const diffMs = sold.getTime() - acquired.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 365;
}

/**
 * Parse a holding period string into a boolean.
 * "Long Term", "LT", "L", "Long" → true
 * "Short Term", "ST", "S", "Short" → false
 * Returns null if unrecognized.
 */
export function parseHoldingPeriod(value: string | null | undefined): boolean | null {
  if (!value || typeof value !== 'string') return null;

  const lower = value.trim().toLowerCase();
  if (['long term', 'long-term', 'longterm', 'lt', 'long', 'l'].includes(lower)) return true;
  if (['short term', 'short-term', 'shortterm', 'st', 'short', 's'].includes(lower)) return false;

  return null;
}

/**
 * Validate that required fields are present and non-empty.
 * Returns list of missing field names.
 */
export function validateRequiredFields(
  item: Record<string, unknown>,
  requiredKeys: string[],
): string[] {
  const missing: string[] = [];
  for (const key of requiredKeys) {
    const val = item[key];
    if (val === undefined || val === null || val === '' || (typeof val === 'number' && isNaN(val))) {
      missing.push(key);
    }
  }
  return missing;
}

/** Max file sizes */
export const MAX_CSV_SIZE = 10 * 1024 * 1024;  // 10 MB
export const MAX_PDF_SIZE = 25 * 1024 * 1024;   // 25 MB
export const MAX_TXF_SIZE = 50 * 1024 * 1024;   // 50 MB (TXF files can be large with thousands of trades)
export const MAX_FDX_SIZE = 25 * 1024 * 1024;   // 25 MB (FDX JSON files)
