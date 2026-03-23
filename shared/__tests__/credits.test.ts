import { describe, it, expect } from 'vitest';
import { calculateCredits } from '../src/engine/credits.js';
import { FilingStatus } from '../src/types/index.js';

describe('calculateCredits', () => {
  describe('Child Tax Credit', () => {
    it('calculates $2,200 per qualifying child', () => {
      const result = calculateCredits(FilingStatus.Single, 100000, {
        qualifyingChildren: 2,
        otherDependents: 0,
      });
      expect(result.childTaxCredit).toBe(4400);
    });

    it('calculates $500 per other dependent', () => {
      const result = calculateCredits(FilingStatus.Single, 100000, {
        qualifyingChildren: 0,
        otherDependents: 3,
      });
      expect(result.otherDependentCredit).toBe(1500);
    });

    it('combines both credit types', () => {
      const result = calculateCredits(FilingStatus.Single, 100000, {
        qualifyingChildren: 2,
        otherDependents: 1,
      });
      expect(result.childTaxCredit).toBe(4400);
      expect(result.otherDependentCredit).toBe(500);
      expect(result.totalCredits).toBe(4900);
    });

    it('phases out above $200k for single filer', () => {
      const result = calculateCredits(FilingStatus.Single, 210000, {
        qualifyingChildren: 1,
        otherDependents: 0,
      });
      // Excess = 210000 - 200000 = 10000
      // Reduction = ceil(10000/1000) * 50 = 10 * 50 = 500
      // Credit = 2200 - 500 = 1700
      expect(result.childTaxCredit).toBe(1700);
    });

    it('phases out above $400k for MFJ', () => {
      const result = calculateCredits(FilingStatus.MarriedFilingJointly, 410000, {
        qualifyingChildren: 1,
        otherDependents: 0,
      });
      // Excess = 410000 - 400000 = 10000
      // Reduction = ceil(10000/1000) * 50 = 500
      // Credit = 2200 - 500 = 1700
      expect(result.childTaxCredit).toBe(1700);
    });

    it('completely phases out with enough excess', () => {
      const result = calculateCredits(FilingStatus.Single, 260000, {
        qualifyingChildren: 1,
        otherDependents: 0,
      });
      // Excess = 260000 - 200000 = 60000
      // Reduction = ceil(60000/1000) * 50 = 60 * 50 = 3000
      // Credit = 2200 - 3000 = 0 (capped at 0)
      expect(result.childTaxCredit).toBe(0);
    });

    it('returns 0 when no credit info provided', () => {
      const result = calculateCredits(FilingStatus.Single, 100000);
      expect(result.childTaxCredit).toBe(0);
      expect(result.otherDependentCredit).toBe(0);
    });
  });

  describe('Education Credits', () => {
    it('calculates AOTC: 100% of first $2k + 25% of next $2k', () => {
      const result = calculateCredits(FilingStatus.Single, 60000, undefined, [
        {
          id: '1',
          type: 'american_opportunity',
          studentName: 'Student',
          institution: 'University',
          tuitionPaid: 5000,
          scholarships: 0,
        },
      ]);
      // AOTC: $2000 + (25% * $2000) = $2500
      // educationCredit = 60% non-refundable = $1500
      // aotcRefundableCredit = 40% refundable = $1000
      expect(result.educationCredit).toBe(1500);
      expect(result.aotcRefundableCredit).toBe(1000);
    });

    it('reduces AOTC expenses by scholarships', () => {
      const result = calculateCredits(FilingStatus.Single, 60000, undefined, [
        {
          id: '1',
          type: 'american_opportunity',
          studentName: 'Student',
          institution: 'University',
          tuitionPaid: 5000,
          scholarships: 3000,
        },
      ]);
      // Qualified = 5000 - 3000 = 2000
      // AOTC: $2000 (100% of first $2k) + $0 = $2000
      // educationCredit = 60% non-refundable = $1200
      // aotcRefundableCredit = 40% refundable = $800
      expect(result.educationCredit).toBe(1200);
      expect(result.aotcRefundableCredit).toBe(800);
    });

    it('calculates LLC at 20% of first $10k', () => {
      const result = calculateCredits(FilingStatus.Single, 60000, undefined, [
        {
          id: '1',
          type: 'lifetime_learning',
          studentName: 'Student',
          institution: 'University',
          tuitionPaid: 8000,
          scholarships: 0,
        },
      ]);
      // LLC: 20% * $8000 = $1600
      expect(result.educationCredit).toBe(1600);
    });

    it('caps LLC at $2,000', () => {
      const result = calculateCredits(FilingStatus.Single, 60000, undefined, [
        {
          id: '1',
          type: 'lifetime_learning',
          studentName: 'Student',
          institution: 'University',
          tuitionPaid: 15000,
          scholarships: 0,
        },
      ]);
      // LLC: 20% * $10000 (cap) = $2000
      expect(result.educationCredit).toBe(2000);
    });

    it('phases out AOTC above $80k for single', () => {
      const result = calculateCredits(FilingStatus.Single, 85000, undefined, [
        {
          id: '1',
          type: 'american_opportunity',
          studentName: 'Student',
          institution: 'University',
          tuitionPaid: 5000,
          scholarships: 0,
        },
      ]);
      // Phase-out: excess = 85000 - 80000 = 5000. Range = 10000.
      // Reduction factor = 5000/10000 = 0.5
      // Total AOTC = 2500 * (1 - 0.5) = 1250
      // educationCredit = 60% non-refundable = 750
      // aotcRefundableCredit = 40% refundable = 500
      expect(result.educationCredit).toBe(750);
      expect(result.aotcRefundableCredit).toBe(500);
    });

    it('fully phases out AOTC above $90k for single', () => {
      const result = calculateCredits(FilingStatus.Single, 95000, undefined, [
        {
          id: '1',
          type: 'american_opportunity',
          studentName: 'Student',
          institution: 'University',
          tuitionPaid: 5000,
          scholarships: 0,
        },
      ]);
      expect(result.educationCredit).toBe(0);
    });

    it('returns 0 credit when scholarships exceed tuition', () => {
      const result = calculateCredits(FilingStatus.Single, 60000, undefined, [
        {
          id: '1',
          type: 'american_opportunity',
          studentName: 'Student',
          institution: 'University',
          tuitionPaid: 3000,
          scholarships: 5000,
        },
      ]);
      // Qualified = max(0, 3000 - 5000) = 0
      expect(result.educationCredit).toBe(0);
    });
  });

  describe('EITC placeholder', () => {
    it('initializes eitcCredit at 0 (calculated separately in form1040)', () => {
      const result = calculateCredits(FilingStatus.Single, 50000);
      expect(result.eitcCredit).toBe(0);
    });
  });
});
