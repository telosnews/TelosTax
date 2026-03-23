/**
 * IRS Schedule 3 (Form 1040) 2025 — AcroForm Field Mapping
 *
 * Additional Credits and Payments
 * PDF: client/public/irs-forms/f1040s3.pdf (Schedule 3, 2025, Created 11/17/25)
 * Total fields: 37
 *
 * Field prefix: topmostSubform[0].Page1[0]
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';

const P1 = 'topmostSubform[0].Page1[0]';

export const SCHEDULE_3_FIELDS: IRSFieldMapping[] = [
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
  // Part I — Nonrefundable Credits (Lines 1-8)
  // ════════════════════════════════════════════════════════════════

  // f1_03: Line 1 — Foreign tax credit (Form 1116)
  {
    pdfFieldName: `${P1}.f1_03[0]`,
    formLabel: 'Line 1: Foreign tax credit',
    sourcePath: 'credits.foreignTaxCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_04: Line 2 — Child and dependent care credit (Form 2441)
  {
    pdfFieldName: `${P1}.f1_04[0]`,
    formLabel: 'Line 2: Child and dependent care credit',
    sourcePath: 'credits.dependentCareCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_05: Line 3 — Education credits (Form 8863)
  {
    pdfFieldName: `${P1}.f1_05[0]`,
    formLabel: 'Line 3: Education credits',
    sourcePath: 'credits.educationCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_06: Line 4 — Retirement savings contributions credit (Form 8880)
  {
    pdfFieldName: `${P1}.f1_06[0]`,
    formLabel: 'Line 4: Retirement savings contributions credit',
    sourcePath: 'credits.saversCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_07: Line 5a — Residential clean energy credit (Form 5695, line 15)
  {
    pdfFieldName: `${P1}.f1_07[0]`,
    formLabel: 'Line 5a: Residential clean energy credit',
    sourcePath: 'credits.cleanEnergyCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_08: Line 5b — Energy efficient home improvement credit (Form 5695, line 32)
  {
    pdfFieldName: `${P1}.f1_08[0]`,
    formLabel: 'Line 5b: Energy efficient home improvement credit',
    sourcePath: 'credits.energyEfficiencyCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_09: Line 6 — Other nonrefundable credits:
  // Line 6a: General business credit (Form 3800)
  // Line 6b: Credit for prior year minimum tax (Form 8801)
  // Line 6c: Adoption credit (Form 8839)
  {
    pdfFieldName: `${P1}.Line6a_ReadOrder[0].f1_09[0]`,
    formLabel: 'Line 6c: Adoption credit',
    sourcePath: 'credits.adoptionCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_10: Line 6d — Credit for elderly or disabled (Schedule R)
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 6d: Credit for the elderly or disabled',
    sourcePath: 'credits.elderlyDisabledCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_12: Line 6f — Clean vehicle credit (Form 8936)
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 6f: Clean vehicle credit',
    sourcePath: 'credits.evCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_16: Line 6j — Alternative fuel vehicle refueling property credit (Form 8911)
  {
    pdfFieldName: `${P1}.f1_16[0]`,
    formLabel: 'Line 6j: Alternative fuel vehicle refueling property credit',
    sourcePath: 'credits.evRefuelingCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_23: Line 7 — Total other nonrefundable credits (add 6a-6z)
  {
    pdfFieldName: `${P1}.f1_23[0]`,
    formLabel: 'Line 7: Total other nonrefundable credits',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const c = calc.credits;
      if (!c) return '';
      const total = (c.adoptionCredit || 0) + (c.elderlyDisabledCredit || 0) +
        (c.evCredit || 0) + (c.evRefuelingCredit || 0) + (c.k1OtherCredits || 0) +
        (c.priorYearMinTaxCredit || 0);
      return total ? Math.round(total).toString() : '';
    },
  },

  // f1_24: Line 8 — Total nonrefundable credits (add 1-5b and 7)
  // → goes to Form 1040, line 20
  {
    pdfFieldName: `${P1}.f1_24[0]`,
    formLabel: 'Line 8: Total nonrefundable credits',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const c = calc.credits;
      if (!c) return '';
      const total = (c.foreignTaxCredit || 0) + (c.dependentCareCredit || 0) +
        (c.educationCredit || 0) + (c.saversCredit || 0) +
        (c.cleanEnergyCredit || 0) + (c.energyEfficiencyCredit || 0) +
        (c.adoptionCredit || 0) + (c.elderlyDisabledCredit || 0) +
        (c.evCredit || 0) + (c.evRefuelingCredit || 0) + (c.k1OtherCredits || 0) +
        (c.priorYearMinTaxCredit || 0);
      return total ? Math.round(total).toString() : '';
    },
  },

  // ════════════════════════════════════════════════════════════════
  // Part II — Other Payments and Refundable Credits (Lines 9-15)
  // ════════════════════════════════════════════════════════════════

  // f1_25: Line 9 — Net premium tax credit (Form 8962)
  {
    pdfFieldName: `${P1}.f1_25[0]`,
    formLabel: 'Line 9: Net premium tax credit',
    sourcePath: 'form1040.premiumTaxCreditNet',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_27: Line 11 — Excess SS and tier 1 RRTA tax withheld
  {
    pdfFieldName: `${P1}.f1_27[0]`,
    formLabel: 'Line 11: Excess social security and tier 1 RRTA tax withheld',
    sourcePath: 'credits.excessSSTaxCredit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // f1_35: Line 14 — Total other payments or refundable credits (13a-13z)

  // f1_36: Line 15 — Add lines 9-12 and 14 → goes to Form 1040, line 31
  {
    pdfFieldName: `${P1}.f1_36[0]`,
    formLabel: 'Line 15: Total other payments and refundable credits',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const ptc = calc.form1040.premiumTaxCreditNet || 0;
      const excessSS = calc.credits?.excessSSTaxCredit || 0;
      const total = ptc + excessSS;
      return total ? Math.round(total).toString() : '';
    },
  },
];

export const SCHEDULE_3_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040s3',
  displayName: 'Schedule 3',
  attachmentSequence: 3,
  pdfFileName: 'f1040s3.pdf',
  condition: (_tr, calc) => {
    const c = calc.credits;
    if (!c) return false;
    const hasNonrefundable = (c.foreignTaxCredit || 0) + (c.dependentCareCredit || 0) +
      (c.educationCredit || 0) + (c.saversCredit || 0) +
      (c.cleanEnergyCredit || 0) + (c.energyEfficiencyCredit || 0) +
      (c.adoptionCredit || 0) + (c.elderlyDisabledCredit || 0) +
      (c.evCredit || 0) + (c.evRefuelingCredit || 0) +
      (c.priorYearMinTaxCredit || 0) > 0;
    const hasRefundable = (calc.form1040.premiumTaxCreditNet || 0) +
      (calc.credits?.excessSSTaxCredit || 0) > 0;
    return hasNonrefundable || hasRefundable;
  },
  fields: SCHEDULE_3_FIELDS,
};
