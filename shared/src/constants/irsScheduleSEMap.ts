/**
 * IRS Schedule SE (Form 1040) 2025 — AcroForm Field Mapping
 *
 * Self-Employment Tax
 * PDF: client/public/irs-forms/f1040sse.pdf (Schedule SE, 2025, Created 5/7/25)
 * Attachment Sequence No. 17
 * Total fields: 27 (text: 26, checkbox: 1)
 *
 * Field prefix: topmostSubform[0].Page1[0] (page 1) / topmostSubform[0].Page2[0] (page 2)
 *
 * This mapping covers Part I (Short Schedule SE) which handles the common case.
 * Part II (Long Schedule SE) is for church employees, optional methods, etc. — rare.
 *
 * Page 1 field map:
 *   f1_1  = Name of person with self-employment income
 *   f1_2  = SSN
 *   c1_1  = Line A checkbox (minister/religious order)
 *   f1_3  = Line 1a: Net farm profit (Schedule F line 34, K-1 box 14 code A)
 *   f1_4  = Line 1b: Conservation Reserve Program payments
 *   f1_5  = Line 2: Net profit from Schedule C line 31, K-1 box 14 code A
 *   f1_6  = Line 3: Combine lines 1a, 1b, and 2
 *   f1_7  = Line 4a: If line 3 > 0, multiply by 92.35% (0.9235)
 *   f1_8  = Line 4b: Optional method amount
 *   f1_9  = Line 4c: Combine 4a and 4b
 *   f1_10 = Line 5a: Church employee income
 *   f1_11 = Line 5b: Multiply 5a by 92.35%
 *   f1_12 = Line 6: Add lines 4c and 5b
 *   f1_13 = Line 7: Maximum amount subject to SS tax ($176,100 for 2025)
 *   f1_14 = Line 8a: Total SS wages and tips (from W-2)
 *   f1_15 = Line 8b: Unreported tips (Form 4137 line 10)
 *   f1_16 = Line 8c: Wages from Form 8919 line 10
 *   f1_17 = Line 8d: Add 8a, 8b, 8c
 *   f1_18 = Line 9: Subtract 8d from 7 (if zero or less, enter -0-)
 *   f1_19 = Line 10: Multiply smaller of line 6 or 9 by 12.4% (0.124)
 *   f1_20 = Line 11: Multiply line 6 by 2.9% (0.029)
 *   f1_21 = Line 12: Self-employment tax (add lines 10 and 11)
 *   f1_22 = Line 13: Deduction for one-half of SE tax (line 12 × 50%)
 *
 * Page 2 (Part II — Optional Methods, rarely used):
 *   f2_1  = Line 14: Maximum income for optional methods
 *   f2_2  = Line 15: Farm optional method
 *   f2_3  = Line 16: Subtract 15 from 14
 *   f2_4  = Line 17: Nonfarm optional method
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';

export const SCHEDULE_SE_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════

  // Name of person with self-employment income
  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name of person with self-employment income',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim(),
  },
  // SSN
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Social security number of person with SE income',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ══════════════════════════════════════════════════════════════
  // Part I — Self-Employment Tax
  // ══════════════════════════════════════════════════════════════

  // Line 2: Net profit (or loss) from Schedule C, line 31; and Schedule K-1 (Form 1065), box 14, code A
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Line 2: Net profit or loss from Schedule C',
    sourcePath: 'form1040.scheduleCNetProfit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 3: Combine lines 1a, 1b, and 2
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 3: Combine lines 1a, 1b, and 2',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // For most filers: just Schedule C net profit + farm profit + K-1 SE income
      const schedC = calc.form1040.scheduleCNetProfit || 0;
      const farm = calc.form1040.scheduleFNetProfit || 0;
      const k1SE = calc.form1040.k1SEIncome || 0;
      const total = schedC + farm + k1SE;
      return total ? Math.round(total).toString() : '';
    },
  },

  // Line 4a: If line 3 is more than zero, multiply line 3 by 92.35%
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 4a: Multiply line 3 by 92.35% (0.9235)',
    sourcePath: 'scheduleSE.netEarnings',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 4c: Combine lines 4a and 4b (same as 4a for most filers)
  {
    pdfFieldName: `${P1}.f1_9[0]`,
    formLabel: 'Line 4c: Combine lines 4a and 4b',
    sourcePath: 'scheduleSE.netEarnings',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 6: Add lines 4c and 5b (same as 4c for most filers without church income)
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 6: Add lines 4c and 5b',
    sourcePath: 'scheduleSE.netEarnings',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 7: Maximum amount of combined wages and SE earnings subject to SS tax
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 7: Maximum earnings subject to social security tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => '176100',  // 2025 Social Security wage base
  },

  // Line 8a: Total social security wages and tips from W-2
  {
    pdfFieldName: `${P1}.Line8a_ReadOrder[0].f1_14[0]`,
    formLabel: 'Line 8a: Total social security wages and tips (W-2)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = tr.w2Income.reduce((sum, w2) => sum + (w2.socialSecurityWages || 0), 0);
      return total ? Math.round(total).toString() : '';
    },
  },

  // Line 8d: Add lines 8a, 8b, and 8c
  {
    pdfFieldName: `${P1}.f1_17[0]`,
    formLabel: 'Line 8d: Add lines 8a, 8b, and 8c',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const total = tr.w2Income.reduce((sum, w2) => sum + (w2.socialSecurityWages || 0), 0);
      return total ? Math.round(total).toString() : '';
    },
  },

  // Line 9: Subtract line 8d from line 7. If zero or less, enter -0-
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    formLabel: 'Line 9: Subtract line 8d from line 7',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, _calc) => {
      const wageBase = 176100;
      const ssWages = tr.w2Income.reduce((sum, w2) => sum + (w2.socialSecurityWages || 0), 0);
      const remaining = Math.max(0, wageBase - ssWages);
      return remaining ? Math.round(remaining).toString() : '0';
    },
  },

  // Line 10: Multiply the smaller of line 6 or line 9 by 12.4% (0.124)
  {
    pdfFieldName: `${P1}.f1_19[0]`,
    formLabel: 'Line 10: Multiply smaller of line 6 or 9 by 12.4%',
    sourcePath: 'scheduleSE.socialSecurityTax',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 11: Multiply line 6 by 2.9% (0.029)
  {
    pdfFieldName: `${P1}.f1_20[0]`,
    formLabel: 'Line 11: Multiply line 6 by 2.9% (Medicare tax)',
    sourcePath: 'scheduleSE.medicareTax',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 12: Self-employment tax. Add lines 10 and 11.
  {
    pdfFieldName: `${P1}.f1_21[0]`,
    formLabel: 'Line 12: Self-employment tax (add lines 10 and 11)',
    sourcePath: 'scheduleSE.totalSETax',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 13: Deduction for one-half of self-employment tax (line 12 × 50%)
  {
    pdfFieldName: `${P1}.f1_22[0]`,
    formLabel: 'Line 13: Deduction for one-half of SE tax',
    sourcePath: 'scheduleSE.deductibleHalf',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
];

export const SCHEDULE_SE_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040sse',
  displayName: 'Schedule SE',
  attachmentSequence: 17,
  pdfFileName: 'f1040sse.pdf',
  condition: (_tr: TaxReturn, calc: CalculationResult) => {
    return (calc.scheduleSE?.totalSETax ?? 0) > 0;
  },
  fields: SCHEDULE_SE_FIELDS,
};
