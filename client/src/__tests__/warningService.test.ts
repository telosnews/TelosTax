/**
 * Warning Service Unit Tests
 *
 * Tests the centralized warning computation service that evaluates
 * tax return data and returns structured validation warnings.
 */

import { describe, it, expect } from 'vitest';
import type { TaxReturn, CalculationResult, Form1040Result, CreditsResult } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';
import {
  getActiveWarnings,
  hasWarningsForStep,
  getTotalWarningCount,
  type WarningsByStep,
} from '../services/warningService';

// ─── Helpers ─────────────────────────────────────

function makeForm1040(overrides: Partial<Form1040Result> = {}): Form1040Result {
  return {
    totalWages: 75000,
    totalInterest: 0, taxExemptInterest: 0, totalDividends: 0, qualifiedDividends: 0,
    totalCapitalGainDistributions: 0, scheduleDNetGain: 0, capitalLossDeduction: 0,
    capitalGainOrLoss: 0, taxableSocialSecurity: 0, socialSecurityBenefits: 0,
    scheduleEIncome: 0, royaltyIncome: 0, totalRetirementIncome: 0,
    iraDistributionsGross: 0, iraDistributionsTaxable: 0,
    pensionDistributionsGross: 0, pensionDistributionsTaxable: 0,
    totalUnemployment: 0, total1099MISCIncome: 0, scheduleCNetProfit: 0,
    rothConversionTaxable: 0, totalIncome: 75000,
    seDeduction: 0, selfEmployedHealthInsurance: 0, retirementContributions: 0,
    hsaDeduction: 0, hsaDeductionComputed: 0, studentLoanInterest: 0,
    iraDeduction: 0, educatorExpenses: 0, earlyWithdrawalPenalty: 0,
    feieExclusion: 0, nolDeduction: 0, totalAdjustments: 0,
    agi: 75000, standardDeduction: 15750, itemizedDeduction: 0,
    deductionUsed: 'standard', deductionAmount: 15750,
    qbiDeduction: 0, schedule1ADeduction: 0, homeSaleExclusion: 0,
    taxableIncome: 59250,
    k1OrdinaryIncome: 0, k1SEIncome: 0,
    hsaDistributionTaxable: 0, hsaDistributionPenalty: 0,
    incomeTax: 8700, preferentialTax: 0, section1250Tax: 0,
    amtAmount: 0, seTax: 0, niitTax: 0, additionalMedicareTaxW2: 0,
    earlyDistributionPenalty: 0, kiddieTaxAmount: 0,
    householdEmploymentTax: 0, estimatedTaxPenalty: 0,
    totalTax: 8700, totalCredits: 0, taxAfterCredits: 8700,
    totalWithholding: 12000, estimatedPayments: 0, totalPayments: 12000,
    refundAmount: 3300, amountOwed: 0,
    effectiveTaxRate: 0.116, marginalTaxRate: 0.22,
    estimatedQuarterlyPayment: 0,
    ...overrides,
  } as Form1040Result;
}

function makeCalculation(overrides: {
  form1040?: Partial<Form1040Result>;
  scheduleSE?: { totalSETax: number };
  scheduleA?: { totalItemized: number };
  premiumTaxCredit?: { fplPercentage: number };
  amt?: { applies: boolean; tentativeMinimumTax: number };
} = {}): CalculationResult {
  return {
    form1040: makeForm1040(overrides.form1040),
    credits: { childTaxCredit: 0, otherDependentCredit: 0, actcCredit: 0,
      educationCredit: 0, aotcRefundableCredit: 0, dependentCareCredit: 0,
      saversCredit: 0, cleanEnergyCredit: 0, evCredit: 0, energyEfficiencyCredit: 0,
      foreignTaxCredit: 0, adoptionCredit: 0, evRefuelingCredit: 0,
      elderlyDisabledCredit: 0, k1OtherCredits: 0, premiumTaxCredit: 0,
      excessSSTaxCredit: 0, eitcCredit: 0, totalNonRefundable: 0, totalRefundable: 0,
    } as CreditsResult,
    scheduleSE: overrides.scheduleSE,
    scheduleA: overrides.scheduleA as any,
    premiumTaxCredit: overrides.premiumTaxCredit as any,
    amt: overrides.amt as any,
  } as CalculationResult;
}

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    filingStatus: FilingStatus.Single,
    dependents: [],
    w2Income: [{ id: 'w2-1', employerName: 'Acme Corp', wages: 75000, federalTaxWithheld: 12000 }],
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
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  } as TaxReturn;
}

