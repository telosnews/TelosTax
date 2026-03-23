/**
 * FDX Parser — parses Financial Data Exchange (FDX) JSON files into income records.
 *
 * FDX is a modern JSON-based format (successor to OFX) used by financial institutions
 * for tax document exchange. Supports 55+ tax form types.
 *
 * Handles both FDX v5 (taxDataList array) and v6+ (TaxStatement with forms array).
 *
 * Reference: FDX API Specification v6.4.1 (taxdataexchange.org)
 *
 * All parsing runs client-side. Data never leaves the browser.
 */

import { parseDateString, inferHoldingPeriod } from './importHelpers';

// ─── Types ─────────────────────────────────────────

export interface FDXParseResult {
  /** FDX version detected (v5 or v6) */
  version: 'v5' | 'v6' | 'unknown';
  /** Tax year from the statement (if available) */
  taxYear?: number;
  /** Issuer name (if available) */
  issuerName?: string;
  /** Records grouped by income type for preview */
  groupedByType: Record<string, {
    incomeType: string;
    label: string;
    count: number;
    items: FDXMappedItem[];
  }>;
  totalForms: number;
  validCount: number;
  errorCount: number;
  skippedCount: number;
  errors: string[];
  warnings: string[];
}

export interface FDXMappedItem {
  incomeType: string;
  label: string;
  data: Record<string, unknown>;
  warnings: string[];
  errors: string[];
}

// ─── Supported Form Type Keys ──────────────────────
// These are the FDX TaxData property keys we can map to TelosTax income types.

interface FormMapper {
  incomeType: string;
  label: string;
  map: (form: Record<string, unknown>, warnings: string[]) => FDXMappedItem[];
}

const FORM_MAPPERS: Record<string, FormMapper> = {
  taxW2:       { incomeType: 'w2',       label: 'W-2 Wages',                    map: mapW2 },
  tax1099B:    { incomeType: '1099b',    label: '1099-B Capital Gains/Losses',  map: map1099B },
  tax1099Int:  { incomeType: '1099int',  label: '1099-INT Interest',            map: map1099Int },
  tax1099Div:  { incomeType: '1099div',  label: '1099-DIV Dividends',           map: map1099Div },
  tax1099R:    { incomeType: '1099r',    label: '1099-R Retirement',            map: map1099R },
  tax1099Nec:  { incomeType: '1099nec',  label: '1099-NEC Nonemployee Comp',    map: map1099Nec },
  tax1099Misc: { incomeType: '1099misc', label: '1099-MISC Miscellaneous',      map: map1099Misc },
  tax1099G:    { incomeType: '1099g',    label: '1099-G Government Payments',   map: map1099G },
  tax1099K:    { incomeType: '1099k',    label: '1099-K Payment Card/Network',  map: map1099K },
  tax1099Sa:   { incomeType: '1099sa',   label: '1099-SA HSA/MSA Distributions', map: map1099Sa },
  tax1099Q:    { incomeType: '1099q',    label: '1099-Q Education Payments',    map: map1099Q },
};

const MAX_WARNINGS = 500;

// ─── Public API ────────────────────────────────────

/**
 * Parse an FDX JSON file into grouped income records.
 */
