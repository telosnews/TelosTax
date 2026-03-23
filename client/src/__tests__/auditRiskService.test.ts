/**
 * Audit Risk Service Unit Tests
 *
 * Tests the pure scoring function that evaluates tax returns for
 * IRS audit risk factors.
 */

import { describe, it, expect } from 'vitest';
import type { TaxReturn, CalculationResult, Form1040Result, CreditsResult, ScheduleCResult, ScheduleEResult, ScheduleFResult } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';
import { assessAuditRisk, RiskLevel } from '../services/auditRiskService';

// ─── Helpers ─────────────────────────────────────

function makeForm1040(overrides: Partial<Form1040Result> = {}): Form1040Result {
  return {
    totalWages: 75000,
    totalInterest: 0,
    taxExemptInterest: 0,
    totalDividends: 0,
    qualifiedDividends: 0,
    totalCapitalGainDistributions: 0,
    scheduleDNetGain: 0,
    capitalLossDeduction: 0,
    capitalGainOrLoss: 0,
    taxableSocialSecurity: 0,
    socialSecurityBenefits: 0,
    scheduleEIncome: 0,
    royaltyIncome: 0,
    totalRetirementIncome: 0,
    iraDistributionsGross: 0,
    iraDistributionsTaxable: 0,
    pensionDistributionsGross: 0,
    pensionDistributionsTaxable: 0,
    totalUnemployment: 0,
    total1099MISCIncome: 0,
    scheduleCNetProfit: 0,
    rothConversionTaxable: 0,
    totalIncome: 75000,
    seDeduction: 0,
    selfEmployedHealthInsurance: 0,
    retirementContributions: 0,
    hsaDeduction: 0,
    hsaDeductionComputed: 0,
    studentLoanInterest: 0,
    iraDeduction: 0,
    educatorExpenses: 0,
    earlyWithdrawalPenalty: 0,
    feieExclusion: 0,
    nolDeduction: 0,
    totalAdjustments: 0,
    agi: 75000,
    standardDeduction: 15150,
    itemizedDeduction: 0,
    deductionUsed: 'standard',
    deductionAmount: 15150,
    qbiDeduction: 0,
    schedule1ADeduction: 0,
    homeSaleExclusion: 0,
    taxableIncome: 59850,
    k1OrdinaryIncome: 0,
    k1SEIncome: 0,
    hsaDistributionTaxable: 0,
    hsaDistributionPenalty: 0,
    incomeTax: 8700,
    preferentialTax: 0,
    section1250Tax: 0,
    amtAmount: 0,
    seTax: 0,
    niitTax: 0,
    additionalMedicareTaxW2: 0,
    earlyDistributionPenalty: 0,
    kiddieTaxAmount: 0,
    householdEmploymentTax: 0,
    estimatedTaxPenalty: 0,
    totalTax: 8700,
    totalCredits: 0,
    taxAfterCredits: 8700,
    totalWithholding: 12000,
    estimatedPayments: 0,
    totalPayments: 12000,
    refundAmount: 3300,
    amountOwed: 0,
    effectiveTaxRate: 0.116,
    marginalTaxRate: 0.22,
    estimatedQuarterlyPayment: 0,
    ...overrides,
  } as Form1040Result;
}

function makeCredits(overrides: Partial<CreditsResult> = {}): CreditsResult {
  return {
    childTaxCredit: 0,
    otherDependentCredit: 0,
    actcCredit: 0,
    educationCredit: 0,
    aotcRefundableCredit: 0,
    dependentCareCredit: 0,
    saversCredit: 0,
    cleanEnergyCredit: 0,
    evCredit: 0,
    energyEfficiencyCredit: 0,
    foreignTaxCredit: 0,
    adoptionCredit: 0,
    evRefuelingCredit: 0,
    elderlyDisabledCredit: 0,
    k1OtherCredits: 0,
    premiumTaxCredit: 0,
    excessSSTaxCredit: 0,
    eitcCredit: 0,
    totalNonRefundable: 0,
    totalRefundable: 0,
    ...overrides,
  } as CreditsResult;
}

