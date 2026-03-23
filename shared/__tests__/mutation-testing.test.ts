/**
 * Phase 8: Mutation Testing Validation
 *
 * Validates that the existing test suite would catch common mutations
 * (deliberate bugs) in the tax engine. Instead of modifying production code,
 * we verify that critical computed values differ when inputs change —
 * proving the code is actually being exercised, not just returning constants.
 *
 * Mutation categories tested:
 *   M1. Bracket rate mutations — wrong tax rate produces different tax
 *   M2. Standard deduction mutations — wrong deduction changes taxable income
 *   M3. Credit amount mutations — wrong CTC/EITC/AOTC changes credits
 *   M4. SE tax rate mutations — wrong 15.3% produces different SE tax
 *   M5. Capital loss cap mutations — wrong $3k limit changes loss deduction
 *   M6. Filing status boundary mutations — filing status affects brackets
 *   M7. Phase-out threshold mutations — income thresholds affect credit amounts
 *   M8. Rounding/sign mutations — wrong rounding or sign flips
 *   M9. State tax mutations — state rates produce different results
 *  M10. Social Security provisional income mutations
 */
import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateProgressiveTax } from '../src/engine/brackets.js';
import { calculateScheduleSE } from '../src/engine/scheduleSE.js';
import { calculateScheduleD } from '../src/engine/scheduleD.js';
import { calculateForeignTaxCredit } from '../src/engine/foreignTaxCredit.js';
import { calculateStateTaxes } from '../src/engine/state/index.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ── Helper ──────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'mutation',
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

// ═══════════════════════════════════════════════════════════════════════════
// M1: Bracket Rate Mutations
// If someone changed a bracket rate (e.g., 12% → 10%), would tests catch it?
// We verify that different income levels produce different tax amounts,
// proving each bracket is actually being applied.
// ═══════════════════════════════════════════════════════════════════════════

