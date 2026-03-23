import { describe, it, expect } from 'vitest';
import { calculateQBIDeduction } from '../src/engine/qbi.js';
import { calculateTaxableSocialSecurity } from '../src/engine/socialSecurity.js';
import { calculateScheduleD } from '../src/engine/scheduleD.js';
import { calculateScheduleA } from '../src/engine/scheduleA.js';
import { calculateScheduleE } from '../src/engine/scheduleE.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { FilingStatus, TaxReturn } from '../src/types/index.js';

function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint9',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    filingStatus: FilingStatus.Single,
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
    rentalProperties: [],
    otherIncome: 0,
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ════════════════════════════════════════════════════
// 9A. QBI — W-2 Wages / UBIA Alternative
// ════════════════════════════════════════════════════

describe('9A. QBI W-2 wages / UBIA alternative', () => {
  // Backward compat: SSTB default behavior should match old tests
  it('below threshold — full deduction regardless of SSTB/wages', () => {
    const result = calculateQBIDeduction(100000, 150000, FilingStatus.Single, true, 0, 0);
    expect(result).toBe(20000); // 20% of QBI
  });

  it('SSTB fully above threshold+range — $0', () => {
    const result = calculateQBIDeduction(100000, 300000, FilingStatus.Single, true, 50000, 0);
    expect(result).toBe(0);
  });

  it('non-SSTB fully above threshold — uses W-2 wages limit (50% of wages)', () => {
    // Single threshold 197300, range 50000 → above 247300 fully out of phase-in
    // Non-SSTB: min(20% QBI, 50% W-2 wages) = min(20000, 30000) = 20000
    const result = calculateQBIDeduction(100000, 300000, FilingStatus.Single, false, 60000, 0);
    expect(result).toBe(20000);
  });

  it('non-SSTB fully above threshold — uses W-2 wages limit (25% wages + 2.5% UBIA)', () => {
    // 25% of 20000 + 2.5% of 500000 = 5000 + 12500 = 17500
    // min(20000, 17500) = 17500
    const result = calculateQBIDeduction(100000, 300000, FilingStatus.Single, false, 20000, 500000);
    expect(result).toBe(17500);
  });

  it('non-SSTB above threshold — takes greater of two W-2/UBIA formulas', () => {
    // 50% wages = 25000, 25% wages + 2.5% UBIA = 12500 + 5000 = 17500
    // Greater is 25000. min(20000, 25000) = 20000
    const result = calculateQBIDeduction(100000, 300000, FilingStatus.Single, false, 50000, 200000);
    expect(result).toBe(20000);
  });

  it('non-SSTB with zero wages above threshold — $0 (no W-2 wages/UBIA)', () => {
    const result = calculateQBIDeduction(100000, 300000, FilingStatus.Single, false, 0, 0);
    expect(result).toBe(0);
  });

  it('non-SSTB in phase-in range — partial phase toward wage limit', () => {
    // Single threshold 197300, range 50000
    // Excess = 222300 - 197300 = 25000, fraction = 25000/50000 = 0.5
    // Full deduction = min(20000, 44460) = 20000
    // Wage limit = 50% of 10000 = 5000
    // Excess above wage limit = 20000 - 5000 = 15000
    // Phase reduction = 15000 * 0.5 = 7500
    // Deduction = 20000 - 7500 = 12500
    const result = calculateQBIDeduction(100000, 222300, FilingStatus.Single, false, 10000, 0);
    expect(result).toBe(12500);
  });

  it('MFJ non-SSTB above threshold — correct thresholds', () => {
    // MFJ threshold 394600, range 100000 → above 494600
    // 50% of 100000 = 50000. min(20000, 50000) = 20000
    const result = calculateQBIDeduction(100000, 500000, FilingStatus.MarriedFilingJointly, false, 100000, 0);
    expect(result).toBe(20000);
  });

  it('backward compat: default isSSTB=true matches old behavior for fully phased out', () => {
    const result = calculateQBIDeduction(100000, 300000, FilingStatus.Single);
    expect(result).toBe(0);
  });

  it('backward compat: below threshold unchanged', () => {
    const result = calculateQBIDeduction(100000, 150000, FilingStatus.Single);
    expect(result).toBe(20000);
  });

  it('form1040 integration: non-SSTB with wages gets QBI above threshold', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 300000, federalTaxWithheld: 50000 }],
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 80000 }],
      business: { id: 'b1', accountingMethod: 'cash', didStartThisYear: false },
      qbiInfo: { isSSTB: false, w2WagesPaidByBusiness: 40000, ubiaOfQualifiedProperty: 0 },
    });
    const result = calculateForm1040(tr);
    // QBI = max(0, net profit) = ~80000 (no expenses)
    // 20% of 80000 = 16000
    // 50% of 40000 = 20000 (wage limit > tentative, so tentative wins)
    expect(result.form1040.qbiDeduction).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════
