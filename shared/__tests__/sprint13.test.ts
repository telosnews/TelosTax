import { describe, it, expect } from 'vitest';
import { calculateSchedule1A } from '../src/engine/schedule1A.js';
import { calculateHomeSaleExclusion } from '../src/engine/homeSale.js';
import { calculateScheduleA } from '../src/engine/scheduleA.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { FilingStatus, TaxReturn, Schedule1AInfo } from '../src/types/index.js';
import { SCHEDULE_1A, HOME_SALE_EXCLUSION, CHARITABLE_AGI_LIMITS } from '../src/constants/tax2025.js';

// ─── Helper: minimal valid TaxReturn ───────────────────
function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint13',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 8000 }],
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
    incomeW2G: [],
    rentalProperties: [],
    otherIncome: 0,
    deductionMethod: 'standard',
    dependents: [],
    expenses: [],
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════
// Schedule 1-A: No Tax on Tips
// ════════════════════════════════════════════════════════

describe('Schedule 1-A: No Tax on Tips', () => {
  it('deducts qualified tips up to $25k cap', () => {
    const result = calculateSchedule1A(
      { qualifiedTips: 20000 },
      80000, FilingStatus.Single, false,
    );
    expect(result.tipsDeduction).toBe(20000);
  });

  it('caps tips at $25,000', () => {
    const result = calculateSchedule1A(
      { qualifiedTips: 35000 },
      80000, FilingStatus.Single, false,
    );
    expect(result.tipsDeduction).toBe(25000);
  });

  it('applies floor phase-out for tips (Single, MAGI $160k)', () => {
    // Excess = $160k - $150k = $10k. Steps = floor(10000/1000) = 10. Reduction = 10 * $100 = $1,000
    const result = calculateSchedule1A(
      { qualifiedTips: 25000 },
      160000, FilingStatus.Single, false,
    );
    expect(result.tipsPhaseOutReduction).toBe(1000);
    expect(result.tipsDeduction).toBe(24000);
  });

  it('applies floor phase-out for tips (MFJ, MAGI $350k)', () => {
    // Excess = $350k - $300k = $50k. Steps = floor(50000/1000) = 50. Reduction = 50 * $100 = $5,000
    const result = calculateSchedule1A(
      { qualifiedTips: 25000 },
      350000, FilingStatus.MarriedFilingJointly, false,
    );
    expect(result.tipsPhaseOutReduction).toBe(5000);
    expect(result.tipsDeduction).toBe(20000);
  });

  it('floor function: partial $1000 does NOT trigger extra step', () => {
    // MAGI = $151,500. Excess = $1,500. Steps = floor(1500/1000) = 1. Reduction = $100
    const result = calculateSchedule1A(
      { qualifiedTips: 10000 },
      151500, FilingStatus.Single, false,
    );
    expect(result.tipsPhaseOutReduction).toBe(100);
    expect(result.tipsDeduction).toBe(9900);
  });

  it('MFS filers are ineligible for tips deduction', () => {
    const result = calculateSchedule1A(
      { qualifiedTips: 20000 },
      80000, FilingStatus.MarriedFilingSeparately, false,
    );
    expect(result.tipsDeduction).toBe(0);
  });
});

// ════════════════════════════════════════════════════════
// Schedule 1-A: No Tax on Overtime
// ════════════════════════════════════════════════════════

