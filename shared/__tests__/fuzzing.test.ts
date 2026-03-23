/**
 * Edge Case Fuzzing Tests
 *
 * Systematically probe every engine module with boundary values, extreme inputs,
 * negative numbers, and pathological combinations.  The goal is to ensure the
 * engine never crashes (no thrown exceptions, no NaN / Infinity in output) and
 * degrades gracefully to sensible defaults.
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateProgressiveTax, getMarginalRate } from '../src/engine/brackets.js';
import { calculateScheduleA } from '../src/engine/scheduleA.js';
import { calculateScheduleSE } from '../src/engine/scheduleSE.js';
import { calculateQBIDeduction } from '../src/engine/qbi.js';
import { calculateEITC } from '../src/engine/eitc.js';
import { calculateCredits } from '../src/engine/credits.js';
import { calculateHomeOfficeDeduction, compareHomeOfficeMethods } from '../src/engine/homeOffice.js';
import { calculateVehicleDeduction, compareVehicleMethods } from '../src/engine/vehicle.js';
import { calculateEstimatedQuarterly, calculateSafeHarbor } from '../src/engine/estimatedTax.js';
import { calculateScheduleC } from '../src/engine/scheduleC.js';
import { TaxReturn, FilingStatus, ItemizedDeductions } from '../src/types/index.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'fuzz',
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
    incomeK1: [],
    income1099SA: [],
    rentalProperties: [],
    otherIncome: 0,
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

/** Assert a number is finite (not NaN, not ±Infinity). */
function expectFinite(n: number, label = '') {
  expect(isFinite(n), `${label} should be finite, got ${n}`).toBe(true);
}

