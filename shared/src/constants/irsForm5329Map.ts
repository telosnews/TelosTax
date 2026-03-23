/**
 * IRS Form 5329 (2025) -- AcroForm Field Mapping
 *
 * Additional Taxes on Qualified Plans (Including IRAs) and Other Tax-Favored Accounts
 * PDF: client/public/irs-forms/f5329.pdf (Form 5329, 2025)
 * Attachment Sequence No. 29
 * Total fields: 74 (text: 73, checkbox: 2)
 *
 * Field prefix: form1[0].Page1[0] / form1[0].Page2[0] / form1[0].Page3[0]
 *
 * Layout:
 *   Page 1:
 *   f1_1  = Name (if different from Form 1040)
 *   f1_2  = Your SSN
 *   f1_3  = Spouse's SSN (if filing jointly and Form 5329 is for spouse)
 *
 *   Part I: Additional Tax on Early Distributions (Lines 1-4):
 *   f1_4  = Line 1: Early distributions included in income (from 1099-R)
 *   f1_5  = Line 2: Early distributions excepted from additional tax
 *   f1_6  = Line 3: Amount subject to additional tax (line 1 - line 2)
 *   f1_7  = Line 4: Additional tax (line 3 x 10%)
 *   (f1_8..f1_34 = remaining Part I-IV fields)
 *
 *   Page 2:
 *   Part V: Additional Tax on Excess Contributions to Traditional IRAs (Lines 17-25):
 *   f2_1  = Line 17: Excess contributions for current year
 *   f2_2  = Line 18: Prior year excess contributions (if any)
 *   f2_3  = Line 19: Current year contribution
 *   f2_4  = Line 20: Current year distributions
 *   f2_5  = Line 21: 2024 tax year excess (if any)
 *   f2_6  = Line 22: Excess contributions subject to tax
 *   f2_7  = Line 23: Excess IRA excise tax (line 22 x 6%)
 *   (f2_8..f2_14 = Part VI: Excess Contributions to Roth IRAs)
 *
 *   Part VII: Additional Tax on Excess Contributions to HSAs (Lines 35-43):
 *   f2_15 = Line 35: Excess HSA contributions for current year
 *   f2_16 = Line 36: Prior year excess contributions (if any)
 *   f2_17 = Line 37: Contributions for current year
 *   f2_18 = Line 38: Distributions used to correct excess
 *   f2_19 = Line 39: Prior year excess (if any)
 *   f2_20 = Line 40: Adjusted excess contributions
 *   f2_21 = Line 41: HSA excise tax (line 40 x 6%)
 *   (f2_22..f2_26 = remaining Part VII-VIII fields)
 *
 *   Page 3:
 *   f3_1..f3_13 = Part IX and signature block
 *   c3_1 = checkbox
 *
 *   c1_1 = Page 1 checkbox (amended return / other)
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';

/** Format a dollar amount -- blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

export const FORM_5329_FIELDS: IRSFieldMapping[] = [
  // ======================================================================
  // Header
  // ======================================================================

  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Your name',
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
  // Part I -- Additional Tax on Early Distributions (Lines 1-4)
  // ======================================================================

  // Line 1: Early distributions included in income
  // Sum of 1099-R distributions with early distribution codes (code 1)
  {
    pdfFieldName: `${P1}.f1_4[0]`,
    formLabel: 'Line 1: Early distributions included in income',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const earlyDist = tr.income1099R
        ?.filter((r) => r.distributionCode === '1')
        .reduce((sum, r) => sum + (r.taxableAmount || 0), 0);
      return fmtDollar(earlyDist);
    },
  },
  // Line 2: Early distributions excepted from additional tax
  // (Exceptions require user input beyond scope -- leave for manual entry)

  // Line 3: Amount subject to additional tax (line 1 - line 2)
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 3: Amount subject to additional tax',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const earlyDist = tr.income1099R
        ?.filter((r) => r.distributionCode === '1')
        .reduce((sum, r) => sum + (r.taxableAmount || 0), 0);
      return fmtDollar(earlyDist);
    },
  },
  // Line 4: Additional tax (line 3 x 10%)
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 4: Additional tax on early distributions (10%)',
    sourcePath: 'form1040.earlyDistributionPenalty',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // ======================================================================
  // Part V -- Additional Tax on Excess Contributions to Traditional IRAs
  // ======================================================================

  // Line 17: Excess contributions for current year (IRA)
  {
    pdfFieldName: `${P2}.f2_1[0]`,
    formLabel: 'Line 17: Excess IRA contributions for current year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.excessContributions?.iraExcessContribution),
  },
  // Line 22: Excess IRA contributions subject to 6% tax
  {
    pdfFieldName: `${P2}.f2_6[0]`,
    formLabel: 'Line 22: Excess IRA contributions subject to tax',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.excessContributions?.iraExcessContribution),
  },
  // Line 23: IRA excise tax (line 22 x 6%)
  {
    pdfFieldName: `${P2}.f2_7[0]`,
    formLabel: 'Line 23: IRA excise tax (6%)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form5329?.iraExciseTax),
  },

  // ======================================================================
  // Part VII -- Additional Tax on Excess Contributions to HSAs
  // ======================================================================

  // Line 35: Excess HSA contributions for current year
  {
    pdfFieldName: `${P2}.f2_15[0]`,
    formLabel: 'Line 35: Excess HSA contributions for current year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.excessContributions?.hsaExcessContribution),
  },
  // Line 40: Excess HSA contributions subject to 6% tax
  {
    pdfFieldName: `${P2}.f2_20[0]`,
    formLabel: 'Line 40: Excess HSA contributions subject to tax',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.excessContributions?.hsaExcessContribution),
  },
  // Line 41: HSA excise tax (line 40 x 6%)
  {
    pdfFieldName: `${P2}.f2_21[0]`,
    formLabel: 'Line 41: HSA excise tax (6%)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form5329?.hsaExciseTax),
  },

  // ======================================================================
  // Total Penalty -- flows to Schedule 2 Line 8
  // ======================================================================

  // The total penalty from Form 5329 combines early distribution penalty
  // and excess contribution excise taxes. This total flows to Schedule 2.
  // Mapped via the form1040.excessContributionPenalty + earlyDistributionPenalty
  // fields in the CalculationResult.
];

export const FORM_5329_TEMPLATE: IRSFormTemplate = {
  formId: 'f5329',
  displayName: 'Form 5329',
  attachmentSequence: 29,
  pdfFileName: 'f5329.pdf',
  condition: (_tr, calc) => {
    const excessPenalty = calc.form5329?.totalPenalty ?? 0;
    const earlyPenalty = calc.form1040.earlyDistributionPenalty ?? 0;
    return excessPenalty > 0 || earlyPenalty > 0;
  },
  fields: FORM_5329_FIELDS,
};
