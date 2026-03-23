/**
 * IRS Form 4137 (2025) -- AcroForm Field Mapping
 *
 * Social Security and Medicare Tax on Unreported Tip Income
 * PDF: client/public/irs-forms/f4137.pdf (Form 4137, 2025)
 * Attachment Sequence No. 56
 * Total fields: ~34 (text fields + table)
 *
 * Field prefix: form1[0].Page1[0]
 *
 * Layout:
 *   f1_1  = Name(s) shown on return
 *   f1_2  = Your SSN
 *
 *   Table_Line1 -- Employer tip income table (5 rows x 4 columns):
 *     Row N (0-indexed):
 *       Column (a): Employer name
 *       Column (b): Tips reported to employer (from W-2 Box 7)
 *       Column (c): Total tips received (including unreported)
 *       Column (d): Unreported tips (col c - col b)
 *     Field names: Table_Line1[0].Row{N}[0].f1_{col}[0]
 *     f1_3..f1_6   = Row 1
 *     f1_7..f1_10  = Row 2
 *     f1_11..f1_14 = Row 3
 *     f1_15..f1_18 = Row 4
 *     f1_19..f1_22 = Row 5
 *
 *   Summary lines:
 *   f1_23 = Line 2: Total unreported tips (sum of column d)
 *   f1_24 = Line 3: Cash/charge tips not reported (enter 0 if all on line 2)
 *   f1_25 = Line 4: Total unreported tips (line 2 + line 3)
 *   f1_26 = Line 5: SS wages and tips from W-2s (used for wage base calc)
 *   f1_27 = Line 6: Total of lines 4 and 5
 *   f1_28 = Line 7: Maximum wages subject to SS tax ($176,100 for 2025)
 *   f1_29 = Line 8: Subtract line 7 from line 6 (excess, if any)
 *   f1_30 = Line 9: Subtract line 8 from line 4 (tips subject to SS)
 *   f1_31 = Line 10: Multiply line 9 by 6.2% (SS tax)
 *   f1_32 = Line 11: Multiply line 4 by 1.45% (Medicare tax)
 *   f1_33 = Line 12: Add lines 10 and 11 (total tax on unreported tips)
 *   f1_34 = Line 13: Total from prior pages (if multiple pages)
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';
import { FORM_4137 } from './tax2025.js';

const P1 = 'topmostSubform[0].Page1[0]';

/** Format a dollar amount -- blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

export const FORM_4137_FIELDS: IRSFieldMapping[] = [
  // ======================================================================
  // Header
  // ======================================================================

  {
    pdfFieldName: `${P1}.f1_1[0]`,
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
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Your social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ======================================================================
  // Line 1 Table -- Employer tip income (we don't have per-employer breakdown
  // in Form4137Info, so we leave the table rows empty and fill summary lines)
  // ======================================================================

  // ======================================================================
  // Summary Lines (Lines 2-12)
  // ======================================================================

  // Line 2: Total unreported tips (sum of column d from table)
  {
    pdfFieldName: `${P1}.f1_23[0]`,
    formLabel: 'Line 2: Total unreported tips',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form4137?.unreportedTips),
  },
  // Line 4: Total unreported tips (line 2 + line 3)
  // Same as line 2 when no additional cash/charge tips beyond line 2
  {
    pdfFieldName: `${P1}.f1_25[0]`,
    formLabel: 'Line 4: Total unreported tips subject to tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form4137?.unreportedTips),
  },
  // Line 5: Social Security wages and tips from W-2s
  {
    pdfFieldName: `${P1}.f1_26[0]`,
    formLabel: 'Line 5: Social Security wages and tips from W-2s',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const ssWages = tr.w2Income.reduce(
        (sum, w) => sum + (w.socialSecurityWages || 0),
        0,
      );
      return fmtDollar(ssWages);
    },
  },
  // Line 6: Total of lines 4 and 5
  {
    pdfFieldName: `${P1}.f1_27[0]`,
    formLabel: 'Line 6: Total wages, tips, and unreported tips',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const tips = calc.form4137?.unreportedTips ?? 0;
      const ssWages = tr.w2Income.reduce(
        (sum, w) => sum + (w.socialSecurityWages || 0),
        0,
      );
      return fmtDollar(tips + ssWages);
    },
  },
  // Line 7: Maximum wages subject to SS tax ($176,100 for 2025)
  {
    pdfFieldName: `${P1}.f1_28[0]`,
    formLabel: 'Line 7: Maximum wages subject to Social Security tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: () => FORM_4137.SS_WAGE_BASE.toString(),
  },
  // Line 8: Subtract line 7 from line 6 (excess over wage base, if positive)
  {
    pdfFieldName: `${P1}.f1_29[0]`,
    formLabel: 'Line 8: Excess over Social Security wage base',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const tips = calc.form4137?.unreportedTips ?? 0;
      const ssWages = tr.w2Income.reduce(
        (sum, w) => sum + (w.socialSecurityWages || 0),
        0,
      );
      const excess = Math.max(0, (tips + ssWages) - FORM_4137.SS_WAGE_BASE);
      return fmtDollar(excess);
    },
  },
  // Line 9: Tips subject to Social Security tax (line 4 - line 8, but not < 0)
  {
    pdfFieldName: `${P1}.f1_30[0]`,
    formLabel: 'Line 9: Tips subject to Social Security tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form4137?.tipsSubjectToSS),
  },
  // Line 10: Social Security tax (line 9 x 6.2%)
  {
    pdfFieldName: `${P1}.f1_31[0]`,
    formLabel: 'Line 10: Social Security tax on unreported tips',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form4137?.socialSecurityTax),
  },
  // Line 11: Medicare tax (line 4 x 1.45%)
  {
    pdfFieldName: `${P1}.f1_32[0]`,
    formLabel: 'Line 11: Medicare tax on unreported tips',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form4137?.medicareTax),
  },
  // Line 12: Total tax on unreported tips (line 10 + line 11)
  {
    pdfFieldName: `${P1}.f1_33[0]`,
    formLabel: 'Line 12: Total tax on unreported tips',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.form4137?.totalTax),
  },
];

export const FORM_4137_TEMPLATE: IRSFormTemplate = {
  formId: 'f4137',
  displayName: 'Form 4137',
  attachmentSequence: 56,
  pdfFileName: 'f4137.pdf',
  condition: (tr, calc) => {
    const hasTips = (tr.form4137?.unreportedTips ?? 0) > 0;
    const hasTax = (calc.form4137?.totalTax ?? 0) > 0;
    return hasTips || hasTax;
  },
  fields: FORM_4137_FIELDS,
};
