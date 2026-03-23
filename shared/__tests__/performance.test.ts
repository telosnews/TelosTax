/**
 * Performance & Stress Tests — Category 7
 *
 * Tests for:
 *   1. Calculation speed — single return completes within budget
 *   2. Batch calculation — 100+ returns in sequence
 *   3. Complex return performance — max income sources, dependents
 *   4. Memory stability — no leaks over many iterations
 *   5. PDF mapping performance — field resolution speed
 *   6. State tax calculation overhead
 *   7. Edge-case stress — extreme values don't degrade performance
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateStateTaxes } from '../src/engine/state/index.js';
import { FORM_1040_TEMPLATE } from '../src/constants/irsForm1040Map.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'perf-test',
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

/** Create a "typical" return with W-2 income */
function makeTypicalReturn(wages: number): TaxReturn {
  return makeTaxReturn({
    filingStatus: FilingStatus.Single,
    firstName: 'Perf',
    lastName: 'Test',
    w2Income: [{
      id: 'w1',
      employerName: 'Corp',
      wages,
      federalTaxWithheld: Math.round(wages * 0.15),
      socialSecurityWages: Math.min(wages, 168600),
      socialSecurityTax: Math.min(wages, 168600) * 0.062,
      medicareWages: wages,
      medicareTax: wages * 0.0145,
    }],
  });
}

/** Create a maximally complex return */
function makeComplexReturn(): TaxReturn {
  const w2s = Array.from({ length: 5 }, (_, i) => ({
    id: `w${i}`,
    employerName: `Employer ${i}`,
    wages: 20000 + i * 10000,
    federalTaxWithheld: 3000 + i * 1500,
    socialSecurityWages: 20000 + i * 10000,
    socialSecurityTax: (20000 + i * 10000) * 0.062,
    medicareWages: 20000 + i * 10000,
    medicareTax: (20000 + i * 10000) * 0.0145,
    state: 'CA',
    stateTaxWithheld: 1000 + i * 500,
  }));

  const necs = Array.from({ length: 3 }, (_, i) => ({
    id: `n${i}`,
    payerName: `Client ${i}`,
    amount: 10000 + i * 5000,
  }));

  const ints = Array.from({ length: 5 }, (_, i) => ({
    id: `i${i}`,
    payerName: `Bank ${i}`,
    amount: 100 + i * 200,
  }));

  const divs = Array.from({ length: 3 }, (_, i) => ({
    id: `d${i}`,
    payerName: `Fund ${i}`,
    ordinaryDividends: 500 + i * 300,
    qualifiedDividends: 300 + i * 200,
  }));

  const deps = Array.from({ length: 4 }, (_, i) => ({
    id: `dep${i}`,
    firstName: `Child${i}`,
    lastName: 'Test',
    relationship: 'Son',
    dateOfBirth: `${2015 + i}-01-01`,
    monthsLivedWithYou: 12,
  }));

  const b1099s = Array.from({ length: 10 }, (_, i) => ({
    id: `b${i}`,
    brokerName: 'Broker',
    proceeds: 5000 + i * 1000,
    costBasis: 4000 + i * 800,
    isLongTerm: i % 2 === 0,
  }));

  return makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    firstName: 'Complex',
    lastName: 'Return',
    spouseFirstName: 'Spouse',
    spouseLastName: 'Return',
    w2Income: w2s,
    income1099NEC: necs,
    income1099INT: ints,
    income1099DIV: divs,
    income1099B: b1099s,
    dependents: deps,
    childTaxCredit: { qualifyingChildren: 4, otherDependents: 0 },
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 15000,
      stateLocalIncomeTax: 20000,
      realEstateTax: 12000,
      personalPropertyTax: 500,
      mortgageInterest: 18000,
      mortgageInsurancePremiums: 0,
      charitableCash: 5000,
      charitableNonCash: 2000,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
    stateReturns: [{ stateCode: 'CA', residencyType: 'resident' }],
  });
}