describe('Schedule 1-A: No Tax on Overtime', () => {
  it('deducts overtime with FLSA non-exempt flag', () => {
    const result = calculateSchedule1A(
      { qualifiedOvertimePay: 8000, isFLSANonExempt: true },
      80000, FilingStatus.Single, false,
    );
    expect(result.overtimeDeduction).toBe(8000);
  });

  it('caps overtime at $12,500 for Single', () => {
    const result = calculateSchedule1A(
      { qualifiedOvertimePay: 20000, isFLSANonExempt: true },
      80000, FilingStatus.Single, false,
    );
    expect(result.overtimeDeduction).toBe(12500);
  });

  it('caps overtime at $25,000 for MFJ', () => {
    const result = calculateSchedule1A(
      { qualifiedOvertimePay: 30000, isFLSANonExempt: true },
      80000, FilingStatus.MarriedFilingJointly, false,
    );
    expect(result.overtimeDeduction).toBe(25000);
  });

  it('requires isFLSANonExempt flag', () => {
    const result = calculateSchedule1A(
      { qualifiedOvertimePay: 8000, isFLSANonExempt: false },
      80000, FilingStatus.Single, false,
    );
    expect(result.overtimeDeduction).toBe(0);
  });

  it('applies floor phase-out for overtime', () => {
    // MAGI $200k, Single. Excess = $200k - $150k = $50k. Steps = 50. Reduction = $5,000
    const result = calculateSchedule1A(
      { qualifiedOvertimePay: 12500, isFLSANonExempt: true },
      200000, FilingStatus.Single, false,
    );
    expect(result.overtimePhaseOutReduction).toBe(5000);
    expect(result.overtimeDeduction).toBe(7500);
  });

  it('MFS filers ineligible for overtime', () => {
    const result = calculateSchedule1A(
      { qualifiedOvertimePay: 8000, isFLSANonExempt: true },
      80000, FilingStatus.MarriedFilingSeparately, false,
    );
    expect(result.overtimeDeduction).toBe(0);
  });
});

// ════════════════════════════════════════════════════════
// Schedule 1-A: No Tax on Car Loan Interest
// ════════════════════════════════════════════════════════

describe('Schedule 1-A: No Tax on Car Loan Interest', () => {
  it('deducts car loan interest for US-assembled new vehicle', () => {
    const result = calculateSchedule1A(
      { carLoanInterestPaid: 3000, vehicleAssembledInUS: true, isNewVehicle: true },
      80000, FilingStatus.Single, false,
    );
    expect(result.carLoanInterestDeduction).toBe(3000);
  });

  it('caps car loan interest at $10,000', () => {
    const result = calculateSchedule1A(
      { carLoanInterestPaid: 15000, vehicleAssembledInUS: true, isNewVehicle: true },
      80000, FilingStatus.Single, false,
    );
    expect(result.carLoanInterestDeduction).toBe(10000);
  });

  it('requires vehicle assembled in US', () => {
    const result = calculateSchedule1A(
      { carLoanInterestPaid: 5000, vehicleAssembledInUS: false, isNewVehicle: true },
      80000, FilingStatus.Single, false,
    );
    expect(result.carLoanInterestDeduction).toBe(0);
  });

  it('requires new vehicle (no used vehicles)', () => {
    const result = calculateSchedule1A(
      { carLoanInterestPaid: 5000, vehicleAssembledInUS: true, isNewVehicle: false },
      80000, FilingStatus.Single, false,
    );
    expect(result.carLoanInterestDeduction).toBe(0);
  });

  it('applies ceiling phase-out (Single, MAGI $124,200)', () => {
    // Excess = $124,200 - $100,000 = $24,200. Steps = ceil(24200/1000) = 25. Reduction = 25 * $200 = $5,000
    const result = calculateSchedule1A(
      { carLoanInterestPaid: 10000, vehicleAssembledInUS: true, isNewVehicle: true },
      124200, FilingStatus.Single, false,
    );
    expect(result.carLoanPhaseOutReduction).toBe(5000);
    expect(result.carLoanInterestDeduction).toBe(5000);
  });

  it('ceiling function: partial $1000 DOES trigger extra step', () => {
    // MAGI = $101,001. Excess = $1,001. Steps = ceil(1001/1000) = 2. Reduction = 2 * $200 = $400
    const result = calculateSchedule1A(
      { carLoanInterestPaid: 10000, vehicleAssembledInUS: true, isNewVehicle: true },
      101001, FilingStatus.Single, false,
    );
    expect(result.carLoanPhaseOutReduction).toBe(400);
    expect(result.carLoanInterestDeduction).toBe(9600);
  });

  it('MFS filers CAN claim car loan interest', () => {
    const result = calculateSchedule1A(
      { carLoanInterestPaid: 5000, vehicleAssembledInUS: true, isNewVehicle: true },
      80000, FilingStatus.MarriedFilingSeparately, false,
    );
    expect(result.carLoanInterestDeduction).toBe(5000);
  });

  it('MFJ phase-out uses $200k threshold', () => {
    // MAGI = $220k. Excess = $220k - $200k = $20k. Steps = ceil(20000/1000) = 20. Reduction = 20 * $200 = $4,000
    const result = calculateSchedule1A(
      { carLoanInterestPaid: 10000, vehicleAssembledInUS: true, isNewVehicle: true },
      220000, FilingStatus.MarriedFilingJointly, false,
    );
    expect(result.carLoanPhaseOutReduction).toBe(4000);
    expect(result.carLoanInterestDeduction).toBe(6000);
  });
});

