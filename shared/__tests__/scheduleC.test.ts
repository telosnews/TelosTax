import { describe, it, expect } from 'vitest';
import { calculateScheduleC, computeCOGS } from '../src/engine/scheduleC.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'income',
    dependents: [],
    w2Income: [],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    incomeK1: [],
    income1099SA: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    incomeW2G: [],
    rentalProperties: [],
    otherIncome: 0,
    businesses: [],
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as TaxReturn;
}

// ═══════════════════════════════════════════════════════════════
// Lines 1-7: Gross Income Pipeline
// ═══════════════════════════════════════════════════════════════

describe('Schedule C — Lines 1-7 Gross Income Pipeline', () => {
  it('Line 1: sums 1099-NEC and 1099-K into grossReceipts', () => {
    const tr = makeTaxReturn({
      income1099NEC: [
        { id: '1', payerName: 'Client A', amount: 50000 },
        { id: '2', payerName: 'Client B', amount: 25000 },
      ],
      income1099K: [
        { id: '3', platformName: 'Stripe', grossAmount: 20000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.grossReceipts).toBe(95000);
    expect(result.grossIncome).toBe(95000);  // No adjustments
  });

  it('Line 2: subtracts 1099-K returnsAndAllowances', () => {
    const tr = makeTaxReturn({
      income1099K: [
        { id: '1', platformName: 'Uber', grossAmount: 60000, returnsAndAllowances: 15000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.grossReceipts).toBe(60000);
    expect(result.returnsAndAllowances).toBe(15000);
    expect(result.netReceipts).toBe(45000);
    expect(result.grossIncome).toBe(45000);
  });

  it('Line 2: combines 1099-K adjustments with top-level returnsAndAllowances', () => {
    const tr = makeTaxReturn({
      income1099K: [
        { id: '1', platformName: 'Etsy', grossAmount: 50000, returnsAndAllowances: 5000 },
      ],
      returnsAndAllowances: 2000,  // Additional non-1099-K returns
    });
    const result = calculateScheduleC(tr);
    expect(result.returnsAndAllowances).toBe(7000);
    expect(result.netReceipts).toBe(43000);
  });

  it('Line 4: subtracts cost of goods sold', () => {
    const tr = makeTaxReturn({
      income1099K: [
        { id: '1', platformName: 'Etsy', grossAmount: 50000 },
      ],
      costOfGoodsSold: {
        beginningInventory: 5000,
        purchases: 25000,
        endingInventory: 8000,
      },
    });
    const result = calculateScheduleC(tr);
    expect(result.costOfGoodsSold).toBe(22000);  // 5k + 25k - 8k
    expect(result.grossProfit).toBe(28000);       // 50k - 22k
    expect(result.grossIncome).toBe(28000);
  });

  it('Lines 1-7 full pipeline: receipts - returns - COGS = gross income', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Freelance', amount: 30000 }],
      income1099K: [
        { id: '2', platformName: 'Etsy', grossAmount: 50000, returnsAndAllowances: 5000 },
      ],
      costOfGoodsSold: {
        beginningInventory: 3000,
        purchases: 20000,
        endingInventory: 5000,
      },
    });
    const result = calculateScheduleC(tr);
    expect(result.grossReceipts).toBe(80000);          // 30k + 50k
    expect(result.returnsAndAllowances).toBe(5000);
    expect(result.netReceipts).toBe(75000);             // 80k - 5k
    expect(result.costOfGoodsSold).toBe(18000);         // 3k + 20k - 5k
    expect(result.grossProfit).toBe(57000);             // 75k - 18k
    expect(result.grossIncome).toBe(57000);
  });

  it('backward compat: no COGS or returns works like before', () => {
    const tr = makeTaxReturn({
      income1099NEC: [
        { id: '1', payerName: 'Client A', amount: 50000 },
        { id: '2', payerName: 'Client B', amount: 25000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.grossReceipts).toBe(75000);
    expect(result.returnsAndAllowances).toBe(0);
    expect(result.costOfGoodsSold).toBe(0);
    expect(result.grossIncome).toBe(75000);
    expect(result.netProfit).toBe(75000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Cost of Goods Sold (Part III)
// ═══════════════════════════════════════════════════════════════

describe('Schedule C — Cost of Goods Sold (Part III)', () => {
  it('computes COGS from all Part III fields', () => {
    const cogs = computeCOGS({
      beginningInventory: 5000,
      purchases: 20000,
      costOfLabor: 3000,
      materialsAndSupplies: 2000,
      otherCosts: 1000,
      endingInventory: 8000,
    });
    // Line 40 = 5k + 20k + 3k + 2k + 1k = 31k
    // Line 42 = 31k - 8k = 23k
    expect(cogs).toBe(23000);
  });

  it('returns 0 when no COGS data', () => {
    expect(computeCOGS(undefined)).toBe(0);
    expect(computeCOGS({})).toBe(0);
  });

  it('handles zero ending inventory', () => {
    const cogs = computeCOGS({
      purchases: 10000,
      endingInventory: 0,
    });
    expect(cogs).toBe(10000);
  });

  it('floors COGS at 0 when ending > beginning + purchases', () => {
    const cogs = computeCOGS({
      beginningInventory: 1000,
      purchases: 2000,
      endingInventory: 50000,  // Way more than available
    });
    expect(cogs).toBe(0);  // Floored at 0
  });

  it('handles missing optional fields', () => {
    const cogs = computeCOGS({
      purchases: 15000,
      endingInventory: 3000,
    });
    // Only purchases - ending inventory
    expect(cogs).toBe(12000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Line 24: Travel / Meals Split (IRC §274(n))
// ═══════════════════════════════════════════════════════════════

describe('Schedule C — Travel & Meals Split', () => {
  it('deducts travel at 100%', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 24, category: 'travel', amount: 5000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['24a']).toBe(5000);
    expect(result.totalExpenses).toBe(5000);
  });

  it('deducts meals at 50%', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 24, category: 'meals', amount: 2000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['24b']).toBe(1000);  // 50% of 2000
    expect(result.totalExpenses).toBe(1000);
  });

  it('handles both travel and meals in same return', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 24, category: 'travel', amount: 3000 },
        { id: 'e2', scheduleCLine: 24, category: 'meals', amount: 2000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['24a']).toBe(3000);   // Travel: 100%
    expect(result.lineItems['24b']).toBe(1000);   // Meals: 50% of 2000
    expect(result.totalExpenses).toBe(4000);       // 3000 + 1000
  });

  it('backward compat: legacy travel_meals treated as travel (100%)', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 24, category: 'travel_meals', amount: 4000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['24a']).toBe(4000);  // Legacy → travel at 100%
    expect(result.totalExpenses).toBe(4000);
  });

  it('deducts DOT meals at 80% (IRC §274(n)(3))', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 24, category: 'meals_dot', amount: 5000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['24b']).toBe(4000);  // 80% of 5000
    expect(result.totalExpenses).toBe(4000);
  });

  it('fully deductible meals at 100%', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 24, category: 'meals_full', amount: 3000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['24b']).toBe(3000);  // 100% of 3000
    expect(result.totalExpenses).toBe(3000);
  });

  it('handles all three meal tiers in same return', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 24, category: 'travel', amount: 5000 },
        { id: 'e2', scheduleCLine: 24, category: 'meals', amount: 2000 },
        { id: 'e3', scheduleCLine: 24, category: 'meals_dot', amount: 1000 },
        { id: 'e4', scheduleCLine: 24, category: 'meals_full', amount: 500 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['24a']).toBe(5000);    // Travel: 100%
    // 24b = 50% of 2000 + 80% of 1000 + 100% of 500 = 1000 + 800 + 500 = 2300
    expect(result.lineItems['24b']).toBe(2300);
    // Total = 5000 + 1000 + 800 + 500 = 7300
    expect(result.totalExpenses).toBe(7300);
  });

  it('DOT trucker scenario: 80% meals with mileage', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Trucking Co', amount: 80000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 24, category: 'meals_dot', amount: 10000 },
        { id: 'e2', scheduleCLine: 15, category: 'insurance', amount: 3000 },
      ],
      vehicle: { method: 'standard_mileage', businessMiles: 50000 },
    });
    const result = calculateScheduleC(tr);
    // DOT meals: 80% of 10000 = 8000
    expect(result.lineItems['24b']).toBe(8000);
    expect(result.lineItems['15']).toBe(3000);
    // Vehicle: 50000 × $0.70 = $35,000
    expect(result.vehicleDeduction).toBe(35000);
    // Net: 80000 - 8000 - 3000 - 35000 = 34000
    expect(result.netProfit).toBe(34000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Expenses and Net Profit
// ═══════════════════════════════════════════════════════════════

describe('Schedule C — Expenses & Net Profit', () => {
  it('subtracts expenses by line number', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office_expense', amount: 2000 },
        { id: 'e2', scheduleCLine: 25, category: 'utilities', amount: 3000 },
        { id: 'e3', scheduleCLine: 18, category: 'office_expense', amount: 500 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.totalExpenses).toBe(5500);
    expect(result.lineItems['18']).toBe(2500);
    expect(result.lineItems['25']).toBe(3000);
    expect(result.netProfit).toBe(94500);
  });

  it('computes net profit: gross income - expenses - home office - vehicle', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 80000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office_expense', amount: 5000 },
      ],
      homeOffice: { method: 'simplified', squareFeet: 200 },
    });
    const result = calculateScheduleC(tr);
    // Gross income = 80k
    // Expenses = 5k
    // Tentative profit = 75k
    // Home office = 200 × $5 = $1000
    // Net profit = 75k - 1k = 74k
    expect(result.tentativeProfit).toBe(75000);
    expect(result.homeOfficeDeduction).toBe(1000);
    expect(result.netProfit).toBe(74000);
  });

  it('full scenario: Uber driver with adjustments, expenses, meals', () => {
    const tr = makeTaxReturn({
      income1099K: [
        { id: '1', platformName: 'Uber', grossAmount: 60000, returnsAndAllowances: 15000 },
      ],
      expenses: [
        { id: 'e1', scheduleCLine: 15, category: 'insurance', amount: 1200 },
        { id: 'e2', scheduleCLine: 25, category: 'utilities', amount: 600 },
        { id: 'e3', scheduleCLine: 24, category: 'meals', amount: 800 },
      ],
      vehicle: { method: 'standard_mileage', businessMiles: 20000 },
    });
    const result = calculateScheduleC(tr);
    // Gross: 60k gross - 15k adjustments = 45k
    expect(result.grossReceipts).toBe(60000);
    expect(result.returnsAndAllowances).toBe(15000);
    expect(result.grossIncome).toBe(45000);
    // Expenses: 1200 + 600 + 400 (50% of 800) = 2200
    expect(result.totalExpenses).toBe(2200);
    // Vehicle: 20000 × $0.70 = $14,000
    expect(result.vehicleDeduction).toBe(14000);
    // Net: 45000 - 2200 - 14000 = 28800
    expect(result.netProfit).toBe(28800);
  });

  it('full scenario: Etsy seller with COGS and returns', () => {
    const tr = makeTaxReturn({
      income1099K: [
        { id: '1', platformName: 'Etsy', grossAmount: 50000, returnsAndAllowances: 3000 },
      ],
      costOfGoodsSold: {
        beginningInventory: 2000,
        purchases: 18000,
        materialsAndSupplies: 3000,
        endingInventory: 5000,
      },
      expenses: [
        { id: 'e1', scheduleCLine: 22, category: 'supplies', amount: 500 },
        { id: 'e2', scheduleCLine: 8, category: 'advertising', amount: 1200 },
      ],
    });
    const result = calculateScheduleC(tr);
    // Line 1: 50k gross
    // Line 2: 3k returns
    // Line 3: 47k net receipts
    // Line 4: COGS = 2k + 18k + 3k - 5k = 18k
    // Line 5/7: 47k - 18k = 29k gross income
    expect(result.grossIncome).toBe(29000);
    // Expenses: 500 + 1200 = 1700
    expect(result.totalExpenses).toBe(1700);
    // Net: 29000 - 1700 = 27300
    expect(result.netProfit).toBe(27300);
  });
});

