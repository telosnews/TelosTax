/**
 * TXF Parser — parses Tax Exchange Format (TXF) v042 files into income records.
 *
 * TXF is a text-based format from Intuit (~1991) used by brokerages like
 * Fidelity, Schwab, E*Trade, and Interactive Brokers for exporting tax data.
 *
 * Reference: TXF v042 specification (Intuit, last updated 2011-11-30).
 *
 * Key concepts:
 * - Each record starts with T (type), N (ref code), and ends with ^
 * - Records use numbered formats (0-6) that define field order
 * - Format 4: P, D, D, $, $ (security, date acquired, date sold, cost basis, proceeds)
 * - Format 5: Format 4 + $ (wash sale amount)
 * - Format 3: $, P (amount + description/payer)
 * - Format 1: $ (amount only)
 * - W-2 fields come as separate records keyed by ref code (460=salary, 461=fed withheld, etc.)
 *   and must be grouped by copy number to reconstruct a single W-2
 *
 * All parsing runs client-side. Data never leaves the browser.
 */

import {
  parseCurrencyString,
  parseDateString,
} from './importHelpers';

// ─── Types ─────────────────────────────────────────

export interface TXFHeader {
  version: string;
  programName?: string;
  exportDate?: string;
}

export interface TXFRecord {
  /** D = detail, S = summary (default) */
  recordType: 'D' | 'S';
  /** Reference code (e.g. 321 = short-term gain Copy A) */
  refCode: number;
  /** Copy number (C line), default 1 */
  copyNumber: number;
  /** Line number (L line), default 1 */
  lineNumber: number;
  /** Description / payee / security name (P line) */
  description: string;
  /** Dates in order of appearance (D lines, parsed to YYYY-MM-DD) */
  dates: string[];
  /** Dollar amounts in order of appearance ($ lines) */
  amounts: number[];
  /** Extra detail text (X lines) */
  extraText: string[];
}

/** A parsed and mapped income item ready for import */
export interface TXFMappedItem {
  incomeType: string;
  label: string;
  data: Record<string, unknown>;
  warnings: string[];
  errors: string[];
}

export interface TXFParseResult {
  header: TXFHeader;
  /** Records grouped by income type for preview */
  groupedByType: Record<string, {
    incomeType: string;
    label: string;
    count: number;
    items: TXFMappedItem[];
  }>;
  totalRecords: number;
  validCount: number;
  errorCount: number;
  skippedCount: number;
  errors: string[];
  warnings: string[];
}

// ─── Reference Code Definitions (TXF v042 spec) ───
//
// Format 1: $ (amount only)
// Format 3: $, P (amount + payer/description)
// Format 4: P, D, D, $, $ (security, date acquired, date sold, cost basis, proceeds)
// Format 5: P, D, D, $, $, $ (Format 4 + wash sale disallowed amount)
//
// Capital gains codes map to Form 8949 "Copy" variants:
//   Copy A = basis reported to IRS (Box A/D)
//   Copy B = basis NOT reported to IRS (Box B/E)
//   Copy C = Form 1099-B not received (Box C/F)

interface RefCodeDef {
  /** Which income type this maps to in TelosTax */
  incomeType: string;
  /** Human-readable label for the ref code */
  label: string;
  /** TXF format number (1, 3, 4, 5) */
  format: number;
  /** Optional: sub-field within a grouped record (e.g. 'wages', 'fedWithheld' for W-2) */
  subField?: string;
}

