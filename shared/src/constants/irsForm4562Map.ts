/**
 * IRS Form 4562 (2025) — AcroForm Field Mapping
 *
 * Depreciation and Amortization (Including Information on Listed Property)
 * PDF: client/public/irs-forms/f4562.pdf (Form 4562, 2025)
 * Attachment Sequence No. 179
 *
 * Field prefix: topmostSubform[0].Page1[0] (page 1)
 *
 * Page 1 field map (from AcroForm enumeration):
 *   f1_1  = Name shown on return
 *   f1_2  = Business or activity to which this form relates
 *   f1_3  = Identifying number
 *
 *   Part I — Section 179 (Lines 1-13):
 *   f1_4  = Line 1: Maximum amount
 *   f1_5  = Line 2: Total cost of section 179 property
 *   f1_6  = Line 3: Threshold cost
 *   f1_7  = Line 4: Reduction in limitation
 *   f1_8  = Line 5: Dollar limitation for tax year
 *   Table_Ln6.BodyRow1: f1_9 (desc), f1_10 (cost), f1_11 (elected)
 *   Table_Ln6.BodyRow2: f1_12 (desc), f1_13 (cost), f1_14 (elected)
 *   f1_15 = Line 7: Listed property (from Part V)
 *   f1_16 = Line 8: Total elected cost of section 179 property
 *   f1_17 = Line 9: Tentative deduction
 *   f1_18 = Line 10: Carryover of disallowed deduction from prior year
 *   f1_19 = Line 11: Business income limitation
 *   f1_20 = Line 12: Section 179 expense deduction
 *   f1_21 = Line 13: Carryover of disallowed deduction to next year
 *
 *   Part II — Special Depreciation Allowance (Line 14):
 *   f1_22 = Line 14: Special depreciation allowance
 *   f1_23 = Line 15-17 (other Part II fields)
 *   f1_24 = Line 21: Listed property (enter amount from line 28)
 *   f1_25 = Line 22: Total (add amounts from lines 12, 14, 17, 19g, 20g, and 21)
 *
 *   Part III — MACRS Depreciation, Section B (Line 19):
 *   SectionBTable.Line19a: f1_26..f1_31 (cols a-f for 3-year property)
 *   SectionBTable.Line19b: f1_32..f1_37 (5-year)
 *   SectionBTable.Line19c: f1_38..f1_43 (7-year)
 *   SectionBTable.Line19d: f1_44..f1_49 (10-year)
 *   SectionBTable.Line19e: f1_50..f1_55 (15-year)
 *   SectionBTable.Line19f: f1_56..f1_61 (20-year)
 *   SectionBTable.Line19g: f1_62..f1_67 (25-year)
 *   SectionBTable.Line19h: f1_68..f1_73 (residential rental 27.5-year)
 *   SectionBTable.Line19i: f1_74..f1_85 (nonresidential real 39-year — 2 rows)
 *   SectionBTable.Line19j: f1_86..f1_97 (other — 2 rows)
 *
 *   Part III — Section C (Line 20, ADS):
 *   SectionCTable.Line20a-e: f1_98..f1_127
 *
 *   Each Line 19 row has 6 columns:
 *     col 0 = (b) Month and year placed in service
 *     col 1 = (c) Basis for depreciation
 *     col 2 = (d) Recovery period
 *     col 3 = (e) Convention
 *     col 4 = (f) Method
 *     col 5 = (g) Depreciation deduction
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { calculateForm4562 } from '../engine/form4562.js';
import { calculateScheduleC } from '../engine/scheduleC.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';

// Cache Form 4562 result to avoid redundant recalculation across ~70+ field mappings
const form4562Cache = new WeakMap<TaxReturn, ReturnType<typeof calculateForm4562> | null>();

// Helper: get the Form 4562 result from a tax return (cached)
function getForm4562(tr: TaxReturn, _calc: CalculationResult) {
  if (form4562Cache.has(tr)) return form4562Cache.get(tr)!;
  const assets = tr.depreciationAssets?.filter(a => !a.disposed) || [];
  if (assets.length === 0) {
    form4562Cache.set(tr, null);
    return null;
  }
  const schedC = calculateScheduleC(tr);
  const result = calculateForm4562(assets, schedC.tentativeProfit);
  form4562Cache.set(tr, result);
  return result;
}

// Helper: format dollar amount (no cents) for IRS forms
function fmtDollar(n: number | undefined): string {
  if (n === undefined || n === 0) return '';
  return Math.round(n).toLocaleString('en-US');
}

// Cache vehicle Part V data to avoid redundant Schedule C recalculation
type PartVData = NonNullable<ReturnType<typeof calculateScheduleC>['vehicleResult']>['form4562PartV'];
const partVCache = new WeakMap<TaxReturn, PartVData | null>();

// Helper: get vehicle Part V disclosure data from Schedule C (cached)
function getPartV(tr: TaxReturn): PartVData | null {
  if (partVCache.has(tr)) return partVCache.get(tr)!;
  if (!tr.vehicle) {
    partVCache.set(tr, null);
    return null;
  }
  const schedC = calculateScheduleC(tr);
  const pv = schedC.vehicleResult?.form4562PartV ?? null;
  partVCache.set(tr, pv);
  return pv;
}

// Helper: group current-year asset details by property class and sum basis/depreciation
function getPropertyClassSummary(tr: TaxReturn, calc: CalculationResult) {
  const result = getForm4562(tr, calc);
  if (!result) return {};
  const summary: Record<number, { basis: number; depreciation: number; convention: string }> = {};
  for (const detail of result.assetDetails) {
    if (detail.yearIndex !== 0) continue; // Only current-year for Line 19
    const cls = detail.propertyClass;
    if (!summary[cls]) {
      summary[cls] = { basis: 0, depreciation: 0, convention: result.convention === 'mid-quarter' ? 'MQ' : 'HY' };
    }
    // Basis for MACRS = business-use basis minus section 179 minus bonus
    const macrsBasis = Math.max(0, detail.businessUseBasis - detail.section179Amount - detail.bonusDepreciation);
    summary[cls].basis += macrsBasis;
    summary[cls].depreciation += detail.macrsDepreciation;
  }
  return summary;
}

export const FORM_4562_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════
  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name(s) shown on return',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim(),
  },
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Business or activity to which this form relates',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.businesses?.[0]?.businessDescription || 'Business depreciation',
  },
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    formLabel: 'Identifying number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // ══════════════════════════════════════════════════════════════
  // Part I — Section 179 (Lines 1-13)
  // ══════════════════════════════════════════════════════════════

  // Line 1: Maximum amount ($1,250,000 for 2025)
  {
    pdfFieldName: `${P1}.f1_4[0]`,
    formLabel: 'Line 1: Maximum Section 179 deduction',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      return r ? fmtDollar(r.section179Limit) : '';
    },
  },
  // Line 2: Total cost of section 179 property placed in service
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'Line 2: Total cost of Section 179 property',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      return r && r.totalCostSection179Property > 0 ? fmtDollar(r.totalCostSection179Property) : '';
    },
  },
  // Line 3: Threshold cost ($3,130,000 for 2025)
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 3: Threshold cost of Section 179 property',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => '3,130,000',
  },
  // Line 4: Reduction in limitation (Line 2 - Line 3, if positive)
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 4: Reduction in limitation',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      return r && r.section179ThresholdReduction > 0 ? fmtDollar(r.section179ThresholdReduction) : '';
    },
  },
  // Line 5: Dollar limitation for tax year (Line 1 - Line 4)
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: 'Line 5: Dollar limitation for tax year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      return r ? fmtDollar(r.section179MaxAfterReduction) : '';
    },
  },

  // Line 6: Listed property (rows) — first two Section 179 assets
  // Row 1: description
  {
    pdfFieldName: `${P1}.Table_Ln6[0].BodyRow1[0].f1_9[0]`,
    formLabel: 'Line 6: Section 179 property #1 description',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      const s179Assets = r?.assetDetails.filter(d => d.section179Amount > 0) || [];
      return s179Assets[0]?.description || '';
    },
  },
  // Row 1: cost (business basis)
  {
    pdfFieldName: `${P1}.Table_Ln6[0].BodyRow1[0].f1_10[0]`,
    formLabel: 'Line 6: Section 179 property #1 cost',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      const s179Assets = r?.assetDetails.filter(d => d.section179Amount > 0) || [];
      return s179Assets[0] ? fmtDollar(s179Assets[0].businessUseBasis) : '';
    },
  },
  // Row 1: elected cost
  {
    pdfFieldName: `${P1}.Table_Ln6[0].BodyRow1[0].f1_11[0]`,
    formLabel: 'Line 6: Section 179 property #1 elected cost',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      const s179Assets = r?.assetDetails.filter(d => d.section179Amount > 0) || [];
      return s179Assets[0] ? fmtDollar(s179Assets[0].section179Amount) : '';
    },
  },
  // Row 2: description
  {
    pdfFieldName: `${P1}.Table_Ln6[0].BodyRow2[0].f1_12[0]`,
    formLabel: 'Line 6: Section 179 property #2 description',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      const s179Assets = r?.assetDetails.filter(d => d.section179Amount > 0) || [];
      return s179Assets[1]?.description || '';
    },
  },
  // Row 2: cost
  {
    pdfFieldName: `${P1}.Table_Ln6[0].BodyRow2[0].f1_13[0]`,
    formLabel: 'Line 6: Section 179 property #2 cost',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      const s179Assets = r?.assetDetails.filter(d => d.section179Amount > 0) || [];
      return s179Assets[1] ? fmtDollar(s179Assets[1].businessUseBasis) : '';
    },
  },
  // Row 2: elected cost
  {
    pdfFieldName: `${P1}.Table_Ln6[0].BodyRow2[0].f1_14[0]`,
    formLabel: 'Line 6: Section 179 property #2 elected cost',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      const s179Assets = r?.assetDetails.filter(d => d.section179Amount > 0) || [];
      return s179Assets[1] ? fmtDollar(s179Assets[1].section179Amount) : '';
    },
  },
  // Line 7: Listed property (enter amount from line 29) — 0 for now
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 7: Listed property from Part V',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => '',
  },
  // Line 8: Total elected cost of section 179 property
  {
    pdfFieldName: `${P1}.f1_16[0]`,
    formLabel: 'Line 8: Total elected cost of Section 179 property',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      return r && r.section179Elected > 0 ? fmtDollar(r.section179Elected) : '';
    },
  },
  // Line 9: Tentative deduction (lesser of line 5 or 8)
  {
    pdfFieldName: `${P1}.f1_17[0]`,
    formLabel: 'Line 9: Tentative deduction',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      if (!r || r.section179Elected <= 0) return '';
      return fmtDollar(Math.min(r.section179MaxAfterReduction, r.section179Elected));
    },
  },
  // Line 10: Carryover from prior year — 0 (not tracked across returns)
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    formLabel: 'Line 10: Carryover of disallowed deduction from prior year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => '',
  },
  // Line 11: Business income limitation
  {
    pdfFieldName: `${P1}.f1_19[0]`,
    formLabel: 'Line 11: Business income limitation',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      return r && r.section179BusinessIncomeLimit > 0 ? fmtDollar(r.section179BusinessIncomeLimit) : '';
    },
  },
  // Line 12: Section 179 expense deduction
  {
    pdfFieldName: `${P1}.f1_20[0]`,
    formLabel: 'Line 12: Section 179 expense deduction',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      return r && r.section179Deduction > 0 ? fmtDollar(r.section179Deduction) : '';
    },
  },
  // Line 13: Carryover of disallowed deduction to next year
  {
    pdfFieldName: `${P1}.f1_21[0]`,
    formLabel: 'Line 13: Carryover of disallowed deduction to next year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      return r && r.section179Carryforward > 0 ? fmtDollar(r.section179Carryforward) : '';
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Part II — Special Depreciation Allowance (Line 14)
  // ══════════════════════════════════════════════════════════════
  {
    pdfFieldName: `${P1}.f1_22[0]`,
    formLabel: 'Line 14: Special depreciation allowance',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      return r && r.bonusDepreciationTotal > 0 ? fmtDollar(r.bonusDepreciationTotal) : '';
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Part III — MACRS Depreciation, Section A (Line 17)
  // ══════════════════════════════════════════════════════════════

  // Line 17: MACRS deductions for assets placed in service in prior tax years
  {
    pdfFieldName: `${P1}.f1_23[0]`,
    formLabel: 'Line 17: MACRS deductions for prior-year assets',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      return r && r.macrsPriorYears > 0 ? fmtDollar(r.macrsPriorYears) : '';
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Part III — MACRS Depreciation, Section B (Line 19)
  // GDS using 200% DB (3/5/7/10-year) and 150% DB (15/20-year)
  // Each row: month/year | basis | recovery period | convention | method | depreciation
  // ══════════════════════════════════════════════════════════════

  // Line 19a — 3-year property
  ...makeLine19Row('Line19a', 26, 3, '19a'),
  // Line 19b — 5-year property
  ...makeLine19Row('Line19b', 32, 5, '19b'),
  // Line 19c — 7-year property
  ...makeLine19Row('Line19c', 38, 7, '19c'),
  // Line 19d — 10-year property
  ...makeLine19Row('Line19d', 44, 10, '19d'),
  // Line 19e — 15-year property
  ...makeLine19Row('Line19e', 50, 15, '19e'),
  // Line 19f — 20-year property
  ...makeLine19Row('Line19f', 56, 20, '19f'),

  // ══════════════════════════════════════════════════════════════
  // Part IV — Summary
  // ══════════════════════════════════════════════════════════════

  // Line 21: Listed property (enter from Part V line 28) — 0
  {
    pdfFieldName: `${P1}.f1_24[0]`,
    formLabel: 'Line 21: Listed property from Part V line 28',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: () => '',
  },
  // Line 22: Total depreciation (sum of lines 12, 14, 17, 19g, 20g, 21)
  {
    pdfFieldName: `${P1}.f1_25[0]`,
    formLabel: 'Line 22: Total depreciation deduction',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr, calc) => {
      const r = getForm4562(tr, calc);
      return r && r.totalDepreciation > 0 ? fmtDollar(r.totalDepreciation) : '';
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Part V — Listed Property (Page 2)
  // Section B: Questions for vehicles (Lines 30-36)
  // Only populates Vehicle (a) column from Schedule C vehicle data.
  // ══════════════════════════════════════════════════════════════

  // Line 30: Total miles driven during year — Vehicle (a)
  {
    pdfFieldName: `${P2}.Table_Ln30-33[0].Line30[0].f2_59[0]`,
    formLabel: 'Line 30: Total miles driven during year',
    sourcePath: '',
    source: 'taxReturn' as const,
    format: 'string' as const,
    transform: (tr: TaxReturn) => {
      const pv = getPartV(tr);
      return pv ? fmtDollar(pv.totalMiles) : '';
    },
  },
  // Line 31: Business/investment miles — Vehicle (a)
  {
    pdfFieldName: `${P2}.Table_Ln30-33[0].Line31[0].f2_65[0]`,
    formLabel: 'Line 31: Business/investment miles',
    sourcePath: '',
    source: 'taxReturn' as const,
    format: 'string' as const,
    transform: (tr: TaxReturn) => {
      const pv = getPartV(tr);
      return pv ? fmtDollar(pv.businessMiles) : '';
    },
  },
  // Line 32: Commuting miles — Vehicle (a)
  {
    pdfFieldName: `${P2}.Table_Ln30-33[0].Line32[0].f2_71[0]`,
    formLabel: 'Line 32: Commuting miles',
    sourcePath: '',
    source: 'taxReturn' as const,
    format: 'string' as const,
    transform: (tr: TaxReturn) => {
      const pv = getPartV(tr);
      return pv ? fmtDollar(pv.commuteMiles) : '';
    },
  },
  // Line 33: Other miles — Vehicle (a)
  {
    pdfFieldName: `${P2}.Table_Ln30-33[0].Line33[0].f2_77[0]`,
    formLabel: 'Line 33: Other personal miles',
    sourcePath: '',
    source: 'taxReturn' as const,
    format: 'string' as const,
    transform: (tr: TaxReturn) => {
      const pv = getPartV(tr);
      return pv ? fmtDollar(pv.otherMiles) : '';
    },
  },

  // Line 34: Was vehicle available for personal use during off-duty hours? — Vehicle (a)
  // c2_4[0] = Yes, c2_4[1] = No
  {
    pdfFieldName: `${P2}.SectionBTable2[0].Line34[0].c2_4[0]`,
    formLabel: 'Line 34: Vehicle available for personal use — Yes',
    sourcePath: '',
    source: 'taxReturn' as const,
    format: 'checkbox' as const,
    transform: (tr: TaxReturn) => {
      const pv = getPartV(tr);
      return pv ? pv.availableForPersonalUse : false;
    },
  },
  {
    pdfFieldName: `${P2}.SectionBTable2[0].Line34[0].c2_4[1]`,
    formLabel: 'Line 34: Vehicle available for personal use — No',
    sourcePath: '',
    source: 'taxReturn' as const,
    format: 'checkbox' as const,
    transform: (tr: TaxReturn) => {
      const pv = getPartV(tr);
      return pv ? !pv.availableForPersonalUse : false;
    },
  },

  // Line 35: Was vehicle used primarily by a more-than-5% owner/related person? — Vehicle (a)
  // c2_10[0] = Yes, c2_10[1] = No
  // Not tracked in our VehicleResult — default to No for standard Schedule C filer
  {
    pdfFieldName: `${P2}.SectionBTable2[0].Line35[0].c2_10[0]`,
    formLabel: 'Line 35: Vehicle used by 5%+ owner — Yes',
    sourcePath: '',
    source: 'taxReturn' as const,
    format: 'checkbox' as const,
    transform: () => false,
  },
  {
    pdfFieldName: `${P2}.SectionBTable2[0].Line35[0].c2_10[1]`,
    formLabel: 'Line 35: Vehicle used by 5%+ owner — No',
    sourcePath: '',
    source: 'taxReturn' as const,
    format: 'checkbox' as const,
    transform: (tr: TaxReturn) => getPartV(tr) != null,
  },

  // Line 36: Is another vehicle available for personal use? — Vehicle (a)
  // c2_16[0] = Yes, c2_16[1] = No
  {
    pdfFieldName: `${P2}.SectionBTable2[0].Line36[0].c2_16[0]`,
    formLabel: 'Line 36: Another vehicle available for personal use — Yes',
    sourcePath: '',
    source: 'taxReturn' as const,
    format: 'checkbox' as const,
    transform: (tr: TaxReturn) => {
      const pv = getPartV(tr);
      return pv ? pv.hasAnotherVehicle : false;
    },
  },
  {
    pdfFieldName: `${P2}.SectionBTable2[0].Line36[0].c2_16[1]`,
    formLabel: 'Line 36: Another vehicle available for personal use — No',
    sourcePath: '',
    source: 'taxReturn' as const,
    format: 'checkbox' as const,
    transform: (tr: TaxReturn) => {
      const pv = getPartV(tr);
      return pv ? !pv.hasAnotherVehicle : false;
    },
  },
];

/**
 * Generate the 6 field mappings for a Line 19 row (one property class).
 * Columns: (b) Month/year | (c) Basis | (d) Recovery period | (e) Convention | (f) Method | (g) Depreciation
 */
