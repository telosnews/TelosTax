/**
 * IRS Schedule R (Form 1040) 2025 -- AcroForm Field Mapping
 *
 * Credit for the Elderly or the Disabled
 * PDF: client/public/irs-forms/f1040sr.pdf (Schedule R, 2025)
 * Attachment Sequence No. 16
 * Total fields: ~20 (text + checkboxes)
 *
 * Field prefix: topmostSubform[0].Page1[0] / topmostSubform[0].Page2[0]
 *
 * Layout:
 *   Page 1 -- Part I: Check the Box for Your Filing Status and Age
 *   f1_1  = Name(s) shown on Form 1040
 *   f1_2  = Your SSN
 *   c1_1[0]                   = Check Box 1: Single, 65 or older
 *   c1_1[1]                   = Check Box 2: Single, under 65, retired on permanent disability
 *   Married[0].c1_1[0]       = Check Box 3: MFJ, both 65 or older
 *   Married[0].c1_1[1]       = Check Box 4: MFJ, both under 65, one or both disabled
 *   Married[0].c1_1[2]       = Check Box 5: MFJ, one 65+, other under 65 (not disabled)
 *   Married[0].c1_1[3]       = Check Box 6: MFJ, one 65+, other under 65 and disabled
 *   Married[0].c1_1[4]       = (unused 5th MFJ variant in 2025 PDF)
 *   MarriedSeparate[0].c1_1[0] = Check Box 7: MFS, 65 or older
 *   MarriedSeparate[0].c1_1[1] = Check Box 8: MFS, under 65, retired on permanent disability
 *   c1_2[0]                   = Check Box 9/10: HoH/QSS (single checkbox in 2025 PDF)
 *
 *   Page 2 -- Part II: Figure Your Credit
 *   f2_1  = Line 10: Initial amount (based on filing status/box checked)
 *   f2_2  = Line 11: Taxable disability income (if under 65)
 *   f2_3  = Line 12: Smaller of line 10 or line 11
 *   f2_4  = Line 13a: Nontaxable Social Security benefits
 *   f2_5  = Line 13b: Nontaxable pensions/annuities/disability income
 *   f2_6  = Line 13c: Nontaxable veterans' benefits (not modeled)
 *   f2_7  = Line 13d: Any other nontaxable income (not modeled)
 *   f2_8  = Line 13e: Add lines 13a through 13d
 *   f2_9  = Line 14: Subtract line 13e from line 12 (credit base before AGI reduction)
 *   f2_10 = Line 15: AGI from Form 1040, line 11
 *   f2_11 = Line 16: AGI threshold amount
 *   f2_12 = Line 17: Subtract line 16 from line 15 (excess AGI)
 *   f2_13 = Line 18: Multiply line 17 by 50% (AGI reduction)
 *   f2_14 = Line 19: Subtract line 18 from line 14 (credit base)
 *   f2_15 = Line 20: Multiply line 19 by 15% (credit)
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P1_MFJ = `${P1}.Married[0]`;
const P1_MFS = `${P1}.MarriedSeparate[0]`;
const P2 = 'topmostSubform[0].Page2[0]';

/** Format a dollar amount -- blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

/**
 * Determine which Schedule R filing status checkbox to check.
 * Returns a box number 1-10 corresponding to the IRS Schedule R Part I boxes.
 */
function getScheduleRBox(tr: TaxReturn): number | undefined {
  const info = tr.scheduleR;
  if (!info) return undefined;

  const fs = tr.filingStatus;
  const is65 = info.isAge65OrOlder;
  const isDisabled = info.isDisabled === true;
  const spouse65 = info.isSpouseAge65OrOlder === true;
  const spouseDisabled = info.isSpouseDisabled === true;

  if (fs === FilingStatus.Single) {
    if (is65) return 1;
    if (isDisabled) return 2;
  } else if (fs === FilingStatus.MarriedFilingJointly) {
    if (is65 && spouse65) return 3;
    if (!is65 && !spouse65 && (isDisabled || spouseDisabled)) return 4;
    if (is65 && !spouse65 && !spouseDisabled) return 5;
    if (is65 && !spouse65 && spouseDisabled) return 6;
    // Mirror: spouse 65+, taxpayer not
    if (!is65 && spouse65 && !isDisabled) return 5;
    if (!is65 && spouse65 && isDisabled) return 6;
  } else if (fs === FilingStatus.MarriedFilingSeparately) {
    if (is65) return 7;
    if (isDisabled) return 8;
  } else {
    // HoH or QSS
    if (is65) return 9;
    if (isDisabled) return 10;
  }
  return undefined;
}