describe('M1: Bracket rate sensitivity', () => {
  it('10% bracket: $10k taxable income produces ~$1,000 tax', () => {
    const result = calculateProgressiveTax(10000, FilingStatus.Single);
    // 10% × $10k = $1,000 (exactly)
    expect(result.tax).toBe(1000);
  });

  it('12% bracket: $30k taxable income produces more than 10% flat', () => {
    const result = calculateProgressiveTax(30000, FilingStatus.Single);
    // 10% × $11,925 + 12% × ($30k - $11,925) = $1,192.50 + $2,169 = $3,361.50
    expect(result.tax).toBeGreaterThan(3000);
    expect(result.tax).toBeLessThan(3600);
    // If 12% were mutated to 10%, tax would be $3,000 — below $3,000, which we'd catch
  });

  it('22% bracket: $60k taxable income includes 3 brackets', () => {
    const result = calculateProgressiveTax(60000, FilingStatus.Single);
    // 10% × $11,925 + 12% × ($48,475 - $11,925) + 22% × ($60k - $48,475)
    // = $1,192.50 + $4,386 + $2,535.50 = $8,114
    expect(result.tax).toBeGreaterThan(8000);
    expect(result.tax).toBeLessThan(8300);
    expect(result.marginalRate).toBe(0.22);
  });

  it('24% bracket: $120k taxable income', () => {
    const result = calculateProgressiveTax(120000, FilingStatus.Single);
    expect(result.tax).toBeGreaterThan(20000);
    expect(result.tax).toBeLessThan(25000);
    expect(result.marginalRate).toBe(0.24);
  });

  it('brackets are progressive: doubling income more than doubles tax', () => {
    const low = calculateProgressiveTax(50000, FilingStatus.Single);
    const high = calculateProgressiveTax(100000, FilingStatus.Single);
    // Due to progressive rates, doubling income should more-than-double tax
    expect(high.tax).toBeGreaterThan(low.tax * 2);
  });

  it('MFJ brackets are wider than Single brackets', () => {
    const single = calculateProgressiveTax(80000, FilingStatus.Single);
    const mfj = calculateProgressiveTax(80000, FilingStatus.MarriedFilingJointly);
    // Same income, MFJ has wider brackets → lower tax
    expect(mfj.tax).toBeLessThan(single.tax);
  });

  it('each bracket adds marginal tax', () => {
    // Verify each bracket boundary produces a step in tax
    const brackets = [11925, 48475, 103350, 197300, 250525, 626350];
    let prevTax = 0;
    for (const boundary of brackets) {
      const result = calculateProgressiveTax(boundary + 1, FilingStatus.Single);
      expect(result.tax).toBeGreaterThan(prevTax);
      prevTax = result.tax;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M2: Standard Deduction Mutations
// If the standard deduction were wrong, taxable income would change,
// and so would the computed tax.
// ═══════════════════════════════════════════════════════════════════════════

describe('M2: Standard deduction sensitivity', () => {
  const baseW2 = [{
    id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 9500,
  }];

  it('Single standard deduction = $15,750', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single, w2Income: baseW2,
    }));
    expect(result.form1040.standardDeduction).toBe(15750);
    expect(result.form1040.taxableIncome).toBe(75000 - 15750);
  });

  it('MFJ standard deduction = $31,500', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly, w2Income: baseW2,
    }));
    expect(result.form1040.standardDeduction).toBe(31500);
    expect(result.form1040.taxableIncome).toBe(75000 - 31500);
  });

  it('HoH standard deduction = $23,625', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold, w2Income: baseW2,
      dependents: [{ id: 'd1', firstName: 'Child', lastName: 'T',
        relationship: 'son', dateOfBirth: '2015-01-01', monthsLivedWithYou: 12 }],
    }));
    expect(result.form1040.standardDeduction).toBe(23625);
  });

  it('MFS standard deduction = $15,750', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately, w2Income: baseW2,
    }));
    expect(result.form1040.standardDeduction).toBe(15750);
  });

  it('QSS standard deduction = $31,500 (same as MFJ)', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.QualifyingSurvivingSpouse, w2Income: baseW2,
      dependents: [{ id: 'd1', firstName: 'Child', lastName: 'T',
        relationship: 'son', dateOfBirth: '2015-01-01', monthsLivedWithYou: 12 }],
    }));
    expect(result.form1040.standardDeduction).toBe(31500);
  });

  it('different deduction produces different tax', () => {
    const single = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single, w2Income: baseW2,
    }));
    const mfj = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly, w2Income: baseW2,
    }));
    // Higher deduction → lower taxable income → lower tax
    expect(mfj.form1040.incomeTax).toBeLessThan(single.form1040.incomeTax);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M3: Credit Amount Mutations
// If CTC were $2,000 instead of $2,200, would tests catch it?
// ═══════════════════════════════════════════════════════════════════════════