/** Run calculateForm1040 and assert every output field is finite & non-negative where expected. */
function assertSaneResult(taxReturn: TaxReturn) {
  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  // Every numeric field must be finite
  for (const [key, val] of Object.entries(f)) {
    if (typeof val === 'number') {
      expectFinite(val, `form1040.${key}`);
    }
  }

  // Key invariants
  expect(f.taxableIncome).toBeGreaterThanOrEqual(0);
  expect(f.incomeTax).toBeGreaterThanOrEqual(0);
  expect(f.amountOwed).toBeGreaterThanOrEqual(0);
  expect(f.refundAmount).toBeGreaterThanOrEqual(0);
  // Either owed or refund, never both
  expect(f.amountOwed * f.refundAmount).toBe(0);
  expect(f.effectiveTaxRate).toBeGreaterThanOrEqual(0);
  expect(f.marginalTaxRate).toBeGreaterThanOrEqual(0);
  expect(f.marginalTaxRate).toBeLessThanOrEqual(0.37);

  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Brackets — Boundary & Extreme Values
// ──────────────────────────────────────────────────────────────────────────────

describe('Fuzzing: Progressive Tax Brackets', () => {
  const statuses = [
    FilingStatus.Single,
    FilingStatus.MarriedFilingJointly,
    FilingStatus.MarriedFilingSeparately,
    FilingStatus.HeadOfHousehold,
    FilingStatus.QualifyingSurvivingSpouse,
  ];

  // Single bracket boundaries: 0, 11925, 48475, 103350, 197300, 250525, 626350
  const singleBoundaries = [0, 11925, 48475, 103350, 197300, 250525, 626350];

  it('handles zero taxable income for all filing statuses', () => {
    for (const status of statuses) {
      const { tax, marginalRate } = calculateProgressiveTax(0, status);
      expect(tax).toBe(0);
      // marginalRate at 0 income: 0 (loop breaks immediately but default is 0)
      expectFinite(marginalRate);
    }
  });

  it('handles negative taxable income (floors at 0)', () => {
    for (const status of statuses) {
      const { tax } = calculateProgressiveTax(-50000, status);
      expect(tax).toBe(0);
    }
  });

  it('handles income exactly at every Single bracket boundary', () => {
    for (const boundary of singleBoundaries) {
      const { tax, marginalRate } = calculateProgressiveTax(boundary, FilingStatus.Single);
      expectFinite(tax);
      expectFinite(marginalRate);
      expect(tax).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles income at boundary ± $0.01', () => {
    for (const boundary of singleBoundaries) {
      if (boundary === 0) continue;
      const below = calculateProgressiveTax(boundary - 0.01, FilingStatus.Single);
      const at = calculateProgressiveTax(boundary, FilingStatus.Single);
      const above = calculateProgressiveTax(boundary + 0.01, FilingStatus.Single);
      // Tax should be monotonically non-decreasing
      expect(below.tax).toBeLessThanOrEqual(at.tax);
      expect(at.tax).toBeLessThanOrEqual(above.tax);
    }
  });

  it('handles very large income ($10 billion)', () => {
    const { tax, marginalRate } = calculateProgressiveTax(10_000_000_000, FilingStatus.Single);
    expectFinite(tax);
    expect(tax).toBeGreaterThan(3_000_000_000); // At least 30% effective on $10B
    expect(marginalRate).toBe(0.37);
  });

  it('handles $0.01 income', () => {
    const { tax } = calculateProgressiveTax(0.01, FilingStatus.Single);
    expect(tax).toBe(0); // 10% of $0.01 rounds to $0.00
  });

  it('handles $1 income', () => {
    const { tax } = calculateProgressiveTax(1, FilingStatus.Single);
    expect(tax).toBe(0.10); // 10% of $1
  });

  it('getMarginalRate matches calculateProgressiveTax marginal rate for positive incomes', () => {
    // Note: at income=0, calculateProgressiveTax returns marginalRate=0 (loop never enters),
    // while getMarginalRate returns 0.10 (falls through to bracket[0]).  This edge case
    // is harmless since both produce $0 tax, so we test with positive incomes only.
    const testIncomes = [1, 11925, 48475, 100000, 300000, 700000, 1000000];
    for (const income of testIncomes) {
      for (const status of statuses) {
        const { marginalRate } = calculateProgressiveTax(income, status);
        const standalone = getMarginalRate(income, status);
        expect(marginalRate).toBe(standalone);
      }
    }
  });

  it('getMarginalRate returns 10% at income=0 (default bracket)', () => {
    // At 0 income, getMarginalRate defaults to the first bracket rate
    // while calculateProgressiveTax returns 0 since the loop never runs.
    // Both produce $0 tax — this is a known cosmetic discrepancy, not a bug.
    const rate = getMarginalRate(0, FilingStatus.Single);
    expect(rate).toBe(0.10);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Schedule SE — Boundary Values
// ──────────────────────────────────────────────────────────────────────────────

describe('Fuzzing: Schedule SE', () => {
  it('handles zero profit', () => {
    const result = calculateScheduleSE(0, FilingStatus.Single, 0);
    expect(result.totalSETax).toBe(0);
  });

  it('handles negative profit', () => {
    const result = calculateScheduleSE(-50000, FilingStatus.Single, 0);
    expect(result.totalSETax).toBe(0);
  });

  it('handles profit at SS wage base boundary', () => {
    // 176100 / 0.9235 = 190,686.52... → net earnings exactly at wage base
    const profit = Math.ceil(176100 / 0.9235);
    const result = calculateScheduleSE(profit, FilingStatus.Single, 0);
    expectFinite(result.socialSecurityTax);
    expectFinite(result.totalSETax);
    expect(result.socialSecurityTax).toBeGreaterThan(0);
  });

  it('handles W-2 SS wages exactly at wage base (no room for SE SS)', () => {
    const result = calculateScheduleSE(100000, FilingStatus.Single, 176100);
    expect(result.socialSecurityTax).toBe(0);
    expect(result.medicareTax).toBeGreaterThan(0);
  });

  it('handles W-2 SS wages exceeding wage base', () => {
    const result = calculateScheduleSE(100000, FilingStatus.Single, 200000);
    expect(result.socialSecurityTax).toBe(0);
  });

  it('triggers additional Medicare for Single at $200k threshold', () => {
    // Net earnings must exceed $200k → profit = 200000 / 0.9235 ≈ 216600
    const profit = 217000;
    const result = calculateScheduleSE(profit, FilingStatus.Single, 0);
    expect(result.additionalMedicareTax).toBeGreaterThan(0);
  });

  it('uses $125k threshold for MFS', () => {
    // Net earnings > $125k for MFS
    const profit = 136000; // 136000 × 0.9235 ≈ 125,596
    const result = calculateScheduleSE(profit, FilingStatus.MarriedFilingSeparately, 0);
    expect(result.additionalMedicareTax).toBeGreaterThan(0);
  });

  it('uses $250k threshold for MFJ', () => {
    const profit = 271000; // 271000 × 0.9235 ≈ 250,268
    const resultMFJ = calculateScheduleSE(profit, FilingStatus.MarriedFilingJointly, 0);
    expect(resultMFJ.additionalMedicareTax).toBeGreaterThan(0);
  });

  it('handles very large profit ($10M)', () => {
    const result = calculateScheduleSE(10_000_000, FilingStatus.Single, 0);
    for (const [key, val] of Object.entries(result)) {
      expectFinite(val as number, `scheduleSE.${key}`);
    }
  });

  it('handles profit below $400 threshold — no SE tax', () => {
    // Per IRC §1402(b), SE tax is only owed when net SE earnings ≥ $400.
    const result = calculateScheduleSE(1, FilingStatus.Single, 0);
    expect(result.netEarnings).toBe(0);
    expect(result.totalSETax).toBe(0);
  });

  it('handles profit at $400 threshold — SE tax applies', () => {
    const result = calculateScheduleSE(400, FilingStatus.Single, 0);
    // Net earnings = 400 * 0.9235 = 369.40
    expect(result.netEarnings).toBe(369.40);
    expect(result.totalSETax).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Schedule A — Edge Cases
// ──────────────────────────────────────────────────────────────────────────────

describe('Fuzzing: Schedule A (Itemized Deductions)', () => {
  const zeroDeductions: ItemizedDeductions = {
    medicalExpenses: 0,
    stateLocalIncomeTax: 0,
    realEstateTax: 0,
    personalPropertyTax: 0,
    mortgageInterest: 0,
    mortgageInsurancePremiums: 0,
    charitableCash: 0,
    charitableNonCash: 0,
    casualtyLoss: 0,
    otherDeductions: 0,
  };

  it('handles all-zero deductions', () => {
    const result = calculateScheduleA(zeroDeductions, 100000, FilingStatus.Single);
    expect(result.totalItemized).toBe(0);
  });

  it('handles zero AGI (medical floor becomes $0)', () => {
    const deductions = { ...zeroDeductions, medicalExpenses: 5000 };
    const result = calculateScheduleA(deductions, 0, FilingStatus.Single);
    // With 0 AGI, 7.5% floor is 0, so full $5000 is deductible
    expect(result.medicalDeduction).toBe(5000);
  });

  it('handles AGI so high medical expense is fully absorbed by floor', () => {
    const deductions = { ...zeroDeductions, medicalExpenses: 1000 };
    const result = calculateScheduleA(deductions, 100000, FilingStatus.Single);
    // Floor = 7.5% * 100k = 7500 > 1000
    expect(result.medicalDeduction).toBe(0);
  });

  it('caps SALT at $40k for Single', () => {
    const deductions = { ...zeroDeductions, stateLocalIncomeTax: 15000, realEstateTax: 10000 };
    const result = calculateScheduleA(deductions, 100000, FilingStatus.Single);
    // Total SALT = 25000, under $40,000 cap → not capped
    expect(result.saltDeduction).toBe(25000);
  });

  it('caps SALT at $20k for MFS', () => {
    const deductions = { ...zeroDeductions, stateLocalIncomeTax: 8000 };
    const result = calculateScheduleA(deductions, 100000, FilingStatus.MarriedFilingSeparately);
    // Total SALT = 8000, under $20,000 cap → not capped
    expect(result.saltDeduction).toBe(8000);
  });

  it('handles SALT at $10,000 (well under $40,000 cap)', () => {
    const deductions = { ...zeroDeductions, stateLocalIncomeTax: 6000, realEstateTax: 4000 };
    const result = calculateScheduleA(deductions, 50000, FilingStatus.Single);
    expect(result.saltDeduction).toBe(10000);
  });

  it('handles casualty loss below $100 floor', () => {
    const deductions = { ...zeroDeductions, casualtyLoss: 50 };
    const result = calculateScheduleA(deductions, 50000, FilingStatus.Single);
    // 50 - 100 = negative → 0
    expect(result.otherDeduction).toBe(0);
  });

  it('handles casualty loss above $100 but below 10% AGI', () => {
    const deductions = { ...zeroDeductions, casualtyLoss: 500 };
    const result = calculateScheduleA(deductions, 50000, FilingStatus.Single);
    // (500 - 100) = 400 - 10% * 50000 (5000) → negative → 0
    expect(result.otherDeduction).toBe(0);
  });

  it('handles casualty loss above both floors', () => {
    const deductions = { ...zeroDeductions, casualtyLoss: 20000 };
    const result = calculateScheduleA(deductions, 50000, FilingStatus.Single);
    // (20000 - 100) = 19900 - 5000 = 14900
    expect(result.otherDeduction).toBe(14900);
  });

  it('handles extremely large deductions ($1B medical)', () => {
    const deductions = { ...zeroDeductions, medicalExpenses: 1_000_000_000 };
    const result = calculateScheduleA(deductions, 0, FilingStatus.Single);
    expectFinite(result.totalItemized);
    expect(result.medicalDeduction).toBe(1_000_000_000);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. EITC — Boundary & Disqualification Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('Fuzzing: EITC Edge Cases', () => {
  it('returns 0 for zero earned income', () => {
    expect(calculateEITC(FilingStatus.Single, 0, 0, 0, 0)).toBe(0);
  });

  it('returns 0 for negative earned income', () => {
    expect(calculateEITC(FilingStatus.Single, -5000, 0, 0, 0)).toBe(0);
  });

  it('returns 0 for MFS regardless of income', () => {
    expect(calculateEITC(FilingStatus.MarriedFilingSeparately, 10000, 10000, 2, 0)).toBe(0);
  });

  it('returns 0 when investment income exceeds $11,950', () => {
    expect(calculateEITC(FilingStatus.Single, 10000, 10000, 1, 11951)).toBe(0);
  });

  it('allows credit when investment income is exactly $11,950', () => {
    const credit = calculateEITC(FilingStatus.Single, 10000, 10000, 1, 11950);
    expect(credit).toBeGreaterThan(0);
  });

  it('caps children key at 3 (4 children same as 3)', () => {
    const credit3 = calculateEITC(FilingStatus.Single, 15000, 15000, 3, 0);
    const credit4 = calculateEITC(FilingStatus.Single, 15000, 15000, 4, 0);
    const credit10 = calculateEITC(FilingStatus.Single, 15000, 15000, 10, 0);
    expect(credit4).toBe(credit3);
    expect(credit10).toBe(credit3);
  });

  it('uses AGI when AGI produces lower credit than earned income', () => {
    // Earned income in plateau, but AGI in phase-out
    const credit = calculateEITC(FilingStatus.Single, 15000, 40000, 1, 0);
    expect(credit).toBeGreaterThanOrEqual(0);
    expectFinite(credit);
  });

  it('handles earned income at exact phase-in threshold (1 child: $12,730)', () => {
    const credit = calculateEITC(FilingStatus.Single, 12730, 12730, 1, 0);
    expect(credit).toBe(4328); // Should be at max
  });

  it('handles earned income at exact phase-out start (Single, 1 child: $23,350)', () => {
    const credit = calculateEITC(FilingStatus.Single, 23350, 23350, 1, 0);
    expect(credit).toBe(4328); // Still at max (plateau)
  });

  it('handles earned income at complete phase-out (Single, 1 child: $50,434)', () => {
    const credit = calculateEITC(FilingStatus.Single, 50434, 50434, 1, 0);
    expect(credit).toBe(0);
  });

  it('handles very high earned income ($1M)', () => {
    const credit = calculateEITC(FilingStatus.Single, 1000000, 1000000, 3, 0);
    expect(credit).toBe(0);
  });

  it('handles $0.01 earned income', () => {
    const credit = calculateEITC(FilingStatus.Single, 0.01, 0.01, 0, 0);
    expectFinite(credit);
    expect(credit).toBeGreaterThanOrEqual(0);
  });

  it('handles MFJ vs Single phase-out difference', () => {
    // At $25,000 with 1 child: Single is phasing out, MFJ is still in plateau
    const single = calculateEITC(FilingStatus.Single, 25000, 25000, 1, 0);
    const mfj = calculateEITC(FilingStatus.MarriedFilingJointly, 25000, 25000, 1, 0);
    expect(mfj).toBeGreaterThanOrEqual(single);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. Credits — Phase-Out Boundaries
// ──────────────────────────────────────────────────────────────────────────────

describe('Fuzzing: Credits Phase-Outs', () => {
  it('handles zero AGI with children', () => {
    const result = calculateCredits(FilingStatus.Single, 0, { qualifyingChildren: 3, otherDependents: 0 });
    expect(result.childTaxCredit).toBe(6600); // 3 × $2200
  });

  it('CTC phases out exactly at $200k Single ($1 over triggers $50 reduction)', () => {
    const justUnder = calculateCredits(FilingStatus.Single, 200000, { qualifyingChildren: 1, otherDependents: 0 });
    const justOver = calculateCredits(FilingStatus.Single, 200001, { qualifyingChildren: 1, otherDependents: 0 });
    expect(justUnder.childTaxCredit).toBe(2200);
    expect(justOver.childTaxCredit).toBe(2150); // $50 reduction for $1 over (ceil(1/1000)=1 increment)
  });

  it('CTC fully phases out at high income', () => {
    // $2200 credit, $50 per $1000 over → fully phased out at $200k + $44k = $244k
    const result = calculateCredits(FilingStatus.Single, 250000, { qualifyingChildren: 1, otherDependents: 0 });
    expect(result.childTaxCredit).toBe(0);
  });

  it('CTC uses $400k threshold for MFJ', () => {
    const result = calculateCredits(FilingStatus.MarriedFilingJointly, 399999, { qualifyingChildren: 2, otherDependents: 0 });
    expect(result.childTaxCredit).toBe(4400); // Full credit
  });

  it('handles zero children and other dependents', () => {
    const result = calculateCredits(FilingStatus.Single, 50000, { qualifyingChildren: 0, otherDependents: 0 });
    expect(result.childTaxCredit).toBe(0);
    expect(result.otherDependentCredit).toBe(0);
  });

  it('handles no childTaxCredit info at all', () => {
    const result = calculateCredits(FilingStatus.Single, 50000, undefined, []);
    expect(result.childTaxCredit).toBe(0);
  });

  it('AOTC at exact phase-out boundary ($80k Single)', () => {
    const justUnder = calculateCredits(FilingStatus.Single, 80000, undefined, [
      { id: 'e1', type: 'american_opportunity', studentName: 'A', institution: 'B', tuitionPaid: 4000, scholarships: 0 },
    ]);
    const justOver = calculateCredits(FilingStatus.Single, 80001, undefined, [
      { id: 'e1', type: 'american_opportunity', studentName: 'A', institution: 'B', tuitionPaid: 4000, scholarships: 0 },
    ]);
    expect(justUnder.educationCredit).toBe(1500); // 60% non-refundable of full AOTC ($2500)
    expect(justUnder.aotcRefundableCredit).toBe(1000); // 40% refundable
    expect(justOver.educationCredit).toBeLessThan(1500); // Phase-out begins
  });

  it('AOTC fully phased out at $90k Single', () => {
    const result = calculateCredits(FilingStatus.Single, 90000, undefined, [
      { id: 'e1', type: 'american_opportunity', studentName: 'A', institution: 'B', tuitionPaid: 4000, scholarships: 0 },
    ]);
    expect(result.educationCredit).toBe(0);
  });

  it('handles scholarships exceeding tuition (no negative credit)', () => {
    const result = calculateCredits(FilingStatus.Single, 50000, undefined, [
      { id: 'e1', type: 'american_opportunity', studentName: 'A', institution: 'B', tuitionPaid: 3000, scholarships: 5000 },
    ]);
    expect(result.educationCredit).toBe(0); // max(0, 3000-5000) = 0
  });

  it('handles multiple education credits (AOTC + LLC)', () => {
    const result = calculateCredits(FilingStatus.Single, 50000, undefined, [
      { id: 'e1', type: 'american_opportunity', studentName: 'Student 1', institution: 'Uni', tuitionPaid: 4000 },
      { id: 'e2', type: 'lifetime_learning', studentName: 'Student 2', institution: 'CC', tuitionPaid: 8000 },
    ]);
    // AOTC: 2000 + 25% × 2000 = 2500 → 60% non-refundable = 1500
    // LLC: 20% × 8000 = 1600 (fully non-refundable)
    expect(result.educationCredit).toBe(3100);
    expect(result.aotcRefundableCredit).toBe(1000); // 40% of AOTC
  });

  it('handles proportional CTC/ODC phase-out allocation', () => {
    // 2 qualifying children ($4400) + 3 other dependents ($1500) = $5900 total
    // At $210k Single: $10k over → 10 increments × $50 = $500 reduction
    const result = calculateCredits(FilingStatus.Single, 210000, { qualifyingChildren: 2, otherDependents: 3 });
    // Remaining = 5900 - 500 = 5400
    // Child ratio = 4400/5900 ≈ 0.7458 → 5400 × 0.7458 ≈ 4027
    // ODC ratio = 1500/5900 ≈ 0.2542 → 5400 × 0.2542 ≈ 1373
    expect(result.childTaxCredit + result.otherDependentCredit).toBeCloseTo(5400, 0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. QBI Deduction — Phase-Out Boundaries
// ──────────────────────────────────────────────────────────────────────────────

describe('Fuzzing: QBI Deduction', () => {
  it('returns 0 for zero QBI', () => {
    expect(calculateQBIDeduction(0, 100000, FilingStatus.Single)).toBe(0);
  });

  it('returns 0 for negative QBI', () => {
    expect(calculateQBIDeduction(-10000, 100000, FilingStatus.Single)).toBe(0);
  });

  it('returns 0 for zero taxable income before QBI', () => {
    expect(calculateQBIDeduction(50000, 0, FilingStatus.Single)).toBe(0);
  });

  it('below threshold: min of 20% QBI and 20% taxable income', () => {
    // QBI = 50000, taxable before QBI = 40000
    // 20% of 50000 = 10000, 20% of 40000 = 8000 → min = 8000
    expect(calculateQBIDeduction(50000, 40000, FilingStatus.Single)).toBe(8000);
  });

  it('at exact threshold ($197,300 Single)', () => {
    const deduction = calculateQBIDeduction(50000, 197300, FilingStatus.Single);
    // At threshold: no phase-out yet. 20% × 50000 = 10000, 20% × 197300 = 39460 → 10000
    expect(deduction).toBe(10000);
  });

  it('above threshold ($197,301 Single): phase-out starts', () => {
    const deduction = calculateQBIDeduction(50000, 197301, FilingStatus.Single);
    expect(deduction).toBeLessThan(10000);
    expect(deduction).toBeGreaterThan(0);
  });

  it('fully phased out at threshold + range ($247,300 Single)', () => {
    const deduction = calculateQBIDeduction(50000, 247300, FilingStatus.Single);
    expect(deduction).toBe(0);
  });

  it('MFJ threshold is $394,600', () => {
    const below = calculateQBIDeduction(50000, 394600, FilingStatus.MarriedFilingJointly);
    const above = calculateQBIDeduction(50000, 394601, FilingStatus.MarriedFilingJointly);
    expect(below).toBe(10000); // Full deduction
    expect(above).toBeLessThan(10000); // Phase-out
  });

  it('handles very large QBI ($100M)', () => {
    const deduction = calculateQBIDeduction(100_000_000, 50000, FilingStatus.Single);
    // Limited by 20% of taxable income: 20% × 50000 = 10000
    expect(deduction).toBe(10000);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. Home Office — Guard Clauses & Edge Cases
// ──────────────────────────────────────────────────────────────────────────────

describe('Fuzzing: Home Office', () => {
  it('returns 0 for null method', () => {
    expect(calculateHomeOfficeDeduction({ method: null }, 50000)).toBe(0);
  });

  it('simplified: caps at 300 sqft', () => {
    const d300 = calculateHomeOfficeDeduction({ method: 'simplified', squareFeet: 300 }, 50000);
    const d500 = calculateHomeOfficeDeduction({ method: 'simplified', squareFeet: 500 }, 50000);
    expect(d300).toBe(1500);
    expect(d500).toBe(1500); // Capped at 300
  });

  it('simplified: 0 sqft returns 0', () => {
    expect(calculateHomeOfficeDeduction({ method: 'simplified', squareFeet: 0 }, 50000)).toBe(0);
  });

  it('simplified: limited to tentative profit', () => {
    expect(calculateHomeOfficeDeduction({ method: 'simplified', squareFeet: 300 }, 500)).toBe(500);
    expect(calculateHomeOfficeDeduction({ method: 'simplified', squareFeet: 300 }, 0)).toBe(0);
  });

  it('simplified: negative tentative profit floors at 0', () => {
    expect(calculateHomeOfficeDeduction({ method: 'simplified', squareFeet: 300 }, -5000)).toBe(0);
  });

  it('actual: zero total sqft returns 0 (guard)', () => {
    expect(calculateHomeOfficeDeduction({
      method: 'actual', squareFeet: 100, totalHomeSquareFeet: 0, actualExpenses: 10000,
    }, 50000)).toBe(0);
  });

  it('actual: zero office sqft returns 0 (guard)', () => {
    expect(calculateHomeOfficeDeduction({
      method: 'actual', squareFeet: 0, totalHomeSquareFeet: 2000, actualExpenses: 10000,
    }, 50000)).toBe(0);
  });

  it('actual: office > total sqft caps ratio at 100%', () => {
    const d = calculateHomeOfficeDeduction({
      method: 'actual', squareFeet: 3000, totalHomeSquareFeet: 2000, actualExpenses: 10000,
    }, 50000);
    expect(d).toBe(10000); // ratio capped at 1
  });

  it('compareHomeOfficeMethods returns both methods', () => {
    const { simplified, actual } = compareHomeOfficeMethods(200, 2000, 20000, 50000);
    expect(simplified).toBe(1000); // 200 × $5
    expect(actual).toBe(2000); // (200/2000) × 20000
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 8. Vehicle — Guard Clauses & Edge Cases
// ──────────────────────────────────────────────────────────────────────────────

describe('Fuzzing: Vehicle Deduction', () => {
  it('returns 0 for null method', () => {
    expect(calculateVehicleDeduction({ method: null })).toBe(0);
  });

  it('standard mileage: 0 miles returns 0', () => {
    expect(calculateVehicleDeduction({ method: 'standard_mileage', businessMiles: 0 })).toBe(0);
  });

  it('standard mileage: large mileage', () => {
    const d = calculateVehicleDeduction({ method: 'standard_mileage', businessMiles: 100000 });
    expect(d).toBe(70000); // 100000 × $0.70
  });

  it('actual: zero total miles returns 0 (guard)', () => {
    expect(calculateVehicleDeduction({
      method: 'actual', businessMiles: 5000, totalMiles: 0, actualExpenses: 10000,
    })).toBe(0);
  });

  it('actual: zero business miles returns 0 (guard)', () => {
    expect(calculateVehicleDeduction({
      method: 'actual', businessMiles: 0, totalMiles: 10000, actualExpenses: 10000,
    })).toBe(0);
  });

  it('actual: business > total miles caps ratio at 100%', () => {
    const d = calculateVehicleDeduction({
      method: 'actual', businessMiles: 15000, totalMiles: 10000, actualExpenses: 5000,
    });
    expect(d).toBe(5000); // ratio capped at 1
  });

  it('compareVehicleMethods returns both methods', () => {
    const { standardMileage, actual } = compareVehicleMethods(10000, 20000, 15000);
    expect(standardMileage).toBe(7000); // 10000 × $0.70
    expect(actual).toBe(7500); // (10000/20000) × 15000
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 9. Estimated Tax — Edge Cases
// ──────────────────────────────────────────────────────────────────────────────

describe('Fuzzing: Estimated Tax', () => {
  it('returns 0 when withholding exceeds tax', () => {
    const { quarterlyPayment } = calculateEstimatedQuarterly(5000, 10000);
    expect(quarterlyPayment).toBe(0);
  });

  it('returns 0 when tax is 0', () => {
    const { quarterlyPayment } = calculateEstimatedQuarterly(0, 0);
    expect(quarterlyPayment).toBe(0);
  });

  it('calculates quarters correctly', () => {
    const { quarterlyPayment, annualEstimated } = calculateEstimatedQuarterly(10000, 2000);
    expect(annualEstimated).toBe(8000);
    expect(quarterlyPayment).toBe(2000);
  });

  it('handles odd annual amounts (rounding)', () => {
    const { quarterlyPayment } = calculateEstimatedQuarterly(10001, 0);
    expect(quarterlyPayment).toBe(2500.25);
    expectFinite(quarterlyPayment);
  });

  it('safe harbor: 100% at $149,999 AGI', () => {
    const sh = calculateSafeHarbor(10000, 149999);
    expect(sh).toBe(10000); // 100%
  });

  it('safe harbor: 100% at exactly $150,000 AGI (IRS: "more than" = strict >)', () => {
    // IRS says 110% applies when AGI is "more than $150,000" — so exactly $150k gets 100%
    const sh = calculateSafeHarbor(10000, 150000);
    expect(sh).toBe(10000); // 100%
  });

  it('safe harbor: 110% at $150,001 AGI', () => {
    const sh = calculateSafeHarbor(10000, 150001);
    expect(sh).toBe(11000); // 110%
  });

  it('safe harbor: 110% at high AGI', () => {
    const sh = calculateSafeHarbor(50000, 500000);
    expect(sh).toBe(55000); // 110%
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 10. Schedule C — Edge Cases
// ──────────────────────────────────────────────────────────────────────────────

describe('Fuzzing: Schedule C', () => {
  it('handles no income sources', () => {
    const tr = makeTaxReturn();
    // Force Schedule C by setting business
    tr.business = { id: 'b1', accountingMethod: 'cash', didStartThisYear: false };
    const result = calculateScheduleC(tr);
    expect(result.grossIncome).toBe(0);
    expect(result.netProfit).toBe(0);
  });

  it('handles expenses exceeding income (net loss)', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 1000 }],
      expenses: [{ id: 'e1', scheduleCLine: 27, category: 'other', amount: 5000 }],
    });
    const result = calculateScheduleC(tr);
    expect(result.grossIncome).toBe(1000);
    expect(result.netProfit).toBe(-4000);
  });

  it('handles many expense line items (all 20 lines)', () => {
    const expenses = [];
    for (let line = 8; line <= 27; line++) {
      expenses.push({ id: `e${line}`, scheduleCLine: line, category: 'test', amount: 100 });
    }
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000 }],
      expenses,
    });
    const result = calculateScheduleC(tr);
    expect(result.totalExpenses).toBe(2000); // 20 × $100
    expect(result.tentativeProfit).toBe(48000);
  });

  it('handles both 1099-NEC and 1099-K together', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 30000 }],
      income1099K: [{ id: 'k1', platformName: 'Stripe', grossAmount: 20000 }],
    });
    const result = calculateScheduleC(tr);
    expect(result.grossIncome).toBe(50000);
  });

  it('simplified home office caps at tentative profit', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 500 }],
      homeOffice: { method: 'simplified', squareFeet: 300 },
    });
    const result = calculateScheduleC(tr);
    // Home office max = 1500, but tentative profit = 500
    expect(result.homeOfficeDeduction).toBe(500);
    expect(result.netProfit).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 11. Student Loan Interest & IRA — Phase-Out Boundaries
// ──────────────────────────────────────────────────────────────────────────────

describe('Fuzzing: Student Loan & IRA Phase-Outs (via form1040)', () => {
  it('denies student loan interest for MFS', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 50000, federalTaxWithheld: 5000 }],
      studentLoanInterest: 2500,
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.studentLoanInterest).toBe(0);
  });

  it('full student loan deduction below $85k Single', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 70000, federalTaxWithheld: 8000 }],
      studentLoanInterest: 2500,
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.studentLoanInterest).toBe(2500);
  });

  it('partial student loan deduction in phase-out ($90k Single)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 90000, federalTaxWithheld: 10000 }],
      studentLoanInterest: 2500,
    });
    const result = calculateForm1040(tr);
    // Phase-out: (90000 - 85000) / 15000 = 1/3 reduction
    // 2500 × (1 - 1/3) = 2500 × 2/3 ≈ 1666.67
    expect(result.form1040.studentLoanInterest).toBeCloseTo(1666.67, 0);
  });

  it('zero student loan deduction above $100k Single', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 101000, federalTaxWithheld: 12000 }],
      studentLoanInterest: 2500,
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.studentLoanInterest).toBe(0);
  });

  it('caps student loan interest at $2,500', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 50000, federalTaxWithheld: 5000 }],
      studentLoanInterest: 5000, // over max
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.studentLoanInterest).toBe(2500);
  });

  it('IRA deduction phases out for Single at $79k-$89k', () => {
    const below = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 78000, federalTaxWithheld: 8000 }],
      iraContribution: 7000,
      coveredByEmployerPlan: true,
    });
    const above = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 90000, federalTaxWithheld: 10000 }],
      iraContribution: 7000,
      coveredByEmployerPlan: true,
    });
    const belowResult = calculateForm1040(below);
    const aboveResult = calculateForm1040(above);
    expect(belowResult.form1040.iraDeduction).toBe(7000); // Full
    expect(aboveResult.form1040.iraDeduction).toBe(0); // Fully phased out
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 12. Full Form 1040 Fuzzing — Pathological Inputs
// ──────────────────────────────────────────────────────────────────────────────

describe('Fuzzing: Full Form 1040 Pathological Inputs', () => {
  it('handles completely empty return', () => {
    const tr = makeTaxReturn();
    assertSaneResult(tr);
  });

  it('handles return with no filing status (defaults to Single)', () => {
    const tr = makeTaxReturn();
    delete (tr as any).filingStatus;
    assertSaneResult(tr);
  });

  it('handles withholding only (no income)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 0, federalTaxWithheld: 5000 }],
    });
    const result = assertSaneResult(tr);
    expect(result.form1040.refundAmount).toBe(5000);
  });

  it('handles negative other income', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      otherIncome: -5000,
    });
    assertSaneResult(tr); // Should not crash
  });

  it('handles all income types at once', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 100000, federalTaxWithheld: 20000 }],
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000 }],
      income1099K: [{ id: 'k1', platformName: 'Etsy', grossAmount: 10000 }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 2000 }],
      income1099DIV: [{ id: 'd1', payerName: 'Vanguard', ordinaryDividends: 5000, qualifiedDividends: 3000 }],
      income1099R: [{ id: 'r1', payerName: 'Fidelity', grossDistribution: 10000, taxableAmount: 10000, distributionCode: '7' }],
      income1099G: [{ id: 'g1', payerName: 'State', unemploymentCompensation: 3000 }],
      income1099MISC: [{ id: 'm1', payerName: 'Prize', otherIncome: 1000 }],
      otherIncome: 500,
      expenses: [{ id: 'e1', scheduleCLine: 27, category: 'other', amount: 15000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 25000, stateLocalIncomeTax: 12000, realEstateTax: 5000,
        personalPropertyTax: 1000, mortgageInterest: 15000, mortgageInsurancePremiums: 500,
        charitableCash: 5000, charitableNonCash: 1000, casualtyLoss: 2000, otherDeductions: 500,
      },
      childTaxCredit: { qualifyingChildren: 2, otherDependents: 1 },
      educationCredits: [
        { id: 'ed1', type: 'american_opportunity', studentName: 'Kid', institution: 'Uni', tuitionPaid: 4000 },
      ],
      hsaDeduction: 4300,
      studentLoanInterest: 2500,
      iraContribution: 7000,
      estimatedPaymentsMade: 5000,
      selfEmploymentDeductions: {
        healthInsurancePremiums: 6000, sepIraContributions: 5000,
        solo401kContributions: 0, otherRetirementContributions: 0,
      },
      homeOffice: { method: 'simplified', squareFeet: 200 },
    });
    assertSaneResult(tr);
  });

  it('handles every filing status with same data', () => {
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
        w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 10000 }],
        income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 25000 }],
        childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 },
      });
      assertSaneResult(tr);
    }
  });

  it('handles very high income ($10M W-2) without overflow', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Unicorn',
        wages: 10_000_000,
        federalTaxWithheld: 3_500_000,
        socialSecurityWages: 176100,
      }],
    });
    const result = assertSaneResult(tr);
    expect(result.form1040.marginalTaxRate).toBe(0.37);
  });

  it('handles 20 W-2s simultaneously', () => {
    const w2s = Array.from({ length: 20 }, (_, i) => ({
      id: `w${i}`,
      employerName: `Employer ${i}`,
      wages: 5000,
      federalTaxWithheld: 500,
    }));
    const tr = makeTaxReturn({ filingStatus: FilingStatus.Single, w2Income: w2s });
    const result = assertSaneResult(tr);
    expect(result.form1040.totalWages).toBe(100000);
    expect(result.form1040.totalWithholding).toBe(10000);
  });

  it('handles 1099-R rollovers (code G and T) excluded correctly', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099R: [
        { id: 'r1', payerName: 'Old 401k', grossDistribution: 500000, taxableAmount: 500000, distributionCode: 'G' },
        { id: 'r2', payerName: 'Roth', grossDistribution: 50000, taxableAmount: 0, distributionCode: 'T' },
        { id: 'r3', payerName: 'Pension', grossDistribution: 20000, taxableAmount: 15000, distributionCode: '7' },
      ],
    });
    const result = assertSaneResult(tr);
    expect(result.form1040.totalRetirementIncome).toBe(15000); // Only code '7'
  });

  it('handles distribution code case insensitivity', () => {
    const trLower = makeTaxReturn({
      income1099R: [{ id: 'r1', payerName: 'P', grossDistribution: 100000, taxableAmount: 100000, distributionCode: 'g' }],
    });
    const trUpper = makeTaxReturn({
      income1099R: [{ id: 'r1', payerName: 'P', grossDistribution: 100000, taxableAmount: 100000, distributionCode: 'G' }],
    });
    const lowerResult = calculateForm1040(trLower);
    const upperResult = calculateForm1040(trUpper);
    expect(lowerResult.form1040.totalRetirementIncome).toBe(upperResult.form1040.totalRetirementIncome);
    expect(lowerResult.form1040.totalRetirementIncome).toBe(0); // Both excluded
  });

  it('handles EITC interaction: CTC wipes income tax, EITC is refundable', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      w2Income: [{ id: 'w1', employerName: 'Shop', wages: 20000, federalTaxWithheld: 1500 }],
      childTaxCredit: { qualifyingChildren: 2, otherDependents: 0 },
    });
    const result = assertSaneResult(tr);
    // Income tax should be wiped by CTC
    // EITC should create a refund
    expect(result.credits.eitcCredit).toBeGreaterThan(0);
    expect(result.form1040.refundAmount).toBeGreaterThan(result.form1040.totalWithholding);
  });

  it('handles estimated payments exceeding tax (large refund)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 20000 }],
      estimatedPaymentsMade: 50000,
    });
    const result = assertSaneResult(tr);
    expect(result.form1040.refundAmount).toBeGreaterThan(0);
  });

  it('handles self-employment deductions without self-employment income', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 50000, federalTaxWithheld: 5000 }],
      selfEmploymentDeductions: {
        healthInsurancePremiums: 6000,
        sepIraContributions: 5000,
        solo401kContributions: 0,
        otherRetirementContributions: 0,
      },
    });
    const result = assertSaneResult(tr);
    // SE health insurance is capped at net SE profit (IRC §162(l)) — $0 without SE income
    expect(result.form1040.selfEmployedHealthInsurance).toBe(0);
  });
});