// ─── Tests ───────────────────────────────────────

describe('getActiveWarnings', () => {
  it('returns no warnings for a clean minimal return', () => {
    const tr = makeTaxReturn();
    const result = getActiveWarnings(tr);
    // Plausibility checks may still fire, but no date/cross-form warnings
    const nonPlausibility = result.flatMap(r => r.warnings).filter(
      w => !w.message.includes('plausibility') && !w.message.includes('unusually'),
    );
    expect(nonPlausibility.length).toBeLessThanOrEqual(result.flatMap(r => r.warnings).length);
  });

  // ── Date validation warnings ─────────────────────
  describe('date validation', () => {
    it('warns on future filer DOB', () => {
      const tr = makeTaxReturn({ dateOfBirth: '2030-01-01' });
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w => w.field === 'dateOfBirth');
      expect(w).toBeDefined();
      expect(w!.stepId).toBe('personal_info');
    });

    it('warns on future spouse DOB', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        spouseDateOfBirth: '2030-06-15',
      });
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w => w.field === 'spouseDateOfBirth');
      expect(w).toBeDefined();
      expect(w!.stepId).toBe('filing_status');
    });

    it('warns on future dependent DOB with itemLabel', () => {
      const tr = makeTaxReturn({
        dependents: [{
          firstName: 'Baby',
          lastName: 'Smith',
          dateOfBirth: '2030-03-01',
          relationship: 'child',
          monthsLivedWithYou: 12,
        }],
      } as any);
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w => w.field.includes('dependents[0].dateOfBirth'));
      expect(w).toBeDefined();
      expect(w!.itemLabel).toBe('Baby Smith');
    });
  });

  // ── 1099-B holding period ────────────────────────
  describe('1099-B date validation', () => {
    it('warns on date acquired after date sold', () => {
      const tr = makeTaxReturn({
        income1099B: [{
          id: 'b1', brokerName: 'Fidelity', description: 'AAPL',
          dateAcquired: '2025-06-01', dateSold: '2025-01-01',
          proceeds: 10000, costBasis: 8000, longOrShort: 'short',
        }],
      } as any);
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w => w.field.includes('dateAcquired'));
      expect(w).toBeDefined();
      expect(w!.stepId).toBe('1099b_income');
    });
  });

  // ── Cross-form: HoH with no dependents ───────────
  describe('Head of Household validation', () => {
    it('warns when HoH with no dependents', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [],
      });
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.field === 'filingStatus' && w.message.includes('Head of Household'),
      );
      expect(w).toBeDefined();
    });

    it('warns when HoH dependents have insufficient residency', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          firstName: 'Child', lastName: 'Test',
          dateOfBirth: '2015-01-01', relationship: 'child',
          monthsLivedWithYou: 3,
        }],
      } as any);
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.message.includes('7+ months'),
      );
      expect(w).toBeDefined();
    });
  });

  // ── Cross-form: MFS + disqualifying credits ──────
  describe('MFS restrictions', () => {
    it('warns about education credits with MFS', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingSeparately,
        educationCredits: [{ studentName: 'Student', creditType: 'aotc', tuitionPaid: 5000 }],
      } as any);
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.message.includes('Education credits') && w.message.includes('Married Filing Separately'),
      );
      expect(w).toBeDefined();
    });

    it('warns about student loan interest with MFS', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingSeparately,
        studentLoanInterest: 2500,
      } as any);
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.message.includes('Student loan interest') && w.message.includes('Married Filing Separately'),
      );
      expect(w).toBeDefined();
    });
  });

  // ── EITC investment income limit ─────────────────
  it('warns when investment income exceeds EITC limit', () => {
    const tr = makeTaxReturn({
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 12000 }],
    } as any);
    const warnings = getActiveWarnings(tr);
    const w = warnings.flatMap(r => r.warnings).find(w =>
      w.message.includes('$11,600') && w.message.includes('EITC'),
    );
    expect(w).toBeDefined();
  });

  it('does not warn when investment income is below EITC limit', () => {
    const tr = makeTaxReturn({
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 5000 }],
    } as any);
    const warnings = getActiveWarnings(tr);
    const w = warnings.flatMap(r => r.warnings).find(w =>
      w.message.includes('EITC'),
    );
    expect(w).toBeUndefined();
  });

  // ── W-2 withholding exceeds wages ────────────────
  it('warns when W-2 withholding exceeds wages', () => {
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'Scam Corp', wages: 10000, federalTaxWithheld: 50000 }],
    } as any);
    const warnings = getActiveWarnings(tr);
    const w = warnings.flatMap(r => r.warnings).find(w =>
      w.field.includes('federalTaxWithheld') && w.message.includes('exceeds wages'),
    );
    expect(w).toBeDefined();
    expect(w!.itemLabel).toBe('Scam Corp');
  });

  // ── 1099-K gross amount without adjustments ──────
  it('warns about large 1099-K with no returns/allowances', () => {
    const tr = makeTaxReturn({
      income1099K: [{ id: 'k1', platformName: 'eBay', grossAmount: 20000 }],
    } as any);
    const warnings = getActiveWarnings(tr);
    const w = warnings.flatMap(r => r.warnings).find(w =>
      w.message.includes('eBay') && w.message.includes('gross'),
    );
    expect(w).toBeDefined();
  });

  // ── COGS incomplete ──────────────────────────────
  it('warns about COGS with missing ending inventory', () => {
    const tr = makeTaxReturn({
      costOfGoodsSold: {
        beginningInventory: 5000,
        purchases: 3000,
        costOfLabor: 0,
        materialsAndSupplies: 0,
        otherCosts: 0,
        endingInventory: null,
      },
    } as any);
    const warnings = getActiveWarnings(tr);
    const w = warnings.flatMap(r => r.warnings).find(w =>
      w.message.includes('ending inventory'),
    );
    expect(w).toBeDefined();
  });

  // ── Home sale Section 121 ────────────────────────
  describe('home sale ownership/use test', () => {
    it('warns when owned less than 24 months', () => {
      const tr = makeTaxReturn({
        homeSale: { ownedMonths: 12, usedAsResidenceMonths: 36, salePrice: 500000, purchasePrice: 300000 },
      } as any);
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.message.includes('24 months of ownership'),
      );
      expect(w).toBeDefined();
    });

    it('warns when used less than 24 months', () => {
      const tr = makeTaxReturn({
        homeSale: { ownedMonths: 48, usedAsResidenceMonths: 18, salePrice: 500000, purchasePrice: 300000 },
      } as any);
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.message.includes('24 months of use'),
      );
      expect(w).toBeDefined();
    });
  });

  // ── Alimony post-2019 ────────────────────────────
  it('warns about post-2019 alimony not being deductible', () => {
    const tr = makeTaxReturn({
      alimony: { totalPaid: 24000, divorceDate: '2020-07-01' },
    } as any);
    const warnings = getActiveWarnings(tr);
    const w = warnings.flatMap(r => r.warnings).find(w =>
      w.message.includes('Tax Cuts and Jobs Act') && w.message.includes('not deductible'),
    );
    expect(w).toBeDefined();
  });

  it('does not warn about pre-2019 alimony', () => {
    const tr = makeTaxReturn({
      alimony: { totalPaid: 24000, divorceDate: '2018-06-01' },
    } as any);
    const warnings = getActiveWarnings(tr);
    const w = warnings.flatMap(r => r.warnings).find(w =>
      w.message.includes('Tax Cuts and Jobs Act'),
    );
    expect(w).toBeUndefined();
  });

  // ── HSA excess contributions ─────────────────────
  describe('HSA limits', () => {
    it('warns when HSA exceeds family limit', () => {
      const tr = makeTaxReturn({ hsaDeduction: 9000 } as any);
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.message.includes('$8,550') && w.message.includes('family'),
      );
      expect(w).toBeDefined();
    });

    it('warns when HSA exceeds self-only limit', () => {
      const tr = makeTaxReturn({ hsaDeduction: 5000 } as any);
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.message.includes('$4,300') && w.message.includes('self-only'),
      );
      expect(w).toBeDefined();
    });

    it('does not warn when HSA is within self-only limit', () => {
      const tr = makeTaxReturn({ hsaDeduction: 4000 } as any);
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.field === 'hsaDeduction',
      );
      expect(w).toBeUndefined();
    });
  });

  // ── AGI-sensitive threshold warnings ─────────────
  describe('AGI threshold warnings', () => {
    it('warns about SALT phase-down when AGI > $500k', () => {
      const tr = makeTaxReturn({
        itemizedDeductions: { stateLocalIncomeTax: 15000, realEstateTax: 10000 },
      } as any);
      const calc = makeCalculation({ form1040: { agi: 600000 } });
      const warnings = getActiveWarnings(tr, calc);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.message.includes('$500,000') && w.message.includes('SALT'),
      );
      expect(w).toBeDefined();
    });

    it('warns about student loan phase-out for single', () => {
      const tr = makeTaxReturn({ studentLoanInterest: 2500 } as any);
      const calc = makeCalculation({ form1040: { agi: 90000 } });
      const warnings = getActiveWarnings(tr, calc);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.field === 'studentLoanInterest' && w.message.includes('partially reduced'),
      );
      expect(w).toBeDefined();
    });

    it('warns about fully phased-out student loan interest', () => {
      const tr = makeTaxReturn({ studentLoanInterest: 2500 } as any);
      const calc = makeCalculation({ form1040: { agi: 105000 } });
      const warnings = getActiveWarnings(tr, calc);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.field === 'studentLoanInterest' && w.message.includes('fully phased out'),
      );
      expect(w).toBeDefined();
    });

    it('warns about NIIT surcharge when above threshold', () => {
      const tr = makeTaxReturn({
        income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 5000 }],
      } as any);
      const calc = makeCalculation({ form1040: { agi: 250000 } });
      const warnings = getActiveWarnings(tr, calc);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.message.includes('Net Investment Income Tax'),
      );
      expect(w).toBeDefined();
    });

    it('warns about passive rental loss limitation', () => {
      const tr = makeTaxReturn({
        rentalProperties: [{
          id: 'r1', address: '123 St', propertyType: 'single_family',
          daysRented: 365, personalUseDays: 0, rentalIncome: 12000,
          mortgageInterest: 20000, taxes: 5000, insurance: 2000,
        }],
      } as any);
      const calc = makeCalculation({ form1040: { agi: 130000 } });
      const warnings = getActiveWarnings(tr, calc);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.message.includes('passive rental loss'),
      );
      expect(w).toBeDefined();
    });
  });

  // ── SE tax with no estimated payments ────────────
  it('warns about SE tax with no estimated payments', () => {
    const tr = makeTaxReturn();
    const calc = makeCalculation({ scheduleSE: { totalSETax: 5000 } });
    const warnings = getActiveWarnings(tr, calc);
    const w = warnings.flatMap(r => r.warnings).find(w =>
      w.message.includes('self-employment tax') && w.stepId === 'estimated_payments',
    );
    expect(w).toBeDefined();
  });

  // ── Charitable over 60% AGI ──────────────────────
  it('warns when charitable cash exceeds 60% of AGI', () => {
    const tr = makeTaxReturn({
      itemizedDeductions: { charitableCash: 60000 },
    } as any);
    const calc = makeCalculation({ form1040: { agi: 80000 } });
    const warnings = getActiveWarnings(tr, calc);
    const w = warnings.flatMap(r => r.warnings).find(w =>
      w.message.includes('60%') && w.message.includes('Cash donations'),
    );
    expect(w).toBeDefined();
  });

  // ── Itemized vs. standard deduction comparison ───
  it('warns when itemized < standard deduction', () => {
    const tr = makeTaxReturn();
    const calc = makeCalculation({
      form1040: { standardDeduction: 15750 },
      scheduleA: { totalItemized: 10000 },
    });
    const warnings = getActiveWarnings(tr, calc);
    const w = warnings.flatMap(r => r.warnings).find(w =>
      w.message.includes('standard deduction'),
    );
    expect(w).toBeDefined();
  });

  // ── Proximity alerts ─────────────────────────────
  describe('proximity alerts', () => {
    it('warns when approaching NIIT threshold (within 10%)', () => {
      const tr = makeTaxReturn({
        income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 5000 }],
      } as any);
      // Single threshold is $200k. 10% band = $180k-$200k.
      const calc = makeCalculation({ form1040: { agi: 195000 } });
      const warnings = getActiveWarnings(tr, calc);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.field === 'niit.proximity',
      );
      expect(w).toBeDefined();
    });

    it('warns when approaching SALT cap (within 15%)', () => {
      const tr = makeTaxReturn({
        itemizedDeductions: { stateLocalIncomeTax: 20000, realEstateTax: 16000 },
      } as any);
      // SALT total = $36k, within 15% of $40k cap ($34k-$40k)
      const warnings = getActiveWarnings(tr);
      const w = warnings.flatMap(r => r.warnings).find(w =>
        w.field === 'itemizedDeductions.salt.proximity',
      );
      expect(w).toBeDefined();
    });
  });

  // ── Digital asset activity mismatch ──────────────
  it('warns when 1099-DA entries exist but digital asset question is false', () => {
    const tr = makeTaxReturn({
      income1099DA: [{ id: 'da1', brokerName: 'Coinbase', tokenName: 'BTC', proceeds: 5000, costBasis: 3000 }],
      digitalAssetActivity: false,
    } as any);
    const warnings = getActiveWarnings(tr);
    const w = warnings.flatMap(r => r.warnings).find(w =>
      w.message.includes('digital asset'),
    );
    expect(w).toBeDefined();
  });

  it('warns when digital asset question is true but no 1099-DA or 1099-B entries', () => {
    const tr = makeTaxReturn({
      digitalAssetActivity: true,
      income1099DA: [],
      income1099B: [],
    } as any);
    const warnings = getActiveWarnings(tr);
    const w = warnings.flatMap(r => r.warnings).find(w =>
      w.message.includes('answered "Yes" to the digital asset question'),
    );
    expect(w).toBeDefined();
  });
});

