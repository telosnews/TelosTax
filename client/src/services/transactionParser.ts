/**
 * Transaction Parser — Bank Statement CSV Parser
 *
 * Auto-detects bank format via header signatures (Chase, BofA, Citi, Amex,
 * Wells Fargo) with a generic fallback using fuzzy column alias matching.
 *
 * Reuses sanitizeCellValue, parseCurrencyString, parseDateString from importHelpers.
 * All parsing runs client-side. Data never leaves the browser.
 */

import Papa from 'papaparse';
import type { NormalizedTransaction, ParseResult } from './deductionFinderTypes';
import { parseCurrencyString, parseDateString } from './importHelpers';
import { extractMCCFromDescription } from './mccTaxMap';

// ─── Bank Format Signatures ─────────────────────────

interface BankSignature {
  name: string;
  /** Header columns that identify this bank (all must match, case-insensitive) */
  requiredHeaders: string[];
  /** At least one of these must be present to confirm detection (disambiguates banks with identical required headers) */
  uniqueHeaders?: string[];
  /** Column name for the transaction date */
  dateColumn: string;
  /** Column name for the description/memo */
  descriptionColumn: string;
  /** Column name for the amount (positive = debit by default) */
  amountColumn: string;
  /** Optional separate credit column (e.g. Citi has split Debit/Credit columns) */
  creditColumn?: string;
  /** Optional MCC (Merchant Category Code) column */
  mccColumn?: string;
  /**
   * Sign convention:
   * 'negative_is_debit' — negative values are expenses (Chase, Bank of America, Wells Fargo)
   * 'positive_is_debit' — positive values are expenses (Citi, American Express)
   */
  signConvention: 'negative_is_debit' | 'positive_is_debit';
}

// Order matters: specific signatures (with uniqueHeaders) before generic catch-alls.
// Chase and Citi have unique requiredHeaders so they naturally match first.
// Amex and Wells Fargo are disambiguated from BofA via uniqueHeaders.
// BofA is the catch-all fallback for date/description/amount CSVs.
const BANK_SIGNATURES: BankSignature[] = [
  {
    name: 'Chase',
    requiredHeaders: ['transaction date', 'description', 'amount'],
    dateColumn: 'transaction date',
    descriptionColumn: 'description',
    amountColumn: 'amount',
    signConvention: 'negative_is_debit',
  },
  {
    name: 'Citi',
    requiredHeaders: ['date', 'description', 'debit', 'credit'],
    dateColumn: 'date',
    descriptionColumn: 'description',
    amountColumn: 'debit',
    creditColumn: 'credit',
    signConvention: 'positive_is_debit',
  },
  {
    name: 'American Express',
    requiredHeaders: ['date', 'description', 'amount'],
    uniqueHeaders: ['card member', 'account #', 'extended details'],
    dateColumn: 'date',
    descriptionColumn: 'description',
    amountColumn: 'amount',
    mccColumn: 'mcc',
    signConvention: 'positive_is_debit',
  },
  {
    name: 'Wells Fargo',
    requiredHeaders: ['date', 'description', 'amount'],
    uniqueHeaders: ['check number', 'check num'],
    dateColumn: 'date',
    descriptionColumn: 'description',
    amountColumn: 'amount',
    signConvention: 'negative_is_debit',
  },
  // ── Personal Finance Apps ──
  {
    name: 'Monarch Money',
    requiredHeaders: ['date', 'merchant', 'amount'],
    uniqueHeaders: ['category', 'account', 'institution', 'notes'],
    dateColumn: 'date',
    descriptionColumn: 'merchant',
    amountColumn: 'amount',
    signConvention: 'negative_is_debit',
  },
  {
    name: 'YNAB',
    requiredHeaders: ['date', 'payee', 'outflow'],
    uniqueHeaders: ['category group/category', 'category group', 'memo'],
    dateColumn: 'date',
    descriptionColumn: 'payee',
    amountColumn: 'outflow',
    creditColumn: 'inflow',
    signConvention: 'positive_is_debit',
  },
  {
    name: 'Copilot',
    requiredHeaders: ['date', 'name', 'amount'],
    uniqueHeaders: ['category', 'account name', 'status', 'excluded'],
    dateColumn: 'date',
    descriptionColumn: 'name',
    amountColumn: 'amount',
    signConvention: 'negative_is_debit',
  },
  {
    name: 'Apple Card',
    requiredHeaders: ['transaction date', 'description', 'amount (usd)'],
    dateColumn: 'transaction date',
    descriptionColumn: 'description',
    amountColumn: 'amount (usd)',
    mccColumn: 'merchant category code',
    signConvention: 'positive_is_debit',
  },
  {
    // BofA is the catch-all for date/description/amount CSVs (no uniqueHeaders).
    name: 'Bank of America',
    requiredHeaders: ['date', 'description', 'amount'],
    dateColumn: 'date',
    descriptionColumn: 'description',
    amountColumn: 'amount',
    signConvention: 'negative_is_debit',
  },
];

