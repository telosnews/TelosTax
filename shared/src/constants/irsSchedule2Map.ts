/**
 * IRS Schedule 2 (Form 1040) 2025 — AcroForm Field Mapping
 *
 * Additional Taxes
 * PDF: client/public/irs-forms/f1040s2.pdf (Schedule 2, 2025, Created 5/8/25)
 * Total fields: 63
 *
 * Field prefix: form1[0].Page1[0] (page 1) / form1[0].Page2[0] (page 2)
 * NOTE: Schedule 2 uses "form1" prefix, NOT "topmostSubform"
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';

const P1 = 'form1[0].Page1[0]';
const P2 = 'form1[0].Page2[0]';

export const SCHEDULE_2_FIELDS: IRSFieldMapping[] = [
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
  // Part I — Tax (Lines 1-3)
  // ════════════════════════════════════════════════════════════════

  // f1_03: Line 1a — Excess advance premium tax credit repayment (Form 8962)
  {
    pdfFieldName: `${P1}.Line1a_ReadOrder[0].f1_03[0]`,
    formLabel: 'Line 1a: Excess advance premium tax credit repayment',
    sourcePath: 'form1040.excessAPTCRepayment',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_10: Line 1z — Add lines 1a through 1y
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 1z: Total of lines 1a through 1y',
    sourcePath: 'form1040.excessAPTCRepayment',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_11: Line 2 — Alternative minimum tax (Form 6251)
  // AMT not computed by our engine — leave blank

  // f1_12: Line 3 — Add lines 1z and 2 → goes to Form 1040, line 17
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 3: Add lines 1z and 2',
    sourcePath: 'form1040.excessAPTCRepayment',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // ════════════════════════════════════════════════════════════════
  // Part II — Other Taxes (Lines 4-21)
  // ════════════════════════════════════════════════════════════════

  // f1_13: Line 4 — Self-employment tax (Schedule SE)
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 4: Self-employment tax',
    sourcePath: 'form1040.seTax',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_15: Line 5 — SS and Medicare tax on unreported tips (Form 4137)
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 5: SS and Medicare tax on unreported tips',
    sourcePath: 'form1040.form4137Tax',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_16: Line 6 — Uncollected SS/Medicare on wages (Form 8919)

  // f1_17: Line 7 — Total additional SS/Medicare (add lines 5 and 6)
  {
    pdfFieldName: `${P1}.f1_17[0]`,
    formLabel: 'Line 7: Total additional social security and Medicare tax',
    sourcePath: 'form1040.form4137Tax',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_18: Line 8 — Additional tax on IRAs/tax-favored accounts (Form 5329)
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    formLabel: 'Line 8: Additional tax on IRAs or other tax-favored accounts',
    sourcePath: 'form1040.excessContributionPenalty',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_19: Line 9 — Household employment taxes (Schedule H)
  {
    pdfFieldName: `${P1}.f1_19[0]`,
    formLabel: 'Line 9: Household employment taxes',
    sourcePath: 'form1040.householdEmploymentTax',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_20: Line 10 — Reserved for future use

  // f1_21: Line 11 — Additional Medicare Tax (Form 8959)
  {
    pdfFieldName: `${P1}.f1_21[0]`,
    formLabel: 'Line 11: Additional Medicare Tax',
    sourcePath: 'form1040.additionalMedicareTaxW2',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_22: Line 12 — Net investment income tax (Form 8960)
  {
    pdfFieldName: `${P1}.f1_22[0]`,
    formLabel: 'Line 12: Net investment income tax',
    sourcePath: 'form1040.niitTax',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_27: Line 21 — Total other taxes (on page 2)
  // Page 2 fields:
  // f2_20: Line 18 — Total additional taxes (17a-17z)
  // f2_21: Line 19 — Recapture of net EPE
  // f2_22: Line 20 — Section 965 net tax
  // f2_23: Line 21 — Add lines 4, 7, 8-16, 18, 19
  {
    pdfFieldName: `${P2}.f2_23[0]`,
    formLabel: 'Line 21: Total additional taxes',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const seTax = calc.form1040.seTax || 0;
      const schedH = calc.form1040.householdEmploymentTax || 0;
      const addlMedicare = calc.form1040.additionalMedicareTaxW2 || 0;
      const niit = calc.form1040.niitTax || 0;
      const form5329 = calc.form1040.excessContributionPenalty || 0;
      const unreportedTip = calc.form1040.form4137Tax || 0;
      const total = seTax + schedH + addlMedicare + niit + form5329 + unreportedTip;
      return total ? Math.round(total).toString() : '';
    },
  },
];

export const SCHEDULE_2_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040s2',
  displayName: 'Schedule 2',
  attachmentSequence: 2,
  pdfFileName: 'f1040s2.pdf',
  condition: (_tr, calc) => {
    const seTax = calc.form1040.seTax || 0;
    const schedH = calc.form1040.householdEmploymentTax || 0;
    const addlMedicare = calc.form1040.additionalMedicareTaxW2 || 0;
    const niit = calc.form1040.niitTax || 0;
    const form5329 = calc.form1040.excessContributionPenalty || 0;
    const excessAPTC = calc.form1040.excessAPTCRepayment || 0;
    return (seTax + schedH + addlMedicare + niit + form5329 + excessAPTC) > 0;
  },
  fields: SCHEDULE_2_FIELDS,
};