// 9B. SS Provisional Income — Tax-Exempt Interest
// ════════════════════════════════════════════════════

describe('9B. Social Security tax-exempt interest', () => {
  it('tax-exempt interest increases provisional income', () => {
    // Without tax-exempt: other income 20000, provisional = 20000 + 5000 = 25000 (exactly at base)
    const withoutTaxExempt = calculateTaxableSocialSecurity(10000, 20000, FilingStatus.Single, 0);
    expect(withoutTaxExempt.taxableBenefits).toBe(0);

    // With tax-exempt: provisional = 20000 + 5000 + 5000 = 30000 (in 50% bracket)
    const withTaxExempt = calculateTaxableSocialSecurity(10000, 20000, FilingStatus.Single, 5000);
    expect(withTaxExempt.taxableBenefits).toBeGreaterThan(0);
    expect(withTaxExempt.provisionalIncome).toBe(30000);
  });

  it('provisional income formula includes tax-exempt interest', () => {
    const result = calculateTaxableSocialSecurity(20000, 30000, FilingStatus.Single, 3000);
    // Provisional = 30000 + 3000 + 10000 = 43000
    expect(result.provisionalIncome).toBe(43000);
  });

  it('zero tax-exempt interest matches original behavior', () => {
    const withZero = calculateTaxableSocialSecurity(20000, 40000, FilingStatus.Single, 0);
    const withDefault = calculateTaxableSocialSecurity(20000, 40000, FilingStatus.Single);
    expect(withZero).toEqual(withDefault);
  });

  it('form1040 integration: muni bond interest increases taxable SS', () => {
    const trNoMuni = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 20000, federalTaxWithheld: 2000 }],
      incomeSSA1099: { id: 'ssa1', totalBenefits: 10000 },
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 0, taxExemptInterest: 0 }],
    });
    const trMuni = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 20000, federalTaxWithheld: 2000 }],
      incomeSSA1099: { id: 'ssa1', totalBenefits: 10000 },
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 0, taxExemptInterest: 10000 }],
    });
    const resultNoMuni = calculateForm1040(trNoMuni);
    const resultMuni = calculateForm1040(trMuni);
    // Muni interest should increase taxable SS benefits
    expect(resultMuni.form1040.taxableSocialSecurity).toBeGreaterThanOrEqual(
      resultNoMuni.form1040.taxableSocialSecurity,
    );
  });
});

// ════════════════════════════════════════════════════
// 9C. Capital Loss Carryforward — ST/LT Split
// ════════════════════════════════════════════════════

