/**
 * Suggestion Service Unit Tests
 *
 * Tests the proactive suggestion service that recommends unclaimed
 * credits and deductions based on tax return data.
 */

import { describe, it, expect } from 'vitest';
import type { TaxReturn, CalculationResult, Form1040Result, CreditsResult } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';
import {
  getSuggestions,
  getCreditSuggestions,
  getDeductionSuggestions,
} from '../services/suggestionService';

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
} = {}): CalculationResult {
  return {
    form1040: makeForm1040(overrides.form1040),
    credits: {} as CreditsResult,
    scheduleSE: overrides.scheduleSE,
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
    w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 75000, federalTaxWithheld: 12000 }],
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

describe('getSuggestions', () => {
  // ── CTC / Other Dependent Credit ─────────────────
  describe('Child Tax Credit', () => {
    it('suggests CTC when qualifying children exist and credit unclaimed', () => {
      const tr = makeTaxReturn({
        dependents: [{
          firstName: 'Child', lastName: 'Test',
          dateOfBirth: '2015-06-15', // age 10 in 2025
          relationship: 'child',
          monthsLivedWithYou: 12,
        }],
        incomeDiscovery: {},
      } as any);
      const suggestions = getSuggestions(tr);
      const ctc = suggestions.find(s => s.id === 'ctc');
      expect(ctc).toBeDefined();
      expect(ctc!.type).toBe('credit');
      expect(ctc!.confidence).toBe('high');
      expect(ctc!.estimatedBenefit).toBe(2200);
    });

    it('estimates benefit for multiple qualifying children + other dependents', () => {
      const tr = makeTaxReturn({
        dependents: [
          { firstName: 'Kid1', lastName: 'T', dateOfBirth: '2012-01-01', relationship: 'child', monthsLivedWithYou: 12 },
          { firstName: 'Kid2', lastName: 'T', dateOfBirth: '2014-03-01', relationship: 'child', monthsLivedWithYou: 12 },
          { firstName: 'Parent', lastName: 'T', dateOfBirth: '1960-01-01', relationship: 'parent', monthsLivedWithYou: 12 },
        ],
        incomeDiscovery: {},
      } as any);
      const suggestions = getSuggestions(tr);
      const ctc = suggestions.find(s => s.id === 'ctc');
      expect(ctc).toBeDefined();
      // 2 children × $2,200 + 1 other dependent × $500 = $4,900
      expect(ctc!.estimatedBenefit).toBe(4900);
    });

    it('suggests Other Dependent Credit when only non-qualifying children', () => {
      const tr = makeTaxReturn({
        dependents: [{
          firstName: 'Adult', lastName: 'Child',
          dateOfBirth: '2005-01-01', // age 20 in 2025
          relationship: 'child',
          monthsLivedWithYou: 12,
        }],
        incomeDiscovery: {},
      } as any);
      const suggestions = getSuggestions(tr);
      const odc = suggestions.find(s => s.id === 'odc');
      expect(odc).toBeDefined();
      expect(odc!.estimatedBenefit).toBe(500);
    });

    it('does not suggest CTC when already claimed', () => {
      const tr = makeTaxReturn({
        dependents: [{ firstName: 'Kid', lastName: 'T', dateOfBirth: '2015-01-01', relationship: 'child', monthsLivedWithYou: 12 }],
        incomeDiscovery: { child_credit: 'yes' },
      } as any);
      const suggestions = getSuggestions(tr);
      expect(suggestions.find(s => s.id === 'ctc')).toBeUndefined();
    });

    it('does not suggest CTC when explicitly declined', () => {
      const tr = makeTaxReturn({
        dependents: [{ firstName: 'Kid', lastName: 'T', dateOfBirth: '2015-01-01', relationship: 'child', monthsLivedWithYou: 12 }],
        incomeDiscovery: { child_credit: 'no' },
      } as any);
      const suggestions = getSuggestions(tr);
      expect(suggestions.find(s => s.id === 'ctc')).toBeUndefined();
    });

    it('does not suggest CTC when no dependents', () => {
      const suggestions = getSuggestions(makeTaxReturn());
      expect(suggestions.find(s => s.id === 'ctc')).toBeUndefined();
    });
  });

  // ── Dependent Care Credit ────────────────────────
  describe('Dependent Care Credit', () => {
    it('suggests when young children + earned income', () => {
      const tr = makeTaxReturn({
        dependents: [{ firstName: 'Toddler', lastName: 'T', dateOfBirth: '2022-01-01', relationship: 'child', monthsLivedWithYou: 12 }],
        incomeDiscovery: {},
      } as any);
      const suggestions = getSuggestions(tr);
      const dc = suggestions.find(s => s.id === 'dependent_care');
      expect(dc).toBeDefined();
      expect(dc!.confidence).toBe('medium');
    });

    it('does not suggest when children are too old', () => {
      const tr = makeTaxReturn({
        dependents: [{ firstName: 'Teen', lastName: 'T', dateOfBirth: '2010-01-01', relationship: 'child', monthsLivedWithYou: 12 }],
        incomeDiscovery: {},
      } as any);
      const suggestions = getSuggestions(tr);
      expect(suggestions.find(s => s.id === 'dependent_care')).toBeUndefined();
    });

    it('does not suggest when no earned income', () => {
      const tr = makeTaxReturn({
        w2Income: [],
        dependents: [{ firstName: 'Baby', lastName: 'T', dateOfBirth: '2023-01-01', relationship: 'child', monthsLivedWithYou: 12 }],
        incomeDiscovery: {},
      } as any);
      const suggestions = getSuggestions(tr);
      expect(suggestions.find(s => s.id === 'dependent_care')).toBeUndefined();
    });
  });

  // ── Elderly/Disabled Credit ──────────────────────
  describe('Credit for the Elderly or Disabled', () => {
    it('suggests when filer is 65+', () => {
      const tr = makeTaxReturn({
        dateOfBirth: '1958-01-01', // age 67 in 2025
        incomeDiscovery: {},
      } as any);
      const suggestions = getSuggestions(tr);
      const ed = suggestions.find(s => s.id === 'elderly_disabled');
      expect(ed).toBeDefined();
      expect(ed!.confidence).toBe('high');
    });

    it('suggests when spouse is 65+', () => {
      const tr = makeTaxReturn({
        dateOfBirth: '1985-01-01',
        spouseDateOfBirth: '1955-01-01', // age 70 in 2025
        incomeDiscovery: {},
      } as any);
      const suggestions = getSuggestions(tr);
      expect(suggestions.find(s => s.id === 'elderly_disabled')).toBeDefined();
    });

    it('does not suggest when under 65', () => {
      const tr = makeTaxReturn({
        dateOfBirth: '1985-01-01',
        incomeDiscovery: {},
      } as any);
      const suggestions = getSuggestions(tr);
      expect(suggestions.find(s => s.id === 'elderly_disabled')).toBeUndefined();
    });
  });

  // ── Saver's Credit ──────────────────────────────
  describe("Saver's Credit", () => {
    it('suggests when IRA contribution and AGI below threshold', () => {
      const tr = makeTaxReturn({
        iraContribution: 3000,
        incomeDiscovery: {},
      } as any);
      const calc = makeCalculation({ form1040: { agi: 20000 } });
      const suggestions = getSuggestions(tr, calc);
      const sc = suggestions.find(s => s.id === 'savers_credit');
      expect(sc).toBeDefined();
      expect(sc!.confidence).toBe('high');
      // AGI $20k Single → 50% rate. Eligible = min($3k, $2k) = $2k. Benefit = $1,000.
      expect(sc!.estimatedBenefit).toBe(1000);
    });

    it('does not suggest when AGI above threshold', () => {
      const tr = makeTaxReturn({
        iraContribution: 3000,
        incomeDiscovery: {},
      } as any);
      const calc = makeCalculation({ form1040: { agi: 50000 } });
      const suggestions = getSuggestions(tr, calc);
      expect(suggestions.find(s => s.id === 'savers_credit')).toBeUndefined();
    });
  });

  // ── Education Credits ────────────────────────────
  describe('Education Credits', () => {
    it('suggests when college-age dependents exist', () => {
      const tr = makeTaxReturn({
        dependents: [{ firstName: 'Student', lastName: 'T', dateOfBirth: '2005-06-01', relationship: 'child', monthsLivedWithYou: 12 }],
        incomeDiscovery: {},
      } as any);
      const suggestions = getSuggestions(tr);
      const ec = suggestions.find(s => s.id === 'education_credit');
      expect(ec).toBeDefined();
      expect(ec!.confidence).toBe('medium');
    });

    it('does not suggest for MFS filers', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingSeparately,
        dependents: [{ firstName: 'Student', lastName: 'T', dateOfBirth: '2005-06-01', relationship: 'child', monthsLivedWithYou: 12 }],
        incomeDiscovery: {},
      } as any);
      const suggestions = getSuggestions(tr);
      expect(suggestions.find(s => s.id === 'education_credit')).toBeUndefined();
    });

    it('does not suggest when dependent is too young', () => {
      const tr = makeTaxReturn({
        dependents: [{ firstName: 'Kid', lastName: 'T', dateOfBirth: '2012-01-01', relationship: 'child', monthsLivedWithYou: 12 }],
        incomeDiscovery: {},
      } as any);
      const suggestions = getSuggestions(tr);
      expect(suggestions.find(s => s.id === 'education_credit')).toBeUndefined();
    });
  });

  // ── Estimated Payments ───────────────────────────
  it('suggests estimated payments when SE tax owed', () => {
    const tr = makeTaxReturn({ incomeDiscovery: {} });
    const calc = makeCalculation({ scheduleSE: { totalSETax: 5000 } });
    const suggestions = getSuggestions(tr, calc);
    const ep = suggestions.find(s => s.id === 'estimated_payments');
    expect(ep).toBeDefined();
    expect(ep!.type).toBe('deduction');
    expect(ep!.confidence).toBe('high');
  });

  // ── HSA Deduction ────────────────────────────────
  it('suggests HSA when self-employed with no HSA', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000 }],
      incomeDiscovery: {},
    } as any);
    const suggestions = getSuggestions(tr);
    const hsa = suggestions.find(s => s.id === 'hsa');
    expect(hsa).toBeDefined();
    expect(hsa!.type).toBe('deduction');
  });

  it('does not suggest HSA when HSA already entered', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000 }],
      hsaDeduction: 4000,
      incomeDiscovery: {},
    } as any);
    const suggestions = getSuggestions(tr);
    expect(suggestions.find(s => s.id === 'hsa')).toBeUndefined();
  });

  // ── Student Loan Interest ────────────────────────
  it('suggests student loan interest for working adults 22-45', () => {
    const tr = makeTaxReturn({
      dateOfBirth: '1995-01-01', // age 30 in 2025
      incomeDiscovery: {},
    } as any);
    const calc = makeCalculation({ form1040: { agi: 60000 } });
    const suggestions = getSuggestions(tr, calc);
    const sl = suggestions.find(s => s.id === 'student_loan');
    expect(sl).toBeDefined();
    expect(sl!.type).toBe('deduction');
  });

  it('does not suggest student loan interest for older adults', () => {
    const tr = makeTaxReturn({
      dateOfBirth: '1970-01-01', // age 55 in 2025
      incomeDiscovery: {},
    } as any);
    const calc = makeCalculation({ form1040: { agi: 60000 } });
    const suggestions = getSuggestions(tr, calc);
    expect(suggestions.find(s => s.id === 'student_loan')).toBeUndefined();
  });

  it('does not suggest student loan when AGI above phase-out', () => {
    const tr = makeTaxReturn({
      dateOfBirth: '1995-01-01',
      incomeDiscovery: {},
    } as any);
    const calc = makeCalculation({ form1040: { agi: 120000 } });
    const suggestions = getSuggestions(tr, calc);
    expect(suggestions.find(s => s.id === 'student_loan')).toBeUndefined();
  });
});

