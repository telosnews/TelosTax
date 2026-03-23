/**
 * IRS Schedule C (Form 1040) 2025 — AcroForm Field Mapping
 *
 * Profit or Loss From Business (Sole Proprietorship)
 * PDF: client/public/irs-forms/f1040sc.pdf (Schedule C, 2025, Created 4/3/25)
 * Attachment Sequence No. 09
 * Total fields: 105 (text: 78, checkbox: 27)
 *
 * Field prefix: topmostSubform[0].Page1[0] (page 1) / topmostSubform[0].Page2[0] (page 2)
 *
 * Page 1 field map (from enumerate + visual inspection):
 *   f1_1  = Name of proprietor
 *   f1_2  = SSN
 *   f1_3  = A. Principal business or profession
 *   BComb.f1_4 = B. Business code (6-digit NAICS)
 *   f1_5  = C. Business name
 *   DComb.f1_6 = D. EIN
 *   f1_7  = E. Business address (street)
 *   f1_8  = E. City, state, ZIP
 *   c1_1[0/1/2] = F. Accounting method (Cash/Accrual/Other)
 *   f1_9  = F. Other (specify)
 *   c1_2[0/1] = G. Material participation (Yes/No)
 *   c1_3  = H. Started/acquired this year
 *   c1_4[0/1] = I. Made payments requiring 1099? (Yes/No)
 *   c1_5[0/1] = J. Filed required 1099s? (Yes/No)
 *   c1_6  = Line 1 statutory employee checkbox
 *   f1_10 = Line 1: Gross receipts
 *   f1_11 = Line 2: Returns and allowances
 *   f1_12 = Line 3: Net receipts
 *   f1_13 = Line 4: COGS
 *   f1_14 = Line 5: Gross profit
 *   f1_15 = Line 6: Other income
 *   f1_16 = Line 7: Gross income
 *   Lines8-17: f1_17..f1_27 = Lines 8-17
 *   Lines18-27: f1_28..f1_40 = Lines 18-27b
 *   f1_41 = Line 28: Total expenses
 *   f1_42 = Line 29: Tentative profit
 *   f1_43 = Line 30: Home office (amount)
 *   f1_44 = Line 30: Home office (description/sqft)
 *   f1_45 = Line 31: Net profit
 *   f1_46 = Line 32a text
 *   c1_7[0/1] = Line 32a/32b checkboxes
 *
 * Page 2:
 *   c2_1..c2_3 = Part III Line 33 (a/b/c inventory method)
 *   c2_4[0/1] = Part III Line 34 (Yes/No)
 *   f2_1..f2_7 = Part III Lines 35-41
 *   f2_8  = Part III Line 42: COGS
 *   f2_9..f2_14 = Part IV Lines 43-47b (vehicle info)
 *   c2_5..c2_8 = Part IV Yes/No checkboxes
 *   PartVTable Items 1-9: f2_15..f2_32 = Part V other expenses (description + amount pairs)
 *   f2_33 = Line 48: Total other expenses
 */
import type { IRSFieldMapping, IRSFormTemplate } from '../types/irsFormMappings.js';
import type { TaxReturn, CalculationResult } from '../types/index.js';

const P1 = 'topmostSubform[0].Page1[0]';
const P2 = 'topmostSubform[0].Page2[0]';

