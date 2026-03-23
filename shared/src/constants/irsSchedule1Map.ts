/**
 * IRS Schedule 1 (Form 1040) 2025 — AcroForm Field Mapping
 *
 * Additional Income and Adjustments to Income
 * PDF: client/public/irs-forms/f1040s1.pdf (Schedule 1, 2025, Created 7/25/25)
 * Total fields: 73
 *
 * Field prefix: topmostSubform[0].Page1[0] (page 1) / topmostSubform[0].Page2[0] (page 2)
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';

export const SCHEDULE_1_FIELDS: IRSFieldMapping[] = [
  // ── Header ──
  // f1_01: Name
  {
    pdfFieldName: `${P1}.f1_01[0]`,
    formLabel: 'Your name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim(),
  },
  // f1_02: SSN
  {
    pdfFieldName: `${P1}.f1_02[0]`,
    formLabel: 'Your social security number',
    sourcePath: 'ssn',
    source: 'taxReturn',
    format: 'string',
  },

  // ════════════════════════════════════════════════════════════════
  // Part I — Additional Income
  // ════════════════════════════════════════════════════════════════

  // f1_03: Line 1 — Taxable refunds, credits, offsets of SALT
  {
    pdfFieldName: `${P1}.f1_03[0]`,
    formLabel: 'Line 1: Taxable refunds, credits, or offsets of SALT',
    sourcePath: 'form1040.taxableRefund',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_04: Line 2a — Alimony received

  // f1_05: Line 3 — Business income or (loss) from Schedule C
  {
    pdfFieldName: `${P1}.f1_05[0]`,
    formLabel: 'Line 3: Business income or (loss)',
    sourcePath: 'form1040.scheduleCNetProfit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_06: Line 4 — Other gains or (losses) from Form 4797
  {
    pdfFieldName: `${P1}.f1_06[0]`,
    formLabel: 'Line 4: Other gains or (losses)',
    sourcePath: 'form1040.otherGainsOrLosses',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_07: Line 5 — Rental real estate, royalties, partnerships, S corps, trusts
  {
    pdfFieldName: `${P1}.f1_07[0]`,
    formLabel: 'Line 5: Rental real estate, royalties, partnerships, S corps, trusts',
    sourcePath: 'form1040.scheduleEIncome',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_08: Line 6 — Farm income or (loss) from Schedule F
  {
    pdfFieldName: `${P1}.f1_08[0]`,
    formLabel: 'Line 6: Farm income or (loss)',
    sourcePath: 'form1040.scheduleFNetProfit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_09: Line 7 — Unemployment compensation
  {
    pdfFieldName: `${P1}.f1_09[0]`,
    formLabel: 'Line 7: Unemployment compensation',
    sourcePath: 'form1040.totalUnemployment',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_10: Line 8 — Other income
  // Lines 8a-8z are individual sub-items. We'll put the total on Line 9.
  // f1_36: Line 9 — Total other income (sum of 8a-8z)
  {
    pdfFieldName: `${P1}.f1_36[0]`,
    formLabel: 'Line 9: Total other income',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      // Other income that flows through Schedule 1 line 8/9
      const other = calc.form1040.total1099MISCIncome || 0;
      const gambling = calc.form1040.totalGamblingIncome || 0;
      const cancellationOfDebt = calc.form1040.cancellationOfDebtIncome || 0;
      const otherIncome = tr.otherIncome || 0;
      const total = other + gambling + cancellationOfDebt + otherIncome;
      return total ? Math.round(total).toString() : '';
    },
  },

  // f1_37: Line 10 — Combine lines 1 through 7 and 9 = additional income total
  // Note: Capital gains go directly to Form 1040 Line 7, NOT through Schedule 1
  {
    pdfFieldName: `${P1}.f1_37[0]`,
    formLabel: 'Line 10: Total additional income',
    sourcePath: 'form1040.additionalIncome',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // ════════════════════════════════════════════════════════════════
  // Part II — Adjustments to Income (Page 2)
  // ════════════════════════════════════════════════════════════════

  // f2_01: Header name (page 2)
  // f2_02: Line 11 — Educator expenses
  {
    pdfFieldName: `${P2}.f2_02[0]`,
    formLabel: 'Line 11: Educator expenses',
    sourcePath: 'form1040.educatorExpenses',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f2_03: Line 12 — Certain business expenses (Form 2106)

  // f2_04: Line 13 — HSA deduction (Form 8889)
  {
    pdfFieldName: `${P2}.f2_04[0]`,
    formLabel: 'Line 13: HSA deduction',
    sourcePath: 'form1040.hsaDeduction',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f2_05: Line 14 — Moving expenses for Armed Forces
  {
    pdfFieldName: `${P2}.f2_05[0]`,
    formLabel: 'Line 14: Moving expenses for Armed Forces',
    sourcePath: 'form1040.movingExpenses',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f2_06: Line 15 — Deductible part of self-employment tax
  {
    pdfFieldName: `${P2}.f2_06[0]`,
    formLabel: 'Line 15: Deductible part of self-employment tax',
    sourcePath: 'form1040.seDeduction',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f2_07: Line 16 — Self-employed SEP, SIMPLE, qualified plans
  {
    pdfFieldName: `${P2}.f2_07[0]`,
    formLabel: 'Line 16: Self-employed SEP, SIMPLE, and qualified plans',
    sourcePath: 'form1040.retirementContributions',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f2_08: Line 17 — Self-employed health insurance deduction
  {
    pdfFieldName: `${P2}.f2_08[0]`,
    formLabel: 'Line 17: Self-employed health insurance deduction',
    sourcePath: 'form1040.selfEmployedHealthInsurance',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f2_09: Line 18 — Penalty on early withdrawal of savings
  {
    pdfFieldName: `${P2}.f2_09[0]`,
    formLabel: 'Line 18: Penalty on early withdrawal of savings',
    sourcePath: 'form1040.earlyWithdrawalPenalty',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f2_11: Line 20 — IRA deduction
  {
    pdfFieldName: `${P2}.f2_11[0]`,
    formLabel: 'Line 20: IRA deduction',
    sourcePath: 'form1040.iraDeduction',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f2_12: Line 21 — Student loan interest deduction
  {
    pdfFieldName: `${P2}.f2_12[0]`,
    formLabel: 'Line 21: Student loan interest deduction',
    sourcePath: 'form1040.studentLoanInterest',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f2_28: Line 25 — Total other adjustments (24a-24z)

  // f2_29: Line 26 — Total adjustments to income
  {
    pdfFieldName: `${P2}.f2_29[0]`,
    formLabel: 'Line 26: Total adjustments to income',
    sourcePath: 'form1040.totalAdjustments',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
];

export const SCHEDULE_1_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040s1',
  displayName: 'Schedule 1',
  attachmentSequence: 1,
  pdfFileName: 'f1040s1.pdf',
  condition: (_tr, calc) => {
    // Include if any additional income or adjustments exist
    const hasAdditionalIncome = (calc.form1040.additionalIncome || 0) !== 0;
    const hasAdjustments = (calc.form1040.totalAdjustments || 0) !== 0;
    return hasAdditionalIncome || hasAdjustments;
  },
  fields: SCHEDULE_1_FIELDS,
};
