/**
 * IRS Schedule F (2025) — AcroForm Field Mapping
 *
 * Profit or Loss From Farming
 * PDF: client/public/irs-forms/f1040sf.pdf (Schedule F, 2025)
 * Attachment Sequence No. 15
 * Total fields: ~78 (text: ~72, checkbox: ~6)
 *
 * Field prefix: topmostSubform[0].Page1[0] / topmostSubform[0].Page2[0]
 *
 * Layout:
 *   Page 1:
 *     f1_1  = Name of proprietor
 *     f1_2  = Social security number (SSN)
 *     f1_3  = Principal crop or activity
 *     f1_4  = Employer ID number (EIN)
 *     c1_1  = Accounting method: Cash checkbox
 *     c1_2  = Accounting method: Accrual checkbox
 *     c1_3  = Did you "materially participate"? Yes
 *     c1_4  = Did you "materially participate"? No
 *     c1_5  = Did you make any payments requiring Form 1099? Yes
 *     c1_6  = Did you make any payments requiring Form 1099? No
 *
 *     Part I — Farm Income — Cash Method (Lines 1–11):
 *       f1_5  = Line 1: Sales of livestock and other resale items
 *       f1_6  = Line 2: Cost or other basis of livestock/items sold
 *       f1_7  = Line 3: Subtract line 2 from line 1
 *       f1_8  = Line 4: Sales of livestock, produce, grains you raised
 *       f1_9  = Line 5a: Cooperative distributions (total)
 *       f1_10 = Line 5b: Cooperative distributions (taxable amount)
 *       f1_11 = Line 6a: Agricultural program payments (total)
 *       f1_12 = Line 6b: Agricultural program payments (taxable amount)
 *       f1_13 = Line 7a: CCC loans reported
 *       f1_14 = Line 7b: CCC loans forfeited (taxable)
 *       f1_15 = Line 8a: Crop insurance proceeds received
 *       f1_16 = Line 8b: Crop insurance proceeds (taxable)
 *       f1_17 = Line 9: Custom hire (machine work) income
 *       f1_18 = Line 10: Other farm income (specify)
 *       f1_19 = Line 10 description text
 *       f1_20 = Line 11: Gross income (add lines 3, 4, 5b, 6b, 7b, 8b, 9, 10)
 *
 *     Part II — Farm Expenses (Lines 12–33):
 *       f1_21 = Line 12: Car and truck expenses
 *       f1_22 = Line 13: Chemicals
 *       f1_23 = Line 14: Conservation expenses
 *       f1_24 = Line 15: Custom hire (machine work)
 *       f1_25 = Line 16: Depreciation and Section 179
 *       f1_26 = Line 17: Employee benefit programs
 *       f1_27 = Line 18: Feed
 *       f1_28 = Line 19: Fertilizers and lime
 *       f1_29 = Line 20: Freight and trucking
 *       f1_30 = Line 21: Gasoline, fuel, and oil
 *       f1_31 = Line 22: Insurance (other than health)
 *       f1_32 = Line 23: Interest (mortgage)
 *       f1_33 = Line 24: Interest (other)
 *       f1_34 = Line 25: Labor hired
 *       f1_35 = Line 26: Pension and profit-sharing plans
 *       f1_36 = Line 27: Rent or lease (vehicles/machinery/equipment)
 *       f1_37 = Line 28: Rent or lease (other — land, animals)
 *       f1_38 = Line 29: Repairs and maintenance
 *       f1_39 = Line 30: Seeds and plants
 *       f1_40 = Line 31: Storage and warehousing
 *       f1_41 = Line 32: Supplies
 *       f1_42 = Line 33: Taxes
 *       f1_43 = Line 34: Utilities
 *       f1_44 = Line 35: Veterinary, breeding, and medicine
 *       f1_45 = Line 36a: Other expenses (specify)
 *       f1_46 = Line 36a description text
 *       f1_47 = Line 36b: Other expenses (specify)
 *       f1_48 = Line 36b description text
 *       f1_49 = Line 36c: Other expenses (specify)
 *       f1_50 = Line 36c description text
 *       f1_51 = Line 36d: Other expenses (specify)
 *       f1_52 = Line 36d description text
 *       f1_53 = Line 36e: Other expenses (specify)
 *       f1_54 = Line 36e description text
 *       f1_55 = Line 36f: Other expenses (specify)
 *       f1_56 = Line 36f description text
 *       f1_57 = Line 37: Total other expenses
 *       f1_58 = Line 38: Total expenses (add lines 12–37)
 *       f1_59 = Line 39: Net farm profit (or loss) (line 11 minus line 38)
 *       f1_60 = Line 40: Reserved / at-risk
 *
 *   Page 2 — Part III: Farm Income Averaging (Form 1040):
 *       f2_1  through f2_18 (income averaging detail)
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P1_LC = `${P1}.LineC_ReadOrder[0]`;
const P1_LD = `${P1}.CombField_LineD[0]`;
const P1_L = `${P1}.Lines10-22[0]`;

/** Format a dollar amount — blank for zero or NaN */
function fmtDollar(n: number | undefined | null): string | undefined {
  if (n === undefined || n === null || n === 0 || isNaN(n)) return undefined;
  return Math.round(n).toString();
}