// ════════════════════════════════════════════════════════
// Schedule 1-A: Enhanced Senior Deduction
// ════════════════════════════════════════════════════════

describe('Schedule 1-A: Enhanced Senior Deduction', () => {
  it('gives $6,000 for taxpayer age 65+', () => {
    const result = calculateSchedule1A(
      {}, 50000, FilingStatus.Single, true,
    );
    expect(result.seniorDeduction).toBe(6000);
  });

  it('gives $12,000 for MFJ when both 65+', () => {
    const result = calculateSchedule1A(
      {}, 100000, FilingStatus.MarriedFilingJointly, true, true,
    );
    expect(result.seniorDeduction).toBe(12000);
  });

  it('gives $6,000 for MFJ when only taxpayer 65+', () => {
    const result = calculateSchedule1A(
      {}, 100000, FilingStatus.MarriedFilingJointly, true, false,
    );
    expect(result.seniorDeduction).toBe(6000);
  });

  it('gives $0 if not age 65+', () => {
    const result = calculateSchedule1A(
      {}, 50000, FilingStatus.Single, false,
    );
    expect(result.seniorDeduction).toBe(0);
  });

  it('applies 6% phase-out (Single, MAGI $100k)', () => {
    // Excess = $100k - $75k = $25k. Reduction = $25k * 0.06 = $1,500
    const result = calculateSchedule1A(
      {}, 100000, FilingStatus.Single, true,
    );
    expect(result.seniorPhaseOutReduction).toBe(1500);
    expect(result.seniorDeduction).toBe(4500);
  });

  it('fully phases out (Single, MAGI $175k)', () => {
    // Excess = $175k - $75k = $100k. Reduction = $100k * 0.06 = $6,000. $6,000 - $6,000 = $0
    const result = calculateSchedule1A(
      {}, 175000, FilingStatus.Single, true,
    );
    expect(result.seniorDeduction).toBe(0);
  });

  it('MFJ phase-out uses $150k threshold', () => {
    // MFJ, both 65+. MAGI = $200k. Excess = $200k - $150k = $50k. Reduction = $50k * 0.06 = $3,000
    const result = calculateSchedule1A(
      {}, 200000, FilingStatus.MarriedFilingJointly, true, true,
    );
    expect(result.seniorPhaseOutReduction).toBe(3000);
    expect(result.seniorDeduction).toBe(9000); // $12k - $3k
  });

  it('MFS filers ineligible for senior deduction', () => {
    const result = calculateSchedule1A(
      {}, 50000, FilingStatus.MarriedFilingSeparately, true,
    );
    expect(result.seniorDeduction).toBe(0);
  });
});

// ════════════════════════════════════════════════════════
// Schedule 1-A: Total Deduction
// ════════════════════════════════════════════════════════

