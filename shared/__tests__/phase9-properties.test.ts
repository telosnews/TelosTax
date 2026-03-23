/**
 * Phase 9 — Property-Based Invariant Tests (C2)
 *
 * Uses fast-check to generate random TaxReturn inputs and verify
 * universal invariants that must hold for ALL valid tax returns.
 *
 * @authority IRC §1, §61, §63 — universal structural constraints
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus, W2Income, Income1099INT, Income1099DIV, Income1099NEC } from '../src/types/index.js';

// ── Arbitrary generators ──────────────────────────────────────────────

const filingStatusArb = fc.constantFrom(
  FilingStatus.Single,
  FilingStatus.MarriedFilingJointly,
  FilingStatus.MarriedFilingSeparately,
  FilingStatus.HeadOfHousehold,
  FilingStatus.QualifyingSurvivingSpouse,
);

const w2Arb: fc.Arbitrary<W2Income> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  employerName: fc.constant('TestCo'),
  wages: fc.integer({ min: 0, max: 1_000_000 }),
  federalTaxWithheld: fc.integer({ min: 0, max: 200_000 }),
  socialSecurityWages: fc.integer({ min: 0, max: 168_600 }),
  medicareWages: fc.integer({ min: 0, max: 1_000_000 }),
});

const int1099Arb: fc.Arbitrary<Income1099INT> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  payerName: fc.constant('Bank'),
  amount: fc.integer({ min: 0, max: 200_000 }),
});

const div1099Arb: fc.Arbitrary<Income1099DIV> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  payerName: fc.constant('Fund'),
  ordinaryDividends: fc.integer({ min: 0, max: 200_000 }),
  qualifiedDividends: fc.integer({ min: 0, max: 200_000 }),
}).map(d => ({ ...d, qualifiedDividends: Math.min(d.qualifiedDividends, d.ordinaryDividends) }));

const nec1099Arb: fc.Arbitrary<Income1099NEC> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  payerName: fc.constant('Client'),
  amount: fc.integer({ min: 0, max: 500_000 }),
});

/** Generate a minimal but varied TaxReturn */
const taxReturnArb: fc.Arbitrary<TaxReturn> = fc.record({
  filingStatus: filingStatusArb,
  w2s: fc.array(w2Arb, { minLength: 0, maxLength: 3 }),
  ints: fc.array(int1099Arb, { minLength: 0, maxLength: 2 }),
  divs: fc.array(div1099Arb, { minLength: 0, maxLength: 2 }),
  necs: fc.array(nec1099Arb, { minLength: 0, maxLength: 2 }),
  otherIncome: fc.integer({ min: 0, max: 100_000 }),
  ssaBenefits: fc.integer({ min: 0, max: 50_000 }),
  iraContribution: fc.integer({ min: 0, max: 7000 }),
  studentLoanInterest: fc.integer({ min: 0, max: 2500 }),
}).map(g => ({
  id: 'prop-test',
  taxYear: 2025,
  status: 'in_progress' as const,
  currentStep: 0,
  currentSection: 'review',
  schemaVersion: 1,
  dependents: [],
  w2Income: g.w2s,
  income1099NEC: g.necs,
  income1099K: [],
  income1099INT: g.ints,
  income1099DIV: g.divs,
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
  otherIncome: g.otherIncome,
  businesses: [],
  expenses: [],
  deductionMethod: 'standard' as const,
  filingStatus: g.filingStatus,
  educationCredits: [],
  iraContribution: g.iraContribution,
  studentLoanInterest: g.studentLoanInterest,
  incomeSSA1099: g.ssaBenefits > 0
    ? { totalBenefits: g.ssaBenefits }
    : undefined,
}));

// ── Property-Based Tests ──────────────────────────────────────────────

describe('Phase 9 — Property-Based Invariants (C2)', () => {
  const NUM_RUNS = 200; // keep CI fast; 200 random returns per property

  it('P1: taxableIncome >= 0 for any input', () => {
    fc.assert(
      fc.property(taxReturnArb, (tr) => {
        const result = calculateForm1040(tr);
        expect(result.form1040.taxableIncome).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P2: totalTax >= 0 for any input', () => {
    fc.assert(
      fc.property(taxReturnArb, (tr) => {
        const result = calculateForm1040(tr);
        expect(result.form1040.totalTax).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P3: effectiveTaxRate in [0, 0.55] for any input', () => {
    fc.assert(
      fc.property(taxReturnArb, (tr) => {
        const result = calculateForm1040(tr);
        expect(result.form1040.effectiveTaxRate).toBeGreaterThanOrEqual(0);
        // Upper bound raised to 0.55 to accommodate estimated tax penalty (7% of underpayment)
        expect(result.form1040.effectiveTaxRate).toBeLessThanOrEqual(0.55);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P4: amountOwed and refundAmount are never both > 0', () => {
    fc.assert(
      fc.property(taxReturnArb, (tr) => {
        const result = calculateForm1040(tr);
        const bothPositive = result.form1040.amountOwed > 0 && result.form1040.refundAmount > 0;
        expect(bothPositive).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P5: balance identity (taxAfterCredits + penalty - totalPayments = amountOwed - refundAmount)', () => {
    fc.assert(
      fc.property(taxReturnArb, (tr) => {
        const r = calculateForm1040(tr).form1040;
        const lhs = r.taxAfterCredits + r.estimatedTaxPenalty - r.totalPayments;
        const rhs = r.amountOwed - r.refundAmount;
        expect(Math.abs(lhs - rhs)).toBeLessThan(0.02); // rounding tolerance
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P6: no NaN or Infinity in any output field', () => {
    fc.assert(
      fc.property(taxReturnArb, (tr) => {
        const result = calculateForm1040(tr);
        const f = result.form1040;
        const numericFields = Object.entries(f).filter(([, v]) => typeof v === 'number');
        for (const [key, value] of numericFields) {
          expect(Number.isFinite(value as number), `form1040.${key} is not finite`).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P7: taxableIncome <= max(0, AGI) (deductions reduce, AGI can be negative)', () => {
    fc.assert(
      fc.property(taxReturnArb, (tr) => {
        const r = calculateForm1040(tr).form1040;
        // taxableIncome = max(0, AGI - deduction - QBI), but AGI can go negative
        // from above-the-line adjustments exceeding income. taxableIncome is always >= 0.
        expect(r.taxableIncome).toBeLessThanOrEqual(Math.max(0, r.agi) + 0.01);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P8: totalCredits >= 0', () => {
    fc.assert(
      fc.property(taxReturnArb, (tr) => {
        const result = calculateForm1040(tr);
        expect(result.form1040.totalCredits).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P9: incomeTax >= 0', () => {
    fc.assert(
      fc.property(taxReturnArb, (tr) => {
        const result = calculateForm1040(tr);
        expect(result.form1040.incomeTax).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P10: AGI is finite for any finite input', () => {
    fc.assert(
      fc.property(taxReturnArb, (tr) => {
        const result = calculateForm1040(tr);
        expect(Number.isFinite(result.form1040.agi)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('P11: marginalTaxRate in [0, 0.37] for any input', () => {
    fc.assert(
      fc.property(taxReturnArb, (tr) => {
        const result = calculateForm1040(tr);
        expect(result.form1040.marginalTaxRate).toBeGreaterThanOrEqual(0);
        // 37% is the top federal ordinary income bracket (IRC §1(j))
        expect(result.form1040.marginalTaxRate).toBeLessThanOrEqual(0.37);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