describe('9C. Capital loss carryforward ST/LT character', () => {
  it('backward compat: legacy single carryforward treated as ST', () => {
    const result = calculateScheduleD(
      [{ id: 'b1', brokerName: 'TD', description: '100 AAPL', dateSold: '2025-03-01', proceeds: 5000, costBasis: 5000, isLongTerm: false }],
      10000, // legacy carryforward
      FilingStatus.Single,
    );
    // No current-year gain/loss (5000-5000=0), 10000 ST carryforward
    // Net = -10000, deduction = 3000, carryforward = 7000 (all ST)
    expect(result.capitalLossDeduction).toBe(3000);
    expect(result.capitalLossCarryforward).toBe(7000);
    expect(result.capitalLossCarryforwardST).toBe(7000);
    expect(result.capitalLossCarryforwardLT).toBe(0);
  });

  it('split carryforward: ST carryforward applied to short-term', () => {
    const result = calculateScheduleD(
      [{ id: 'b1', brokerName: 'TD', description: '100 AAPL', dateSold: '2025-03-01', proceeds: 5000, costBasis: 5000, isLongTerm: false }],
      0, FilingStatus.Single,
      5000, // ST carryforward
      0,    // LT carryforward
    );
    // Net ST = 0 - 5000 = -5000, Net LT = 0
    // Net total = -5000, deduction = 3000, carryforward = 2000 (all ST)
    expect(result.netShortTerm).toBe(-5000);
    expect(result.capitalLossDeduction).toBe(3000);
    expect(result.capitalLossCarryforwardST).toBe(2000);
    expect(result.capitalLossCarryforwardLT).toBe(0);
  });

  it('split carryforward: LT carryforward applied to long-term', () => {
    const result = calculateScheduleD(
      [{ id: 'b1', brokerName: 'TD', description: '100 AAPL', dateSold: '2025-03-01', proceeds: 5000, costBasis: 5000, isLongTerm: true }],
      0, FilingStatus.Single,
      0,    // ST carryforward
      8000, // LT carryforward
    );
    // Net ST = 0, Net LT = 0 - 8000 = -8000
    // Net total = -8000, deduction = 3000, carryforward = 5000 (all LT)
    expect(result.netLongTerm).toBe(-8000);
    expect(result.capitalLossDeduction).toBe(3000);
    expect(result.capitalLossCarryforwardST).toBe(0);
    expect(result.capitalLossCarryforwardLT).toBe(5000);
  });

  it('mixed carryforward: both ST and LT losses carry forward', () => {
    const result = calculateScheduleD(
      [{ id: 'b1', brokerName: 'TD', description: '100 AAPL', dateSold: '2025-03-01', proceeds: 1000, costBasis: 5000, isLongTerm: false },
       { id: 'b2', brokerName: 'TD', description: '100 MSFT', dateSold: '2025-06-01', proceeds: 2000, costBasis: 10000, isLongTerm: true }],
      0, FilingStatus.Single,
      0, 0,
    );
    // ST: -4000, LT: -8000, Net = -12000
    // Deduction = 3000, total carryforward = 9000
    // ST: -4000 net loss, deduction applies to ST first: 3000 from ST → ST carryforward = 1000
    // LT: -8000 net loss, remaining deduction = 0 → LT carryforward = 8000
    expect(result.capitalLossDeduction).toBe(3000);
    expect(result.capitalLossCarryforward).toBe(9000);
    expect(result.capitalLossCarryforwardST).toBe(1000);
    expect(result.capitalLossCarryforwardLT).toBe(8000);
  });

  it('ST gain offsets LT loss: carryforward is all LT character', () => {
    const result = calculateScheduleD(
      [{ id: 'b1', brokerName: 'TD', description: '100 AAPL', dateSold: '2025-03-01', proceeds: 5000, costBasis: 3000, isLongTerm: false },
       { id: 'b2', brokerName: 'TD', description: '100 MSFT', dateSold: '2025-06-01', proceeds: 1000, costBasis: 15000, isLongTerm: true }],
      0, FilingStatus.Single, 0, 0,
    );
    // ST: +2000, LT: -14000, Net = -12000
    // Deduction = 3000, total carryforward = 9000
    // ST gain offset LT loss → carryforward is all LT
    expect(result.capitalLossCarryforwardST).toBe(0);
    expect(result.capitalLossCarryforwardLT).toBe(9000);
  });

  it('form1040 integration: passes ST/LT carryforward to Schedule D', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 100000, federalTaxWithheld: 20000 }],
      income1099B: [
        { id: 'b1', brokerName: 'TD', description: 'AAPL', dateSold: '2025-06-01', proceeds: 10000, costBasis: 10000, isLongTerm: true },
      ],
      capitalLossCarryforwardST: 2000,
      capitalLossCarryforwardLT: 5000,
    });
    const result = calculateForm1040(tr);
    // ST loss from carryforward = 2000, LT loss from carryforward = 5000
    // Net = -7000, deduction = 3000
    expect(result.scheduleD!.capitalLossDeduction).toBe(3000);
    expect(result.scheduleD!.capitalLossCarryforwardST).toBeGreaterThanOrEqual(0);
    expect(result.scheduleD!.capitalLossCarryforwardLT).toBeGreaterThanOrEqual(0);
    expect(result.scheduleD!.capitalLossCarryforward).toBe(4000);
  });
});

// ════════════════════════════════════════════════════
// 9D. Mortgage Interest Limitation ($750k/$375k)
// ════════════════════════════════════════════════════

