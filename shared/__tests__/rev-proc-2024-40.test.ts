/**
 * Sprint 19: Rev. Proc. 2024-40 Constants Validation
 *
 * Validates EVERY inflation-adjusted constant in tax2025.ts against the official
 * IRS Revenue Procedure 2024-40 document (irs.gov/pub/irs-drop/rp-24-40.pdf).
 *
 * Non-Rev-Proc constants are validated against their respective authority sources:
 *   - HSA limits → Rev. Proc. 2024-25
 *   - PTC FPL tables → HHS 2024 Federal Poverty Guidelines (89 FR 3936)
 *   - PTC applicable figures → Rev. Proc. 2024-35
 *   - SE tax / SS wage base → SSA COLA announcement, Oct 2024
 *   - Schedule H thresholds → SSA announcement
 *   - OBBBA / Schedule 1-A → One Big Beautiful Bill Act statutory text
 *   - Statutory (non-indexed) constants → IRC section references
 *
 * @authority Rev. Proc. 2024-40 (primary), Rev. Proc. 2024-25 (HSA),
 *           Rev. Proc. 2024-35 (PTC), HHS 89 FR 3936 (FPL), SSA (wage base)
 */

import { describe, it, expect } from 'vitest';
import { FilingStatus } from '../src/types/index.js';
import { calculateEITC } from '../src/engine/eitc.js';
import {
  TAX_BRACKETS_2025,
  STANDARD_DEDUCTION_2025,
  ADDITIONAL_STANDARD_DEDUCTION,
  DEPENDENT_STANDARD_DEDUCTION,
  SE_TAX,
  QBI,
  HOME_OFFICE,
  VEHICLE,
  SCHEDULE_A,
  CHILD_TAX_CREDIT,
  EDUCATION_CREDITS,
  ESTIMATED_TAX,
  HSA,
  STUDENT_LOAN_INTEREST,
  IRA,
  CAPITAL_GAINS_RATES,
  NIIT,
  EARLY_DISTRIBUTION,
  ACTC,
  DEPENDENT_CARE,
  SAVERS_CREDIT,
  CLEAN_ENERGY,
  HSA_DISTRIBUTIONS,
  SCHEDULE_D,
  SOCIAL_SECURITY,
  EDUCATOR_EXPENSES,
  SCHEDULE_E,
  EV_CREDIT,
  ENERGY_EFFICIENCY,
  FOREIGN_TAX_CREDIT,
  EXCESS_SS_TAX,
  ALIMONY,
  ESTIMATED_TAX_PENALTY,
  KIDDIE_TAX,
  FEIE,
  SCHEDULE_H,
  NOL,
  ADOPTION_CREDIT,
  DEPENDENT_CARE_FSA,
  PREMIUM_TAX_CREDIT,
  SCHEDULE_1A,
  HOME_SALE_EXCLUSION,
  CHARITABLE_AGI_LIMITS,
  CANCELLATION_OF_DEBT,
  EXCESS_CONTRIBUTION,
  DISTRIBUTION_529,
  QOZ,
} from '../src/constants/tax2025.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3.01: Tax Rate Tables (Rev. Proc. 2024-40, Table 1)
//
// All 35 bracket thresholds (7 brackets × 5 filing statuses).
// Rates are statutory (IRC §1(j)), thresholds are inflation-adjusted.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.01 — Tax Rate Tables', () => {
  it('Single bracket thresholds match Rev. Proc. 2024-40 Table 1', () => {
    const brackets = TAX_BRACKETS_2025[FilingStatus.Single];
    expect(brackets).toHaveLength(7);
    expect(brackets[0]).toEqual({ min: 0, max: 11925, rate: 0.10 });
    expect(brackets[1]).toEqual({ min: 11925, max: 48475, rate: 0.12 });
    expect(brackets[2]).toEqual({ min: 48475, max: 103350, rate: 0.22 });
    expect(brackets[3]).toEqual({ min: 103350, max: 197300, rate: 0.24 });
    expect(brackets[4]).toEqual({ min: 197300, max: 250525, rate: 0.32 });
    expect(brackets[5]).toEqual({ min: 250525, max: 626350, rate: 0.35 });
    expect(brackets[6]).toEqual({ min: 626350, max: Infinity, rate: 0.37 });
  });

  it('MFJ bracket thresholds match Rev. Proc. 2024-40 Table 1', () => {
    const brackets = TAX_BRACKETS_2025[FilingStatus.MarriedFilingJointly];
    expect(brackets).toHaveLength(7);
    expect(brackets[0]).toEqual({ min: 0, max: 23850, rate: 0.10 });
    expect(brackets[1]).toEqual({ min: 23850, max: 96950, rate: 0.12 });
    expect(brackets[2]).toEqual({ min: 96950, max: 206700, rate: 0.22 });
    expect(brackets[3]).toEqual({ min: 206700, max: 394600, rate: 0.24 });
    expect(brackets[4]).toEqual({ min: 394600, max: 501050, rate: 0.32 });
    expect(brackets[5]).toEqual({ min: 501050, max: 751600, rate: 0.35 });
    expect(brackets[6]).toEqual({ min: 751600, max: Infinity, rate: 0.37 });
  });

  it('MFS bracket thresholds match Rev. Proc. 2024-40 Table 1', () => {
    const brackets = TAX_BRACKETS_2025[FilingStatus.MarriedFilingSeparately];
    expect(brackets).toHaveLength(7);
    expect(brackets[0]).toEqual({ min: 0, max: 11925, rate: 0.10 });
    expect(brackets[1]).toEqual({ min: 11925, max: 48475, rate: 0.12 });
    expect(brackets[2]).toEqual({ min: 48475, max: 103350, rate: 0.22 });
    expect(brackets[3]).toEqual({ min: 103350, max: 197300, rate: 0.24 });
    expect(brackets[4]).toEqual({ min: 197300, max: 250525, rate: 0.32 });
    expect(brackets[5]).toEqual({ min: 250525, max: 375800, rate: 0.35 });
    expect(brackets[6]).toEqual({ min: 375800, max: Infinity, rate: 0.37 });
  });

  it('HoH bracket thresholds match Rev. Proc. 2024-40 Table 1', () => {
    const brackets = TAX_BRACKETS_2025[FilingStatus.HeadOfHousehold];
    expect(brackets).toHaveLength(7);
    expect(brackets[0]).toEqual({ min: 0, max: 17000, rate: 0.10 });
    expect(brackets[1]).toEqual({ min: 17000, max: 64850, rate: 0.12 });
    expect(brackets[2]).toEqual({ min: 64850, max: 103350, rate: 0.22 });
    expect(brackets[3]).toEqual({ min: 103350, max: 197300, rate: 0.24 });
    expect(brackets[4]).toEqual({ min: 197300, max: 250500, rate: 0.32 });
    expect(brackets[5]).toEqual({ min: 250500, max: 626350, rate: 0.35 });
    expect(brackets[6]).toEqual({ min: 626350, max: Infinity, rate: 0.37 });
  });

  it('QSS brackets match MFJ (same thresholds per IRC §1(a))', () => {
    const qss = TAX_BRACKETS_2025[FilingStatus.QualifyingSurvivingSpouse];
    const mfj = TAX_BRACKETS_2025[FilingStatus.MarriedFilingJointly];
    expect(qss).toEqual(mfj);
  });

  it('all brackets have exactly 7 rates: 10%, 12%, 22%, 24%, 32%, 35%, 37%', () => {
    const expectedRates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
    const statuses = [
      FilingStatus.Single, FilingStatus.MarriedFilingJointly,
      FilingStatus.MarriedFilingSeparately, FilingStatus.HeadOfHousehold,
      FilingStatus.QualifyingSurvivingSpouse,
    ];
    for (const status of statuses) {
      const rates = TAX_BRACKETS_2025[status].map(b => b.rate);
      expect(rates).toEqual(expectedRates);
    }
  });

  it('bracket boundaries are contiguous (no gaps or overlaps)', () => {
    const statuses = [
      FilingStatus.Single, FilingStatus.MarriedFilingJointly,
      FilingStatus.MarriedFilingSeparately, FilingStatus.HeadOfHousehold,
      FilingStatus.QualifyingSurvivingSpouse,
    ];
    for (const status of statuses) {
      const brackets = TAX_BRACKETS_2025[status];
      expect(brackets[0].min).toBe(0);
      for (let i = 1; i < brackets.length; i++) {
        expect(brackets[i].min).toBe(brackets[i - 1].max);
      }
      expect(brackets[brackets.length - 1].max).toBe(Infinity);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3.02: Standard Deduction (Rev. Proc. 2024-40, Table 5)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.02 — Standard Deduction', () => {
  it('standard deduction amounts match Table 5', () => {
    expect(STANDARD_DEDUCTION_2025[FilingStatus.Single]).toBe(15750);
    expect(STANDARD_DEDUCTION_2025[FilingStatus.MarriedFilingJointly]).toBe(31500);
    expect(STANDARD_DEDUCTION_2025[FilingStatus.MarriedFilingSeparately]).toBe(15750);
    expect(STANDARD_DEDUCTION_2025[FilingStatus.HeadOfHousehold]).toBe(23625);
    expect(STANDARD_DEDUCTION_2025[FilingStatus.QualifyingSurvivingSpouse]).toBe(31500);
  });

  it('additional standard deduction for 65+/blind', () => {
    expect(ADDITIONAL_STANDARD_DEDUCTION.UNMARRIED).toBe(2000);  // Single, HoH
    expect(ADDITIONAL_STANDARD_DEDUCTION.MARRIED).toBe(1600);    // MFJ, MFS
  });

  it('dependent standard deduction amounts', () => {
    expect(DEPENDENT_STANDARD_DEDUCTION.MIN_AMOUNT).toBe(1350);
    expect(DEPENDENT_STANDARD_DEDUCTION.EARNED_INCOME_PLUS).toBe(450);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3.03: Kiddie Tax (Rev. Proc. 2024-40)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.03 — Kiddie Tax', () => {
  it('kiddie tax thresholds match §3.03', () => {
    expect(KIDDIE_TAX.UNEARNED_INCOME_THRESHOLD).toBe(2700); // 2 × $1,350
    expect(KIDDIE_TAX.STANDARD_DEDUCTION_UNEARNED).toBe(1350);
  });

  it('kiddie tax age limits per IRC §1(g)', () => {
    expect(KIDDIE_TAX.AGE_LIMIT).toBe(19);
    expect(KIDDIE_TAX.STUDENT_AGE_LIMIT).toBe(24);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Sections 3.04-3.07: EITC (Rev. Proc. 2024-40)
//
// EITC amounts and thresholds are validated through the engine tests in
// worksheet-traces.test.ts. Here we validate the investment income limit.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.04-3.07 — EITC', () => {
  // Note: EITC constants are embedded in eitc.ts (not exported from tax2025.ts)
  // They are validated through behavioral tests in worksheet-traces.test.ts
  // This section validates the few EITC-adjacent constants that are exposed

  it('EITC investment income limit is $11,950 per §3.07', () => {
    // Behavioral validation: EITC should be disallowed when investment income > $11,950
    const atLimit = calculateEITC(FilingStatus.Single, 15000, 15000, 1, 11950);
    const overLimit = calculateEITC(FilingStatus.Single, 15000, 15000, 1, 11951);
    expect(atLimit).toBeGreaterThan(0);
    expect(overLimit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3.06: Saver's Credit (Rev. Proc. 2024-40)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.06 — Saver\'s Credit', () => {
  it('contribution limits per IRC §25B(a)', () => {
    expect(SAVERS_CREDIT.CONTRIBUTION_LIMIT).toBe(2000);
    expect(SAVERS_CREDIT.CONTRIBUTION_LIMIT_MFJ).toBe(4000);
  });

  it('Single/MFS AGI thresholds match Notice 2024-80 §25B', () => {
    expect(SAVERS_CREDIT.SINGLE_50).toBe(23750);
    expect(SAVERS_CREDIT.SINGLE_20).toBe(25500);
    expect(SAVERS_CREDIT.SINGLE_10).toBe(39500);
  });

  it('HoH AGI thresholds match Notice 2024-80 §25B', () => {
    expect(SAVERS_CREDIT.HOH_50).toBe(35625);
    expect(SAVERS_CREDIT.HOH_20).toBe(38250);
    expect(SAVERS_CREDIT.HOH_10).toBe(59250);
  });

  it('MFJ/QSS AGI thresholds match Notice 2024-80 §25B', () => {
    expect(SAVERS_CREDIT.MFJ_50).toBe(47500);
    expect(SAVERS_CREDIT.MFJ_20).toBe(51000);
    expect(SAVERS_CREDIT.MFJ_10).toBe(79000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Sections 3.08-3.10: IRA Limits (Rev. Proc. 2024-40)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.08-3.10 — IRA Limits', () => {
  it('IRA contribution limit per §3.08', () => {
    expect(IRA.MAX_CONTRIBUTION).toBe(7000);
    expect(IRA.CATCH_UP_50_PLUS).toBe(1000); // Statutory, not indexed
  });

  it('Traditional IRA deduction phase-out (covered by plan) per §3.09', () => {
    expect(IRA.DEDUCTION_PHASE_OUT_SINGLE).toBe(79000);
    expect(IRA.DEDUCTION_PHASE_OUT_RANGE_SINGLE).toBe(10000);
    expect(IRA.DEDUCTION_PHASE_OUT_MFJ).toBe(126000);
    expect(IRA.DEDUCTION_PHASE_OUT_RANGE_MFJ).toBe(20000);
  });

  it('MFJ spouse-covered phase-out per §3.09(3)', () => {
    expect(IRA.DEDUCTION_PHASE_OUT_MFJ_SPOUSE_COVERED).toBe(236000);
    expect(IRA.DEDUCTION_PHASE_OUT_RANGE_MFJ_SPOUSE_COVERED).toBe(10000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3.12: Capital Gain Rate Thresholds (Rev. Proc. 2024-40, Table 3)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.12 — Capital Gain Rate Thresholds', () => {
  it('0% rate thresholds match Table 3', () => {
    expect(CAPITAL_GAINS_RATES.THRESHOLD_0[FilingStatus.Single]).toBe(48350);
    expect(CAPITAL_GAINS_RATES.THRESHOLD_0[FilingStatus.MarriedFilingJointly]).toBe(96700);
    expect(CAPITAL_GAINS_RATES.THRESHOLD_0[FilingStatus.MarriedFilingSeparately]).toBe(48350);
    expect(CAPITAL_GAINS_RATES.THRESHOLD_0[FilingStatus.HeadOfHousehold]).toBe(64750);
    expect(CAPITAL_GAINS_RATES.THRESHOLD_0[FilingStatus.QualifyingSurvivingSpouse]).toBe(96700);
  });

  it('15% rate thresholds match Table 3', () => {
    expect(CAPITAL_GAINS_RATES.THRESHOLD_15[FilingStatus.Single]).toBe(533400);
    expect(CAPITAL_GAINS_RATES.THRESHOLD_15[FilingStatus.MarriedFilingJointly]).toBe(600050);
    expect(CAPITAL_GAINS_RATES.THRESHOLD_15[FilingStatus.MarriedFilingSeparately]).toBe(300025);
    expect(CAPITAL_GAINS_RATES.THRESHOLD_15[FilingStatus.HeadOfHousehold]).toBe(566700);
    expect(CAPITAL_GAINS_RATES.THRESHOLD_15[FilingStatus.QualifyingSurvivingSpouse]).toBe(600050);
  });

  it('rates are statutory per IRC §1(h)', () => {
    expect(CAPITAL_GAINS_RATES.RATE_0).toBe(0);
    expect(CAPITAL_GAINS_RATES.RATE_15).toBe(0.15);
    expect(CAPITAL_GAINS_RATES.RATE_20).toBe(0.20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3.19: Educator Expenses (Rev. Proc. 2024-40)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.19 — Educator Expenses', () => {
  it('educator expense deduction limit matches §3.19', () => {
    expect(EDUCATOR_EXPENSES.MAX_DEDUCTION).toBe(300);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3.20: Student Loan Interest (Rev. Proc. 2024-40)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.20 — Student Loan Interest', () => {
  it('student loan deduction amounts match §3.20', () => {
    expect(STUDENT_LOAN_INTEREST.MAX_DEDUCTION).toBe(2500);
    expect(STUDENT_LOAN_INTEREST.PHASE_OUT_SINGLE).toBe(85000);
    expect(STUDENT_LOAN_INTEREST.PHASE_OUT_RANGE_SINGLE).toBe(15000);
    expect(STUDENT_LOAN_INTEREST.PHASE_OUT_MFJ).toBe(170000);
    expect(STUDENT_LOAN_INTEREST.PHASE_OUT_RANGE_MFJ).toBe(30000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Sections 3.23-3.27: CTC, Education Credits (Rev. Proc. 2024-40)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.23 — Child Tax Credit', () => {
  it('CTC amounts match §3.23 and IRC §24', () => {
    expect(CHILD_TAX_CREDIT.PER_CHILD).toBe(2200);
    expect(CHILD_TAX_CREDIT.PER_OTHER_DEPENDENT).toBe(500);
    expect(CHILD_TAX_CREDIT.PHASE_OUT_THRESHOLD_SINGLE).toBe(200000);
    expect(CHILD_TAX_CREDIT.PHASE_OUT_THRESHOLD_MFJ).toBe(400000);
    expect(CHILD_TAX_CREDIT.PHASE_OUT_RATE).toBe(50);
    expect(CHILD_TAX_CREDIT.REFUNDABLE_MAX).toBe(1700); // Rev. Proc. 2024-40 §3.23
  });
});

describe('Rev. Proc. 2024-40, §3.24-3.25 — Education Credits', () => {
  it('AOTC amounts match IRC §25A(i)', () => {
    expect(EDUCATION_CREDITS.AOTC_MAX).toBe(2500);
    expect(EDUCATION_CREDITS.AOTC_FIRST_TIER).toBe(2000);
    expect(EDUCATION_CREDITS.AOTC_SECOND_TIER).toBe(2000);
    expect(EDUCATION_CREDITS.AOTC_REFUNDABLE_RATE).toBe(0.40);
  });

  it('AOTC phase-out thresholds match §3.24', () => {
    expect(EDUCATION_CREDITS.AOTC_PHASE_OUT_SINGLE).toBe(80000);
    expect(EDUCATION_CREDITS.AOTC_PHASE_OUT_RANGE_SINGLE).toBe(10000);
    expect(EDUCATION_CREDITS.AOTC_PHASE_OUT_MFJ).toBe(160000);
    expect(EDUCATION_CREDITS.AOTC_PHASE_OUT_RANGE_MFJ).toBe(20000);
  });

  it('LLC amounts match §3.25', () => {
    expect(EDUCATION_CREDITS.LLC_MAX).toBe(2000);
    expect(EDUCATION_CREDITS.LLC_RATE).toBe(0.20);
    expect(EDUCATION_CREDITS.LLC_PHASE_OUT_SINGLE).toBe(80000);
    expect(EDUCATION_CREDITS.LLC_PHASE_OUT_RANGE_SINGLE).toBe(10000);
    expect(EDUCATION_CREDITS.LLC_PHASE_OUT_MFJ).toBe(160000);
    expect(EDUCATION_CREDITS.LLC_PHASE_OUT_RANGE_MFJ).toBe(20000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3.29: QBI Deduction Thresholds (Rev. Proc. 2024-40)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.29 — QBI Deduction', () => {
  it('QBI thresholds match §3.29', () => {
    expect(QBI.RATE).toBe(0.20);
    expect(QBI.THRESHOLD_SINGLE).toBe(197300);
    expect(QBI.THRESHOLD_MFJ).toBe(394600);
    expect(QBI.PHASE_IN_RANGE_SINGLE).toBe(50000);
    expect(QBI.PHASE_IN_RANGE_MFJ).toBe(100000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3.35: Adoption Credit (Rev. Proc. 2024-40)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.35 — Adoption Credit', () => {
  it('adoption credit amounts match §3.35', () => {
    expect(ADOPTION_CREDIT.MAX_CREDIT).toBe(17280);
    expect(ADOPTION_CREDIT.PHASE_OUT_START).toBe(259190);
    expect(ADOPTION_CREDIT.PHASE_OUT_RANGE).toBe(40000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3.36: FEIE (Rev. Proc. 2024-40)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, §3.36 — FEIE', () => {
  it('FEIE exclusion amount matches §3.36', () => {
    expect(FEIE.EXCLUSION_AMOUNT).toBe(130000);
  });

  it('housing amounts derived from exclusion per IRC §911(c)', () => {
    expect(FEIE.HOUSING_BASE).toBe(20280);
    expect(FEIE.HOUSING_MAX_EXCLUSION).toBe(39000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Rev. Proc. 2024-40, Table 5: APTC Repayment Caps
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-40, Table 5 — APTC Repayment Caps', () => {
  it('repayment caps match Table 5', () => {
    const caps = PREMIUM_TAX_CREDIT.REPAYMENT_CAPS;
    expect(caps).toHaveLength(3);

    // < 200% FPL
    expect(caps[0]).toEqual({ floor: 0, ceiling: 200, singleCap: 375, otherCap: 750 });
    // 200-300% FPL
    expect(caps[1]).toEqual({ floor: 200, ceiling: 300, singleCap: 975, otherCap: 1950 });
    // 300-400% FPL
    expect(caps[2]).toEqual({ floor: 300, ceiling: 400, singleCap: 1625, otherCap: 3250 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NON-REV-PROC CONSTANTS: SSA Announcement — Social Security Wage Base
// ═══════════════════════════════════════════════════════════════════════════════

describe('SSA Announcement — Social Security & SE Tax', () => {
  it('SE tax rates per IRC §1401', () => {
    expect(SE_TAX.RATE).toBe(0.153);             // 12.4% + 2.9%
    expect(SE_TAX.SS_RATE).toBe(0.124);           // OASDI
    expect(SE_TAX.MEDICARE_RATE).toBe(0.029);     // HI
    expect(SE_TAX.NET_EARNINGS_FACTOR).toBe(0.9235);
  });

  it('SS wage base matches SSA 2025 announcement', () => {
    expect(SE_TAX.SS_WAGE_BASE).toBe(176100);
  });

  it('Additional Medicare Tax per ACA §9015', () => {
    expect(SE_TAX.ADDITIONAL_MEDICARE_RATE).toBe(0.009);
    expect(SE_TAX.ADDITIONAL_MEDICARE_THRESHOLD_SINGLE).toBe(200000);
    expect(SE_TAX.ADDITIONAL_MEDICARE_THRESHOLD_MFJ).toBe(250000);
    expect(SE_TAX.ADDITIONAL_MEDICARE_THRESHOLD_MFS).toBe(125000);
  });

  it('Excess SS tax constants match SSA', () => {
    expect(EXCESS_SS_TAX.SS_TAX_RATE).toBe(0.062);
    expect(EXCESS_SS_TAX.SS_WAGE_BASE).toBe(176100);
    expect(EXCESS_SS_TAX.MAX_SS_TAX).toBe(10918.20); // 0.062 × 176,100
    // Verify computation
    expect(EXCESS_SS_TAX.SS_TAX_RATE * EXCESS_SS_TAX.SS_WAGE_BASE).toBeCloseTo(EXCESS_SS_TAX.MAX_SS_TAX, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NON-REV-PROC CONSTANTS: Rev. Proc. 2024-25 — HSA Contribution Limits
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-25 — HSA Limits', () => {
  it('HSA contribution limits match Rev. Proc. 2024-25', () => {
    expect(HSA.INDIVIDUAL_LIMIT).toBe(4300);
    expect(HSA.FAMILY_LIMIT).toBe(8550);
    expect(HSA.CATCH_UP_55_PLUS).toBe(1000); // Statutory, not indexed
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NON-REV-PROC CONSTANTS: HHS 2024 Federal Poverty Guidelines (89 FR 3936)
// ═══════════════════════════════════════════════════════════════════════════════

describe('HHS 2024 Federal Poverty Guidelines — PTC FPL', () => {
  it('48 states + DC FPL amounts match HHS 2024 guidelines', () => {
    expect(PREMIUM_TAX_CREDIT.FPL_BASE_48).toBe(15060);
    expect(PREMIUM_TAX_CREDIT.FPL_INCREMENT_48).toBe(5380);
  });

  it('Alaska FPL amounts match HHS 2024 guidelines', () => {
    expect(PREMIUM_TAX_CREDIT.FPL_BASE_AK).toBe(18810);
    expect(PREMIUM_TAX_CREDIT.FPL_INCREMENT_AK).toBe(6730);
  });

  it('Hawaii FPL amounts match HHS 2024 guidelines', () => {
    expect(PREMIUM_TAX_CREDIT.FPL_BASE_HI).toBe(17310);
    expect(PREMIUM_TAX_CREDIT.FPL_INCREMENT_HI).toBe(6190);
  });

  it('FPL family size computation: 48 states, family of 4', () => {
    // FPL for family of 4 = base + 3 × increment = $15,060 + $16,140 = $31,200
    const fpl4 = PREMIUM_TAX_CREDIT.FPL_BASE_48 + 3 * PREMIUM_TAX_CREDIT.FPL_INCREMENT_48;
    expect(fpl4).toBe(31200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NON-REV-PROC CONSTANTS: Rev. Proc. 2024-35 — PTC Applicable Figure Table
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rev. Proc. 2024-35 — PTC Applicable Figure Table', () => {
  it('applicable figure table has correct number of brackets', () => {
    expect(PREMIUM_TAX_CREDIT.APPLICABLE_FIGURE_TABLE).toHaveLength(6);
  });

  it('applicable figure brackets match Rev. Proc. 2024-35', () => {
    const table = PREMIUM_TAX_CREDIT.APPLICABLE_FIGURE_TABLE;

    expect(table[0]).toEqual({ floor: 0, ceiling: 150, initialPct: 0, finalPct: 0 });
    expect(table[1]).toEqual({ floor: 150, ceiling: 200, initialPct: 0, finalPct: 0.02 });
    expect(table[2]).toEqual({ floor: 200, ceiling: 250, initialPct: 0.02, finalPct: 0.04 });
    expect(table[3]).toEqual({ floor: 250, ceiling: 300, initialPct: 0.04, finalPct: 0.06 });
    expect(table[4]).toEqual({ floor: 300, ceiling: 400, initialPct: 0.06, finalPct: 0.085 });
    expect(table[5]).toEqual({ floor: 400, ceiling: Infinity, initialPct: 0.085, finalPct: 0.085 });
  });

  it('PTC minimum FPL percentage is 100%', () => {
    expect(PREMIUM_TAX_CREDIT.MIN_FPL_PERCENTAGE).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NON-REV-PROC CONSTANTS: Schedule H — Household Employee Tax (SSA)
// ═══════════════════════════════════════════════════════════════════════════════

describe('SSA / IRC — Schedule H Household Employee Tax', () => {
  it('Schedule H thresholds match SSA 2025 and IRC', () => {
    expect(SCHEDULE_H.CASH_WAGE_THRESHOLD).toBe(2800);
    expect(SCHEDULE_H.FUTA_WAGE_THRESHOLD).toBe(1000);
    expect(SCHEDULE_H.SS_RATE).toBe(0.124);           // Combined employer+employee SS (6.2% × 2)
    expect(SCHEDULE_H.MEDICARE_RATE).toBe(0.029);      // Combined employer+employee Medicare (1.45% × 2)
    expect(SCHEDULE_H.FUTA_RATE).toBe(0.006);
    expect(SCHEDULE_H.FUTA_WAGE_BASE).toBe(7000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NON-REV-PROC CONSTANTS: OBBBA — Schedule 1-A (Statutory)
// ═══════════════════════════════════════════════════════════════════════════════

describe('OBBBA — Schedule 1-A Statutory Constants', () => {
  it('No Tax on Tips per OBBBA §101', () => {
    expect(SCHEDULE_1A.TIPS_CAP).toBe(25000);
    expect(SCHEDULE_1A.TIPS_PHASE_OUT_SINGLE).toBe(150000);
    expect(SCHEDULE_1A.TIPS_PHASE_OUT_MFJ).toBe(300000);
    expect(SCHEDULE_1A.TIPS_PHASE_OUT_RATE).toBe(100);
    expect(SCHEDULE_1A.TIPS_PHASE_OUT_STEP).toBe(1000);
  });

  it('No Tax on Overtime per OBBBA §102', () => {
    expect(SCHEDULE_1A.OVERTIME_CAP_SINGLE).toBe(12500);
    expect(SCHEDULE_1A.OVERTIME_CAP_MFJ).toBe(25000);
    expect(SCHEDULE_1A.OVERTIME_PHASE_OUT_SINGLE).toBe(150000);
    expect(SCHEDULE_1A.OVERTIME_PHASE_OUT_MFJ).toBe(300000);
    expect(SCHEDULE_1A.OVERTIME_PHASE_OUT_RATE).toBe(100);
    expect(SCHEDULE_1A.OVERTIME_PHASE_OUT_STEP).toBe(1000);
  });

  it('Car Loan Interest per OBBBA §103', () => {
    expect(SCHEDULE_1A.CAR_LOAN_CAP).toBe(10000);
    expect(SCHEDULE_1A.CAR_LOAN_PHASE_OUT_SINGLE).toBe(100000);
    expect(SCHEDULE_1A.CAR_LOAN_PHASE_OUT_MFJ).toBe(200000);
    expect(SCHEDULE_1A.CAR_LOAN_PHASE_OUT_RATE).toBe(200);
    expect(SCHEDULE_1A.CAR_LOAN_PHASE_OUT_STEP).toBe(1000);
  });

  it('Enhanced Senior Deduction per OBBBA §104', () => {
    expect(SCHEDULE_1A.SENIOR_AMOUNT).toBe(6000);
    expect(SCHEDULE_1A.SENIOR_PHASE_OUT_SINGLE).toBe(75000);
    expect(SCHEDULE_1A.SENIOR_PHASE_OUT_MFJ).toBe(150000);
    expect(SCHEDULE_1A.SENIOR_PHASE_OUT_RATE).toBe(0.06);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATUTORY (NON-INDEXED) CONSTANTS — IRC Section References
//
// These constants are set by statute, not inflation-adjusted.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Statutory (non-indexed) constants — IRC references', () => {
  it('NIIT per IRC §1411 (not inflation-adjusted)', () => {
    expect(NIIT.RATE).toBe(0.038);
    expect(NIIT.THRESHOLD_SINGLE).toBe(200000);
    expect(NIIT.THRESHOLD_MFJ).toBe(250000);
    expect(NIIT.THRESHOLD_MFS).toBe(125000);
    expect(NIIT.THRESHOLD_HOH).toBe(200000);
    expect(NIIT.THRESHOLD_QSS).toBe(250000);
  });

  it('Early distribution penalty per IRC §72(t)', () => {
    expect(EARLY_DISTRIBUTION.PENALTY_RATE).toBe(0.10);
    expect(EARLY_DISTRIBUTION.PENALTY_CODES).toEqual(['1']);
    expect(EARLY_DISTRIBUTION.EXCEPTION_CODES).toEqual(['2']);
    expect(EARLY_DISTRIBUTION.EXEMPT_CODES).toEqual(['3', '4', '7', 'G', 'T']);
  });

  it('ACTC per IRC §24(d)', () => {
    expect(ACTC.EARNED_INCOME_THRESHOLD).toBe(2500);
    expect(ACTC.EARNED_INCOME_RATE).toBe(0.15);
  });

  it('Dependent care per IRC §21 (not inflation-adjusted)', () => {
    expect(DEPENDENT_CARE.EXPENSE_LIMIT_ONE).toBe(3000);
    expect(DEPENDENT_CARE.EXPENSE_LIMIT_TWO_PLUS).toBe(6000);
    expect(DEPENDENT_CARE.MAX_RATE).toBe(0.35);
    expect(DEPENDENT_CARE.MIN_RATE).toBe(0.20);
    expect(DEPENDENT_CARE.RATE_PHASE_OUT_START).toBe(15000);
    expect(DEPENDENT_CARE.RATE_STEP_SIZE).toBe(2000);
    expect(DEPENDENT_CARE.RATE_STEP).toBe(0.01);
  });

  it('Clean energy per IRC §25D', () => {
    expect(CLEAN_ENERGY.RATE).toBe(0.30);
    expect(CLEAN_ENERGY.FUEL_CELL_CAP_PER_HALF_KW).toBe(500);
  });

  it('HSA distributions per IRC §223(f)', () => {
    expect(HSA_DISTRIBUTIONS.PENALTY_RATE).toBe(0.20);
  });

  it('Schedule D capital loss limits per IRC §1211(b)', () => {
    expect(SCHEDULE_D.CAPITAL_LOSS_LIMIT).toBe(3000);
    expect(SCHEDULE_D.CAPITAL_LOSS_LIMIT_MFS).toBe(1500);
  });

  it('Social Security thresholds per IRC §86 (not inflation-adjusted since 1984/1993)', () => {
    expect(SOCIAL_SECURITY.SINGLE_BASE_AMOUNT).toBe(25000);
    expect(SOCIAL_SECURITY.SINGLE_ADJUSTED_BASE).toBe(34000);
    expect(SOCIAL_SECURITY.MFJ_BASE_AMOUNT).toBe(32000);
    expect(SOCIAL_SECURITY.MFJ_ADJUSTED_BASE).toBe(44000);
    expect(SOCIAL_SECURITY.MFS_BASE_AMOUNT).toBe(0);
    expect(SOCIAL_SECURITY.RATE_50).toBe(0.50);
    expect(SOCIAL_SECURITY.RATE_85).toBe(0.85);
  });

  it('Schedule E passive activity per IRC §469 (not inflation-adjusted)', () => {
    expect(SCHEDULE_E.PASSIVE_LOSS_ALLOWANCE).toBe(25000);
    expect(SCHEDULE_E.PHASE_OUT_START).toBe(100000);
    expect(SCHEDULE_E.PHASE_OUT_RANGE).toBe(50000);
  });

  it('EV credit per IRC §30D, §25E', () => {
    expect(EV_CREDIT.NEW_VEHICLE_MAX).toBe(7500);
    expect(EV_CREDIT.NEW_CRITICAL_MINERAL).toBe(3750);
    expect(EV_CREDIT.NEW_BATTERY_COMPONENT).toBe(3750);
    expect(EV_CREDIT.NEW_MSRP_CAP_VAN_SUV_TRUCK).toBe(80000);
    expect(EV_CREDIT.NEW_MSRP_CAP_OTHER).toBe(55000);
    expect(EV_CREDIT.NEW_INCOME_LIMIT_MFJ).toBe(300000);
    expect(EV_CREDIT.NEW_INCOME_LIMIT_HOH).toBe(225000);
    expect(EV_CREDIT.NEW_INCOME_LIMIT_SINGLE).toBe(150000);
    expect(EV_CREDIT.USED_VEHICLE_MAX).toBe(4000);
    expect(EV_CREDIT.USED_PRICE_CAP).toBe(25000);
    expect(EV_CREDIT.USED_INCOME_LIMIT_MFJ).toBe(150000);
    expect(EV_CREDIT.USED_INCOME_LIMIT_HOH).toBe(112500);
    expect(EV_CREDIT.USED_INCOME_LIMIT_SINGLE).toBe(75000);
  });

  it('Energy efficiency per IRC §25C', () => {
    expect(ENERGY_EFFICIENCY.RATE).toBe(0.30);
    expect(ENERGY_EFFICIENCY.AGGREGATE_ANNUAL_LIMIT).toBe(3200);
    expect(ENERGY_EFFICIENCY.HEAT_PUMP_ANNUAL_LIMIT).toBe(2000);
    expect(ENERGY_EFFICIENCY.NON_HP_ANNUAL_LIMIT).toBe(1200);
    expect(ENERGY_EFFICIENCY.WINDOWS_LIMIT).toBe(600);
    expect(ENERGY_EFFICIENCY.DOORS_LIMIT).toBe(500);
    expect(ENERGY_EFFICIENCY.ELECTRICAL_PANEL_LIMIT).toBe(600);
    expect(ENERGY_EFFICIENCY.HOME_ENERGY_AUDIT_LIMIT).toBe(150);
  });

  it('Foreign tax credit per IRC §904(j)', () => {
    expect(FOREIGN_TAX_CREDIT.SIMPLIFIED_ELECTION_LIMIT).toBe(300);
    expect(FOREIGN_TAX_CREDIT.SIMPLIFIED_ELECTION_LIMIT_MFJ).toBe(600);
  });

  it('Alimony TCJA cutoff per TCJA §11051', () => {
    expect(ALIMONY.TCJA_CUTOFF_DATE).toBe('2019-01-01');
  });

  it('Estimated tax penalty per IRC §6654', () => {
    expect(ESTIMATED_TAX_PENALTY.RATE).toBe(0.07);
    expect(ESTIMATED_TAX_PENALTY.REQUIRED_ANNUAL_PAYMENT_RATE).toBe(0.90);
    expect(ESTIMATED_TAX_PENALTY.PRIOR_YEAR_SAFE_HARBOR).toBe(1.00);
    expect(ESTIMATED_TAX_PENALTY.PRIOR_YEAR_SAFE_HARBOR_HIGH_INCOME).toBe(1.10);
    expect(ESTIMATED_TAX_PENALTY.HIGH_INCOME_THRESHOLD).toBe(150000);
    expect(ESTIMATED_TAX_PENALTY.MINIMUM_PENALTY_THRESHOLD).toBe(1000);
  });

  it('Estimated tax safe harbor per IRC §6654(d)', () => {
    expect(ESTIMATED_TAX.QUARTERLY_DIVISOR).toBe(4);
    expect(ESTIMATED_TAX.SAFE_HARBOR_RATE).toBe(1.0);
    expect(ESTIMATED_TAX.HIGH_INCOME_SAFE_HARBOR).toBe(1.10);
    expect(ESTIMATED_TAX.HIGH_INCOME_THRESHOLD).toBe(150000);
  });

  it('NOL per IRC §172 (TCJA rules)', () => {
    expect(NOL.DEDUCTION_LIMIT_RATE).toBe(0.80);
  });

  it('Dependent care FSA per IRC §129', () => {
    expect(DEPENDENT_CARE_FSA.MAX_EXCLUSION).toBe(5000);
    expect(DEPENDENT_CARE_FSA.MAX_EXCLUSION_MFS).toBe(2500);
  });

  it('Home sale exclusion per IRC §121', () => {
    expect(HOME_SALE_EXCLUSION.SINGLE_MAX).toBe(250000);
    expect(HOME_SALE_EXCLUSION.MFJ_MAX).toBe(500000);
    expect(HOME_SALE_EXCLUSION.OWNERSHIP_MONTHS_REQUIRED).toBe(24);
    expect(HOME_SALE_EXCLUSION.RESIDENCE_MONTHS_REQUIRED).toBe(24);
  });

  it('Charitable AGI limits per IRC §170(b)', () => {
    expect(CHARITABLE_AGI_LIMITS.CASH_PUBLIC_RATE).toBe(0.60);
    expect(CHARITABLE_AGI_LIMITS.NON_CASH_RATE).toBe(0.30);
  });

  it('Cancellation of debt per IRC §6050P', () => {
    expect(CANCELLATION_OF_DEBT.MIN_REPORTING_AMOUNT).toBe(600);
  });

  it('Excess contribution penalty per IRC §4973', () => {
    expect(EXCESS_CONTRIBUTION.PENALTY_RATE).toBe(0.06);
  });

  it('529 distribution penalty per IRC §529(c)(6)', () => {
    expect(DISTRIBUTION_529.PENALTY_RATE).toBe(0.10);
  });

  it('QOZ per IRC §1400Z-2', () => {
    expect(QOZ.DEFERRAL_PERIOD_5_YEAR_STEP_UP).toBe(0.10);
    expect(QOZ.DEFERRAL_PERIOD_7_YEAR_STEP_UP).toBe(0.15);
  });

  it('SALT cap per TCJA §11042', () => {
    expect(SCHEDULE_A.SALT_CAP).toBe(40000);
    expect(SCHEDULE_A.SALT_CAP_MFS).toBe(20000);
    expect(SCHEDULE_A.MEDICAL_AGI_THRESHOLD).toBe(0.075);
    expect(SCHEDULE_A.MORTGAGE_LIMIT).toBe(750000);
    expect(SCHEDULE_A.MORTGAGE_LIMIT_MFS).toBe(375000);
  });

  it('Home office per Rev. Proc. 2013-13', () => {
    expect(HOME_OFFICE.SIMPLIFIED_RATE).toBe(5);
    expect(HOME_OFFICE.SIMPLIFIED_MAX_SQFT).toBe(300);
    expect(HOME_OFFICE.SIMPLIFIED_MAX_DEDUCTION).toBe(1500);
    // Verify computation
    expect(HOME_OFFICE.SIMPLIFIED_RATE * HOME_OFFICE.SIMPLIFIED_MAX_SQFT).toBe(HOME_OFFICE.SIMPLIFIED_MAX_DEDUCTION);
  });

  it('Vehicle mileage per IRS Notice 2024-79', () => {
    expect(VEHICLE.STANDARD_MILEAGE_RATE).toBe(0.70);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-VALIDATION: Internal consistency checks
//
// Verify that related constants are mathematically consistent with each other.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cross-validation — Internal Consistency', () => {
  it('SE tax rate = SS rate + Medicare rate', () => {
    expect(SE_TAX.SS_RATE + SE_TAX.MEDICARE_RATE).toBeCloseTo(SE_TAX.RATE, 3);
  });

  it('MFS bracket boundaries are half of MFJ for 10%-24% brackets', () => {
    const mfj = TAX_BRACKETS_2025[FilingStatus.MarriedFilingJointly];
    const mfs = TAX_BRACKETS_2025[FilingStatus.MarriedFilingSeparately];

    // 10% bracket: MFS max should be half of MFJ max
    expect(mfs[0].max).toBe(mfj[0].max / 2);
    // 12% bracket
    expect(mfs[1].max).toBe(mfj[1].max / 2);
    // 22% bracket
    expect(mfs[2].max).toBe(mfj[2].max / 2);
    // 24% bracket
    expect(mfs[3].max).toBe(mfj[3].max / 2);
  });

  it('QSS standard deduction equals MFJ standard deduction', () => {
    expect(STANDARD_DEDUCTION_2025[FilingStatus.QualifyingSurvivingSpouse])
      .toBe(STANDARD_DEDUCTION_2025[FilingStatus.MarriedFilingJointly]);
  });

  it('MFS standard deduction equals Single standard deduction', () => {
    expect(STANDARD_DEDUCTION_2025[FilingStatus.MarriedFilingSeparately])
      .toBe(STANDARD_DEDUCTION_2025[FilingStatus.Single]);
  });

  it('MFJ standard deduction is 2× Single standard deduction', () => {
    expect(STANDARD_DEDUCTION_2025[FilingStatus.MarriedFilingJointly])
      .toBe(STANDARD_DEDUCTION_2025[FilingStatus.Single] * 2);
  });

  it('QBI MFJ threshold is 2× Single threshold', () => {
    expect(QBI.THRESHOLD_MFJ).toBe(QBI.THRESHOLD_SINGLE * 2);
  });

  it('CG 0% MFJ threshold is 2× Single threshold', () => {
    expect(CAPITAL_GAINS_RATES.THRESHOLD_0[FilingStatus.MarriedFilingJointly])
      .toBe(CAPITAL_GAINS_RATES.THRESHOLD_0[FilingStatus.Single] * 2);
  });

  it('MFS capital loss limit is half of Single/MFJ limit', () => {
    expect(SCHEDULE_D.CAPITAL_LOSS_LIMIT_MFS).toBe(SCHEDULE_D.CAPITAL_LOSS_LIMIT / 2);
  });

  it('NIIT MFS threshold is half of MFJ threshold', () => {
    expect(NIIT.THRESHOLD_MFS).toBe(NIIT.THRESHOLD_MFJ / 2);
  });

  it('Kiddie tax threshold is 2× the per-tier amount', () => {
    expect(KIDDIE_TAX.UNEARNED_INCOME_THRESHOLD).toBe(KIDDIE_TAX.STANDARD_DEDUCTION_UNEARNED * 2);
  });

  it('Home office max deduction = rate × max sqft', () => {
    expect(HOME_OFFICE.SIMPLIFIED_MAX_DEDUCTION).toBe(HOME_OFFICE.SIMPLIFIED_RATE * HOME_OFFICE.SIMPLIFIED_MAX_SQFT);
  });

  it('Excess SS max tax = rate × wage base', () => {
    expect(EXCESS_SS_TAX.MAX_SS_TAX).toBeCloseTo(EXCESS_SS_TAX.SS_TAX_RATE * EXCESS_SS_TAX.SS_WAGE_BASE, 2);
  });

  it('SE wage base equals Excess SS wage base', () => {
    expect(SE_TAX.SS_WAGE_BASE).toBe(EXCESS_SS_TAX.SS_WAGE_BASE);
  });

  it('OBBBA tips MFJ phase-out is 2× Single', () => {
    expect(SCHEDULE_1A.TIPS_PHASE_OUT_MFJ).toBe(SCHEDULE_1A.TIPS_PHASE_OUT_SINGLE * 2);
  });

  it('OBBBA overtime MFJ cap is 2× Single cap', () => {
    expect(SCHEDULE_1A.OVERTIME_CAP_MFJ).toBe(SCHEDULE_1A.OVERTIME_CAP_SINGLE * 2);
  });

  it('OBBBA car loan MFJ phase-out is 2× Single', () => {
    expect(SCHEDULE_1A.CAR_LOAN_PHASE_OUT_MFJ).toBe(SCHEDULE_1A.CAR_LOAN_PHASE_OUT_SINGLE * 2);
  });

  it('OBBBA senior MFJ phase-out is 2× Single', () => {
    expect(SCHEDULE_1A.SENIOR_PHASE_OUT_MFJ).toBe(SCHEDULE_1A.SENIOR_PHASE_OUT_SINGLE * 2);
  });
});
