import { describe, it, expect } from 'vitest';
import { calculateForeignTaxCredit } from '../src/engine/foreignTaxCredit.js';
import { FilingStatus } from '../src/types/index.js';

describe('calculateForeignTaxCredit', () => {
  // ── Disqualifying / Zero Cases ──────────────────────────────────────────

  describe('Zero and edge cases', () => {
    it('returns 0 credit when no foreign tax paid', () => {
      const result = calculateForeignTaxCredit(0, 10000, 100000, 20000, FilingStatus.Single);
      expect(result.creditAllowed).toBe(0);
      expect(result.foreignTaxPaid).toBe(0);
    });

    it('returns 0 credit when negative foreign tax paid', () => {
      const result = calculateForeignTaxCredit(-500, 10000, 100000, 20000, FilingStatus.Single);
      expect(result.creditAllowed).toBe(0);
    });

    it('returns 0 credit when worldwide income is 0', () => {
      const result = calculateForeignTaxCredit(500, 10000, 0, 20000, FilingStatus.Single);
      expect(result.creditAllowed).toBe(0);
      expect(result.foreignTaxPaid).toBe(500);
    });

    it('returns 0 credit when worldwide income is negative', () => {
      const result = calculateForeignTaxCredit(500, 10000, -5000, 20000, FilingStatus.Single);
      expect(result.creditAllowed).toBe(0);
    });

    it('returns 0 credit when US tax liability is 0', () => {
      const result = calculateForeignTaxCredit(500, 10000, 100000, 0, FilingStatus.Single);
      expect(result.creditAllowed).toBe(0);
    });
  });

  // ── Simplified Election (IRC §904(j)) ──────────────────────────────────

  describe('Simplified election', () => {
    it('allows full credit when tax paid <= $300 (Single)', () => {
      // $200 tax, $5000 foreign income, $100k worldwide, $20k US tax
      const result = calculateForeignTaxCredit(200, 5000, 100000, 20000, FilingStatus.Single);
      expect(result.creditAllowed).toBe(200);
    });

    it('allows full credit at exactly $300 (Single)', () => {
      const result = calculateForeignTaxCredit(300, 5000, 100000, 20000, FilingStatus.Single);
      expect(result.creditAllowed).toBe(300);
    });

    it('uses Form 1116 limitation when tax > $300 (Single)', () => {
      // $301 tax → not eligible for simplified election
      // Limitation = $20,000 × ($5,000 / $100,000) = $1,000
      // Credit = min($301, $1,000) = $301
      const result = calculateForeignTaxCredit(301, 5000, 100000, 20000, FilingStatus.Single);
      expect(result.creditAllowed).toBe(301);
    });

    it('allows full credit when tax paid <= $600 (MFJ)', () => {
      const result = calculateForeignTaxCredit(500, 5000, 100000, 20000, FilingStatus.MarriedFilingJointly);
      expect(result.creditAllowed).toBe(500);
    });

    it('allows full credit at exactly $600 (MFJ)', () => {
      const result = calculateForeignTaxCredit(600, 5000, 100000, 20000, FilingStatus.MarriedFilingJointly);
      expect(result.creditAllowed).toBe(600);
    });

    it('uses Form 1116 limitation when tax > $600 (MFJ)', () => {
      // $601 → limitation = $20k × $5k/$100k = $1,000 → credit = min($601, $1,000) = $601
      const result = calculateForeignTaxCredit(601, 5000, 100000, 20000, FilingStatus.MarriedFilingJointly);
      expect(result.creditAllowed).toBe(601);
    });

    it('simplified election requires foreign income >= tax paid', () => {
      // $200 tax paid but only $100 foreign income → cannot use simplified
      // Falls through to Form 1116: limitation = $20k × $100/$100k = $20
      const result = calculateForeignTaxCredit(200, 100, 100000, 20000, FilingStatus.Single);
      expect(result.creditAllowed).toBe(20);
    });

    it('treats QSS as MFJ for simplified threshold', () => {
      const result = calculateForeignTaxCredit(500, 5000, 100000, 20000, FilingStatus.QualifyingSurvivingSpouse);
      expect(result.creditAllowed).toBe(500);
    });
  });

  // ── Form 1116 Limitation ───────────────────────────────────────────────

  describe('Form 1116 limitation', () => {
    it('credits limited by foreign income ratio', () => {
      // $5,000 foreign tax, $20k foreign income, $100k worldwide, $20k US tax
      // Limitation = $20k × ($20k / $100k) = $4,000
      // Credit = min($5,000, $4,000) = $4,000
      const result = calculateForeignTaxCredit(5000, 20000, 100000, 20000, FilingStatus.Single);
      expect(result.creditAllowed).toBe(4000);
    });

    it('credits limited by foreign tax paid when limitation is higher', () => {
      // $1,000 foreign tax, $50k foreign income, $100k worldwide, $20k US tax
      // Limitation = $20k × ($50k / $100k) = $10,000
      // Credit = min($1,000, $10,000) = $1,000
      const result = calculateForeignTaxCredit(1000, 50000, 100000, 20000, FilingStatus.Single);
      expect(result.creditAllowed).toBe(1000);
    });

    it('credits capped at US tax liability', () => {
      // $500 foreign tax, $500 foreign income, $500 worldwide, $200 US tax
      // Limitation = $200 × ($500 / $500) = $200
      // Credit = min($500, $200) = $200
      const result = calculateForeignTaxCredit(500, 500, 500, 200, FilingStatus.Single);
      expect(result.creditAllowed).toBe(200);
    });

    it('foreign income capped at worldwide income', () => {
      // Foreign income ($150k) > worldwide ($100k) → capped at $100k
      // Limitation = $20k × ($100k / $100k) = $20,000
      // Credit = min($5,000, $20,000) = $5,000
      const result = calculateForeignTaxCredit(5000, 150000, 100000, 20000, FilingStatus.Single);
      expect(result.creditAllowed).toBe(5000);
    });

    it('handles fractional ratios correctly', () => {
      // $3,000 tax, $33,333 foreign income, $100k worldwide, $20k US tax
      // Limitation = $20,000 × (33333 / 100000) = $6,666.60
      // Credit = min($3,000, $6,666.60) = $3,000
      const result = calculateForeignTaxCredit(3000, 33333, 100000, 20000, FilingStatus.Single);
      expect(result.creditAllowed).toBe(3000);
    });
  });

  // ── Per-Category Limitation (IRC §904(d)) ──────────────────────────────

  describe('Per-category limitation', () => {
    it('calculates separate limitations for each category', () => {
      const result = calculateForeignTaxCredit(
        3000, 40000, 100000, 20000, FilingStatus.Single,
        [
          { category: 'general', foreignTaxPaid: 2000, foreignSourceIncome: 30000 },
          { category: 'passive', foreignTaxPaid: 1000, foreignSourceIncome: 10000 },
        ],
      );

      // General: limitation = $20k × ($30k / $100k) = $6,000 → credit = min($2,000, $6,000) = $2,000
      // Passive: limitation = $20k × ($10k / $100k) = $2,000 → credit = min($1,000, $2,000) = $1,000
      // Total = $3,000
      expect(result.creditAllowed).toBe(3000);
      expect(result.foreignTaxPaid).toBe(3000);
      expect(result.categoryResults).toHaveLength(2);
      expect(result.categoryResults![0].creditAllowed).toBe(2000);
      expect(result.categoryResults![1].creditAllowed).toBe(1000);
    });

    it('each category limitation is independent', () => {
      const result = calculateForeignTaxCredit(
        8500, 40000, 100000, 20000, FilingStatus.Single,
        [
          // High-tax category: $8,000 tax but only $5,000 limitation → capped at $5,000
          { category: 'general', foreignTaxPaid: 8000, foreignSourceIncome: 25000 },
          // Low-tax category: $500 tax, $3,000 limitation → full $500
          { category: 'passive', foreignTaxPaid: 500, foreignSourceIncome: 15000 },
        ],
      );

      // General: limitation = $20k × $25k/$100k = $5,000 → credit = $5,000
      // Passive: limitation = $20k × $15k/$100k = $3,000 → credit = $500
      // Total = $5,500 (not $8,500 which would be the simple sum)
      expect(result.categoryResults![0].creditAllowed).toBe(5000);
      expect(result.categoryResults![0].limitation).toBe(5000);
      expect(result.categoryResults![1].creditAllowed).toBe(500);
      expect(result.creditAllowed).toBe(5500);
    });

    it('handles category with zero foreign tax', () => {
      const result = calculateForeignTaxCredit(
        1000, 40000, 100000, 20000, FilingStatus.Single,
        [
          { category: 'general', foreignTaxPaid: 0, foreignSourceIncome: 30000 },
          { category: 'passive', foreignTaxPaid: 1000, foreignSourceIncome: 10000 },
        ],
      );

      expect(result.categoryResults![0].creditAllowed).toBe(0);
      expect(result.categoryResults![1].creditAllowed).toBe(1000);
      expect(result.creditAllowed).toBe(1000);
    });

    it('prevents cross-category sheltering', () => {
      // High-tax general + zero-tax passive
      // Without separate limitation: total FTC = min($10k, $20k × $60k/$100k) = $10k
      // With separate limitation: general limited to $6k, passive $0
      const result = calculateForeignTaxCredit(
        10000, 60000, 100000, 20000, FilingStatus.Single,
        [
          { category: 'general', foreignTaxPaid: 10000, foreignSourceIncome: 30000 },
          { category: 'passive', foreignTaxPaid: 0, foreignSourceIncome: 30000 },
        ],
      );

      // General: limitation = $20k × $30k/$100k = $6,000 → credit = $6,000
      // Passive: $0 tax → $0 credit
      expect(result.creditAllowed).toBe(6000);
    });
  });
});