const REF_CODES: Record<number, RefCodeDef> = {
  // ── Schedule D / Form 8949: Capital Gains (Format 4 or 5) ──
  321: { incomeType: '1099b', label: 'ST gain/loss, Copy A (basis reported)', format: 4, subField: 'st-a' },
  323: { incomeType: '1099b', label: 'LT gain/loss, Copy A (basis reported)', format: 4, subField: 'lt-a' },
  324: { incomeType: '1099b', label: '28% rate gain (collectibles), Copy A', format: 4, subField: 'lt-a' },
  673: { incomeType: '1099b', label: 'Unknown holding period, Copy A', format: 4 },
  711: { incomeType: '1099b', label: 'ST gain/loss, Copy B (basis NOT reported)', format: 4, subField: 'st-b' },
  712: { incomeType: '1099b', label: 'ST gain/loss, Copy C (no 1099-B)', format: 4, subField: 'st-c' },
  713: { incomeType: '1099b', label: 'LT gain/loss, Copy B (basis NOT reported)', format: 4, subField: 'lt-b' },
  714: { incomeType: '1099b', label: 'LT gain/loss, Copy C (no 1099-B)', format: 4, subField: 'lt-c' },
  715: { incomeType: '1099b', label: 'Unknown holding period, Copy B', format: 4 },
  716: { incomeType: '1099b', label: 'Unknown holding period, Copy C', format: 4 },
  717: { incomeType: '1099b', label: '28% rate gain (collectibles), Copy B', format: 4, subField: 'lt-b' },
  682: { incomeType: '1099b', label: 'Wash sale, Copy A', format: 5 },
  718: { incomeType: '1099b', label: 'Wash sale, Copy B', format: 5 },
  719: { incomeType: '1099b', label: 'Wash sale, Copy C', format: 5 },

  // ── W-2: Each box is a separate record (Format 1) ──
  // Taxpayer
  460: { incomeType: 'w2', label: 'Wages (Box 1)', format: 1, subField: 'wages' },
  461: { incomeType: 'w2', label: 'Federal withholding (Box 2)', format: 1, subField: 'federalTaxWithheld' },
  462: { incomeType: 'w2', label: 'Social Security tax (Box 4)', format: 1, subField: 'socialSecurityTax' },
  463: { incomeType: 'w2', label: 'Social Security wages (Box 3)', format: 1, subField: 'socialSecurityWages' },
  464: { incomeType: 'w2', label: 'State withholding (Box 17)', format: 1, subField: 'stateTaxWithheld' },
  465: { incomeType: 'w2', label: 'State wages (Box 16)', format: 1, subField: 'stateWages' },
  480: { incomeType: 'w2', label: 'Medicare tax (Box 6)', format: 1, subField: 'medicareTax' },
  // Spouse
  506: { incomeType: 'w2-spouse', label: 'Wages, spouse (Box 1)', format: 1, subField: 'wages' },
  507: { incomeType: 'w2-spouse', label: 'Federal withholding, spouse (Box 2)', format: 1, subField: 'federalTaxWithheld' },
  508: { incomeType: 'w2-spouse', label: 'Social Security tax, spouse (Box 4)', format: 1, subField: 'socialSecurityTax' },
  510: { incomeType: 'w2-spouse', label: 'Medicare tax, spouse (Box 6)', format: 1, subField: 'medicareTax' },
  511: { incomeType: 'w2-spouse', label: 'State withholding, spouse (Box 17)', format: 1, subField: 'stateTaxWithheld' },

  // ── 1099-INT: Interest (Format 3 — $, P) ──
  287: { incomeType: '1099int', label: 'Interest income (Box 1)', format: 3, subField: 'amount' },
  288: { incomeType: '1099int-sub', label: 'U.S. government interest (Box 3)', format: 3, subField: 'usBondInterest' },
  289: { incomeType: '1099int-sub', label: 'Tax-exempt interest (Box 8)', format: 3, subField: 'taxExemptInterest' },
  616: { incomeType: '1099int-sub', label: 'Federal withholding on interest (Box 4)', format: 3, subField: 'federalTaxWithheld' },

  // ── 1099-DIV: Dividends (Format 3 — $, P) ──
  286: { incomeType: '1099div', label: 'Ordinary dividends (Box 1a)', format: 3, subField: 'ordinaryDividends' },
  683: { incomeType: '1099div-sub', label: 'Qualified dividends (Box 1b)', format: 3, subField: 'qualifiedDividends' },
  487: { incomeType: '1099div-sub', label: 'Nontaxable distributions (Box 3)', format: 3 },
  488: { incomeType: '1099div-sub', label: 'Capital gain distributions (Box 2a)', format: 3, subField: 'capitalGainDistributions' },
  485: { incomeType: '1099div-sub', label: 'Foreign tax paid (Box 7)', format: 3, subField: 'foreignTaxPaid' },
  615: { incomeType: '1099div-sub', label: 'Federal withholding on dividends (Box 4)', format: 3, subField: 'federalTaxWithheld' },

  // ── 1099-R: Retirement Distributions (Format 1) ──
  // Pension
  475: { incomeType: '1099r', label: 'Pension gross distribution (Box 1)', format: 1, subField: 'grossDistribution' },
  476: { incomeType: '1099r-sub', label: 'Pension taxable amount (Box 2a)', format: 1, subField: 'taxableAmount' },
  529: { incomeType: '1099r-sub', label: 'Pension federal withholding (Box 4)', format: 1, subField: 'federalTaxWithheld' },
  // IRA
  477: { incomeType: '1099r-ira', label: 'IRA gross distribution (Box 1)', format: 1, subField: 'grossDistribution' },
  478: { incomeType: '1099r-ira-sub', label: 'IRA taxable amount (Box 2a)', format: 1, subField: 'taxableAmount' },
  532: { incomeType: '1099r-ira-sub', label: 'IRA federal withholding (Box 4)', format: 1, subField: 'federalTaxWithheld' },
};