export const SCHEDULE_R_FIELDS: IRSFieldMapping[] = [
  // ======================================================================
  // Header
  // ======================================================================

  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name(s) shown on Form 1040',
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
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ======================================================================
  // Part I -- Filing Status Checkboxes (Boxes 1-10)
  // ======================================================================

  // Box 1: Single, 65 or older
  {
    pdfFieldName: `${P1}.c1_1[0]`,
    formLabel: 'Box 1: Single, 65 or older',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => getScheduleRBox(tr) === 1 ? true : undefined,
  },
  // Box 2: Single, under 65, retired on permanent disability
  {
    pdfFieldName: `${P1}.c1_1[1]`,
    formLabel: 'Box 2: Single, under 65, retired on permanent disability',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => getScheduleRBox(tr) === 2 ? true : undefined,
  },
  // Box 3: MFJ, both 65 or older
  {
    pdfFieldName: `${P1_MFJ}.c1_1[0]`,
    formLabel: 'Box 3: Married filing jointly, both 65 or older',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => getScheduleRBox(tr) === 3 ? true : undefined,
  },
  // Box 4: MFJ, both under 65, one or both disabled
  {
    pdfFieldName: `${P1_MFJ}.c1_1[1]`,
    formLabel: 'Box 4: Married filing jointly, both under 65, one or both disabled',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => getScheduleRBox(tr) === 4 ? true : undefined,
  },
  // Box 5: MFJ, one 65+, other under 65 (not disabled)
  {
    pdfFieldName: `${P1_MFJ}.c1_1[2]`,
    formLabel: 'Box 5: Married filing jointly, one 65+, other under 65 and not disabled',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => getScheduleRBox(tr) === 5 ? true : undefined,
  },
  // Box 6: MFJ, one 65+, other under 65 and disabled
  {
    pdfFieldName: `${P1_MFJ}.c1_1[3]`,
    formLabel: 'Box 6: Married filing jointly, one 65+, other under 65 and disabled',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => getScheduleRBox(tr) === 6 ? true : undefined,
  },
  // Box 7: MFS, 65 or older
  {
    pdfFieldName: `${P1_MFS}.c1_1[0]`,
    formLabel: 'Box 7: Married filing separately, 65 or older',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => getScheduleRBox(tr) === 7 ? true : undefined,
  },
  // Box 8: MFS, under 65, retired on permanent disability
  {
    pdfFieldName: `${P1_MFS}.c1_1[1]`,
    formLabel: 'Box 8: Married filing separately, under 65, retired on permanent disability',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => getScheduleRBox(tr) === 8 ? true : undefined,
  },
  // Boxes 9 & 10: HoH/QSS — the 2025 PDF has a single checkbox (c1_2[0])
  // for the entire HoH/QSS section, so we check it for either box 9 or 10.
  {
    pdfFieldName: `${P1}.c1_2[0]`,
    formLabel: 'Box 9/10: Head of household or qualifying surviving spouse',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => {
      const box = getScheduleRBox(tr);
      return (box === 9 || box === 10) ? true : undefined;
    },
  },

  // ======================================================================
  // Part II -- Figure Your Credit (Page 2)
  // ======================================================================

  // Line 10: Initial amount (based on filing status)
  {
    pdfFieldName: `${P2}.f2_1[0]`,
    formLabel: 'Line 10: Initial amount based on filing status',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleR?.initialAmount),
  },
  // Line 13a: Nontaxable Social Security benefits
  {
    pdfFieldName: `${P2}.f2_4[0]`,
    formLabel: 'Line 13a: Nontaxable Social Security benefits',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleR?.nontaxableSocialSecurity),
  },
  // Line 13b: Nontaxable pensions/annuities/disability income
  {
    pdfFieldName: `${P2}.f2_5[0]`,
    formLabel: 'Line 13b: Nontaxable pensions, annuities, or disability income',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleR?.nontaxablePensions),
  },
  // Line 13e: Total nontaxable income (add 13a through 13d)
  {
    pdfFieldName: `${P2}.f2_8[0]`,
    formLabel: 'Line 13e: Total nontaxable income',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleR?.nontaxableReduction),
  },
  // Line 14: Subtract line 13e from line 12 (credit base before AGI reduction)
  {
    pdfFieldName: `${P2}.f2_9[0]`,
    formLabel: 'Line 14: Subtract line 13e from line 12',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const r = calc.scheduleR;
      if (!r) return undefined;
      const afterNontaxable = Math.max(0, r.initialAmount - r.nontaxableReduction);
      return fmtDollar(afterNontaxable);
    },
  },
  // Line 15: AGI from Form 1040, line 11
  {
    pdfFieldName: `${P2}.f2_10[0]`,
    formLabel: 'Line 15: AGI from Form 1040, line 11',
    sourcePath: 'form1040.agi',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 17: Excess of AGI over threshold
  {
    pdfFieldName: `${P2}.f2_12[0]`,
    formLabel: 'Line 17: Subtract line 16 from line 15',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // AGI reduction is 50% of excess; so excess = agiReduction / 0.5
      const r = calc.scheduleR;
      if (!r || r.agiReduction === 0) return undefined;
      const excess = Math.round(r.agiReduction / 0.5);
      return fmtDollar(excess);
    },
  },
  // Line 18: Multiply line 17 by 50% (AGI reduction amount)
  {
    pdfFieldName: `${P2}.f2_13[0]`,
    formLabel: 'Line 18: Multiply line 17 by 50%',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleR?.agiReduction),
  },
  // Line 19: Credit base (initial amount - nontaxable reduction - AGI reduction)
  {
    pdfFieldName: `${P2}.f2_14[0]`,
    formLabel: 'Line 19: Subtract line 18 from line 14',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleR?.creditBase),
  },
  // Line 20: Credit (line 19 x 15%)
  {
    pdfFieldName: `${P2}.f2_15[0]`,
    formLabel: 'Line 20: Multiply line 19 by 15% (credit for elderly or disabled)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleR?.credit),
  },
];

export const SCHEDULE_R_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040sr',
  displayName: 'Schedule R',
  attachmentSequence: 16,
  pdfFileName: 'f1040sr.pdf',
  condition: (_tr, calc) => calc.scheduleR?.qualifies === true,
  fields: SCHEDULE_R_FIELDS,
};
