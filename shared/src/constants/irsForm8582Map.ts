/**
 * IRS Form 8582 (2025) — AcroForm Field Mapping
 *
 * Passive Activity Loss Limitations
 * PDF: client/public/irs-forms/f8582.pdf (Form 8582, 2025)
 * Attachment Sequence No. 88
 * Total fields: ~205 text fields across 2 pages
 *
 * Field prefix: topmostSubform[0].Page1[0] / topmostSubform[0].Page2[0]
 *
 * Layout:
 *   Page 1:
 *     f1_01 = Name(s) shown on return
 *     f1_02 = Your SSN
 *
 *     Part I — 2025 Passive Activity Loss (Lines 1–4):
 *       f1_03 = Line 1a: Rental RE activities with active participation — income
 *       f1_04 = Line 1b: Rental RE activities with active participation — loss
 *       f1_05 = Line 1c: Net (combine 1a and 1b)
 *       f1_06 = Line 2a: Commercial revitalization deductions from rental RE — (skip)
 *       f1_07 = Line 2b: (skip)
 *       f1_08 = Line 2c: (skip)
 *       f1_09 = Line 3a: All other passive activities — income
 *       f1_10 = Line 3b: All other passive activities — loss
 *       f1_11 = Line 3c: Net (combine 3a and 3b)
 *       f1_12 = Line 4: Combine lines 1c, 2c, and 3c
 *
 *     Part II — Special Allowance for Rental RE With Active Participation (Lines 5–10):
 *       f1_13 = Line 5: Enter the loss from line 4
 *       f1_14 = Line 6: Enter line 10 of Worksheet 2 (modified AGI)
 *       f1_15 = Line 7: Enter $150,000 ($75,000 if MFS)
 *       f1_16 = Line 8: Subtract line 6 from line 7
 *       f1_17 = Line 9: Multiply line 8 by 50% (.50)
 *       f1_18 = Line 10: Smaller of line 5 or line 9
 *
 *     Part III summary:
 *       f1_19 = Line 16: Total allowed losses (combine Worksheets 5 and 6)
 *
 *   Page 2:
 *     Parts IV–IX: Per-activity worksheets (would need instance support — not mapped here)
 *
 * Engine result: calc.form8582 (Form8582Result)
 *
 * NOTE: Worksheets on pages 1–2 contain per-activity rows that would require
 * instance support. Only summary/total lines are mapped here.
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';

/** Format a dollar amount — blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

export const FORM_8582_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════

  {
    pdfFieldName: `${P1}.f1_01[0]`,
    formLabel: 'Name(s) shown on return',
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
    pdfFieldName: `${P1}.f1_02[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ══════════════════════════════════════════════════════════════
  // Part I — 2025 Passive Activity Loss (Lines 1–4)
  // ══════════════════════════════════════════════════════════════

  // Line 1a: Rental RE activities with active participation — income
  // (positive portion of netRentalActiveIncome)
  {
    pdfFieldName: `${P1}.f1_03[0]`,
    formLabel: 'Line 1a: Rental real estate with active participation - income',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const net = calc.form8582?.netRentalActiveIncome;
      if (net === undefined || net === null || net <= 0) return undefined;
      return fmtDollar(net);
    },
  },
  // Line 1b: Rental RE activities with active participation — loss
  // (absolute value of negative netRentalActiveIncome)
  {
    pdfFieldName: `${P1}.f1_04[0]`,
    formLabel: 'Line 1b: Rental real estate with active participation - loss',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const net = calc.form8582?.netRentalActiveIncome;
      if (net === undefined || net === null || net >= 0) return undefined;
      return fmtDollar(Math.abs(net));
    },
  },
  // Line 1c: Net — combine 1a and 1b
  {
    pdfFieldName: `${P1}.f1_05[0]`,
    formLabel: 'Line 1c: Net rental real estate with active participation',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form8582?.netRentalActiveIncome),
  },

  // Lines 2a–2c: Commercial revitalization deductions from rental RE
  // (not modeled in the engine — skip f1_06, f1_07, f1_08)

  // Line 3a: All other passive activities — income
  // (positive portion of netOtherPassiveIncome)
  {
    pdfFieldName: `${P1}.f1_09[0]`,
    formLabel: 'Line 3a: All other passive activities - income',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const net = calc.form8582?.netOtherPassiveIncome;
      if (net === undefined || net === null || net <= 0) return undefined;
      return fmtDollar(net);
    },
  },
  // Line 3b: All other passive activities — loss
  // (absolute value of negative netOtherPassiveIncome)
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 3b: All other passive activities - loss',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const net = calc.form8582?.netOtherPassiveIncome;
      if (net === undefined || net === null || net >= 0) return undefined;
      return fmtDollar(Math.abs(net));
    },
  },
  // Line 3c: Net — combine 3a and 3b
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 3c: Net other passive activities',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form8582?.netOtherPassiveIncome),
  },
  // Line 4: Combine lines 1c, 2c, and 3c
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 4: Total passive activity loss',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form8582?.combinedNetIncome),
  },

  // ══════════════════════════════════════════════════════════════
  // Part II — Special Allowance for Rental RE With Active
  //           Participation (Lines 5–10)
  // ══════════════════════════════════════════════════════════════

  // Line 5: Enter the loss from line 4 (as a positive number)
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 5: Loss from line 4 (as positive number)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const combined = calc.form8582?.combinedNetIncome;
      if (combined === undefined || combined === null || combined >= 0) return undefined;
      return fmtDollar(Math.abs(combined));
    },
  },
  // Line 7: Enter $150,000 ($75,000 if MFS)
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 7: Modified AGI threshold ($150,000 or $75,000 if MFS)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      if (!calc.form8582 || calc.form8582.combinedNetIncome >= 0) return undefined;
      return tr.filingStatus === FilingStatus.MarriedFilingSeparately ? '75000' : '150000';
    },
  },
  // Line 10: Smaller of line 5 or line 9 (special allowance)
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    formLabel: 'Line 10: Special allowance for rental real estate',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form8582?.specialAllowance),
  },

  // ══════════════════════════════════════════════════════════════
  // Part III (summary) — Total Allowed Losses
  // ══════════════════════════════════════════════════════════════

  // Line 16: Total allowed losses (combine Worksheets 5 and 6)
  {
    pdfFieldName: `${P1}.f1_19[0]`,
    formLabel: 'Line 16: Total allowed passive activity losses',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form8582?.totalAllowedLoss),
  },
];

export const FORM_8582_TEMPLATE: IRSFormTemplate = {
  formId: 'f8582',
  displayName: 'Form 8582',
  attachmentSequence: 88,
  pdfFileName: 'f8582.pdf',
  condition: (_tr, calc) =>
    calc.form8582 != null && calc.form8582.combinedNetIncome < 0,
  fields: FORM_8582_FIELDS,
};