// ─── Public API ────────────────────────────────────

/**
 * Parse a TXF file string into grouped income records.
 */
const MAX_WARNINGS = 500;

export function parseTXF(fileContent: string): TXFParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const lines = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  if (lines.length < 2) {
    return emptyResult('File is empty or too short to be a valid TXF file.', errors);
  }

  // Parse header
  const header = parseHeader(lines);
  if (!header) {
    return emptyResult('Not a valid TXF file — missing version header (expected V042 or similar).', errors);
  }

  // Parse raw records
  const records = parseRecords(lines, warnings);

  if (records.length === 0) {
    return emptyResult('No tax records found in this TXF file.', errors);
  }

  // Map records to income items
  // Capital gains (Format 4/5): each record is a complete transaction
  // W-2 / 1099-R: multiple records must be grouped by copy number
  // 1099-INT / 1099-DIV: primary record + sub-records grouped by payer

  const capitalGainItems = mapCapitalGainRecords(records, warnings);
  const w2Items = mapW2Records(records, warnings);
  const intItems = mapInterestRecords(records, warnings);
  const divItems = mapDividendRecords(records, warnings);
  const retItems = mapRetirementRecords(records, warnings);

  // Build grouped result
  const groupedByType: TXFParseResult['groupedByType'] = {};
  let validCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  const allItems: Array<{ type: string; items: TXFMappedItem[] }> = [
    { type: '1099b', items: capitalGainItems },
    { type: 'w2', items: w2Items },
    { type: '1099int', items: intItems },
    { type: '1099div', items: divItems },
    { type: '1099r', items: retItems },
  ];

  for (const { type, items } of allItems) {
    if (items.length === 0) continue;

    groupedByType[type] = {
      incomeType: type,
      label: incomeTypeLabel(type),
      count: items.length,
      items,
    };

    for (const item of items) {
      if (item.errors.length > 0) {
        errorCount++;
        skippedCount++;
      } else {
        validCount++;
      }
    }
  }

  // Count skipped records (unknown ref codes)
  const knownCodes = new Set(Object.keys(REF_CODES).map(Number));
  const unknownRecords = records.filter(r => r.recordType === 'S' && !knownCodes.has(r.refCode));
  if (unknownRecords.length > 0) {
    const uniqueCodes = [...new Set(unknownRecords.map(r => r.refCode))];
    if (warnings.length < MAX_WARNINGS) {
      warnings.push(`Skipped ${unknownRecords.length} record(s) with unsupported ref codes: ${uniqueCodes.join(', ')}`);
    }
    skippedCount += unknownRecords.length;
  }

  if (warnings.length >= MAX_WARNINGS) {
    warnings.push(`Warning limit reached (${MAX_WARNINGS}). Additional warnings suppressed.`);
  }

  return {
    header,
    groupedByType,
    totalRecords: records.length,
    validCount,
    errorCount,
    skippedCount,
    errors,
    warnings,
  };
}

// ─── Header Parsing ────────────────────────────────

function parseHeader(lines: string[]): TXFHeader | null {
  let versionLine = '';
  let programName: string | undefined;
  let exportDate: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Version line: V042, V041, etc.
    if (trimmed.match(/^V0\d{2}$/i) && !versionLine) {
      versionLine = trimmed.toUpperCase();
      continue;
    }

    // A line: program name (before first record)
    if (trimmed.startsWith('A') && !programName) {
      programName = trimmed.slice(1).trim() || undefined;
      continue;
    }

    // D line in header: export date (before first record)
    if (trimmed.startsWith('D') && !exportDate) {
      const dateStr = trimmed.slice(1).trim();
      if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
        exportDate = dateStr;
      }
      continue;
    }

    // Stop at first record
    if (trimmed === 'TD' || trimmed === 'TS') break;
  }

  if (!versionLine) return null;

  return { version: versionLine, programName, exportDate };
}

