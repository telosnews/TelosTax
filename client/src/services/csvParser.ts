/**
 * CSV Parser — parses brokerage/crypto CSV exports into 1099-B and 1099-DA records.
 *
 * Supports auto-detection of Schwab, Fidelity, E*Trade, Robinhood, and Coinbase formats.
 * Falls back to generic column mapping via header alias matching.
 *
 * All parsing runs client-side. Data never leaves the browser.
 */

import Papa from 'papaparse';
import {
  parseCurrencyString,
  parseDateString,
  parseHoldingPeriod,
  inferHoldingPeriod,
  validateRequiredFields,
} from './importHelpers';

// ─── Types ─────────────────────────────────────────

export interface ColumnMapping {
  brokerName?: string;
  description?: string;
  dateAcquired?: string;
  dateSold?: string;
  proceeds?: string;
  costBasis?: string;
  holdingPeriod?: string;
  federalTaxWithheld?: string;
  washSaleLoss?: string;
  // 1099-DA specific
  tokenName?: string;
  tokenSymbol?: string;
  transactionId?: string;
}

export interface MappedRow {
  data: Record<string, unknown>;
  warnings: string[];
  errors: string[];
}

export interface CSVParseResult {
  detectedFormat: string;
  targetType: '1099b' | '1099da';
  headers: string[];
  rawRowCount: number;
  mappedRows: MappedRow[];
  mapping: ColumnMapping;
  validCount: number;
  warningCount: number;
  errorCount: number;
  skippedCount: number;
}

// ─── Broker Signatures ─────────────────────────────

interface BrokerSignature {
  required: string[];
  optional?: string[];
  mapping: ColumnMapping;
}

// Order matters: more specific signatures first, generic-looking ones last.
const BROKER_SIGNATURES: [string, BrokerSignature][] = [
  // Coinbase — very distinctive headers
  ['coinbase', {
    required: ['asset', 'transaction type', 'subtotal'],
    mapping: {
      tokenName: 'Asset',
      dateSold: 'Timestamp',
      proceeds: 'Subtotal',
      costBasis: 'Cost Basis',
      transactionId: 'Transaction ID',
    },
  }],
  // E*Trade — unique "gross proceeds" and "adjusted cost basis"
  ['etrade', {
    required: ['gross proceeds', 'adjusted cost basis'],
    mapping: {
      description: 'Symbol',
      dateAcquired: 'Date Acquired',
      dateSold: 'Date Sold',
      proceeds: 'Gross Proceeds',
      costBasis: 'Adjusted Cost Basis',
      holdingPeriod: 'Term',
    },
  }],
  // Robinhood — unique "asset name" and "holding period"
  ['robinhood', {
    required: ['asset name', 'holding period'],
    mapping: {
      description: 'Asset Name',
      dateAcquired: 'Date Acquired',
      dateSold: 'Date Sold',
      proceeds: 'Proceeds',
      costBasis: 'Cost Basis',
      holdingPeriod: 'Holding Period',
    },
  }],
  // Fidelity — requires "symbol" + "quantity" combo (unique)
  ['fidelity', {
    required: ['symbol', 'quantity', 'proceeds'],
    mapping: {
      description: 'Symbol',
      dateAcquired: 'Date Acquired',
      dateSold: 'Date Sold',
      proceeds: 'Proceeds',
      costBasis: 'Cost Basis',
      holdingPeriod: 'Term',
    },
  }],
  // Schwab — requires "wash sale loss disallowed" (Schwab-specific column)
  ['schwab', {
    required: ['wash sale loss disallowed', 'proceeds', 'cost basis'],
    mapping: {
      description: 'Description',
      dateAcquired: 'Date Acquired',
      dateSold: 'Date Sold',
      proceeds: 'Proceeds',
      costBasis: 'Cost Basis',
      washSaleLoss: 'Wash Sale Loss Disallowed',
      holdingPeriod: 'Term',
    },
  }],
];

// ─── Header Alias Mapping ──────────────────────────