// ─── Generic Column Aliases ─────────────────────────

const DATE_ALIASES = ['date', 'transaction date', 'trans date', 'posting date', 'post date', 'trans. date', 'cleared date'];
const DESCRIPTION_ALIASES = ['description', 'memo', 'details', 'name', 'merchant', 'payee', 'transaction description', 'original description'];
const AMOUNT_ALIASES = ['amount', 'debit', 'withdrawal', 'charge', 'transaction amount', 'amount (usd)', 'outflow'];
const MCC_ALIASES = ['mcc', 'mcc code', 'merchant category code', 'category code'];

// ─── Deduplication ──────────────────────────────────

/** Generate a stable hash key for a transaction (date + uppercase description + amount). */
export function transactionHash(txn: NormalizedTransaction): string {
  return `${txn.date}|${txn.description.toUpperCase()}|${txn.amount}`;
}

/** Remove duplicate transactions, keeping the first occurrence. */
export function deduplicateTransactions(
  transactions: NormalizedTransaction[],
): { unique: NormalizedTransaction[]; duplicateCount: number } {
  const seen = new Set<string>();
  const unique: NormalizedTransaction[] = [];
  let duplicateCount = 0;

  for (const txn of transactions) {
    const key = transactionHash(txn);
    if (seen.has(key)) {
      duplicateCount++;
    } else {
      seen.add(key);
      unique.push(txn);
    }
  }

  return { unique, duplicateCount };
}

// ─── Public API ─────────────────────────────────────

export function parseTransactionCSV(csvContent: string): ParseResult {
  const warnings: string[] = [];

  if (!csvContent) {
    return { transactions: [], warnings: ['No data rows found in CSV'], detectedFormat: 'empty' };
  }

  // Strip BOM if present
  const cleaned = csvContent.charCodeAt(0) === 0xFEFF ? csvContent.slice(1) : csvContent;

  const parsed = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const critical = parsed.errors.filter((e) => e.type !== 'FieldMismatch');
    if (critical.length > 0) {
      warnings.push(`CSV parsing: ${critical.length} error(s) encountered`);
    }
  }

  if (!parsed.data || parsed.data.length === 0) {
    return { transactions: [], warnings: ['No data rows found in CSV'], detectedFormat: 'empty' };
  }

  const headers = parsed.meta.fields || [];
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  // Try bank-specific detection first
  const signature = detectBankFormat(lowerHeaders);
  if (signature) {
    const raw = extractTransactions(parsed.data, signature, warnings);
    const { unique, duplicateCount } = deduplicateTransactions(raw);
    if (duplicateCount > 0) warnings.push(`Removed ${duplicateCount} duplicate transaction(s)`);
    return { transactions: unique, warnings, detectedFormat: signature.name };
  }

  // Fall back to generic column alias matching
  const generic = detectGenericFormat(headers, lowerHeaders);
  if (generic) {
    const raw = extractTransactions(parsed.data, generic, warnings);
    const { unique, duplicateCount } = deduplicateTransactions(raw);
    if (duplicateCount > 0) warnings.push(`Removed ${duplicateCount} duplicate transaction(s)`);
    return { transactions: unique, warnings, detectedFormat: 'Generic' };
  }

  return {
    transactions: [],
    warnings: ['Could not detect date, description, and amount columns. Please check your CSV format.'],
    detectedFormat: 'unknown',
  };
}

// ─── Bank Detection ─────────────────────────────────

function detectBankFormat(lowerHeaders: string[]): BankSignature | null {
  for (const sig of BANK_SIGNATURES) {
    const allMatch = sig.requiredHeaders.every((rh) => lowerHeaders.includes(rh));
    if (!allMatch) continue;

    // If signature has uniqueHeaders, at least one must be present to confirm
    if (sig.uniqueHeaders && sig.uniqueHeaders.length > 0) {
      const hasUnique = sig.uniqueHeaders.some((uh) => lowerHeaders.includes(uh));
      if (!hasUnique) continue;
    }

    return sig;
  }
  return null;
}