export function parseFDX(jsonInput: unknown): FDXParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (jsonInput === null || jsonInput === undefined) {
    return emptyResult('File is empty or contains no data.', errors, warnings);
  }

  if (typeof jsonInput !== 'object') {
    return emptyResult('Invalid FDX file — expected a JSON object.', errors, warnings);
  }

  const root = jsonInput as Record<string, unknown>;

  // Detect version and extract forms array
  const { forms, version, taxYear, issuerName } = extractForms(root, errors);

  if (forms.length === 0 && errors.length > 0) {
    return emptyResult(errors[0], errors, warnings);
  }

  if (forms.length === 0) {
    return emptyResult('No tax forms found in this FDX file.', errors, warnings);
  }

  // Map each form to income items
  const groupedByType: FDXParseResult['groupedByType'] = {};
  let validCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const formData of forms) {
    if (typeof formData !== 'object' || formData === null) {
      skippedCount++;
      continue;
    }

    const formObj = formData as Record<string, unknown>;

    // Find which form key is present (taxW2, tax1099B, etc.)
    let matched = false;
    for (const [key, mapper] of Object.entries(FORM_MAPPERS)) {
      if (formObj[key] !== undefined && formObj[key] !== null) {
        matched = true;
        const rawContent = formObj[key];
        if (typeof rawContent !== 'object' || rawContent === null) {
          skippedCount++;
          if (warnings.length < MAX_WARNINGS) {
            warnings.push(`Invalid ${key} payload — expected an object`);
          }
          break;
        }
        const formContent = rawContent as Record<string, unknown>;
        const items = mapper.map(formContent, warnings);

        for (const item of items) {
          const type = item.incomeType;

          if (!groupedByType[type]) {
            groupedByType[type] = {
              incomeType: type,
              label: mapper.label,
              count: 0,
              items: [],
            };
          }

          groupedByType[type].items.push(item);
          groupedByType[type].count++;

          if (item.errors.length > 0) {
            errorCount++;
          } else {
            validCount++;
          }
        }
        break; // Each TaxData has exactly one form key
      }
    }

    if (!matched) {
      skippedCount++;
      const formKeys = Object.keys(formObj).filter(k => k.startsWith('tax') || k.endsWith('Statement'));
      if (formKeys.length > 0 && warnings.length < MAX_WARNINGS) {
        warnings.push(`Unsupported form type: ${formKeys[0]}`);
      }
    }
  }

  return {
    version,
    taxYear,
    issuerName,
    groupedByType,
    totalForms: forms.length,
    validCount,
    errorCount,
    skippedCount,
    errors,
    warnings,
  };
}

// ─── Version Detection & Form Extraction ────────────

function extractForms(
  root: Record<string, unknown>,
  errors: string[],
): { forms: unknown[]; version: FDXParseResult['version']; taxYear?: number; issuerName?: string } {
  // FDX v6+: TaxStatement with "forms" array
  if (Array.isArray(root.forms)) {
    const taxYear = typeof root.taxYear === 'number' ? root.taxYear : undefined;
    const issuerName = extractIssuerName(root.issuer);
    return { forms: root.forms, version: 'v6', taxYear, issuerName };
  }

  // FDX v5: taxDataList array at root
  if (Array.isArray(root.taxDataList)) {
    return { forms: root.taxDataList, version: 'v5' };
  }

  // Some exports may wrap in a "taxStatements" array (batch export)
  if (Array.isArray(root.taxStatements)) {
    const allForms: unknown[] = [];
    let taxYear: number | undefined;
    let issuerName: string | undefined;

    for (const stmt of root.taxStatements) {
      if (typeof stmt === 'object' && stmt !== null) {
        const s = stmt as Record<string, unknown>;
        if (Array.isArray(s.forms)) {
          allForms.push(...s.forms);
        }
        if (!taxYear && typeof s.taxYear === 'number') {
          taxYear = s.taxYear;
        }
        if (!issuerName) {
          issuerName = extractIssuerName(s.issuer);
        }
      }
    }

    if (allForms.length > 0) {
      return { forms: allForms, version: 'v6', taxYear, issuerName };
    }
  }

  // Try: root itself might be a single TaxData (bare form)
  for (const key of Object.keys(root)) {
    if (FORM_MAPPERS[key]) {
      return { forms: [root], version: 'unknown' };
    }
  }

  errors.push('Not a valid FDX file — could not find "forms", "taxDataList", or recognized form data.');
  return { forms: [], version: 'unknown' };
}

function extractIssuerName(issuer: unknown): string | undefined {
  if (typeof issuer !== 'object' || issuer === null) return undefined;
  const iss = issuer as Record<string, unknown>;

  // Business name
  if (typeof iss.businessName === 'object' && iss.businessName !== null) {
    const bn = iss.businessName as Record<string, unknown>;
    if (typeof bn.name1 === 'string' && bn.name1) return bn.name1;
  }

  // Individual name
  if (typeof iss.individualName === 'object' && iss.individualName !== null) {
    const ind = iss.individualName as Record<string, unknown>;
    const parts = [ind.first, ind.last].filter(p => typeof p === 'string' && p);
    if (parts.length > 0) return parts.join(' ');
  }

  return undefined;
}

// ─── Form Mappers ─────────────────────────────────

