import { describe, it, expect } from 'vitest';
import { calculateScheduleA } from '../src/engine/scheduleA.js';
import { FilingStatus, ItemizedDeductions } from '../src/types/index.js';

function makeDeductions(overrides: Partial<ItemizedDeductions> = {}): ItemizedDeductions {
  return {
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
    ...overrides,
  };
}

describe('calculateScheduleA', () => {
  describe('Medical deduction', () => {
    it('deducts only amount exceeding 7.5% of AGI', () => {
      const result = calculateScheduleA(
        makeDeductions({ medicalExpenses: 15000 }),
        100000, // AGI
        FilingStatus.Single,
      );
      // 7.5% of 100k = 7500 floor. 15000 - 7500 = 7500 deductible
      expect(result.medicalDeduction).toBe(7500);
    });

    it('returns 0 when medical expenses are below floor', () => {
      const result = calculateScheduleA(
        makeDeductions({ medicalExpenses: 5000 }),
        100000,
        FilingStatus.Single,
      );
      // 7.5% of 100k = 7500 floor. 5000 < 7500 → 0
      expect(result.medicalDeduction).toBe(0);
    });

    it('handles zero AGI', () => {
      const result = calculateScheduleA(
        makeDeductions({ medicalExpenses: 5000 }),
        0,
        FilingStatus.Single,
      );
      // 7.5% of 0 = 0 floor. Full 5000 deductible
      expect(result.medicalDeduction).toBe(5000);
    });
  });

  describe('SALT deduction', () => {
    it('caps combined SALT at $40,000', () => {
      const result = calculateScheduleA(
        makeDeductions({
          stateLocalIncomeTax: 8000,
          realEstateTax: 5000,
          personalPropertyTax: 1000,
        }),
        100000,
        FilingStatus.Single,
      );
      // Total SALT = 14000, under $40,000 cap → not capped
      expect(result.saltDeduction).toBe(14000);
    });

    it('uses $20,000 cap for MFS', () => {
      const result = calculateScheduleA(
        makeDeductions({
          stateLocalIncomeTax: 8000,
          realEstateTax: 3000,
        }),
        100000,
        FilingStatus.MarriedFilingSeparately,
      );
      // Total SALT = 11000, under $20,000 cap → not capped
      expect(result.saltDeduction).toBe(11000);
    });

    it('allows full amount when under cap', () => {
      const result = calculateScheduleA(
        makeDeductions({
          stateLocalIncomeTax: 3000,
          realEstateTax: 2000,
        }),
        100000,
        FilingStatus.Single,
      );
      expect(result.saltDeduction).toBe(5000);
    });

    it('phases down SALT cap for Single AGI above $500k (OBBBA)', () => {
      // AGI $550k → excess = $50k, reduction = $50k × 30% = $15k
      // Cap = max($10k, $40k - $15k) = $25k
      const result = calculateScheduleA(
        makeDeductions({
          stateLocalIncomeTax: 30000,
          realEstateTax: 15000,
        }),
        550000,
        FilingStatus.Single,
      );
      expect(result.saltDeduction).toBe(25000);
    });

    it('floors SALT cap at $10k for very high AGI Single (OBBBA)', () => {
      // AGI $600k → excess = $100k, reduction = $100k × 30% = $30k
      // Cap = max($10k, $40k - $30k) = max($10k, $10k) = $10k
      const result = calculateScheduleA(
        makeDeductions({
          stateLocalIncomeTax: 30000,
          realEstateTax: 15000,
        }),
        600000,
        FilingStatus.Single,
      );
      expect(result.saltDeduction).toBe(10000);
    });

    it('phases down SALT cap for MFJ AGI above $500k (OBBBA)', () => {
      // MFJ uses same $500k threshold as Single, base cap $40k
      // AGI $550k → excess = $50k, reduction = $15k, cap = $25k
      const result = calculateScheduleA(
        makeDeductions({
          stateLocalIncomeTax: 30000,
          realEstateTax: 15000,
        }),
        550000,
        FilingStatus.MarriedFilingJointly,
      );
      expect(result.saltDeduction).toBe(25000);
    });

    it('phases down SALT cap for MFS at $250k threshold (OBBBA)', () => {
      // MFS: base cap $20k, threshold $250k, floor $5k
      // AGI $300k → excess = $50k, reduction = $50k × 30% = $15k
      // Cap = max($5k, $20k - $15k) = max($5k, $5k) = $5k
      const result = calculateScheduleA(
        makeDeductions({
          stateLocalIncomeTax: 15000,
          realEstateTax: 5000,
        }),
        300000,
        FilingStatus.MarriedFilingSeparately,
      );
      expect(result.saltDeduction).toBe(5000);
    });
  });

  describe('Interest deduction', () => {
    it('combines mortgage interest and PMI', () => {
      const result = calculateScheduleA(
        makeDeductions({
          mortgageInterest: 8000,
          mortgageInsurancePremiums: 1200,
        }),
        100000,
        FilingStatus.Single,
      );
      expect(result.interestDeduction).toBe(9200);
    });
  });

  describe('Charitable deduction', () => {
    it('combines cash and non-cash', () => {
      const result = calculateScheduleA(
        makeDeductions({
          charitableCash: 5000,
          charitableNonCash: 2000,
        }),
        100000,
        FilingStatus.Single,
      );
      expect(result.charitableDeduction).toBe(7000);
    });
  });

  describe('Casualty loss deduction', () => {
    it('applies $100 floor and 10% AGI floor', () => {
      const result = calculateScheduleA(
        makeDeductions({ casualtyLoss: 25000 }),
        100000, // AGI
        FilingStatus.Single,
      );
      // 25000 - 100 = 24900 (per-loss floor)
      // 24900 - 10000 (10% of 100k) = 14900
      expect(result.otherDeduction).toBe(14900);
    });

    it('returns 0 when loss is below both floors', () => {
      const result = calculateScheduleA(
        makeDeductions({ casualtyLoss: 5000 }),
        100000,
        FilingStatus.Single,
      );
      // 5000 - 100 = 4900; 4900 - 10000 = negative → 0
      expect(result.otherDeduction).toBe(0);
    });

    it('returns 0 for casualty loss of $100 or less', () => {
      const result = calculateScheduleA(
        makeDeductions({ casualtyLoss: 100 }),
        50000,
        FilingStatus.Single,
      );
      // 100 - 100 = 0 → 0
      expect(result.otherDeduction).toBe(0);
    });

    it('combines casualty loss with other deductions', () => {
      const result = calculateScheduleA(
        makeDeductions({
          casualtyLoss: 30000,
          otherDeductions: 500,
        }),
        100000,
        FilingStatus.Single,
      );
      // Casualty: 30000 - 100 = 29900; 29900 - 10000 = 19900
      // Other: 500
      // Total other deduction: 19900 + 500 = 20400
      expect(result.otherDeduction).toBe(20400);
    });
  });

  describe('Total itemized', () => {
    it('sums all categories correctly', () => {
      const result = calculateScheduleA(
        makeDeductions({
          medicalExpenses: 15000,
          stateLocalIncomeTax: 8000,
          realEstateTax: 5000,
          mortgageInterest: 6000,
          charitableCash: 3000,
          charitableNonCash: 500,
        }),
        150000,
        FilingStatus.Single,
      );
      // Medical: 15000 - 11250 = 3750
      // SALT: 13000 (under $40,000 cap)
      // Interest: 6000
      // Charitable: 3500
      // Other: 0
      expect(result.totalItemized).toBe(26250);
    });

    it('returns 0 when all deductions are 0', () => {
      const result = calculateScheduleA(
        makeDeductions(),
        100000,
        FilingStatus.Single,
      );
      expect(result.totalItemized).toBe(0);
    });
  });
});
