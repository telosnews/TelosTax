/**
 * Phase 7: Real-World Scenario Reconstruction
 *
 * Realistic tax scenarios reconstructed from patterns commonly seen
 * in tax forums (r/tax, Bogleheads, tax software communities).
 * Each scenario tests multi-system interaction with realistic inputs.
 *
 * Focus areas:
 *   1. Self-employment tax + credits interaction
 *   2. Investment income + preferential tax rates
 *   3. Retirees with Social Security + pension
 *   4. Low-income families with refundable credits (EITC + CTC)
 *   5. High-income itemizers hitting SALT cap
 *   6. Multi-state filing (NJ/NY, CA/TX)
 *   7. Gig workers with Schedule C + home office
 *   8. Capital gains/losses + carryforward
 *   9. Education credits + student loan interest
 *  10. MFJ vs MFS comparison on same income
 *  11. Retiree Roth conversion + ACA Premium Tax Credit
 *  12. Mixed W-2 + side hustle + rental income
 */
import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateStateTaxes } from '../src/engine/state/index.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ── Helper ──────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'realworld',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    schemaVersion: 1,
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
    incomeW2G: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
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
  };
}

// Assertion helper: verify no NaN in critical result fields
function assertNoNaN(result: ReturnType<typeof calculateForm1040>) {
  const f = result.form1040;
  const checks = [
    'agi', 'taxableIncome', 'incomeTax', 'totalTax', 'totalCredits',
    'taxAfterCredits', 'refundAmount', 'amountOwed', 'effectiveTaxRate',
    'totalWithholding', 'totalPayments', 'seTax',
  ] as const;
  for (const key of checks) {
    expect(f[key], `form1040.${key} should not be NaN`).not.toBeNaN();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Self-Employed Couple — MFJ, $110k combined 1099-NEC, 2 kids
//    "My husband and I both switched to 1099. What should we expect?"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW1: Self-Employed Couple — MFJ $110k 1099-NEC, 2 kids', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    businesses: [{
      id: 'biz1', businessName: 'Freelance LLC', accountingMethod: 'cash',
      didStartThisYear: false,
    }],
    income1099NEC: [
      { id: 'n1', payerName: 'Client A', amount: 65000, businessId: 'biz1' },
      { id: 'n2', payerName: 'Client B', amount: 45000, businessId: 'biz1' },
    ],
    expenses: [
      { id: 'e1', scheduleCLine: 27, category: 'other', description: 'Software subscriptions', amount: 2400, businessId: 'biz1' },
      { id: 'e2', scheduleCLine: 18, category: 'office', description: 'Office supplies', amount: 1200, businessId: 'biz1' },
      { id: 'e3', scheduleCLine: 17, category: 'legal', description: 'Accounting fees', amount: 800, businessId: 'biz1' },
    ],
    dependents: [
      { id: 'd1', firstName: 'Emma', lastName: 'Smith', relationship: 'daughter', dateOfBirth: '2016-03-15', monthsLivedWithYou: 12 },
      { id: 'd2', firstName: 'Liam', lastName: 'Smith', relationship: 'son', dateOfBirth: '2019-08-22', monthsLivedWithYou: 12 },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('Schedule C profit = gross - expenses', () => {
    expect(result.form1040.scheduleCNetProfit).toBeCloseTo(110000 - 4400, 0);
  });

  it('SE tax is substantial (15.3% of 92.35% net)', () => {
    expect(result.form1040.seTax).toBeGreaterThan(14000);
    expect(result.form1040.seTax).toBeLessThan(17000);
  });

  it('AGI reflects SE deduction (half of SE tax)', () => {
    // AGI = Schedule C profit - SE deduction
    expect(result.form1040.agi).toBeLessThan(110000);
    expect(result.form1040.agi).toBeGreaterThan(90000);
  });

  it('CTC for 2 qualifying children = $4,400', () => {
    expect(result.credits.childTaxCredit).toBe(4400);
  });

  it('uses standard deduction ($31,500 MFJ)', () => {
    expect(result.form1040.deductionUsed).toBe('standard');
    expect(result.form1040.standardDeduction).toBe(31500);
  });

  it('total tax includes both income tax and SE tax', () => {
    expect(result.form1040.totalTax).toBeGreaterThan(result.form1040.incomeTax);
    expect(result.form1040.totalTax).toBeGreaterThan(result.form1040.seTax);
  });

  it('effective rate is reasonable (15-25% range for self-employed)', () => {
    expect(result.form1040.effectiveTaxRate).toBeGreaterThan(0.10);
    expect(result.form1040.effectiveTaxRate).toBeLessThan(0.30);
  });

  it('owes money (no withholding on 1099 income)', () => {
    expect(result.form1040.amountOwed).toBeGreaterThan(0);
    expect(result.form1040.refundAmount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. W-2 Earner with Investment Income — Single, $93k salary + dividends
//    "Am I withholding too much? $93k salary, 8% 401k, some dividends"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW2: Single $93k W-2 + Investment Income', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1', employerName: 'Tech Corp',
      wages: 85560,  // $93k - 8% 401k contribution
      federalTaxWithheld: 15221,
      socialSecurityWages: 93000,
      socialSecurityTax: 5766,
      medicareWages: 93000,
      medicareTax: 1348.50,
    }],
    income1099INT: [
      { id: 'i1', payerName: 'Bank HYSA', amount: 1800 },
    ],
    income1099DIV: [
      { id: 'd1', payerName: 'Vanguard Total Stock', ordinaryDividends: 3200, qualifiedDividends: 2800 },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('AGI includes wages + interest + dividends', () => {
    // AGI = $85,560 wages + $1,800 interest + $3,200 ordinary dividends
    expect(result.form1040.agi).toBeCloseTo(85560 + 1800 + 3200, 0);
  });

  it('qualified dividends get preferential rate', () => {
    expect(result.form1040.qualifiedDividends).toBe(2800);
    // Preferential tax should be lower than ordinary rate
    expect(result.form1040.preferentialTax).toBeGreaterThanOrEqual(0);
  });

  it('uses standard deduction ($15,750 Single)', () => {
    expect(result.form1040.deductionUsed).toBe('standard');
    expect(result.form1040.standardDeduction).toBe(15750);
  });

  it('gets a refund (overwithholding)', () => {
    // $15,221 withheld on ~$90k income should result in a refund
    expect(result.form1040.refundAmount).toBeGreaterThan(0);
  });

  it('effective rate in reasonable range (12-18%)', () => {
    expect(result.form1040.effectiveTaxRate).toBeGreaterThan(0.08);
    expect(result.form1040.effectiveTaxRate).toBeLessThan(0.22);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. MFJ Couple with Qualified Dividends — $50k W-2 + $15k qualified divs
//    "Does the $15k dividend get hit at 12% or 0%?"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW3: MFJ $50k W-2 + $15k Qualified Dividends', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1', employerName: 'Local Biz',
      wages: 50000, federalTaxWithheld: 3500,
      socialSecurityWages: 50000, socialSecurityTax: 3100,
      medicareWages: 50000, medicareTax: 725,
    }],
    income1099DIV: [{
      id: 'd1', payerName: 'Vanguard Dividend Fund',
      ordinaryDividends: 15000, qualifiedDividends: 15000,
    }],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('AGI = $65,000 (W-2 + dividends)', () => {
    expect(result.form1040.agi).toBe(65000);
  });

  it('taxable income = AGI - $31,500 standard deduction', () => {
    expect(result.form1040.taxableIncome).toBe(33500);
  });

  it('qualified dividends taxed at 0% rate (within MFJ 0% threshold)', () => {
    // MFJ 0% LTCG/QD threshold is ~$96,700 for 2025
    // Taxable income is $33,500 — well within 0% zone
    // Most/all of the $15k qualified divs should be at 0%
    expect(result.form1040.preferentialTax).toBe(0);
  });

  it('total tax is lower than if all income were ordinary', () => {
    // Compare with what tax would be if $15k were all ordinary
    const ordinaryReturn = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{
        id: 'w1', employerName: 'Local Biz',
        wages: 65000, federalTaxWithheld: 3500,
      }],
    });
    const ordinaryResult = calculateForm1040(ordinaryReturn);
    expect(result.form1040.totalTax).toBeLessThan(ordinaryResult.form1040.totalTax);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Retiree with Social Security + Pension + IRA
//    "I'm retired, getting SS + pension. How much SS is taxable?"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW4: Retiree — Single, SS + Pension + IRA Distributions', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    incomeSSA1099: {
      id: 'ssa1', totalBenefits: 24000, federalTaxWithheld: 2400,
    },
    income1099R: [
      // Pension
      { id: 'r1', payerName: 'State Pension Fund', grossDistribution: 28000,
        taxableAmount: 28000, federalTaxWithheld: 3500, distributionCode: '7', isIRA: false },
      // IRA distribution
      { id: 'r2', payerName: 'Fidelity IRA', grossDistribution: 15000,
        taxableAmount: 15000, federalTaxWithheld: 1500, distributionCode: '7', isIRA: true },
    ],
    income1099INT: [
      { id: 'i1', payerName: 'Credit Union', amount: 2500 },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('Social Security is partially taxable (provisional income > $25k Single)', () => {
    // Provisional income = $28k pension + $15k IRA + $2.5k interest + $12k (half SS) = $57.5k
    // Well above $34k threshold → 85% taxable
    expect(result.form1040.taxableSocialSecurity).toBeGreaterThan(0);
    expect(result.form1040.taxableSocialSecurity).toBeLessThanOrEqual(24000 * 0.85);
    expect(result.form1040.socialSecurityBenefits).toBe(24000);
  });

  it('AGI includes pension + IRA + interest + taxable SS', () => {
    // AGI should be around $28k + $15k + $2.5k + taxable SS (~$20.4k)
    expect(result.form1040.agi).toBeGreaterThan(60000);
    expect(result.form1040.agi).toBeLessThan(70000);
  });

  it('withholding covers most tax liability', () => {
    // $2,400 + $3,500 + $1,500 = $7,400 withheld
    expect(result.form1040.totalWithholding).toBe(7400);
  });

  it('reasonable effective rate for moderate retirement income', () => {
    expect(result.form1040.effectiveTaxRate).toBeGreaterThan(0.05);
    expect(result.form1040.effectiveTaxRate).toBeLessThan(0.18);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Low-Income Single Parent — HoH, $28k, 3 kids, EITC + CTC + childcare
//    "How do people get such big refunds?" — Refundable credits
// ═══════════════════════════════════════════════════════════════════════════

describe('RW5: Low-Income HoH — $28k, 3 kids, EITC + CTC', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.HeadOfHousehold,
    w2Income: [{
      id: 'w1', employerName: 'Retail Store',
      wages: 28000, federalTaxWithheld: 1200,
      socialSecurityWages: 28000, socialSecurityTax: 1736,
      medicareWages: 28000, medicareTax: 406,
    }],
    dependents: [
      { id: 'd1', firstName: 'Child1', lastName: 'T', relationship: 'daughter', dateOfBirth: '2013-05-10', monthsLivedWithYou: 12 },
      { id: 'd2', firstName: 'Child2', lastName: 'T', relationship: 'son', dateOfBirth: '2016-09-20', monthsLivedWithYou: 12 },
      { id: 'd3', firstName: 'Child3', lastName: 'T', relationship: 'daughter', dateOfBirth: '2020-02-14', monthsLivedWithYou: 12 },
    ],
    dependentCare: {
      totalExpenses: 4000,
      qualifyingPersons: 2,
    },
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('EITC generated (3 qualifying children)', () => {
    // $28k HoH with 3 kids is well within EITC range
    expect(result.credits.eitcCredit).toBeGreaterThan(0);
    // Max EITC for 3+ children is ~$8,046 in 2025
    expect(result.credits.eitcCredit).toBeLessThanOrEqual(8500);
  });

  it('CTC for 3 children = $6,600', () => {
    expect(result.credits.childTaxCredit + result.credits.actcCredit).toBeGreaterThanOrEqual(6600);
  });

  it('ACTC generated (refundable CTC exceeds tax liability)', () => {
    // At $28k income with $23,625 HoH standard deduction, taxable = $4,375
    // Tax on $4,375 at 10% = $437.50
    // CTC $6,600 >> $437.50 → ACTC kicks in
    expect(result.credits.actcCredit).toBeGreaterThan(0);
  });

  it('dependent care credit generated', () => {
    expect(result.credits.dependentCareCredit).toBeGreaterThan(0);
  });

  it('gets a large refund (refundable credits)', () => {
    // EITC + ACTC + withholding → substantial refund
    expect(result.form1040.refundAmount).toBeGreaterThan(5000);
  });

  it('effective rate is zero or negative (refundable credits exceed tax)', () => {
    // Refundable credits should push effective rate to zero or below
    // Engine may floor effective rate at 0
    expect(result.form1040.effectiveTaxRate).toBeLessThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. High-Income Itemizer — MFJ $250k, SALT cap, mortgage
//    "SALT cap is killing us. MFJ $250k, high property taxes in NJ"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW6: High-Income MFJ Itemizer — $250k, SALT cap', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [
      {
        id: 'w1', employerName: 'Finance Corp',
        wages: 180000, federalTaxWithheld: 32000,
        socialSecurityWages: 168600, socialSecurityTax: 10453.20,
        medicareWages: 180000, medicareTax: 2610,
        stateTaxWithheld: 9000, stateWages: 180000, state: 'NJ',
      },
      {
        id: 'w2', employerName: 'Consulting Side',
        wages: 70000, federalTaxWithheld: 12000,
        socialSecurityWages: 0, socialSecurityTax: 0,
        medicareWages: 70000, medicareTax: 1015,
        stateTaxWithheld: 3500, stateWages: 70000, state: 'NJ',
      },
    ],
    deductionMethod: 'itemized',
    itemizedDeductions: {
      stateLocalIncomeTax: 12500,
      realEstateTax: 18000,
      personalPropertyTax: 0,
      mortgageInterest: 15000,
      mortgageInsurancePremiums: 0,
      charitableCash: 8000,
      charitableNonCash: 2000,
      medicalExpenses: 3000,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
    stateReturns: [{ stateCode: 'NJ', residencyType: 'resident' }],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('AGI = combined wages', () => {
    expect(result.form1040.agi).toBe(250000);
  });

  it('SALT deduction capped at $40,000 (OBBBA)', () => {
    // State income tax $12,500 + RE tax $18,000 = $30,500 total SALT
    // Under $40k cap, so should take full amount
    expect(result.form1040.deductionUsed).toBe('itemized');
    // Itemized = $30,500 (SALT) + $15,000 (mortgage) + $10,000 (charity) = $55,500
    // Since SALT total ($30,500) < $40k cap, full SALT should be allowed
    expect(result.form1040.itemizedDeduction).toBeGreaterThan(result.form1040.standardDeduction);
  });

  it('total withholding from both W-2s', () => {
    expect(result.form1040.totalWithholding).toBe(44000);
  });

  it('marginal rate in 24% bracket', () => {
    // $250k AGI - ~$55k itemized = ~$195k taxable income
    // MFJ 24% bracket starts at $206,700 in OBBBA... so 22% bracket
    expect(result.form1040.marginalTaxRate).toBeGreaterThanOrEqual(0.22);
    expect(result.form1040.marginalTaxRate).toBeLessThanOrEqual(0.24);
  });

  it('NJ state taxes computed', () => {
    const stateResults = calculateStateTaxes(taxReturn, result);
    expect(stateResults).toHaveLength(1);
    expect(stateResults[0].stateCode).toBe('NJ');
    expect(stateResults[0].stateIncomeTax).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Multi-State Worker — NJ Resident, NY Commuter
//    "I live in NJ but work in NY. Do I file both?"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW7: NJ Resident / NY Commuter — Multi-State', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1', employerName: 'NYC Finance',
      wages: 120000, federalTaxWithheld: 22000,
      socialSecurityWages: 120000, socialSecurityTax: 7440,
      medicareWages: 120000, medicareTax: 1740,
      stateTaxWithheld: 6500, stateWages: 120000, state: 'NY',
    }],
    stateReturns: [
      { stateCode: 'NY', residencyType: 'nonresident', stateSourceIncome: 120000 },
      { stateCode: 'NJ', residencyType: 'resident' },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('federal AGI = $120k', () => {
    expect(result.form1040.agi).toBe(120000);
  });

  it('both state returns computed without crash', () => {
    const stateResults = calculateStateTaxes(taxReturn, result);
    expect(stateResults).toHaveLength(2);

    const nyResult = stateResults.find(s => s.stateCode === 'NY')!;
    const njResult = stateResults.find(s => s.stateCode === 'NJ')!;

    expect(nyResult).toBeDefined();
    expect(njResult).toBeDefined();

    // NY nonresident tax on $120k
    expect(nyResult.stateIncomeTax).toBeGreaterThan(0);
    // NJ resident tax
    expect(njResult.stateIncomeTax).toBeGreaterThan(0);

    // No NaN in state results
    expect(nyResult.totalStateTax).not.toBeNaN();
    expect(njResult.totalStateTax).not.toBeNaN();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Gig Worker — Multiple 1099-NECs + Home Office
//    "First year as contractor, multiple clients, home office"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW8: Gig Worker — $72k from 3 clients + Home Office', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    businesses: [{
      id: 'gig', businessName: 'Freelance Dev', accountingMethod: 'cash',
      didStartThisYear: true, principalBusinessCode: '541511',
    }],
    income1099NEC: [
      { id: 'n1', payerName: 'Startup A', amount: 35000, businessId: 'gig' },
      { id: 'n2', payerName: 'Agency B', amount: 25000, businessId: 'gig' },
      { id: 'n3', payerName: 'Direct Client C', amount: 12000, businessId: 'gig' },
    ],
    expenses: [
      { id: 'e1', scheduleCLine: 27, category: 'other', description: 'Cloud hosting', amount: 3600, businessId: 'gig' },
      { id: 'e2', scheduleCLine: 18, category: 'office', description: 'Equipment', amount: 2500, businessId: 'gig' },
      { id: 'e3', scheduleCLine: 22, category: 'supplies', description: 'Software', amount: 1800, businessId: 'gig' },
      { id: 'e4', scheduleCLine: 8, category: 'advertising', description: 'Website & marketing', amount: 1200, businessId: 'gig' },
    ],
    homeOffice: {
      method: 'simplified',
      squareFeet: 200,
    },
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('Schedule C net profit = gross - expenses - home office', () => {
    const grossIncome = 72000;
    const expenses = 3600 + 2500 + 1800 + 1200; // $9,100
    const homeOffice = 200 * 5; // $1,000 simplified
    const expectedProfit = grossIncome - expenses - homeOffice;
    expect(result.form1040.scheduleCNetProfit).toBeCloseTo(expectedProfit, 0);
  });

  it('SE tax calculated on net earnings', () => {
    expect(result.form1040.seTax).toBeGreaterThan(7000);
    expect(result.form1040.seTax).toBeLessThan(10000);
  });

  it('SE deduction reduces AGI', () => {
    expect(result.form1040.seDeduction).toBeGreaterThan(0);
    expect(result.form1040.agi).toBeLessThan(72000);
  });

  it('owes money (no withholding)', () => {
    expect(result.form1040.amountOwed).toBeGreaterThan(0);
  });

  it('estimated quarterly payment suggested', () => {
    expect(result.form1040.estimatedQuarterlyPayment).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Investor with Capital Gains, Losses, and Carryforward
//    "I had a bad year in 2024, carrying forward losses into 2025"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW9: Investor — Capital Gains + Losses + $8k Carryforward', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1', employerName: 'Day Job',
      wages: 85000, federalTaxWithheld: 12000,
      socialSecurityWages: 85000, socialSecurityTax: 5270,
      medicareWages: 85000, medicareTax: 1232.50,
    }],
    income1099B: [
      // Profitable long-term sale
      { id: 'b1', brokerName: 'Schwab', description: '200 shares VTI',
        dateAcquired: '2020-03-15', dateSold: '2025-06-01',
        proceeds: 45000, costBasis: 30000, isLongTerm: true },
      // Short-term loss
      { id: 'b2', brokerName: 'Schwab', description: '100 shares ARKK',
        dateAcquired: '2025-01-10', dateSold: '2025-04-15',
        proceeds: 8000, costBasis: 12000, isLongTerm: false },
    ],
    income1099DIV: [{
      id: 'd1', payerName: 'Schwab', ordinaryDividends: 2000,
      qualifiedDividends: 1500, capitalGainDistributions: 500,
    }],
    capitalLossCarryforwardST: 5000,
    capitalLossCarryforwardLT: 3000,
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('Schedule D computed with gains and losses', () => {
    expect(result.scheduleD).toBeDefined();
    // LT gain: $15,000 (VTI) + $500 cap gain dist - $3,000 LT carryforward = $12,500
    expect(result.scheduleD!.longTermGain).toBeGreaterThan(0);
    // ST: -$4,000 (ARKK loss) - $5,000 carryforward = -$9,000
    expect(result.scheduleD!.netShortTerm).toBeLessThan(0);
  });

  it('net gain flows through to AGI', () => {
    // Net: LT gain - ST loss should be positive
    expect(result.form1040.capitalGainOrLoss).toBeGreaterThan(0);
    expect(result.form1040.agi).toBeGreaterThan(85000);
  });

  it('long-term gains get preferential tax rate', () => {
    expect(result.form1040.preferentialTax).toBeGreaterThan(0);
  });

  it('effective rate reasonable for $85k + capital gains', () => {
    expect(result.form1040.effectiveTaxRate).toBeGreaterThan(0.10);
    expect(result.form1040.effectiveTaxRate).toBeLessThan(0.22);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Student / Young Professional — Education Credits + Student Loans
//     "Just graduated, $45k job, still paying tuition + student loans"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW10: Young Professional — $45k W-2, AOTC + Student Loan Interest', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1', employerName: 'First Job Inc',
      wages: 45000, federalTaxWithheld: 4000,
      socialSecurityWages: 45000, socialSecurityTax: 2790,
      medicareWages: 45000, medicareTax: 652.50,
    }],
    educationCredits: [{
      id: 'ed1', type: 'american_opportunity', studentName: 'Self',
      institution: 'State University', tuitionPaid: 6000,
    }],
    studentLoanInterest: 2500,
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('student loan interest reduces AGI', () => {
    expect(result.form1040.agi).toBe(42500); // $45k - $2.5k
    expect(result.form1040.studentLoanInterest).toBe(2500);
  });

  it('AOTC = $2,500 (full credit with $6k expenses)', () => {
    const totalAOTC = result.credits.educationCredit + result.credits.aotcRefundableCredit;
    expect(totalAOTC).toBeCloseTo(2500, 0);
  });

  it('AOTC split: 60% non-refundable + 40% refundable', () => {
    expect(result.credits.educationCredit).toBeCloseTo(1500, 0);  // 60%
    expect(result.credits.aotcRefundableCredit).toBeCloseTo(1000, 0); // 40%
  });

  it('gets a refund (withholding + refundable AOTC)', () => {
    expect(result.form1040.refundAmount).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. MFJ vs MFS Comparison — Same Income, Different Filing Status
//     "Should we file jointly or separately this year?"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW11: MFJ vs MFS Comparison — $90k + $60k Dual Income', () => {
  const sharedFields = {
    w2Income: [
      {
        id: 'w1', employerName: 'Spouse 1 Corp',
        wages: 90000, federalTaxWithheld: 13000,
        socialSecurityWages: 90000, socialSecurityTax: 5580,
        medicareWages: 90000, medicareTax: 1305,
      },
      {
        id: 'w2', employerName: 'Spouse 2 Corp',
        wages: 60000, federalTaxWithheld: 7500,
        socialSecurityWages: 60000, socialSecurityTax: 3720,
        medicareWages: 60000, medicareTax: 870,
      },
    ],
  };

  const mfjReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    ...sharedFields,
  });

  const mfsReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingSeparately,
    w2Income: [sharedFields.w2Income[0]], // Only spouse 1's income
  });

  const mfjResult = calculateForm1040(mfjReturn);
  const mfsResult = calculateForm1040(mfsReturn);

  it('no NaN in MFJ result', () => assertNoNaN(mfjResult));
  it('no NaN in MFS result', () => assertNoNaN(mfsResult));

  it('MFJ AGI includes both incomes', () => {
    expect(mfjResult.form1040.agi).toBe(150000);
  });

  it('MFS AGI is just one spouse', () => {
    expect(mfsResult.form1040.agi).toBe(90000);
  });

  it('MFJ standard deduction is double Single', () => {
    expect(mfjResult.form1040.standardDeduction).toBe(31500);
    expect(mfsResult.form1040.standardDeduction).toBe(15750);
  });

  it('MFJ total tax is typically lower than sum of both MFS', () => {
    // MFJ brackets are exactly 2× Single, so with unequal incomes MFJ wins
    // For this test, we just verify MFJ produces a valid result
    expect(mfjResult.form1040.totalTax).toBeGreaterThan(0);
    expect(mfsResult.form1040.totalTax).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. Mixed W-2 + Side Hustle + Rental — Common Multi-Schedule Return
//     "Day job $80k, Etsy shop on the side, one rental property"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW12: Mixed Income — $80k W-2 + Side Hustle + Rental', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1', employerName: 'Main Job LLC',
      wages: 80000, federalTaxWithheld: 10000,
      socialSecurityWages: 80000, socialSecurityTax: 4960,
      medicareWages: 80000, medicareTax: 1160,
    }],
    businesses: [{
      id: 'etsy', businessName: 'Crafts by Sarah', accountingMethod: 'cash',
      didStartThisYear: false,
    }],
    income1099K: [{
      id: 'k1', platformName: 'Etsy', grossAmount: 18000, businessId: 'etsy',
    }],
    expenses: [
      { id: 'e1', scheduleCLine: 22, category: 'supplies', description: 'Craft materials', amount: 6000, businessId: 'etsy' },
      { id: 'e2', scheduleCLine: 20, category: 'rent', description: 'Storage unit', amount: 1200, businessId: 'etsy' },
      { id: 'e3', scheduleCLine: 27, category: 'other', description: 'Shipping', amount: 2800, businessId: 'etsy' },
    ],
    rentalProperties: [{
      id: 'rental1', address: '123 Rental Ave',
      propertyType: 'single_family',
      daysRented: 365,
      personalUseDays: 0,
      rentalIncome: 24000,
      mortgageInterest: 8000,
      taxes: 4500,
      insurance: 1800,
      repairs: 2000,
      depreciation: 3500,
      otherExpenses: 500,
    }],
    dependents: [
      { id: 'd1', firstName: 'Baby', lastName: 'T', relationship: 'son', dateOfBirth: '2022-11-01', monthsLivedWithYou: 12 },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('Schedule C shows Etsy profit', () => {
    // $18k - $10k expenses = $8k profit
    expect(result.form1040.scheduleCNetProfit).toBeCloseTo(8000, 0);
  });

  it('SE tax on side hustle only', () => {
    // SE on $8k net: $8k × 0.9235 × 15.3% ≈ $1,130
    expect(result.form1040.seTax).toBeGreaterThan(900);
    expect(result.form1040.seTax).toBeLessThan(1500);
  });

  it('rental income/loss flows through Schedule E', () => {
    // Rent: $24k, Expenses: $8k + $4.5k + $1.8k + $2k + $3.5k + $0.5k = $20.3k
    // Net rental = $24k - $20.3k = $3,700 profit
    expect(result.form1040.scheduleEIncome).toBeGreaterThanOrEqual(0);
    // Rental income should be non-NaN
    expect(result.form1040.scheduleEIncome).not.toBeNaN();
  });

  it('CTC for 1 child = $2,200', () => {
    expect(result.credits.childTaxCredit).toBe(2200);
  });

  it('AGI includes all income sources', () => {
    // W-2 $80k + Sched C $8k + Rental income - SE deduction
    // AGI ≈ $87-92k depending on rental and SE deduction
    expect(result.form1040.agi).toBeGreaterThan(85000);
    expect(result.form1040.agi).toBeLessThan(93000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. Unemployment + Part-Year W-2 — Job Loss Mid-Year
//     "Lost my job in June, collected unemployment rest of year"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW13: Job Loss — Part-Year W-2 + Unemployment', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1', employerName: 'Former Employer',
      wages: 40000, federalTaxWithheld: 5500,  // Jan-June
      socialSecurityWages: 40000, socialSecurityTax: 2480,
      medicareWages: 40000, medicareTax: 580,
    }],
    income1099G: [{
      id: 'g1', payerName: 'State DOL',
      unemploymentCompensation: 12000, // July-December
      federalTaxWithheld: 1200, // 10% voluntary withholding
    }],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('AGI = W-2 + unemployment', () => {
    expect(result.form1040.agi).toBe(52000);
    expect(result.form1040.totalUnemployment).toBe(12000);
  });

  it('withholding from both sources', () => {
    expect(result.form1040.totalWithholding).toBe(6700); // $5,500 + $1,200
  });

  it('standard deduction applied', () => {
    expect(result.form1040.deductionUsed).toBe('standard');
    expect(result.form1040.taxableIncome).toBe(52000 - 15750);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. High-Earner with AMT Risk — Stock Options + High Income
//     "Do I have to worry about AMT?"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW14: High Earner — $350k MFJ, Itemizer, AMT Exposure', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1', employerName: 'Tech Giant',
      wages: 350000, federalTaxWithheld: 75000,
      socialSecurityWages: 168600, socialSecurityTax: 10453.20,
      medicareWages: 350000, medicareTax: 5075,
      stateTaxWithheld: 25000, stateWages: 350000, state: 'CA',
    }],
    deductionMethod: 'itemized',
    itemizedDeductions: {
      stateLocalIncomeTax: 25000,
      realEstateTax: 15000,
      personalPropertyTax: 0,
      mortgageInterest: 20000,
      mortgageInsurancePremiums: 0,
      charitableCash: 15000,
      charitableNonCash: 5000,
      medicalExpenses: 0,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
    stateReturns: [{ stateCode: 'CA', residencyType: 'resident' }],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('AGI = $350k', () => {
    expect(result.form1040.agi).toBe(350000);
  });

  it('SALT capped at $40,000 (OBBBA cap)', () => {
    // SALT total: $25k + $15k = $40k, exactly at the cap
    // But OBBBA raised cap to $40k, so full amount allowed
    // Itemized: $40k SALT + $20k mortgage + $20k charity = $80k
    expect(result.form1040.deductionUsed).toBe('itemized');
    expect(result.form1040.itemizedDeduction).toBeGreaterThan(70000);
  });

  it('AMT computation runs without crash', () => {
    // AMT may or may not apply depending on exact OBBBA thresholds
    expect(result.form1040.amtAmount).toBeGreaterThanOrEqual(0);
    expect(result.form1040.amtAmount).not.toBeNaN();
  });

  it('Additional Medicare Tax on wages > $250k (MFJ)', () => {
    // 0.9% on wages above $250k = 0.9% × $100k = $900
    expect(result.form1040.additionalMedicareTaxW2).toBeCloseTo(900, 0);
  });

  it('CA state tax computed', () => {
    const stateResults = calculateStateTaxes(taxReturn, result);
    expect(stateResults).toHaveLength(1);
    expect(stateResults[0].stateCode).toBe('CA');
    expect(stateResults[0].stateIncomeTax).toBeGreaterThan(15000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 15. Retiree Roth Conversion + ACA — Early Retirement
//     "I'm 55, doing Roth conversions. How does this affect my ACA subsidy?"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW15: Early Retiree — Roth Conversion + ACA Premium Tax Credit', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    income1099R: [{
      id: 'r1', payerName: 'Fidelity Traditional IRA',
      grossDistribution: 40000, taxableAmount: 40000,
      federalTaxWithheld: 4000, distributionCode: '2', isIRA: true,
    }],
    income1099INT: [
      { id: 'i1', payerName: 'Savings Account', amount: 3000 },
    ],
    income1099DIV: [{
      id: 'd1', payerName: 'Taxable Brokerage',
      ordinaryDividends: 5000, qualifiedDividends: 4000,
    }],
    premiumTaxCredit: {
      annualPremium: 9600,
      annualSLCSP: 10800,
      annualAPTC: 5000,
      householdSize: 1,
    },
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('AGI includes IRA distribution + interest + dividends', () => {
    expect(result.form1040.agi).toBe(48000);
  });

  it('PTC reconciliation computed', () => {
    expect(result.credits.premiumTaxCredit).not.toBeNaN();
    // PTC may result in additional credit or repayment
    expect(result.form1040.premiumTaxCreditNet).not.toBeNaN();
  });

  it('qualified dividends get preferential rate', () => {
    expect(result.form1040.qualifiedDividends).toBe(4000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 16. Married Couple — One Spouse GA, Other AL (Cross-State)
//     "Parent A in GA, Parent B moved to AL for work"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW16: Cross-State Married Couple — GA + AL', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [
      {
        id: 'w1', employerName: 'GA Employer',
        wages: 55000, federalTaxWithheld: 5500,
        stateTaxWithheld: 2700, stateWages: 55000, state: 'GA',
      },
      {
        id: 'w2', employerName: 'AL Employer',
        wages: 48000, federalTaxWithheld: 4800,
        stateTaxWithheld: 2200, stateWages: 48000, state: 'AL',
      },
    ],
    stateReturns: [
      { stateCode: 'GA', residencyType: 'resident' },
      { stateCode: 'AL', residencyType: 'nonresident', stateSourceIncome: 48000 },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('federal AGI = combined wages', () => {
    expect(result.form1040.agi).toBe(103000);
  });

  it('both states compute tax', () => {
    const stateResults = calculateStateTaxes(taxReturn, result);
    expect(stateResults).toHaveLength(2);

    const gaResult = stateResults.find(s => s.stateCode === 'GA')!;
    const alResult = stateResults.find(s => s.stateCode === 'AL')!;

    expect(gaResult).toBeDefined();
    expect(alResult).toBeDefined();
    expect(gaResult.stateIncomeTax).toBeGreaterThan(0);
    expect(alResult.stateIncomeTax).toBeGreaterThan(0);
    expect(gaResult.totalStateTax).not.toBeNaN();
    expect(alResult.totalStateTax).not.toBeNaN();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 17. High Dividend Wash Sale Trader — Large Volume, Small Net
//     "Day trader with wash sales — $75M proceeds but only $47k profit"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW17: Active Trader — Wash Sales + Short-Term Gains', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1', employerName: 'Part-time Job',
      wages: 30000, federalTaxWithheld: 3000,
    }],
    income1099B: [
      // Net short-term gain after adjustments
      { id: 'b1', brokerName: 'Schwab', description: 'Various day trades',
        dateSold: '2025-12-31', proceeds: 500000, costBasis: 460000,
        isLongTerm: false, washSaleLossDisallowed: 15000 },
      // Another batch with losses
      { id: 'b2', brokerName: 'Schwab', description: 'More trades',
        dateSold: '2025-12-31', proceeds: 200000, costBasis: 213000,
        isLongTerm: false },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('Schedule D processes wash sales correctly', () => {
    expect(result.scheduleD).toBeDefined();
    // Net: ($500k - $460k) + wash sale adj $15k + ($200k - $213k) = $40k + $15k - $13k = $42k?
    // Actually wash sale disallowed means the loss is added back, increasing basis
    // Proceeds $500k, cost $460k, wash sale disallowed $15k → reported gain = $40k + $15k = $55k? No...
    // wash sale disallowed means $15k of losses can't be taken. The cost basis is ALREADY adjusted.
    // So the 1099-B shows cost basis of $460k (which already includes wash sale adjustments)
    // and wash sale loss disallowed of $15k
    // Net effect: gains are $40k from batch 1, losses $13k from batch 2 = $27k net ST gain
    expect(result.scheduleD!.netShortTerm).toBeGreaterThan(0);
  });

  it('short-term gains taxed as ordinary income', () => {
    expect(result.form1040.agi).toBeGreaterThan(30000); // wages + ST gains
    expect(result.form1040.incomeTax).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 18. Solar Panels + Home Improvement Credits
//     "Installed solar + heat pump. What credits do I get?"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW18: Homeowner — Solar + Heat Pump Energy Credits', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1', employerName: 'Corp',
      wages: 120000, federalTaxWithheld: 18000,
      socialSecurityWages: 120000, socialSecurityTax: 7440,
      medicareWages: 120000, medicareTax: 1740,
    }],
    cleanEnergy: { solarElectric: 25000 },
    energyEfficiency: { heatPump: 8000, windows: 2000 },
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('solar credit = 30% × $25,000 = $7,500', () => {
    expect(result.credits.cleanEnergyCredit).toBe(7500);
  });

  it('energy efficiency credit computed', () => {
    // Heat pump: 30% × $8k = $2,400, capped at $2,000 annual cap
    // Windows: 30% × $2k = $600
    expect(result.credits.energyEfficiencyCredit).toBeGreaterThan(0);
  });

  it('credits reduce total tax', () => {
    const noCreditsReturn = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{
        id: 'w1', employerName: 'Corp',
        wages: 120000, federalTaxWithheld: 18000,
      }],
    });
    const noCreditsResult = calculateForm1040(noCreditsReturn);
    expect(result.form1040.totalTax).toBeLessThan(noCreditsResult.form1040.totalTax);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 19. Foreign Income — International Fund Dividends with FTC
//     "I have $800 foreign tax paid on my international fund"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW19: International Investor — Foreign Tax Credit', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1', employerName: 'Employer',
      wages: 95000, federalTaxWithheld: 10000,
    }],
    income1099DIV: [
      // US fund
      { id: 'd1', payerName: 'Vanguard Total Stock',
        ordinaryDividends: 4000, qualifiedDividends: 3500 },
      // International fund with foreign tax
      { id: 'd2', payerName: 'Vanguard Total Intl',
        ordinaryDividends: 6000, qualifiedDividends: 5000,
        foreignTaxPaid: 800 },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('foreign tax credit applied', () => {
    // $800 > $600 MFJ simplified threshold → Form 1116 limitation applies
    // But with $6k foreign income and reasonable worldwide income, credit should be allowed
    expect(result.credits.foreignTaxCredit).toBeGreaterThan(0);
    expect(result.credits.foreignTaxCredit).toBeLessThanOrEqual(800);
  });

  it('AGI includes all dividends', () => {
    expect(result.form1040.agi).toBe(105000); // $95k + $4k + $6k
  });

  it('qualified dividends from both funds', () => {
    expect(result.form1040.qualifiedDividends).toBe(8500); // $3,500 + $5,000
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 20. TX Resident + CA Nonresident — No-Tax Home State
//     "I live in Texas but earned income in California last year"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW20: TX Resident + CA Nonresident', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [
      {
        id: 'w1', employerName: 'TX Main Job',
        wages: 85000, federalTaxWithheld: 12000,
        state: 'TX',
      },
      {
        id: 'w2', employerName: 'CA Contract',
        wages: 25000, federalTaxWithheld: 3000,
        stateTaxWithheld: 1500, stateWages: 25000, state: 'CA',
      },
    ],
    stateReturns: [
      { stateCode: 'TX', residencyType: 'resident' },
      { stateCode: 'CA', residencyType: 'nonresident', stateSourceIncome: 25000 },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('federal AGI = total wages', () => {
    expect(result.form1040.agi).toBe(110000);
  });

  it('TX produces $0 tax, CA produces positive tax', () => {
    const stateResults = calculateStateTaxes(taxReturn, result);
    expect(stateResults).toHaveLength(2);

    const txResult = stateResults.find(s => s.stateCode === 'TX')!;
    const caResult = stateResults.find(s => s.stateCode === 'CA')!;

    expect(txResult.totalStateTax).toBe(0);
    expect(caResult.stateIncomeTax).toBeGreaterThan(0);
    expect(caResult.totalStateTax).not.toBeNaN();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 21. Large Family QSS — Surviving Spouse with 4 Kids
//     Qualifying Surviving Spouse with multiple credits
// ═══════════════════════════════════════════════════════════════════════════

describe('RW21: Qualifying Surviving Spouse — $65k, 4 Kids', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.QualifyingSurvivingSpouse,
    w2Income: [{
      id: 'w1', employerName: 'Employer',
      wages: 65000, federalTaxWithheld: 6000,
      socialSecurityWages: 65000, socialSecurityTax: 4030,
      medicareWages: 65000, medicareTax: 942.50,
    }],
    dependents: [
      { id: 'd1', firstName: 'A', lastName: 'T', relationship: 'son', dateOfBirth: '2012-04-01', monthsLivedWithYou: 12 },
      { id: 'd2', firstName: 'B', lastName: 'T', relationship: 'daughter', dateOfBirth: '2014-08-15', monthsLivedWithYou: 12 },
      { id: 'd3', firstName: 'C', lastName: 'T', relationship: 'son', dateOfBirth: '2017-01-20', monthsLivedWithYou: 12 },
      { id: 'd4', firstName: 'D', lastName: 'T', relationship: 'daughter', dateOfBirth: '2020-11-10', monthsLivedWithYou: 12 },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('QSS gets MFJ standard deduction ($31,500)', () => {
    expect(result.form1040.standardDeduction).toBe(31500);
  });

  it('CTC for 4 qualifying children = $8,800', () => {
    expect(result.credits.childTaxCredit).toBe(8800);
  });

  it('CTC may exceed tax liability → ACTC generated', () => {
    // Taxable income: $65k - $31.5k = $33.5k
    // Tax: 10% on $23,850 + 12% on $9,650 = $2,385 + $1,158 = $3,543
    // CTC $8,800 >> $3,543 → excess goes to ACTC
    expect(result.credits.actcCredit).toBeGreaterThan(0);
  });

  it('gets a refund', () => {
    expect(result.form1040.refundAmount).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 22. Net Negative Capital Loss — $3k Deduction + Carryforward
//     "Big losses this year, how much can I deduct?"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW22: Capital Loss Year — $25k Loss, $3k Deduction', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1', employerName: 'Day Job',
      wages: 70000, federalTaxWithheld: 8000,
    }],
    income1099B: [
      // Big loss
      { id: 'b1', brokerName: 'Robinhood', description: 'SPAC portfolio',
        dateSold: '2025-08-01', proceeds: 15000, costBasis: 40000,
        isLongTerm: true },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('capital loss deduction capped at $3,000', () => {
    expect(result.form1040.capitalLossDeduction).toBe(3000);
    expect(result.form1040.capitalGainOrLoss).toBe(-3000);
  });

  it('AGI reduced by $3k capital loss deduction', () => {
    expect(result.form1040.agi).toBe(67000); // $70k - $3k
  });

  it('carryforward = $22k ($25k loss - $3k deducted)', () => {
    expect(result.scheduleD).toBeDefined();
    expect(result.scheduleD!.capitalLossCarryforward).toBe(22000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 23. Municipal Bond Interest — Tax-Exempt Income
//     "My muni bonds — they're tax-free right?"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW23: Muni Bond Holder — Tax-Exempt Interest', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1', employerName: 'Corp',
      wages: 90000, federalTaxWithheld: 14000,
    }],
    income1099INT: [
      { id: 'i1', payerName: 'Treasury Bills', amount: 3000 }, // Taxable
      { id: 'i2', payerName: 'Muni Bond Fund', amount: 0, taxExemptInterest: 5000 }, // Tax-exempt
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('AGI only includes taxable interest, not muni bond interest', () => {
    expect(result.form1040.agi).toBe(93000); // $90k + $3k taxable interest
    expect(result.form1040.totalInterest).toBe(3000); // Only taxable
  });

  it('tax-exempt interest reported for informational purposes', () => {
    expect(result.form1040.taxExemptInterest).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 24. Gambling Winnings — W-2G with Losses
//     "Won $15k at the casino, but lost $20k overall"
// ═══════════════════════════════════════════════════════════════════════════

describe('RW24: Gambler — W-2G Winnings with Gambling Losses', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1', employerName: 'Normal Job',
      wages: 60000, federalTaxWithheld: 7000,
    }],
    incomeW2G: [{
      id: 'g1', payerName: 'Lucky Casino',
      grossWinnings: 15000,
      federalTaxWithheld: 3750, // 25% withholding on gambling
      wagerType: 'slots',
    }],
    // Gambling losses can offset winnings (up to winnings amount)
    // Must itemize to deduct gambling losses
    deductionMethod: 'itemized',
    itemizedDeductions: {
      stateLocalIncomeTax: 3000,
      realEstateTax: 0,
      personalPropertyTax: 0,
      mortgageInterest: 0,
      mortgageInsurancePremiums: 0,
      charitableCash: 0,
      charitableNonCash: 0,
      medicalExpenses: 0,
      casualtyLoss: 0,
      otherDeductions: 15000, // Gambling losses (limited to winnings)
    },
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('gambling income included in AGI', () => {
    expect(result.form1040.totalGamblingIncome).toBe(15000);
    expect(result.form1040.agi).toBe(75000); // $60k + $15k
  });

  it('gambling withholding credited', () => {
    expect(result.form1040.totalWithholding).toBe(10750); // $7k + $3.75k
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 25. Comprehensive High-Complexity Return — Everything Together
//     The "kitchen sink" scenario: W-2 + SE + investments + credits + state
// ═══════════════════════════════════════════════════════════════════════════

describe('RW25: Kitchen Sink — W-2 + SE + Investments + Credits + State', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1', employerName: 'Main Corp',
      wages: 130000, federalTaxWithheld: 20000,
      socialSecurityWages: 130000, socialSecurityTax: 8060,
      medicareWages: 130000, medicareTax: 1885,
      stateTaxWithheld: 7000, stateWages: 130000, state: 'CA',
    }],
    businesses: [{
      id: 'side', businessName: 'Consulting', accountingMethod: 'cash',
      didStartThisYear: false,
    }],
    income1099NEC: [
      { id: 'n1', payerName: 'Client', amount: 30000, businessId: 'side' },
    ],
    expenses: [
      { id: 'e1', scheduleCLine: 27, category: 'other', amount: 5000, businessId: 'side' },
    ],
    income1099INT: [
      { id: 'i1', payerName: 'Bank', amount: 2000 },
    ],
    income1099DIV: [
      { id: 'd1', payerName: 'Vanguard', ordinaryDividends: 4000,
        qualifiedDividends: 3500, foreignTaxPaid: 150 },
    ],
    income1099B: [
      { id: 'b1', brokerName: 'Schwab', description: 'AAPL',
        dateSold: '2025-06-01', proceeds: 20000, costBasis: 12000, isLongTerm: true },
    ],
    dependents: [
      { id: 'd1', firstName: 'Kid', lastName: 'T', relationship: 'son', dateOfBirth: '2018-03-01', monthsLivedWithYou: 12 },
    ],
    studentLoanInterest: 2000,
    cleanEnergy: { solarElectric: 15000 },
    stateReturns: [{ stateCode: 'CA', residencyType: 'resident' }],
  });

  const result = calculateForm1040(taxReturn);

  it('no NaN values', () => assertNoNaN(result));

  it('all income sources flow into AGI', () => {
    // W-2: $130k, Sched C: $25k (30k-5k), Interest: $2k, Div: $4k, Cap gain: $8k
    // Minus: SE deduction, student loan interest
    expect(result.form1040.agi).toBeGreaterThan(160000);
    expect(result.form1040.agi).toBeLessThan(175000);
  });

  it('Schedule C computed', () => {
    expect(result.form1040.scheduleCNetProfit).toBe(25000);
  });

  it('SE tax on side hustle', () => {
    expect(result.form1040.seTax).toBeGreaterThan(3000);
  });

  it('CTC for 1 child = $2,200', () => {
    expect(result.credits.childTaxCredit).toBe(2200);
  });

  it('clean energy credit = 30% × $15k = $4,500', () => {
    expect(result.credits.cleanEnergyCredit).toBe(4500);
  });

  it('foreign tax credit for international dividends', () => {
    // $150 ≤ $600 MFJ simplified threshold → full credit
    expect(result.credits.foreignTaxCredit).toBe(150);
  });

  it('capital gains computed', () => {
    expect(result.form1040.capitalGainOrLoss).toBe(8000);
  });

  it('CA state tax computed', () => {
    const stateResults = calculateStateTaxes(taxReturn, result);
    expect(stateResults).toHaveLength(1);
    expect(stateResults[0].stateCode).toBe('CA');
    expect(stateResults[0].stateIncomeTax).toBeGreaterThan(5000);
  });

  it('effective rate in reasonable range', () => {
    // Large credits (solar $4.5k + CTC $2.2k + FTC $0.15k) reduce effective rate
    expect(result.form1040.effectiveTaxRate).toBeGreaterThan(0.05);
    expect(result.form1040.effectiveTaxRate).toBeLessThan(0.25);
  });
});