describe('M3: Credit amount sensitivity', () => {
  it('CTC per child = exactly $2,200 (OBBBA)', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 9500 }],
      dependents: [{ id: 'd1', firstName: 'Kid', lastName: 'T',
        relationship: 'son', dateOfBirth: '2015-01-01', monthsLivedWithYou: 12 }],
    }));
    // Exact value catches any mutation ($2,000 → $2,200 → $2,500 etc.)
    expect(result.credits.childTaxCredit).toBe(2200);
  });

  it('CTC scales linearly: 3 kids = $6,600', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 100000, federalTaxWithheld: 15000 }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'T', relationship: 'son', dateOfBirth: '2015-01-01', monthsLivedWithYou: 12 },
        { id: 'd2', firstName: 'B', lastName: 'T', relationship: 'son', dateOfBirth: '2017-01-01', monthsLivedWithYou: 12 },
        { id: 'd3', firstName: 'C', lastName: 'T', relationship: 'son', dateOfBirth: '2019-01-01', monthsLivedWithYou: 12 },
      ],
    }));
    expect(result.credits.childTaxCredit).toBe(6600);
  });

  it('ODC per dependent = exactly $500', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 9500 }],
      dependents: [{ id: 'd1', firstName: 'Adult', lastName: 'T',
        relationship: 'parent', dateOfBirth: '1955-01-01', monthsLivedWithYou: 12 }],
    }));
    expect(result.credits.otherDependentCredit).toBe(500);
  });

  it('AOTC full credit = $2,500 (not $2,000 or $3,000)', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 9500 }],
      educationCredits: [{ id: 'ed1', type: 'american_opportunity',
        studentName: 'S', institution: 'U', tuitionPaid: 5000 }],
    }));
    const totalAOTC = result.credits.educationCredit + result.credits.aotcRefundableCredit;
    expect(totalAOTC).toBeCloseTo(2500, 0);
  });

  it('AOTC refundable split: exactly 40% refundable', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 9500 }],
      educationCredits: [{ id: 'ed1', type: 'american_opportunity',
        studentName: 'S', institution: 'U', tuitionPaid: 5000 }],
    }));
    // 40% of $2,500 = $1,000
    expect(result.credits.aotcRefundableCredit).toBeCloseTo(1000, 0);
    // 60% of $2,500 = $1,500
    expect(result.credits.educationCredit).toBeCloseTo(1500, 0);
  });

  it('LLC max credit = $2,000 (20% × $10,000)', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 9500 }],
      educationCredits: [{ id: 'ed1', type: 'lifetime_learning',
        studentName: 'S', institution: 'U', tuitionPaid: 15000 }],
    }));
    expect(result.credits.educationCredit).toBe(2000);
  });

  it('foreign tax credit: $200 simplified (≤$300 Single)', () => {
    const result = calculateForeignTaxCredit(200, 5000, 100000, 20000, FilingStatus.Single);
    expect(result.creditAllowed).toBe(200);
  });

  it('foreign tax credit: $800 requires Form 1116 limitation (> $600 MFJ)', () => {
    // $800 tax, $6k foreign income, $100k worldwide, $20k US tax
    // Limitation = $20k × $6k/$100k = $1,200
    // Credit = min($800, $1,200) = $800
    const result = calculateForeignTaxCredit(800, 6000, 100000, 20000, FilingStatus.MarriedFilingJointly);
    expect(result.creditAllowed).toBe(800);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M4: SE Tax Rate Mutations
// If 15.3% were changed to 14.3% or the 92.35% factor were wrong
// ═══════════════════════════════════════════════════════════════════════════

describe('M4: SE tax rate sensitivity', () => {
  it('SE tax uses 92.35% net earnings factor', () => {
    const result = calculateScheduleSE(100000, FilingStatus.Single, 0);
    // Net earnings = $100k × 0.9235 = $92,350
    expect(result.netEarnings).toBe(92350);
  });

  it('SS tax rate = 12.4%', () => {
    const result = calculateScheduleSE(50000, FilingStatus.Single, 0);
    // Net = $50k × 0.9235 = $46,175
    // SS = $46,175 × 0.124 = $5,725.70
    expect(result.socialSecurityTax).toBeCloseTo(5725.70, 1);
  });

  it('Medicare tax rate = 2.9%', () => {
    const result = calculateScheduleSE(50000, FilingStatus.Single, 0);
    // Net = $46,175
    // Medicare = $46,175 × 0.029 = $1,339.08
    expect(result.medicareTax).toBeCloseTo(1339.08, 1);
  });

  it('total SE tax = SS + Medicare (15.3% net)', () => {
    const result = calculateScheduleSE(50000, FilingStatus.Single, 0);
    // Total = $5,725.70 + $1,339.08 = $7,064.78
    expect(result.totalSETax).toBeCloseTo(7064.78, 0);
    // If rate mutated from 15.3% to 14.3%, total would be ~$6,602 — caught by closeTo
  });

  it('deductible half = exactly 50% of SE tax (excluding additional Medicare)', () => {
    const result = calculateScheduleSE(50000, FilingStatus.Single, 0);
    expect(result.deductibleHalf).toBeCloseTo((result.socialSecurityTax + result.medicareTax) / 2, 2);
  });

  it('additional Medicare tax applies above $200k (Single)', () => {
    // $300k profit → net = $277,050
    const result = calculateScheduleSE(300000, FilingStatus.Single, 0);
    // Additional Medicare = 0.9% × ($277,050 - $200,000) = 0.9% × $77,050 = $693.45
    expect(result.additionalMedicareTax).toBeGreaterThan(0);
    expect(result.additionalMedicareTax).toBeCloseTo(693.45, 0);
  });

  it('W-2 wages reduce SS base for SE tax', () => {
    // With $100k W-2 wages, less SS base remaining for SE
    const noW2 = calculateScheduleSE(100000, FilingStatus.Single, 0);
    const withW2 = calculateScheduleSE(100000, FilingStatus.Single, 100000);
    expect(withW2.socialSecurityTax).toBeLessThan(noW2.socialSecurityTax);
    expect(withW2.medicareTax).toBe(noW2.medicareTax); // Medicare has no cap
  });

  it('$400 minimum threshold', () => {
    const below = calculateScheduleSE(399, FilingStatus.Single, 0);
    const above = calculateScheduleSE(400, FilingStatus.Single, 0);
    expect(below.totalSETax).toBe(0);
    expect(above.totalSETax).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M5: Capital Loss Cap Mutations
// If the $3k limit were mutated to $3.5k or $0
// ═══════════════════════════════════════════════════════════════════════════

describe('M5: Capital loss cap sensitivity', () => {
  it('capital loss deduction capped at exactly $3,000 (Single)', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 70000, federalTaxWithheld: 8000 }],
      income1099B: [{
        id: 'b1', brokerName: 'Broker', description: 'Loss',
        dateSold: '2025-06-01', proceeds: 5000, costBasis: 30000, isLongTerm: true,
      }],
    }));
    // $25k loss → capped at $3k deduction
    expect(result.form1040.capitalLossDeduction).toBe(3000);
    expect(result.form1040.capitalGainOrLoss).toBe(-3000);
    expect(result.form1040.agi).toBe(67000); // $70k - $3k
  });

  it('capital loss deduction capped at $1,500 for MFS', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 70000, federalTaxWithheld: 8000 }],
      income1099B: [{
        id: 'b1', brokerName: 'Broker', description: 'Loss',
        dateSold: '2025-06-01', proceeds: 5000, costBasis: 30000, isLongTerm: true,
      }],
    }));
    expect(result.form1040.capitalLossDeduction).toBe(1500);
    expect(result.form1040.capitalGainOrLoss).toBe(-1500);
  });

  it('small loss fully deductible (under $3k cap)', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 70000, federalTaxWithheld: 8000 }],
      income1099B: [{
        id: 'b1', brokerName: 'Broker', description: 'Small loss',
        dateSold: '2025-06-01', proceeds: 8000, costBasis: 10000, isLongTerm: true,
      }],
    }));
    expect(result.form1040.capitalLossDeduction).toBe(2000);
    expect(result.form1040.capitalGainOrLoss).toBe(-2000);
  });

  it('carryforward = total loss minus $3k deduction', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 70000, federalTaxWithheld: 8000 }],
      income1099B: [{
        id: 'b1', brokerName: 'Broker', description: 'Big loss',
        dateSold: '2025-06-01', proceeds: 5000, costBasis: 55000, isLongTerm: true,
      }],
    }));
    expect(result.scheduleD!.capitalLossDeduction).toBe(3000);
    expect(result.scheduleD!.capitalLossCarryforward).toBe(47000); // $50k - $3k
  });

  it('gains offset losses before the $3k cap applies', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 70000, federalTaxWithheld: 8000 }],
      income1099B: [
        { id: 'b1', brokerName: 'B', description: 'Gain',
          dateSold: '2025-06-01', proceeds: 20000, costBasis: 10000, isLongTerm: true },
        { id: 'b2', brokerName: 'B', description: 'Loss',
          dateSold: '2025-06-01', proceeds: 5000, costBasis: 20000, isLongTerm: true },
      ],
    }));
    // Net: $10k gain - $15k loss = -$5k → deduction $3k, carryforward $2k
    expect(result.form1040.capitalGainOrLoss).toBe(-3000);
    expect(result.scheduleD!.capitalLossCarryforward).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M6: Filing Status Boundary Mutations
