/**
 * IRS Form 8889 (2025) -- AcroForm Field Mapping
 *
 * Health Savings Accounts (HSAs)
 * PDF: client/public/irs-forms/f8889.pdf (Form 8889, 2025)
 * Attachment Sequence No. 52
 * Total fields: 27 (text: 24, checkbox: 3)
 *
 * Field prefix: topmostSubform[0].Page1[0]
 *
 * Layout:
 *   f1_1  = Name shown on Form 1040 or 1040-SR
 *   f1_2  = Social security number
 *
 *   Coverage type checkboxes:
 *   c1_1[0] = Self-only coverage
 *   c1_1[1] = Family coverage
 *
 *   Part I -- HSA Contributions and Deduction (Lines 2-13):
 *   f1_3  = Line 2:  HSA contributions you made for 2025 (not employer)
 *   f1_4  = Line 3:  Employer contributions (from W-2 Box 12, Code W)
 *   f1_5  = Line 4:  Qualified HSA funding distributions from IRA
 *   f1_6  = Line 5:  Subtract line 4 from line 3
 *   f1_7  = Line 6:  HSA contribution limit ($4,300 self-only / $8,550 family)
 *   f1_8  = Line 7:  Additional catch-up contribution if 55+ ($1,000)
 *   f1_9  = Line 8:  Add lines 6 and 7
 *   f1_10 = Line 9:  Subtract line 5 from line 8
 *   f1_11 = Line 10: Compensation from employer maintaining HDHP
 *   f1_12 = Line 11: Lesser of line 9 or line 10
 *   f1_13 = Line 12: Contributions from line 2 not in excess of limitation
 *   f1_14 = Line 13: HSA deduction (smaller of line 2 or line 12)
 *
 *   Part II -- HSA Distributions (Lines 14a-17b):
 *   f1_15 = Line 14a: Total distributions received in 2025
 *   f1_16 = Line 14b: Distributions rolled over (included in 14a)
 *   f1_17 = Line 14c: Subtract line 14b from line 14a
 *   f1_18 = Line 15:  Qualified medical expenses paid (not reimbursed)
 *   f1_19 = Line 16:  Taxable HSA distributions (14c minus 15, if more than zero)
 *   c1_2  = Line 17b: Exception to additional 20% tax checkbox
 *   f1_20 = Line 17a: If taxable distributions and under age 65/not disabled
 *   f1_21 = Line 17b: Additional 20% tax (line 17a x 20%)
 *
 *   Part III -- Income and Additional Tax for Failure to Maintain HDHP (Lines 18-20):
 *   f1_22 = Line 18: Last-month rule contributions included in line 2
 *   f1_23 = Line 19: Qualified HSA funding distributions included in line 4
 *   f1_24 = Line 20: Total income from failure to maintain HDHP coverage
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

export const FORM_8889_FIELDS: IRSFieldMapping[] = [
  // ======================================================================
  // Header
  // ======================================================================

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
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ======================================================================
  // Coverage Type Checkboxes
  // ======================================================================

  // Self-only coverage
  {
    pdfFieldName: `${P1}.c1_1[0]`,
    formLabel: 'Coverage type: Self-only',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.hsaContribution?.coverageType === 'self_only',
  },
  // Family coverage
  {
    pdfFieldName: `${P1}.c1_1[1]`,
    formLabel: 'Coverage type: Family',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.hsaContribution?.coverageType === 'family',
  },

  // ======================================================================
  // Part I -- HSA Contributions and Deduction (Lines 2-13)
  // ======================================================================

  // Line 2: HSA contributions you made for 2025 (employee contributions only)
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    formLabel: 'Line 2: HSA contributions you made for 2025',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.hsaContribution?.totalContributions),
  },
  // Line 3: Employer contributions (W-2 Box 12, Code W)
  {
    pdfFieldName: `${P1}.f1_4[0]`,
    formLabel: 'Line 3: Employer contributions (W-2 Box 12, Code W)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.hsaContribution?.employerContributions),
  },
  // Line 4: Qualified HSA funding distribution from IRA
  // (Not tracked in engine -- manual entry)
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Line 4: Qualified HSA funding distribution from IRA',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 5: Subtract line 4 from line 3
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 5: Subtract line 4 from line 3',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      // Line 5 = Line 3 - Line 4; Line 4 is not tracked, so Line 5 = Line 3
      return fmtDollar(tr.hsaContribution?.employerContributions);
    },
  },
  // Line 6: HSA contribution limit — prorated for partial-year HDHP coverage (Form 8889 Worksheet)
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 6: HSA contribution limit',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      if (!tr.hsaContribution) return undefined;
      const baseLimit = tr.hsaContribution.coverageType === 'family' ? 8550 : 4300;
      const months = Math.min(12, Math.max(1, tr.hsaContribution.hdhpCoverageMonths ?? 12));
      return fmtDollar(months === 12 ? baseLimit : Math.round(baseLimit * months / 12));
    },
  },
  // Line 7: Additional catch-up contribution ($1,000 if age 55+) — flat, not prorated
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: 'Line 7: Additional catch-up contribution (age 55+)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const catchUp = tr.hsaContribution?.catchUpContributions ?? 0;
      return catchUp > 0 ? fmtDollar(1000) : undefined;
    },
  },
  // Line 8: Add lines 6 and 7
  {
    pdfFieldName: `${P1}.f1_9[0]`,
    formLabel: 'Line 8: Add lines 6 and 7',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      if (!tr.hsaContribution) return undefined;
      const baseLimit = tr.hsaContribution.coverageType === 'family' ? 8550 : 4300;
      const months = Math.min(12, Math.max(1, tr.hsaContribution.hdhpCoverageMonths ?? 12));
      const line6 = months === 12 ? baseLimit : Math.round(baseLimit * months / 12);
      const catchUp = (tr.hsaContribution.catchUpContributions ?? 0) > 0 ? 1000 : 0;
      return fmtDollar(line6 + catchUp);
    },
  },
  // Line 9: Subtract line 5 from line 8
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 9: Subtract line 5 from line 8',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      if (!tr.hsaContribution) return undefined;
      const baseLimit = tr.hsaContribution.coverageType === 'family' ? 8550 : 4300;
      const months = Math.min(12, Math.max(1, tr.hsaContribution.hdhpCoverageMonths ?? 12));
      const line6 = months === 12 ? baseLimit : Math.round(baseLimit * months / 12);
      const catchUp = (tr.hsaContribution.catchUpContributions ?? 0) > 0 ? 1000 : 0;
      const line8 = line6 + catchUp;
      const line5 = tr.hsaContribution.employerContributions ?? 0; // Line 4 not tracked
      return fmtDollar(Math.max(line8 - line5, 0));
    },
  },
  // Line 10: Compensation from employer maintaining HDHP
  // (Not separately tracked in engine -- manual entry)
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 10: Compensation from employer maintaining HDHP',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 11: Lesser of line 9 or line 10
  // (Line 10 not tracked -- manual entry)
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 11: Lesser of line 9 or line 10',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 12: Contributions from line 2 not in excess of limitation
  // (Depends on lines 9/11 -- best approximation is min of line 2 and line 9)
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 12: Contributions not in excess of limitation',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      if (!tr.hsaContribution) return undefined;
      const baseLimit = tr.hsaContribution.coverageType === 'family' ? 8550 : 4300;
      const months = Math.min(12, Math.max(1, tr.hsaContribution.hdhpCoverageMonths ?? 12));
      const line6 = months === 12 ? baseLimit : Math.round(baseLimit * months / 12);
      const catchUp = (tr.hsaContribution.catchUpContributions ?? 0) > 0 ? 1000 : 0;
      const line8 = line6 + catchUp;
      const line5 = tr.hsaContribution.employerContributions ?? 0;
      const line9 = Math.max(line8 - line5, 0);
      const line2 = tr.hsaContribution.totalContributions ?? 0;
      return fmtDollar(Math.min(line2, line9));
    },
  },
  // Line 13: HSA deduction (smaller of line 2 or line 12) -- flows to Schedule 1
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    formLabel: 'Line 13: HSA deduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form1040.hsaDeductionComputed),
  },

  // ======================================================================
  // Part II -- HSA Distributions (Lines 14a-17b)
  // ======================================================================

  // Line 14a: Total distributions received in 2025
  // (Total distributions not separately tracked; taxable + qualified = total)
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 14a: Total distributions received',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 14b: Distributions rolled over
  {
    pdfFieldName: `${P1}.f1_16[0]`,
    formLabel: 'Line 14b: Distributions rolled over',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 14c: Subtract line 14b from line 14a
  {
    pdfFieldName: `${P1}.f1_17[0]`,
    formLabel: 'Line 14c: Subtract line 14b from line 14a',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 15: Qualified medical expenses paid (not reimbursed)
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    formLabel: 'Line 15: Qualified medical expenses paid',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 16: Taxable HSA distributions (14c minus 15, if more than zero)
  {
    pdfFieldName: `${P1}.f1_19[0]`,
    formLabel: 'Line 16: Taxable HSA distributions',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.hsaDistributions?.totalTaxable),
  },
  // Line 17b: Exception to additional 20% tax checkbox
  {
    pdfFieldName: `${P1}.c1_2[0]`,
    formLabel: 'Line 17b: Exception to additional 20% tax applies',
    sourcePath: '',
    source: 'calculationResult',
    format: 'checkbox',
    transform: (_tr, calc) => {
      // Check if there are taxable distributions but no penalty (exception applies)
      const taxable = calc.hsaDistributions?.totalTaxable ?? 0;
      const penalty = calc.hsaDistributions?.totalPenalty ?? 0;
      return taxable > 0 && penalty === 0;
    },
  },
  // Line 17a: Taxable amount subject to 20% additional tax
  {
    pdfFieldName: `${P1}.f1_20[0]`,
    formLabel: 'Line 17a: Amount subject to additional 20% tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // If penalty exists, compute the base (penalty / 0.20)
      const penalty = calc.hsaDistributions?.totalPenalty ?? 0;
      if (penalty <= 0) return undefined;
      return fmtDollar(Math.round(penalty / 0.20));
    },
  },
  // Line 17b amount: Additional 20% tax
  {
    pdfFieldName: `${P1}.f1_21[0]`,
    formLabel: 'Line 17b: Additional 20% tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.hsaDistributions?.totalPenalty),
  },

  // ======================================================================
  // Part III -- Income and Additional Tax for Failure to Maintain HDHP
  // ======================================================================

  // Line 18: Last-month rule contributions included in line 2
  // (Not tracked in engine -- manual entry)
  {
    pdfFieldName: `${P1}.f1_22[0]`,
    formLabel: 'Line 18: Last-month rule contributions',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 19: Qualified HSA funding distributions included in line 4
  // (Not tracked in engine -- manual entry)
  {
    pdfFieldName: `${P1}.f1_23[0]`,
    formLabel: 'Line 19: Qualified HSA funding distributions',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
  // Line 20: Total income from failure to maintain HDHP coverage
  // (Not tracked in engine -- manual entry)
  {
    pdfFieldName: `${P1}.f1_24[0]`,
    formLabel: 'Line 20: Income from failure to maintain HDHP coverage',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => undefined,
  },
];

export const FORM_8889_TEMPLATE: IRSFormTemplate = {
  formId: 'f8889',
  displayName: 'Form 8889',
  attachmentSequence: 52,
  pdfFileName: 'f8889.pdf',
  condition: (tr, calc) => {
    const hasContributions = (tr.hsaContribution?.totalContributions ?? 0) > 0;
    const hasTaxableDistributions = (calc.hsaDistributions?.totalTaxable ?? 0) > 0;
    return hasContributions || hasTaxableDistributions;
  },
  fields: FORM_8889_FIELDS,
};
