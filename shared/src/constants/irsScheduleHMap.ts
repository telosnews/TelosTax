/**
 * IRS Schedule H (2025) — AcroForm Field Mapping
 *
 * Household Employment Taxes
 * PDF: client/public/irs-forms/f1040sh.pdf (Schedule H, 2025)
 * Attachment Sequence No. 44
 * Total fields: ~30+ (text + checkbox)
 *
 * Field prefix: topmostSubform[0].Page1[0] / topmostSubform[0].Page2[0]
 *
 * Layout:
 *   Page 1:
 *     f1_1  = Name of employer
 *     f1_2  = Social security number (SSN)
 *     f1_3  = Employer identification number (EIN), if any
 *
 *     Part I — Social Security, Medicare, and FUTA Taxes:
 *       f1_4  = Line A: Did you pay any one household employee cash wages of $2,800 or more? (Yes/No)
 *       f1_5  = Line 1: Total cash wages subject to social security tax
 *       f1_6  = Line 2: Social security tax (line 1 x 12.4%)
 *       f1_7  = Line 3: Total cash wages subject to Medicare tax
 *       f1_8  = Line 4: Medicare tax (line 3 x 2.9%)
 *       f1_9  = Line 5: Federal income tax withheld (if agreed upon)
 *       f1_10 = Line 6: Total social security, Medicare, and withheld taxes (add lines 2, 4, 5)
 *       f1_11 = Line 7: FUTA question / Did you pay $1,000+ in any quarter?
 *
 *   Page 2 — Part II: FUTA Detailed Computation:
 *     (Lines 8–26 for detailed FUTA, state unemployment credit, and totals)
 *       f2_1  = Line 10: FUTA taxable wages (up to $7,000 per employee)
 *       f2_2  = Line 11: FUTA tax before adjustments
 *       f2_3  = Line 12–15: State unemployment credit adjustments
 *       f2_4  = Line 16: Total household employment taxes
 *     (Additional fields for schedule filing details)
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';

/** Format a dollar amount — blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

export const SCHEDULE_H_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════

  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name of employer',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      if (tr.filingStatus === FilingStatus.MarriedFilingJointly) {
        const spouseParts = [tr.spouseFirstName, tr.spouseLastName].filter(Boolean);
        if (spouseParts.length > 0) {
          return `${parts.join(' ')} & ${spouseParts.join(' ')}`;
        }
      }
      return parts.join(' ') || undefined;
    },
  },
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Social security number (SSN)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ══════════════════════════════════════════════════════════════
  // Part I — Social Security, Medicare, and FUTA Taxes
  // ══════════════════════════════════════════════════════════════

  // Line 1: Total cash wages subject to social security tax
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Line 1: Total cash wages subject to social security tax',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.householdEmployees?.totalCashWages),
  },
  // Line 2: Social security tax (line 1 x 12.4%)
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 2: Social security tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleH?.socialSecurityTax),
  },
  // Line 3: Total cash wages subject to Medicare tax (all wages — no cap)
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 3: Total cash wages subject to Medicare tax',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.householdEmployees?.totalCashWages),
  },
  // Line 4: Medicare tax (line 3 x 2.9%)
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: 'Line 4: Medicare tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleH?.medicareTax),
  },
  // Line 5: Federal income tax withheld (if any — optional, agreed upon with employee)
  {
    pdfFieldName: `${P1}.f1_9[0]`,
    formLabel: 'Line 5: Federal income tax withheld',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.householdEmployees?.federalTaxWithheld),
  },
  // Line 6: Total social security, Medicare, and withheld taxes (add lines 2, 4, 5)
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 6: Total social security, Medicare, and withheld taxes',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const ss = calc.scheduleH?.socialSecurityTax || 0;
      const med = calc.scheduleH?.medicareTax || 0;
      const withh = tr.householdEmployees?.federalTaxWithheld || 0;
      return fmtDollar(ss + med + withh);
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Part II — Federal Unemployment (FUTA) Tax
  // ══════════════════════════════════════════════════════════════

  // Line 10: FUTA taxable wages (up to $7,000 per employee)
  {
    pdfFieldName: `${P2}.f2_1[0]`,
    formLabel: 'Line 10: FUTA taxable wages',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const he = tr.householdEmployees;
      if (!he) return undefined;
      const numEmployees = Math.max(1, he.numberOfEmployees || 1);
      const futaWages = Math.min(he.totalCashWages, 7000 * numEmployees);
      return fmtDollar(futaWages);
    },
  },
  // Line 11: FUTA tax (0.6% of FUTA wages)
  {
    pdfFieldName: `${P2}.f2_2[0]`,
    formLabel: 'Line 11: FUTA tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleH?.futaTax),
  },
  // Line 16: Total household employment taxes (SS + Medicare + FUTA + withheld)
  {
    pdfFieldName: `${P2}.f2_4[0]`,
    formLabel: 'Line 16: Total household employment taxes',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const total = calc.scheduleH?.totalTax || 0;
      const withh = tr.householdEmployees?.federalTaxWithheld || 0;
      return fmtDollar(total + withh);
    },
  },
];

export const SCHEDULE_H_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040sh',
  displayName: 'Schedule H',
  attachmentSequence: 44,
  pdfFileName: 'f1040sh.pdf',
  condition: (tr, _calc) => tr.householdEmployees !== undefined && tr.householdEmployees.totalCashWages > 0,
  fields: SCHEDULE_H_FIELDS,
};
