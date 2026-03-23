import { describe, it, expect } from 'vitest';
import { calculateProgressiveTax, getMarginalRate } from '../src/engine/brackets.js';
import { FilingStatus } from '../src/types/index.js';

describe('calculateProgressiveTax', () => {
  it('calculates tax for a single filer at $50,000', () => {
    const result = calculateProgressiveTax(50000, FilingStatus.Single);
    // 10% on first $11,925 = $1,192.50
    // 12% on $11,925-$48,475 = $4,386.00
    // 22% on $48,475-$50,000 = $335.50
    // Total = $5,914.00
    expect(result.tax).toBe(5914);
    expect(result.marginalRate).toBe(0.22);
    expect(result.brackets).toHaveLength(3);
  });

  it('calculates tax for a single filer at $0', () => {
    const result = calculateProgressiveTax(0, FilingStatus.Single);
    expect(result.tax).toBe(0);
    expect(result.brackets).toHaveLength(0);
  });

  it('handles negative income as zero', () => {
    const result = calculateProgressiveTax(-5000, FilingStatus.Single);
    expect(result.tax).toBe(0);
  });

  it('calculates tax for MFJ at $100,000', () => {
    const result = calculateProgressiveTax(100000, FilingStatus.MarriedFilingJointly);
    // 10% on $0-$23,850 = $2,385.00
    // 12% on $23,850-$96,950 = $8,772.00
    // 22% on $96,950-$100,000 = $671.00
    // Total = $11,828.00
    expect(result.tax).toBe(11828);
    expect(result.marginalRate).toBe(0.22);
  });

  it('calculates tax for HOH at $75,000', () => {
    const result = calculateProgressiveTax(75000, FilingStatus.HeadOfHousehold);
    // 10% on $0-$17,000 = $1,700.00
    // 12% on $17,000-$64,850 = $5,742.00
    // 22% on $64,850-$75,000 = $2,233.00
    // Total = $9,675.00
    expect(result.tax).toBe(9675);
  });

  it('calculates tax in the top bracket', () => {
    const result = calculateProgressiveTax(1000000, FilingStatus.Single);
    expect(result.marginalRate).toBe(0.37);
    expect(result.brackets).toHaveLength(7);
  });

  it('returns correct bracket details', () => {
    const result = calculateProgressiveTax(20000, FilingStatus.Single);
    expect(result.brackets[0]).toEqual({
      rate: 0.10,
      taxableAtRate: 11925,
      taxAtRate: 1192.5,
    });
    expect(result.brackets[1]).toEqual({
      rate: 0.12,
      taxableAtRate: 8075,
      taxAtRate: 969,
    });
  });
});

describe('getMarginalRate', () => {
  it('returns 10% for income in the first bracket', () => {
    expect(getMarginalRate(5000, FilingStatus.Single)).toBe(0.10);
  });

  it('returns 22% for $60k single', () => {
    expect(getMarginalRate(60000, FilingStatus.Single)).toBe(0.22);
  });

  it('returns 37% for $1M single', () => {
    expect(getMarginalRate(1000000, FilingStatus.Single)).toBe(0.37);
  });
});