// ═══════════════════════════════════════════════════════════════
// Home Office Deduction
// ═══════════════════════════════════════════════════════════════

describe('Schedule C — Home Office', () => {
  it('applies simplified home office deduction', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 80000 }],
      homeOffice: { method: 'simplified', squareFeet: 200 },
    });
    const result = calculateScheduleC(tr);
    expect(result.homeOfficeDeduction).toBe(1000);
    expect(result.netProfit).toBe(79000);
  });

  it('limits simplified home office to tentative profit', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 1000 }],
      expenses: [{ id: 'e1', scheduleCLine: 27, category: 'other', amount: 500 }],
      homeOffice: { method: 'simplified', squareFeet: 300 },
    });
    const result = calculateScheduleC(tr);
    expect(result.homeOfficeDeduction).toBe(500);
    expect(result.netProfit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Withholding (form1040 integration)
// ═══════════════════════════════════════════════════════════════

describe('Schedule C — Withholding integration', () => {
  it('1099-NEC withholding flows to form1040 totalWithholding', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [
        { id: '1', payerName: 'Client', amount: 50000, federalTaxWithheld: 12000 },
      ],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.totalWithholding).toBeGreaterThanOrEqual(12000);
  });

  it('1099-K withholding flows to form1040 totalWithholding', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099K: [
        { id: '1', platformName: 'Stripe', grossAmount: 50000, federalTaxWithheld: 12000 },
      ],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.totalWithholding).toBeGreaterThanOrEqual(12000);
  });

  it('combined NEC + K withholding sums correctly', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [
        { id: '1', payerName: 'Client', amount: 30000, federalTaxWithheld: 7200 },
      ],
      income1099K: [
        { id: '2', platformName: 'Stripe', grossAmount: 20000, federalTaxWithheld: 4800 },
      ],
    });
    const result = calculateForm1040(tr);
    // Should include at least 7200 + 4800 = 12000
    expect(result.form1040.totalWithholding).toBeGreaterThanOrEqual(12000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════════

describe('Schedule C — Edge Cases', () => {
  it('zero income returns zeros', () => {
    const tr = makeTaxReturn({});
    const result = calculateScheduleC(tr);
    expect(result.grossReceipts).toBe(0);
    expect(result.grossIncome).toBe(0);
    expect(result.netProfit).toBe(0);
  });

  it('returns exceeding gross still produces non-negative netReceipts conceptually', () => {
    const tr = makeTaxReturn({
      income1099K: [
        { id: '1', platformName: 'eBay', grossAmount: 1000, returnsAndAllowances: 2000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.grossReceipts).toBe(1000);
    expect(result.returnsAndAllowances).toBe(2000);
    expect(result.netReceipts).toBe(-1000);  // Can go negative (net loss)
    expect(result.grossIncome).toBe(-1000);
  });

  it('handles large mixed scenario correctly', () => {
    const tr = makeTaxReturn({
      income1099NEC: [
        { id: '1', payerName: 'Web Design', amount: 80000 },
      ],
      income1099K: [
        { id: '2', platformName: 'Etsy Shop', grossAmount: 40000, returnsAndAllowances: 8000 },
        { id: '3', platformName: 'eBay Resale', grossAmount: 20000, returnsAndAllowances: 2000 },
      ],
      costOfGoodsSold: {
        beginningInventory: 5000,
        purchases: 25000,
        costOfLabor: 3000,
        endingInventory: 7000,
      },
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office_expense', amount: 3000 },
        { id: 'e2', scheduleCLine: 24, category: 'travel', amount: 5000 },
        { id: 'e3', scheduleCLine: 24, category: 'meals', amount: 2000 },
        { id: 'e4', scheduleCLine: 25, category: 'utilities', amount: 1200 },
      ],
      homeOffice: { method: 'simplified', squareFeet: 250 },
    });
    const result = calculateScheduleC(tr);

    // Line 1: 80k + 40k + 20k = 140k
    expect(result.grossReceipts).toBe(140000);
    // Line 2: 8k + 2k = 10k
    expect(result.returnsAndAllowances).toBe(10000);
    // Line 3: 130k
    expect(result.netReceipts).toBe(130000);
    // Line 4: COGS = 5k + 25k + 3k - 7k = 26k
    expect(result.costOfGoodsSold).toBe(26000);
    // Line 5/7: 130k - 26k = 104k
    expect(result.grossIncome).toBe(104000);

    // Expenses: 3000 + 5000 (travel 100%) + 1000 (meals 50%) + 1200 = 10200
    expect(result.totalExpenses).toBe(10200);
    // Tentative profit: 104000 - 10200 = 93800
    expect(result.tentativeProfit).toBe(93800);
    // Home office: 250 × $5 = $1250
    expect(result.homeOfficeDeduction).toBe(1250);
    // Net: 93800 - 1250 = 92550
    expect(result.netProfit).toBe(92550);
  });
});

// ═══════════════════════════════════════════════════════════════
// Multi-Business Income Routing by businessId
// ═══════════════════════════════════════════════════════════════

describe('Schedule C — Income Routing by businessId', () => {
  const biz1 = { id: 'biz-1', businessName: 'Freelance Design', accountingMethod: 'cash' as const, didStartThisYear: false };
  const biz2 = { id: 'biz-2', businessName: 'Uber Driving', accountingMethod: 'cash' as const, didStartThisYear: false };

  it('routes 1099-NEC income to specific businesses by businessId', () => {
    const tr = makeTaxReturn({
      businesses: [biz1, biz2],
      income1099NEC: [
        { id: 'n1', payerName: 'Client A', amount: 50000, businessId: 'biz-1' },
        { id: 'n2', payerName: 'Client B', amount: 30000, businessId: 'biz-2' },
      ],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office', amount: 5000, businessId: 'biz-1' },
        { id: 'e2', scheduleCLine: 9, category: 'car', amount: 10000, businessId: 'biz-2' },
      ],
    });
    const result = calculateScheduleC(tr);

    expect(result.businessResults).toBeDefined();
    expect(result.businessResults!.length).toBe(2);

    const design = result.businessResults!.find(b => b.businessId === 'biz-1')!;
    expect(design.grossIncome).toBe(50000);
    expect(design.totalExpenses).toBe(5000);
    expect(design.netProfit).toBe(45000);

    const uber = result.businessResults!.find(b => b.businessId === 'biz-2')!;
    expect(uber.grossIncome).toBe(30000);
    expect(uber.totalExpenses).toBe(10000);
    expect(uber.netProfit).toBe(20000);

    // Aggregate is still correct
    expect(result.grossReceipts).toBe(80000);
    expect(result.netProfit).toBe(65000);
  });

  it('routes 1099-K income to specific businesses by businessId', () => {
    const tr = makeTaxReturn({
      businesses: [biz1, biz2],
      income1099K: [
        { id: 'k1', platformName: 'Stripe', grossAmount: 40000, returnsAndAllowances: 2000, businessId: 'biz-1' },
        { id: 'k2', platformName: 'Uber', grossAmount: 20000, businessId: 'biz-2' },
      ],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office', amount: 3000, businessId: 'biz-1' },
        { id: 'e2', scheduleCLine: 9, category: 'car', amount: 5000, businessId: 'biz-2' },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.businessResults).toBeDefined();

    const design = result.businessResults!.find(b => b.businessId === 'biz-1')!;
    // 1099-K net: 40000 - 2000 = 38000
    expect(design.grossIncome).toBe(38000);
    expect(design.netProfit).toBe(35000);

    const uber = result.businessResults!.find(b => b.businessId === 'biz-2')!;
    expect(uber.grossIncome).toBe(20000);
    expect(uber.netProfit).toBe(15000);
  });

  it('distributes unassigned income proportionally among assigned businesses', () => {
    const tr = makeTaxReturn({
      businesses: [biz1, biz2],
      income1099NEC: [
        { id: 'n1', payerName: 'Client A', amount: 30000, businessId: 'biz-1' },
        { id: 'n2', payerName: 'Client B', amount: 10000, businessId: 'biz-2' },
        { id: 'n3', payerName: 'Misc Client', amount: 20000 }, // unassigned
      ],
      expenses: [],
    });
    const result = calculateScheduleC(tr);
    expect(result.businessResults).toBeDefined();

    // biz-1 has 30k assigned (75% of 40k assigned total)
    // biz-2 has 10k assigned (25% of 40k assigned total)
    // 20k unassigned: biz-1 gets 75% = 15k, biz-2 gets 25% = 5k
    const design = result.businessResults!.find(b => b.businessId === 'biz-1')!;
    expect(design.grossIncome).toBe(45000); // 30k + 15k

    const uber = result.businessResults!.find(b => b.businessId === 'biz-2')!;
    expect(uber.grossIncome).toBe(15000); // 10k + 5k

    // Aggregate still correct
    expect(result.grossReceipts).toBe(60000);
  });

  it('falls back to expense-ratio heuristic when no income is assigned', () => {
    const tr = makeTaxReturn({
      businesses: [biz1, biz2],
      income1099NEC: [
        { id: 'n1', payerName: 'Client A', amount: 60000 }, // no businessId
        { id: 'n2', payerName: 'Client B', amount: 40000 }, // no businessId
      ],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office', amount: 6000, businessId: 'biz-1' },
        { id: 'e2', scheduleCLine: 9, category: 'car', amount: 4000, businessId: 'biz-2' },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.businessResults).toBeDefined();

    // Total expenses: 10k; biz-1 = 60%, biz-2 = 40%
    // grossIncome = 100k; biz-1 gets 60k, biz-2 gets 40k
    const design = result.businessResults!.find(b => b.businessId === 'biz-1')!;
    expect(design.grossIncome).toBe(60000);
    expect(design.netProfit).toBe(54000); // 60k - 6k

    const uber = result.businessResults!.find(b => b.businessId === 'biz-2')!;
    expect(uber.grossIncome).toBe(40000);
    expect(uber.netProfit).toBe(36000); // 40k - 4k
  });

  it('single business does not produce businessResults', () => {
    const tr = makeTaxReturn({
      businesses: [biz1],
      income1099NEC: [
        { id: 'n1', payerName: 'Client A', amount: 50000, businessId: 'biz-1' },
      ],
      expenses: [],
    });
    const result = calculateScheduleC(tr);
    expect(result.businessResults).toBeUndefined();
    expect(result.grossReceipts).toBe(50000);
  });

  it('backward compat: singular business field with no businessId on income', () => {
    const tr = makeTaxReturn({
      business: biz1,
      income1099NEC: [
        { id: 'n1', payerName: 'Client A', amount: 50000 },
      ],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office', amount: 5000 },
      ],
    });
    const result = calculateScheduleC(tr);
    // Only one business → no businessResults
    expect(result.businessResults).toBeUndefined();
    expect(result.grossReceipts).toBe(50000);
    expect(result.netProfit).toBe(45000);
  });

  it('applies 50% meals limitation in per-business expense totals', () => {
    const tr = makeTaxReturn({
      businesses: [biz1, biz2],
      income1099NEC: [
        { id: 'n1', payerName: 'Client A', amount: 40000, businessId: 'biz-1' },
        { id: 'n2', payerName: 'Client B', amount: 20000, businessId: 'biz-2' },
      ],
      expenses: [
        { id: 'e1', scheduleCLine: 24, category: 'meals', amount: 2000, businessId: 'biz-1' },
        { id: 'e2', scheduleCLine: 18, category: 'office', amount: 3000, businessId: 'biz-2' },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.businessResults).toBeDefined();

    const design = result.businessResults!.find(b => b.businessId === 'biz-1')!;
    expect(design.totalExpenses).toBe(1000); // 2000 * 0.5
    expect(design.netProfit).toBe(39000); // 40k - 1k

    const uber = result.businessResults!.find(b => b.businessId === 'biz-2')!;
    expect(uber.totalExpenses).toBe(3000);
    expect(uber.netProfit).toBe(17000);
  });

  it('applies DOT 80% meals limitation in per-business expense totals', () => {
    const tr = makeTaxReturn({
      businesses: [biz1, biz2],
      income1099NEC: [
        { id: 'n1', payerName: 'Client A', amount: 40000, businessId: 'biz-1' },
        { id: 'n2', payerName: 'Client B', amount: 20000, businessId: 'biz-2' },
      ],
      expenses: [
        { id: 'e1', scheduleCLine: 24, category: 'meals_dot', amount: 5000, businessId: 'biz-1' },
        { id: 'e2', scheduleCLine: 24, category: 'meals_full', amount: 1000, businessId: 'biz-2' },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.businessResults).toBeDefined();

    const design = result.businessResults!.find(b => b.businessId === 'biz-1')!;
    expect(design.totalExpenses).toBe(4000); // 5000 * 0.8 (DOT)
    expect(design.netProfit).toBe(36000);

    const uber = result.businessResults!.find(b => b.businessId === 'biz-2')!;
    expect(uber.totalExpenses).toBe(1000); // 1000 * 1.0 (fully deductible)
    expect(uber.netProfit).toBe(19000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Line 9 / Vehicle Double-Count Prevention
// ═══════════════════════════════════════════════════════════════

describe('Schedule C — Line 9 / Vehicle double-count prevention', () => {
  it('suppresses Line 9 when vehicle deduction is active (standard mileage)', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 9, category: 'car_truck', amount: 5000 },
        { id: 'e2', scheduleCLine: 18, category: 'office_expense', amount: 2000 },
      ],
      vehicle: { method: 'standard_mileage', businessMiles: 10000 },
    });
    const result = calculateScheduleC(tr);

    // Line 9 ($5000) should be suppressed; only office ($2000) counted
    expect(result.totalExpenses).toBe(2000);
    // Vehicle deduction: 10000 × $0.70 = $7,000
    expect(result.vehicleDeduction).toBe(7000);
    // Net: 100000 - 2000 - 7000 = 91000 (NOT 100000 - 7000 - 7000 = 86000)
    expect(result.netProfit).toBe(91000);
    // Suppression metadata
    expect(result.line9Suppressed).toBe(true);
    expect(result.suppressedLine9Amount).toBe(5000);
    // Line 9 should NOT appear in lineItems
    expect(result.lineItems['9']).toBeUndefined();
  });

  it('suppresses Line 9 when vehicle deduction is active (actual method)', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 9, category: 'car_truck', amount: 8000 },
      ],
      vehicle: {
        method: 'actual',
        businessMiles: 15000,
        totalMiles: 20000,
        gas: 4000,
        insurance: 2000,
        repairs: 1500,
      },
    });
    const result = calculateScheduleC(tr);

    // Line 9 ($8000) suppressed
    expect(result.totalExpenses).toBe(0);
    // Actual: business % = 15000/20000 = 75%, expenses = 7500, × 0.75 = 5625
    expect(result.vehicleDeduction).toBe(5625);
    expect(result.netProfit).toBe(94375);
    expect(result.line9Suppressed).toBe(true);
    expect(result.suppressedLine9Amount).toBe(8000);
  });

  it('does NOT suppress Line 9 when no vehicle object exists', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 9, category: 'car_truck', amount: 5000 },
      ],
    });
    const result = calculateScheduleC(tr);

    // Line 9 should count normally
    expect(result.totalExpenses).toBe(5000);
    expect(result.vehicleDeduction).toBe(0);
    expect(result.netProfit).toBe(95000);
    expect(result.lineItems['9']).toBe(5000);
    // No suppression
    expect(result.line9Suppressed).toBeUndefined();
    expect(result.suppressedLine9Amount).toBeUndefined();
  });

  it('does NOT suppress Line 9 when vehicle method is null', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 9, category: 'car_truck', amount: 5000 },
      ],
      vehicle: { method: null },
    });
    const result = calculateScheduleC(tr);

    expect(result.totalExpenses).toBe(5000);
    expect(result.vehicleDeduction).toBe(0);
    expect(result.netProfit).toBe(95000);
    expect(result.line9Suppressed).toBeUndefined();
  });

  it('vehicle-only (no Line 9 expenses) still works normally', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office_expense', amount: 3000 },
      ],
      vehicle: { method: 'standard_mileage', businessMiles: 10000 },
    });
    const result = calculateScheduleC(tr);

    expect(result.totalExpenses).toBe(3000);
    expect(result.vehicleDeduction).toBe(7000);
    expect(result.netProfit).toBe(90000);
    // No Line 9 to suppress
    expect(result.line9Suppressed).toBeUndefined();
  });

  it('suppresses multiple Line 9 expenses when vehicle is active', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 9, category: 'car_truck', amount: 3000 },
        { id: 'e2', scheduleCLine: 9, category: 'car_truck', amount: 2000 },
        { id: 'e3', scheduleCLine: 18, category: 'office_expense', amount: 1000 },
      ],
      vehicle: { method: 'standard_mileage', businessMiles: 5000 },
    });
    const result = calculateScheduleC(tr);

    // Both Line 9 entries suppressed ($3000 + $2000 = $5000)
    expect(result.totalExpenses).toBe(1000); // Only office
    expect(result.vehicleDeduction).toBe(3500); // 5000 × $0.70
    expect(result.suppressedLine9Amount).toBe(5000);
    expect(result.line9Suppressed).toBe(true);
  });

  it('suppresses Line 9 in multi-business breakdown too', () => {
    const biz1 = { id: 'biz-1', businessName: 'Design', accountingMethod: 'cash' as const, didStartThisYear: false };
    const biz2 = { id: 'biz-2', businessName: 'Rideshare', accountingMethod: 'cash' as const, didStartThisYear: false };

    const tr = makeTaxReturn({
      businesses: [biz1, biz2],
      income1099NEC: [
        { id: 'n1', payerName: 'Client A', amount: 50000, businessId: 'biz-1' },
        { id: 'n2', payerName: 'Uber', amount: 30000, businessId: 'biz-2' },
      ],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office', amount: 5000, businessId: 'biz-1' },
        { id: 'e2', scheduleCLine: 9, category: 'car_truck', amount: 8000, businessId: 'biz-2' },
      ],
      vehicle: { method: 'standard_mileage', businessMiles: 15000 },
    });
    const result = calculateScheduleC(tr);

    // Aggregate: Line 9 ($8000) suppressed from totalExpenses
    expect(result.totalExpenses).toBe(5000); // Only office
    expect(result.vehicleDeduction).toBe(10500); // 15000 × $0.70

    // Per-business: biz-2's Line 9 should be suppressed
    const rideshare = result.businessResults!.find(b => b.businessId === 'biz-2')!;
    expect(rideshare.totalExpenses).toBe(0); // Line 9 suppressed

    const design = result.businessResults!.find(b => b.businessId === 'biz-1')!;
    expect(design.totalExpenses).toBe(5000); // Unaffected
  });
});