describe('Schedule 1-A: Total Deduction', () => {
  it('sums all four deductions', () => {
    const result = calculateSchedule1A(
      {
        qualifiedTips: 15000,
        qualifiedOvertimePay: 8000, isFLSANonExempt: true,
        carLoanInterestPaid: 4000, vehicleAssembledInUS: true, isNewVehicle: true,
      },
      50000, FilingStatus.Single, true, // age 65+
    );
    expect(result.tipsDeduction).toBe(15000);
    expect(result.overtimeDeduction).toBe(8000);
    expect(result.carLoanInterestDeduction).toBe(4000);
    expect(result.seniorDeduction).toBe(6000);
    expect(result.totalDeduction).toBe(33000);
  });

  it('returns zero for empty info', () => {
    const result = calculateSchedule1A(
      {}, 50000, FilingStatus.Single, false,
    );
    expect(result.totalDeduction).toBe(0);
  });
});

// ════════════════════════════════════════════════════════
// Sale of Home Exclusion (Section 121)
// ════════════════════════════════════════════════════════

describe('Sale of Home Exclusion (Section 121)', () => {
  it('excludes up to $250k for Single', () => {
    const result = calculateHomeSaleExclusion(
      { salePrice: 500000, costBasis: 200000, ownedMonths: 36, usedAsResidenceMonths: 36 },
      FilingStatus.Single,
    );
    expect(result.gainOrLoss).toBe(300000);
    expect(result.exclusionAmount).toBe(250000);
    expect(result.taxableGain).toBe(50000);
    expect(result.qualifiesForExclusion).toBe(true);
    expect(result.maxExclusion).toBe(250000);
  });

  it('excludes up to $500k for MFJ', () => {
    const result = calculateHomeSaleExclusion(
      { salePrice: 800000, costBasis: 200000, ownedMonths: 60, usedAsResidenceMonths: 60 },
      FilingStatus.MarriedFilingJointly,
    );
    expect(result.gainOrLoss).toBe(600000);
    expect(result.exclusionAmount).toBe(500000);
    expect(result.taxableGain).toBe(100000);
  });

  it('excludes entire gain when under limit', () => {
    const result = calculateHomeSaleExclusion(
      { salePrice: 350000, costBasis: 200000, ownedMonths: 36, usedAsResidenceMonths: 36 },
      FilingStatus.Single,
    );
    expect(result.gainOrLoss).toBe(150000);
    expect(result.exclusionAmount).toBe(150000);
    expect(result.taxableGain).toBe(0);
  });

  it('deducts selling expenses from proceeds', () => {
    const result = calculateHomeSaleExclusion(
      { salePrice: 500000, costBasis: 200000, sellingExpenses: 30000, ownedMonths: 36, usedAsResidenceMonths: 36 },
      FilingStatus.Single,
    );
    // Net proceeds = $500k - $30k = $470k. Gain = $470k - $200k = $270k
    expect(result.gainOrLoss).toBe(270000);
    expect(result.exclusionAmount).toBe(250000);
    expect(result.taxableGain).toBe(20000);
  });

  it('fails ownership test (< 24 months)', () => {
    const result = calculateHomeSaleExclusion(
      { salePrice: 500000, costBasis: 200000, ownedMonths: 20, usedAsResidenceMonths: 36 },
      FilingStatus.Single,
    );
    expect(result.qualifiesForExclusion).toBe(false);
    expect(result.exclusionAmount).toBe(0);
    expect(result.taxableGain).toBe(300000);
  });

  it('fails residence test (< 24 months)', () => {
    const result = calculateHomeSaleExclusion(
      { salePrice: 500000, costBasis: 200000, ownedMonths: 36, usedAsResidenceMonths: 12 },
      FilingStatus.Single,
    );
    expect(result.qualifiesForExclusion).toBe(false);
    expect(result.exclusionAmount).toBe(0);
    expect(result.taxableGain).toBe(300000);
  });

  it('fails when prior exclusion used within 2 years', () => {
    const result = calculateHomeSaleExclusion(
      { salePrice: 500000, costBasis: 200000, ownedMonths: 36, usedAsResidenceMonths: 36, priorExclusionUsedWithin2Years: true },
      FilingStatus.Single,
    );
    expect(result.qualifiesForExclusion).toBe(false);
    expect(result.exclusionAmount).toBe(0);
  });

  it('loss on personal residence is not deductible', () => {
    const result = calculateHomeSaleExclusion(
      { salePrice: 180000, costBasis: 200000, ownedMonths: 36, usedAsResidenceMonths: 36 },
      FilingStatus.Single,
    );
    expect(result.gainOrLoss).toBe(-20000);
    expect(result.taxableGain).toBe(0);
    expect(result.exclusionAmount).toBe(0);
  });
});

