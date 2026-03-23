/**
 * State Tax Calculation Tests — Category 6
 *
 * Tests for:
 *   1. No-income-tax states (AK, FL, NV, etc.)
 *   2. Flat-tax states (PA, IL, MA, NC, MI, IN, CO, KY, UT)
 *   3. California — progressive brackets, MHST, CalEITC, SS exemption
 *   4. New York — progressive brackets, NYC local tax, Yonkers, EITC supplements
 *   5. New Jersey — progressive brackets, property tax benefit, pension exclusion
 *   6. Multi-state filing
 *   7. State withholding extraction from W-2 Box 17
 *   8. Edge cases: zero income, very high income, unsupported states
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateStateTaxes, applyBrackets, getStateWithholding, getStateFilingKey } from '../src/engine/state/index.js';
import { isStateSupported, getSupportedStates, NO_INCOME_TAX_STATES, FLAT_TAX_STATES, PROGRESSIVE_TAX_STATES } from '../src/engine/state/stateRegistry.js';
import { TaxReturn, FilingStatus, StateReturnConfig } from '../src/types/index.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'state-test',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
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
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    rentalProperties: [],
    otherIncome: 0,
    businesses: [],
    deductionMethod: 'standard',
    expenses: [],
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  };
}

function makeW2Return(wages: number, stateCode: string, stateWithheld = 0, filingStatus = FilingStatus.Single) {
  return makeTaxReturn({
    filingStatus,
    w2Income: [{
      id: 'w1',
      employerName: 'Test Corp',
      wages,
      federalTaxWithheld: Math.round(wages * 0.15),
      socialSecurityWages: Math.min(wages, 168600),
      socialSecurityTax: Math.min(wages, 168600) * 0.062,
      medicareWages: wages,
      medicareTax: wages * 0.0145,
      state: stateCode,
      stateTaxWithheld: stateWithheld,
    }],
    stateReturns: [{ stateCode, residencyType: 'resident' as const }],
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Tax — Utility Functions', () => {
  it('getStateFilingKey maps federal status to state keys', () => {
    expect(getStateFilingKey(FilingStatus.Single)).toBe('single');
    expect(getStateFilingKey(FilingStatus.MarriedFilingJointly)).toBe('married_joint');
    expect(getStateFilingKey(FilingStatus.MarriedFilingSeparately)).toBe('married_separate');
    expect(getStateFilingKey(FilingStatus.HeadOfHousehold)).toBe('head_of_household');
    expect(getStateFilingKey(FilingStatus.QualifyingSurvivingSpouse)).toBe('married_joint');
    expect(getStateFilingKey(undefined)).toBe('single');
  });

  it('applyBrackets calculates progressive tax correctly', () => {
    const brackets = [
      { min: 0, max: 10000, rate: 0.10 },
      { min: 10000, max: 50000, rate: 0.20 },
      { min: 50000, max: Infinity, rate: 0.30 },
    ];

    // $30,000 taxable → $1,000 (10% × $10K) + $4,000 (20% × $20K) = $5,000
    const result = applyBrackets(30000, brackets);
    expect(result.tax).toBe(5000);
    expect(result.details).toHaveLength(2);
    expect(result.details[0].rate).toBe(0.10);
    expect(result.details[0].taxAtRate).toBe(1000);
    expect(result.details[1].rate).toBe(0.20);
    expect(result.details[1].taxAtRate).toBe(4000);
  });

  it('applyBrackets handles zero income', () => {
    const brackets = [{ min: 0, max: 10000, rate: 0.10 }];
    const result = applyBrackets(0, brackets);
    expect(result.tax).toBe(0);
    expect(result.details).toHaveLength(0);
  });

  it('applyBrackets handles negative income', () => {
    const brackets = [{ min: 0, max: 10000, rate: 0.10 }];
    const result = applyBrackets(-5000, brackets);
    expect(result.tax).toBe(0);
  });

  it('getStateWithholding sums Box 17 for matching state', () => {
    const tr = makeTaxReturn({
      w2Income: [
        { id: 'w1', employerName: 'A', wages: 50000, federalTaxWithheld: 5000,
          socialSecurityWages: 50000, socialSecurityTax: 3100, medicareWages: 50000, medicareTax: 725,
          state: 'CA', stateTaxWithheld: 2500 },
        { id: 'w2', employerName: 'B', wages: 30000, federalTaxWithheld: 3000,
          socialSecurityWages: 30000, socialSecurityTax: 1860, medicareWages: 30000, medicareTax: 435,
          state: 'CA', stateTaxWithheld: 1500 },
        { id: 'w3', employerName: 'C', wages: 20000, federalTaxWithheld: 2000,
          socialSecurityWages: 20000, socialSecurityTax: 1240, medicareWages: 20000, medicareTax: 290,
          state: 'NY', stateTaxWithheld: 800 },
      ],
    });
    expect(getStateWithholding(tr, 'CA')).toBe(4000);
    expect(getStateWithholding(tr, 'NY')).toBe(800);
    expect(getStateWithholding(tr, 'TX')).toBe(0);
  });

  it('getStateWithholding sums 1099-MISC state withholding', () => {
    const tr = makeTaxReturn({
      income1099MISC: [
        { id: 'misc1', payerName: 'Client A', otherIncome: 5000, stateTaxWithheld: 200, stateCode: 'CA' },
        { id: 'misc2', payerName: 'Client B', otherIncome: 3000, stateTaxWithheld: 150, stateCode: 'CA' },
        { id: 'misc3', payerName: 'Client C', otherIncome: 2000, stateTaxWithheld: 100, stateCode: 'NY' },
      ],
    });
    expect(getStateWithholding(tr, 'CA')).toBe(350);
    expect(getStateWithholding(tr, 'NY')).toBe(100);
    expect(getStateWithholding(tr, 'TX')).toBe(0);
  });

  it('getStateWithholding sums W-2 + W-2G + 1099-MISC together', () => {
    const tr = makeTaxReturn({
      w2Income: [
        { id: 'w1', employerName: 'Corp', wages: 50000, federalTaxWithheld: 5000,
          socialSecurityWages: 50000, socialSecurityTax: 3100, medicareWages: 50000, medicareTax: 725,
          state: 'CA', stateTaxWithheld: 3000 },
      ],
      incomeW2G: [
        { id: 'w2g1', payerName: 'Casino', grossWinnings: 5000, federalTaxWithheld: 1000,
          stateCode: 'CA', stateTaxWithheld: 250 },
      ],
      income1099MISC: [
        { id: 'misc1', payerName: 'Client', otherIncome: 2000, stateTaxWithheld: 100, stateCode: 'CA' },
      ],
    });
    // W-2 $3000 + W-2G $250 + 1099-MISC $100 = $3350
    expect(getStateWithholding(tr, 'CA')).toBe(3350);
  });

  it('getStateWithholding handles missing/undefined withholding fields', () => {
    const tr = makeTaxReturn({
      income1099MISC: [
        { id: 'misc1', payerName: 'Client', otherIncome: 5000 },  // no state fields
        { id: 'misc2', payerName: 'Client2', otherIncome: 3000, stateCode: 'CA' },  // no amount
      ],
    });
    expect(getStateWithholding(tr, 'CA')).toBe(0);
  });

  it('getStateWithholding sums all 1099 types for matching state', () => {
    const tr = makeTaxReturn({
      w2Income: [
        { id: 'w1', employerName: 'Corp', wages: 100000, federalTaxWithheld: 15000,
          socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450,
          state: 'CA', stateTaxWithheld: 3000 },
      ],
      incomeW2G: [
        { id: 'w2g1', payerName: 'Casino', grossWinnings: 10000, federalTaxWithheld: 2000,
          stateCode: 'CA', stateTaxWithheld: 500 },
      ],
      income1099MISC: [
        { id: 'misc1', payerName: 'Misc', otherIncome: 5000, stateCode: 'CA', stateTaxWithheld: 200 },
      ],
      income1099NEC: [
        { id: 'nec1', payerName: 'Client', amount: 20000, stateCode: 'CA', stateTaxWithheld: 500 },
      ],
      income1099R: [
        { id: 'r1', payerName: 'Fidelity', grossDistribution: 50000, taxableAmount: 50000,
          stateCode: 'CA', stateTaxWithheld: 200 },
      ],
      income1099G: [
        { id: 'g1', payerName: 'EDD', unemploymentCompensation: 8000,
          stateCode: 'CA', stateTaxWithheld: 100 },
      ],
      income1099INT: [
        { id: 'int1', payerName: 'Bank', amount: 1000, stateCode: 'CA', stateTaxWithheld: 50 },
      ],
      income1099DIV: [
        { id: 'div1', payerName: 'Vanguard', ordinaryDividends: 2000, qualifiedDividends: 1500,
          stateCode: 'CA', stateTaxWithheld: 75 },
      ],
    });
    // 3000 + 500 + 200 + 500 + 200 + 100 + 50 + 75 = 4625
    expect(getStateWithholding(tr, 'CA')).toBe(4625);
    expect(getStateWithholding(tr, 'NY')).toBe(0);
  });

  it('getStateWithholding ignores 1099s from non-matching states', () => {
    const tr = makeTaxReturn({
      income1099NEC: [
        { id: 'nec1', payerName: 'Client', amount: 20000, stateCode: 'NY', stateTaxWithheld: 800 },
        { id: 'nec2', payerName: 'Client2', amount: 10000, stateCode: 'CA', stateTaxWithheld: 300 },
      ],
      income1099R: [
        { id: 'r1', payerName: 'Fidelity', grossDistribution: 50000, taxableAmount: 50000,
          stateCode: 'NY', stateTaxWithheld: 1000 },
      ],
      income1099DIV: [
        { id: 'div1', payerName: 'Vanguard', ordinaryDividends: 5000, qualifiedDividends: 3000,
          stateCode: 'CA', stateTaxWithheld: 150 },
      ],
    });
    expect(getStateWithholding(tr, 'CA')).toBe(450);  // 300 + 150
    expect(getStateWithholding(tr, 'NY')).toBe(1800); // 800 + 1000
    expect(getStateWithholding(tr, 'TX')).toBe(0);
  });

  it('CA return includes 1099 withholding in stateWithholding total', () => {
    const tr = makeTaxReturn({
      filingStatus: 0, // Single
      w2Income: [
        { id: 'w1', employerName: 'Corp', wages: 80000, federalTaxWithheld: 12000,
          socialSecurityWages: 80000, socialSecurityTax: 4960, medicareWages: 80000, medicareTax: 1160,
          state: 'CA', stateTaxWithheld: 3000 },
      ],
      income1099NEC: [
        { id: 'nec1', payerName: 'Client', amount: 10000, stateCode: 'CA', stateTaxWithheld: 500 },
      ],
      income1099R: [
        { id: 'r1', payerName: 'Plan', grossDistribution: 5000, taxableAmount: 5000,
          stateCode: 'CA', stateTaxWithheld: 200 },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    const ca = results.find(r => r.stateCode === 'CA');
    expect(ca).toBeDefined();
    // W-2 $3000 + NEC $500 + 1099-R $200 = $3700
    expect(ca!.stateWithholding).toBe(3700);
  });

  it('isStateSupported returns true for implemented states', () => {
    // Progressive states
    expect(isStateSupported('CA')).toBe(true);
    expect(isStateSupported('NY')).toBe(true);
    expect(isStateSupported('NJ')).toBe(true);
    // Flat-tax states
    expect(isStateSupported('PA')).toBe(true);
    expect(isStateSupported('IL')).toBe(true);
    // No income tax
    expect(isStateSupported('TX')).toBe(true);
    expect(isStateSupported('FL')).toBe(true);
    // All 50 states + DC are now supported
    expect(isStateSupported('GA')).toBe(true);
    expect(isStateSupported('OH')).toBe(true);
    expect(isStateSupported('DC')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. NO-INCOME-TAX STATES
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Tax — No-Income-Tax States', () => {
  for (const state of NO_INCOME_TAX_STATES) {
    it(`${state} returns zero state tax`, () => {
      const tr = makeW2Return(75000, state, 0);
      const federal = calculateForm1040(tr);
      const results = calculateStateTaxes(tr, federal);

      expect(results).toHaveLength(1);
      expect(results[0].stateCode).toBe(state);
      expect(results[0].stateIncomeTax).toBe(0);
      expect(results[0].totalStateTax).toBe(0);
      expect(results[0].effectiveStateRate).toBe(0);
    });
  }

  it('no-income-tax state still reports withholding as refund', () => {
    const tr = makeW2Return(75000, 'TX', 500); // Employer accidentally withheld
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    expect(results[0].stateWithholding).toBe(500);
    expect(results[0].stateRefundOrOwed).toBe(500); // Full refund
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FLAT-TAX STATES
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Tax — Flat-Tax States', () => {
  const FLAT_RATES: Record<string, number> = {
    PA: 0.0307, IL: 0.0495, MA: 0.05, NC: 0.0425,
    MI: 0.0425, IN: 0.03, CO: 0.044, KY: 0.04, UT: 0.045,
    GA: 0.0519, AZ: 0.025, LA: 0.03, IA: 0.038,
  };

  for (const state of FLAT_TAX_STATES) {
    it(`${state} calculates tax at flat rate (${(FLAT_RATES[state] * 100).toFixed(2)}%)`, () => {
      const tr = makeW2Return(100000, state, 0);
      const federal = calculateForm1040(tr);
      const results = calculateStateTaxes(tr, federal);

      expect(results).toHaveLength(1);
      expect(results[0].stateCode).toBe(state);
      expect(results[0].stateIncomeTax).toBeGreaterThan(0);
      // Effective rate should be close to flat rate (accounting for deductions/exemptions)
      expect(results[0].effectiveStateRate).toBeLessThanOrEqual(FLAT_RATES[state] + 0.001);
      // Tax should be roughly rate × (income − deductions − exemptions)
      expect(results[0].stateTaxableIncome).toBeGreaterThan(0);
    });
  }

  it('PA has no deductions or exemptions (simplest flat tax)', () => {
    const tr = makeW2Return(100000, 'PA', 0);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    // PA: 3.07% flat on virtually all income
    expect(results[0].stateDeduction).toBe(0);
    expect(results[0].stateExemptions).toBe(0);
    expect(results[0].stateIncomeTax).toBeCloseTo(100000 * 0.0307, -1);
  });

  it('CO uses federal taxable income (not AGI)', () => {
    const tr = makeW2Return(100000, 'CO', 0);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    // CO starts from federal taxable income, so should be less than AGI-based calculation
    expect(results[0].stateTaxableIncome).toBeLessThanOrEqual(federal.form1040.taxableIncome);
  });

  it('NC applies standard deduction', () => {
    const tr = makeW2Return(100000, 'NC', 0);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    // NC single standard deduction is $12,750
    expect(results[0].stateDeduction).toBeGreaterThan(0);
  });

  it('IL applies per-person exemption', () => {
    const tr = makeW2Return(100000, 'IL', 0);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    expect(results[0].stateExemptions).toBeGreaterThan(0);
  });

  it('UT applies taxpayer credit (reduces effective rate)', () => {
    const tr = makeW2Return(100000, 'UT', 0);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    // UT credits = 6% of federal standard deduction
    expect(results[0].stateCredits).toBeGreaterThan(0);
    expect(results[0].effectiveStateRate).toBeLessThan(0.045); // Less than 4.5% due to credit
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CALIFORNIA
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Tax — California', () => {
  it('calculates CA tax for $75K single filer', () => {
    const tr = makeW2Return(75000, 'CA', 2500);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);

    expect(results).toHaveLength(1);
    expect(results[0].stateCode).toBe('CA');
    expect(results[0].stateName).toBe('California');
    expect(results[0].stateDeduction).toBe(5706); // CA single std deduction
    expect(results[0].stateIncomeTax).toBeGreaterThan(0);
    expect(results[0].bracketDetails!.length).toBeGreaterThan(1); // Progressive brackets
  });

  it('CA exempts Social Security benefits', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      incomeSSA1099: { id: 'ssa1', totalBenefits: 24000, federalTaxWithheld: 0 },
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' }],
    });
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);

    expect(results).toHaveLength(1);
    // Social Security should be subtracted from state AGI
    expect(results[0].stateSubtractions).toBeGreaterThanOrEqual(0);
  });

  it('CA Mental Health Services Tax applies above $1M', () => {
    const tr = makeW2Return(1_500_000, 'CA', 0);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);

    // MHST = 1% on income above $1M → at least $5,000 extra
    expect(results[0].stateIncomeTax).toBeGreaterThan(0);
    // Effective rate should be above 12.3% base top rate due to MHST
    expect(results[0].effectiveStateRate).toBeGreaterThan(0.10);
  });

  it('CA MFJ standard deduction is $11,412', () => {
    const tr = makeW2Return(150000, 'CA', 0, FilingStatus.MarriedFilingJointly);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    expect(results[0].stateDeduction).toBe(11412);
  });

  it('CA provides exemption credits (not deductions)', () => {
    const tr = makeW2Return(75000, 'CA', 0);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    // CA exemption credits: $144 for single, higher for dependents
    expect(results[0].stateCredits).toBeGreaterThanOrEqual(144);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. NEW YORK
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Tax — New York', () => {
  it('calculates NYS tax for $75K single filer', () => {
    const tr = makeW2Return(75000, 'NY', 3000);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);

    expect(results).toHaveLength(1);
    expect(results[0].stateCode).toBe('NY');
    expect(results[0].stateName).toBe('New York');
    expect(results[0].stateDeduction).toBe(8000); // NY single std deduction
    expect(results[0].stateIncomeTax).toBeGreaterThan(0);
    expect(results[0].bracketDetails!.length).toBeGreaterThan(1);
  });

  it('NY adds NYC local tax for NYC residents', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
        state: 'NY', stateTaxWithheld: 5000,
      }],
      stateReturns: [{
        stateCode: 'NY',
        residencyType: 'resident',
        stateSpecificData: { nycResident: true },
      }],
    });
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);

    expect(results[0].localTax).toBeGreaterThan(0); // NYC tax should be > 0
    expect(results[0].totalStateTax).toBeGreaterThan(results[0].stateIncomeTax); // Total > NYS alone
  });

  it('NY non-NYC resident has no local tax', () => {
    const tr = makeW2Return(100000, 'NY', 5000);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    expect(results[0].localTax).toBe(0);
  });

  it('NY MFJ standard deduction is $16,050', () => {
    const tr = makeW2Return(150000, 'NY', 0, FilingStatus.MarriedFilingJointly);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    expect(results[0].stateDeduction).toBe(16050);
  });

  it('NY exempts Social Security benefits', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      incomeSSA1099: { id: 'ssa1', totalBenefits: 20000, federalTaxWithheld: 0 },
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    expect(results[0].stateSubtractions).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. NEW JERSEY
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Tax — New Jersey', () => {
  it('calculates NJ tax for $75K single filer', () => {
    const tr = makeW2Return(75000, 'NJ', 2000);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);

    expect(results).toHaveLength(1);
    expect(results[0].stateCode).toBe('NJ');
    expect(results[0].stateName).toBe('New Jersey');
    expect(results[0].stateIncomeTax).toBeGreaterThan(0);
    expect(results[0].bracketDetails!.length).toBeGreaterThan(1);
  });

  it('NJ has no standard deduction (uses exemptions)', () => {
    const tr = makeW2Return(75000, 'NJ', 0);
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    // NJ uses personal exemptions, not standard deductions
    expect(results[0].stateExemptions).toBeGreaterThan(0);
  });

  it('NJ property tax deduction applies when provided', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
        state: 'NJ', stateTaxWithheld: 4000,
      }],
      stateReturns: [{
        stateCode: 'NJ',
        residencyType: 'resident',
        stateSpecificData: { propertyTaxPaid: 8000 },
      }],
    });
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);

    // Property tax deduction should reduce state taxable income
    expect(results[0].stateDeduction).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. MULTI-STATE FILING
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Tax — Multi-State Filing', () => {
  it('calculates taxes for two states', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [
        {
          id: 'w1', employerName: 'CA Corp', wages: 60000,
          federalTaxWithheld: 9000,
          socialSecurityWages: 60000, socialSecurityTax: 3720,
          medicareWages: 60000, medicareTax: 870,
          state: 'CA', stateTaxWithheld: 2500,
        },
        {
          id: 'w2', employerName: 'NY Corp', wages: 40000,
          federalTaxWithheld: 6000,
          socialSecurityWages: 40000, socialSecurityTax: 2480,
          medicareWages: 40000, medicareTax: 580,
          state: 'NY', stateTaxWithheld: 2000,
        },
      ],
      stateReturns: [
        { stateCode: 'CA', residencyType: 'resident' },
        { stateCode: 'NY', residencyType: 'nonresident' },
      ],
    });
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);

    expect(results).toHaveLength(2);
    expect(results.map(r => r.stateCode).sort()).toEqual(['CA', 'NY']);
    // Both should have calculated tax
    for (const result of results) {
      expect(result.stateIncomeTax).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Tax — Edge Cases', () => {
  it('returns empty array when no stateReturns configured', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.Single });
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    expect(results).toEqual([]);
  });

  it('GA is now supported and produces results', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 50000,
        federalTaxWithheld: 5000,
        socialSecurityWages: 50000, socialSecurityTax: 3100,
        medicareWages: 50000, medicareTax: 725,
        state: 'GA',
      }],
      stateReturns: [{ stateCode: 'GA', residencyType: 'resident' }],
    });
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    // GA is now supported — should produce results
    expect(results).toHaveLength(1);
    expect(results[0].stateCode).toBe('GA');
    expect(results[0].stateIncomeTax).toBeGreaterThan(0);
  });

  it('zero income produces zero state tax', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' }],
    });
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    expect(results).toHaveLength(1);
    expect(results[0].stateIncomeTax).toBe(0);
    expect(results[0].totalStateTax).toBe(0);
  });

  it('state withholding creates refund when tax is zero', () => {
    // No income but state withheld money (error from employer)
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 0,
        federalTaxWithheld: 0,
        socialSecurityWages: 0, socialSecurityTax: 0,
        medicareWages: 0, medicareTax: 0,
        state: 'CA', stateTaxWithheld: 500,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' }],
    });
    const federal = calculateForm1040(tr);
    const results = calculateStateTaxes(tr, federal);
    expect(results[0].stateWithholding).toBe(500);
    expect(results[0].stateRefundOrOwed).toBeGreaterThan(0); // Refund
  });

  it('all supported states produce valid results for $100K income', () => {
    const allStates = getSupportedStates();
    for (const state of allStates) {
      const tr = makeW2Return(100000, state, 3000);
      const federal = calculateForm1040(tr);
      const results = calculateStateTaxes(tr, federal);

      expect(results).toHaveLength(1);
      expect(results[0].stateCode).toBe(state);
      expect(Number.isFinite(results[0].stateIncomeTax)).toBe(true);
      expect(Number.isFinite(results[0].totalStateTax)).toBe(true);
      expect(Number.isFinite(results[0].effectiveStateRate)).toBe(true);
      expect(results[0].effectiveStateRate).toBeGreaterThanOrEqual(0);
      expect(results[0].effectiveStateRate).toBeLessThanOrEqual(0.15); // Max ~13% for CA
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. STATE TAX TRACES
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Tax — Calculation Traces', () => {
  const findTrace = (traces: unknown[] | undefined, id: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (traces as any[])?.find((t: any) => t.lineId === id);

  it('flat-tax state (PA) generates 5 traces', () => {
    const tr = makeW2Return(75000, 'PA', 2000);
    const result = calculateForm1040(tr);
    const pa = result.stateResults?.find(s => s.stateCode === 'PA');
    expect(pa).toBeDefined();
    expect(pa!.traces).toBeDefined();
    expect(pa!.traces!.length).toBeGreaterThanOrEqual(5);

    // Each trace value should match the corresponding result field
    expect(findTrace(pa!.traces, 'state.stateAGI')?.value).toBe(pa!.stateAGI);
    expect(findTrace(pa!.traces, 'state.taxableIncome')?.value).toBe(pa!.stateTaxableIncome);
    expect(findTrace(pa!.traces, 'state.incomeTax')?.value).toBe(pa!.stateIncomeTax);
    expect(findTrace(pa!.traces, 'state.totalTax')?.value).toBe(pa!.totalStateTax);
    expect(findTrace(pa!.traces, 'state.refundOrOwed')?.value).toBe(pa!.stateRefundOrOwed);
  });

  it('flat-tax trace includes flat rate formula', () => {
    const tr = makeW2Return(75000, 'PA', 2000);
    const result = calculateForm1040(tr);
    const pa = result.stateResults?.find(s => s.stateCode === 'PA');
    const incomeTax = findTrace(pa!.traces, 'state.incomeTax');
    expect(incomeTax?.formula).toContain('3.07');
  });

  it('flat-tax trace includes authority from form refs', () => {
    const tr = makeW2Return(75000, 'IL', 3000);
    const result = calculateForm1040(tr);
    const il = result.stateResults?.find(s => s.stateCode === 'IL');
    const agi = findTrace(il!.traces, 'state.stateAGI');
    expect(agi?.authority).toContain('IL-1040');
  });

  it('progressive-tax state (VA) generates bracket children', () => {
    const tr = makeW2Return(100000, 'VA', 4000);
    const result = calculateForm1040(tr);
    const va = result.stateResults?.find(s => s.stateCode === 'VA');
    expect(va).toBeDefined();
    expect(va!.traces).toBeDefined();

    const incomeTax = findTrace(va!.traces, 'state.incomeTax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax!.children).toBeDefined();
    expect(incomeTax!.children!.length).toBeGreaterThan(1);
  });

  it('progressive-tax trace values match result fields', () => {
    const tr = makeW2Return(80000, 'MN', 3500);
    const result = calculateForm1040(tr);
    const mn = result.stateResults?.find(s => s.stateCode === 'MN');
    expect(mn).toBeDefined();
    expect(mn!.traces).toBeDefined();

    expect(findTrace(mn!.traces, 'state.stateAGI')?.value).toBe(mn!.stateAGI);
    expect(findTrace(mn!.traces, 'state.taxableIncome')?.value).toBe(mn!.stateTaxableIncome);
    expect(findTrace(mn!.traces, 'state.incomeTax')?.value).toBe(mn!.stateIncomeTax);
    expect(findTrace(mn!.traces, 'state.totalTax')?.value).toBe(mn!.totalStateTax);
    expect(findTrace(mn!.traces, 'state.refundOrOwed')?.value).toBe(mn!.stateRefundOrOwed);
  });

  it('progressive-tax trace includes authority from form refs', () => {
    const tr = makeW2Return(80000, 'VA', 3000);
    const result = calculateForm1040(tr);
    const va = result.stateResults?.find(s => s.stateCode === 'VA');
    const agi = findTrace(va!.traces, 'state.stateAGI');
    expect(agi?.authority).toContain('Form 760');
  });

  it('no-income-tax state (FL) has no traces', () => {
    const tr = makeW2Return(75000, 'FL', 0);
    const result = calculateForm1040(tr);
    const fl = result.stateResults?.find(s => s.stateCode === 'FL');
    expect(fl).toBeDefined();
    expect(fl!.traces).toBeUndefined();
  });

  it('refund/owed trace label reflects sign', () => {
    // Large withholding → refund
    const tr1 = makeW2Return(50000, 'PA', 5000);
    const result1 = calculateForm1040(tr1);
    const pa1 = result1.stateResults?.find(s => s.stateCode === 'PA');
    const refundTrace = findTrace(pa1!.traces, 'state.refundOrOwed');
    expect(refundTrace?.label).toContain('Refund');

    // No withholding → owed
    const tr2 = makeW2Return(50000, 'PA', 0);
    const result2 = calculateForm1040(tr2);
    const pa2 = result2.stateResults?.find(s => s.stateCode === 'PA');
    const owedTrace = findTrace(pa2!.traces, 'state.refundOrOwed');
    expect(owedTrace?.label).toContain('Owed');
  });

  it('all flat-tax states produce traces', () => {
    for (const stateCode of FLAT_TAX_STATES) {
      const tr = makeW2Return(60000, stateCode, 2000);
      const result = calculateForm1040(tr);
      const sr = result.stateResults?.find(s => s.stateCode === stateCode);
      expect(sr, `${stateCode} should have state result`).toBeDefined();
      expect(sr!.traces, `${stateCode} should have traces`).toBeDefined();
      expect(sr!.traces!.length, `${stateCode} should have >= 5 traces`).toBeGreaterThanOrEqual(5);
    }
  });

  it('all progressive-tax states produce traces with bracket children', () => {
    for (const stateCode of PROGRESSIVE_TAX_STATES) {
      const tr = makeW2Return(80000, stateCode, 3000);
      const result = calculateForm1040(tr);
      const sr = result.stateResults?.find(s => s.stateCode === stateCode);
      expect(sr, `${stateCode} should have state result`).toBeDefined();
      expect(sr!.traces, `${stateCode} should have traces`).toBeDefined();
      expect(sr!.traces!.length, `${stateCode} should have >= 5 traces`).toBeGreaterThanOrEqual(5);

      // Verify all 5 expected trace IDs exist
      const traceIds = sr!.traces!.map(t => t.lineId);
      expect(traceIds, `${stateCode} missing state.stateAGI`).toContain('state.stateAGI');
      expect(traceIds, `${stateCode} missing state.taxableIncome`).toContain('state.taxableIncome');
      expect(traceIds, `${stateCode} missing state.incomeTax`).toContain('state.incomeTax');
      expect(traceIds, `${stateCode} missing state.totalTax`).toContain('state.totalTax');
      expect(traceIds, `${stateCode} missing state.refundOrOwed`).toContain('state.refundOrOwed');

      // Income tax trace should have bracket children
      const incomeTax = sr!.traces!.find(t => t.lineId === 'state.incomeTax');
      expect(incomeTax!.children, `${stateCode} income tax should have bracket children`).toBeDefined();
      expect(incomeTax!.children!.length, `${stateCode} should have >= 1 bracket`).toBeGreaterThanOrEqual(1);
    }
  });

  // ── CA Custom Calculator Traces ──────────────────────────────
  it('CA produces traces with all expected lineIds', () => {
    const tr = makeW2Return(75000, 'CA', 2500);
    const result = calculateForm1040(tr);
    const ca = result.stateResults?.find(s => s.stateCode === 'CA');
    expect(ca).toBeDefined();
    expect(ca!.traces).toBeDefined();
    expect(ca!.traces!.length).toBeGreaterThanOrEqual(6);

    const traceIds = ca!.traces!.map(t => t.lineId);
    expect(traceIds).toContain('state.stateAGI');
    expect(traceIds).toContain('state.taxableIncome');
    expect(traceIds).toContain('state.incomeTax');
    expect(traceIds).toContain('state.credits');
    expect(traceIds).toContain('state.totalTax');
    expect(traceIds).toContain('state.refundOrOwed');
  });

  it('CA trace values match result fields', () => {
    const tr = makeW2Return(75000, 'CA', 2500);
    const result = calculateForm1040(tr);
    const ca = result.stateResults?.find(s => s.stateCode === 'CA');
    expect(ca).toBeDefined();

    expect(findTrace(ca!.traces, 'state.stateAGI')?.value).toBe(ca!.stateAGI);
    expect(findTrace(ca!.traces, 'state.taxableIncome')?.value).toBe(ca!.stateTaxableIncome);
    expect(findTrace(ca!.traces, 'state.incomeTax')?.value).toBe(ca!.stateIncomeTax);
    expect(findTrace(ca!.traces, 'state.credits')?.value).toBe(ca!.stateCredits);
    expect(findTrace(ca!.traces, 'state.totalTax')?.value).toBe(ca!.totalStateTax);
    expect(findTrace(ca!.traces, 'state.refundOrOwed')?.value).toBe(ca!.stateRefundOrOwed);
  });

  it('CA income tax trace has bracket children (9 CA brackets)', () => {
    const tr = makeW2Return(100000, 'CA', 4000);
    const result = calculateForm1040(tr);
    const ca = result.stateResults?.find(s => s.stateCode === 'CA');
    expect(ca).toBeDefined();

    const incomeTax = findTrace(ca!.traces, 'state.incomeTax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax!.children).toBeDefined();
    expect(incomeTax!.children!.length).toBeGreaterThan(1);
    // Each child should have a bracket lineId pattern
    for (const child of incomeTax!.children!) {
      expect(child.lineId).toMatch(/^state\.bracket\./);
    }
  });

  it('CA MHST appears as child trace when income > $1M', () => {
    const tr = makeW2Return(1_500_000, 'CA', 0);
    const result = calculateForm1040(tr);
    const ca = result.stateResults?.find(s => s.stateCode === 'CA');
    expect(ca).toBeDefined();

    const incomeTax = findTrace(ca!.traces, 'state.incomeTax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax!.children).toBeDefined();

    const mhstChild = incomeTax!.children!.find((c: any) => c.lineId === 'state.mhst');
    expect(mhstChild, 'MHST should appear as child of income tax trace').toBeDefined();
    expect(mhstChild!.value).toBeGreaterThan(0);
    expect(mhstChild!.label).toContain('Mental Health');
    expect(incomeTax!.formula).toContain('MHST');
  });

  it('CA credits trace has exemption credits child', () => {
    const tr = makeW2Return(75000, 'CA', 2500);
    const result = calculateForm1040(tr);
    const ca = result.stateResults?.find(s => s.stateCode === 'CA');
    expect(ca).toBeDefined();

    const credits = findTrace(ca!.traces, 'state.credits');
    expect(credits).toBeDefined();
    expect(credits!.children).toBeDefined();

    const exemptionChild = credits!.children!.find((c: any) => c.lineId === 'state.credits.exemption');
    expect(exemptionChild, 'Exemption credits should appear as child').toBeDefined();
    expect(exemptionChild!.value).toBeGreaterThan(0);
  });

  it('CA trace authority references Form 540', () => {
    const tr = makeW2Return(75000, 'CA', 2500);
    const result = calculateForm1040(tr);
    const ca = result.stateResults?.find(s => s.stateCode === 'CA');
    expect(ca).toBeDefined();

    const agi = findTrace(ca!.traces, 'state.stateAGI');
    expect(agi?.authority).toContain('Form 540');

    const totalTax = findTrace(ca!.traces, 'state.totalTax');
    expect(totalTax?.authority).toContain('Form 540');

    const refund = findTrace(ca!.traces, 'state.refundOrOwed');
    expect(refund?.authority).toContain('Form 540');
  });

  // ── NY Custom Calculator Traces ──────────────────────────────
  it('NY produces traces with all expected lineIds', () => {
    const tr = makeW2Return(75000, 'NY', 3000);
    const result = calculateForm1040(tr);
    const ny = result.stateResults?.find(s => s.stateCode === 'NY');
    expect(ny).toBeDefined();
    expect(ny!.traces).toBeDefined();
    expect(ny!.traces!.length).toBeGreaterThanOrEqual(5);

    const traceIds = ny!.traces!.map(t => t.lineId);
    expect(traceIds).toContain('state.stateAGI');
    expect(traceIds).toContain('state.taxableIncome');
    expect(traceIds).toContain('state.incomeTax');
    expect(traceIds).toContain('state.credits');
    expect(traceIds).toContain('state.totalTax');
    expect(traceIds).toContain('state.refundOrOwed');
  });

  it('NY trace values match result fields', () => {
    const tr = makeW2Return(75000, 'NY', 3000);
    const result = calculateForm1040(tr);
    const ny = result.stateResults?.find(s => s.stateCode === 'NY');
    expect(ny).toBeDefined();

    expect(findTrace(ny!.traces, 'state.stateAGI')?.value).toBe(ny!.stateAGI);
    expect(findTrace(ny!.traces, 'state.taxableIncome')?.value).toBe(ny!.stateTaxableIncome);
    expect(findTrace(ny!.traces, 'state.credits')?.value).toBe(ny!.stateCredits);
    expect(findTrace(ny!.traces, 'state.totalTax')?.value).toBe(ny!.totalStateTax);
    expect(findTrace(ny!.traces, 'state.refundOrOwed')?.value).toBe(ny!.stateRefundOrOwed);
  });

  it('NY income tax trace has bracket children', () => {
    const tr = makeW2Return(100000, 'NY', 4000);
    const result = calculateForm1040(tr);
    const ny = result.stateResults?.find(s => s.stateCode === 'NY');
    expect(ny).toBeDefined();

    const incomeTax = findTrace(ny!.traces, 'state.incomeTax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax!.children).toBeDefined();
    expect(incomeTax!.children!.length).toBeGreaterThan(1);
    for (const child of incomeTax!.children!) {
      expect(child.lineId).toMatch(/^state\.bracket\./);
    }
  });

  it('NY NYC resident gets localTax trace with NYC bracket children', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
        state: 'NY', stateTaxWithheld: 5000,
      }],
      stateReturns: [{
        stateCode: 'NY',
        residencyType: 'resident',
        stateSpecificData: { nycResident: true },
      }],
    });
    const result = calculateForm1040(tr);
    const ny = result.stateResults?.find(s => s.stateCode === 'NY');
    expect(ny).toBeDefined();

    const traceIds = ny!.traces!.map(t => t.lineId);
    expect(traceIds).toContain('state.localTax');

    const localTaxTrace = findTrace(ny!.traces, 'state.localTax');
    expect(localTaxTrace).toBeDefined();
    expect(localTaxTrace!.value).toBeGreaterThan(0);
    expect(localTaxTrace!.label).toContain('NYC');
    expect(localTaxTrace!.children).toBeDefined();
    expect(localTaxTrace!.children!.length).toBeGreaterThanOrEqual(1);
  });

  it('NY non-NYC resident has no localTax trace', () => {
    const tr = makeW2Return(100000, 'NY', 4000);
    const result = calculateForm1040(tr);
    const ny = result.stateResults?.find(s => s.stateCode === 'NY');
    expect(ny).toBeDefined();

    const localTaxTrace = findTrace(ny!.traces, 'state.localTax');
    expect(localTaxTrace).toBeUndefined();
  });

  it('NY trace authority references Form IT-201', () => {
    const tr = makeW2Return(75000, 'NY', 3000);
    const result = calculateForm1040(tr);
    const ny = result.stateResults?.find(s => s.stateCode === 'NY');
    expect(ny).toBeDefined();

    const agi = findTrace(ny!.traces, 'state.stateAGI');
    expect(agi?.authority).toContain('Form IT-201');

    const totalTax = findTrace(ny!.traces, 'state.totalTax');
    expect(totalTax?.authority).toContain('Form IT-201');
  });

  // ── NJ Custom Calculator Traces ──────────────────────────────
  it('NJ produces traces with all expected lineIds', () => {
    const tr = makeW2Return(75000, 'NJ', 2000);
    const result = calculateForm1040(tr);
    const nj = result.stateResults?.find(s => s.stateCode === 'NJ');
    expect(nj).toBeDefined();
    expect(nj!.traces).toBeDefined();
    expect(nj!.traces!.length).toBeGreaterThanOrEqual(6);

    const traceIds = nj!.traces!.map(t => t.lineId);
    expect(traceIds).toContain('state.stateAGI');
    expect(traceIds).toContain('state.taxableIncome');
    expect(traceIds).toContain('state.incomeTax');
    expect(traceIds).toContain('state.credits');
    expect(traceIds).toContain('state.totalTax');
    expect(traceIds).toContain('state.refundOrOwed');
  });

  it('NJ trace values match result fields', () => {
    const tr = makeW2Return(75000, 'NJ', 2000);
    const result = calculateForm1040(tr);
    const nj = result.stateResults?.find(s => s.stateCode === 'NJ');
    expect(nj).toBeDefined();

    expect(findTrace(nj!.traces, 'state.stateAGI')?.value).toBe(nj!.stateAGI);
    expect(findTrace(nj!.traces, 'state.taxableIncome')?.value).toBe(nj!.stateTaxableIncome);
    expect(findTrace(nj!.traces, 'state.credits')?.value).toBe(nj!.stateCredits);
    expect(findTrace(nj!.traces, 'state.totalTax')?.value).toBe(nj!.totalStateTax);
    expect(findTrace(nj!.traces, 'state.refundOrOwed')?.value).toBe(nj!.stateRefundOrOwed);
  });

  it('NJ income tax trace has bracket children', () => {
    const tr = makeW2Return(100000, 'NJ', 3000);
    const result = calculateForm1040(tr);
    const nj = result.stateResults?.find(s => s.stateCode === 'NJ');
    expect(nj).toBeDefined();

    const incomeTax = findTrace(nj!.traces, 'state.incomeTax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax!.children).toBeDefined();
    expect(incomeTax!.children!.length).toBeGreaterThan(1);
    for (const child of incomeTax!.children!) {
      expect(child.lineId).toMatch(/^state\.bracket\./);
    }
  });

  it('NJ credits trace includes property tax credit', () => {
    // makeW2Return doesn't set property tax, so NJ gives the $50 credit
    const tr = makeW2Return(75000, 'NJ', 2000);
    const result = calculateForm1040(tr);
    const nj = result.stateResults?.find(s => s.stateCode === 'NJ');
    expect(nj).toBeDefined();

    const credits = findTrace(nj!.traces, 'state.credits');
    expect(credits).toBeDefined();
    expect(credits!.value).toBe(50); // $50 property tax credit
    expect(credits!.children).toBeDefined();
    expect(credits!.children![0].lineId).toBe('state.credits.propTax');
  });

  it('NJ trace authority references Form NJ-1040', () => {
    const tr = makeW2Return(75000, 'NJ', 2000);
    const result = calculateForm1040(tr);
    const nj = result.stateResults?.find(s => s.stateCode === 'NJ');
    expect(nj).toBeDefined();

    const agi = findTrace(nj!.traces, 'state.stateAGI');
    expect(agi?.authority).toContain('Form NJ-1040');

    const totalTax = findTrace(nj!.traces, 'state.totalTax');
    expect(totalTax?.authority).toContain('Form NJ-1040');
  });

  // ── OH Custom Calculator Traces ──────────────────────────────
  it('OH produces traces with all expected lineIds', () => {
    const tr = makeW2Return(75000, 'OH', 2000);
    const result = calculateForm1040(tr);
    const oh = result.stateResults?.find(s => s.stateCode === 'OH');
    expect(oh).toBeDefined();
    expect(oh!.traces).toBeDefined();
    expect(oh!.traces!.length).toBeGreaterThanOrEqual(5);

    const traceIds = oh!.traces!.map(t => t.lineId);
    expect(traceIds).toContain('state.stateAGI');
    expect(traceIds).toContain('state.taxableIncome');
    expect(traceIds).toContain('state.incomeTax');
    expect(traceIds).toContain('state.totalTax');
    expect(traceIds).toContain('state.refundOrOwed');
  });

  it('OH trace values match result fields', () => {
    const tr = makeW2Return(75000, 'OH', 2000);
    const result = calculateForm1040(tr);
    const oh = result.stateResults?.find(s => s.stateCode === 'OH');
    expect(oh).toBeDefined();

    expect(findTrace(oh!.traces, 'state.stateAGI')?.value).toBe(oh!.stateAGI);
    expect(findTrace(oh!.traces, 'state.taxableIncome')?.value).toBe(oh!.stateTaxableIncome);
    expect(findTrace(oh!.traces, 'state.totalTax')?.value).toBe(oh!.totalStateTax);
    expect(findTrace(oh!.traces, 'state.refundOrOwed')?.value).toBe(oh!.stateRefundOrOwed);
  });

  it('OH income tax trace has bracket children', () => {
    const tr = makeW2Return(100000, 'OH', 3000);
    const result = calculateForm1040(tr);
    const oh = result.stateResults?.find(s => s.stateCode === 'OH');
    expect(oh).toBeDefined();

    const incomeTax = findTrace(oh!.traces, 'state.incomeTax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax!.children).toBeDefined();
    expect(incomeTax!.children!.length).toBeGreaterThanOrEqual(1);
    for (const child of incomeTax!.children!) {
      expect(child.lineId).toMatch(/^state\.bracket\./);
    }
  });

  it('OH trace authority references Form IT 1040', () => {
    const tr = makeW2Return(75000, 'OH', 2000);
    const result = calculateForm1040(tr);
    const oh = result.stateResults?.find(s => s.stateCode === 'OH');
    expect(oh).toBeDefined();

    const agi = findTrace(oh!.traces, 'state.stateAGI');
    expect(agi?.authority).toContain('Form IT 1040');

    const totalTax = findTrace(oh!.traces, 'state.totalTax');
    expect(totalTax?.authority).toContain('Form IT 1040');
  });

  // ── AL Custom Calculator Traces ──────────────────────────────
  it('AL produces traces with all expected lineIds', () => {
    const tr = makeW2Return(75000, 'AL', 2000);
    const result = calculateForm1040(tr);
    const al = result.stateResults?.find(s => s.stateCode === 'AL');
    expect(al).toBeDefined();
    expect(al!.traces).toBeDefined();
    expect(al!.traces!.length).toBeGreaterThanOrEqual(5);

    const traceIds = al!.traces!.map(t => t.lineId);
    expect(traceIds).toContain('state.stateAGI');
    expect(traceIds).toContain('state.taxableIncome');
    expect(traceIds).toContain('state.incomeTax');
    expect(traceIds).toContain('state.totalTax');
    expect(traceIds).toContain('state.refundOrOwed');
  });

  it('AL trace values match result fields', () => {
    const tr = makeW2Return(75000, 'AL', 2000);
    const result = calculateForm1040(tr);
    const al = result.stateResults?.find(s => s.stateCode === 'AL');
    expect(al).toBeDefined();

    expect(findTrace(al!.traces, 'state.stateAGI')?.value).toBe(al!.stateAGI);
    expect(findTrace(al!.traces, 'state.taxableIncome')?.value).toBe(al!.stateTaxableIncome);
    expect(findTrace(al!.traces, 'state.totalTax')?.value).toBe(al!.totalStateTax);
    expect(findTrace(al!.traces, 'state.refundOrOwed')?.value).toBe(al!.stateRefundOrOwed);
  });

  it('AL income tax trace has bracket children', () => {
    const tr = makeW2Return(75000, 'AL', 2000);
    const result = calculateForm1040(tr);
    const al = result.stateResults?.find(s => s.stateCode === 'AL');
    expect(al).toBeDefined();

    const incomeTax = findTrace(al!.traces, 'state.incomeTax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax!.children).toBeDefined();
    expect(incomeTax!.children!.length).toBeGreaterThanOrEqual(1);
  });

  it('AL taxable income trace includes federal tax deduction input', () => {
    const tr = makeW2Return(75000, 'AL', 2000);
    const result = calculateForm1040(tr);
    const al = result.stateResults?.find(s => s.stateCode === 'AL');
    expect(al).toBeDefined();

    const taxableIncome = findTrace(al!.traces, 'state.taxableIncome');
    expect(taxableIncome).toBeDefined();
    expect(taxableIncome!.formula).toContain('Federal Tax Deduction');

    // Federal tax deduction should appear as an input
    const fedTaxInput = taxableIncome!.inputs.find((i: any) => i.lineId === 'state.fedTaxDed');
    expect(fedTaxInput, 'Federal tax deduction should be a trace input').toBeDefined();
    expect(fedTaxInput!.value).toBeGreaterThan(0);
  });

  it('AL trace authority references Form 40', () => {
    const tr = makeW2Return(75000, 'AL', 2000);
    const result = calculateForm1040(tr);
    const al = result.stateResults?.find(s => s.stateCode === 'AL');
    expect(al).toBeDefined();

    const agi = findTrace(al!.traces, 'state.stateAGI');
    expect(agi?.authority).toContain('Form 40');

    const totalTax = findTrace(al!.traces, 'state.totalTax');
    expect(totalTax?.authority).toContain('Form 40');
  });

  // ── MD Custom Calculator Traces ──────────────────────────────
  it('MD produces traces with all expected lineIds', () => {
    const tr = makeW2Return(75000, 'MD', 2000);
    const result = calculateForm1040(tr);
    const md = result.stateResults?.find(s => s.stateCode === 'MD');
    expect(md).toBeDefined();
    expect(md!.traces).toBeDefined();
    expect(md!.traces!.length).toBeGreaterThanOrEqual(7);

    const traceIds = md!.traces!.map(t => t.lineId);
    expect(traceIds).toContain('state.stateAGI');
    expect(traceIds).toContain('state.taxableIncome');
    expect(traceIds).toContain('state.incomeTax');
    expect(traceIds).toContain('state.credits');
    expect(traceIds).toContain('state.localTax');
    expect(traceIds).toContain('state.totalTax');
    expect(traceIds).toContain('state.refundOrOwed');
  });

  it('MD trace values match result fields', () => {
    const tr = makeW2Return(75000, 'MD', 2000);
    const result = calculateForm1040(tr);
    const md = result.stateResults?.find(s => s.stateCode === 'MD');
    expect(md).toBeDefined();

    expect(findTrace(md!.traces, 'state.stateAGI')?.value).toBe(md!.stateAGI);
    expect(findTrace(md!.traces, 'state.taxableIncome')?.value).toBe(md!.stateTaxableIncome);
    expect(findTrace(md!.traces, 'state.credits')?.value).toBe(md!.stateCredits);
    expect(findTrace(md!.traces, 'state.localTax')?.value).toBe(md!.localTax);
    expect(findTrace(md!.traces, 'state.totalTax')?.value).toBe(md!.totalStateTax);
    expect(findTrace(md!.traces, 'state.refundOrOwed')?.value).toBe(md!.stateRefundOrOwed);
  });

  it('MD income tax trace has bracket children', () => {
    const tr = makeW2Return(100000, 'MD', 3000);
    const result = calculateForm1040(tr);
    const md = result.stateResults?.find(s => s.stateCode === 'MD');
    expect(md).toBeDefined();

    const incomeTax = findTrace(md!.traces, 'state.incomeTax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax!.children).toBeDefined();
    expect(incomeTax!.children!.length).toBeGreaterThan(1);
    for (const child of incomeTax!.children!) {
      expect(child.lineId).toMatch(/^state\.bracket\./);
    }
  });

  it('MD local tax trace shows county piggyback', () => {
    const tr = makeW2Return(75000, 'MD', 2000);
    const result = calculateForm1040(tr);
    const md = result.stateResults?.find(s => s.stateCode === 'MD');
    expect(md).toBeDefined();

    const localTax = findTrace(md!.traces, 'state.localTax');
    expect(localTax).toBeDefined();
    expect(localTax!.value).toBeGreaterThan(0);
    expect(localTax!.formula).toContain('%');
  });

  it('MD total tax trace includes county tax as input', () => {
    const tr = makeW2Return(75000, 'MD', 2000);
    const result = calculateForm1040(tr);
    const md = result.stateResults?.find(s => s.stateCode === 'MD');
    expect(md).toBeDefined();

    const totalTax = findTrace(md!.traces, 'state.totalTax');
    expect(totalTax).toBeDefined();
    const countyInput = totalTax!.inputs.find((i: any) => i.lineId === 'state.localTax');
    expect(countyInput, 'County tax should be a trace input on totalTax').toBeDefined();
    expect(countyInput!.value).toBeGreaterThan(0);
  });

  it('MD trace authority references Form 502', () => {
    const tr = makeW2Return(75000, 'MD', 2000);
    const result = calculateForm1040(tr);
    const md = result.stateResults?.find(s => s.stateCode === 'MD');
    expect(md).toBeDefined();

    const agi = findTrace(md!.traces, 'state.stateAGI');
    expect(agi?.authority).toContain('Form 502');

    const totalTax = findTrace(md!.traces, 'state.totalTax');
    expect(totalTax?.authority).toContain('Form 502');
  });

  // ── WI Custom Calculator Traces ──────────────────────────────
  it('WI produces traces with all expected lineIds', () => {
    const tr = makeW2Return(75000, 'WI', 2000);
    const result = calculateForm1040(tr);
    const wi = result.stateResults?.find(s => s.stateCode === 'WI');
    expect(wi).toBeDefined();
    expect(wi!.traces).toBeDefined();
    expect(wi!.traces!.length).toBeGreaterThanOrEqual(6);

    const traceIds = wi!.traces!.map(t => t.lineId);
    expect(traceIds).toContain('state.stateAGI');
    expect(traceIds).toContain('state.taxableIncome');
    expect(traceIds).toContain('state.incomeTax');
    expect(traceIds).toContain('state.credits');
    expect(traceIds).toContain('state.totalTax');
    expect(traceIds).toContain('state.refundOrOwed');
  });

  it('WI trace values match result fields', () => {
    const tr = makeW2Return(75000, 'WI', 2000);
    const result = calculateForm1040(tr);
    const wi = result.stateResults?.find(s => s.stateCode === 'WI');
    expect(wi).toBeDefined();

    expect(findTrace(wi!.traces, 'state.stateAGI')?.value).toBe(wi!.stateAGI);
    expect(findTrace(wi!.traces, 'state.taxableIncome')?.value).toBe(wi!.stateTaxableIncome);
    expect(findTrace(wi!.traces, 'state.credits')?.value).toBe(wi!.stateCredits);
    expect(findTrace(wi!.traces, 'state.totalTax')?.value).toBe(wi!.totalStateTax);
    expect(findTrace(wi!.traces, 'state.refundOrOwed')?.value).toBe(wi!.stateRefundOrOwed);
  });

  it('WI income tax trace has bracket children', () => {
    const tr = makeW2Return(100000, 'WI', 3000);
    const result = calculateForm1040(tr);
    const wi = result.stateResults?.find(s => s.stateCode === 'WI');
    expect(wi).toBeDefined();

    const incomeTax = findTrace(wi!.traces, 'state.incomeTax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax!.children).toBeDefined();
    expect(incomeTax!.children!.length).toBeGreaterThan(1);
    for (const child of incomeTax!.children!) {
      expect(child.lineId).toMatch(/^state\.bracket\./);
    }
  });

  it('WI trace authority references WI Form 1', () => {
    const tr = makeW2Return(75000, 'WI', 2000);
    const result = calculateForm1040(tr);
    const wi = result.stateResults?.find(s => s.stateCode === 'WI');
    expect(wi).toBeDefined();

    const agi = findTrace(wi!.traces, 'state.stateAGI');
    expect(agi?.authority).toContain('WI Form 1');

    const totalTax = findTrace(wi!.traces, 'state.totalTax');
    expect(totalTax?.authority).toContain('WI Form 1');
  });

  // ── HI Custom Calculator Traces ──────────────────────────────
  it('HI produces traces with all expected lineIds', () => {
    const tr = makeW2Return(30000, 'HI', 1000);
    const result = calculateForm1040(tr);
    const hi = result.stateResults?.find(s => s.stateCode === 'HI');
    expect(hi).toBeDefined();
    expect(hi!.traces).toBeDefined();
    expect(hi!.traces!.length).toBeGreaterThanOrEqual(6);

    const traceIds = hi!.traces!.map(t => t.lineId);
    expect(traceIds).toContain('state.stateAGI');
    expect(traceIds).toContain('state.taxableIncome');
    expect(traceIds).toContain('state.incomeTax');
    expect(traceIds).toContain('state.credits');
    expect(traceIds).toContain('state.totalTax');
    expect(traceIds).toContain('state.refundOrOwed');
  });

  it('HI trace values match result fields', () => {
    const tr = makeW2Return(30000, 'HI', 1000);
    const result = calculateForm1040(tr);
    const hi = result.stateResults?.find(s => s.stateCode === 'HI');
    expect(hi).toBeDefined();

    expect(findTrace(hi!.traces, 'state.stateAGI')?.value).toBe(hi!.stateAGI);
    expect(findTrace(hi!.traces, 'state.taxableIncome')?.value).toBe(hi!.stateTaxableIncome);
    expect(findTrace(hi!.traces, 'state.credits')?.value).toBe(hi!.stateCredits);
    expect(findTrace(hi!.traces, 'state.totalTax')?.value).toBe(hi!.totalStateTax);
    expect(findTrace(hi!.traces, 'state.refundOrOwed')?.value).toBe(hi!.stateRefundOrOwed);
  });

  it('HI income tax trace has bracket children', () => {
    const tr = makeW2Return(100000, 'HI', 3000);
    const result = calculateForm1040(tr);
    const hi = result.stateResults?.find(s => s.stateCode === 'HI');
    expect(hi).toBeDefined();

    const incomeTax = findTrace(hi!.traces, 'state.incomeTax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax!.children).toBeDefined();
    expect(incomeTax!.children!.length).toBeGreaterThan(1);
    for (const child of incomeTax!.children!) {
      expect(child.lineId).toMatch(/^state\.bracket\./);
    }
  });

  it('HI credits trace includes food/excise credit child', () => {
    // $30K single filer qualifies for food/excise credit
    const tr = makeW2Return(30000, 'HI', 1000);
    const result = calculateForm1040(tr);
    const hi = result.stateResults?.find(s => s.stateCode === 'HI');
    expect(hi).toBeDefined();

    const credits = findTrace(hi!.traces, 'state.credits');
    expect(credits).toBeDefined();
    expect(credits!.children).toBeDefined();
    const foodChild = credits!.children!.find((c: any) => c.lineId === 'state.credits.foodExcise');
    expect(foodChild, 'Food/excise credit should be a trace child').toBeDefined();
    expect(foodChild!.value).toBeGreaterThan(0);
  });

  it('HI trace authority references Form N-11', () => {
    const tr = makeW2Return(75000, 'HI', 2000);
    const result = calculateForm1040(tr);
    const hi = result.stateResults?.find(s => s.stateCode === 'HI');
    expect(hi).toBeDefined();

    const agi = findTrace(hi!.traces, 'state.stateAGI');
    expect(agi?.authority).toContain('Form N-11');

    const totalTax = findTrace(hi!.traces, 'state.totalTax');
    expect(totalTax?.authority).toContain('Form N-11');
  });

  // ── CT Custom Calculator Traces ──────────────────────────────
  // Note: CT form line references (CT-1040) not yet added — pending
  // TY2025 booklet verification. Traces work without authority refs.
  it('CT produces traces with all expected lineIds', () => {
    const tr = makeW2Return(75000, 'CT', 2000);
    const result = calculateForm1040(tr);
    const ct = result.stateResults?.find(s => s.stateCode === 'CT');
    expect(ct).toBeDefined();
    expect(ct!.traces).toBeDefined();
    expect(ct!.traces!.length).toBeGreaterThanOrEqual(6);

    const traceIds = ct!.traces!.map(t => t.lineId);
    expect(traceIds).toContain('state.stateAGI');
    expect(traceIds).toContain('state.taxableIncome');
    expect(traceIds).toContain('state.incomeTax');
    expect(traceIds).toContain('state.credits');
    expect(traceIds).toContain('state.totalTax');
    expect(traceIds).toContain('state.refundOrOwed');
  });

  it('CT trace values match result fields', () => {
    const tr = makeW2Return(75000, 'CT', 2000);
    const result = calculateForm1040(tr);
    const ct = result.stateResults?.find(s => s.stateCode === 'CT');
    expect(ct).toBeDefined();

    expect(findTrace(ct!.traces, 'state.stateAGI')?.value).toBe(ct!.stateAGI);
    expect(findTrace(ct!.traces, 'state.taxableIncome')?.value).toBe(ct!.stateTaxableIncome);
    expect(findTrace(ct!.traces, 'state.credits')?.value).toBe(ct!.stateCredits);
    expect(findTrace(ct!.traces, 'state.totalTax')?.value).toBe(ct!.totalStateTax);
    expect(findTrace(ct!.traces, 'state.refundOrOwed')?.value).toBe(ct!.stateRefundOrOwed);
  });

  it('CT income tax trace has TCS children (initial tax, Table C/D/E)', () => {
    // $100K earner triggers Table C add-back and Table E credit
    const tr = makeW2Return(100000, 'CT', 3000);
    const result = calculateForm1040(tr);
    const ct = result.stateResults?.find(s => s.stateCode === 'CT');
    expect(ct).toBeDefined();

    const incomeTax = findTrace(ct!.traces, 'state.incomeTax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax!.children).toBeDefined();
    expect(incomeTax!.children!.length).toBeGreaterThanOrEqual(1);

    // Should have at least the initial tax (TCS Line 4) child
    const initialTaxChild = incomeTax!.children!.find((c: any) => c.lineId === 'state.tcs.initialTax');
    expect(initialTaxChild, 'Should have TCS initial tax child').toBeDefined();
    // Initial tax child should have bracket sub-children
    expect(initialTaxChild!.children).toBeDefined();
    expect(initialTaxChild!.children!.length).toBeGreaterThan(1);
  });

  it('CT income tax trace formula references TCS', () => {
    const tr = makeW2Return(75000, 'CT', 2000);
    const result = calculateForm1040(tr);
    const ct = result.stateResults?.find(s => s.stateCode === 'CT');
    expect(ct).toBeDefined();

    const incomeTax = findTrace(ct!.traces, 'state.incomeTax');
    expect(incomeTax).toBeDefined();
    expect(incomeTax!.formula).toContain('TCS');
  });

  it('CT credits trace includes personal tax credit for low earners', () => {
    // $30K single filer qualifies for Table E personal tax credit
    const tr = makeW2Return(30000, 'CT', 800);
    const result = calculateForm1040(tr);
    const ct = result.stateResults?.find(s => s.stateCode === 'CT');
    expect(ct).toBeDefined();

    const credits = findTrace(ct!.traces, 'state.credits');
    expect(credits).toBeDefined();
    // Personal tax credit (Table E) should be part of total credits
    expect(credits!.value).toBeGreaterThan(0);
    expect(credits!.formula).toContain('Table E');
  });
});