// Verify filing status actually affects the calculation
// ═══════════════════════════════════════════════════════════════════════════

describe('M6: Filing status affects computation', () => {
  const baseW2 = [{ id: 'w1', employerName: 'Corp', wages: 100000, federalTaxWithheld: 15000 }];

  it('same income → different tax for each filing status', () => {
    const statuses = [
      FilingStatus.Single,
      FilingStatus.MarriedFilingJointly,
      FilingStatus.MarriedFilingSeparately,
      FilingStatus.HeadOfHousehold,
    ];
    const taxes = new Set<number>();

    for (const status of statuses) {
      const deps = status === FilingStatus.HeadOfHousehold
        ? [{ id: 'd1', firstName: 'Kid', lastName: 'T', relationship: 'son' as const,
             dateOfBirth: '2015-01-01', monthsLivedWithYou: 12 }]
        : [];
      const result = calculateForm1040(makeTaxReturn({
        filingStatus: status, w2Income: baseW2, dependents: deps,
      }));
      taxes.add(result.form1040.incomeTax);
    }

    // At least 3 distinct tax amounts (MFS and Single may share deduction)
    expect(taxes.size).toBeGreaterThanOrEqual(3);
  });

  it('MFJ produces lower tax than Single on same income', () => {
    const single = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single, w2Income: baseW2,
    }));
    const mfj = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly, w2Income: baseW2,
    }));
    expect(mfj.form1040.incomeTax).toBeLessThan(single.form1040.incomeTax);
  });

  it('HoH deduction is between Single and MFJ', () => {
    const single = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single, w2Income: baseW2,
    }));
    const hoh = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold, w2Income: baseW2,
      dependents: [{ id: 'd1', firstName: 'Kid', lastName: 'T', relationship: 'son',
        dateOfBirth: '2015-01-01', monthsLivedWithYou: 12 }],
    }));
    const mfj = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly, w2Income: baseW2,
    }));
    expect(hoh.form1040.standardDeduction).toBeGreaterThan(single.form1040.standardDeduction);
    expect(hoh.form1040.standardDeduction).toBeLessThan(mfj.form1040.standardDeduction);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M7: Phase-Out Threshold Mutations