// ═══════════════════════════════════════════════════════════════
// Line 19 — Pension & Profit-Sharing double-count prevention
// ═══════════════════════════════════════════════════════════════

describe('Schedule C — Line 19 / Pension double-count prevention', () => {
  it('suppresses Line 19 when no employee wages (Line 26) exist', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 19, category: 'pension', amount: 23000 },
        { id: 'e2', scheduleCLine: 18, category: 'office', amount: 500 },
      ],
    });
    const result = calculateScheduleC(tr);

    // Line 19 ($23,000) suppressed — only office ($500) in total
    expect(result.totalExpenses).toBe(500);
    expect(result.line19Suppressed).toBe(true);
    expect(result.suppressedLine19Amount).toBe(23000);
    expect(result.lineItems['19']).toBeUndefined();
  });

  it('does NOT suppress Line 19 when employee wages (Line 26) exist', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 200000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 19, category: 'pension', amount: 10000 },
        { id: 'e2', scheduleCLine: 26, category: 'wages', amount: 50000 },
      ],
    });
    const result = calculateScheduleC(tr);

    // Line 19 NOT suppressed — filer has employees
    expect(result.totalExpenses).toBe(60000);
    expect(result.line19Suppressed).toBeUndefined();
    expect(result.suppressedLine19Amount).toBeUndefined();
    expect(result.lineItems['19']).toBe(10000);
  });

  it('does NOT suppress when no Line 19 entries exist', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office', amount: 1000 },
      ],
    });
    const result = calculateScheduleC(tr);

    expect(result.line19Suppressed).toBeUndefined();
    expect(result.suppressedLine19Amount).toBeUndefined();
  });

  it('suppresses Line 19 in multi-business breakdown when no wages exist', () => {
    const biz1 = { id: 'biz-1', businessName: 'Consulting', accountingMethod: 'cash' as const, didStartThisYear: false };
    const biz2 = { id: 'biz-2', businessName: 'Freelance', accountingMethod: 'cash' as const, didStartThisYear: false };

    const tr = makeTaxReturn({
      businesses: [biz1, biz2],
      income1099NEC: [
        { id: 'n1', payerName: 'Client A', amount: 80000, businessId: 'biz-1' },
        { id: 'n2', payerName: 'Client B', amount: 40000, businessId: 'biz-2' },
      ],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office', amount: 2000, businessId: 'biz-1' },
        { id: 'e2', scheduleCLine: 19, category: 'pension', amount: 15000, businessId: 'biz-1' },
      ],
    });
    const result = calculateScheduleC(tr);

    // Aggregate: Line 19 ($15,000) suppressed
    expect(result.totalExpenses).toBe(2000);
    expect(result.line19Suppressed).toBe(true);
    expect(result.suppressedLine19Amount).toBe(15000);

    // Per-business: biz-1's Line 19 suppressed
    const consulting = result.businessResults!.find(b => b.businessId === 'biz-1')!;
    expect(consulting.totalExpenses).toBe(2000); // Only office
  });

  it('zero-amount Line 26 wages do not count as having employees', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 19, category: 'pension', amount: 5000 },
        { id: 'e2', scheduleCLine: 26, category: 'wages', amount: 0 },
      ],
    });
    const result = calculateScheduleC(tr);

    // Zero wages = no employees → Line 19 suppressed
    expect(result.line19Suppressed).toBe(true);
    expect(result.suppressedLine19Amount).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Line 16 — Interest sub-line split (16a/16b)