export const SCHEDULE_C_FIELDS: IRSFieldMapping[] = [
  // ══════════════════════════════════════════════════════════════
  // Header
  // ══════════════════════════════════════════════════════════════

  // Name of proprietor
  {
    pdfFieldName: `${P1}.f1_1[0]`,
    formLabel: 'Name of proprietor',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => `${tr.firstName || ''} ${tr.lastName || ''}`.trim(),
  },
  // SSN
  {
    pdfFieldName: `${P1}.f1_2[0]`,
    formLabel: 'Social security number',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.ssn?.replace(/\D/g, '') || tr.ssnLastFour || '',
  },

  // A. Principal business or profession
  {
    pdfFieldName: `${P1}.f1_3[0]`,
    formLabel: 'A. Principal business or profession',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.businesses?.[0]?.businessDescription || '',
  },

  // B. Business code (6-digit NAICS)
  {
    pdfFieldName: `${P1}.BComb[0].f1_4[0]`,
    formLabel: 'B. Business code (NAICS)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.businesses?.[0]?.principalBusinessCode || '',
  },

  // C. Business name
  {
    pdfFieldName: `${P1}.f1_5[0]`,
    formLabel: 'C. Business name',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.businesses?.[0]?.businessName || '',
  },

  // D. EIN
  {
    pdfFieldName: `${P1}.DComb[0].f1_6[0]`,
    formLabel: 'D. Employer ID number (EIN)',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => tr.businesses?.[0]?.businessEin || '',
  },

  // E. Business address (street)
  {
    pdfFieldName: `${P1}.f1_7[0]`,
    sourcePath: 'addressStreet',
    source: 'taxReturn',
    format: 'string',
    editable: true,
    formLabel: 'E. Business address (street)',
  },

  // E. City, state, ZIP
  {
    pdfFieldName: `${P1}.f1_8[0]`,
    formLabel: 'E. City, state, ZIP',
    sourcePath: '',
    source: 'taxReturn',
    format: 'string',
    transform: (tr) => {
      const parts = [tr.addressCity, tr.addressState, tr.addressZip].filter(Boolean);
      return parts.join(', ');
    },
  },

  // F. Accounting method — Cash
  {
    pdfFieldName: `${P1}.c1_1[0]`,
    formLabel: 'F. Accounting method: Cash',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.businesses?.[0]?.accountingMethod === 'cash',
  },
  // F. Accounting method — Accrual
  {
    pdfFieldName: `${P1}.c1_1[1]`,
    formLabel: 'F. Accounting method: Accrual',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.businesses?.[0]?.accountingMethod === 'accrual',
  },

  // G. Material participation — Yes (default for sole proprietors)
  {
    pdfFieldName: `${P1}.c1_2[0]`,
    formLabel: 'G. Did you materially participate: Yes',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: () => true,
  },

  // H. Started or acquired this business during year
  {
    pdfFieldName: `${P1}.c1_3[0]`,
    formLabel: 'H. Started or acquired business during year',
    sourcePath: '',
    source: 'taxReturn',
    format: 'checkbox',
    transform: (tr) => tr.businesses?.[0]?.didStartThisYear === true,
  },

  // ══════════════════════════════════════════════════════════════
  // Part I — Income (Lines 1-7)
  // ══════════════════════════════════════════════════════════════

  // Line 1: Gross receipts or sales
  {
    pdfFieldName: `${P1}.f1_10[0]`,
    formLabel: 'Line 1: Gross receipts or sales',
    sourcePath: 'scheduleC.grossReceipts',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 2: Returns and allowances
  {
    pdfFieldName: `${P1}.f1_11[0]`,
    formLabel: 'Line 2: Returns and allowances',
    sourcePath: 'scheduleC.returnsAndAllowances',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 3: Subtract line 2 from line 1
  {
    pdfFieldName: `${P1}.f1_12[0]`,
    formLabel: 'Line 3: Net receipts',
    sourcePath: 'scheduleC.netReceipts',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 4: Cost of goods sold (from line 42)
  {
    pdfFieldName: `${P1}.f1_13[0]`,
    formLabel: 'Line 4: Cost of goods sold',
    sourcePath: 'scheduleC.costOfGoodsSold',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 5: Gross profit
  {
    pdfFieldName: `${P1}.f1_14[0]`,
    formLabel: 'Line 5: Gross profit',
    sourcePath: 'scheduleC.grossProfit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 6: Other income
  {
    pdfFieldName: `${P1}.f1_15[0]`,
    formLabel: 'Line 6: Other income',
    sourcePath: 'scheduleC.otherBusinessIncome',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 7: Gross income
  {
    pdfFieldName: `${P1}.f1_16[0]`,
    formLabel: 'Line 7: Gross income',
    sourcePath: 'scheduleC.grossIncome',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // ══════════════════════════════════════════════════════════════
  // Part II — Expenses (Lines 8-27)
  // Lines 8-17 are in container Lines8-17[0]
  // Lines 18-27 are in container Lines18-27[0]
  // ══════════════════════════════════════════════════════════════

  // Line 8: Advertising
  {
    pdfFieldName: `${P1}.Lines8-17[0].f1_17[0]`,
    formLabel: 'Line 8: Advertising',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['8'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 9: Car and truck expenses
  {
    pdfFieldName: `${P1}.Lines8-17[0].f1_18[0]`,
    formLabel: 'Line 9: Car and truck expenses',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // Use vehicle deduction if active, otherwise line 9 expenses
      const vehicle = calc.scheduleC?.vehicleDeduction || 0;
      const line9 = calc.scheduleC?.lineItems?.['9'] || 0;
      const v = vehicle || line9;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 10: Commissions and fees
  {
    pdfFieldName: `${P1}.Lines8-17[0].f1_19[0]`,
    formLabel: 'Line 10: Commissions and fees',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['10'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 11: Contract labor
  {
    pdfFieldName: `${P1}.Lines8-17[0].f1_20[0]`,
    formLabel: 'Line 11: Contract labor',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['11'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 12: Depletion
  {
    pdfFieldName: `${P1}.Lines8-17[0].f1_21[0]`,
    formLabel: 'Line 12: Depletion',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['12'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 13: Depreciation and section 179
  {
    pdfFieldName: `${P1}.Lines8-17[0].f1_22[0]`,
    formLabel: 'Line 13: Depreciation and section 179',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      // Use computed depreciation if available, otherwise line 13 expense
      const dep = calc.scheduleC?.depreciationDeduction || 0;
      const line13 = calc.scheduleC?.lineItems?.['13'] || 0;
      const v = dep || line13;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 14: Employee benefit programs
  {
    pdfFieldName: `${P1}.Lines8-17[0].f1_23[0]`,
    formLabel: 'Line 14: Employee benefit programs',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['14'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 15: Insurance (other than health)
  {
    pdfFieldName: `${P1}.Lines8-17[0].f1_24[0]`,
    formLabel: 'Line 15: Insurance (other than health)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['15'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 16a: Interest — Mortgage
  {
    pdfFieldName: `${P1}.Lines8-17[0].f1_25[0]`,
    formLabel: 'Line 16a: Mortgage interest paid',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['16a'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 16b: Interest — Other
  {
    pdfFieldName: `${P1}.Lines8-17[0].f1_26[0]`,
    formLabel: 'Line 16b: Other interest',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['16b'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 17: Legal and professional services
  {
    pdfFieldName: `${P1}.Lines8-17[0].f1_27[0]`,
    formLabel: 'Line 17: Legal and professional services',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['17'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 18: Office expense
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_28[0]`,
    formLabel: 'Line 18: Office expense',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['18'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 19: Pension and profit-sharing plans
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_29[0]`,
    formLabel: 'Line 19: Pension and profit-sharing plans',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['19'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 20a: Rent — Vehicles, machinery, equipment
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_30[0]`,
    formLabel: 'Line 20a: Rent — vehicles, machinery, equipment',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['20a'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 20b: Rent — Other business property
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_31[0]`,
    formLabel: 'Line 20b: Rent — other business property',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['20b'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 21: Repairs and maintenance
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_32[0]`,
    formLabel: 'Line 21: Repairs and maintenance',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['21'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 22: Supplies
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_33[0]`,
    formLabel: 'Line 22: Supplies',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['22'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 23: Taxes and licenses
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_34[0]`,
    formLabel: 'Line 23: Taxes and licenses',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['23'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 24a: Travel
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_35[0]`,
    formLabel: 'Line 24a: Travel',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['24a'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 24b: Deductible meals
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_36[0]`,
    formLabel: 'Line 24b: Deductible meals',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['24b'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 25: Utilities
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_37[0]`,
    formLabel: 'Line 25: Utilities',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['25'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 26: Wages
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_38[0]`,
    formLabel: 'Line 26: Wages',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['26'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 27a: Energy efficient commercial bldgs deduction (Form 7205)
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_39[0]`,
    formLabel: 'Line 27a: Energy efficient commercial buildings deduction',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['27a'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // Line 27b: Other expenses (from Part V, line 48)
  {
    pdfFieldName: `${P1}.Lines18-27[0].f1_40[0]`,
    formLabel: 'Line 27b: Other expenses (from line 48)',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['27'] || calc.scheduleC?.lineItems?.['27b'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },

  // ══════════════════════════════════════════════════════════════
  // Lines 28-31 — Totals
  // ══════════════════════════════════════════════════════════════

  // Line 28: Total expenses
  {
    pdfFieldName: `${P1}.f1_41[0]`,
    formLabel: 'Line 28: Total expenses before home office',
    sourcePath: 'scheduleC.totalExpenses',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 29: Tentative profit (loss)
  {
    pdfFieldName: `${P1}.f1_42[0]`,
    formLabel: 'Line 29: Tentative profit (or loss)',
    sourcePath: 'scheduleC.tentativeProfit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 30: Expenses for business use of home
  {
    pdfFieldName: `${P1}.Line30_ReadOrder[0].f1_44[0]`,
    formLabel: 'Line 30: Expenses for business use of home',
    sourcePath: 'scheduleC.homeOfficeDeduction',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 31: Net profit (or loss)
  {
    pdfFieldName: `${P1}.f1_45[0]`,
    formLabel: 'Line 31: Net profit (or loss)',
    sourcePath: 'scheduleC.netProfit',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // Line 32a: All investment is at risk
  {
    pdfFieldName: `${P1}.c1_7[0]`,
    formLabel: 'Line 32a: All investment is at risk',
    sourcePath: '',
    source: 'calculationResult',
    format: 'checkbox',
    transform: (_tr, calc) => (calc.scheduleC?.netProfit || 0) < 0,
  },

  // ══════════════════════════════════════════════════════════════
  // Page 2 — Part III: Cost of Goods Sold (Lines 33-42)
  // ══════════════════════════════════════════════════════════════

  // Line 35: Inventory at beginning of year
  {
    pdfFieldName: `${P2}.f2_1[0]`,
    sourcePath: 'costOfGoodsSold.beginningInventory',
    source: 'taxReturn',
    format: 'dollarNoCents',
    editable: true,
    formLabel: 'Line 35: Inventory at beginning of year',
  },

  // Line 36: Purchases
  {
    pdfFieldName: `${P2}.f2_2[0]`,
    sourcePath: 'costOfGoodsSold.purchases',
    source: 'taxReturn',
    format: 'dollarNoCents',
    editable: true,
    formLabel: 'Line 36: Purchases less cost of items withdrawn',
  },

  // Line 37: Cost of labor
  {
    pdfFieldName: `${P2}.f2_3[0]`,
    sourcePath: 'costOfGoodsSold.costOfLabor',
    source: 'taxReturn',
    format: 'dollarNoCents',
    editable: true,
    formLabel: 'Line 37: Cost of labor',
  },

  // Line 38: Materials and supplies
  {
    pdfFieldName: `${P2}.f2_4[0]`,
    sourcePath: 'costOfGoodsSold.materialsAndSupplies',
    source: 'taxReturn',
    format: 'dollarNoCents',
    editable: true,
    formLabel: 'Line 38: Materials and supplies',
  },

  // Line 39: Other costs
  {
    pdfFieldName: `${P2}.f2_5[0]`,
    sourcePath: 'costOfGoodsSold.otherCosts',
    source: 'taxReturn',
    format: 'dollarNoCents',
    editable: true,
    formLabel: 'Line 39: Other costs',
  },

  // Line 40: Add lines 35 through 39 (computed)
  {
    pdfFieldName: `${P2}.f2_6[0]`,
    formLabel: 'Line 40: Add lines 35 through 39',
    sourcePath: '',
    source: 'taxReturn',
    format: 'dollarNoCents',
    transform: (tr) => {
      const cogs = tr.costOfGoodsSold;
      if (!cogs) return '';
      const total = (cogs.beginningInventory || 0) + (cogs.purchases || 0) +
        (cogs.costOfLabor || 0) + (cogs.materialsAndSupplies || 0) + (cogs.otherCosts || 0);
      return total ? Math.round(total).toString() : '';
    },
  },

  // Line 41: Inventory at end of year
  {
    pdfFieldName: `${P2}.f2_7[0]`,
    sourcePath: 'costOfGoodsSold.endingInventory',
    source: 'taxReturn',
    format: 'dollarNoCents',
    editable: true,
    formLabel: 'Line 41: Inventory at end of year',
  },

  // Line 42: Cost of goods sold (line 40 - line 41)
  {
    pdfFieldName: `${P2}.f2_8[0]`,
    formLabel: 'Line 42: Cost of goods sold',
    sourcePath: 'scheduleC.costOfGoodsSold',
    source: 'calculationResult',
    format: 'dollarNoCents',
  },

  // ══════════════════════════════════════════════════════════════
  // Page 2 — Part V: Other Expenses (Line 48 total)
  // PartVTable items map individual other expense description/amount pairs
  // ══════════════════════════════════════════════════════════════

  // Line 48: Total other expenses
  {
    pdfFieldName: `${P2}.f2_33[0]`,
    formLabel: 'Line 48: Total other expenses',
    sourcePath: '',
    source: 'calculationResult',
    format: 'dollarNoCents',
    transform: (_tr, calc) => {
      const v = calc.scheduleC?.lineItems?.['27'] || calc.scheduleC?.lineItems?.['27b'] || 0;
      return v ? Math.round(v).toString() : '';
    },
  },
];

export const SCHEDULE_C_TEMPLATE: IRSFormTemplate = {
  formId: 'f1040sc',
  displayName: 'Schedule C',
  attachmentSequence: 9,
  pdfFileName: 'f1040sc.pdf',
  condition: (_tr: TaxReturn, calc: CalculationResult) => {
    // Include if any Schedule C activity exists
    const hasReceipts = (calc.scheduleC?.grossReceipts ?? 0) !== 0;
    const hasProfit = (calc.scheduleC?.netProfit ?? 0) !== 0;
    return hasReceipts || hasProfit;
  },
  fields: SCHEDULE_C_FIELDS,
};
