import { describe, it, expect } from 'vitest';
import { calculateEstimatedTaxPenalty } from '../src/engine/estimatedTaxPenalty.js';
import { FilingStatus } from '../src/types/index.js';

describe('calculateEstimatedTaxPenalty (Form 2210)', () => {
  // ─── Safe Harbor: Under $1,000 Threshold ────────────────
  describe('Safe Harbor 1: Under $1,000 threshold', () => {
    it('returns no penalty when tax owed is under $1,000', () => {
      const result = calculateEstimatedTaxPenalty(
        10000,    // currentYearTax
        9500,     // totalPayments (withholding + estimated)
        8000,     // priorYearTax
        100000,   // agi
        FilingStatus.Single,
      );
      // Tax owed = 10000 - 9500 = 500 < 1000
      expect(result.penalty).toBe(0);
      expect(result.underpaymentAmount).toBe(0);
    });

    it('returns no penalty at boundary: tax owed = $999.99', () => {
      const result = calculateEstimatedTaxPenalty(
        15000,
        14000.01,   // tax owed = 999.99 < 1000
        12000,
        100000,
        FilingStatus.Single,
      );
      expect(result.penalty).toBe(0);
    });
  });

  // ─── Safe Harbor: 90% Current Year ─────────────────────
  describe('Safe Harbor 2: 90% current year tax', () => {
    it('returns no penalty when payments ≥ 90% of current year tax', () => {
      const result = calculateEstimatedTaxPenalty(
        20000,    // currentYearTax
        18500,    // totalPayments (92.5% — above 90%)
        25000,    // priorYearTax (high, so prior year safe harbor is NOT met)
        100000,
        FilingStatus.Single,
      );
      // 90% of 20000 = 18000; 100% of 25000 = 25000; required = min(18000,25000) = 18000
      // 18500 >= 18000 → safe harbor met
      expect(result.penalty).toBe(0);
      expect(result.requiredAnnualPayment).toBe(18000);
    });
  });

  // ─── Safe Harbor: 100% Prior Year (Normal Income) ──────
  describe('Safe Harbor 3: 100% prior year tax (AGI ≤ $150k)', () => {
    it('returns no penalty when payments ≥ 100% of prior year tax', () => {
      const result = calculateEstimatedTaxPenalty(
        30000,    // currentYearTax
        22000,    // totalPayments
        22000,    // priorYearTax — payments exactly equal prior year
        120000,   // agi ≤ 150k → 100% rate
        FilingStatus.MarriedFilingJointly,
      );
      // 90% of 30000 = 27000; 100% of 22000 = 22000; required = min(27000,22000) = 22000
      // 22000 >= 22000 → safe harbor met
      expect(result.penalty).toBe(0);
      expect(result.requiredAnnualPayment).toBe(22000);
    });
  });

  // ─── Safe Harbor: 110% Prior Year (High Income) ────────
  describe('Safe Harbor 3: 110% prior year tax (AGI > $150k)', () => {
    it('returns no penalty when payments ≥ 110% of prior year tax for high income', () => {
      const result = calculateEstimatedTaxPenalty(
        50000,    // currentYearTax
        44000,    // totalPayments
        40000,    // priorYearTax
        200000,   // agi > 150k → 110% rate
        FilingStatus.Single,
      );
      // 90% of 50000 = 45000; 110% of 40000 = 44000; required = min(45000,44000) = 44000
      // 44000 >= 44000 → safe harbor met
      expect(result.penalty).toBe(0);
      expect(result.requiredAnnualPayment).toBe(44000);
    });

    it('applies penalty when 110% threshold not met for high income', () => {
      const result = calculateEstimatedTaxPenalty(
        50000,    // currentYearTax
        43000,    // totalPayments (under 110% of 40000 = 44000)
        40000,    // priorYearTax
        200000,   // agi > 150k
        FilingStatus.Single,
      );
      // required = min(45000, 44000) = 44000; underpayment = 44000-43000 = 1000
      // Per-quarter: quarterlyRequired=11000, quarterlyPayment=10750, underpayment=250/quarter
      // Day-count penalty ≈ $46.56
      expect(result.requiredAnnualPayment).toBe(44000);
      expect(result.underpaymentAmount).toBe(1000);
      expect(result.penalty).toBe(46.56);
    });
  });

  // ─── Regular Method Penalty (Day-Count) ──────────────────
  describe('Regular method penalty (day-count)', () => {
    it('calculates correct penalty using per-quarter day-count method', () => {
      const result = calculateEstimatedTaxPenalty(
        25000,    // currentYearTax
        15000,    // totalPayments
        25000,    // priorYearTax (equal to current, so 100% = 25000)
        100000,   // agi ≤ 150k
        FilingStatus.Single,
      );
      // 90% of 25000 = 22500; 100% of 25000 = 25000; required = min(22500,25000) = 22500
      // underpayment = 22500 - 15000 = 7500
      // Per-quarter: quarterlyRequired=5625, quarterlyPayment=3750, underpayment=1875/quarter
      // Day-count penalty per quarter (each underpayment × rate × days / 365):
      //   Q1: 1875 × 0.07 × 365/365 = 131.25... but with day-count matrix it's:
      //   Q1: 1875×0.07×(77+92+92+104)/365 = 1875×0.07×365/365 = 131.25
      //   Q2: 1875×0.07×304/365 = 109.32
      //   Q3: 1875×0.07×212/365 = 76.23
      //   Q4: 1875×0.07×90/365 = 32.36
      //   Total ≈ 349.16
      expect(result.requiredAnnualPayment).toBe(22500);
      expect(result.underpaymentAmount).toBe(7500);
      expect(result.penalty).toBe(349.16);
      expect(result.usedAnnualizedMethod).toBe(false);
      expect(result.regularPenalty).toBe(349.16);
    });

    it('returns quarterly detail with per-quarter breakdown', () => {
      const result = calculateEstimatedTaxPenalty(
        25000, 15000, 25000, 100000, FilingStatus.Single,
      );
      expect(result.quarterlyDetail).toBeDefined();
      expect(result.quarterlyDetail).toHaveLength(4);
      // Each quarter should have an underpayment of 1875
      for (const qd of result.quarterlyDetail!) {
        expect(qd.underpayment).toBe(1875);
        expect(qd.penalty).toBeGreaterThan(0);
      }
      // Q1 penalty should be highest (most days), Q4 lowest
      expect(result.quarterlyDetail![0].penalty).toBeGreaterThan(result.quarterlyDetail![3].penalty);
      // Sum of quarterly penalties should equal total
      const sum = result.quarterlyDetail!.reduce((s, q) => s + q.penalty, 0);
      expect(Math.abs(sum - result.penalty)).toBeLessThan(0.02);
    });

    it('David Park scenario matches expected value ($189)', () => {
      // David Park: currentYearTax=35628, totalPayments=28000, no prior year
      const result = calculateEstimatedTaxPenalty(
        35628,    // currentYearTax (after credits: 35354 + 334 NIIT - 60 FTC)
        28000,    // totalPayments (W-2 withholding)
        undefined, // priorYearTax unknown
        208800,   // agi
        FilingStatus.Single,
      );
      // required = 90% of 35628 = 32065.20
      // underpayment = 32065.20 - 28000 = 4065.20
      // quarterlyRequired = 8016.30, quarterlyPayment = 7000
      // per-quarter underpayment = 1016.30
      // Day-count: Q1=71.14, Q2=59.25, Q3=41.32, Q4=17.54 = 189.25
      expect(result.requiredAnnualPayment).toBe(32065.2);
      expect(result.underpaymentAmount).toBe(4065.2);
      expect(result.penalty).toBeCloseTo(189.25, 0);
    });
  });

  // ─── MFS Half-Threshold ────────────────────────────────
  describe('MFS half-threshold', () => {
    it('uses $75k threshold for Married Filing Separately', () => {
      // With MFS, AGI > $75k triggers the 110% rate
      const result = calculateEstimatedTaxPenalty(
        30000,    // currentYearTax
        20000,    // totalPayments
        20000,    // priorYearTax
        80000,    // agi > 75k (MFS half-threshold)
        FilingStatus.MarriedFilingSeparately,
      );
      // 90% of 30000 = 27000; 110% of 20000 = 22000; required = min(27000,22000) = 22000
      // underpayment = 22000 - 20000 = 2000
      // Per-quarter: quarterlyRequired=5500, quarterlyPayment=5000, underpayment=500/quarter
      // Day-count penalty ≈ $93.11
      expect(result.requiredAnnualPayment).toBe(22000);
      expect(result.underpaymentAmount).toBe(2000);
      expect(result.penalty).toBe(93.11);
    });

    it('uses 100% rate for MFS with AGI ≤ $75k', () => {
      const result = calculateEstimatedTaxPenalty(
        30000,
        20000,
        20000,    // priorYearTax — payments equal prior year at 100%
        70000,    // agi ≤ 75k
        FilingStatus.MarriedFilingSeparately,
      );
      // 90% of 30000 = 27000; 100% of 20000 = 20000; required = min(27000,20000) = 20000
      // 20000 >= 20000 → safe harbor met
      expect(result.penalty).toBe(0);
    });
  });

  // ─── Zero / Undefined Prior Year Tax ────────────────────
  describe('Prior year tax handling', () => {
    it('uses only current year required when prior year tax is 0', () => {
      const result = calculateEstimatedTaxPenalty(
        20000,    // currentYearTax
        15000,    // totalPayments
        0,        // priorYearTax = 0
        100000,
        FilingStatus.Single,
      );
      // prior = 0, so priorYearRequired branch skipped; required = 90% of 20000 = 18000
      // underpayment = 18000 - 15000 = 3000
      // Per-quarter: quarterlyRequired=4500, quarterlyPayment=3750, underpayment=750/quarter
      // Day-count penalty ≈ $139.67
      expect(result.requiredAnnualPayment).toBe(18000);
      expect(result.underpaymentAmount).toBe(3000);
      expect(result.penalty).toBe(139.67);
    });

    it('computes penalty when priorYearTax is undefined (90% current year only)', () => {
      const result = calculateEstimatedTaxPenalty(
        20000,
        15000,
        undefined, // priorYearTax unknown
        100000,
        FilingStatus.Single,
      );
      // required = 90% of 20000 = 18000 (no prior year safe harbor available)
      // underpayment = 3000; day-count penalty ≈ $139.67
      expect(result.requiredAnnualPayment).toBe(18000);
      expect(result.penalty).toBe(139.67);
    });
  });

  // ─── Annualized Income Installment Method ──────────────
  describe('Annualized income method (Schedule AI)', () => {
    it('uses annualized method when it produces lower penalty', () => {
      // Taxpayer earned most income in Q4 (seasonal income)
      const result = calculateEstimatedTaxPenalty(
        40000,    // currentYearTax
        25000,    // totalPayments
        40000,    // priorYearTax
        100000,   // agi
        FilingStatus.Single,
        {
          cumulativeIncome: [5000, 10000, 15000, 100000],  // Income skewed to Q4
        },
      );
      // Required = min(36000, 40000) = 36000; underpayment = 36000 - 25000 = 11000
      // Regular day-count penalty ≈ 512.11
      // Annualized method should be lower since early quarters had low income
      expect(result.usedAnnualizedMethod).toBe(true);
      expect(result.penalty).toBeLessThan(result.regularPenalty!);
      expect(result.regularPenalty).toBe(512.11);
      expect(result.annualizedPenalty).toBeDefined();
      expect(result.annualizedPenalty!).toBeLessThan(512.11);
    });

    it('with even income distribution, regular method is used', () => {
      // Even income distribution — annualized method won't reduce the penalty
      // because the annualized quarterly required is capped at the regular quarterly required.
      // So annualizedPenalty >= regularPenalty and the regular method is used.
      const result = calculateEstimatedTaxPenalty(
        40000,
        25000,
        40000,
        100000,
        FilingStatus.Single,
        {
          cumulativeIncome: [25000, 50000, 75000, 100000],  // Even distribution
        },
      );
      expect(result.regularPenalty).toBeDefined();
      // With even income, annualized method is NOT used (doesn't produce lower penalty)
      expect(result.usedAnnualizedMethod).toBe(false);
      expect(result.penalty).toBe(result.regularPenalty);
    });
  });

  // ─── Result shape ──────────────────────────────────────
  describe('Result shape', () => {
    it('always returns totalPaymentsMade', () => {
      const result = calculateEstimatedTaxPenalty(5000, 4800, 3000, 80000, FilingStatus.Single);
      expect(result.totalPaymentsMade).toBe(4800);
    });

    it('returns requiredAnnualPayment when safe harbor met via payments', () => {
      const result = calculateEstimatedTaxPenalty(20000, 18500, 15000, 80000, FilingStatus.Single);
      // required = min(18000, 15000) = 15000; 18500 >= 15000 → safe
      expect(result.requiredAnnualPayment).toBe(15000);
      expect(result.penalty).toBe(0);
    });
  });
});
