import { describe, it, expect } from 'vitest';
import { calculateEstimatedQuarterly, calculateSafeHarbor } from '../src/engine/estimatedTax.js';

describe('calculateEstimatedQuarterly', () => {
  it('divides remaining tax liability into 4 quarterly payments', () => {
    const result = calculateEstimatedQuarterly(20000, 8000);
    // Remaining = 20000 - 8000 = 12000. Quarterly = 3000
    expect(result.annualEstimated).toBe(12000);
    expect(result.quarterlyPayment).toBe(3000);
  });

  it('returns 0 when withholding covers tax', () => {
    const result = calculateEstimatedQuarterly(15000, 20000);
    expect(result.annualEstimated).toBe(0);
    expect(result.quarterlyPayment).toBe(0);
  });

  it('returns 0 when tax owed is 0', () => {
    const result = calculateEstimatedQuarterly(0, 5000);
    expect(result.annualEstimated).toBe(0);
    expect(result.quarterlyPayment).toBe(0);
  });

  it('handles fractional quarterly amounts', () => {
    const result = calculateEstimatedQuarterly(10000, 1);
    // 9999 / 4 = 2499.75
    expect(result.quarterlyPayment).toBe(2499.75);
  });
});

describe('calculateSafeHarbor', () => {
  it('uses 100% rate when AGI is at or below $150k', () => {
    const result = calculateSafeHarbor(10000, 150000);
    expect(result).toBe(10000); // 100% of current year tax
  });

  it('uses 110% rate when AGI exceeds $150k', () => {
    const result = calculateSafeHarbor(10000, 200000);
    expect(result).toBe(11000); // 110% of current year tax
  });

  it('returns 0 for $0 tax', () => {
    const result = calculateSafeHarbor(0, 200000);
    expect(result).toBe(0);
  });
});