const HEADER_ALIASES: Record<keyof ColumnMapping, string[]> = {
  proceeds: ['proceeds', 'sale price', 'sales price', 'gross proceeds', 'total proceeds', 'amount sold', 'subtotal', 'sale amount'],
  costBasis: ['cost basis', 'cost or other basis', 'basis', 'purchase price', 'cost', 'adjusted cost basis', 'original cost'],
  dateAcquired: ['date acquired', 'acquisition date', 'buy date', 'purchase date', 'open date', 'acquired'],
  dateSold: ['date sold', 'sale date', 'sell date', 'disposition date', 'close date', 'sold', 'date of sale', 'timestamp'],
  description: ['description', 'security', 'symbol', 'asset', 'name', 'ticker', 'security name', 'asset name', 'stock'],
  holdingPeriod: ['holding period', 'term', 'long term', 'short term', 'type', 'duration', 'hold period'],
  brokerName: ['broker', 'broker name', 'firm', 'institution', 'source'],
  federalTaxWithheld: ['federal tax withheld', 'tax withheld', 'federal withholding', 'fed tax', 'withholding'],
  washSaleLoss: ['wash sale', 'wash sale loss', 'wash sale loss disallowed', 'wash sale adjustment', 'disallowed loss'],
  tokenName: ['token', 'token name', 'coin', 'cryptocurrency', 'crypto', 'digital asset', 'asset'],
  tokenSymbol: ['symbol', 'token symbol', 'ticker', 'coin symbol'],
  transactionId: ['transaction id', 'tx id', 'hash', 'transaction hash', 'txid', 'tx hash'],
};

// ─── Public API ────────────────────────────────────

/**
 * Detect which brokerage format a CSV uses based on its headers.
 */
export function detectBrokerFormat(headers: string[]): { format: string; mapping: ColumnMapping } {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  for (const [name, sig] of BROKER_SIGNATURES) {
    const allMatch = sig.required.every(req =>
      lowerHeaders.some(h => h.includes(req)),
    );
    if (allMatch) {
      // Remap the signature mapping to actual header names (case-matched)
      const resolvedMapping: ColumnMapping = {};
      for (const [field, sigHeader] of Object.entries(sig.mapping)) {
        const actualHeader = headers.find(h =>
          h.toLowerCase().trim() === (sigHeader as string).toLowerCase().trim() ||
          h.toLowerCase().trim().includes((sigHeader as string).toLowerCase().trim()),
        );
        if (actualHeader) {
          (resolvedMapping as Record<string, string>)[field] = actualHeader;
        }
      }
      return { format: name, mapping: resolvedMapping };
    }
  }

  return { format: 'generic', mapping: autoDetectColumnMapping(headers) };
}

/**
 * Auto-detect column mapping from CSV headers using alias matching.
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const header of headers) {
      const lower = header.toLowerCase().trim();
      if (aliases.some(alias => lower === alias || lower.includes(alias))) {
        // Don't overwrite if already mapped (first match wins)
        if (!(field in mapping)) {
          (mapping as Record<string, string>)[field] = header;
        }
        break;
      }
    }
  }

  return mapping;
}

/**
 * Parse a CSV string and map rows to 1099-B or 1099-DA income items.
 */
export function parseCSV(
  fileContent: string,
  targetType: '1099b' | '1099da',
  brokerNameOverride?: string,
): CSVParseResult {
  // Parse with PapaParse
  const parsed = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  const headers = parsed.meta.fields || [];
  const { format, mapping } = detectBrokerFormat(headers);

  const mappedRows: MappedRow[] = [];
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const row of parsed.data) {
    const result = targetType === '1099da'
      ? mapRowToIncome1099DA(row, mapping, brokerNameOverride || getValueFromRow(row, mapping.brokerName) || format)
      : mapRowToIncome1099B(row, mapping, brokerNameOverride || getValueFromRow(row, mapping.brokerName) || format);

    mappedRows.push(result);

    if (result.errors.length > 0) {
      errorCount++;
      skippedCount++;
    } else if (result.warnings.length > 0) {
      warningCount++;
      validCount++;
    } else {
      validCount++;
    }
  }

  return {
    detectedFormat: format,
    targetType,
    headers,
    rawRowCount: parsed.data.length,
    mappedRows,
    mapping,
    validCount,
    warningCount,
    errorCount,
    skippedCount,
  };
}

/**
 * Map a single CSV row to an Income1099B record.
 */
