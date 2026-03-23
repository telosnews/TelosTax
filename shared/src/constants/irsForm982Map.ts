/**
 * IRS Form 982 (Rev. March 2018) -- AcroForm Field Mapping
 *
 * Reduction of Tax Attributes Due to Discharge of Indebtedness
 * (and Section 1082 Basis Adjustment)
 * PDF: client/public/irs-forms/f982.pdf
 * Attachment Sequence No. 94
 *
 * Field prefix: topmostSubform[0].Page1[0]
 *
 * Layout (verified by PDF field dump with position analysis):
 *   Page 1:
 *     f1_1  = Name shown on return
 *     f1_2  = Identifying number (SSN)
 *
 *     Part I -- General Information (Lines 1a-1e, 2, 3):
 *       c1_1  = Line 1a: Discharge in a title 11 bankruptcy case
 *       c1_2  = Line 1b: Discharge to extent insolvent (not in title 11)
 *       c1_3  = Line 1c: Discharge of qualified farm indebtedness
 *       c1_4  = Line 1d: Discharge of qualified real property business indebtedness
 *       c1_5  = Line 1e: Discharge of qualified principal residence indebtedness
 *       f1_3  = Line 2: Total amount of discharged debt excluded from income
 *       c1_7[0]/[1] = Line 3: Yes/No — elect to treat real property as §1221(a)(1)
 *
 *     Part II -- Reduction of Tax Attributes (Lines 4-13):
 *       f1_4  = Line 4:  Qualified real property business basis reduction
 *       f1_5  = Line 5:  §108(b)(5) election — reduce basis of depreciable property first
 *       f1_6  = Line 6:  NOL reduction
 *       f1_7  = Line 7:  General business credit carryover reduction
 *       f1_8  = Line 8:  Minimum tax credit reduction
 *       f1_9  = Line 9:  Net capital loss / carryover reduction
 *       f1_10 = Line 10a: Basis of nondepreciable and depreciable property
 *       f1_11 = Line 10b: Basis of principal residence (only if Line 1e checked)
 *       f1_12 = Line 11a: Farm — depreciable property basis
 *       f1_13 = Line 11b: Farm — land basis
 *       f1_14 = Line 11c: Farm — other property basis
 *       f1_15 = Line 12:  Passive activity loss / credit carryover reduction
 *       f1_16 = Line 13:  Foreign tax credit carryover reduction
 *
 *     Part III -- Consent of Corporation (Section 1082(a)(2)):
 *       f1_17 = Amount excluded from gross income
 *       f1_18 = Tax year beginning date
 *       f1_19 = Tax year ending date
 *       f1_20 = State of incorporation
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';

/** Format a dollar amount -- blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

export const FORM_982_FIELDS: IRSFieldMapping[] = [
  // ============================================================
  // Header
  // ============================================================

  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name shown on return',
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
    formLabel: 'Identifying number (SSN)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ============================================================
  // Part I -- General Information (Lines 1a-1e, 2, 3)
  // ============================================================

  // Line 1a: Title 11 bankruptcy case
  {
    pdfFieldName: `${P1}.c1_1[0]`,
    formLabel: 'Line 1a: Discharge in a title 11 bankruptcy case',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.form982?.isBankruptcy === true,
  },

  // Line 1b: Insolvent (not in a title 11 case)
  {
    pdfFieldName: `${P1}.c1_2[0]`,
    formLabel: 'Line 1b: Discharge to the extent insolvent (not in title 11)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.form982?.isInsolvent === true && tr.form982?.isBankruptcy !== true,
  },

  // Line 1c: Qualified farm indebtedness
  {
    pdfFieldName: `${P1}.c1_3[0]`,
    formLabel: 'Line 1c: Discharge of qualified farm indebtedness',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.form982?.isQualifiedFarmDebt === true,
  },

  // Line 1d: Qualified real property business indebtedness
  {
    pdfFieldName: `${P1}.c1_4[0]`,
    formLabel: 'Line 1d: Discharge of qualified real property business indebtedness',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => false, // Not modeled in engine
  },

  // Line 1e: Qualified principal residence indebtedness
  {
    pdfFieldName: `${P1}.c1_5[0]`,
    formLabel: 'Line 1e: Discharge of qualified principal residence indebtedness',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.form982?.isQualifiedPrincipalResidence === true,
  },

  // Line 2: Total amount of discharged debt excluded from income
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    formLabel: 'Line 2: Total discharged debt excluded from income',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form982?.exclusionAmount),
  },

  // Line 3: Yes/No — elect to treat real property as §1221(a)(1)
  // Not modeled — left unchecked

  // ============================================================
  // Part II -- Reduction of Tax Attributes (Lines 4-13)
  //
  // Lines 4-5 are specialized (qualified real property business /
  // §108(b)(5) election) — not modeled, left blank.
  //
  // Lines 6-9, 10a, 12 are auto-computed per IRC §108(b)(2).
  // Lines 7-8 (GBC, MTC) are not tracked and always blank.
  // Lines 10b, 11a-c, 13 are specialized — left blank.
  // ============================================================

  // Line 4: Qualified real property business basis reduction (not modeled)
  {
    pdfFieldName: `${P1}.f1_4[0]`,
    formLabel: 'Line 4: Qualified real property business basis reduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },

  // Line 5: §108(b)(5) election to reduce basis of depreciable property first (not modeled)
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Line 5: Election to reduce basis of depreciable property first',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },

  // Line 6: Net operating loss (NOL) reduction
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 6: Net operating loss (NOL) reduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form982?.nolReduction),
  },

  // Line 7: General business credit carryover reduction (not tracked)
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 7: General business credit carryover reduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form982?.gbcReduction),
  },

  // Line 8: Minimum tax credit reduction (not tracked)
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: 'Line 8: Minimum tax credit reduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form982?.mtcReduction),
  },

  // Line 9: Net capital loss / carryover reduction
  {
    pdfFieldName: `${P1}.f1_9[0]`,
    formLabel: 'Line 9: Net capital loss / capital loss carryover reduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form982?.capitalLossReduction),
  },

  // Line 10a: Basis of nondepreciable and depreciable property — remainder
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 10a: Basis reduction of nondepreciable and depreciable property',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form982?.basisReduction),
  },

  // Line 10b: Basis of principal residence (only if Line 1e checked)
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 10b: Basis reduction of principal residence',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined, // Not modeled
  },

  // Line 11a: Farm — depreciable property basis (not modeled)
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 11a: Farm indebtedness — depreciable property basis reduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },

  // Line 11b: Farm — land basis (not modeled)
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 11b: Farm indebtedness — land basis reduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },

  // Line 11c: Farm — other property basis (not modeled)
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    formLabel: 'Line 11c: Farm indebtedness — other property basis reduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },

  // Line 12: Passive activity loss / credit carryover reduction
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 12: Passive activity loss and credit carryover reduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form982?.palReduction),
  },

  // Line 13: Foreign tax credit carryover reduction (not tracked)
  {
    pdfFieldName: `${P1}.f1_16[0]`,
    formLabel: 'Line 13: Foreign tax credit carryover reduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },

  // ============================================================
  // Part III -- Consent of Corporation (Section 1082(a)(2))
  // Not applicable to individuals — left blank.
  // ============================================================

  {
    pdfFieldName: `${P1}.f1_17[0]`,
    formLabel: 'Part III: Amount excluded from gross income',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    formLabel: 'Part III: Tax year beginning',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => undefined,
  },
  {
    pdfFieldName: `${P1}.f1_19[0]`,
    formLabel: 'Part III: Tax year ending',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => undefined,
  },
  {
    pdfFieldName: `${P1}.f1_20[0]`,
    formLabel: 'Part III: State of incorporation',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: () => undefined,
  },
];

export const FORM_982_TEMPLATE: IRSFormTemplate = {
  formId: 'f982',
  displayName: 'Form 982',
  attachmentSequence: 94,
  pdfFileName: 'f982.pdf',
  condition: (_tr: TaxReturn, calc: CalculationResult) =>
    (calc.form982?.exclusionAmount ?? 0) > 0 || (_tr.form982?.isInsolvent === true),
  fields: FORM_982_FIELDS,
};