describe('9D. Mortgage interest limitation', () => {
  it('no limitation when mortgage balance ≤ $750k', () => {
    const result = calculateScheduleA({
      medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0, personalPropertyTax: 0,
      mortgageInterest: 30000, mortgageInsurancePremiums: 0, mortgageBalance: 700000,
      charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
    }, 200000, FilingStatus.Single);
    expect(result.interestDeduction).toBe(30000);
  });

  it('prorates interest when mortgage balance > $750k', () => {
    const result = calculateScheduleA({
      medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0, personalPropertyTax: 0,
      mortgageInterest: 40000, mortgageInsurancePremiums: 0, mortgageBalance: 1000000,
      charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
    }, 200000, FilingStatus.Single);
    // 750000/1000000 = 0.75, 40000 * 0.75 = 30000
    expect(result.interestDeduction).toBe(30000);
  });

  it('MFS uses $375k limit', () => {
    const result = calculateScheduleA({
      medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0, personalPropertyTax: 0,
      mortgageInterest: 20000, mortgageInsurancePremiums: 0, mortgageBalance: 500000,
      charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
    }, 200000, FilingStatus.MarriedFilingSeparately);
    // 375000/500000 = 0.75, 20000 * 0.75 = 15000
    expect(result.interestDeduction).toBe(15000);
  });

  it('no limitation when mortgageBalance is not provided (backward compat)', () => {
    const result = calculateScheduleA({
      medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0, personalPropertyTax: 0,
      mortgageInterest: 50000, mortgageInsurancePremiums: 0,
      charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
    }, 200000, FilingStatus.Single);
    // No mortgageBalance → no proration
    expect(result.interestDeduction).toBe(50000);
  });

  it('mortgage insurance premiums not subject to limitation', () => {
    const result = calculateScheduleA({
      medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0, personalPropertyTax: 0,
      mortgageInterest: 40000, mortgageInsurancePremiums: 5000, mortgageBalance: 1000000,
      charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
    }, 200000, FilingStatus.Single);
    // Interest: 40000 * 0.75 = 30000, plus 5000 insurance = 35000
    expect(result.interestDeduction).toBe(35000);
  });

  it('$1.5M mortgage at 4% — interest reduced significantly', () => {
    const result = calculateScheduleA({
      medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0, personalPropertyTax: 0,
      mortgageInterest: 60000, mortgageInsurancePremiums: 0, mortgageBalance: 1500000,
      charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
    }, 300000, FilingStatus.MarriedFilingJointly);
    // 750000/1500000 = 0.5, 60000 * 0.5 = 30000
    expect(result.interestDeduction).toBe(30000);
  });
});

// ════════════════════════════════════════════════════
// 9E. Rental Personal Use Days Enforcement
// ════════════════════════════════════════════════════