function mapW2(form: Record<string, unknown>, warnings: string[]): FDXMappedItem[] {
  const employerName = extractIssuerName(form.issuer) || str(form.employerName) || 'Unknown employer';

  const data: Record<string, unknown> = {
    employerName,
    wages: num(form.wages),
    federalTaxWithheld: num(form.federalTaxWithheld),
    socialSecurityWages: num(form.socialSecurityWages),
    socialSecurityTax: num(form.socialSecurityTaxWithheld),
    medicareWages: num(form.medicareWages),
    medicareTax: num(form.medicareTaxWithheld),
  };

  // State withholding from stateAndLocal array
  const stateLocal = extractStateLocal(form.stateAndLocal);
  if (stateLocal) {
    if (stateLocal.stateTaxWithheld) data.stateTaxWithheld = stateLocal.stateTaxWithheld;
    if (stateLocal.stateWages) data.stateWages = stateLocal.stateWages;
    if (stateLocal.state) data.state = stateLocal.state;
  }

  // EIN from issuer
  if (typeof form.issuer === 'object' && form.issuer !== null) {
    const iss = form.issuer as Record<string, unknown>;
    if (typeof iss.tin === 'string' && iss.tin) {
      data.employerEin = iss.tin;
    }
  }

  // Box 12 compensation codes
  if (Array.isArray(form.compensationCodes)) {
    const box12: { code: string; amount: number }[] = [];
    for (const entry of form.compensationCodes) {
      if (entry && typeof entry === 'object') {
        const e = entry as Record<string, unknown>;
        const code = str(e.code) || str(e.compensationCode);
        const amount = num(e.amount) || num(e.compensationAmount);
        if (code && amount) {
          box12.push({ code: code.toUpperCase(), amount });
        }
      }
    }
    if (box12.length > 0) data.box12 = box12;
  }

  // Box 13 checkboxes
  const box13: Record<string, boolean> = {};
  if (form.statutoryEmployee === true || form.statutoryEmployee === 'true') box13.statutoryEmployee = true;
  if (form.retirementPlan === true || form.retirementPlan === 'true') box13.retirementPlan = true;
  if (form.thirdPartySickPay === true || form.thirdPartySickPay === 'true') box13.thirdPartySickPay = true;
  if (Object.keys(box13).length > 0) data.box13 = box13;

  const itemWarnings: string[] = [];
  if (!data.wages || data.wages === 0) {
    itemWarnings.push('Wages amount is zero or missing');
  }

  return [{
    incomeType: 'w2',
    label: employerName,
    data,
    warnings: itemWarnings,
    errors: [],
  }];
}