// ═══════════════════════════════════════════════════════════════

describe('Schedule C — Interest sub-line split (16a/16b)', () => {
  it('routes interest_mortgage to lineItems 16a', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 16, category: 'interest_mortgage', amount: 3000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['16a']).toBe(3000);
    expect(result.lineItems['16b']).toBeUndefined();
    expect(result.totalExpenses).toBe(3000);
  });

  it('routes interest_other to lineItems 16b', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 16, category: 'interest_other', amount: 1500 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['16a']).toBeUndefined();
    expect(result.lineItems['16b']).toBe(1500);
    expect(result.totalExpenses).toBe(1500);
  });

  it('handles both interest sub-categories together', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 16, category: 'interest_mortgage', amount: 5000 },
        { id: 'e2', scheduleCLine: 16, category: 'interest_other', amount: 2000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['16a']).toBe(5000);
    expect(result.lineItems['16b']).toBe(2000);
    expect(result.totalExpenses).toBe(7000);
  });

  it('legacy "interest" category defaults to 16b', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 16, category: 'interest', amount: 4000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['16a']).toBeUndefined();
    expect(result.lineItems['16b']).toBe(4000);
    expect(result.totalExpenses).toBe(4000);
  });
});

// ═══════════════════════════════════════════════════════════════
// Line 20 — Rent/Lease sub-line split (20a/20b)
// ═══════════════════════════════════════════════════════════════

