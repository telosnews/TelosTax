/**
 * IRS Form 6251 (2025) — AcroForm Field Mapping
 *
 * Alternative Minimum Tax — Individuals
 * PDF: client/public/irs-forms/f6251.pdf (Form 6251, 2025)
 * Attachment Sequence No. 32
 * Total fields: ~62 text fields across 2 pages
 *
 * Field prefix: form1[0].Page1[0] / form1[0].Page2[0]
 *
 * Layout:
 *   Page 1:
 *     f1_1  = Name(s) shown on return
 *     f1_2  = Your SSN
 *
 *     Part I — Alternative Minimum Taxable Income (Lines 1–4):
 *       f1_3  = Line 1: Taxable income (Form 1040, line 15)
 *       f1_4  = Line 2a: Standard deduction add-back
 *       f1_5  = Line 2b: Tax refund adjustment
 *       f1_6  = Line 2c: Investment interest expense difference
 *       f1_7  = Line 2d: Depletion difference
 *       f1_8  = Line 2e: SALT deduction added back
 *       f1_9  = Line 2f: Alternative tax net operating loss deduction
 *       f1_10 = Line 2g: Private activity bond interest
 *       f1_11 = Line 2h: Qualified small business stock exclusion
 *       f1_12 = Line 2i: ISO exercise spread
 *       f1_13 = Line 2j: Estates and trusts (from Schedule K-1)
 *       f1_14 = Line 2k: Disposition of property difference
 *       f1_15 = Line 2l: Depreciation adjustment
 *       f1_16 = Line 2m: Passive activity loss difference
 *       f1_17 = Line 2n: Loss limitation difference
 *       f1_18 = Line 2o: Circulation costs
 *       f1_19 = Line 2p: Long-term contracts difference
 *       f1_20 = Line 2q: Mining costs
 *       f1_21 = Line 2r: Research and experimental costs
 *       f1_22 = Line 2s: Reserved for future use
 *       f1_23 = Line 2t: Intangible drilling costs
 *       f1_24 = Line 3: Other adjustments
 *       f1_25 = Line 4: Alternative Minimum Taxable Income (AMTI)
 *
 *     Part II — AMT Computation (Lines 5–11):
 *       f1_26 = Line 5: AMT exemption amount
 *       f1_27 = Line 6: AMT base (Line 4 - Line 5)
 *       f1_28 = Line 7: Tentative minimum tax
 *       f1_29 = Line 8: AMT foreign tax credit
 *       f1_30 = Line 9: TMT after FTC (Line 7 - Line 8)
 *       f1_31 = Line 10: Regular income tax (for comparison)
 *       f1_32 = Line 11: AMT amount (max(0, Line 9 - Line 10))
 *       f1_33 = (overflow / additional info)
 *
 *   Page 2 — Part III: Tax Computation Using Maximum Capital Gains Rates:
 *       f2_1  = Line 12: AMT base (from Part II, Line 6)
 *       f2_2  = Line 13: Adjusted net capital gain
 *       ...
 *       f2_29 = Line 40: Result used as TMT when Part III applies
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';

/** Format a dollar amount — blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

export const FORM_6251_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════

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

  // ══════════════════════════════════════════════════════════════
  // Part I — Alternative Minimum Taxable Income (Lines 1–4)
  // ══════════════════════════════════════════════════════════════

  // Line 1: Taxable income (Form 1040, line 15)
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    formLabel: 'Line 1: Taxable income from Form 1040, line 15',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.line1_taxableIncome),
  },
  // Line 2a: Standard deduction add-back
  {
    pdfFieldName: `${P1}.f1_4[0]`,
    formLabel: 'Line 2a: Standard deduction add-back',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.standardDeductionAddBack),
  },
  // Line 2b: Tax refund adjustment (negative = reduces AMTI)
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Line 2b: Tax refund adjustment',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.taxRefundAdjustment),
  },
  // Line 2c: Investment interest expense difference
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 2c: Investment interest expense difference',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.investmentInterestAdjustment),
  },
  // Line 2d: Depletion difference
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 2d: Depletion difference',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.depletion),
  },
  // Line 2e: SALT deduction added back
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: 'Line 2e: State and local tax deduction add-back',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.saltAddBack),
  },
  // Line 2f: Alternative tax net operating loss deduction (ATNOLD)
  {
    pdfFieldName: `${P1}.f1_9[0]`,
    formLabel: 'Line 2f: Alternative tax net operating loss deduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.atnold),
  },
  // Line 2g: Private activity bond interest
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 2g: Private activity bond interest',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.privateActivityBondInterest),
  },
  // Line 2h: Qualified small business stock exclusion (Section 1202)
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 2h: Qualified small business stock exclusion',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.qsbsExclusion),
  },
  // Line 2i: ISO exercise spread
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 2i: Incentive stock option exercise spread',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.isoExerciseSpread),
  },
  // Line 2j: Estates and trusts (from Schedule K-1) — not modeled, skip f1_13

  // Line 2k: Disposition of property difference
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    formLabel: 'Line 2k: Disposition of property difference',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.dispositionOfProperty),
  },
  // Line 2l: Depreciation adjustment (ADS vs MACRS)
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 2l: Depreciation adjustment',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.depreciationAdjustment),
  },
  // Line 2m: Passive activity loss difference
  {
    pdfFieldName: `${P1}.f1_16[0]`,
    formLabel: 'Line 2m: Passive activity loss difference',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.passiveActivityLoss),
  },
  // Line 2n: Loss limitation difference
  {
    pdfFieldName: `${P1}.f1_17[0]`,
    formLabel: 'Line 2n: Loss limitation difference',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.lossLimitations),
  },
  // Line 2o: Circulation costs
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    formLabel: 'Line 2o: Circulation costs',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.circulationCosts),
  },
  // Line 2p: Long-term contracts difference
  {
    pdfFieldName: `${P1}.f1_19[0]`,
    formLabel: 'Line 2p: Long-term contracts difference',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.longTermContracts),
  },
  // Line 2q: Mining costs
  {
    pdfFieldName: `${P1}.f1_20[0]`,
    formLabel: 'Line 2q: Mining costs',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.miningCosts),
  },
  // Line 2r: Research and experimental costs
  {
    pdfFieldName: `${P1}.f1_21[0]`,
    formLabel: 'Line 2r: Research and experimental costs',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.researchCosts),
  },
  // Line 2s: Reserved — skip f1_22

  // Line 2t: Intangible drilling costs
  {
    pdfFieldName: `${P1}.f1_23[0]`,
    formLabel: 'Line 2t: Intangible drilling costs',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.intangibleDrillingCosts),
  },
  // Line 3: Other adjustments (catch-all)
  {
    pdfFieldName: `${P1}.f1_24[0]`,
    formLabel: 'Line 3: Other adjustments',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.adjustments.otherAdjustments),
  },
  // Line 4: Alternative Minimum Taxable Income (AMTI)
  {
    pdfFieldName: `${P1}.f1_25[0]`,
    formLabel: 'Line 4: Alternative minimum taxable income (AMTI)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.amti),
  },

  // ══════════════════════════════════════════════════════════════
  // Part II — AMT Computation (Lines 5–11)
  // ══════════════════════════════════════════════════════════════

  // Line 5: AMT exemption amount (after phase-out)
  {
    pdfFieldName: `${P1}.f1_26[0]`,
    formLabel: 'Line 5: AMT exemption amount',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.exemption),
  },
  // Line 6: AMT base = AMTI - exemption
  {
    pdfFieldName: `${P1}.f1_27[0]`,
    formLabel: 'Line 6: AMT base (AMTI minus exemption)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.amtBase),
  },
  // Line 7: Tentative minimum tax
  {
    pdfFieldName: `${P1}.f1_28[0]`,
    formLabel: 'Line 7: Tentative minimum tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.tentativeMinimumTax),
  },
  // Line 8: AMT foreign tax credit
  {
    pdfFieldName: `${P1}.f1_29[0]`,
    formLabel: 'Line 8: AMT foreign tax credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.amtForeignTaxCredit),
  },
  // Line 9: TMT after foreign tax credit (Line 7 - Line 8)
  {
    pdfFieldName: `${P1}.f1_30[0]`,
    formLabel: 'Line 9: Tentative minimum tax after foreign tax credit',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.tmtAfterFTC),
  },
  // Line 10: Regular income tax (for comparison)
  {
    pdfFieldName: `${P1}.f1_31[0]`,
    formLabel: 'Line 10: Regular income tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.regularTax),
  },
  // Line 11: AMT amount = max(0, Line 9 - Line 10)
  {
    pdfFieldName: `${P1}.f1_32[0]`,
    formLabel: 'Line 11: Alternative minimum tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.amt?.amtAmount),
  },

  // ══════════════════════════════════════════════════════════════
  // Part III — Tax Computation Using Maximum Capital Gains Rates
  // (only populated when Part III was used)
  // ══════════════════════════════════════════════════════════════

  // Line 12: AMT base (same as Part II Line 6)
  {
    pdfFieldName: `${P2}.f2_1[0]`,
    formLabel: 'Line 12: AMT base (from Part II, line 6)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      if (!calc.amt?.usedPartIII) return undefined;
      return fmtDollar(calc.amt.partIII?.amtBase);
    },
  },
  // Line 13: Adjusted net capital gain
  {
    pdfFieldName: `${P2}.f2_2[0]`,
    formLabel: 'Line 13: Adjusted net capital gain',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      if (!calc.amt?.usedPartIII) return undefined;
      return fmtDollar(calc.amt.partIII?.adjustedNetCapitalGain);
    },
  },
  // Line 14: Ordinary AMT income (Line 12 - Line 13)
  {
    pdfFieldName: `${P2}.f2_3[0]`,
    formLabel: 'Line 14: Ordinary AMT income',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      if (!calc.amt?.usedPartIII) return undefined;
      return fmtDollar(calc.amt.partIII?.ordinaryAMTIncome);
    },
  },
  // Line 15: Tax on ordinary portion at 26%/28%
  {
    pdfFieldName: `${P2}.f2_4[0]`,
    formLabel: 'Line 15: Tax on ordinary AMT income at 26%/28%',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      if (!calc.amt?.usedPartIII) return undefined;
      return fmtDollar(calc.amt.partIII?.ordinaryTax);
    },
  },
  // Lines 16–24: Bracketed capital gains computation (intermediate steps)
  // These map to the 0%/15%/20% zone computations — we output the aggregate
  // capital gains tax result in a summary field.

  // Line 25: Tax on capital gains portion at preferential rates
  {
    pdfFieldName: `${P2}.f2_14[0]`,
    formLabel: 'Line 25: Tax on capital gains at preferential rates',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      if (!calc.amt?.usedPartIII) return undefined;
      return fmtDollar(calc.amt.partIII?.capitalGainsTax);
    },
  },
  // Line 26: Tax on unrecaptured Section 1250 gain at 25%
  {
    pdfFieldName: `${P2}.f2_15[0]`,
    formLabel: 'Line 26: Tax on unrecaptured Section 1250 gain at 25%',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      if (!calc.amt?.usedPartIII) return undefined;
      return fmtDollar(calc.amt.partIII?.section1250Tax);
    },
  },
  // Line 37: Special computation tax (ordinary + Section 1250 + preferential)
  {
    pdfFieldName: `${P2}.f2_26[0]`,
    formLabel: 'Line 37: Special computation tax',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      if (!calc.amt?.usedPartIII) return undefined;
      return fmtDollar(calc.amt.partIII?.specialComputationTax);
    },
  },
  // Line 38: Flat-rate tax (26%/28% on entire AMT base — for comparison)
  {
    pdfFieldName: `${P2}.f2_27[0]`,
    formLabel: 'Line 38: Flat-rate AMT on entire AMT base',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      if (!calc.amt?.usedPartIII) return undefined;
      return fmtDollar(calc.amt.partIII?.flatRateTax);
    },
  },
  // Line 39: Tentative minimum tax from Part III = min(Line 37, Line 38)
  {
    pdfFieldName: `${P2}.f2_28[0]`,
    formLabel: 'Line 39: Tentative minimum tax (Part III)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      if (!calc.amt?.usedPartIII) return undefined;
      return fmtDollar(calc.amt.partIII?.tentativeMinimumTax);
    },
  },
];

export const FORM_6251_TEMPLATE: IRSFormTemplate = {
  formId: 'f6251',
  displayName: 'Form 6251',
  attachmentSequence: 32,
  pdfFileName: 'f6251.pdf',
  condition: (_tr, calc) => calc.amt?.applies === true,
  fields: FORM_6251_FIELDS,
};