// ════════════════════════════════════════════════════════
// Charitable AGI Limits (Schedule A Accuracy Fix)
// ════════════════════════════════════════════════════════

describe('Charitable AGI Limits', () => {
  it('cash donations limited to 60% of AGI', () => {
    const result = calculateScheduleA(
      {
        medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
        personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
        charitableCash: 80000, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
      },
      100000, FilingStatus.Single,
    );
    // 60% of $100k AGI = $60k limit
    expect(result.charitableDeduction).toBe(60000);
  });

  it('non-cash donations limited to 30% of AGI', () => {
    const result = calculateScheduleA(
      {
        medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
        personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
        charitableCash: 0, charitableNonCash: 50000, casualtyLoss: 0, otherDeductions: 0,
      },
      100000, FilingStatus.Single,
    );
    // 30% of $100k AGI = $30k limit
    expect(result.charitableDeduction).toBe(30000);
  });

  it('combined cash + non-cash capped at 60% of AGI', () => {
    const result = calculateScheduleA(
      {
        medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
        personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
        charitableCash: 50000, charitableNonCash: 25000, casualtyLoss: 0, otherDeductions: 0,
      },
      100000, FilingStatus.Single,
    );
    // Cash: min($50k, $60k) = $50k. Non-cash: min($25k, $30k) = $25k.
    // Total: min($50k + $25k, $60k) = $60k
    expect(result.charitableDeduction).toBe(60000);
  });

  it('small donations under AGI limits pass through', () => {
    const result = calculateScheduleA(
      {
        medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
        personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
        charitableCash: 5000, charitableNonCash: 2000, casualtyLoss: 0, otherDeductions: 0,
      },
      100000, FilingStatus.Single,
    );
    expect(result.charitableDeduction).toBe(7000);
  });
});

// ════════════════════════════════════════════════════════
// Form 1040 Integration
// ════════════════════════════════════════════════════════

describe('Form 1040 Integration: Schedule 1-A', () => {
  it('Schedule 1-A reduces taxable income', () => {
    const tr = baseTaxReturn({
      schedule1A: {
        qualifiedTips: 15000,
      },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.schedule1ADeduction).toBe(15000);
    // Taxable income should be reduced by the tips deduction
    expect(result.schedule1A).toBeDefined();
    expect(result.schedule1A!.tipsDeduction).toBe(15000);
  });

  it('senior deduction auto-calculated for 65+ filers', () => {
    const tr = baseTaxReturn({
      dateOfBirth: '1955-01-01', // Age 70 in 2025
    });
    const result = calculateForm1040(tr);
    // Senior deduction should be auto-calculated even without explicit schedule1A
    expect(result.form1040.schedule1ADeduction).toBe(6000);
    expect(result.schedule1A).toBeDefined();
    expect(result.schedule1A!.seniorDeduction).toBe(6000);
  });

  it('senior deduction for MFJ both 65+', () => {
    const tr = baseTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      dateOfBirth: '1955-01-01',
      spouseDateOfBirth: '1955-06-15',
    });
    const result = calculateForm1040(tr);
    expect(result.schedule1A!.seniorDeduction).toBe(12000);
  });

  it('Schedule 1-A does not affect AGI', () => {
    const trNoSchedule1A = baseTaxReturn();
    const trWithSchedule1A = baseTaxReturn({
      schedule1A: { qualifiedTips: 10000 },
    });
    const resultNo = calculateForm1040(trNoSchedule1A);
    const resultWith = calculateForm1040(trWithSchedule1A);
    // AGI should be the same regardless of Schedule 1-A
    expect(resultNo.form1040.agi).toBe(resultWith.form1040.agi);
    // But taxable income should differ
    expect(resultWith.form1040.taxableIncome).toBeLessThan(resultNo.form1040.taxableIncome);
  });
});

