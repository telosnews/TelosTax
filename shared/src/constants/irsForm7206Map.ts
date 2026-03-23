/**
 * IRS Form 7206 (2025) — AcroForm Field Mapping
 *
 * Self-Employed Health Insurance Deduction
 * Attachment Sequence No. 35
 *
 * Note: Exact AcroForm field names depend on the 2025 fillable PDF.
 * Structure is mapped now; PDF field names should be populated when
 * the IRS releases the fillable PDF for TY2025.
 *
 * Field prefix: topmostSubform[0].Page1[0] (assumed single-page form)
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';

const P1 = 'topmostSubform[0].Page1[0]';

export const FORM_7206_FIELDS: IRSFieldMapping[] = [
  // Header
  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Your name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim(),
  },
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Your social security number',
    sourcePath: 'ssn',
    source: 'taxReturn',
    format: 'ssn',
  },

  // Part I — Premiums
  // Line 1: Medical/dental/vision premiums
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    formLabel: 'Line 1: Medical, dental, and vision insurance premiums',
    sourcePath: 'form7206.medicalDentalVisionPremiums',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 2: Long-term care premiums (after age-based limit)
  {
    pdfFieldName: `${P1}.f1_4[0]`,
    formLabel: 'Line 2: Long-term care insurance premiums',
    sourcePath: 'form7206.longTermCarePremiumsClaimed',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 3: Medicare premiums
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Line 3: Medicare premiums',
    sourcePath: 'form7206.medicarePremiums',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 4: Total premiums
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 4: Total premiums',
    sourcePath: 'form7206.totalPremiums',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Part II — Proration
  // Line 5: Eligible months
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 5: Number of eligible months',
    sourcePath: 'form7206.eligibleMonths',
    source: 'calculationResult',
    format: 'integer',
  },
  // Line 6: Prorated premiums
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: 'Line 6: Prorated premiums',
    sourcePath: 'form7206.proratedPremiums',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Part III — Limitation
  // Line 7: Net SE profit
  {
    pdfFieldName: `${P1}.f1_9[0]`,
    formLabel: 'Line 7: Net self-employment profit',
    sourcePath: 'form7206.netSEProfit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 8: Deductible half of SE tax
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 8: Deductible half of self-employment tax',
    sourcePath: 'form7206.deductibleHalfSETax',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 9: SE retirement contributions
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 9: Self-employed retirement plan contributions',
    sourcePath: 'form7206.seRetirementContributions',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 10: Adjusted net SE profit
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 10: Adjusted net self-employment profit',
    sourcePath: 'form7206.adjustedNetSEProfit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 11: Net profit limited amount
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 11: Smaller of line 6 or line 10',
    sourcePath: 'form7206.netProfitLimitedAmount',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 12: PTC adjustment
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    formLabel: 'Line 12: Premium tax credit adjustment',
    sourcePath: 'form7206.ptcAdjustment',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 13: Final deduction (→ Schedule 1 Line 17)
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 13: Self-employed health insurance deduction',
    sourcePath: 'form7206.finalDeduction',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
];

export const FORM_7206_TEMPLATE: IRSFormTemplate = {
  formId: 'f7206',
  displayName: 'Form 7206',
  attachmentSequence: 35,
  pdfFileName: 'f7206.pdf',
  condition: (_tr, calc) => (calc.form7206?.finalDeduction || 0) > 0,
  fields: FORM_7206_FIELDS,
};