function makeCalculation(overrides: {
  form1040?: Partial<Form1040Result>;
  credits?: Partial<CreditsResult>;
  scheduleC?: Partial<ScheduleCResult>;
  scheduleE?: Partial<ScheduleEResult>;
  scheduleF?: Partial<ScheduleFResult>;
} = {}): CalculationResult {
  return {
    form1040: makeForm1040(overrides.form1040),
    credits: makeCredits(overrides.credits),
    scheduleC: overrides.scheduleC as ScheduleCResult | undefined,
    scheduleE: overrides.scheduleE as ScheduleEResult | undefined,
    scheduleF: overrides.scheduleF as ScheduleFResult | undefined,
  } as CalculationResult;
}

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return',
    schemaVersion: 1,
    taxYear: 2025,
    status: 'completed',
    currentStep: 0,
    currentSection: 'finish',
    filingStatus: FilingStatus.Single,
    dependents: [],
    w2Income: [{
      id: 'w2-1',
      employerName: 'Acme Corp',
      wages: 75000,
      federalTaxWithheld: 12000,
    }],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    rentalProperties: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    businesses: [],
    otherIncome: 0,
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-31T00:00:00Z',
    ...overrides,
  } as TaxReturn;
}

// ─── Tests ───────────────────────────────────────

describe('assessAuditRisk', () => {
  it('returns low risk for a minimal W-2 return', () => {
    const tr = makeTaxReturn();
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    expect(result.level).toBe('low');
    expect(result.score).toBe(0);
    expect(result.triggeredFactors).toHaveLength(0);
    expect(result.summary).toContain('minimal');
  });

  it('triggers high_income for AGI > $500K', () => {
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w2-1', employerName: 'BigCo', wages: 600000, federalTaxWithheld: 150000 }],
    });
    const calc = makeCalculation({ form1040: { agi: 600000 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'high_income');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(10);
  });

  it('does not trigger income factor for AGI $200K–$500K', () => {
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w2-1', employerName: 'MidCo', wages: 250000, federalTaxWithheld: 50000 }],
    });
    const calc = makeCalculation({ form1040: { agi: 250000 } });

    const result = assessAuditRisk(tr, calc);

    const high = result.triggeredFactors.find(f => f.id === 'high_income');
    const veryHigh = result.triggeredFactors.find(f => f.id === 'very_high_income');
    expect(high).toBeUndefined();
    expect(veryHigh).toBeUndefined();
  });

  it('triggers very_high_income for AGI > $1M, replacing high_income', () => {
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w2-1', employerName: 'MegaCo', wages: 1200000, federalTaxWithheld: 350000 }],
    });
    const calc = makeCalculation({ form1040: { agi: 1200000 } });

    const result = assessAuditRisk(tr, calc);

    const veryHigh = result.triggeredFactors.find(f => f.id === 'very_high_income');
    const high = result.triggeredFactors.find(f => f.id === 'high_income');
    expect(veryHigh).toBeDefined();
    expect(veryHigh!.points).toBe(15);
    expect(high).toBeUndefined(); // Should NOT also trigger high_income
  });

  it('triggers schedule_c_filer for 1099-NEC income', () => {
    const tr = makeTaxReturn({
      w2Income: [],
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 50000 }],
    });
    const calc = makeCalculation({ form1040: { agi: 50000 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'schedule_c_filer');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(10);
  });

  it('triggers cash_business_no_expenses when gross > $10K and expenses = 0', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 20000 }],
    });
    const calc = makeCalculation({
      form1040: { agi: 20000 },
      scheduleC: {
        grossReceipts: 20000,
        totalExpenses: 0,
        netProfit: 20000,
      } as Partial<ScheduleCResult>,
    });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'cash_business_no_expenses');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(8);
  });

  it('triggers home_office_claimed when method is set', () => {
    const tr = makeTaxReturn({
      homeOffice: {
        method: 'simplified',
        squareFeet: 200,
      } as TaxReturn['homeOffice'],
    });
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'home_office_claimed');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(5);
  });

  it('triggers large_charitable when donations > 30% of AGI', () => {
    const tr = makeTaxReturn({
      itemizedDeductions: {
        charitableCash: 40000,
        charitableNonCash: 0,
      } as TaxReturn['itemizedDeductions'],
    });
    const calc = makeCalculation({ form1040: { agi: 100000 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'large_charitable');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(8);
  });

  it('triggers eitc_claimed when EITC credit > 0', () => {
    const tr = makeTaxReturn();
    const calc = makeCalculation({ credits: { eitcCredit: 3000 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'eitc_claimed');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(6);
  });

  it('triggers rental_losses when net rental income is negative', () => {
    const tr = makeTaxReturn({
      rentalProperties: [{ id: 'r-1' }] as TaxReturn['rentalProperties'],
    });
    const calc = makeCalculation({
      scheduleE: {
        netRentalIncome: -5000,
        totalRentalIncome: 12000,
        totalRentalExpenses: 17000,
        allowableLoss: 5000,
        suspendedLoss: 0,
        royaltyIncome: 0,
        scheduleEIncome: -5000,
      },
    });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'rental_losses');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(6);
  });

  it('triggers high_vehicle_business_use when business miles > 75%', () => {
    const tr = makeTaxReturn({
      vehicle: {
        method: 'standard_mileage',
        businessMiles: 18000,
        totalMiles: 20000,
      } as TaxReturn['vehicle'],
    });
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'high_vehicle_business_use');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(5);
  });

  it('stacks multiple factors correctly for moderate risk', () => {
    // Schedule C (10) + home office (5) = 15 → moderate (threshold 10)
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 50000 }],
      homeOffice: { method: 'simplified', squareFeet: 200 } as TaxReturn['homeOffice'],
    });
    const calc = makeCalculation({ form1040: { agi: 50000 } });

    const result = assessAuditRisk(tr, calc);

    expect(result.score).toBe(15);
    expect(result.level).toBe('moderate');
  });

  it('classifies score 24+ as elevated', () => {
    // Schedule C (10) + high_income (10) + home office (5) = 25 → elevated (threshold 24)
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 600000 }],
      homeOffice: { method: 'simplified', squareFeet: 200 } as TaxReturn['homeOffice'],
    });
    const calc = makeCalculation({ form1040: { agi: 600000 } });

    const result = assessAuditRisk(tr, calc);

    // schedule_c (10) + high_income (10) + home_office (5) = 25 minimum
    expect(result.score).toBeGreaterThanOrEqual(25);
    expect(result.level).toBe('elevated');
  });

  it('classifies score 38+ as high', () => {
    // very_high_income (15) + Schedule C (10) + cash biz (8) + home office (5) + EITC (6) = 44
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 1200000 }],
      homeOffice: { method: 'simplified', squareFeet: 200 } as TaxReturn['homeOffice'],
    });
    const calc = makeCalculation({
      form1040: { agi: 1200000 },
      credits: { eitcCredit: 3000 },
      scheduleC: {
        grossReceipts: 1200000,
        totalExpenses: 0,
        netProfit: 1200000,
      } as Partial<ScheduleCResult>,
    });

    const result = assessAuditRisk(tr, calc);

    expect(result.score).toBeGreaterThanOrEqual(38);
    expect(result.level).toBe('high');
  });

  it('caps plausibility warning points at 12', () => {
    // Create a return with 5 plausibility-triggering items
    const tr = makeTaxReturn({
      w2Income: [
        { id: 'w2-1', employerName: 'A', wages: 1_500_000, federalTaxWithheld: 300000 },
      ],
      income1099NEC: [
        { id: 'nec-1', payerName: 'B', amount: 600_000 },
      ],
      income1099INT: [
        { id: 'int-1', payerName: 'C', amount: 150_000 },
      ],
      income1099DIV: [
        { id: 'div-1', payerName: 'D', ordinaryDividends: 250_000, qualifiedDividends: 0 },
      ],
      income1099R: [
        { id: 'r-1', payerName: 'E', grossDistribution: 600_000, taxableAmount: 600_000 },
      ],
    } as Partial<TaxReturn>);
    const calc = makeCalculation({
      form1040: { agi: 3_100_000, totalIncome: 3_100_000 },
    });

    const result = assessAuditRisk(tr, calc);

    const plausFactor = result.triggeredFactors.find(f => f.id === 'plausibility_warnings');
    expect(plausFactor).toBeDefined();
    expect(plausFactor!.points).toBe(12); // Capped, not 15
  });

  it('triggers round_numbers when >50% of expenses are round', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 50000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'Office', amount: 1000 },
        { id: 'e2', scheduleCLine: 25, category: 'Utilities', amount: 2000 },
        { id: 'e3', scheduleCLine: 27, category: 'Other', amount: 500 },
        { id: 'e4', scheduleCLine: 17, category: 'Legal', amount: 3000 },
      ],
    });
    const calc = makeCalculation({ form1040: { agi: 50000 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'round_numbers');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(3);
  });

  it('does not trigger round_numbers with fewer than 4 expenses', () => {
    const tr = makeTaxReturn({
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'Office', amount: 1000 },
        { id: 'e2', scheduleCLine: 25, category: 'Utilities', amount: 2000 },
      ],
    });
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'round_numbers');
    expect(factor).toBeUndefined();
  });

  it('includes all required fields on each risk factor', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 50000 }],
    });
    const calc = makeCalculation({ form1040: { agi: 50000 } });

    const result = assessAuditRisk(tr, calc);

    for (const factor of result.triggeredFactors) {
      expect(factor.id).toBeTruthy();
      expect(factor.category).toBeTruthy();
      expect(factor.points).toBeGreaterThan(0);
      expect(factor.label).toBeTruthy();
      expect(factor.explanation).toBeTruthy();
      expect(factor.mitigation).toBeTruthy();
      expect(factor.triggered).toBe(true);
    }
  });

  // ─── New Factor Tests (Tier 1 + Tier 2) ────────────

  it('does not trigger aotc_claimed for Lifetime Learning Credit only', () => {
    // educationCredit includes both AOTC and LLC; trigger should only fire on aotcRefundableCredit
    const tr = makeTaxReturn();
    const calc = makeCalculation({ credits: { educationCredit: 2000, aotcRefundableCredit: 0 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'aotc_claimed');
    expect(factor).toBeUndefined();
  });

  it('triggers aotc_claimed when refundable AOTC > 0', () => {
    const tr = makeTaxReturn();
    const calc = makeCalculation({ credits: { aotcRefundableCredit: 1000 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'aotc_claimed');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(5);
  });

  it('does not trigger aotc_claimed when no education credits', () => {
    const tr = makeTaxReturn();
    const calc = makeCalculation({ credits: { educationCredit: 0, aotcRefundableCredit: 0 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'aotc_claimed');
    expect(factor).toBeUndefined();
  });

  it('triggers feie_claimed when feieExclusion > 0', () => {
    const tr = makeTaxReturn();
    const calc = makeCalculation({ form1040: { feieExclusion: 120000 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'feie_claimed');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(8);
    expect(factor!.category).toBe('structural');
  });

  it('triggers feie_claimed when foreignEarnedIncome is present on return', () => {
    const tr = makeTaxReturn({ foreignEarnedIncome: { foreignEarnedIncome: 100000 } });
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'feie_claimed');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(8);
  });

  it('does not trigger feie_claimed when foreignEarnedIncome object exists but income is zero', () => {
    const tr = makeTaxReturn({ foreignEarnedIncome: { foreignEarnedIncome: 0 } });
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'feie_claimed');
    expect(factor).toBeUndefined();
  });

  it('triggers farm_losses when Schedule F net profit is negative', () => {
    const tr = makeTaxReturn();
    const calc = makeCalculation({
      scheduleF: {
        netFarmProfit: -15000,
        grossIncome: 5000,
        totalExpenses: 20000,
      } as Partial<ScheduleFResult>,
    });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'farm_losses');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(7);
    expect(factor!.category).toBe('deduction');
  });

  it('does not trigger farm_losses when farm is profitable', () => {
    const tr = makeTaxReturn();
    const calc = makeCalculation({
      scheduleF: {
        netFarmProfit: 5000,
        grossIncome: 20000,
        totalExpenses: 15000,
      } as Partial<ScheduleFResult>,
    });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'farm_losses');
    expect(factor).toBeUndefined();
  });

  it('triggers large_noncash_charitable when noncash > $5,000', () => {
    const tr = makeTaxReturn({
      itemizedDeductions: {
        charitableCash: 1000,
        charitableNonCash: 8000,
      } as TaxReturn['itemizedDeductions'],
    });
    const calc = makeCalculation({ form1040: { agi: 100000 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'large_noncash_charitable');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(6);
    expect(factor!.category).toBe('deduction');
  });

  it('does not trigger large_noncash_charitable when noncash <= $5,000', () => {
    const tr = makeTaxReturn({
      itemizedDeductions: {
        charitableCash: 1000,
        charitableNonCash: 5000,
      } as TaxReturn['itemizedDeductions'],
    });
    const calc = makeCalculation({ form1040: { agi: 100000 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'large_noncash_charitable');
    expect(factor).toBeUndefined();
  });

  it('triggers clean_vehicle_credit when evCredit > 0', () => {
    const tr = makeTaxReturn();
    const calc = makeCalculation({ credits: { evCredit: 7500 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'clean_vehicle_credit');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(4);
    expect(factor!.category).toBe('credit');
  });

  it('triggers early_distribution_exception for 1099-R with distribution code 1', () => {
    const tr = makeTaxReturn({
      income1099R: [{
        id: 'r-1',
        payerName: '401k Provider',
        grossDistribution: 25000,
        taxableAmount: 25000,
        distributionCode: '1',
      }],
    });
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'early_distribution_exception');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(5);
    expect(factor!.category).toBe('structural');
  });

  it('does not trigger early_distribution_exception for normal 1099-R distributions', () => {
    const tr = makeTaxReturn({
      income1099R: [{
        id: 'r-1',
        payerName: 'Pension Plan',
        grossDistribution: 30000,
        taxableAmount: 30000,
        distributionCode: '7', // Normal distribution
      }],
    });
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'early_distribution_exception');
    expect(factor).toBeUndefined();
  });

  it('triggers k1_pass_through_losses when K-1 has negative ordinary income', () => {
    const tr = makeTaxReturn({
      incomeK1: [{
        id: 'k1-1',
        entityName: 'ABC Partnership',
        entityType: 'partnership',
        ordinaryBusinessIncome: -25000,
      }],
    });
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'k1_pass_through_losses');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(5);
    expect(factor!.category).toBe('structural');
  });

  it('triggers k1_pass_through_losses when K-1 has negative rental income', () => {
    const tr = makeTaxReturn({
      incomeK1: [{
        id: 'k1-1',
        entityName: 'Real Estate LLC',
        entityType: 'partnership',
        ordinaryBusinessIncome: 0,
        rentalIncome: -15000,
      }],
    });
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'k1_pass_through_losses');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(5);
  });

  it('does not trigger k1_pass_through_losses when K-1 income is positive', () => {
    const tr = makeTaxReturn({
      incomeK1: [{
        id: 'k1-1',
        entityName: 'Profitable LLC',
        entityType: 'partnership',
        ordinaryBusinessIncome: 50000,
        rentalIncome: 0,
      }],
    });
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'k1_pass_through_losses');
    expect(factor).toBeUndefined();
  });

  it('stacks new factors correctly with existing ones', () => {
    // AOTC (5) + EV credit (4) + early distribution (5) + K-1 losses (5) = 19 → moderate
    const tr = makeTaxReturn({
      income1099R: [{
        id: 'r-1',
        payerName: 'IRA',
        grossDistribution: 10000,
        taxableAmount: 10000,
        distributionCode: '1',
      }],
      incomeK1: [{
        id: 'k1-1',
        entityName: 'XYZ LP',
        entityType: 'partnership',
        ordinaryBusinessIncome: -20000,
      }],
    });
    const calc = makeCalculation({
      credits: { aotcRefundableCredit: 1000, evCredit: 7500 },
    });

    const result = assessAuditRisk(tr, calc);

    const aotc = result.triggeredFactors.find(f => f.id === 'aotc_claimed');
    const ev = result.triggeredFactors.find(f => f.id === 'clean_vehicle_credit');
    const early = result.triggeredFactors.find(f => f.id === 'early_distribution_exception');
    const k1 = result.triggeredFactors.find(f => f.id === 'k1_pass_through_losses');
    expect(aotc).toBeDefined();
    expect(ev).toBeDefined();
    expect(early).toBeDefined();
    expect(k1).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(19);
    expect(result.level).toBe('moderate');
  });

  it('triggers ptc_claimed when premiumTaxCredit > 0', () => {
    const tr = makeTaxReturn();
    const calc = makeCalculation({ credits: { premiumTaxCredit: 2400 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'ptc_claimed');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(5);
    expect(factor!.category).toBe('credit');
  });

  it('does not trigger ptc_claimed when no PTC', () => {
    const tr = makeTaxReturn();
    const calc = makeCalculation({ credits: { premiumTaxCredit: 0 } });

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'ptc_claimed');
    expect(factor).toBeUndefined();
  });

  it('triggers digital_assets when 1099-DA entries exist', () => {
    const tr = makeTaxReturn({
      income1099DA: [{
        id: 'da-1',
        brokerName: 'Coinbase',
        tokenName: 'Bitcoin',
        dateSold: '2025-06-15',
        proceeds: 50000,
        costBasis: 30000,
        isLongTerm: true,
      }],
    });
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'digital_assets');
    expect(factor).toBeDefined();
    expect(factor!.points).toBe(5);
    expect(factor!.category).toBe('structural');
  });

  it('does not trigger digital_assets when no 1099-DA entries', () => {
    const tr = makeTaxReturn({ income1099DA: [] });
    const calc = makeCalculation();

    const result = assessAuditRisk(tr, calc);

    const factor = result.triggeredFactors.find(f => f.id === 'digital_assets');
    expect(factor).toBeUndefined();
  });

  it('produces correct summary text for each level', () => {
    // Low
    const low = assessAuditRisk(makeTaxReturn(), makeCalculation());
    expect(low.summary).toContain('minimal');

    // Moderate (schedule C = 10 → moderate threshold 10)
    const modTr = makeTaxReturn({
      income1099NEC: [{ id: 'n1', payerName: 'X', amount: 50000 }],
    });
    const mod = assessAuditRisk(modTr, makeCalculation({ form1040: { agi: 50000 } }));
    expect(mod.summary).toContain('associated with higher IRS examination rates');
  });
});
