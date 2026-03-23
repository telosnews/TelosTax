import { describe, it, expect } from 'vitest';
import { calculateScholarshipCredit } from '../src/engine/scholarshipCredit.js';

describe('calculateScholarshipCredit (IRC §25F)', () => {
  it('returns $0 for zero contribution', () => {
    const result = calculateScholarshipCredit({ contributionAmount: 0 });
    expect(result.credit).toBe(0);
    expect(result.eligibleContribution).toBe(0);
  });

  it('returns full contribution when under $1,700', () => {
    const result = calculateScholarshipCredit({ contributionAmount: 1000 });
    expect(result.credit).toBe(1000);
    expect(result.eligibleContribution).toBe(1000);
  });

  it('caps credit at $1,700', () => {
    const result = calculateScholarshipCredit({ contributionAmount: 5000 });
    expect(result.credit).toBe(1700);
    expect(result.eligibleContribution).toBe(5000);
  });

  it('reduces by state tax credit received dollar-for-dollar', () => {
    const result = calculateScholarshipCredit({
      contributionAmount: 2000,
      stateTaxCreditReceived: 500,
    });
    // Eligible = 2000 - 500 = 1500
    expect(result.eligibleContribution).toBe(1500);
    expect(result.credit).toBe(1500);
  });

  it('caps at $1,700 after state offset', () => {
    const result = calculateScholarshipCredit({
      contributionAmount: 5000,
      stateTaxCreditReceived: 1000,
    });
    // Eligible = 5000 - 1000 = 4000, capped at 1700
    expect(result.eligibleContribution).toBe(4000);
    expect(result.credit).toBe(1700);
  });

  it('returns $0 if state credit exceeds contribution', () => {
    const result = calculateScholarshipCredit({
      contributionAmount: 1000,
      stateTaxCreditReceived: 1500,
    });
    expect(result.eligibleContribution).toBe(0);
    expect(result.credit).toBe(0);
  });

  it('returns $0 for negative contribution', () => {
    const result = calculateScholarshipCredit({ contributionAmount: -500 });
    expect(result.credit).toBe(0);
  });

  it('handles no state credit (undefined)', () => {
    const result = calculateScholarshipCredit({ contributionAmount: 1200 });
    expect(result.credit).toBe(1200);
  });

  it('exact $1,700 contribution produces $1,700 credit', () => {
    const result = calculateScholarshipCredit({ contributionAmount: 1700 });
    expect(result.credit).toBe(1700);
    expect(result.eligibleContribution).toBe(1700);
  });
});