// ─── Record Parsing ────────────────────────────────

function parseRecords(lines: string[], warnings: string[]): TXFRecord[] {
  const records: TXFRecord[] = [];
  let current: TXFRecord | null = null;
  let inHeader = true;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Record type start: TD (detail) or TS (summary)
    if (line === 'TD' || line === 'TS') {
      inHeader = false;
      if (current) {
        records.push(current);
      }
      current = {
        recordType: line === 'TD' ? 'D' : 'S',
        refCode: 0,
        copyNumber: 1,
        lineNumber: 1,
        description: '',
        dates: [],
        amounts: [],
        extraText: [],
      };
      continue;
    }

    // Record delimiter — finalize current record
    if (line === '^') {
      if (current) {
        records.push(current);
        current = null;
      }
      continue;
    }

    // Skip header lines before first record
    if (inHeader) continue;

    // Only process lines within a record
    if (!current) continue;

    // N — reference code
    if (line.startsWith('N')) {
      const code = parseInt(line.slice(1).trim(), 10);
      if (!isNaN(code)) {
        current.refCode = code;
      }
      continue;
    }

    // C — copy number
    if (line.startsWith('C') && line.length <= 4) {
      const copy = parseInt(line.slice(1).trim(), 10);
      if (!isNaN(copy) && copy >= 1 && copy <= 255) {
        current.copyNumber = copy;
      }
      continue;
    }

    // L — line number
    if (line.startsWith('L') && line.length <= 4) {
      const lineNum = parseInt(line.slice(1).trim(), 10);
      if (!isNaN(lineNum)) {
        current.lineNumber = lineNum;
      }
      continue;
    }

    // P — payee / description
    if (line.startsWith('P')) {
      current.description = line.slice(1).trim();
      continue;
    }

    // D — date (MM/DD/YYYY)
    if (line.startsWith('D')) {
      const dateStr = line.slice(1).trim();
      // "Various" / "Multiple" = mutual fund lots acquired over time
      if (/^(various|multiple)$/i.test(dateStr)) {
        current.dates.push('VARIOUS');
        continue;
      }
      const parsed = parseDateString(dateStr);
      if (parsed) {
        current.dates.push(parsed);
      } else if (dateStr && warnings.length < MAX_WARNINGS) {
        warnings.push(`Could not parse date: "${dateStr}"`);
      }
      continue;
    }

    // $ — dollar amount
    if (line.startsWith('$')) {
      const amountStr = line.slice(1).trim();
      const amount = parseCurrencyString(amountStr);
      current.amounts.push(amount);
      continue;
    }

    // X — extra detail text
    if (line.startsWith('X')) {
      current.extraText.push(line.slice(1).trim());
      continue;
    }
  }

  // Don't forget last record if file doesn't end with ^
  if (current) {
    records.push(current);
  }

  return records;
}

// ─── Capital Gains Mapper (Format 4/5) ─────────────

/**
 * Map capital gain records (ref codes 321, 323, 673, 682, 711-718).
 * Each record is a complete transaction in Format 4 or 5:
 *   P = security name, D = date acquired, D = date sold,
 *   $ = cost basis, $ = proceeds, [$ = wash sale amount]
 */
