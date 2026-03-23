/**
 * IRS Form 4952 (2025) -- AcroForm Field Mapping
 *
 * Investment Interest Expense Deduction
 * PDF: client/public/irs-forms/f4952.pdf (Form 4952, 2025)
 * Attachment Sequence No. 51
 *
 * Field prefix: topmostSubform[0].Page1[0]
 *
 * Layout (single page):
 *   f1_01 = Name(s) shown on return
 *   f1_02 = Your SSN
 *
 *   Part I -- Total Investment Interest Expense:
 *     f1_03 = Line 1: Investment interest expense paid or accrued in 2025
 *     f1_04 = Line 2: Disallowed investment interest expense from 2024 Form 4952, line 7
 *     f1_05 = Line 3: Total investment interest expense (add lines 1 and 2)
 *
 *   Part II -- Net Investment Income:
 *     f1_06 = Line 4a: Gross income from property held for investment
 *     f1_07 = Line 4b: Qualified dividends and/or net capital gain included on line 4a
 *                       that you elect to treat as investment income
 *     f1_08 = Line 4c: Subtract line 4b from line 4a
 *     f1_09 = Line 4d: Net gain from disposition of property held for investment
 *     f1_10 = Line 4e: Net capital gain from disposition of property held for investment
 *                       not elected on line 4b
 *     f1_11 = Line 4f: Subtract line 4e from line 4d
 *     f1_12 = Line 4g: Add lines 4c and 4f (net investment income before expenses)
 *     f1_13 = Line 5:  Investment expenses (from Schedule A if applicable)
 *     f1_14 = Line 6:  Net investment income (subtract line 5 from line 4g; if zero or less, enter 0)
 *
 *   Part III -- Investment Interest Expense Deduction:
 *     f1_15 = Line 7: Disallowed investment interest expense to carry forward
 *                      (subtract line 6 from line 3; if zero or less, enter 0)
 *     f1_16 = Line 8: Investment interest expense deduction (subtract line 7 from line 3)
 *
 *   Checkboxes:
 *     c1_1[0] = Election to include qualified dividends in investment income
 *     c1_1[1] = Election to include net capital gain in investment income
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

export const FORM_4952_FIELDS: IRSFieldMapping[] = [
  // ================================================================
  // Header
  // ================================================================

  // Name(s) shown on return
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
  // SSN
  {
    pdfFieldName: `${P1}.f1_02[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ================================================================
  // Part I -- Total Investment Interest Expense (Lines 1-3)
  // ================================================================

  // Line 1: Investment interest expense paid or accrued in 2025
  {
    pdfFieldName: `${P1}.f1_03[0]`,
    formLabel: 'Line 1: Investment interest expense paid or accrued',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.investmentInterest?.investmentInterestPaid),
  },
  // Line 2: Disallowed investment interest expense from 2024 Form 4952, line 7
  {
    pdfFieldName: `${P1}.f1_04[0]`,
    formLabel: 'Line 2: Disallowed expense from prior year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.investmentInterest?.priorYearDisallowed),
  },
  // Line 3: Total investment interest expense (add lines 1 and 2)
  {
    pdfFieldName: `${P1}.f1_05[0]`,
    formLabel: 'Line 3: Total investment interest expense',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.investmentInterest?.totalExpense),
  },

  // ================================================================
  // Part II -- Net Investment Income (Lines 4a-6)
  // ================================================================

  // Line 4a: Gross income from property held for investment
  // (This is the full NII including any elected amounts before subtracting
  // elected qualified dividends/LTCG on line 4b; not stored separately in
  // the engine result, so we back-derive it: NII = line 4g = line 4c + 4f.
  // Since we don't track investment expenses on line 5, line 6 = line 4g.
  // We leave 4a blank because the engine doesn't break out gross vs. net
  // investment income components at this granularity.)

  // Line 4b: Qualified dividends / net capital gain elected to include
  // (checkbox elections below control whether these are included;
  // the amount is not separately stored in the engine result)

  // Line 4c: Subtract line 4b from line 4a
  // (intermediate -- not directly available)

  // Line 4d: Net gain from disposition of property held for investment
  // (not separately tracked in engine)

  // Line 4e: Net capital gain from investment property not elected on 4b
  // (not separately tracked in engine)

  // Line 4f: Subtract line 4e from line 4d
  // (intermediate -- not directly available)

  // Line 4g: Net investment income before expenses (add lines 4c and 4f)
  // Since investment expenses (line 5) are not modeled, 4g = line 6
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 4g: Net investment income before expenses',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.investmentInterest?.netInvestmentIncome),
  },

  // Line 5: Investment expenses (from Schedule A -- not modeled in engine)
  // Left blank; engine assumes zero investment expenses for most filers
  // post-TCJA (miscellaneous itemized deductions suspended 2018-2025).

  // Line 6: Net investment income (subtract line 5 from line 4g; if zero or less, enter 0)
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    formLabel: 'Line 6: Net investment income',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.investmentInterest?.netInvestmentIncome),
  },

  // ================================================================
  // Part III -- Investment Interest Expense Deduction (Lines 7-8)
  // ================================================================

  // Line 7: Disallowed investment interest expense to carry forward
  // (subtract line 6 from line 3; if zero or less, enter 0)
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 7: Disallowed expense to carry forward',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.investmentInterest?.carryforward),
  },
  // Line 8: Investment interest expense deduction (subtract line 7 from line 3)
  {
    pdfFieldName: `${P1}.f1_16[0]`,
    formLabel: 'Line 8: Investment interest expense deduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.investmentInterest?.deductibleAmount),
  },

  // ================================================================
  // Checkboxes -- Elections
  // ================================================================

  // Election to include qualified dividends in investment income (line 4b)
  {
    pdfFieldName: `${P1}.c1_1[0]`,
    formLabel: 'Election: Include qualified dividends in investment income',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.investmentInterest?.electToIncludeQualifiedDividends === true,
  },
  // Election to include net capital gain in investment income (line 4b)
  {
    pdfFieldName: `${P1}.c1_1[1]`,
    formLabel: 'Election: Include net capital gain in investment income',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.investmentInterest?.electToIncludeLTCG === true,
  },
];

export const FORM_4952_TEMPLATE: IRSFormTemplate = {
  formId: 'f4952',
  displayName: 'Form 4952',
  attachmentSequence: 51,
  pdfFileName: 'f4952.pdf',
  condition: (tr, calc) =>
    (calc.investmentInterest?.deductibleAmount ?? 0) > 0 ||
    (tr.investmentInterest?.investmentInterestPaid ?? 0) > 0,
  fields: FORM_4952_FIELDS,
};