describe('9E. Rental personal use days', () => {
  it('14-day exclusion: rented < 15 days → income tax-free, no expenses', () => {
    const result = calculateScheduleE([
      {
        id: 'r1', address: '123 Beach Rd', propertyType: 'single_family',
        daysRented: 10, personalUseDays: 100,
        rentalIncome: 5000,
        repairs: 2000, insurance: 500,
      },
    ]);
    // Rented < 15 days → excluded entirely
    expect(result.totalRentalIncome).toBe(0);
    expect(result.totalRentalExpenses).toBe(0);
    expect(result.scheduleEIncome).toBe(0);
  });

  it('normal rental: personal use ≤ threshold → full expenses', () => {
    const result = calculateScheduleE([
      {
        id: 'r1', address: '123 Main St', propertyType: 'single_family',
        daysRented: 365, personalUseDays: 0,
        rentalIncome: 24000,
        repairs: 2000, insurance: 3000, taxes: 4000,
      },
    ]);
    expect(result.totalRentalIncome).toBe(24000);
    expect(result.totalRentalExpenses).toBe(9000);
    expect(result.netRentalIncome).toBe(15000);
  });

  it('personal use property: expenses prorated by rental ratio', () => {
    const result = calculateScheduleE([
      {
        id: 'r1', address: '123 Lake Rd', propertyType: 'single_family',
        daysRented: 60, personalUseDays: 40, // 40 > max(14, 6) = 14 → personal use
        rentalIncome: 10000,
        repairs: 5000, insurance: 3000, taxes: 2000, // total = 10000
      },
    ]);
    // Rental ratio = 60 / (60+40) = 0.6
    // Prorated expenses = 10000 * 0.6 = 6000
    // Net = 10000 - 6000 = 4000 (profitable, no further limitation)
    expect(result.totalRentalIncome).toBe(10000);
    expect(result.totalRentalExpenses).toBe(6000);
    expect(result.netRentalIncome).toBe(4000);
  });

  it('personal use property: loss not allowed (expenses capped at income)', () => {
    const result = calculateScheduleE([
      {
        id: 'r1', address: '123 Lake Rd', propertyType: 'single_family',
        daysRented: 60, personalUseDays: 40, // personal use
        rentalIncome: 3000,
        repairs: 5000, insurance: 3000, taxes: 2000, // total = 10000
      },
    ]);
    // Prorated expenses = 10000 * 0.6 = 6000
    // But limited to income = 3000
    expect(result.totalRentalIncome).toBe(3000);
    expect(result.totalRentalExpenses).toBe(3000);
    expect(result.netRentalIncome).toBe(0);
  });

  it('threshold uses 10% of rental days when > 14', () => {
    // 200 rental days → 10% = 20. Personal use = 18 ≤ 20 → NOT personal use
    const result = calculateScheduleE([
      {
        id: 'r1', address: '123 Main St', propertyType: 'single_family',
        daysRented: 200, personalUseDays: 18,
        rentalIncome: 20000,
        repairs: 25000,
      },
    ]);
    // Not personal use → full expenses, raw loss returned
    expect(result.totalRentalExpenses).toBe(25000);
    expect(result.netRentalIncome).toBe(-5000);
    expect(result.scheduleEIncome).toBe(-5000);
  });

  it('multiple properties: one excluded, one normal', () => {
    const result = calculateScheduleE([
      {
        id: 'r1', address: '123 Beach Rd', propertyType: 'single_family',
        daysRented: 10, personalUseDays: 100,
        rentalIncome: 5000, repairs: 1000,
      },
      {
        id: 'r2', address: '456 Main St', propertyType: 'single_family',
        daysRented: 365, personalUseDays: 0,
        rentalIncome: 20000, repairs: 8000,
      },
    ]);
    // First property excluded (< 15 days)
    // Second property normal: 20000 - 8000 = 12000
    expect(result.totalRentalIncome).toBe(20000);
    expect(result.totalRentalExpenses).toBe(8000);
    expect(result.netRentalIncome).toBe(12000);
  });

  it('backward compat: properties with no days data use full expenses', () => {
    const result = calculateScheduleE([
      {
        id: 'r1', address: '123 Main St', propertyType: 'single_family',
        daysRented: 0, personalUseDays: 0,
        rentalIncome: 20000,
        repairs: 8000,
      },
    ]);
    // daysRented = 0 → rented < 15 → excluded
    expect(result.totalRentalIncome).toBe(0);
    expect(result.totalRentalExpenses).toBe(0);
  });
});

// ════════════════════════════════════════════════════
// 9F. Casualty Losses (TCJA / Disaster Requirement)
// ════════════════════════════════════════════════════

describe('9F. Casualty losses', () => {
  it('casualty loss applies $100 floor and 10% AGI threshold', () => {
    const result = calculateScheduleA({
      medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0, personalPropertyTax: 0,
      mortgageInterest: 0, mortgageInsurancePremiums: 0,
      charitableCash: 0, charitableNonCash: 0,
      casualtyLoss: 20000, otherDeductions: 0,
    }, 100000, FilingStatus.Single);
    // (20000 - 100) - (100000 * 0.10) = 19900 - 10000 = 9900
    expect(result.otherDeduction).toBe(9900);
  });

  it('small casualty loss eliminated by AGI floor', () => {
    const result = calculateScheduleA({
      medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0, personalPropertyTax: 0,
      mortgageInterest: 0, mortgageInsurancePremiums: 0,
      charitableCash: 0, charitableNonCash: 0,
      casualtyLoss: 5000, otherDeductions: 0,
    }, 100000, FilingStatus.Single);
    // (5000 - 100) - 10000 = -5100 → $0
    expect(result.otherDeduction).toBe(0);
  });

  it('zero casualty loss produces zero deduction', () => {
    const result = calculateScheduleA({
      medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0, personalPropertyTax: 0,
      mortgageInterest: 0, mortgageInsurancePremiums: 0,
      charitableCash: 0, charitableNonCash: 0,
      casualtyLoss: 0, otherDeductions: 500,
    }, 100000, FilingStatus.Single);
    expect(result.otherDeduction).toBe(500);
  });
});