function mapCapitalGainRecords(records: TXFRecord[], warnings: string[]): TXFMappedItem[] {
  const items: TXFMappedItem[] = [];

  const capGainCodes = new Set([321, 323, 324, 673, 682, 711, 712, 713, 714, 715, 716, 717, 718, 719]);

  // Only process summary records (detail records are informational)
  for (const record of records) {
    if (record.recordType === 'D') continue;
    if (!capGainCodes.has(record.refCode)) continue;

    const def = REF_CODES[record.refCode];
    if (!def) continue;

    const itemWarnings: string[] = [];
    const itemErrors: string[] = [];

    const description = record.description || 'Unknown security';

    // Format 4: P, D, D, $, $
    // Dates: first = date acquired, second = date sold
    // "VARIOUS" sentinel = mutual fund lots acquired over time → treat as empty
    const rawDateAcquired = record.dates[0] || '';
    const dateAcquired = rawDateAcquired === 'VARIOUS' ? '' : rawDateAcquired;
    const dateSold = record.dates[1] === 'VARIOUS' ? '' : (record.dates[1] || '');

    // Amounts: first = cost basis, second = net proceeds (per TXF v042 spec)
    // NOTE: Older Quicken versions reversed this order. We follow the v042 spec
    // but add a heuristic warning when the values look suspicious.
    let costBasis = 0;
    let proceeds = 0;
    let washSaleAmount: number | undefined;

    if (record.amounts.length >= 2) {
      costBasis = record.amounts[0];
      proceeds = record.amounts[1];

      // Heuristic: flag suspicious patterns that may indicate reversed field order.
      // A negative cost basis with positive proceeds is highly unusual and may
      // indicate the exporter put proceeds first (historical Quicken behavior).
      if (costBasis < 0 && proceeds >= 0) {
        itemWarnings.push('Cost basis is negative — verify cost basis and proceeds are not swapped');
      }
    } else if (record.amounts.length === 1) {
      // Single amount — ambiguous. Treat as proceeds.
      proceeds = record.amounts[0];
      itemWarnings.push('Only one amount found — treated as proceeds with zero cost basis');
    } else {
      itemErrors.push('No dollar amounts found in this record');
    }

    // Format 5: third amount is wash sale loss disallowed
    if (record.amounts.length >= 3) {
      washSaleAmount = record.amounts[2];
    }
    // Wash sale codes (682, 718, 719) should have Format 5
    if ([682, 718, 719].includes(record.refCode) && !washSaleAmount && record.amounts.length < 3) {
      itemWarnings.push('Wash sale record missing wash sale disallowed amount');
    }

    // Determine holding period from ref code
    const isLongTerm = isLongTermCode(record.refCode);
    const basisReported = isBasisReportedCode(record.refCode);

    if (rawDateAcquired === 'VARIOUS') {
      itemWarnings.push('Acquisition date is "Various" — shares were acquired over multiple dates');
    }
    if (!dateSold) {
      itemWarnings.push('No sale date found');
    }

    const data: Record<string, unknown> = {
      brokerName: 'TXF Import',
      description,
      dateAcquired,
      dateSold,
      proceeds,
      costBasis,
      isLongTerm,
      basisReportedToIRS: basisReported,
    };

    if (washSaleAmount && washSaleAmount !== 0) {
      data.washSaleLossDisallowed = Math.abs(washSaleAmount);
    }

    items.push({
      incomeType: '1099b',
      label: description,
      data,
      warnings: itemWarnings,
      errors: itemErrors,
    });
  }

  return items;
}

function isLongTermCode(code: number): boolean {
  // 323 = LT Copy A, 324 = 28% rate (collectibles), 713 = LT Copy B, 714 = LT Copy C, 717 = 28% rate Copy B
  return [323, 324, 713, 714, 717].includes(code);
}

function isBasisReportedCode(code: number): boolean {
  // Copy A = basis reported to IRS
  return [321, 323, 324, 673, 682].includes(code);
}

// ─── W-2 Mapper (Format 1, grouped by copy number) ──

/**
 * Map W-2 records. Each W-2 box is a separate TXF record (Format 1).
 * Records with the same copy number belong to the same W-2.
 * Codes 460-480 = taxpayer, 506-511 = spouse.
 */
