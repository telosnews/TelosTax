/**
 * Prior Year Importer — imports prior-year tax data for YoY comparison.
 *
 * Two import paths:
 * 1. TelosTax JSON export — re-runs calculateForm1040() for full computed results
 * 2. IRS 1040 PDF — extracts key line items via AcroForm fields (with text fallback)
 *
 * All processing runs client-side. Data never leaves the browser.
 */

import * as pdfjsLib from 'pdfjs-dist';
import './pdfWorkerInit'; // Ensure worker is configured
import { calculateForm1040, FilingStatus } from '@telostax/engine';
import type { TaxReturn, PriorYearSummary } from '@telostax/engine';
import { MAX_PDF_SIZE } from './importHelpers';
import {
  extractTextBlocks,
  findColumnValue,
  detectValueColumnX,
  parseDollarValue,
  detectTaxYear,
} from './pdfTextUtils';

// ─── Types ─────────────────────────────────────────

export interface PriorYearImportResult {
  summary: PriorYearSummary;
  carryforwardSuggestions: {
    capitalLossCarryforwardST?: number;
    capitalLossCarryforwardLT?: number;
    nolCarryforward?: number;
    priorYearTax?: number;
  };
  /** Raw TaxReturn — only present for JSON imports (used by template builder) */
  rawReturn?: TaxReturn;
  warnings: string[];
  errors: string[];
}

// ─── AcroForm field names for 1040 extraction ──────
// Supports both 2024 and 2025 IRS fillable Form 1040 field numbering.
// The 2025 form expanded section 1 with sub-lines 1a-1z, shifting all
// field numbers upward. Both sets are tried during extraction.
const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';
const L4_11 = `${P1}.Line4a-11_ReadOrder[0]`;

// 2025 field names (from irsForm1040Map.ts — f1040.pdf 2025 edition)
export const FORM_1040_EXTRACT_FIELDS = {
  wages:          `${P1}.f1_47[0]`,   // Line 1a — Total wages
  interest:       `${P1}.f1_58[0]`,   // Line 2b — Taxable interest
  dividends:      `${P1}.f1_60[0]`,   // Line 3b — Ordinary dividends
  iraDistrib:     `${P1}.f1_62[0]`,   // Line 4b — IRA distributions (taxable)
  pensions:       `${P1}.f1_64[0]`,   // Line 5b — Pensions and annuities (taxable)
  socialSecurity: `${P1}.f1_66[0]`,   // Line 6b — Social Security benefits (taxable)
  capitalGain:    `${P1}.f1_67[0]`,   // Line 7  — Capital gain or (loss)
  totalIncome:    `${P1}.f1_69[0]`,   // Line 9  — Total income
  agi:            `${P1}.f1_71[0]`,   // Line 11a — AGI
  deduction:      `${P2}.f2_02[0]`,   // Line 12e — Standard/Itemized deduction
  taxableIncome:  `${P2}.f2_06[0]`,   // Line 15 — Taxable income
  totalTax:       `${P2}.f2_15[0]`,   // Line 24 — Total tax
  estimatedPmts:  `${P2}.f2_24[0]`,   // Line 26 — Estimated tax payments
  totalPayments:  `${P2}.f2_28[0]`,   // Line 33 — Total payments
  refund:         `${P2}.f2_30[0]`,   // Line 35a — Refund
  amountOwed:     `${P2}.f2_35[0]`,   // Line 37 — Amount owed
} as const;

// 2024 field names (from f1040-2024.pdf — different numbering)
export const FORM_1040_EXTRACT_FIELDS_2024 = {
  wages:          `${P1}.f1_32[0]`,           // Line 1a
  interest:       `${P1}.f1_43[0]`,           // Line 2b
  dividends:      `${P1}.f1_45[0]`,           // Line 3b
  iraDistrib:     `${L4_11}.f1_47[0]`,        // Line 4b
  pensions:       `${L4_11}.f1_49[0]`,        // Line 5b
  socialSecurity: `${L4_11}.f1_51[0]`,        // Line 6b
  capitalGain:    `${L4_11}.f1_52[0]`,        // Line 7
  totalIncome:    `${L4_11}.f1_54[0]`,        // Line 9
  agi:            `${L4_11}.f1_56[0]`,        // Line 11
  deduction:      `${P1}.f1_57[0]`,           // Line 12
  taxableIncome:  `${P1}.f1_60[0]`,           // Line 15
  totalTax:       `${P2}.f2_09[0]`,           // Line 24
  estimatedPmts:  `${P2}.f2_14[0]`,           // Line 26
  totalPayments:  `${P2}.f2_23[0]`,           // Line 33
  refund:         `${P2}.f2_27[0]`,           // Line 35a
  amountOwed:     `${P2}.f2_29[0]`,           // Line 37
} as const;

// ─── Text extraction keywords for each line ────────

