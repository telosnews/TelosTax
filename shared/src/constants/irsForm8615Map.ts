/**
 * IRS Form 8615 (2025) — AcroForm Field Mapping
 *
 * Tax for Certain Children Who Have Unearned Income
 * PDF: client/public/irs-forms/f8615.pdf (Form 8615, 2025)
 * Attachment Sequence No. 33
 *
 * Field prefix: topmostSubform[0].Page1[0]
 *
 * Layout (single page):
 *   Header:
 *     f1_1 = Child's name
 *     f1_2 = Child's SSN
 *     f1_3 = Line A: Parent's name
 *     f1_4 = Line B: Parent's SSN
 *     c1_1[0..3] = Line C: Parent's filing status checkboxes
 *       [0] = Single, [1] = MFJ, [2] = MFS, [3] = HoH/QSS
 *
 *   Lines 1-5: Core computation
 *     f1_5 = Line 1: Child's unearned income
 *     f1_6 = Line 2: Minimum standard deduction ($2,500 for 2025)
 *     f1_7 = Line 3: Line 1 minus Line 2
 *     f1_8 = Line 4: Child's taxable income (Form 1040 line 15)
 *     f1_9 = Line 5: Smaller of Line 3 or Line 4
 *
 *   Lines 6-12: Tax computation at parent's rate
 *     f1_10 = Line 6: Tax on Line 5 at parent's rate
 *     f1_11 = Line 7: Tax on child's income at child's rate
 *     f1_12 = Line 8: Line 6 minus Line 7 (additional tax)
 *     f1_13 = Line 9: Tax on Line 8 at parent's rate
 *     f1_14 = Line 10: Tax on Line 4 at child's rate
 *     f1_15 = Line 11: Larger of Line 9 or Line 10
 *     f1_16 = Line 12: Total kiddie tax
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';

/** Format a dollar amount — blank for zero or undefined */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

/** 2025 minimum standard deduction for Form 8615 Line 2 */
const KIDDIE_TAX_STANDARD_DEDUCTION = 2500;

export const FORM_8615_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════

  // Child's name — use first kiddieTaxEntries childName, fallback to filer name
  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: "Child's name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const entry = tr.kiddieTaxEntries?.[0];
      if (entry?.childName) return entry.childName;
      const parts = [tr.firstName, tr.lastName].filter(Boolean);
      return parts.join(' ') || undefined;
    },
  },
  // Child's SSN
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: "Child's social security number",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || undefined,
  },

  // Line A: Parent's name — not directly available in engine data
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    formLabel: "Line A: Parent's name",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => undefined,
  },
  // Line B: Parent's SSN — not directly available in engine data
  {
    pdfFieldName: `${P1}.f1_4[0]`,
    formLabel: "Line B: Parent's social security number",
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => undefined,
  },

  // Line C: Parent's filing status checkboxes
  // c1_1[0] = Single
  {
    pdfFieldName: `${P1}.c1_1[0]`,
    formLabel: "Line C: Parent's filing status - Single",
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => false,
  },
  // c1_1[1] = Married filing jointly
  {
    pdfFieldName: `${P1}.c1_1[1]`,
    formLabel: "Line C: Parent's filing status - Married filing jointly",
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => false,
  },
  // c1_1[2] = Married filing separately
  {
    pdfFieldName: `${P1}.c1_1[2]`,
    formLabel: "Line C: Parent's filing status - Married filing separately",
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => false,
  },
  // c1_1[3] = Head of household / Qualifying surviving spouse
  {
    pdfFieldName: `${P1}.c1_1[3]`,
    formLabel: "Line C: Parent's filing status - Head of household or qualifying surviving spouse",
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => false,
  },

  // ══════════════════════════════════════════════════════════════
  // Lines 1–5: Core Computation
  // ══════════════════════════════════════════════════════════════

  // Line 1: Child's unearned income
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: "Line 1: Child's unearned income",
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const entry = tr.kiddieTaxEntries?.[0] || tr.kiddieTax;
      return fmtDollar(entry?.childUnearnedIncome);
    },
  },
  // Line 2: Minimum standard deduction ($2,500 for 2025)
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 2: Minimum standard deduction ($2,500)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const entry = tr.kiddieTaxEntries?.[0] || tr.kiddieTax;
      return entry ? String(KIDDIE_TAX_STANDARD_DEDUCTION) : undefined;
    },
  },
  // Line 3: Line 1 minus Line 2
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 3: Subtract line 2 from line 1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const entry = tr.kiddieTaxEntries?.[0] || tr.kiddieTax;
      if (!entry) return undefined;
      const diff = entry.childUnearnedIncome - KIDDIE_TAX_STANDARD_DEDUCTION;
      return fmtDollar(Math.max(0, diff));
    },
  },
  // Line 4: Child's taxable income (from Form 1040, line 15)
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: "Line 4: Child's taxable income (Form 1040, line 15)",
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form1040.taxableIncome),
  },
  // Line 5: Smaller of Line 3 or Line 4
  {
    pdfFieldName: `${P1}.f1_9[0]`,
    formLabel: 'Line 5: Smaller of line 3 or line 4',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const entry = tr.kiddieTaxEntries?.[0] || tr.kiddieTax;
      if (!entry) return undefined;
      const line3 = Math.max(0, entry.childUnearnedIncome - KIDDIE_TAX_STANDARD_DEDUCTION);
      const line4 = calc.form1040.taxableIncome ?? 0;
      return fmtDollar(Math.min(line3, line4));
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Lines 6–12: Tax Computation at Parent's Rate
  // ══════════════════════════════════════════════════════════════

  // Line 6: Tax on Line 5 at parent's rate — intermediate, not directly in engine
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: "Line 6: Tax on line 5 at parent's rate",
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 7: Tax on child's income at child's rate — intermediate
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: "Line 7: Tax on child's income at child's rate",
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 8: Line 6 minus Line 7 (additional tax due to parent's higher rate)
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 8: Subtract line 7 from line 6',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.kiddieTax?.additionalTax),
  },
  // Line 9: Tax on Line 8 at parent's rate — intermediate
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: "Line 9: Tax on line 8 at parent's rate",
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 10: Tax on Line 4 at child's rate — intermediate
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    formLabel: "Line 10: Tax on line 4 at child's rate",
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 11: Larger of Line 9 or Line 10 — intermediate
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 11: Larger of line 9 or line 10',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 12: Total kiddie tax
  {
    pdfFieldName: `${P1}.f1_16[0]`,
    formLabel: "Line 12: Child's tax (total kiddie tax)",
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.kiddieTax?.additionalTax),
  },
];

export const FORM_8615_TEMPLATE: IRSFormTemplate = {
  formId: 'f8615',
  displayName: 'Form 8615',
  attachmentSequence: 33,
  pdfFileName: 'f8615.pdf',
  condition: (_tr, calc) => (calc.kiddieTax?.additionalTax ?? 0) > 0,
  fields: FORM_8615_FIELDS,
};