function mapW2Records(records: TXFRecord[], warnings: string[]): TXFMappedItem[] {
  const w2Codes = new Set([460, 461, 462, 463, 464, 465, 480, 506, 507, 508, 510, 511]);

  // Group summary records by copy number
  const groups = new Map<string, TXFRecord[]>();

  for (const record of records) {
    if (record.recordType === 'D') continue;
    if (!w2Codes.has(record.refCode)) continue;

    const def = REF_CODES[record.refCode];
    if (!def) continue;

    // Group key: income type + copy number (to separate taxpayer vs spouse W-2s)
    const baseType = def.incomeType.replace('-spouse', '');
    const isSpouse = def.incomeType.includes('spouse');
    const groupKey = `${baseType}-${isSpouse ? 'spouse' : 'self'}-${record.copyNumber}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(record);
  }

  // Convert each group into a W-2 item
  const items: TXFMappedItem[] = [];

  for (const [groupKey, groupRecords] of groups) {
    const itemWarnings: string[] = [];
    const isSpouse = groupKey.includes('-spouse-');
    const data: Record<string, unknown> = {};
    let employerName = '';

    for (const record of groupRecords) {
      const def = REF_CODES[record.refCode];
      if (!def?.subField) continue;

      const amount = record.amounts[0] ?? 0;
      data[def.subField] = amount;

      // Use description from wages record as employer name
      if (def.subField === 'wages' && record.description) {
        employerName = record.description;
      }
    }

    if (!employerName) {
      // Try to find employer name from any record in the group
      const withDesc = groupRecords.find(r => r.description);
      employerName = withDesc?.description || 'Unknown employer';
    }

    data.employerName = employerName;

    if (isSpouse) {
      data.forSpouse = true;
    }

    if (!data.wages || data.wages === 0) {
      itemWarnings.push('Wages amount is zero or missing');
    }

    items.push({
      incomeType: 'w2',
      label: isSpouse ? `${employerName} (Spouse)` : employerName,
      data,
      warnings: itemWarnings,
      errors: [],
    });
  }

  return items;
}

// ─── 1099-INT Mapper (Format 3, grouped by copy number + payer) ──

/**
 * Map 1099-INT records. Primary record is code 287 (Format 3: $, P).
 * Sub-records (288, 289, 616) may provide additional fields for the same payer.
 * Groups by composite key (copyNumber + normalizedPayer) to correctly handle
 * multiple accounts at the same institution.
 */
function mapInterestRecords(records: TXFRecord[], warnings: string[]): TXFMappedItem[] {
  const intCodes = new Set([287, 288, 289, 616]);

  // Composite key: copyNumber + normalized payer name
  const primaryMap = new Map<string, Record<string, unknown>>();
  const primaryWarnings = new Map<string, string[]>();

  for (const record of records) {
    if (record.recordType === 'D') continue;
    if (!intCodes.has(record.refCode)) continue;

    const def = REF_CODES[record.refCode];
    if (!def) continue;

    const amount = record.amounts[0] ?? 0;
    const payerName = record.description || 'Unknown payer';
    const groupKey = `${record.copyNumber}::${normalizePayerName(payerName)}`;

    if (record.refCode === 287) {
      // Primary record — create the item
      if (!primaryMap.has(groupKey)) {
        primaryMap.set(groupKey, {
          payerName,
          amount,
        });
        primaryWarnings.set(groupKey, []);
      } else {
        // Multiple 287 records for same payer/copy — add amounts
        const existing = primaryMap.get(groupKey)!;
        existing.amount = (existing.amount as number) + amount;
      }
    } else if (def.subField) {
      // Sub-record — attach to matching payer
      if (primaryMap.has(groupKey)) {
        primaryMap.get(groupKey)![def.subField] = amount;
      } else {
        // Sub-record without a matching primary — create a standalone
        primaryMap.set(groupKey, {
          payerName,
          amount: 0,
          [def.subField]: amount,
        });
        primaryWarnings.set(groupKey, ['Sub-record found without matching primary interest record']);
      }
    }
  }

  const items: TXFMappedItem[] = [];
  for (const [key, data] of primaryMap) {
    items.push({
      incomeType: '1099int',
      label: data.payerName as string,
      data,
      warnings: primaryWarnings.get(key) || [],
      errors: [],
    });
  }

  return items;
}

// ─── 1099-DIV Mapper (Format 3, grouped by copy number + payer) ──

/**
 * Map 1099-DIV records. Primary record is code 286 (Format 3: $, P).
 * Sub-records (683, 487, 488, 485, 615) provide qualified dividends, cap gains, etc.
 * Groups by composite key (copyNumber + normalizedPayer) to correctly handle
 * multiple accounts at the same institution.
 */
function mapDividendRecords(records: TXFRecord[], warnings: string[]): TXFMappedItem[] {
  const divCodes = new Set([286, 683, 487, 488, 485, 615]);

  const primaryMap = new Map<string, Record<string, unknown>>();
  const primaryWarnings = new Map<string, string[]>();

  for (const record of records) {
    if (record.recordType === 'D') continue;
    if (!divCodes.has(record.refCode)) continue;

    const def = REF_CODES[record.refCode];
    if (!def) continue;

    const amount = record.amounts[0] ?? 0;
    const payerName = record.description || 'Unknown payer';
    const groupKey = `${record.copyNumber}::${normalizePayerName(payerName)}`;

    if (record.refCode === 286) {
      if (!primaryMap.has(groupKey)) {
        primaryMap.set(groupKey, {
          payerName,
          ordinaryDividends: amount,
          qualifiedDividends: 0,
        });
        primaryWarnings.set(groupKey, []);
      } else {
        const existing = primaryMap.get(groupKey)!;
        existing.ordinaryDividends = (existing.ordinaryDividends as number) + amount;
      }
    } else if (def.subField) {
      if (primaryMap.has(groupKey)) {
        primaryMap.get(groupKey)![def.subField] = amount;
      } else {
        primaryMap.set(groupKey, {
          payerName,
          ordinaryDividends: 0,
          qualifiedDividends: 0,
          [def.subField]: amount,
        });
        primaryWarnings.set(groupKey, ['Sub-record found without matching primary dividend record']);
      }
    }
  }

  const items: TXFMappedItem[] = [];
  for (const [key, data] of primaryMap) {
    items.push({
      incomeType: '1099div',
      label: data.payerName as string,
      data,
      warnings: primaryWarnings.get(key) || [],
      errors: [],
    });
  }

  return items;
}

// ─── 1099-R Mapper (Format 1, grouped by copy number) ──

/**
 * Map 1099-R records. Each box is a separate record (Format 1).
 * Pension codes: 475 (gross), 476 (taxable), 529 (fed withheld).
 * IRA codes: 477 (gross), 478 (taxable), 532 (fed withheld).
 */
function mapRetirementRecords(records: TXFRecord[], warnings: string[]): TXFMappedItem[] {
  // Only include codes that are defined in REF_CODES — others (530, 531, 533, 534, 623, 624, 625)
  // are valid TXF spec codes but not yet mapped in TelosTax. They'll surface in the
  // "unsupported ref codes" warning instead of silently creating empty groups.
  const retCodes = new Set([475, 476, 529, 477, 478, 532]);

  // Group: pension vs IRA, by copy number
  const groups = new Map<string, { records: TXFRecord[]; isIRA: boolean }>();

  for (const record of records) {
    if (record.recordType === 'D') continue;
    if (!retCodes.has(record.refCode)) continue;

    const isIRA = [477, 478, 532].includes(record.refCode);
    const groupKey = `${isIRA ? 'ira' : 'pension'}-${record.copyNumber}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { records: [], isIRA });
    }
    groups.get(groupKey)!.records.push(record);
  }

  const items: TXFMappedItem[] = [];

  for (const [, group] of groups) {
    const itemWarnings: string[] = [];
    const data: Record<string, unknown> = {
      isIRA: group.isIRA,
    };
    let payerName = '';

    for (const record of group.records) {
      const def = REF_CODES[record.refCode];
      if (!def?.subField) continue;

      const amount = record.amounts[0] ?? 0;
      data[def.subField] = amount;

      if (record.description && !payerName) {
        payerName = record.description;
      }
    }

    if (!payerName) {
      payerName = group.isIRA ? 'IRA Distribution' : 'Pension Distribution';
    }

    data.payerName = payerName;

    // Default taxableAmount to grossDistribution if not provided
    if (data.grossDistribution && !data.taxableAmount) {
      data.taxableAmount = data.grossDistribution;
      itemWarnings.push('Taxable amount not specified — defaulting to gross distribution');
    }

    if (!data.grossDistribution || data.grossDistribution === 0) {
      itemWarnings.push('Distribution amount is zero or missing');
    }

    items.push({
      incomeType: '1099r',
      label: payerName,
      data,
      warnings: itemWarnings,
      errors: [],
    });
  }

  return items;
}

// ─── Helpers ───────────────────────────────────────

/**
 * Normalize a payer/institution name for grouping.
 * Mirrors the pattern in duplicateDetection.ts — lowercase, strip punctuation,
 * remove common suffixes (Inc, LLC, Corp, etc.), collapse whitespace.
 */
function normalizePayerName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[.,'"]/g, '')
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co|plc|lp|llp|na)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function incomeTypeLabel(type: string): string {
  switch (type) {
    case '1099b': return '1099-B Capital Gains/Losses';
    case 'w2': return 'W-2 Wages';
    case '1099int': return '1099-INT Interest';
    case '1099div': return '1099-DIV Dividends';
    case '1099r': return '1099-R Retirement Distributions';
    default: return type;
  }
}

function emptyResult(error: string, errors: string[]): TXFParseResult {
  errors.push(error);
  return {
    header: { version: '' },
    groupedByType: {},
    totalRecords: 0,
    validCount: 0,
    errorCount: 0,
    skippedCount: 0,
    errors,
    warnings: [],
  };
}