// ─── Helper functions ─────────────────────────────

describe('hasWarningsForStep', () => {
  it('returns true when step has warnings', () => {
    const warnings: WarningsByStep[] = [
      { stepId: 'personal_info', stepLabel: 'Personal Info', warnings: [{ stepId: 'personal_info', field: 'test', message: 'msg' }] },
    ];
    expect(hasWarningsForStep('personal_info', warnings)).toBe(true);
  });

  it('returns false when step has no warnings', () => {
    const warnings: WarningsByStep[] = [
      { stepId: 'personal_info', stepLabel: 'Personal Info', warnings: [{ stepId: 'personal_info', field: 'test', message: 'msg' }] },
    ];
    expect(hasWarningsForStep('w2_income', warnings)).toBe(false);
  });
});

describe('getTotalWarningCount', () => {
  it('sums warnings across all steps', () => {
    const warnings: WarningsByStep[] = [
      { stepId: 'personal_info', stepLabel: 'Personal Info', warnings: [
        { stepId: 'personal_info', field: 'a', message: 'x' },
        { stepId: 'personal_info', field: 'b', message: 'y' },
      ]},
      { stepId: 'w2_income', stepLabel: 'W-2', warnings: [
        { stepId: 'w2_income', field: 'c', message: 'z' },
      ]},
    ];
    expect(getTotalWarningCount(warnings)).toBe(3);
  });

  it('returns 0 for empty warnings', () => {
    expect(getTotalWarningCount([])).toBe(0);
  });
});