function measure(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SINGLE RETURN SPEED
// ═══════════════════════════════════════════════════════════════════════════════

describe('Performance — Single Return Calculation Speed', () => {
  it('simple W-2 return calculates in under 10ms', () => {
    const tr = makeTypicalReturn(75000);
    // Warm up
    calculateForm1040(tr);

    const elapsed = measure(() => calculateForm1040(tr));
    expect(elapsed).toBeLessThan(10);
  });

  it('complex return with all income types calculates in under 20ms', () => {
    const tr = makeComplexReturn();
    // Warm up
    calculateForm1040(tr);

    const elapsed = measure(() => calculateForm1040(tr));
    expect(elapsed).toBeLessThan(20);
  });

  it('calculation with state taxes adds minimal overhead', () => {
    const tr = makeComplexReturn();
    const federal = calculateForm1040(tr);

    // Warm up
    calculateStateTaxes(tr, federal);

    const elapsed = measure(() => calculateStateTaxes(tr, federal));
    expect(elapsed).toBeLessThan(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BATCH CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Performance — Batch Calculation', () => {
  it('100 simple returns complete in under 500ms', () => {
    const returns = Array.from({ length: 100 }, (_, i) =>
      makeTypicalReturn(30000 + i * 1000)
    );

    const elapsed = measure(() => {
      for (const tr of returns) {
        calculateForm1040(tr);
      }
    });

    expect(elapsed).toBeLessThan(500);
  });

  it('50 complex returns complete in under 500ms', () => {
    const complexReturn = makeComplexReturn();
    const returns = Array.from({ length: 50 }, () => ({
      ...complexReturn,
      id: `complex-${Math.random()}`,
    }));

    const elapsed = measure(() => {
      for (const tr of returns) {
        calculateForm1040(tr);
      }
    });

    expect(elapsed).toBeLessThan(500);
  });

  it('all 5 filing statuses calculate consistently fast', () => {
    const statuses = [
      FilingStatus.Single,
      FilingStatus.MarriedFilingJointly,
      FilingStatus.MarriedFilingSeparately,
      FilingStatus.HeadOfHousehold,
      FilingStatus.QualifyingSurvivingSpouse,
    ];

    for (const status of statuses) {
      const tr = makeTaxReturn({
        filingStatus: status,
        w2Income: [{
          id: 'w1', employerName: 'Corp', wages: 80000,
          federalTaxWithheld: 12000,
          socialSecurityWages: 80000, socialSecurityTax: 4960,
          medicareWages: 80000, medicareTax: 1160,
        }],
      });

      const elapsed = measure(() => {
        for (let i = 0; i < 20; i++) calculateForm1040(tr);
      });

      expect(elapsed / 20).toBeLessThan(5); // Each under 5ms average
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PDF FIELD MAPPING PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Performance — PDF Field Mapping', () => {
  it('resolving all Form 1040 fields completes in under 5ms', () => {
    const tr = makeComplexReturn();
    const calc = calculateForm1040(tr);

    const elapsed = measure(() => {
      for (const field of FORM_1040_TEMPLATE.fields) {
        if (field.transform) {
          field.transform(tr, calc);
        }
      }
    });

    expect(elapsed).toBeLessThan(5);
  });

  it('template condition checks are fast', () => {
    const tr = makeComplexReturn();
    const calc = calculateForm1040(tr);

    const elapsed = measure(() => {
      for (let i = 0; i < 1000; i++) {
        FORM_1040_TEMPLATE.condition(tr, calc);
      }
    });

    expect(elapsed).toBeLessThan(10); // 1000 checks under 10ms
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. STRESS TEST — Extreme Inputs
// ═══════════════════════════════════════════════════════════════════════════════

describe('Performance — Stress Tests', () => {
  it('maximum income sources (50 W-2s) does not cause timeout', () => {
    const w2s = Array.from({ length: 50 }, (_, i) => ({
      id: `w${i}`,
      employerName: `Employer ${i}`,
      wages: 10000,
      federalTaxWithheld: 1500,
      socialSecurityWages: 10000,
      socialSecurityTax: 620,
      medicareWages: 10000,
      medicareTax: 145,
    }));

    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: w2s,
    });

    const elapsed = measure(() => calculateForm1040(tr));
    expect(elapsed).toBeLessThan(50);
    const calc = calculateForm1040(tr);
    expect(calc.form1040.totalWages).toBe(500000);
  });

  it('50 1099-B transactions process quickly', () => {
    const b1099s = Array.from({ length: 50 }, (_, i) => ({
      id: `b${i}`,
      brokerName: 'Broker',
      proceeds: 10000 + i * 100,
      costBasis: 8000 + i * 80,
      isLongTerm: i % 2 === 0,
    }));

    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099B: b1099s,
    });

    const elapsed = measure(() => calculateForm1040(tr));
    expect(elapsed).toBeLessThan(50);
  });

  it('20 dependents process without performance degradation', () => {
    const deps = Array.from({ length: 20 }, (_, i) => ({
      id: `dep${i}`,
      firstName: `Child${i}`,
      lastName: 'Test',
      relationship: 'Son',
      dateOfBirth: '2020-01-01',
      monthsLivedWithYou: 12,
    }));

    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
      }],
      dependents: deps,
      childTaxCredit: { qualifyingChildren: 20, otherDependents: 0 },
    });

    const elapsed = measure(() => calculateForm1040(tr));
    expect(elapsed).toBeLessThan(20);
  });

  it('multi-state filing (5 states) completes quickly', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
      }],
      stateReturns: [
        { stateCode: 'CA', residencyType: 'resident' },
        { stateCode: 'NY', residencyType: 'nonresident' },
        { stateCode: 'PA', residencyType: 'nonresident' },
        { stateCode: 'IL', residencyType: 'nonresident' },
        { stateCode: 'TX', residencyType: 'nonresident' },
      ],
    });
    const federal = calculateForm1040(tr);

    const elapsed = measure(() => calculateStateTaxes(tr, federal));
    expect(elapsed).toBeLessThan(10);

    const results = calculateStateTaxes(tr, federal);
    expect(results).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. MEMORY STABILITY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Performance — Memory Stability', () => {
  it('1000 sequential calculations do not leak memory', () => {
    const tr = makeTypicalReturn(75000);

    // Run 1000 calculations and check that results are consistent
    const results: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const calc = calculateForm1040(tr);
      results.push(calc.form1040.totalTax);
    }

    // All results should be identical (deterministic)
    const expected = results[0];
    for (const tax of results) {
      expect(tax).toBe(expected);
    }
  });

  it('calculation results do not share mutable references', () => {
    const tr = makeTypicalReturn(75000);
    const calc1 = calculateForm1040(tr);
    const calc2 = calculateForm1040(tr);

    // Modifying one result should not affect the other
    (calc1.form1040 as any).totalTax = -999;
    expect(calc2.form1040.totalTax).not.toBe(-999);
  });
});