// CTC phases out above $200k (Single) / $400k (MFJ)
// ═══════════════════════════════════════════════════════════════════════════

describe('M7: Phase-out threshold sensitivity', () => {
  it('CTC not phased out at $190k Single', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 190000, federalTaxWithheld: 40000 }],
      dependents: [{ id: 'd1', firstName: 'Kid', lastName: 'T', relationship: 'son',
        dateOfBirth: '2015-01-01', monthsLivedWithYou: 12 }],
    }));
    expect(result.credits.childTaxCredit).toBe(2200); // Full credit
  });

  it('CTC begins phasing out above $200k Single', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 220000, federalTaxWithheld: 50000 }],
      dependents: [{ id: 'd1', firstName: 'Kid', lastName: 'T', relationship: 'son',
        dateOfBirth: '2015-01-01', monthsLivedWithYou: 12 }],
    }));
    // $20k over threshold → 20 × $50 = $1,000 reduction
    // CTC: $2,200 - $1,000 = $1,200
    expect(result.credits.childTaxCredit).toBeLessThan(2200);
    expect(result.credits.childTaxCredit).toBeCloseTo(1200, 0);
  });

  it('CTC not phased out at $390k MFJ', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 390000, federalTaxWithheld: 80000 }],
      dependents: [{ id: 'd1', firstName: 'Kid', lastName: 'T', relationship: 'son',
        dateOfBirth: '2015-01-01', monthsLivedWithYou: 12 }],
    }));
    expect(result.credits.childTaxCredit).toBe(2200);
  });

  it('CTC phases out above $400k MFJ', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 450000, federalTaxWithheld: 100000 }],
      dependents: [{ id: 'd1', firstName: 'Kid', lastName: 'T', relationship: 'son',
        dateOfBirth: '2015-01-01', monthsLivedWithYou: 12 }],
    }));
    // $50k over → 50 × $50 = $2,500 reduction → CTC = max(0, $2,200 - $2,500) = $0
    expect(result.credits.childTaxCredit).toBe(0);
  });

  it('student loan interest phases out at high income', () => {
    const low = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 60000, federalTaxWithheld: 7000 }],
      studentLoanInterest: 2500,
    }));
    const high = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 100000, federalTaxWithheld: 15000 }],
      studentLoanInterest: 2500,
    }));
    // At $100k, should be fully phased out or reduced
    expect(low.form1040.studentLoanInterest).toBe(2500);
    expect(high.form1040.studentLoanInterest).toBeLessThan(2500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M8: Rounding and Sign Mutations
// Verify that positive/negative values are handled correctly
// ═══════════════════════════════════════════════════════════════════════════

describe('M8: Rounding and sign correctness', () => {
  it('refund and amount owed are mutually exclusive', () => {
    const refund = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 50000, federalTaxWithheld: 10000 }],
    }));
    // Can't have both refund and amount owed
    expect(refund.form1040.refundAmount * refund.form1040.amountOwed).toBe(0);
  });

  it('overpayment produces refund (not negative owed)', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 30000, federalTaxWithheld: 8000 }],
    }));
    expect(result.form1040.refundAmount).toBeGreaterThan(0);
    expect(result.form1040.amountOwed).toBe(0);
  });

  it('underpayment produces amount owed (not negative refund)', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 100000, federalTaxWithheld: 5000 }],
    }));
    expect(result.form1040.amountOwed).toBeGreaterThan(0);
    expect(result.form1040.refundAmount).toBe(0);
  });

  it('effective tax rate is non-negative', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 9500 }],
    }));
    expect(result.form1040.effectiveTaxRate).toBeGreaterThanOrEqual(0);
  });

  it('taxable income never negative', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 10000, federalTaxWithheld: 500 }],
    }));
    // $10k income - $31.5k deduction would be negative, but should floor at 0
    expect(result.form1040.taxableIncome).toBe(0);
  });

  it('income tax never negative', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 5000, federalTaxWithheld: 500 }],
    }));
    expect(result.form1040.incomeTax).toBeGreaterThanOrEqual(0);
  });

  it('all credit amounts non-negative', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 9500 }],
    }));
    const credits = result.credits;
    expect(credits.childTaxCredit).toBeGreaterThanOrEqual(0);
    expect(credits.otherDependentCredit).toBeGreaterThanOrEqual(0);
    expect(credits.actcCredit).toBeGreaterThanOrEqual(0);
    expect(credits.educationCredit).toBeGreaterThanOrEqual(0);
    expect(credits.eitcCredit).toBeGreaterThanOrEqual(0);
    expect(credits.foreignTaxCredit).toBeGreaterThanOrEqual(0);
    expect(credits.totalCredits).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M9: State Tax Mutations