export const SCHEDULE_F_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════

  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name of proprietor',
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
    formLabel: 'Social security number (SSN)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },
  // Cash method checkbox (we assume cash method for Schedule F)
  {
    pdfFieldName: `${P1_LC}.c1_1[0]`,
    formLabel: 'Accounting method: Cash',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => true,
  },

  // ══════════════════════════════════════════════════════════════
  // Part I — Farm Income — Cash Method (Lines 1–11)
  // ══════════════════════════════════════════════════════════════

  // Line 1: Sales of livestock and other resale items
  {
    pdfFieldName: `${P1_LD}.f1_5[0]`,
    formLabel: 'Line 1: Sales of livestock and other resale items',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.salesOfLivestock),
  },
  // Line 2: Cost or other basis of livestock/items sold
  {
    pdfFieldName: `${P1}.f1_6[0]`,
    formLabel: 'Line 2: Cost or other basis of livestock and items sold',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.costOfLivestock),
  },
  // Line 3: Subtract line 2 from line 1 (net livestock sales)
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    formLabel: 'Line 3: Subtract line 2 from line 1',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const sf = tr.scheduleF;
      if (!sf) return undefined;
      const net = Math.max(0, (sf.salesOfLivestock || 0) - (sf.costOfLivestock || 0));
      return fmtDollar(net);
    },
  },
  // Line 4: Sales of livestock, produce, grains, and other products you raised
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: 'Line 4: Sales of livestock, produce, grains, and other products you raised',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.salesOfProducts),
  },
  // Line 5a: Cooperative distributions (total)
  {
    pdfFieldName: `${P1}.f1_9[0]`,
    formLabel: 'Line 5a: Cooperative distributions (total)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.cooperativeDistributions),
  },
  // Line 5b: Cooperative distributions (taxable amount)
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 5b: Cooperative distributions (taxable amount)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(
      tr.scheduleF?.cooperativeDistributionsTaxable ?? tr.scheduleF?.cooperativeDistributions,
    ),
  },
  // Line 6a: Agricultural program payments (total)
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 6a: Agricultural program payments (total)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.agriculturalProgramPayments),
  },
  // Line 6b: Agricultural program payments (taxable — same as 6a for our purposes)
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 6b: Agricultural program payments (taxable amount)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.agriculturalProgramPayments),
  },
  // Line 7a: CCC loans reported
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 7a: CCC loans reported under election',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.cccLoans),
  },
  // Line 7b: CCC loans (taxable — same as 7a for our purposes)
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    formLabel: 'Line 7b: CCC loans forfeited (taxable amount)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.cccLoans),
  },
  // Line 8a: Crop insurance proceeds received
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 8a: Crop insurance proceeds received',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.cropInsuranceProceeds),
  },
  // Line 8b: Crop insurance proceeds (taxable — same as 8a for our purposes)
  {
    pdfFieldName: `${P1}.f1_16[0]`,
    formLabel: 'Line 8b: Crop insurance proceeds (taxable amount)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.cropInsuranceProceeds),
  },
  // Line 9: Custom hire (machine work) income
  {
    pdfFieldName: `${P1}.f1_17[0]`,
    formLabel: 'Line 9: Custom hire (machine work) income',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.customHireIncome),
  },
  // Line 10: Other farm income
  {
    pdfFieldName: `${P1}.f1_18[0]`,
    formLabel: 'Line 10: Other farm income',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.otherFarmIncome),
  },
  // Line 11: Gross income (sum of income lines)
  {
    pdfFieldName: `${P1}.f1_20[0]`,
    formLabel: 'Line 11: Gross income',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleF?.grossIncome),
  },

  // ══════════════════════════════════════════════════════════════
  // Part II — Farm Expenses (Lines 12–38)
  // ══════════════════════════════════════════════════════════════

  // Line 12: Car and truck expenses
  {
    pdfFieldName: `${P1}.f1_21[0]`,
    formLabel: 'Line 12: Car and truck expenses',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.carAndTruck),
  },
  // Line 13: Chemicals
  {
    pdfFieldName: `${P1}.f1_22[0]`,
    formLabel: 'Line 13: Chemicals',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.chemicals),
  },
  // Line 14: Conservation expenses
  {
    pdfFieldName: `${P1_L}.f1_23[0]`,
    formLabel: 'Line 14: Conservation expenses',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.conservation),
  },
  // Line 15: Custom hire (machine work)
  {
    pdfFieldName: `${P1_L}.f1_24[0]`,
    formLabel: 'Line 15: Custom hire (machine work)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.customHireExpense),
  },
  // Line 16: Depreciation and Section 179 expense deduction
  {
    pdfFieldName: `${P1_L}.f1_25[0]`,
    formLabel: 'Line 16: Depreciation and section 179 expense deduction',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.depreciation),
  },
  // Line 17: Employee benefit programs
  {
    pdfFieldName: `${P1_L}.f1_26[0]`,
    formLabel: 'Line 17: Employee benefit programs',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.employeeBenefit),
  },
  // Line 18: Feed
  {
    pdfFieldName: `${P1_L}.f1_27[0]`,
    formLabel: 'Line 18: Feed',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.feed),
  },
  // Line 19: Fertilizers and lime
  {
    pdfFieldName: `${P1_L}.f1_28[0]`,
    formLabel: 'Line 19: Fertilizers and lime',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.fertilizers),
  },
  // Line 20: Freight and trucking
  {
    pdfFieldName: `${P1_L}.f1_29[0]`,
    formLabel: 'Line 20: Freight and trucking',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.freight),
  },
  // Line 21: Gasoline, fuel, and oil
  {
    pdfFieldName: `${P1_L}.f1_30[0]`,
    formLabel: 'Line 21: Gasoline, fuel, and oil',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.gasolineFuel),
  },
  // Line 22: Insurance (other than health)
  {
    pdfFieldName: `${P1_L}.f1_31[0]`,
    formLabel: 'Line 22: Insurance (other than health)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.insurance),
  },
  // Line 23: Interest (mortgage paid to financial institutions)
  {
    pdfFieldName: `${P1_L}.f1_32[0]`,
    formLabel: 'Line 23: Interest (mortgage)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.interest),
  },
  // Line 24: Interest (other) — we combine all interest into Line 23
  // (Our engine only has a single interest field)

  // Line 25: Labor hired
  {
    pdfFieldName: `${P1_L}.f1_34[0]`,
    formLabel: 'Line 25: Labor hired',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.labor),
  },
  // Line 26: Pension and profit-sharing plans
  {
    pdfFieldName: `${P1_L}.f1_35[0]`,
    formLabel: 'Line 26: Pension and profit-sharing plans',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.pension),
  },
  // Line 27: Rent or lease (vehicles, machinery, equipment)
  {
    pdfFieldName: `${P1_L}.f1_36[0]`,
    formLabel: 'Line 27: Rent or lease (vehicles, machinery, equipment)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.rentLease),
  },
  // Line 28: Rent or lease (other — land, animals)
  // Our engine uses a single rentLease field; skip line 28 separately

  // Line 29: Repairs and maintenance
  {
    pdfFieldName: `${P1}.f1_38[0]`,
    formLabel: 'Line 29: Repairs and maintenance',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.repairs),
  },
  // Line 30: Seeds and plants
  {
    pdfFieldName: `${P1}.f1_39[0]`,
    formLabel: 'Line 30: Seeds and plants',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.seeds),
  },
  // Line 31: Storage and warehousing
  {
    pdfFieldName: `${P1}.f1_40[0]`,
    formLabel: 'Line 31: Storage and warehousing',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.storage),
  },
  // Line 32: Supplies
  {
    pdfFieldName: `${P1}.f1_41[0]`,
    formLabel: 'Line 32: Supplies',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.supplies),
  },
  // Line 33: Taxes
  {
    pdfFieldName: `${P1}.f1_42[0]`,
    formLabel: 'Line 33: Taxes',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.taxes),
  },
  // Line 34: Utilities
  {
    pdfFieldName: `${P1}.f1_43[0]`,
    formLabel: 'Line 34: Utilities',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.utilities),
  },
  // Line 35: Veterinary, breeding, and medicine
  {
    pdfFieldName: `${P1}.f1_44[0]`,
    formLabel: 'Line 35: Veterinary, breeding, and medicine',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.veterinary),
  },
  // Line 36: Other expenses (total — mapped to "Other expenses" field)
  {
    pdfFieldName: `${P1}.f1_57[0]`,
    formLabel: 'Line 37: Total other expenses',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => fmtDollar(tr.scheduleF?.otherExpenses),
  },

  // ══════════════════════════════════════════════════════════════
  // Totals (Lines 38–39)
  // ══════════════════════════════════════════════════════════════

  // Line 38: Total expenses
  {
    pdfFieldName: `${P1}.f1_58[0]`,
    formLabel: 'Line 38: Total expenses',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleF?.totalExpenses),
  },
  // Line 39: Net farm profit (or loss) = line 11 minus line 38
  {
    pdfFieldName: `${P1}.f1_59[0]`,
    formLabel: 'Line 39: Net farm profit (or loss)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => fmtDollar(calc.scheduleF?.netFarmProfit),
  },
];

export const SCHEDULE_F_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040sf',
  displayName: 'Schedule F',
  attachmentSequence: 15,
  pdfFileName: 'f1040sf.pdf',
  condition: (tr, _calc) => tr.scheduleF !== undefined,
  fields: SCHEDULE_F_FIELDS,
};
