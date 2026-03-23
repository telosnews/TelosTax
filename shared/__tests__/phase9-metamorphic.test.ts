/**
 * Phase 9 — Metamorphic Relation Tests (C3)
 *
 * Tests structural invariants by transforming inputs and checking that
 * outputs follow predictable relationships. These tests don't require
 * knowing the exact answer — only the relationship between two answers.
 *
 * @authority IRC §1, §61 — structural tax computation constraints
 */
import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ── Helper ──────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'meta-test',
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
    filingStatus: FilingStatus.Single,
    educationCredits: [],
    ...overrides,
  } as TaxReturn;
}

// ── Metamorphic Relation Tests ──────────────────────────────────────────

describe('Phase 9 — Metamorphic Relations (C3)', () => {

  it('M1: W-2 splitting — split $100k W-2 into two $50k W-2s → identical totalTax', () => {
    const single = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'A', wages: 100000, federalTaxWithheld: 10000, socialSecurityWages: 100000, medicareWages: 100000 }],
    });
    const split = makeTaxReturn({
      w2Income: [
        { id: 'w1', employerName: 'A', wages: 50000, federalTaxWithheld: 5000, socialSecurityWages: 50000, medicareWages: 50000 },
        { id: 'w2', employerName: 'B', wages: 50000, federalTaxWithheld: 5000, socialSecurityWages: 50000, medicareWages: 50000 },
      ],
    });
    const r1 = calculateForm1040(single).form1040;
    const r2 = calculateForm1040(split).form1040;
    expect(r2.totalTax).toBeCloseTo(r1.totalTax, 0);
    expect(r2.totalWages).toBe(r1.totalWages);
    expect(r2.agi).toBeCloseTo(r1.agi, 2);
  });

  it('M2: 1099-B order independence — reorder capital gain transactions → identical result', () => {
    const orderA = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 80000, federalTaxWithheld: 8000, socialSecurityWages: 80000, medicareWages: 80000 }],
      income1099B: [
        { id: 'b1', brokerName: 'Fidelity', description: 'AAPL', proceeds: 15000, costBasis: 10000, isLongTerm: true },
        { id: 'b2', brokerName: 'Schwab', description: 'MSFT', proceeds: 8000, costBasis: 12000, isLongTerm: false },
        { id: 'b3', brokerName: 'Vanguard', description: 'GOOG', proceeds: 20000, costBasis: 18000, isLongTerm: true },
      ],
    });
    const orderB = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 80000, federalTaxWithheld: 8000, socialSecurityWages: 80000, medicareWages: 80000 }],
      income1099B: [
        { id: 'b3', brokerName: 'Vanguard', description: 'GOOG', proceeds: 20000, costBasis: 18000, isLongTerm: true },
        { id: 'b1', brokerName: 'Fidelity', description: 'AAPL', proceeds: 15000, costBasis: 10000, isLongTerm: true },
        { id: 'b2', brokerName: 'Schwab', description: 'MSFT', proceeds: 8000, costBasis: 12000, isLongTerm: false },
      ],
    });
    const r1 = calculateForm1040(orderA).form1040;
    const r2 = calculateForm1040(orderB).form1040;
    expect(r2.totalTax).toBe(r1.totalTax);
    expect(r2.scheduleDNetGain).toBe(r1.scheduleDNetGain);
    expect(r2.agi).toBe(r1.agi);
  });

  it('M3: 1099-INT splitting — split $10k interest into two $5k → identical result', () => {
    const single = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 60000, federalTaxWithheld: 6000, socialSecurityWages: 60000, medicareWages: 60000 }],
      income1099INT: [{ id: 'i1', payerName: 'BankA', amount: 10000 }],
    });
    const split = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 60000, federalTaxWithheld: 6000, socialSecurityWages: 60000, medicareWages: 60000 }],
      income1099INT: [
        { id: 'i1', payerName: 'BankA', amount: 5000 },
        { id: 'i2', payerName: 'BankB', amount: 5000 },
      ],
    });
    const r1 = calculateForm1040(single).form1040;
    const r2 = calculateForm1040(split).form1040;
    expect(r2.totalTax).toBe(r1.totalTax);
    expect(r2.totalInterest).toBe(r1.totalInterest);
    expect(r2.agi).toBe(r1.agi);
  });

  it('M4: 1099-DIV splitting — split dividends → identical result', () => {
    const single = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 70000, federalTaxWithheld: 7000, socialSecurityWages: 70000, medicareWages: 70000 }],
      income1099DIV: [{ id: 'd1', payerName: 'FundA', ordinaryDividends: 8000, qualifiedDividends: 6000 }],
    });
    const split = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 70000, federalTaxWithheld: 7000, socialSecurityWages: 70000, medicareWages: 70000 }],
      income1099DIV: [
        { id: 'd1', payerName: 'FundA', ordinaryDividends: 4000, qualifiedDividends: 3000 },
        { id: 'd2', payerName: 'FundB', ordinaryDividends: 4000, qualifiedDividends: 3000 },
      ],
    });
    const r1 = calculateForm1040(single).form1040;
    const r2 = calculateForm1040(split).form1040;
    expect(r2.totalTax).toBe(r1.totalTax);
    expect(r2.totalDividends).toBe(r1.totalDividends);
    expect(r2.qualifiedDividends).toBe(r1.qualifiedDividends);
    expect(r2.agi).toBe(r1.agi);
  });

  it('M5: Income monotonicity — add $1 W-2 wages → totalTax does not decrease (above credit cliffs)', () => {
    // Use $100k income to be well above any credit phase-in cliffs (EITC, CTC)
    const base = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 100000, federalTaxWithheld: 10000, socialSecurityWages: 100000, medicareWages: 100000 }],
    });
    const plusOne = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 100001, federalTaxWithheld: 10000, socialSecurityWages: 100001, medicareWages: 100001 }],
    });
    const r1 = calculateForm1040(base).form1040;
    const r2 = calculateForm1040(plusOne).form1040;
    expect(r2.totalTax).toBeGreaterThanOrEqual(r1.totalTax);
  });

  it('M6: Withholding monotonicity — increase withholding → amountOwed does not increase', () => {
    const lessWithholding = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 80000, federalTaxWithheld: 5000, socialSecurityWages: 80000, medicareWages: 80000 }],
    });
    const moreWithholding = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 80000, federalTaxWithheld: 15000, socialSecurityWages: 80000, medicareWages: 80000 }],
    });
    const r1 = calculateForm1040(lessWithholding).form1040;
    const r2 = calculateForm1040(moreWithholding).form1040;
    expect(r2.amountOwed).toBeLessThanOrEqual(r1.amountOwed);
    // And refund should be higher with more withholding
    expect(r2.refundAmount).toBeGreaterThanOrEqual(r1.refundAmount);
  });

  it('M7: Idempotency — calculateForm1040(tr) called twice → identical results', () => {
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 95000, federalTaxWithheld: 12000, socialSecurityWages: 95000, medicareWages: 95000 }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 3000 }],
      income1099DIV: [{ id: 'd1', payerName: 'Fund', ordinaryDividends: 2000, qualifiedDividends: 1500 }],
    });
    const r1 = calculateForm1040(tr).form1040;
    const r2 = calculateForm1040(tr).form1040;
    // Every numeric field must be identical
    for (const key of Object.keys(r1)) {
      const v1 = (r1 as any)[key];
      const v2 = (r2 as any)[key];
      if (typeof v1 === 'number') {
        expect(v2, `form1040.${key} differs on second call`).toBe(v1);
      }
    }
  });

  it('M8: Zero-addition invariance — adding a $0 1099-INT → result unchanged', () => {
    const base = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 75000, federalTaxWithheld: 8000, socialSecurityWages: 75000, medicareWages: 75000 }],
      income1099INT: [{ id: 'i1', payerName: 'BankA', amount: 5000 }],
    });
    const withZero = makeTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'E', wages: 75000, federalTaxWithheld: 8000, socialSecurityWages: 75000, medicareWages: 75000 }],
      income1099INT: [
        { id: 'i1', payerName: 'BankA', amount: 5000 },
        { id: 'i2', payerName: 'BankB', amount: 0 },
      ],
    });
    const r1 = calculateForm1040(base).form1040;
    const r2 = calculateForm1040(withZero).form1040;
    expect(r2.totalTax).toBe(r1.totalTax);
    expect(r2.agi).toBe(r1.agi);
    expect(r2.taxableIncome).toBe(r1.taxableIncome);
  });

  it('M9: MFJ vs 2×Single — marriage penalty/bonus is bounded and tax structures coherent', () => {
    // Two equal earners each making $80k. MFJ combines; Singles file separately.
    // This tests that the engine produces coherent results for both filing statuses
    // and the marriage penalty/bonus is within reasonable bounds (<30% of combined tax).
    const mfj = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [
        { id: 'w1', employerName: 'A', wages: 80000, federalTaxWithheld: 8000, socialSecurityWages: 80000, medicareWages: 80000 },
        { id: 'w2', employerName: 'B', wages: 80000, federalTaxWithheld: 8000, socialSecurityWages: 80000, medicareWages: 80000 },
      ],
    });
    const single1 = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'A', wages: 80000, federalTaxWithheld: 8000, socialSecurityWages: 80000, medicareWages: 80000 }],
    });
    const rMFJ = calculateForm1040(mfj).form1040;
    const rSingle = calculateForm1040(single1).form1040;
    const combinedSingleTax = rSingle.totalTax * 2;

    // Both results must be valid
    expect(rMFJ.totalTax).toBeGreaterThanOrEqual(0);
    expect(rSingle.totalTax).toBeGreaterThanOrEqual(0);

    // AGI should match: MFJ = $160k, Single = $80k
    expect(rMFJ.agi).toBeCloseTo(160000, -1);
    expect(rSingle.agi).toBeCloseTo(80000, -1);

    // Marriage penalty/bonus bounded: |MFJ - 2×Single| < 30% of combined Single tax
    // With equal earners at $80k, the 2025 brackets are designed to minimize marriage
    // penalty for equal earners, so difference should be modest.
    const diff = Math.abs(rMFJ.totalTax - combinedSingleTax);
    expect(diff).toBeLessThan(combinedSingleTax * 0.30);
  });
});
