/**
 * IRS Form 8606 (2025) -- AcroForm Field Mapping
 *
 * Nondeductible IRAs
 * PDF: client/public/irs-forms/f8606.pdf (Form 8606, 2025)
 * Attachment Sequence No. 48
 *
 * Field prefix: topmostSubform[0]
 *
 * Layout:
 *   Page 1:
 *     f1_01 = Name (if different from Form 1040)
 *     f1_02 = Your social security number
 *
 *     Part I: Nondeductible Contributions to Traditional IRAs and
 *             Distributions From Traditional, SEP, and SIMPLE IRAs
 *       f1_03 = Line 1: Enter your nondeductible contributions to traditional IRAs for 2025
 *       f1_04 = Line 2: Enter your total basis in traditional IRAs (from prior year Form 8606, line 14)
 *       f1_05 = Line 3: Add lines 1 and 2
 *       f1_06 = Line 4: Contributions withdrawn between 1/1 and 4/15/2026
 *       f1_07 = Line 5: Subtract line 4 from line 3
 *       f1_08 = Line 6: Enter the value of ALL your traditional, SEP, and SIMPLE IRAs
 *                        as of 12/31/2025 plus outstanding rollovers
 *       f1_09 = Line 7: Enter your distributions from traditional, SEP, and SIMPLE IRAs in 2025
 *       f1_10 = Line 8: Enter the net amount you converted from traditional, SEP, and SIMPLE
 *                        IRAs to Roth IRAs in 2025
 *       f1_11 = Line 9: Add lines 6, 7, and 8
 *       f1_12 = Line 10: Divide line 5 by line 9. Enter result as decimal (not %)
 *       f1_13 = Line 11: Multiply line 8 by line 10. Non-taxable portion of conversion.
 *       f1_14 = Line 12: Multiply line 7 by line 10. Non-taxable portion of distributions.
 *       f1_15 = Line 13: Add lines 11 and 12. Total non-deductible portion.
 *       f1_16 = Line 14: Subtract line 13 from line 3. This is your total basis in
 *                         traditional IRAs for 2025 and earlier years.
 *       f1_17 = Line 15a: Taxable amount of conversion. Subtract line 11 from line 8.
 *       f1_18 = Line 15b: Taxable amount of distributions. Subtract line 12 from line 7.
 *       f1_19 = Line 15c: Add lines 15a and 15b. Total taxable amount.
 *
 *     Part II: 2025 Conversions From Traditional, SEP, or SIMPLE IRAs to Roth IRAs
 *       f1_20 = Line 16: If you completed Part I, enter the amount from line 8.
 *       f1_21 = Line 17: Contributions to Roth IRAs that were converted back (recharacterized)
 *       f1_22 = Line 18: Net conversion amount. Subtract line 17 from line 16.
 *       f1_23 = Supplemental field (if applicable)
 *
 *   Page 2:
 *     Part III: Distributions From Roth IRAs
 *       f2_01 = Line 19: Enter your total nonqualified distributions from Roth IRAs
 *       f2_02 = Line 20: Qualified first-time homebuyer expenses
 *       f2_03 = Line 21: Subtract line 20 from line 19
 *       f2_04 = Line 22: Enter your basis in Roth IRA contributions
 *       f2_05 = Line 23: Subtract line 22 from line 21 (if zero or less, enter 0)
 *       f2_06 = Line 24: Enter your basis in conversions from traditional, SEP, and SIMPLE IRAs
 *       f2_07 = Line 25a: Taxable amount. Subtract line 24 from line 23 (if zero or less, enter 0)
 *       f2_08 = Line 25b: Amount attributable to earnings -- early distribution penalty
 *       f2_09..f2_21 = Additional lines for Part III detail (less common)
 *       c2_1 = Checkbox: Did you take a distribution from a Roth IRA in 2025?
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

export const FORM_8606_FIELDS: IRSFieldMapping[] = [
  // ============================================================
  // Header
  // ============================================================

  {
    pdfFieldName: `${P1}.f1_01[0]`,
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
    pdfFieldName: `${P1}.f1_02[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ============================================================
  // Part I: Nondeductible Contributions and Distributions
  // ============================================================

  // Line 1: Nondeductible contributions to traditional IRAs for current year
  {
    pdfFieldName: `${P1}.f1_03[0]`,
    formLabel: 'Line 1: Nondeductible contributions to traditional IRAs',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.form8606?.nondeductibleContributions),
  },

  // Line 2: Total basis in traditional IRAs (prior year Form 8606, line 14)
  {
    pdfFieldName: `${P1}.f1_04[0]`,
    formLabel: 'Line 2: Total basis in traditional IRAs (prior year)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.form8606?.priorYearBasis),
  },

  // Line 3: Add lines 1 and 2 (total basis)
  {
    pdfFieldName: `${P1}.f1_05[0]`,
    formLabel: 'Line 3: Total basis (add lines 1 and 2)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const info = tr.form8606;
      if (!info) return undefined;
      const total = (info.nondeductibleContributions || 0) + (info.priorYearBasis || 0);
      return fmtDollar(total);
    },
  },

  // Line 5: Same as line 3 (line 4 = withdrawn contributions, typically 0)
  // We output line 3 value since we don't track mid-year contribution withdrawals
  {
    pdfFieldName: `${P1}.f1_07[0]`,
    formLabel: 'Line 5: Subtract line 4 from line 3',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const info = tr.form8606;
      if (!info) return undefined;
      const total = (info.nondeductibleContributions || 0) + (info.priorYearBasis || 0);
      return fmtDollar(total);
    },
  },

  // Line 6: Value of ALL traditional, SEP, and SIMPLE IRAs as of 12/31
  // plus outstanding rollovers
  {
    pdfFieldName: `${P1}.f1_08[0]`,
    formLabel: 'Line 6: Value of all traditional, SEP, and SIMPLE IRAs as of 12/31',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.form8606?.traditionalIRABalance),
  },

  // Line 8: Net amount converted from traditional/SEP/SIMPLE IRAs to Roth
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 8: Net amount converted to Roth IRAs',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.form8606?.rothConversionAmount),
  },

  // Line 7: Distributions from traditional, SEP, and SIMPLE IRAs (excluding conversions)
  {
    pdfFieldName: `${P1}.f1_09[0]`,
    formLabel: 'Line 7: Distributions from traditional, SEP, and SIMPLE IRAs',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form8606?.regularDistributions),
  },

  // Line 9: Add lines 6, 7, and 8 (total IRA value for pro-rata calculation)
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 9: Total IRA value (add lines 6, 7, and 8)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const info = tr.form8606;
      if (!info) return undefined;
      const distributions = calc.form8606?.regularDistributions || 0;
      const total = (info.traditionalIRABalance || 0) + distributions + (info.rothConversionAmount || 0);
      return fmtDollar(total);
    },
  },

  // Line 10: Divide line 5 by line 9 (non-taxable ratio as decimal)
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 10: Non-taxable ratio (line 5 / line 9)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'string',
    transform: (tr, calc) => {
      const f8606 = calc.form8606;
      if (!f8606 || (f8606.taxableConversion === 0 && f8606.remainingBasis === 0
        && f8606.nonTaxableDistributions === 0)) return undefined;
      const info = tr.form8606;
      if (!info) return undefined;
      const totalBasis = (info.nondeductibleContributions || 0) + (info.priorYearBasis || 0);
      const distributions = f8606.regularDistributions || 0;
      const totalIRAValue = (info.traditionalIRABalance || 0) + distributions + (info.rothConversionAmount || 0);
      if (totalIRAValue <= 0) return undefined;
      const ratio = Math.min(1, totalBasis / totalIRAValue);
      return ratio > 0 ? ratio.toFixed(4) : undefined;
    },
  },

  // Line 11: Multiply line 8 by line 10 (non-taxable portion of conversion)
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 11: Non-taxable portion of Roth conversion',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const info = tr.form8606;
      const f8606 = calc.form8606;
      if (!info || !f8606) return undefined;
      const conversionAmount = info.rothConversionAmount || 0;
      if (conversionAmount <= 0) return undefined;
      const nonTaxablePortion = Math.max(0, conversionAmount - f8606.taxableConversion);
      return fmtDollar(nonTaxablePortion);
    },
  },

  // Line 12: Multiply line 7 by line 10 (non-taxable portion of regular distributions)
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    formLabel: 'Line 12: Non-taxable portion of distributions',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const f8606 = calc.form8606;
      if (!f8606 || f8606.nonTaxableDistributions <= 0) return undefined;
      return fmtDollar(f8606.nonTaxableDistributions);
    },
  },

  // Line 13: Add lines 11 and 12 (total non-taxable portion)
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 13: Total non-deductible portion (add lines 11 and 12)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const info = tr.form8606;
      const f8606 = calc.form8606;
      if (!info || !f8606) return undefined;
      const conversionAmount = info.rothConversionAmount || 0;
      const nonTaxableConversion = conversionAmount > 0 ? Math.max(0, conversionAmount - f8606.taxableConversion) : 0;
      const nonTaxableDistributions = f8606.nonTaxableDistributions || 0;
      const total = nonTaxableConversion + nonTaxableDistributions;
      return total > 0 ? fmtDollar(total) : undefined;
    },
  },

  // Line 14: Basis in traditional IRAs for current and earlier years
  // (line 3 minus line 13) = remaining basis carried forward
  {
    pdfFieldName: `${P1}.f1_16[0]`,
    formLabel: 'Line 14: Remaining basis in traditional IRAs',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form8606?.remainingBasis),
  },

  // Line 15a: Taxable amount of conversion (line 8 minus line 11)
  {
    pdfFieldName: `${P1}.f1_17[0]`,
    formLabel: 'Line 15a: Taxable amount of Roth conversion',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form8606?.taxableConversion),
  },

  // Line 15b: Taxable amount of distributions (line 7 minus line 12)
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    formLabel: 'Line 15b: Taxable amount of distributions',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const f8606 = calc.form8606;
      if (!f8606 || (f8606.regularDistributions || 0) <= 0) return undefined;
      return fmtDollar(f8606.taxableDistributions);
    },
  },

  // Line 15c: Total taxable amount (line 15a + line 15b)
  {
    pdfFieldName: `${P1}.f1_19[0]`,
    formLabel: 'Line 15c: Total taxable amount',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const f8606 = calc.form8606;
      if (!f8606) return undefined;
      return fmtDollar(f8606.taxableConversion + (f8606.taxableDistributions || 0));
    },
  },

  // ============================================================
  // Part II: Conversions From Traditional, SEP, or SIMPLE IRAs to Roth IRAs
  // ============================================================

  // Line 16: Amount from line 8 (conversion amount)
  {
    pdfFieldName: `${P1}.f1_20[0]`,
    formLabel: 'Line 16: Amount converted to Roth IRAs (from line 8)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.form8606?.rothConversionAmount),
  },

  // Line 18: Net conversion amount (line 16 minus line 17, where line 17 = recharacterizations)
  // Since we don't track recharacterizations, this equals the full conversion amount
  {
    pdfFieldName: `${P1}.f1_22[0]`,
    formLabel: 'Line 18: Net conversion amount',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.form8606?.rothConversionAmount),
  },
];

export const FORM_8606_TEMPLATE: IRSFormTemplate = {
  formId: 'f8606',
  displayName: 'Form 8606',
  attachmentSequence: 48,
  pdfFileName: 'f8606.pdf',

  condition: (tr: TaxReturn, calc: CalculationResult) => {
    // Form 8606 is needed when there is a Roth conversion or nondeductible IRA contribution
    const info = tr.form8606;
    if (!info) return false;

    const hasConversion = (info.rothConversionAmount || 0) > 0;
    const hasNondeductible = (info.nondeductibleContributions || 0) > 0;
    const hasPriorBasis = (info.priorYearBasis || 0) > 0;

    return hasConversion || hasNondeductible || hasPriorBasis;
  },

  fields: FORM_8606_FIELDS,
};