function map1099B(form: Record<string, unknown>, warnings: string[]): FDXMappedItem[] {
  const items: FDXMappedItem[] = [];
  const brokerName = extractIssuerName(form.issuer) || 'FDX Import';

  const details = form.securityDetails;
  if (!Array.isArray(details) || details.length === 0) {
    // No individual transactions — check for summary totals
    if (warnings.length < MAX_WARNINGS) {
      warnings.push('1099-B form has no securityDetails — no individual transactions to import');
    }
    return items;
  }

  for (const detail of details) {
    if (typeof detail !== 'object' || detail === null) continue;
    const d = detail as Record<string, unknown>;

    const itemWarnings: string[] = [];
    const itemErrors: string[] = [];

    const description = str(d.securityName) || str(d.saleDescription) || 'Unknown security';
    const dateAcquired = d.variousDatesAcquired ? '' : (parseDate(d.dateAcquired) || '');
    const dateSold = parseDate(d.dateOfSale) || '';
    const proceeds = num(d.salesPrice);
    const rawCostBasis = num(d.costBasis);
    const costBasis = rawCostBasis !== 0 ? rawCostBasis : num(d.correctedCostBasis);

    if (!dateSold) {
      itemWarnings.push('No sale date found');
    }
    if (proceeds === 0 && costBasis === 0) {
      itemErrors.push('Both proceeds and cost basis are zero');
    }

    // Determine holding period
    let isLongTerm = false;
    if (typeof d.longOrShort === 'string') {
      isLongTerm = d.longOrShort.toUpperCase() === 'LONG';
    } else if (dateAcquired && dateSold) {
      isLongTerm = inferHoldingPeriod(dateAcquired, dateSold);
    }

    // Basis reported
    let basisReportedToIRS = false;
    if (typeof d.basisReported === 'boolean') {
      basisReportedToIRS = d.basisReported;
    } else if (typeof d.noncoveredSecurity === 'boolean') {
      basisReportedToIRS = !d.noncoveredSecurity;
    } else if (typeof d.checkboxOnForm8949 === 'string') {
      // A, D = basis reported; B, E = not reported; C, F = no 1099-B
      basisReportedToIRS = ['A', 'D'].includes(d.checkboxOnForm8949.toUpperCase());
    }

    if (d.variousDatesAcquired) {
      itemWarnings.push('Acquisition date is "Various" — shares were acquired over multiple dates');
    }

    const data: Record<string, unknown> = {
      brokerName,
      description,
      dateAcquired,
      dateSold,
      proceeds,
      costBasis,
      isLongTerm,
      basisReportedToIRS,
    };

    const washSale = num(d.washSaleLossDisallowed);
    if (washSale !== 0) {
      data.washSaleLossDisallowed = Math.abs(washSale);
    }

    if (num(d.federalTaxWithheld)) {
      data.federalTaxWithheld = num(d.federalTaxWithheld);
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

function map1099Int(form: Record<string, unknown>, _warnings: string[]): FDXMappedItem[] {
  const payerName = extractIssuerName(form.issuer) || str(form.payerName) || 'Unknown payer';

  const data: Record<string, unknown> = {
    payerName,
    amount: num(form.interestIncome),
    federalTaxWithheld: num(form.federalTaxWithheld),
    usBondInterest: num(form.usBondInterest),
    taxExemptInterest: num(form.taxExemptInterest),
    earlyWithdrawalPenalty: num(form.earlyWithdrawalPenalty),
  };

  // State withholding
  const stateLocal = extractStateLocal(form.stateAndLocal);
  if (stateLocal) {
    if (stateLocal.stateTaxWithheld) data.stateTaxWithheld = stateLocal.stateTaxWithheld;
    if (stateLocal.stateWages) data.stateWages = stateLocal.stateWages;
    if (stateLocal.state) data.state = stateLocal.state;
  }

  const itemWarnings: string[] = [];
  if (!data.amount || data.amount === 0) {
    itemWarnings.push('Interest income amount is zero or missing');
  }

  return [{
    incomeType: '1099int',
    label: payerName,
    data,
    warnings: itemWarnings,
    errors: [],
  }];
}

function map1099Div(form: Record<string, unknown>, _warnings: string[]): FDXMappedItem[] {
  const payerName = extractIssuerName(form.issuer) || str(form.payerName) || 'Unknown payer';

  const data: Record<string, unknown> = {
    payerName,
    ordinaryDividends: num(form.ordinaryDividends),
    qualifiedDividends: num(form.qualifiedDividends),
    capitalGainDistributions: num(form.totalCapitalGain),
    federalTaxWithheld: num(form.federalTaxWithheld),
    foreignTaxPaid: num(form.foreignTaxPaid),
  };

  // State withholding
  const stateLocal = extractStateLocal(form.stateAndLocal);
  if (stateLocal) {
    if (stateLocal.stateTaxWithheld) data.stateTaxWithheld = stateLocal.stateTaxWithheld;
    if (stateLocal.stateWages) data.stateWages = stateLocal.stateWages;
    if (stateLocal.state) data.state = stateLocal.state;
  }

  const itemWarnings: string[] = [];
  if (!data.ordinaryDividends || data.ordinaryDividends === 0) {
    itemWarnings.push('Ordinary dividends amount is zero or missing');
  }

  return [{
    incomeType: '1099div',
    label: payerName,
    data,
    warnings: itemWarnings,
    errors: [],
  }];
}

function map1099R(form: Record<string, unknown>, _warnings: string[]): FDXMappedItem[] {
  const payerName = extractIssuerName(form.issuer) || str(form.payerName) || 'Unknown payer';

  const isIRA = typeof form.iraSepSimple === 'boolean' ? form.iraSepSimple : false;

  // Distribution code — FDX provides as array of strings
  let distributionCode = '';
  if (Array.isArray(form.distributionCodes) && form.distributionCodes.length > 0) {
    distributionCode = form.distributionCodes.join('');
  } else if (typeof form.distributionCode === 'string') {
    distributionCode = form.distributionCode;
  }

  const grossDistribution = num(form.grossDistribution);
  let taxableAmount = num(form.taxableAmount);

  const itemWarnings: string[] = [];

  // Default taxable to gross if not determined
  if (form.taxableAmountNotDetermined && grossDistribution > 0 && taxableAmount === 0) {
    taxableAmount = grossDistribution;
    itemWarnings.push('Taxable amount not determined — defaulting to gross distribution');
  }

  if (!grossDistribution || grossDistribution === 0) {
    itemWarnings.push('Distribution amount is zero or missing');
  }

  const data: Record<string, unknown> = {
    payerName,
    grossDistribution,
    taxableAmount,
    federalTaxWithheld: num(form.federalTaxWithheld),
    isIRA,
    isPension: !isIRA,
  };

  if (distributionCode) {
    data.distributionCode = distributionCode;
  }

  // State withholding
  const stateLocal = extractStateLocal(form.stateAndLocal);
  if (stateLocal) {
    if (stateLocal.stateTaxWithheld) data.stateTaxWithheld = stateLocal.stateTaxWithheld;
    if (stateLocal.stateWages) data.stateWages = stateLocal.stateWages;
    if (stateLocal.state) data.state = stateLocal.state;
  }

  return [{
    incomeType: '1099r',
    label: payerName,
    data,
    warnings: itemWarnings,
    errors: [],
  }];
}

function map1099Nec(form: Record<string, unknown>, _warnings: string[]): FDXMappedItem[] {
  const payerName = extractIssuerName(form.issuer) || str(form.payerName) || 'Unknown payer';

  const data: Record<string, unknown> = {
    payerName,
    amount: num(form.nonEmployeeCompensation),
    federalTaxWithheld: num(form.federalTaxWithheld),
  };

  // EIN from issuer
  if (typeof form.issuer === 'object' && form.issuer !== null) {
    const iss = form.issuer as Record<string, unknown>;
    if (typeof iss.tin === 'string' && iss.tin) {
      data.payerEin = iss.tin;
    }
  }

  // State withholding
  const stateLocal = extractStateLocal(form.stateAndLocal);
  if (stateLocal) {
    if (stateLocal.stateTaxWithheld) data.stateTaxWithheld = stateLocal.stateTaxWithheld;
    if (stateLocal.state) data.state = stateLocal.state;
  }

  const itemWarnings: string[] = [];
  if (!data.amount || data.amount === 0) {
    itemWarnings.push('Nonemployee compensation amount is zero or missing');
  }

  return [{
    incomeType: '1099nec',
    label: payerName,
    data,
    warnings: itemWarnings,
    errors: [],
  }];
}

function map1099Misc(form: Record<string, unknown>, _warnings: string[]): FDXMappedItem[] {
  const payerName = extractIssuerName(form.issuer) || str(form.payerName) || 'Unknown payer';

  const data: Record<string, unknown> = {
    payerName,
    rents: num(form.rents),
    royalties: num(form.royalties),
    otherIncome: num(form.otherIncome),
    federalTaxWithheld: num(form.federalTaxWithheld),
  };

  // State withholding
  const stateLocal = extractStateLocal(form.stateAndLocal);
  if (stateLocal?.stateTaxWithheld) {
    data.stateTaxWithheld = stateLocal.stateTaxWithheld;
  }

  const itemWarnings: string[] = [];
  const total = num(form.rents) + num(form.royalties) + num(form.otherIncome);
  if (total === 0) {
    itemWarnings.push('All income amounts are zero or missing');
  }

  return [{
    incomeType: '1099misc',
    label: payerName,
    data,
    warnings: itemWarnings,
    errors: [],
  }];
}

function map1099G(form: Record<string, unknown>, _warnings: string[]): FDXMappedItem[] {
  const payerName = extractIssuerName(form.issuer) || str(form.payerName) || 'Unknown payer';

  const data: Record<string, unknown> = {
    payerName,
    unemploymentCompensation: num(form.unemploymentCompensation),
    federalTaxWithheld: num(form.federalTaxWithheld),
  };

  // State withholding
  const stateLocal = extractStateLocal(form.stateAndLocal);
  if (stateLocal) {
    if (stateLocal.stateTaxWithheld) data.stateTaxWithheld = stateLocal.stateTaxWithheld;
    if (stateLocal.state) data.state = stateLocal.state;
  }

  const itemWarnings: string[] = [];
  if (!data.unemploymentCompensation || data.unemploymentCompensation === 0) {
    itemWarnings.push('Unemployment compensation amount is zero or missing');
  }

  return [{
    incomeType: '1099g',
    label: payerName,
    data,
    warnings: itemWarnings,
    errors: [],
  }];
}

function map1099K(form: Record<string, unknown>, _warnings: string[]): FDXMappedItem[] {
  const payerName = extractIssuerName(form.issuer) || str(form.pseName) || 'Unknown platform';

  const data: Record<string, unknown> = {
    payerName,
    grossAmount: num(form.grossAmount),
    cardNotPresent: num(form.cardNotPresent),
    federalTaxWithheld: num(form.federalTaxWithheld),
  };

  const itemWarnings: string[] = [];
  if (!data.grossAmount || data.grossAmount === 0) {
    itemWarnings.push('Gross amount is zero or missing');
  }

  return [{
    incomeType: '1099k',
    label: payerName,
    data,
    warnings: itemWarnings,
    errors: [],
  }];
}

function map1099Sa(form: Record<string, unknown>, _warnings: string[]): FDXMappedItem[] {
  const payerName = extractIssuerName(form.issuer) || str(form.payerName) || 'Unknown trustee';

  const data: Record<string, unknown> = {
    payerName,
    grossDistribution: num(form.grossDistribution),
    federalTaxWithheld: num(form.federalTaxWithheld),
  };

  if (typeof form.distributionCode === 'string' && form.distributionCode) {
    data.distributionCode = form.distributionCode;
  }

  const itemWarnings: string[] = [];
  if (!data.grossDistribution || data.grossDistribution === 0) {
    itemWarnings.push('Distribution amount is zero or missing');
  }

  return [{
    incomeType: '1099sa',
    label: payerName,
    data,
    warnings: itemWarnings,
    errors: [],
  }];
}

function map1099Q(form: Record<string, unknown>, _warnings: string[]): FDXMappedItem[] {
  const payerName = extractIssuerName(form.issuer) || str(form.payerName) || 'Unknown plan';

  const data: Record<string, unknown> = {
    payerName,
    grossDistribution: num(form.grossDistribution),
    earnings: num(form.earnings),
    basisReturn: num(form.basis),
  };

  const itemWarnings: string[] = [];
  if (!data.grossDistribution || data.grossDistribution === 0) {
    itemWarnings.push('Distribution amount is zero or missing');
  }

  return [{
    incomeType: '1099q',
    label: payerName,
    data,
    warnings: itemWarnings,
    errors: [],
  }];
}

// ─── Helpers ───────────────────────────────────────

/** Safely extract a number, defaulting to 0. */
function num(val: unknown): number {
  if (typeof val === 'number' && isFinite(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/[$,]/g, ''));
    return isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Safely extract a string. */
function str(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

/** Parse a date value — FDX uses ISO 8601 (YYYY-MM-DD). */
function parseDate(val: unknown): string | null {
  if (typeof val !== 'string' || !val) return null;
  return parseDateString(val);
}

/** Extract first state/local withholding entry. */
function extractStateLocal(
  stateAndLocal: unknown,
): { stateTaxWithheld?: number; stateWages?: number; state?: string } | null {
  if (!Array.isArray(stateAndLocal) || stateAndLocal.length === 0) return null;

  const first = stateAndLocal[0];
  if (typeof first !== 'object' || first === null) return null;

  const entry = first as Record<string, unknown>;
  const result: { stateTaxWithheld?: number; stateWages?: number; state?: string } = {};

  if (typeof entry.stateCode === 'string') {
    result.state = entry.stateCode;
  }

  if (typeof entry.state === 'object' && entry.state !== null) {
    const s = entry.state as Record<string, unknown>;
    const taxWithheld = num(s.taxWithheld);
    const taxableIncome = num(s.taxableIncome);
    if (taxWithheld !== 0) result.stateTaxWithheld = taxWithheld;
    if (taxableIncome !== 0) result.stateWages = taxableIncome;
  }

  return result;
}

function emptyResult(error: string, errors: string[], warnings: string[] = []): FDXParseResult {
  if (!errors.includes(error)) errors.push(error);
  return {
    version: 'unknown',
    groupedByType: {},
    totalForms: 0,
    validCount: 0,
    errorCount: 0,
    skippedCount: 0,
    errors,
    warnings,
  };
}
