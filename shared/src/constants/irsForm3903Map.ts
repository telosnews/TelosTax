/**
 * IRS Form 3903 (2025) — AcroForm Field Mapping
 *
 * Moving Expenses
 * For Members of the Armed Forces Only
 * Attachment Sequence No. 62
 * PDF: client/public/irs-forms/f3903.pdf
 *
 * Total fields: 7 (all text)
 *
 * Page1:
 *   f1_1 = Name(s) shown on return
 *   f1_2 = Your SSN
 *   f1_3 = Line 1: Transportation and storage of household goods and personal effects
 *   f1_4 = Line 2: Travel (including lodging) from old home to new home (not meals)
 *   f1_5 = Line 3: Add lines 1 and 2
 *   f1_6 = Line 4: Employer reimbursements NOT included in box 1 of Form W-2
 *   f1_7 = Line 5: Moving expense deduction (line 3 minus line 4; if zero or less, enter 0)
 *
 * Note: The engine tracks only the total deduction amount (tr.movingExpenses /
 * calc.form1040.movingExpenses), not the line-by-line breakdown. Lines 1-4 are
 * left blank; line 5 carries the final deduction.
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';

const fmtDollar = (v: number | undefined): string => {
  if (v === undefined || v === null || v === 0) return '';
  return Math.round(v).toString();
};

const P1 = 'topmostSubform[0].Page1[0]';

// ── Field Mappings ──────────────────────────────────────────────

export const FORM_3903_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header — Name & SSN
  // ══════════════════════════════════════════════════════════════

  // Name(s) shown on return
  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name(s) shown on return',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim() || undefined,
  },
  // Your social security number
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Your social security number',
    sourcePath: 'ssn',
    source: 'taxReturn',
    format: 'ssn',
  },

  // ══════════════════════════════════════════════════════════════
  // Lines 1–5 — Moving Expense Computation
  // ══════════════════════════════════════════════════════════════

  // Line 1: Transportation and storage of household goods and personal effects
  // (breakdown not tracked — left blank)
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    formLabel: 'Line 1: Transportation and storage of household goods',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '',
  },
  // Line 2: Travel (including lodging) from old home to new home. Do not include meals.
  // (breakdown not tracked — left blank)
  {
    pdfFieldName: `${P1}.f1_4[0]`,
    formLabel: 'Line 2: Travel and lodging from old home to new home',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '',
  },
  // Line 3: Add lines 1 and 2
  // (breakdown not tracked — left blank)
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Line 3: Total moving expenses',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '',
  },
  // Line 4: Enter the total amount your employer paid for the expenses listed on
  // lines 1 and 2 that is NOT included in box 1 of your Form W-2.
  // (not tracked — left blank)
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 4: Employer reimbursements not in W-2 box 1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => '',
  },
  // Line 5: Moving expense deduction.
  // Subtract line 4 from line 3. If line 4 is more than line 3, enter -0-.
  // Also enter on Schedule 1 (Form 1040), line 14.
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 5: Moving expense deduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr: TaxReturn, calc: CalculationResult) =>
      fmtDollar(calc.form1040?.movingExpenses),
  },
];

// ── Template Export ──────────────────────────────────────────────

export const FORM_3903_TEMPLATE: IRSFormTemplate = {
  formId: 'f3903',
  displayName: 'Form 3903',
  attachmentSequence: 62,
  pdfFileName: 'f3903.pdf',
  condition: (_tr, calc) => (calc.form1040?.movingExpenses ?? 0) > 0,
  fields: FORM_3903_FIELDS,
};