export function mapRowToIncome1099B(
  row: Record<string, string>,
  mapping: ColumnMapping,
  brokerName: string,
): MappedRow {
  const warnings: string[] = [];
  const errors: string[] = [];

  const proceeds = parseCurrencyString(getValueFromRow(row, mapping.proceeds));
  const costBasis = parseCurrencyString(getValueFromRow(row, mapping.costBasis));
  const dateAcquired = parseDateString(getValueFromRow(row, mapping.dateAcquired));
  const dateSold = parseDateString(getValueFromRow(row, mapping.dateSold));
  const description = getValueFromRow(row, mapping.description) || '';
  const washSaleLoss = parseCurrencyString(getValueFromRow(row, mapping.washSaleLoss));
  const fedWithheld = parseCurrencyString(getValueFromRow(row, mapping.federalTaxWithheld));

  // Determine holding period
  const holdingPeriodRaw = getValueFromRow(row, mapping.holdingPeriod);
  let isLongTerm = parseHoldingPeriod(holdingPeriodRaw);
  if (isLongTerm === null) {
    isLongTerm = inferHoldingPeriod(dateAcquired, dateSold);
    if (!dateAcquired) {
      warnings.push('No acquisition date — defaulting to short-term');
    }
  }

  // Validate
  if (proceeds === 0 && costBasis === 0) {
    errors.push('Both proceeds and cost basis are zero or missing');
  }
  if (!dateSold && !dateAcquired && proceeds === 0) {
    errors.push('Row appears to be empty — no dates, proceeds, or basis found');
  }
  if (!dateSold) {
    warnings.push('No sale date found');
  }
  if (proceeds < 0) {
    warnings.push('Negative proceeds — verify this is correct');
  }

  const data: Record<string, unknown> = {
    brokerName,
    description,
    dateAcquired: dateAcquired || '',
    dateSold: dateSold || '',
    proceeds,
    costBasis,
    isLongTerm,
    ...(fedWithheld ? { federalTaxWithheld: fedWithheld } : {}),
    ...(washSaleLoss ? { washSaleLossDisallowed: washSaleLoss } : {}),
    basisReportedToIRS: true,
  };

  return { data, warnings, errors };
}

/**
 * Map a single CSV row to an Income1099DA record.
 */
export function mapRowToIncome1099DA(
  row: Record<string, string>,
  mapping: ColumnMapping,
  brokerName: string,
): MappedRow {
  const warnings: string[] = [];
  const errors: string[] = [];

  const proceeds = parseCurrencyString(getValueFromRow(row, mapping.proceeds));
  const costBasis = parseCurrencyString(getValueFromRow(row, mapping.costBasis));
  const dateAcquired = parseDateString(getValueFromRow(row, mapping.dateAcquired));
  const dateSold = parseDateString(getValueFromRow(row, mapping.dateSold));
  const tokenName = getValueFromRow(row, mapping.tokenName) || getValueFromRow(row, mapping.description) || '';
  const tokenSymbol = getValueFromRow(row, mapping.tokenSymbol) || '';
  const description = getValueFromRow(row, mapping.description) || tokenName;
  const transactionId = getValueFromRow(row, mapping.transactionId) || '';
  const washSaleLoss = parseCurrencyString(getValueFromRow(row, mapping.washSaleLoss));
  const fedWithheld = parseCurrencyString(getValueFromRow(row, mapping.federalTaxWithheld));

  // Determine holding period
  const holdingPeriodRaw = getValueFromRow(row, mapping.holdingPeriod);
  let isLongTerm = parseHoldingPeriod(holdingPeriodRaw);
  if (isLongTerm === null) {
    isLongTerm = inferHoldingPeriod(dateAcquired, dateSold);
  }

  // Validate
  if (!tokenName && !description) {
    errors.push('No token name or description found');
  }
  if (proceeds === 0 && costBasis === 0) {
    errors.push('Both proceeds and cost basis are zero or missing');
  }
  if (!dateSold) {
    warnings.push('No sale date found');
  }

  const data: Record<string, unknown> = {
    brokerName,
    tokenName,
    tokenSymbol,
    description,
    dateAcquired: dateAcquired || '',
    dateSold: dateSold || '',
    proceeds,
    costBasis,
    isLongTerm,
    ...(fedWithheld ? { federalTaxWithheld: fedWithheld } : {}),
    ...(washSaleLoss ? { washSaleLossDisallowed: washSaleLoss } : {}),
    ...(transactionId ? { transactionId } : {}),
    isBasisReportedToIRS: true,
  };

  return { data, warnings, errors };
}

// ─── Helpers ───────────────────────────────────────

/** Strip leading formula characters to prevent CSV formula injection (OWASP). */
function sanitizeCellValue(value: string): string {
  return value.replace(/^[=+\-@\t\r]+/, '');
}

function getValueFromRow(
  row: Record<string, string>,
  columnName: string | undefined,
): string {
  if (!columnName) return '';
  // Try exact match first, then case-insensitive
  let raw = '';
  if (row[columnName] !== undefined) {
    raw = row[columnName];
  } else {
    const lower = columnName.toLowerCase();
    for (const [key, val] of Object.entries(row)) {
      if (key.toLowerCase() === lower) { raw = val; break; }
    }
  }
  return sanitizeCellValue(raw);
}