export const FORM_1040_TEXT_KEYWORDS: Record<string, string[]> = {
  wages:          ['w-2, box 1', 'wages, salaries', 'wages'],
  interest:       ['taxable interest'],
  dividends:      ['ordinary dividends'],
  iraDistrib:     ['ira distributions'],
  pensions:       ['pensions and annuities'],
  socialSecurity: ['social security benefits'],
  capitalGain:    ['capital gain or (loss)', 'capital gain'],
  totalIncome:    ['total income'],
  agi:            ['adjusted gross income'],
  deduction:      ['standard deduction or itemized', 'standard deduction'],
  taxableIncome:  ['taxable income'],
  totalTax:       ['total tax'],
  estimatedPmts:  ['estimated tax payments'],
  totalPayments:  ['total payments'],
  refund:         ['refunded to you'],
  amountOwed:     ['amount you owe'],
};

/** Fields where the fallback (15px tolerance) should be disabled to prevent
 *  adjacent-line value contamination. These are income lines that are packed
 *  ~12px apart on the IRS 1040 — using the wider fallback tolerance would
 *  cause values from neighboring lines to bleed through. */
export const STRICT_COLUMN_FIELDS = new Set([
  'interest', 'dividends', 'iraDistrib', 'pensions', 'socialSecurity',
]);

// ─── JSON Import ───────────────────────────────────

export async function importPriorYearJSON(file: File): Promise<PriorYearImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error('Could not read file. Please try again.');
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file. Please select a valid TelosTax export (.json).');
  }

  // Validate it's a TaxReturn
  const tr = data as Partial<TaxReturn>;
  if (!tr.id || !tr.taxYear || tr.schemaVersion === undefined) {
    throw new Error('This doesn\'t appear to be a TelosTax export. Missing required fields (id, taxYear, schemaVersion).');
  }

  if (tr.taxYear >= 2025) {
    warnings.push(`This appears to be a ${tr.taxYear} return, not a prior year. YoY comparison works best with a prior-year return.`);
  }

  // Run the engine on the imported return to get computed results
  const result = calculateForm1040({
    ...(tr as TaxReturn),
    filingStatus: tr.filingStatus || FilingStatus.Single,
  });

  const f = result.form1040;

  const summary: PriorYearSummary = {
    source: 'telostax-json',
    taxYear: tr.taxYear,
    filingStatus: tr.filingStatus !== undefined ? FilingStatus[tr.filingStatus] : undefined,
    totalIncome: f.totalIncome,
    agi: f.agi,
    taxableIncome: f.taxableIncome,
    deductionAmount: f.deductionAmount,
    totalTax: f.totalTax,
    totalCredits: f.totalCredits,
    totalPayments: f.totalPayments,
    refundAmount: f.refundAmount,
    amountOwed: f.amountOwed,
    effectiveTaxRate: f.effectiveTaxRate,
    // Detailed breakdown from JSON import
    totalWages: f.totalWages,
    totalInterest: f.totalInterest,
    totalDividends: f.totalDividends,
    scheduleCNetProfit: f.scheduleCNetProfit,
    capitalGainOrLoss: f.capitalGainOrLoss,
    seTax: f.seTax,
    // Enhanced breakdown
    estimatedTaxPayments: f.estimatedPayments > 0 ? f.estimatedPayments : undefined,
    iraDistributions: f.iraDistributionsTaxable > 0 ? f.iraDistributionsTaxable : undefined,
    pensionsAnnuities: f.pensionDistributionsTaxable > 0 ? f.pensionDistributionsTaxable : undefined,
    socialSecurityBenefits: f.taxableSocialSecurity > 0 ? f.taxableSocialSecurity : undefined,
  };

  // Extract carryforward suggestions
  const carryforwardSuggestions: PriorYearImportResult['carryforwardSuggestions'] = {
    priorYearTax: f.totalTax > 0 ? f.totalTax : undefined,
  };

  if (result.scheduleD) {
    if (result.scheduleD.capitalLossCarryforwardST > 0) {
      carryforwardSuggestions.capitalLossCarryforwardST = result.scheduleD.capitalLossCarryforwardST;
    }
    if (result.scheduleD.capitalLossCarryforwardLT > 0) {
      carryforwardSuggestions.capitalLossCarryforwardLT = result.scheduleD.capitalLossCarryforwardLT;
    }
  }

  return { summary, carryforwardSuggestions, rawReturn: tr as TaxReturn, warnings, errors };
}

// ─── 1040 PDF Import ───────────────────────────────