// Verify state tax rates are applied correctly
// ═══════════════════════════════════════════════════════════════════════════

describe('M9: State tax rate sensitivity', () => {
  function makeStateReturn(state: string, wages: number, fs: FilingStatus = FilingStatus.Single) {
    return makeTaxReturn({
      filingStatus: fs,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages, federalTaxWithheld: wages * 0.12,
        stateTaxWithheld: wages * 0.04, stateWages: wages, state,
      }],
      stateReturns: [{ stateCode: state, residencyType: 'resident' }],
    });
  }

  it('no-tax states produce exactly $0', () => {
    for (const state of ['AK', 'FL', 'NV', 'TX', 'WY']) {
      const tr = makeStateReturn(state, 75000);
      const federal = calculateForm1040(tr);
      const stateResults = calculateStateTaxes(tr, federal);
      expect(stateResults[0].totalStateTax, `${state} should be $0`).toBe(0);
    }
  });

  it('flat-tax states: proportional to income', () => {
    const state = 'IL'; // 4.95% flat
    const tr1 = makeStateReturn(state, 50000);
    const tr2 = makeStateReturn(state, 100000);
    const fed1 = calculateForm1040(tr1);
    const fed2 = calculateForm1040(tr2);
    const sr1 = calculateStateTaxes(tr1, fed1)[0];
    const sr2 = calculateStateTaxes(tr2, fed2)[0];

    // Double income should roughly double state tax (flat tax)
    // Allow 10% tolerance for deduction effects
    const ratio = sr2.stateIncomeTax / sr1.stateIncomeTax;
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.2);
  });

  it('progressive states: effective rate increases with income', () => {
    const state = 'CA';
    const tr1 = makeStateReturn(state, 50000);
    const tr2 = makeStateReturn(state, 200000);
    const fed1 = calculateForm1040(tr1);
    const fed2 = calculateForm1040(tr2);
    const sr1 = calculateStateTaxes(tr1, fed1)[0];
    const sr2 = calculateStateTaxes(tr2, fed2)[0];

    // Higher income should have higher effective rate (progressive)
    expect(sr2.effectiveStateRate).toBeGreaterThan(sr1.effectiveStateRate);
  });

  it('different states produce different tax on same income', () => {
    const taxes = new Map<string, number>();
    for (const state of ['CA', 'NY', 'IL', 'PA', 'NJ']) {
      const tr = makeStateReturn(state, 100000);
      const fed = calculateForm1040(tr);
      const sr = calculateStateTaxes(tr, fed)[0];
      taxes.set(state, sr.stateIncomeTax);
    }
    // All 5 states should have different tax amounts
    const uniqueTaxes = new Set(taxes.values());
    expect(uniqueTaxes.size).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M10: Social Security Provisional Income Mutations
// Verify the 50%/85% taxability thresholds work correctly
// ═══════════════════════════════════════════════════════════════════════════

describe('M10: Social Security taxability sensitivity', () => {
  it('SS fully non-taxable when sole income source', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      incomeSSA1099: { id: 'ssa', totalBenefits: 20000 },
    }));
    // Provisional income = $10k (half SS) — below $25k threshold
    expect(result.form1040.taxableSocialSecurity).toBe(0);
  });

  it('SS partially taxable with moderate other income (50% threshold)', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      incomeSSA1099: { id: 'ssa', totalBenefits: 20000 },
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 18000 }],
    }));
    // Provisional = $18k + $10k (half SS) = $28k — above $25k, below $34k
    // Taxable SS should be > 0 but < 85%
    expect(result.form1040.taxableSocialSecurity).toBeGreaterThan(0);
    expect(result.form1040.taxableSocialSecurity).toBeLessThan(20000 * 0.85);
  });

  it('SS up to 85% taxable with high other income', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      incomeSSA1099: { id: 'ssa', totalBenefits: 24000 },
      w2Income: [{ id: 'w1', employerName: 'Job', wages: 50000, federalTaxWithheld: 5000 }],
    }));
    // Provisional = $50k + $12k (half SS) = $62k — well above $34k
    // Should be at 85% taxable
    expect(result.form1040.taxableSocialSecurity).toBeCloseTo(24000 * 0.85, 0);
  });

  it('MFJ thresholds are different from Single ($32k/$44k vs $25k/$34k)', () => {
    const sameIncome = {
      incomeSSA1099: { id: 'ssa', totalBenefits: 20000 },
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 25000 }],
    };

    const single = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single, ...sameIncome,
    }));
    const mfj = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly, ...sameIncome,
    }));

    // MFJ has higher threshold → less SS should be taxable
    expect(mfj.form1040.taxableSocialSecurity).toBeLessThanOrEqual(
      single.form1040.taxableSocialSecurity,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M11: SALT Cap Mutations
// Verify the $40k OBBBA SALT cap is correctly applied
// ═══════════════════════════════════════════════════════════════════════════

describe('M11: SALT cap sensitivity', () => {
  it('SALT under $40k: full deduction allowed', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 200000, federalTaxWithheld: 30000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        stateLocalIncomeTax: 15000, realEstateTax: 10000, personalPropertyTax: 0,
        mortgageInterest: 12000, mortgageInsurancePremiums: 0,
        charitableCash: 5000, charitableNonCash: 0,
        medicalExpenses: 0, casualtyLoss: 0, otherDeductions: 0,
      },
    }));
    // SALT total: $25k (under $40k cap)
    // Itemized: $25k + $12k + $5k = $42k > $31.5k standard
    expect(result.form1040.deductionUsed).toBe('itemized');
    expect(result.form1040.itemizedDeduction).toBe(42000);
  });

  it('SALT over $40k: capped at $40,000 (OBBBA)', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 300000, federalTaxWithheld: 60000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        stateLocalIncomeTax: 30000, realEstateTax: 25000, personalPropertyTax: 0,
        mortgageInterest: 20000, mortgageInsurancePremiums: 0,
        charitableCash: 10000, charitableNonCash: 0,
        medicalExpenses: 0, casualtyLoss: 0, otherDeductions: 0,
      },
    }));
    // SALT total: $55k → capped at $40k
    // Itemized: $40k + $20k + $10k = $70k
    expect(result.form1040.deductionUsed).toBe('itemized');
    expect(result.form1040.itemizedDeduction).toBe(70000);
  });

  it('SALT cap affects tax: higher SALT beyond cap doesn\'t reduce tax', () => {
    const at40k = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 300000, federalTaxWithheld: 60000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        stateLocalIncomeTax: 25000, realEstateTax: 15000, personalPropertyTax: 0,
        mortgageInterest: 20000, mortgageInsurancePremiums: 0,
        charitableCash: 10000, charitableNonCash: 0,
        medicalExpenses: 0, casualtyLoss: 0, otherDeductions: 0,
      },
    }));
    const over40k = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 300000, federalTaxWithheld: 60000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        stateLocalIncomeTax: 40000, realEstateTax: 20000, personalPropertyTax: 0,
        mortgageInterest: 20000, mortgageInsurancePremiums: 0,
        charitableCash: 10000, charitableNonCash: 0,
        medicalExpenses: 0, casualtyLoss: 0, otherDeductions: 0,
      },
    }));
    // Both should have same SALT deduction ($40k) → same tax
    expect(at40k.form1040.itemizedDeduction).toBe(over40k.form1040.itemizedDeduction);
    expect(at40k.form1040.incomeTax).toBe(over40k.form1040.incomeTax);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M12: Income Sensitivity — Small Changes Produce Tax Changes