function makeLine19Row(
  lineName: string,
  startFieldNum: number,
  propertyClass: number,
  lineLabel: string,
): IRSFieldMapping[] {
  const linePrefix = `${P1}.SectionBTable[0].${lineName}[0]`;
  const method = propertyClass <= 10 ? '200DB' : '150DB';

  return [
    // (b) Month and year placed in service — blank (various dates)
    {
      pdfFieldName: `${linePrefix}.f1_${startFieldNum}[0]`,
      formLabel: `Line ${lineLabel}: ${propertyClass}-year property date placed in service`,
      sourcePath: '',
      source: 'taxReturn' as const,
      format: 'string' as const,
      transform: () => '',
    },
    // (c) Basis for depreciation
    {
      pdfFieldName: `${linePrefix}.f1_${startFieldNum + 1}[0]`,
      formLabel: `Line ${lineLabel}: ${propertyClass}-year property basis`,
      sourcePath: '',
      source: 'taxReturn' as const,
      format: 'dollarNoCents' as const,
      transform: (tr: TaxReturn, calc: CalculationResult) => {
        const summary = getPropertyClassSummary(tr, calc);
        return summary[propertyClass] ? fmtDollar(summary[propertyClass].basis) : '';
      },
    },
    // (d) Recovery period
    {
      pdfFieldName: `${linePrefix}.f1_${startFieldNum + 2}[0]`,
      formLabel: `Line ${lineLabel}: ${propertyClass}-year property recovery period`,
      sourcePath: '',
      source: 'taxReturn' as const,
      format: 'string' as const,
      transform: (tr: TaxReturn, calc: CalculationResult) => {
        const summary = getPropertyClassSummary(tr, calc);
        return summary[propertyClass] ? `${propertyClass} yrs` : '';
      },
    },
    // (e) Convention (HY or MQ)
    {
      pdfFieldName: `${linePrefix}.f1_${startFieldNum + 3}[0]`,
      formLabel: `Line ${lineLabel}: ${propertyClass}-year property convention`,
      sourcePath: '',
      source: 'taxReturn' as const,
      format: 'string' as const,
      transform: (tr: TaxReturn, calc: CalculationResult) => {
        const summary = getPropertyClassSummary(tr, calc);
        return summary[propertyClass]?.convention || '';
      },
    },
    // (f) Method
    {
      pdfFieldName: `${linePrefix}.f1_${startFieldNum + 4}[0]`,
      formLabel: `Line ${lineLabel}: ${propertyClass}-year property method`,
      sourcePath: '',
      source: 'taxReturn' as const,
      format: 'string' as const,
      transform: (tr: TaxReturn, calc: CalculationResult) => {
        const summary = getPropertyClassSummary(tr, calc);
        return summary[propertyClass] ? method : '';
      },
    },
    // (g) Depreciation deduction
    {
      pdfFieldName: `${linePrefix}.f1_${startFieldNum + 5}[0]`,
      formLabel: `Line ${lineLabel}: ${propertyClass}-year property depreciation deduction`,
      sourcePath: '',
      source: 'taxReturn' as const,
      format: 'dollarNoCents' as const,
      transform: (tr: TaxReturn, calc: CalculationResult) => {
        const summary = getPropertyClassSummary(tr, calc);
        return summary[propertyClass] ? fmtDollar(summary[propertyClass].depreciation) : '';
      },
    },
  ];
}

export const FORM_4562_TEMPLATE: IRSFormTemplate = {
  formId: 'f4562',
  displayName: 'Form 4562',
  attachmentSequence: 179,
  pdfFileName: 'f4562.pdf',
  condition: (tr: TaxReturn) =>
    (tr.depreciationAssets?.filter(a => !a.disposed)?.length || 0) > 0 ||
    tr.vehicle != null,
  fields: FORM_4562_FIELDS,
};