// ─── Filter helpers ──────────────────────────────

describe('getCreditSuggestions', () => {
  it('filters to credit type only', () => {
    const all = [
      { id: 'ctc', type: 'credit' as const, title: 'CTC', description: '', discoveryKey: 'child_credit', stepId: 'child_tax_credit', confidence: 'high' as const },
      { id: 'hsa', type: 'deduction' as const, title: 'HSA', description: '', discoveryKey: 'ded_hsa', stepId: 'adjustments', confidence: 'medium' as const },
    ];
    expect(getCreditSuggestions(all)).toHaveLength(1);
    expect(getCreditSuggestions(all)[0].id).toBe('ctc');
  });
});

describe('getDeductionSuggestions', () => {
  it('filters to deduction type only', () => {
    const all = [
      { id: 'ctc', type: 'credit' as const, title: 'CTC', description: '', discoveryKey: 'child_credit', stepId: 'child_tax_credit', confidence: 'high' as const },
      { id: 'hsa', type: 'deduction' as const, title: 'HSA', description: '', discoveryKey: 'ded_hsa', stepId: 'adjustments', confidence: 'medium' as const },
    ];
    expect(getDeductionSuggestions(all)).toHaveLength(1);
    expect(getDeductionSuggestions(all)[0].id).toBe('hsa');
  });
});