export async function importPriorYear1040PDF(file: File): Promise<PriorYearImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (file.size > MAX_PDF_SIZE) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is ${MAX_PDF_SIZE / 1024 / 1024} MB.`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Strategy 1: Try AcroForm field extraction
  const acroFormValues = await extractAcroFormFinancials(pdf);
  const hasAcroFormData = Object.values(acroFormValues).some(v => v !== 0);

  let vals: Record<string, number>;

  if (hasAcroFormData) {
    vals = acroFormValues;
  } else {
    // Strategy 2: Text-based fallback
    warnings.push('Could not read form fields — fell back to text extraction. Please verify all values.');
    vals = await extractFinancialsFromText(pdf);
  }

  // Detect tax year from text
  const taxYear = await detectTaxYear(pdf);

  // Validate we got meaningful data
  if (vals.totalIncome === 0 && vals.agi === 0 && vals.totalTax === 0) {
    throw new Error('Could not extract any data from this PDF. Make sure it\'s a digitally-generated IRS Form 1040 (not a scan or photo).');
  }

  // Compute effective rate
  const effectiveTaxRate = vals.totalIncome > 0 ? vals.totalTax / vals.totalIncome : 0;

  // Helper: only include a field if its value is non-zero
  const opt = (v: number) => v > 0 ? v : undefined;

  const summary: PriorYearSummary = {
    source: '1040-pdf',
    taxYear,
    totalIncome: vals.totalIncome,
    agi: vals.agi,
    taxableIncome: vals.taxableIncome,
    deductionAmount: vals.deduction,
    totalTax: vals.totalTax,
    totalCredits: 0, // Not directly available from 1040 summary lines
    totalPayments: vals.totalPayments,
    refundAmount: vals.refund,
    amountOwed: vals.amountOwed,
    effectiveTaxRate,
    // Breakdown fields — populated from 1040 line items
    totalWages: opt(vals.wages),
    totalInterest: opt(vals.interest),
    totalDividends: opt(vals.dividends),
    capitalGainOrLoss: vals.capitalGain !== 0 ? vals.capitalGain : undefined,
    estimatedTaxPayments: opt(vals.estimatedPmts),
    iraDistributions: opt(vals.iraDistrib),
    pensionsAnnuities: opt(vals.pensions),
    socialSecurityBenefits: opt(vals.socialSecurity),
  };

  if (taxYear >= 2025) {
    warnings.push(`Detected tax year ${taxYear}. YoY comparison works best with a prior-year return.`);
  }

  return {
    summary,
    carryforwardSuggestions: {
      priorYearTax: vals.totalTax > 0 ? vals.totalTax : undefined,
    },
    warnings,
    errors,
  };
}

// ─── AcroForm extraction ──────────────────────────

export async function extractAcroFormFinancials(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumbers?: number[],
): Promise<Record<string, number>> {
  const values: Record<string, number> = {
    wages: 0, interest: 0, dividends: 0, iraDistrib: 0, pensions: 0,
    socialSecurity: 0, capitalGain: 0, totalIncome: 0, agi: 0, deduction: 0,
    taxableIncome: 0, totalTax: 0, estimatedPmts: 0, totalPayments: 0,
    refund: 0, amountOwed: 0,
  };

  try {
    // pdfjs-dist exposes form field annotations on each page
    const pagesToScan = pageNumbers && pageNumbers.length > 0
      ? pageNumbers
      : [1, Math.min(2, pdf.numPages)];

    for (const i of pagesToScan) {
      if (i < 1 || i > pdf.numPages) continue;
      const page = await pdf.getPage(i);
      const annotations = await page.getAnnotations();

      for (const annot of annotations) {
        if (annot.subtype !== 'Widget' || !annot.fieldName) continue;

        const fieldName = annot.fieldName;
        const rawValue = annot.fieldValue;

        if (!rawValue || typeof rawValue !== 'string') continue;

        // Parse the dollar value
        const num = parseDollarValue(rawValue);
        if (num === null) continue;

        // Match against known fields (try both 2025 and 2024 field names)
        for (const [key, pdfField] of Object.entries(FORM_1040_EXTRACT_FIELDS)) {
          if (fieldName === pdfField) {
            values[key] = num;
          }
        }
        for (const [key, pdfField] of Object.entries(FORM_1040_EXTRACT_FIELDS_2024)) {
          if (fieldName === pdfField && values[key] === 0) {
            values[key] = num;
          }
        }
      }
    }
  } catch {
    // If annotation reading fails, return all zeros (will trigger text fallback)
  }

  return values;
}

// ─── Text-based fallback extraction ────────────────

export async function extractFinancialsFromText(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumbers?: number[],
): Promise<Record<string, number>> {
  let blocks;
  if (pageNumbers && pageNumbers.length > 0) {
    // Use specific pages (e.g., the actual 1040 pages found by find1040Pages)
    const { extractTextBlocksFromPages } = await import('./pdfTextUtils');
    blocks = await extractTextBlocksFromPages(pdf, pageNumbers);
  } else {
    blocks = await extractTextBlocks(pdf, 2);
  }

  // Detect the value column X position for each page
  const pages = [...new Set(blocks.map(b => b.page))];
  const columnXByPage = new Map<number, number>();
  for (const page of pages) {
    columnXByPage.set(page, detectValueColumnX(blocks, page));
  }

  // Use the most common column X as default (page 1 of the 1040)
  const defaultColumnX = columnXByPage.get(pages[0]) ?? 480;

  const result: Record<string, number> = {};
  for (const [key, keywords] of Object.entries(FORM_1040_TEXT_KEYWORDS)) {
    const strict = STRICT_COLUMN_FIELDS.has(key);
    result[key] = findColumnValue(blocks, keywords, defaultColumnX, strict);
  }
  return result;
}