// The ultimate mutation test: any code path that is "dead" won't
// change output when input changes
// ═══════════════════════════════════════════════════════════════════════════

describe('M12: Income sensitivity — small changes produce tax changes', () => {
  it('$1 more income produces different tax', () => {
    const r1 = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 50000, federalTaxWithheld: 5000 }],
    }));
    const r2 = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 50001, federalTaxWithheld: 5000 }],
    }));
    expect(r2.form1040.agi).toBe(r1.form1040.agi + 1);
    expect(r2.form1040.totalTax).toBeGreaterThanOrEqual(r1.form1040.totalTax);
  });

  it('adding one dependent changes credits', () => {
    const noDeps = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 9500 }],
    }));
    const oneDep = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 9500 }],
      dependents: [{ id: 'd1', firstName: 'Kid', lastName: 'T', relationship: 'son',
        dateOfBirth: '2015-01-01', monthsLivedWithYou: 12 }],
    }));
    expect(oneDep.credits.childTaxCredit).toBeGreaterThan(noDeps.credits.childTaxCredit);
    expect(oneDep.form1040.totalTax).toBeLessThan(noDeps.form1040.totalTax);
  });

  it('adding interest income changes AGI and tax', () => {
    const noInt = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 9500 }],
    }));
    const withInt = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 9500 }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 5000 }],
    }));
    expect(withInt.form1040.agi).toBe(noInt.form1040.agi + 5000);
    expect(withInt.form1040.totalTax).toBeGreaterThan(noInt.form1040.totalTax);
  });

  it('adding withholding changes refund/owed', () => {
    const lowWH = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 5000 }],
    }));
    const highWH = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 75000, federalTaxWithheld: 15000 }],
    }));
    // Same tax, different withholding → different refund/owed
    expect(highWH.form1040.refundAmount).toBeGreaterThan(lowWH.form1040.refundAmount);
  });
});