describe('Schedule C — Rent/Lease sub-line split (20a/20b)', () => {
  it('routes rent_equipment to lineItems 20a', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 20, category: 'rent_equipment', amount: 6000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['20a']).toBe(6000);
    expect(result.lineItems['20b']).toBeUndefined();
    expect(result.totalExpenses).toBe(6000);
  });

  it('routes rent_property to lineItems 20b', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 20, category: 'rent_property', amount: 12000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['20a']).toBeUndefined();
    expect(result.lineItems['20b']).toBe(12000);
    expect(result.totalExpenses).toBe(12000);
  });

  it('handles both rent sub-categories together', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 20, category: 'rent_equipment', amount: 3000 },
        { id: 'e2', scheduleCLine: 20, category: 'rent_property', amount: 18000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['20a']).toBe(3000);
    expect(result.lineItems['20b']).toBe(18000);
    expect(result.totalExpenses).toBe(21000);
  });

  it('legacy "rent_lease" category defaults to 20b', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 100000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 20, category: 'rent_lease', amount: 15000 },
      ],
    });
    const result = calculateScheduleC(tr);
    expect(result.lineItems['20a']).toBeUndefined();
    expect(result.lineItems['20b']).toBe(15000);
    expect(result.totalExpenses).toBe(15000);
  });
});
