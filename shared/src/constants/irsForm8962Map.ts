/**
 * IRS Form 8962 (2025) — AcroForm Field Mapping
 *
 * Premium Tax Credit (PTC)
 * PDF: client/public/irs-forms/f8962.pdf (Form 8962, 2025)
 * Attachment Sequence No. 73
 * Total fields: 141 (text: 133, checkbox: 8)
 *
 * Field prefix: topmostSubform[0].Page1[0] / topmostSubform[0].Page2[0]
 *
 * Page 1:
 *   f1_1  = Name(s)
 *   f1_2  = SSN
 *   c1_1  = Checkbox (shared policy allocation?)
 *
 *   Part I — Annual and Monthly Contribution Amount:
 *   f1_3  = Line 1: Tax family size
 *   f1_4  = Line 2a: Modified AGI
 *   f1_5  = Line 2b: Dependents' MAGI
 *   f1_6  = Line 3: Household income (2a + 2b)
 *   c1_2[0/1/2] = Line 4: Filing status checkboxes
 *   f1_7  = Line 5: Federal poverty line amount
 *   f1_8  = Line 6: Household income as % of FPL
 *   f1_9  = Line 7: Applicable figure
 *   f1_10 = Line 8a: Annual contribution (household income × applicable figure)
 *   f1_11 = Line 8b: Monthly contribution (line 8a ÷ 12)
 *   c1_4/c1_5 = Checkboxes
 *
 *   Part II — Premium Tax Credit Claim:
 *   Part2Table1 BodyRow1: f1_13..f1_18 = Annual totals
 *     (col a: enrollment premium, col b: applicable SLCSP, col c: contribution,
 *      col d: max PTC, col e: advance PTC, col f: net PTC)
 *   Part2Table2 BodyRow1-12: Monthly details (Jan-Dec)
 *     Each row: 6 columns (f fields in groups of 6)
 *
 *   f1_91..f1_96: Part III summary (lines 24-29)
 *
 * Page 2:
 *   f2_1..f2_36: Part IV and Part V (shared policy allocation, alternative calculation)
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';

/** Format a dollar amount — blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

// ─── Monthly Detail Field Generator ──────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function generateMonthlyFields(): IRSFieldMapping[] {
  const fields: IRSFieldMapping[] = [];

  // Part2Table2 BodyRow1-12: 12 months × 6 columns each
  // BodyRow1 = January, BodyRow2 = February, etc.
  // Each row starts at: f1_(19 + (rowIdx * 6))
  // Columns: (a) enrollment premium, (b) SLCSP, (c) contribution,
  //          (d) max PTC, (e) advance PTC, (f) net PTC
  for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
    const rowNum = monthIdx + 1;
    const baseField = 19 + monthIdx * 6;
    const month = MONTH_NAMES[monthIdx];

    // Column (a): Enrollment premium
    fields.push({
      pdfFieldName: `${P1}.Part2Table2[0].BodyRow${rowNum}[0].f1_${baseField}[0]`,
      formLabel: `${month} (a): Enrollment premium`,
      sourcePath: '',
      source: 'calculationResult',
      format: 'dollarNoCents',
      transform: (_tr, calc) => {
        const detail = calc.premiumTaxCredit?.monthlyDetails?.[monthIdx];
        return detail?.hasCoverage ? fmtDollar(detail.enrollmentPremium) : undefined;
      },
    });

    // Column (b): Applicable SLCSP premium
    fields.push({
      pdfFieldName: `${P1}.Part2Table2[0].BodyRow${rowNum}[0].f1_${baseField + 1}[0]`,
      formLabel: `${month} (b): Applicable SLCSP premium`,
      sourcePath: '',
      source: 'calculationResult',
      format: 'dollarNoCents',
      transform: (_tr, calc) => {
        const detail = calc.premiumTaxCredit?.monthlyDetails?.[monthIdx];
        return detail?.hasCoverage ? fmtDollar(detail.slcspPremium) : undefined;
      },
    });

    // Column (c): Monthly contribution amount
    // This is the expected contribution per month (line 8b from Part I)
    fields.push({
      pdfFieldName: `${P1}.Part2Table2[0].BodyRow${rowNum}[0].f1_${baseField + 2}[0]`,
      formLabel: `${month} (c): Monthly contribution amount`,
      sourcePath: '',
      source: 'calculationResult',
      format: 'dollarNoCents',
      transform: (_tr, calc) => {
        const detail = calc.premiumTaxCredit?.monthlyDetails?.[monthIdx];
        if (!detail?.hasCoverage) return undefined;
        const expected = calc.premiumTaxCredit?.expectedContribution;
        return expected ? fmtDollar(Math.round(expected / 12)) : undefined;
      },
    });

    // Column (d): Maximum monthly PTC (SLCSP - contribution, but not < 0)
    fields.push({
      pdfFieldName: `${P1}.Part2Table2[0].BodyRow${rowNum}[0].f1_${baseField + 3}[0]`,
      formLabel: `${month} (d): Maximum premium tax credit`,
      sourcePath: '',
      source: 'calculationResult',
      format: 'dollarNoCents',
      transform: (_tr, calc) => {
        const detail = calc.premiumTaxCredit?.monthlyDetails?.[monthIdx];
        return detail?.hasCoverage ? fmtDollar(detail.monthlyPTC) : undefined;
      },
    });

    // Column (e): Advance PTC paid
    fields.push({
      pdfFieldName: `${P1}.Part2Table2[0].BodyRow${rowNum}[0].f1_${baseField + 4}[0]`,
      formLabel: `${month} (e): Advance PTC paid`,
      sourcePath: '',
      source: 'calculationResult',
      format: 'dollarNoCents',
      transform: (_tr, calc) => {
        const detail = calc.premiumTaxCredit?.monthlyDetails?.[monthIdx];
        return detail?.hasCoverage ? fmtDollar(detail.advancePTC) : undefined;
      },
    });

    // Column (f): Net PTC (max PTC - advance PTC)
    fields.push({
      pdfFieldName: `${P1}.Part2Table2[0].BodyRow${rowNum}[0].f1_${baseField + 5}[0]`,
      formLabel: `${month} (f): Net premium tax credit`,
      sourcePath: '',
      source: 'calculationResult',
      format: 'dollarNoCents',
      transform: (_tr, calc) => {
        const detail = calc.premiumTaxCredit?.monthlyDetails?.[monthIdx];
        if (!detail?.hasCoverage) return undefined;
        const net = detail.monthlyPTC - detail.advancePTC;
        return net !== 0 ? Math.round(net).toString() : undefined;
      },
    });
  }

  return fields;
}

// ─── Field Mappings ──────────────────────────────────────────────

export const FORM_8962_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════

  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name(s) shown on return',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim() || undefined,
  },
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ══════════════════════════════════════════════════════════════
  // Part I — Annual and Monthly Contribution Amount
  // ══════════════════════════════════════════════════════════════

  // Line 1: Tax family size
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    formLabel: 'Line 1: Tax family size',
    sourcePath: '',
    source: 'taxReturn',
    format: 'integer',
    transform: (tr) => {
      const size = tr.premiumTaxCredit?.familySize;
      return size ? String(size) : undefined;
    },
  },
  // Line 2a: Modified AGI
  {
    pdfFieldName: `${P1}.f1_4[0]`,
    formLabel: 'Line 2a: Modified AGI',
    sourcePath: 'form1040.agi',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },
  // Line 3: Household income
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 3: Household income',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.premiumTaxCredit?.householdIncome),
  },
  // Line 6: Household income as % of FPL
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: 'Line 6: Household income as % of federal poverty line',
    sourcePath: '',
    source: 'calculationResult',
    format: 'integer',
    transform: (_tr, calc) => {
      const pct = calc.premiumTaxCredit?.fplPercentage;
      return pct ? Math.round(pct).toString() : undefined;
    },
  },
  // Line 7: Applicable figure (contribution percentage)
  {
    pdfFieldName: `${P1}.f1_9[0]`,
    formLabel: 'Line 7: Applicable figure (contribution percentage)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'string',
    transform: (_tr, calc) => {
      const fig = calc.premiumTaxCredit?.applicableFigure;
      return fig !== undefined ? (fig * 100).toFixed(2) : undefined;
    },
  },
  // Line 8a: Annual expected contribution
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 8a: Annual expected contribution',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.premiumTaxCredit?.expectedContribution),
  },
  // Line 8b: Monthly expected contribution (8a ÷ 12)
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 8b: Monthly expected contribution',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const annual = calc.premiumTaxCredit?.expectedContribution;
      return annual ? fmtDollar(Math.round(annual / 12)) : undefined;
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Part II — Annual totals (Part2Table1)
  // ══════════════════════════════════════════════════════════════

  // Annual column (a): Total enrollment premiums
  {
    pdfFieldName: `${P1}.Part2Table1[0].BodyRow1[0].f1_13[0]`,
    formLabel: 'Line 11(a): Annual total enrollment premiums',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const details = calc.premiumTaxCredit?.monthlyDetails;
      if (!details) return undefined;
      const total = details.reduce((sum, d) => sum + (d.hasCoverage ? d.enrollmentPremium : 0), 0);
      return fmtDollar(total);
    },
  },
  // Annual column (b): Total SLCSP premiums
  {
    pdfFieldName: `${P1}.Part2Table1[0].BodyRow1[0].f1_14[0]`,
    formLabel: 'Line 11(b): Annual total SLCSP premiums',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const details = calc.premiumTaxCredit?.monthlyDetails;
      if (!details) return undefined;
      const total = details.reduce((sum, d) => sum + (d.hasCoverage ? d.slcspPremium : 0), 0);
      return fmtDollar(total);
    },
  },
  // Annual column (c): Annual expected contribution
  {
    pdfFieldName: `${P1}.Part2Table1[0].BodyRow1[0].f1_15[0]`,
    formLabel: 'Line 11(c): Annual expected contribution',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.premiumTaxCredit?.expectedContribution),
  },
  // Annual column (d): Annual PTC allowed
  {
    pdfFieldName: `${P1}.Part2Table1[0].BodyRow1[0].f1_16[0]`,
    formLabel: 'Line 11(d): Annual maximum premium tax credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.premiumTaxCredit?.annualPTC),
  },
  // Annual column (e): Total advance PTC
  {
    pdfFieldName: `${P1}.Part2Table1[0].BodyRow1[0].f1_17[0]`,
    formLabel: 'Line 11(e): Annual total advance PTC',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.premiumTaxCredit?.totalAPTC),
  },
  // Annual column (f): Net PTC (annual PTC - total APTC)
  {
    pdfFieldName: `${P1}.Part2Table1[0].BodyRow1[0].f1_18[0]`,
    formLabel: 'Line 11(f): Annual net premium tax credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const net = calc.premiumTaxCredit?.netPTC;
      return net ? Math.round(net).toString() : undefined;
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Part II — Monthly details (Part2Table2, 12 rows)
  // ══════════════════════════════════════════════════════════════

  ...generateMonthlyFields(),

  // ══════════════════════════════════════════════════════════════
  // Part III — Repayment of Excess APTC (Lines 24-29)
  // ══════════════════════════════════════════════════════════════

  // Line 24: Net PTC (from annual column f, if positive = additional credit)
  {
    pdfFieldName: `${P1}.f1_91[0]`,
    formLabel: 'Line 24: Net premium tax credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const net = calc.premiumTaxCredit?.netPTC ?? 0;
      return net > 0 ? fmtDollar(net) : undefined;
    },
  },
  // Line 25: Excess APTC (if APTC > annual PTC)
  {
    pdfFieldName: `${P1}.f1_92[0]`,
    formLabel: 'Line 25: Excess advance premium tax credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.premiumTaxCredit?.excessAPTC),
  },
  // Line 27: Repayment cap
  {
    pdfFieldName: `${P1}.f1_94[0]`,
    formLabel: 'Line 27: Repayment limitation',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.premiumTaxCredit?.repaymentCap),
  },
  // Line 28: Excess APTC repayment (min of excess and cap)
  {
    pdfFieldName: `${P1}.f1_95[0]`,
    formLabel: 'Line 28: Excess APTC repayment',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.premiumTaxCredit?.excessAPTCRepayment),
  },
  // Line 29: Net premium tax credit (to Schedule 3 or Form 1040)
  {
    pdfFieldName: `${P1}.f1_96[0]`,
    formLabel: 'Line 29: Net premium tax credit to Form 1040',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const net = calc.premiumTaxCredit?.netPTC ?? 0;
      return net > 0 ? fmtDollar(net) : undefined;
    },
  },
];

export const FORM_8962_TEMPLATE: IRSFormTemplate = {
  formId: 'f8962',
  displayName: 'Form 8962',
  attachmentSequence: 73,
  pdfFileName: 'f8962.pdf',
  condition: (tr, calc) =>
    tr.premiumTaxCredit !== undefined ||
    (calc.premiumTaxCredit?.annualPTC ?? 0) !== 0 ||
    (calc.premiumTaxCredit?.totalAPTC ?? 0) !== 0,
  fields: FORM_8962_FIELDS,
};