function detectGenericFormat(headers: string[], lowerHeaders: string[]): BankSignature | null {
  const dateCol = findAlias(headers, lowerHeaders, DATE_ALIASES);
  const descCol = findAlias(headers, lowerHeaders, DESCRIPTION_ALIASES);
  const amountCol = findAlias(headers, lowerHeaders, AMOUNT_ALIASES);
  const mccCol = findAlias(headers, lowerHeaders, MCC_ALIASES);

  if (!dateCol || !descCol || !amountCol) return null;

  return {
    name: 'Generic',
    requiredHeaders: [],
    dateColumn: dateCol,
    descriptionColumn: descCol,
    amountColumn: amountCol,
    mccColumn: mccCol ?? undefined,
    signConvention: 'negative_is_debit',
  };
}

function findAlias(headers: string[], lowerHeaders: string[], aliases: string[]): string | null {
  for (const alias of aliases) {
    const idx = lowerHeaders.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

// ─── Transaction Extraction ─────────────────────────

function extractTransactions(
  rows: Record<string, string>[],
  signature: BankSignature,
  warnings: string[],
): NormalizedTransaction[] {
  const transactions: NormalizedTransaction[] = [];
  let skippedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = getColumnValue(row, signature.dateColumn);
    const rawDesc = getColumnValue(row, signature.descriptionColumn);
    const rawAmount = getColumnValue(row, signature.amountColumn);
    const rawCredit = signature.creditColumn
      ? getColumnValue(row, signature.creditColumn)
      : '';

    if (!rawDate && !rawDesc && !rawAmount && !rawCredit) continue; // Fully empty row

    const date = parseDateString(rawDate);
    const description = sanitizeCellValue(rawDesc || '').trim();

    // For split debit/credit columns (e.g. Citi): use debit if present, else negate credit
    const debitAmount = parseCurrencyString(rawAmount);
    const creditAmount = parseCurrencyString(rawCredit);
    const amount = signature.creditColumn
      ? (debitAmount !== 0 ? debitAmount : -creditAmount)
      : debitAmount;

    // Skip only if description is missing AND amount is zero (truly empty row).
    // Rows with description but no date are kept with a placeholder date —
    // the merchant name is what matters for categorization.
    if (!description && amount === 0) {
      skippedCount++;
      continue;
    }
    if (!description) {
      skippedCount++;
      continue;
    }

    // Normalize to positive = expense convention
    const normalizedAmount = signature.signConvention === 'negative_is_debit'
      ? -amount   // Flip sign: -$50 (debit) → +50
      : amount;   // Already positive = debit

    // Extract and validate MCC code (must be exactly 4 digits)
    const rawMCC = signature.mccColumn
      ? getColumnValue(row, signature.mccColumn).trim()
      : undefined;
    const mccCode = rawMCC && /^\d{4}$/.test(rawMCC)
      ? rawMCC
      : extractMCCFromDescription(description);

    const txn: NormalizedTransaction = {
      date: date || '2025-01-01', // Placeholder for rows with missing date
      description,
      amount: normalizedAmount,
      originalRow: i + 2, // +2 for 1-indexed + header row
    };
    if (mccCode) txn.mccCode = mccCode;

    transactions.push(txn);
  }

  if (skippedCount > 0) {
    warnings.push(`Skipped ${skippedCount} row(s) with missing description`);
  }

  return transactions;
}

/** Case-insensitive column lookup. */
function getColumnValue(row: Record<string, string>, columnName: string): string {
  // Try exact match first
  if (row[columnName] !== undefined) return row[columnName];
  // Case-insensitive fallback
  const lower = columnName.toLowerCase();
  for (const [key, val] of Object.entries(row)) {
    if (key.toLowerCase() === lower) return val;
  }
  return '';
}

/** Strip leading formula characters to prevent CSV injection (OWASP).
 * Note: We intentionally keep hyphens (-) since they appear in legitimate
 * bank descriptions (e.g. "-AUTOPAY NAVIENT"). Hyphens are only dangerous
 * as formula prefixes when combined with = or +, which are already stripped.
 * We are *reading* CSVs, not *writing* them — injection is an output concern. */
function sanitizeCellValue(value: string): string {
  return value.replace(/^[=+@\t\r]+/, '');
}
