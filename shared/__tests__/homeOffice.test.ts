import { describe, it, expect } from 'vitest';
import {
  calculateHomeOfficeDeduction,
  calculateHomeOfficeDetailed,
  compareHomeOfficeMethods,
} from '../src/engine/homeOffice.js';

describe('calculateHomeOfficeDeduction', () => {
  it('returns 0 when no method selected', () => {
    expect(calculateHomeOfficeDeduction({ method: null }, 50000)).toBe(0);
  });

  // ─── Simplified method ──────────────────────────────────────────────
  describe('Simplified method', () => {
    it('calculates $5/sqft', () => {
      const result = calculateHomeOfficeDeduction(
        { method: 'simplified', squareFeet: 200 },
        50000,
      );
      expect(result).toBe(1000); // 200 * $5
    });

    it('caps at 300 sqft ($1,500)', () => {
      const result = calculateHomeOfficeDeduction(
        { method: 'simplified', squareFeet: 500 },
        50000,
      );
      expect(result).toBe(1500); // 300 * $5 max
    });

    it('limits to tentative profit', () => {
      const result = calculateHomeOfficeDeduction(
        { method: 'simplified', squareFeet: 300 },
        800, // tentative profit only $800
      );
      expect(result).toBe(800); // limited to profit
    });

    it('returns 0 when tentative profit is 0 or negative', () => {
      expect(calculateHomeOfficeDeduction({ method: 'simplified', squareFeet: 200 }, 0)).toBe(0);
      expect(calculateHomeOfficeDeduction({ method: 'simplified', squareFeet: 200 }, -500)).toBe(0);
    });
  });

  // ─── Actual method — legacy backward compatibility ──────────────────
  describe('Actual method (legacy)', () => {
    it('calculates proportional deduction with single actualExpenses', () => {
      const result = calculateHomeOfficeDeduction(
        { method: 'actual', squareFeet: 200, totalHomeSquareFeet: 2000, actualExpenses: 12000 },
        50000,
      );
      // Ratio = 200/2000 = 0.1. 0.1 * 12000 = 1200
      expect(result).toBe(1200);
    });

    it('returns 0 when totalHomeSquareFeet is 0', () => {
      const result = calculateHomeOfficeDeduction(
        { method: 'actual', squareFeet: 200, totalHomeSquareFeet: 0, actualExpenses: 12000 },
        50000,
      );
      expect(result).toBe(0);
    });

    it('returns 0 when squareFeet is 0', () => {
      const result = calculateHomeOfficeDeduction(
        { method: 'actual', squareFeet: 0, totalHomeSquareFeet: 2000, actualExpenses: 12000 },
        50000,
      );
      expect(result).toBe(0);
    });

    it('returns 0 when totalHomeSquareFeet is undefined', () => {
      const result = calculateHomeOfficeDeduction(
        { method: 'actual', squareFeet: 200, actualExpenses: 12000 },
        50000,
      );
      expect(result).toBe(0);
    });

    it('caps ratio at 100%', () => {
      const result = calculateHomeOfficeDeduction(
        { method: 'actual', squareFeet: 3000, totalHomeSquareFeet: 2000, actualExpenses: 12000 },
        50000,
      );
      // Ratio capped at 1.0. 1.0 * 12000 = 12000
      expect(result).toBe(12000);
    });
  });

  // ─── Actual method — Form 8829 cascade ──────────────────────────────
  describe('Actual method (Form 8829 cascade)', () => {
    it('all tiers fit within gross income — no limitation', () => {
      // 20% business use, $50k income — everything fits
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 200,
        totalHomeSquareFeet: 1000,
        mortgageInterest: 12000,    // × 20% = $2,400 (tier 1)
        realEstateTaxes: 5000,      // × 20% = $1,000 (tier 1)
        insurance: 2000,            // × 20% = $400 (tier 2)
        utilities: 3600,            // × 20% = $720 (tier 2)
        homeCostOrValue: 300000,    // depreciation (tier 3)
        landValue: 50000,
        dateFirstUsedForBusiness: '2020-01-01', // prior year → 3.636%
      }, 50000);

      expect(result.method).toBe('actual');
      expect(result.businessPercentage).toBe(0.2);

      // Tier 1: ($12,000 + $5,000) × 20% = $3,400
      expect(result.tier1Total).toBe(3400);
      expect(result.tier1Allowed).toBe(3400);

      // Tier 2: ($2,000 + $3,600) × 20% = $1,120
      expect(result.tier2Total).toBe(1120);
      expect(result.tier2Allowed).toBe(1120);

      // Tier 3: ($300,000 - $50,000) × 20% × 3.636% = $250,000 × 0.2 × 0.03636 = $1,818
      expect(result.depreciationComputed).toBe(1818);
      expect(result.tier3Total).toBe(1818);
      expect(result.tier3Allowed).toBe(1818);

      // Total: $3,400 + $1,120 + $1,818 = $6,338
      expect(result.totalDeduction).toBe(6338);

      // No carryovers
      expect(result.operatingExpenseCarryover).toBeUndefined();
      expect(result.depreciationCarryover).toBeUndefined();
    });

    it('gross income limitation — Tier 2 partially allowed', () => {
      // 20% business use, only $5,000 income
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 200,
        totalHomeSquareFeet: 1000,
        mortgageInterest: 12000,    // × 20% = $2,400 (tier 1)
        realEstateTaxes: 5000,      // × 20% = $1,000 (tier 1)
        insurance: 2000,            // × 20% = $400 (tier 2)
        utilities: 3600,            // × 20% = $720 (tier 2)
        homeCostOrValue: 300000,
        landValue: 50000,
        dateFirstUsedForBusiness: '2020-01-01',
      }, 5000);

      // Tier 1: $3,400 always deductible
      expect(result.tier1Allowed).toBe(3400);

      // Remaining after Tier 1: $5,000 - $3,400 = $1,600
      // Tier 2 total: $1,120 → fits, allowed = $1,120
      expect(result.tier2Total).toBe(1120);
      expect(result.tier2Allowed).toBe(1120);

      // Remaining after Tier 2: $1,600 - $1,120 = $480
      // Tier 3 total: $1,818 → limited to $480
      expect(result.tier3Allowed).toBe(480);
      expect(result.depreciationCarryover).toBe(1338); // 1818 - 480

      // Total: $3,400 + $1,120 + $480 = $5,000 (matches gross income)
      expect(result.totalDeduction).toBe(5000);
    });

    it('gross income limitation — Tier 2 partially disallowed, Tier 3 zero', () => {
      // Very low income: $4,000
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 200,
        totalHomeSquareFeet: 1000,
        mortgageInterest: 12000,    // × 20% = $2,400 (tier 1)
        realEstateTaxes: 5000,      // × 20% = $1,000 (tier 1)
        insurance: 5000,            // × 20% = $1,000 (tier 2)
        utilities: 5000,            // × 20% = $1,000 (tier 2)
        homeCostOrValue: 300000,
        landValue: 50000,
        dateFirstUsedForBusiness: '2020-01-01',
      }, 4000);

      // Tier 1: $3,400 always deductible
      expect(result.tier1Allowed).toBe(3400);

      // Remaining: $4,000 - $3,400 = $600
      // Tier 2 total: $2,000 → limited to $600
      expect(result.tier2Total).toBe(2000);
      expect(result.tier2Allowed).toBe(600);
      expect(result.operatingExpenseCarryover).toBe(1400); // 2000 - 600

      // No room for Tier 3
      expect(result.tier3Allowed).toBe(0);
      expect(result.depreciationCarryover).toBe(1818);

      // Total: $3,400 + $600 + $0 = $4,000
      expect(result.totalDeduction).toBe(4000);
    });

    it('zero gross income — only Tier 1 (always deductible) counts', () => {
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 200,
        totalHomeSquareFeet: 1000,
        mortgageInterest: 12000,
        realEstateTaxes: 5000,
        insurance: 2000,
        utilities: 3600,
        homeCostOrValue: 300000,
        landValue: 50000,
        dateFirstUsedForBusiness: '2020-01-01',
      }, 0);

      // Even with zero income, Tier 1 is always deductible
      expect(result.tier1Allowed).toBe(3400);
      // But remaining is 0 (max(0, 0 - 3400) = 0), so Tier 2 and 3 are zero
      expect(result.tier2Allowed).toBe(0);
      expect(result.tier3Allowed).toBe(0);

      // Total = tier1 only
      expect(result.totalDeduction).toBe(3400);

      // Everything else carries forward
      expect(result.operatingExpenseCarryover).toBe(1120);
      expect(result.depreciationCarryover).toBe(1818);
    });

    it('prior-year carryovers included in tiers', () => {
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 200,
        totalHomeSquareFeet: 1000,
        mortgageInterest: 6000,       // × 20% = $1,200 (tier 1)
        insurance: 1000,              // × 20% = $200 (tier 2)
        priorYearOperatingCarryover: 500,  // adds to tier 2
        priorYearDepreciationCarryover: 800, // adds to tier 3
      }, 10000);

      expect(result.tier1Allowed).toBe(1200);

      // Tier 2: $200 operating + $500 carryover = $700
      expect(result.tier2Total).toBe(700);
      expect(result.tier2Allowed).toBe(700);

      // Tier 3: $0 depreciation (no home cost) + $800 carryover = $800
      expect(result.tier3Total).toBe(800);
      expect(result.tier3Allowed).toBe(800);

      expect(result.totalDeduction).toBe(2700);
    });

    it('auto-calculates depreciation for 2025 first-year (January)', () => {
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 250,
        totalHomeSquareFeet: 1000,        // 25%
        homeCostOrValue: 400000,
        landValue: 100000,
        dateFirstUsedForBusiness: '2025-01-15',
        insurance: 100,                   // trigger category mode
      }, 100000);

      // Building basis: $400k - $100k = $300k
      // Business basis: $300k × 25% = $75,000
      // January 2025 rate: 3.485%
      // Depreciation: $75,000 × 0.03485 = $2,613.75
      expect(result.depreciationComputed).toBe(2613.75);
    });

    it('auto-calculates depreciation for 2025 first-year (July)', () => {
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 200,
        totalHomeSquareFeet: 1000,        // 20%
        homeCostOrValue: 300000,
        landValue: 50000,
        dateFirstUsedForBusiness: '2025-07-01',
        insurance: 100,
      }, 100000);

      // Building basis: $250,000
      // Business basis: $50,000
      // July rate: 1.667%
      // Depreciation: $50,000 × 0.01667 = $833.50
      expect(result.depreciationComputed).toBe(833.5);
    });

    it('auto-calculates depreciation for prior year (subsequent year rate)', () => {
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 200,
        totalHomeSquareFeet: 1000,
        homeCostOrValue: 300000,
        landValue: 50000,
        dateFirstUsedForBusiness: '2023-06-01', // before 2025
        insurance: 100,
      }, 100000);

      // Business basis: $250,000 × 20% = $50,000
      // Subsequent year rate: 3.636%
      // Depreciation: $50,000 × 0.03636 = $1,818
      expect(result.depreciationComputed).toBe(1818);
    });

    it('uses subsequent year rate when no date provided', () => {
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 200,
        totalHomeSquareFeet: 1000,
        homeCostOrValue: 300000,
        landValue: 50000,
        insurance: 100,
      }, 100000);

      // No date → default to subsequent year rate
      expect(result.depreciationComputed).toBe(1818);
    });

    it('returns 0 depreciation when land value exceeds home value', () => {
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 200,
        totalHomeSquareFeet: 1000,
        homeCostOrValue: 100000,
        landValue: 150000, // land > total → invalid
        insurance: 100,
      }, 100000);

      expect(result.depreciationComputed).toBe(0);
    });

    it('handles no expense categories gracefully', () => {
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 200,
        totalHomeSquareFeet: 1000,
      }, 50000);

      // No categories and no legacy actualExpenses → zero deduction
      expect(result.totalDeduction).toBe(0);
    });

    it('returns 0 when square footage is missing', () => {
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        insurance: 2000,
      }, 50000);

      expect(result.totalDeduction).toBe(0);
    });
  });

  // ─── Detailed result structure ──────────────────────────────────────
  describe('calculateHomeOfficeDetailed', () => {
    it('returns correct structure for simplified method', () => {
      const result = calculateHomeOfficeDetailed(
        { method: 'simplified', squareFeet: 200 },
        50000,
      );
      expect(result.method).toBe('simplified');
      expect(result.simplifiedDeduction).toBe(1000);
      expect(result.totalDeduction).toBe(1000);
      expect(result.tier1Total).toBeUndefined();
    });

    it('returns correct structure for null method', () => {
      const result = calculateHomeOfficeDetailed({ method: null }, 50000);
      expect(result.totalDeduction).toBe(0);
    });

    it('returns businessPercentage correctly', () => {
      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 240,
        totalHomeSquareFeet: 1200,
        insurance: 100,
      }, 50000);
      expect(result.businessPercentage).toBe(0.2);
    });
  });

  // ─── compareHomeOfficeMethods ───────────────────────────────────────
  describe('compareHomeOfficeMethods', () => {
    it('returns both method calculations', () => {
      const result = compareHomeOfficeMethods(200, 2000, 12000, 50000);
      expect(result.simplified).toBe(1000);  // 200 * $5
      expect(result.actual).toBe(1200);       // (200/2000) * 12000
    });
  });

  // ─── IRS Pub 587 worked example ─────────────────────────────────────
  describe('IRS Publication 587 worked example', () => {
    it('matches the Pub 587 example calculation', () => {
      // From Pub 587: 20% business use, $6,000 gross income
      // Tier 1: mortgage interest + real estate taxes = $15,000 total × 20% = $3,000
      // Business expenses unrelated to home = $2,000 (not modeled here — those are Schedule C expenses)
      // So available = $6,000 - $3,000 = $3,000 for tiers 2+3
      // Tier 2: maintenance + insurance + utilities = $4,000 × 20% = $800
      // Available for tier 3: $3,000 - $800 = $2,200
      // Tier 3: depreciation = $8,000 × 20% = $1,600; fits within $2,200
      // Total: $3,000 + $800 + $1,600 = $5,400
      // (Note: the $6,000 income minus the $2,000 unrelated expenses is handled
      //  at the Schedule C level as tentative profit, so we pass $6,000 here)

      const result = calculateHomeOfficeDetailed({
        method: 'actual',
        squareFeet: 200,
        totalHomeSquareFeet: 1000,
        mortgageInterest: 10000,    // × 20% = $2,000
        realEstateTaxes: 5000,      // × 20% = $1,000
        insurance: 1500,            // × 20% = $300
        utilities: 2500,            // × 20% = $500
        homeCostOrValue: 250000,
        landValue: 30000,
        dateFirstUsedForBusiness: '2020-01-01', // subsequent year rate: 3.636%
      }, 6000);

      // Tier 1: $3,000
      expect(result.tier1Allowed).toBe(3000);

      // Remaining: $6,000 - $3,000 = $3,000
      // Tier 2: $300 + $500 = $800
      expect(result.tier2Allowed).toBe(800);

      // Remaining: $3,000 - $800 = $2,200
      // Tier 3: ($250k - $30k) × 20% × 3.636% = $220,000 × 0.2 × 0.03636 = $1,599.84
      expect(result.depreciationComputed).toBe(1599.84);
      expect(result.tier3Allowed).toBe(1599.84);

      // Total: $3,000 + $800 + $1,599.84 = $5,399.84
      expect(result.totalDeduction).toBe(5399.84);

      // No carryovers since everything fit
      expect(result.operatingExpenseCarryover).toBeUndefined();
      expect(result.depreciationCarryover).toBeUndefined();
    });
  });
});