describe('Form 1040 Integration: Sale of Home', () => {
  it('home sale taxable gain flows as long-term capital gain', () => {
    const tr = baseTaxReturn({
      homeSale: {
        salePrice: 600000,
        costBasis: 200000,
        ownedMonths: 60,
        usedAsResidenceMonths: 60,
      },
    });
    const result = calculateForm1040(tr);
    // Gain = $400k, exclusion = $250k (Single), taxable gain = $150k
    expect(result.homeSale).toBeDefined();
    expect(result.homeSale!.taxableGain).toBe(150000);
    expect(result.form1040.homeSaleExclusion).toBe(250000);
    // Taxable gain should be in total income
    expect(result.form1040.scheduleDNetGain).toBeGreaterThanOrEqual(150000);
  });

  it('no home sale = no impact', () => {
    const tr = baseTaxReturn();
    const result = calculateForm1040(tr);
    expect(result.homeSale).toBeUndefined();
    expect(result.form1040.homeSaleExclusion).toBe(0);
  });

  it('MFJ gets $500k exclusion', () => {
    const tr = baseTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      homeSale: {
        salePrice: 800000,
        costBasis: 200000,
        ownedMonths: 60,
        usedAsResidenceMonths: 60,
      },
    });
    const result = calculateForm1040(tr);
    // Gain = $600k, exclusion = $500k (MFJ), taxable gain = $100k
    expect(result.homeSale!.exclusionAmount).toBe(500000);
    expect(result.homeSale!.taxableGain).toBe(100000);
  });

  it('gain under exclusion limit = zero taxable gain', () => {
    const tr = baseTaxReturn({
      homeSale: {
        salePrice: 350000,
        costBasis: 200000,
        ownedMonths: 36,
        usedAsResidenceMonths: 36,
      },
    });
    const result = calculateForm1040(tr);
    expect(result.homeSale!.taxableGain).toBe(0);
    expect(result.homeSale!.exclusionAmount).toBe(150000);
  });
});

// ════════════════════════════════════════════════════════
// Constants Validation
// ════════════════════════════════════════════════════════

describe('Sprint 13 Constants', () => {
  it('Schedule 1-A tips cap is $25,000', () => {
    expect(SCHEDULE_1A.TIPS_CAP).toBe(25000);
  });

  it('Schedule 1-A overtime cap is $12,500 / $25,000', () => {
    expect(SCHEDULE_1A.OVERTIME_CAP_SINGLE).toBe(12500);
    expect(SCHEDULE_1A.OVERTIME_CAP_MFJ).toBe(25000);
  });

  it('Schedule 1-A car loan cap is $10,000', () => {
    expect(SCHEDULE_1A.CAR_LOAN_CAP).toBe(10000);
  });

  it('Schedule 1-A senior amount is $6,000', () => {
    expect(SCHEDULE_1A.SENIOR_AMOUNT).toBe(6000);
  });

  it('Home sale exclusion limits', () => {
    expect(HOME_SALE_EXCLUSION.SINGLE_MAX).toBe(250000);
    expect(HOME_SALE_EXCLUSION.MFJ_MAX).toBe(500000);
    expect(HOME_SALE_EXCLUSION.OWNERSHIP_MONTHS_REQUIRED).toBe(24);
    expect(HOME_SALE_EXCLUSION.RESIDENCE_MONTHS_REQUIRED).toBe(24);
  });

  it('Charitable AGI limits', () => {
    expect(CHARITABLE_AGI_LIMITS.CASH_PUBLIC_RATE).toBe(0.60);
    expect(CHARITABLE_AGI_LIMITS.NON_CASH_RATE).toBe(0.30);
  });
});
