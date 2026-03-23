import { describe, it, expect } from 'vitest';
import { calculateForm7206, legacyToForm7206Input, getLTCPremiumLimit } from '../src/engine/form7206.js';
import { FilingStatus } from '../src/types/index.js';
import { LTC_PREMIUM_LIMITS_2025 } from '../src/constants/tax2025.js';

describe('calculateForm7206', () => {
  // ─── Basic Full-Year Cases ─────────────────────────────

  it('full-year, no LTC/Medicare — full deduction', () => {
    const result = calculateForm7206(
      { medicalDentalVisionPremiums: 8000 },
      50000,  // Schedule C net profit
      0,      // Schedule F
      3532,   // deductible half of SE tax
      0,      // retirement contributions
      0,      // APTC
      FilingStatus.Single,
    );
    expect(result.medicalDentalVisionPremiums).toBe(8000);
    expect(result.totalPremiums).toBe(8000);
    expect(result.eligibleMonths).toBe(12);
    expect(result.proratedPremiums).toBe(8000);
    // adjustedNetSEProfit = 50000 - 3532 - 0 = 46468
    expect(result.adjustedNetSEProfit).toBe(46468);
    expect(result.finalDeduction).toBe(8000);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns zero deduction when input is undefined', () => {
    const result = calculateForm7206(
      undefined,
      50000, 0, 3532, 0, 0,
      FilingStatus.Single,
    );
    expect(result.finalDeduction).toBe(0);
  });

  // ─── Net Profit Limitation ────────────────────────────

  it('limits deduction to adjusted net profit (net - SE tax - retirement)', () => {
    const result = calculateForm7206(
      { medicalDentalVisionPremiums: 30000 },
      25000,  // net profit
      0,
      1766,   // deductible half SE tax
      5000,   // retirement contributions
      0,
      FilingStatus.Single,
    );
    // adjustedNetSEProfit = max(0, 25000 - 1766 - 5000) = 18234
    expect(result.adjustedNetSEProfit).toBe(18234);
    expect(result.netProfitLimitedAmount).toBe(18234);
    expect(result.finalDeduction).toBe(18234);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('limited');
  });

  it('zero SE income → $0 deduction', () => {
    const result = calculateForm7206(
      { medicalDentalVisionPremiums: 5000 },
      0, 0, 0, 0, 0,
      FilingStatus.Single,
    );
    expect(result.netSEProfit).toBe(0);
    expect(result.adjustedNetSEProfit).toBe(0);
    expect(result.finalDeduction).toBe(0);
  });

  it('negative SE income (loss) → $0 deduction', () => {
    const result = calculateForm7206(
      { medicalDentalVisionPremiums: 5000 },
      -10000, 0, 0, 0, 0,
      FilingStatus.Single,
    );
    expect(result.netSEProfit).toBe(0);
    expect(result.finalDeduction).toBe(0);
  });

  it('Schedule F contributes to net profit cap', () => {
    const result = calculateForm7206(
      { medicalDentalVisionPremiums: 10000 },
      5000,   // Schedule C
      8000,   // Schedule F
      918,    // SE tax on combined 13000
      0,
      0,
      FilingStatus.Single,
    );
    // netSEProfit = max(0, 5000 + 8000) = 13000
    // adjustedNetSEProfit = max(0, 13000 - 918 - 0) = 12082
    expect(result.netSEProfit).toBe(13000);
    expect(result.adjustedNetSEProfit).toBe(12082);
    expect(result.finalDeduction).toBe(10000);
  });

  // ─── Monthly Proration ────────────────────────────────

  it('prorates premiums for 6 of 12 eligible months', () => {
    const result = calculateForm7206(
      {
        medicalDentalVisionPremiums: 12000,
        monthlyEligibility: {
          // Had employer plan Jan-Jun (first 6 months)
          taxpayerEligibleForEmployerPlan: [true, true, true, true, true, true, false, false, false, false, false, false],
        },
      },
      100000, 0, 7065, 0, 0,
      FilingStatus.Single,
    );
    expect(result.eligibleMonths).toBe(6);
    expect(result.proratedPremiums).toBe(6000); // 12000 * 6/12
    expect(result.finalDeduction).toBe(6000);
  });

  it('MFJ: month ineligible if either spouse has employer plan', () => {
    const result = calculateForm7206(
      {
        medicalDentalVisionPremiums: 12000,
        monthlyEligibility: {
          // Taxpayer: no employer plan all year
          taxpayerEligibleForEmployerPlan: Array(12).fill(false),
          // Spouse: employer plan first 3 months
          spouseEligibleForEmployerPlan: [true, true, true, false, false, false, false, false, false, false, false, false],
        },
      },
      100000, 0, 7065, 0, 0,
      FilingStatus.MarriedFilingJointly,
    );
    expect(result.eligibleMonths).toBe(9);
    expect(result.proratedPremiums).toBe(9000); // 12000 * 9/12
  });

  // ─── LTC Age-Based Limits ─────────────────────────────

  it('caps LTC at age-40-or-under bracket', () => {
    expect(getLTCPremiumLimit(35)).toBe(LTC_PREMIUM_LIMITS_2025.AGE_40_OR_UNDER);
    expect(getLTCPremiumLimit(40)).toBe(LTC_PREMIUM_LIMITS_2025.AGE_40_OR_UNDER);
  });

  it('caps LTC at age-41-to-50 bracket', () => {
    expect(getLTCPremiumLimit(41)).toBe(LTC_PREMIUM_LIMITS_2025.AGE_41_TO_50);
    expect(getLTCPremiumLimit(50)).toBe(LTC_PREMIUM_LIMITS_2025.AGE_41_TO_50);
  });

  it('caps LTC at age-51-to-60 bracket', () => {
    expect(getLTCPremiumLimit(51)).toBe(LTC_PREMIUM_LIMITS_2025.AGE_51_TO_60);
    expect(getLTCPremiumLimit(60)).toBe(LTC_PREMIUM_LIMITS_2025.AGE_51_TO_60);
  });

  it('caps LTC at age-61-to-70 bracket', () => {
    expect(getLTCPremiumLimit(61)).toBe(LTC_PREMIUM_LIMITS_2025.AGE_61_TO_70);
    expect(getLTCPremiumLimit(70)).toBe(LTC_PREMIUM_LIMITS_2025.AGE_61_TO_70);
  });

  it('caps LTC at age-71-and-over bracket', () => {
    expect(getLTCPremiumLimit(71)).toBe(LTC_PREMIUM_LIMITS_2025.AGE_71_AND_OVER);
    expect(getLTCPremiumLimit(85)).toBe(LTC_PREMIUM_LIMITS_2025.AGE_71_AND_OVER);
  });

  it('LTC limit is 0 when age is undefined', () => {
    expect(getLTCPremiumLimit(undefined)).toBe(0);
  });

  it('LTC premiums capped by age-based limit (single filer)', () => {
    const result = calculateForm7206(
      {
        medicalDentalVisionPremiums: 5000,
        longTermCarePremiums: 3000,
        taxpayerAge: 45, // age 41-50 → limit $900
      },
      100000, 0, 7065, 0, 0,
      FilingStatus.Single,
    );
    expect(result.longTermCarePremiumsClaimed).toBe(900);
    expect(result.totalPremiums).toBe(5900); // 5000 + 900
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('LTC premiums reduced');
  });

  it('MFJ per-person LTC splits apply different age limits', () => {
    const result = calculateForm7206(
      {
        medicalDentalVisionPremiums: 5000,
        longTermCarePremiums: 6000,
        taxpayerAge: 45,         // limit $900
        spouseAge: 65,           // limit $4,810
        taxpayerLTCPremium: 2000,
        spouseLTCPremium: 4000,
      },
      100000, 0, 7065, 0, 0,
      FilingStatus.MarriedFilingJointly,
    );
    // Taxpayer: min(2000, 900) = 900
    // Spouse: min(4000, 4810) = 4000
    // Total LTC: 900 + 4000 = 4900
    expect(result.longTermCarePremiumsClaimed).toBe(4900);
    expect(result.taxpayerLTCLimit).toBe(900);
    expect(result.spouseLTCLimit).toBe(4810);
    expect(result.totalPremiums).toBe(9900); // 5000 + 4900
  });

  it('MFJ total LTC (no per-person split) uses combined age limits', () => {
    const result = calculateForm7206(
      {
        medicalDentalVisionPremiums: 5000,
        longTermCarePremiums: 8000,
        taxpayerAge: 65,  // limit $4,810
        spouseAge: 65,    // limit $4,810
      },
      100000, 0, 7065, 0, 0,
      FilingStatus.MarriedFilingJointly,
    );
    // Combined limit: 4810 + 4810 = 9620; premiums 8000 < 9620 → no cap
    expect(result.longTermCarePremiumsClaimed).toBe(8000);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when LTC premiums provided without taxpayer age', () => {
    const result = calculateForm7206(
      {
        medicalDentalVisionPremiums: 5000,
        longTermCarePremiums: 2000,
        // taxpayerAge intentionally omitted
      },
      100000, 0, 7065, 0, 0,
      FilingStatus.Single,
    );
    expect(result.longTermCarePremiumsClaimed).toBe(0);
    expect(result.warnings.some(w => w.includes('age not provided'))).toBe(true);
  });

  // ─── Medicare Premiums ────────────────────────────────

  it('includes Medicare premiums in total', () => {
    const result = calculateForm7206(
      {
        medicalDentalVisionPremiums: 5000,
        medicarePremiums: 2400,
      },
      100000, 0, 7065, 0, 0,
      FilingStatus.Single,
    );
    expect(result.medicarePremiums).toBe(2400);
    expect(result.totalPremiums).toBe(7400);
    expect(result.finalDeduction).toBe(7400);
  });

  // ─── PTC/APTC Adjustment ──────────────────────────────

  it('APTC reduces the deduction', () => {
    const result = calculateForm7206(
      { medicalDentalVisionPremiums: 10000 },
      100000, 0, 7065, 0,
      3000,  // APTC advance payments
      FilingStatus.Single,
    );
    // adjustedNetSEProfit = 100000 - 7065 = 92935
    // netProfitLimited = min(10000, 92935) = 10000
    // final = max(0, 10000 - 3000) = 7000
    expect(result.ptcAdjustment).toBe(3000);
    expect(result.finalDeduction).toBe(7000);
  });

  it('APTC larger than premium → $0 deduction (no negative)', () => {
    const result = calculateForm7206(
      { medicalDentalVisionPremiums: 2000 },
      100000, 0, 7065, 0,
      5000,  // APTC exceeds premiums
      FilingStatus.Single,
    );
    expect(result.finalDeduction).toBe(0);
  });

  // ─── Legacy Bridge ────────────────────────────────────

  it('legacyToForm7206Input wraps healthInsurancePremiums', () => {
    const input = legacyToForm7206Input(7500);
    expect(input.medicalDentalVisionPremiums).toBe(7500);
    expect(input.longTermCarePremiums).toBeUndefined();
    expect(input.medicarePremiums).toBeUndefined();
    expect(input.monthlyEligibility).toBeUndefined();
  });

  it('legacy bridge produces same result as old simple cap (within limits)', () => {
    const input = legacyToForm7206Input(5000);
    const result = calculateForm7206(
      input,
      50000, 0, 3532, 0, 0,
      FilingStatus.Single,
    );
    // Old behavior: min(5000, 50000) = 5000
    // New behavior: min(5000, 50000 - 3532 - 0) = min(5000, 46468) = 5000
    expect(result.finalDeduction).toBe(5000);
  });
});
