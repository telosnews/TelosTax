import { describe, it, expect } from 'vitest';
import { calculateEITC } from '../src/engine/eitc.js';
import { FilingStatus } from '../src/types/index.js';

describe('calculateEITC', () => {
  describe('Disqualifying conditions', () => {
    it('returns 0 for MFS filers', () => {
      const result = calculateEITC(FilingStatus.MarriedFilingSeparately, 30000, 30000, 1, 0);
      expect(result).toBe(0);
    });

    it('returns 0 when investment income exceeds limit ($11,950)', () => {
      const result = calculateEITC(FilingStatus.Single, 30000, 30000, 1, 12000);
      expect(result).toBe(0);
    });

    it('returns 0 when earned income is 0', () => {
      const result = calculateEITC(FilingStatus.Single, 0, 10000, 1, 0);
      expect(result).toBe(0);
    });

    it('returns 0 for negative earned income', () => {
      const result = calculateEITC(FilingStatus.Single, -5000, 10000, 0, 0);
      expect(result).toBe(0);
    });
  });

  describe('No qualifying children (Single)', () => {
    // Age 35 in 2025 → eligible for childless EITC (must be 25-64)
    const DOB_AGE_35 = '1990-06-15';

    it('returns max credit at earned income threshold', () => {
      // 0 children: max credit = $649, earned income threshold = $8,490
      const result = calculateEITC(FilingStatus.Single, 8490, 8490, 0, 0, DOB_AGE_35, 2025);
      expect(result).toBe(649);
    });

    it('phases in for very low income', () => {
      // Phase-in rate = 649 / 8490 ≈ 0.07644
      const result = calculateEITC(FilingStatus.Single, 3000, 3000, 0, 0, DOB_AGE_35, 2025);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(649);
    });

    it('returns 0 when income exceeds complete phase-out (Single)', () => {
      // Complete phase-out for 0 children, Single = $19,104
      const result = calculateEITC(FilingStatus.Single, 20000, 20000, 0, 0, DOB_AGE_35, 2025);
      expect(result).toBe(0);
    });

    it('returns 0 when DOB is not provided (cannot verify age)', () => {
      const result = calculateEITC(FilingStatus.Single, 8490, 8490, 0, 0);
      expect(result).toBe(0);
    });
  });

  describe('One qualifying child (Single)', () => {
    it('returns max credit in plateau range', () => {
      // 1 child: max = $4,328, threshold = $12,730, phase-out starts at $23,350
      const result = calculateEITC(FilingStatus.Single, 15000, 15000, 1, 0);
      expect(result).toBe(4328);
    });

    it('returns 0 above complete phase-out', () => {
      // Complete phase-out for 1 child, Single = $50,434
      const result = calculateEITC(FilingStatus.Single, 51000, 51000, 1, 0);
      expect(result).toBe(0);
    });

    it('partially phases out in phase-out range', () => {
      // Phase-out starts at $23,350, ends at $50,434
      const result = calculateEITC(FilingStatus.Single, 35000, 35000, 1, 0);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(4328);
    });
  });

  describe('Two qualifying children (Single)', () => {
    it('returns max credit in plateau range', () => {
      // 2 children: max = $7,152, threshold = $17,880, phase-out starts at $23,350
      const result = calculateEITC(FilingStatus.Single, 20000, 20000, 2, 0);
      expect(result).toBe(7152);
    });

    it('returns 0 above complete phase-out', () => {
      // Complete phase-out for 2 children, Single = $57,310
      const result = calculateEITC(FilingStatus.Single, 58000, 58000, 2, 0);
      expect(result).toBe(0);
    });
  });

  describe('Three+ qualifying children (Single)', () => {
    it('returns max credit for 3 children', () => {
      // 3 children: max = $8,046
      const result = calculateEITC(FilingStatus.Single, 20000, 20000, 3, 0);
      expect(result).toBe(8046);
    });

    it('caps lookup at 3 children for 4+', () => {
      const threeKids = calculateEITC(FilingStatus.Single, 20000, 20000, 3, 0);
      const fourKids = calculateEITC(FilingStatus.Single, 20000, 20000, 4, 0);
      expect(fourKids).toBe(threeKids);
    });
  });

  describe('MFJ thresholds', () => {
    it('uses higher phase-out start for MFJ', () => {
      // MFJ phase-out for 1 child starts at $30,470 vs $23,350 for Single
      // At $25,000 earned income: Single would be in phase-out, MFJ still in plateau
      const single = calculateEITC(FilingStatus.Single, 25000, 25000, 1, 0);
      const mfj = calculateEITC(FilingStatus.MarriedFilingJointly, 25000, 25000, 1, 0);
      expect(mfj).toBe(4328); // Still in plateau for MFJ
      expect(single).toBeLessThan(4328); // In phase-out for Single
    });
  });

  describe('AGI vs earned income (lower credit rule)', () => {
    it('uses whichever income produces lower credit', () => {
      // Taxpayer with high AGI (from capital gains) but lower earned income
      // Both should produce a credit, but the lower one wins
      const result = calculateEITC(FilingStatus.Single, 15000, 40000, 1, 500);
      // Earned income = 15000 → plateau → $4,328
      // AGI = 40000 → deep in phase-out → much less
      // Should use the lower (AGI-based) amount
      expect(result).toBeLessThan(4328);
    });
  });

  describe('Investment income at limit', () => {
    it('allows credit at exactly $11,950 investment income', () => {
      const result = calculateEITC(FilingStatus.Single, 15000, 15000, 1, 11950);
      expect(result).toBe(4328); // Still eligible
    });

    it('disqualifies at $11,951 investment income', () => {
      const result = calculateEITC(FilingStatus.Single, 15000, 15000, 1, 11951);
      expect(result).toBe(0);
    });
  });
});
