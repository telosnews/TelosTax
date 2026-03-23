import { describe, it, expect } from 'vitest';
import { calculateScheduleSE } from '../src/engine/scheduleSE.js';
import { FilingStatus } from '../src/types/index.js';

describe('calculateScheduleSE', () => {
  it('calculates SE tax for $100,000 net profit', () => {
    const result = calculateScheduleSE(100000, FilingStatus.Single);

    // Net earnings = 100000 * 0.9235 = 92350
    expect(result.netEarnings).toBe(92350);

    // SS tax = 92350 * 0.124 = 11451.40
    expect(result.socialSecurityTax).toBe(11451.4);

    // Medicare = 92350 * 0.029 = 2678.15
    expect(result.medicareTax).toBe(2678.15);

    // No additional Medicare (below $200k threshold)
    expect(result.additionalMedicareTax).toBe(0);

    // Total = 11451.40 + 2678.15 = 14129.55
    expect(result.totalSETax).toBe(14129.55);

    // Deductible half = 14129.55 / 2 = 7064.78 (rounded)
    expect(result.deductibleHalf).toBe(7064.78);
  });

  it('returns zeros for zero or negative profit', () => {
    const result = calculateScheduleSE(0, FilingStatus.Single);
    expect(result.totalSETax).toBe(0);
    expect(result.deductibleHalf).toBe(0);
  });

  it('caps SS tax at wage base', () => {
    const result = calculateScheduleSE(250000, FilingStatus.Single);
    // Net earnings = 250000 * 0.9235 = 230875
    // SS wage base = 176100
    // SS tax = 176100 * 0.124 = 21836.40
    expect(result.socialSecurityTax).toBe(21836.4);
    // Medicare = 230875 * 0.029 = 6695.38
    expect(result.medicareTax).toBe(6695.38);
  });

  it('applies additional Medicare tax for high earners', () => {
    const result = calculateScheduleSE(300000, FilingStatus.Single);
    // Net earnings = 300000 * 0.9235 = 277050
    // Additional Medicare on (277050 - 200000) * 0.009 = 693.45
    expect(result.additionalMedicareTax).toBe(693.45);
  });

  it('uses MFJ threshold for additional Medicare', () => {
    const result = calculateScheduleSE(300000, FilingStatus.MarriedFilingJointly);
    // Net earnings = 277050
    // Additional Medicare on (277050 - 250000) * 0.009 = 243.45
    expect(result.additionalMedicareTax).toBe(243.45);
  });

  it('reduces SS base by W-2 wages', () => {
    const result = calculateScheduleSE(100000, FilingStatus.Single, 150000);
    // Remaining SS base = 176100 - 150000 = 26100
    // Net earnings = 92350
    // SS tax = min(92350, 26100) * 0.124 = 26100 * 0.124 = 3236.40
    expect(result.socialSecurityTax).toBe(3236.4);
  });
});
