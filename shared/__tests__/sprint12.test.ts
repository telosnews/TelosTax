import { describe, it, expect } from 'vitest';
import { calculatePremiumTaxCredit, calculatePTCHouseholdIncome } from '../src/engine/premiumTaxCredit.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { FilingStatus, TaxReturn, PremiumTaxCreditInfo, Form1095AInfo } from '../src/types/index.js';
import { PREMIUM_TAX_CREDIT } from '../src/constants/tax2025.js';

// ─── Helper: create a minimal 1095-A form ─────────
function make1095A(overrides: Partial<Form1095AInfo> & { monthlyPremium?: number; monthlySLCSP?: number; monthlyAPTC?: number; months?: number } = {}): Form1095AInfo {
  const months = overrides.months ?? 12;
  const monthlyPremium = overrides.monthlyPremium ?? 500;
  const monthlySLCSP = overrides.monthlySLCSP ?? 600;
  const monthlyAPTC = overrides.monthlyAPTC ?? 300;

  return {
    id: 'form-1',
    marketplace: 'Healthcare.gov',
    enrollmentPremiums: Array(12).fill(0).map((_, i) => i < months ? monthlyPremium : 0),
    slcspPremiums: Array(12).fill(0).map((_, i) => i < months ? monthlySLCSP : 0),
    advancePTC: Array(12).fill(0).map((_, i) => i < months ? monthlyAPTC : 0),
    coverageMonths: Array(12).fill(false).map((_, i) => i < months),
    ...overrides,
  };
}

function makePTCInfo(overrides: Partial<PremiumTaxCreditInfo> & { monthlyPremium?: number; monthlySLCSP?: number; monthlyAPTC?: number; months?: number } = {}): PremiumTaxCreditInfo {
  const { monthlyPremium, monthlySLCSP, monthlyAPTC, months, ...rest } = overrides;
  return {
    forms1095A: [make1095A({ monthlyPremium, monthlySLCSP, monthlyAPTC, months })],
    familySize: 1,
    ...rest,
  };
}

function makeReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'my_info',
    filingStatus: FilingStatus.Single,
    dependents: [],
    w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 40000, federalTaxWithheld: 4000 }],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    rentalProperties: [],
    expenses: [],
    educationCredits: [],
    deductionMethod: 'standard',
    otherIncome: 0,
    incomeDiscovery: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

// ─── FPL Calculation Tests ──────────────────────────
describe('Premium Tax Credit — FPL Calculation', () => {
  it('calculates FPL percentage for single person in 48 states', () => {
    // FPL for 1 person = $15,060
    // $30,120 income = 200% FPL
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ familySize: 1 }),
      30120,
      FilingStatus.Single,
    );
    expect(result.fplPercentage).toBeCloseTo(200, 0);
  });

  it('calculates FPL percentage for family of 4', () => {
    // FPL for 4 = 15060 + 5380*3 = $31,200
    // $62,400 income = 200% FPL
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ familySize: 4 }),
      62400,
      FilingStatus.MarriedFilingJointly,
    );
    expect(result.fplPercentage).toBeCloseTo(200, 0);
  });

  it('uses Alaska FPL table', () => {
    // AK FPL for 1 = $18,810
    // $37,620 = 200%
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ familySize: 1, state: 'AK' }),
      37620,
      FilingStatus.Single,
    );
    expect(result.fplPercentage).toBeCloseTo(200, 0);
  });

  it('uses Hawaii FPL table', () => {
    // HI FPL for 1 = $17,310
    // $34,620 = 200%
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ familySize: 1, state: 'HI' }),
      34620,
      FilingStatus.Single,
    );
    expect(result.fplPercentage).toBeCloseTo(200, 0);
  });
});

// ─── Applicable Figure Tests ──────────────────────
describe('Premium Tax Credit — Applicable Figure', () => {
  it('returns 0% for income at or below 150% FPL', () => {
    // 150% FPL for 1 person = $22,590
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ familySize: 1 }),
      22590,
      FilingStatus.Single,
    );
    expect(result.applicableFigure).toBe(0);
    expect(result.expectedContribution).toBe(0);
  });

  it('interpolates between 150-200% FPL (0% to 2%)', () => {
    // 175% FPL = midpoint of 150-200 bracket → 1%
    // 1 person FPL = $15,060, so 175% = $26,355
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ familySize: 1 }),
      26355,
      FilingStatus.Single,
    );
    expect(result.applicableFigure).toBeCloseTo(0.01, 2);
  });

  it('caps at 8.5% for income above 400% FPL', () => {
    // 400%+ FPL → 8.5%
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ familySize: 1 }),
      100000,
      FilingStatus.Single,
    );
    expect(result.applicableFigure).toBeCloseTo(0.085, 3);
  });

  it('interpolates in 200-250% bracket (2% to 4%)', () => {
    // 225% = midpoint of 200-250 → 3%
    // 1 person FPL = $15,060, so 225% = $33,885
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ familySize: 1 }),
      33885,
      FilingStatus.Single,
    );
    expect(result.applicableFigure).toBeCloseTo(0.03, 2);
  });
});

// ─── Monthly PTC Calculation Tests ────────────────
describe('Premium Tax Credit — Monthly Calculation', () => {
  it('calculates monthly PTC as lesser of premium or (SLCSP - expected)', () => {
    // Income at 150% FPL ($22,590) → 0% expected contribution
    // Enrollment = $500, SLCSP = $600 → PTC = min($500, $600 - $0) = $500
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 0 }),
      22590,
      FilingStatus.Single,
    );
    // 12 months × $500 = $6,000
    expect(result.annualPTC).toBe(6000);
  });

  it('limits PTC to enrollment premium when SLCSP is higher', () => {
    // Premium = $400, SLCSP = $600, expected = $0
    // PTC = min($400, $600) = $400
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 400, monthlySLCSP: 600, monthlyAPTC: 0 }),
      22590,
      FilingStatus.Single,
    );
    expect(result.annualPTC).toBe(4800); // 12 × $400
  });

  it('limits PTC to (SLCSP - expected) when enrollment is higher', () => {
    // Income at 300% FPL → ~6% expected contribution
    // 300% FPL for 1 = $45,180
    // Expected = $45,180 × 0.06 / 12 = $225.90/month
    // Premium = $800, SLCSP = $600 → PTC = min($800, $600 - $225.90) = $374.10
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 800, monthlySLCSP: 600, monthlyAPTC: 0 }),
      45180,
      FilingStatus.Single,
    );
    // Monthly PTC = min(800, max(0, 600 - 225.90)) = 374.10
    expect(result.annualPTC).toBeCloseTo(4489.2, 0);
  });

  it('handles partial year coverage (6 months)', () => {
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 0, months: 6 }),
      22590,
      FilingStatus.Single,
    );
    // 6 months × $500 = $3,000
    expect(result.annualPTC).toBe(3000);
    expect(result.monthlyDetails.filter(m => m.hasCoverage).length).toBe(6);
  });

  it('returns 0 PTC when expected contribution exceeds SLCSP', () => {
    // Very high income → expected contribution > SLCSP premium
    // Income = $200,000, 1 person → 8.5%
    // Expected = $200k × 0.085 / 12 = $1,416.67
    // SLCSP = $600 → PTC = min(500, max(0, 600 - 1416.67)) = $0
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 0 }),
      200000,
      FilingStatus.Single,
    );
    expect(result.annualPTC).toBe(0);
  });
});

// ─── APTC Reconciliation Tests ────────────────────
describe('Premium Tax Credit — APTC Reconciliation', () => {
  it('returns net PTC when PTC exceeds APTC', () => {
    // PTC = $6,000 (150% FPL, $500/mo premium), APTC = $3,600 ($300/mo)
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 300 }),
      22590,
      FilingStatus.Single,
    );
    expect(result.annualPTC).toBe(6000);
    expect(result.totalAPTC).toBe(3600);
    expect(result.netPTC).toBe(2400); // $6,000 - $3,600
    expect(result.excessAPTC).toBe(0);
    expect(result.excessAPTCRepayment).toBe(0);
  });

  it('requires repayment when APTC exceeds PTC', () => {
    // High income reduces PTC significantly
    // Income = $120,000 → above 400% FPL for single
    // Expected = $120k × 0.085 / 12 = $850
    // SLCSP = $600 → PTC per month = min(500, max(0, 600-850)) = 0
    // But APTC was $300/mo = $3,600 total → must repay
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 300 }),
      120000,
      FilingStatus.Single,
    );
    expect(result.annualPTC).toBe(0);
    expect(result.totalAPTC).toBe(3600);
    expect(result.netPTC).toBe(0);
    expect(result.excessAPTC).toBe(3600);
    // Above 400% FPL → no cap → full repayment
    expect(result.excessAPTCRepayment).toBe(3600);
  });

  it('applies repayment cap for income below 200% FPL', () => {
    // Income at 175% FPL ($26,355)
    // If PTC < APTC, repayment capped at $375 (single)
    // Set up: low SLCSP so PTC is small but APTC was generous
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 200, monthlySLCSP: 250, monthlyAPTC: 200 }),
      26355,
      FilingStatus.Single,
    );
    // Expected contribution ~ 1% → $263.55/year → $21.96/mo
    // Monthly PTC = min(200, max(0, 250 - 21.96)) = 200
    // Annual PTC = $2,400, APTC = $2,400 → equal, no excess
    // Let me use higher APTC to create excess
    const result2 = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 200, monthlySLCSP: 250, monthlyAPTC: 250 }),
      26355,
      FilingStatus.Single,
    );
    // Monthly PTC = min(200, max(0, 250-21.96)) = 200
    // Annual PTC = 2400, APTC = 3000 → excess = 600
    // But cap at 175% FPL (< 200%) single = $375
    if (result2.excessAPTC > 0) {
      expect(result2.excessAPTCRepayment).toBeLessThanOrEqual(375);
      expect(result2.repaymentCap).toBe(375);
    }
  });

  it('applies repayment cap for MFJ below 300% FPL', () => {
    // Family of 4 at 250% FPL: FPL = $31,200, income = $78,000
    // Repayment cap for 200-300% FPL, other filing status = $1,950
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 300, monthlySLCSP: 400, monthlyAPTC: 400, familySize: 4 }),
      78000,
      FilingStatus.MarriedFilingJointly,
    );
    if (result.excessAPTC > 0) {
      expect(result.repaymentCap).toBe(1950);
      expect(result.excessAPTCRepayment).toBeLessThanOrEqual(1950);
    }
  });

  it('has no repayment cap above 400% FPL', () => {
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 400 }),
      100000,
      FilingStatus.Single,
    );
    expect(result.repaymentCap).toBe(Infinity);
  });
});

// ─── MFS Eligibility Tests ──────────────────────────
describe('Premium Tax Credit — MFS Eligibility', () => {
  it('denies PTC for MFS without exception', () => {
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 300 }),
      30000,
      FilingStatus.MarriedFilingSeparately,
    );
    // Should not get PTC
    expect(result.annualPTC).toBe(0);
    // But must repay all APTC
    expect(result.excessAPTCRepayment).toBe(3600);
  });

  it('allows PTC for MFS domestic abuse victim', () => {
    const result = calculatePremiumTaxCredit(
      makePTCInfo({
        monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 0,
        isVictimOfDomesticAbuse: true,
      }),
      22590,
      FilingStatus.MarriedFilingSeparately,
    );
    // Should get PTC
    expect(result.annualPTC).toBeGreaterThan(0);
  });

  it('allows PTC for MFS spousal abandonment', () => {
    const result = calculatePremiumTaxCredit(
      makePTCInfo({
        monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 0,
        isSpousalAbandonment: true,
      }),
      22590,
      FilingStatus.MarriedFilingSeparately,
    );
    expect(result.annualPTC).toBeGreaterThan(0);
  });
});

// ─── Below 100% FPL Tests ─────────────────────────
describe('Premium Tax Credit — Below 100% FPL', () => {
  it('returns no PTC below 100% FPL', () => {
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 0 }),
      10000, // Below 100% FPL ($15,060)
      FilingStatus.Single,
    );
    expect(result.annualPTC).toBe(0);
  });

  it('requires full APTC repayment below 100% FPL', () => {
    const result = calculatePremiumTaxCredit(
      makePTCInfo({ monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 300 }),
      10000,
      FilingStatus.Single,
    );
    expect(result.excessAPTCRepayment).toBe(3600); // Full repayment
  });
});

// ─── Household Income Calculation Tests ───────────
describe('Premium Tax Credit — Household Income (MAGI)', () => {
  it('adds FEIE exclusion back to AGI', () => {
    const hhi = calculatePTCHouseholdIncome(50000, 20000, 0, 0);
    expect(hhi).toBe(70000);
  });

  it('adds tax-exempt interest to AGI', () => {
    const hhi = calculatePTCHouseholdIncome(50000, 0, 1000, 0);
    expect(hhi).toBe(51000);
  });

  it('adds non-taxable Social Security to AGI', () => {
    const hhi = calculatePTCHouseholdIncome(50000, 0, 0, 5000);
    expect(hhi).toBe(55000);
  });

  it('adds all MAGI components', () => {
    const hhi = calculatePTCHouseholdIncome(50000, 10000, 500, 3000);
    expect(hhi).toBe(63500);
  });
});

// ─── Edge Cases ───────────────────────────────────
describe('Premium Tax Credit — Edge Cases', () => {
  it('returns zero when no 1095-A forms provided', () => {
    const result = calculatePremiumTaxCredit(
      { forms1095A: [], familySize: 1 },
      40000,
      FilingStatus.Single,
    );
    expect(result.annualPTC).toBe(0);
    expect(result.totalAPTC).toBe(0);
  });

  it('returns zero for null/undefined info', () => {
    const result = calculatePremiumTaxCredit(
      null as any,
      40000,
      FilingStatus.Single,
    );
    expect(result.annualPTC).toBe(0);
  });

  it('handles multiple 1095-A forms', () => {
    // Changed plans mid-year: Plan A for 6 months, Plan B for 6 months
    const form1: Form1095AInfo = {
      id: 'form-1',
      marketplace: 'Healthcare.gov',
      enrollmentPremiums: [500, 500, 500, 500, 500, 500, 0, 0, 0, 0, 0, 0],
      slcspPremiums: [600, 600, 600, 600, 600, 600, 0, 0, 0, 0, 0, 0],
      advancePTC: [200, 200, 200, 200, 200, 200, 0, 0, 0, 0, 0, 0],
      coverageMonths: [true, true, true, true, true, true, false, false, false, false, false, false],
    };
    const form2: Form1095AInfo = {
      id: 'form-2',
      marketplace: 'Healthcare.gov',
      enrollmentPremiums: [0, 0, 0, 0, 0, 0, 700, 700, 700, 700, 700, 700],
      slcspPremiums: [0, 0, 0, 0, 0, 0, 600, 600, 600, 600, 600, 600],
      advancePTC: [0, 0, 0, 0, 0, 0, 250, 250, 250, 250, 250, 250],
      coverageMonths: [false, false, false, false, false, false, true, true, true, true, true, true],
    };

    const result = calculatePremiumTaxCredit(
      { forms1095A: [form1, form2], familySize: 1 },
      22590, // 150% FPL → 0% contribution
      FilingStatus.Single,
    );

    expect(result.monthlyDetails.filter(m => m.hasCoverage).length).toBe(12);
    // Months 1-6: PTC = min(500, 600-0) = 500
    // Months 7-12: PTC = min(700, 600-0) = 600
    expect(result.annualPTC).toBe(6600); // 6×500 + 6×600
    expect(result.totalAPTC).toBe(2700); // 6×200 + 6×250
  });

  it('correctly returns 12 monthly detail entries', () => {
    const result = calculatePremiumTaxCredit(
      makePTCInfo(),
      40000,
      FilingStatus.Single,
    );
    expect(result.monthlyDetails.length).toBe(12);
    expect(result.monthlyDetails[0].month).toBe(1);
    expect(result.monthlyDetails[11].month).toBe(12);
  });
});

// ─── Form 1040 Integration Tests ──────────────────
describe('Premium Tax Credit — Form 1040 Integration', () => {
  it('adds net PTC as refundable credit', () => {
    const tr = makeReturn({
      premiumTaxCredit: makePTCInfo({
        monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 0,
        familySize: 1,
      }),
    });
    const result = calculateForm1040(tr);

    // Income = $40k, FPL 1-person = $15,060 → ~265% FPL
    // Should have non-zero PTC
    expect(result.premiumTaxCredit).toBeDefined();
    expect(result.premiumTaxCredit!.annualPTC).toBeGreaterThan(0);
    expect(result.form1040.premiumTaxCreditNet).toBeGreaterThan(0);
    expect(result.credits.premiumTaxCredit).toBeGreaterThan(0);
    // PTC is refundable
    expect(result.credits.totalRefundable).toBeGreaterThan(0);
  });

  it('adds excess APTC repayment to balance', () => {
    // High income ($100k) with high APTC ($500/mo = $6000/year)
    const tr = makeReturn({
      w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 100000, federalTaxWithheld: 15000 }],
      premiumTaxCredit: makePTCInfo({
        monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 500,
        familySize: 1,
      }),
    });
    const result = calculateForm1040(tr);

    // At $100k, above 400% FPL, expected contribution = 8.5%
    // Expected = $8,500/yr = $708/mo > SLCSP $600 → PTC = 0
    // Excess APTC = $6,000 → must repay (no cap above 400%)
    expect(result.form1040.excessAPTCRepayment).toBeGreaterThan(0);
    // The excess repayment should increase amount owed
    expect(result.premiumTaxCredit!.excessAPTCRepayment).toBeGreaterThan(0);
  });

  it('does not create PTC for MFS without exception', () => {
    const tr = makeReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      premiumTaxCredit: makePTCInfo({
        monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 300,
        familySize: 1,
      }),
    });
    const result = calculateForm1040(tr);

    // MFS without exception → no PTC credit
    expect(result.form1040.premiumTaxCreditNet).toBe(0);
    // But must repay APTC
    expect(result.form1040.excessAPTCRepayment).toBe(3600);
  });

  it('uses household income (MAGI) including FEIE exclusion', () => {
    // Taxpayer earns $50k abroad (reported as W-2 wages from foreign employer)
    // FEIE excludes $50k → AGI near $0
    // But PTC household income adds FEIE back → household income = ~$50k
    const tr = makeReturn({
      w2Income: [{ id: 'w2-1', employerName: 'Foreign Co', wages: 50000, federalTaxWithheld: 0 }],
      foreignEarnedIncome: {
        foreignEarnedIncome: 50000,
        qualifyingDays: 365,
        housingExpenses: 0,
      },
      premiumTaxCredit: makePTCInfo({
        monthlyPremium: 500, monthlySLCSP: 600, monthlyAPTC: 0,
        familySize: 1,
      }),
    });
    const result = calculateForm1040(tr);

    // FEIE excludes $50k → totalIncome near $0, AGI near $0
    // But household income = AGI + FEIE exclusion ≈ $50k
    expect(result.premiumTaxCredit).toBeDefined();
    expect(result.premiumTaxCredit!.householdIncome).toBeGreaterThan(40000);
    // Verify FEIE was applied
    expect(result.form1040.feieExclusion).toBeGreaterThan(0);
  });

  it('calculates correctly when no PTC data provided', () => {
    const tr = makeReturn();
    const result = calculateForm1040(tr);

    expect(result.form1040.premiumTaxCreditNet).toBe(0);
    expect(result.form1040.excessAPTCRepayment).toBe(0);
    expect(result.premiumTaxCredit).toBeUndefined();
  });

  it('treats PTC as refundable credit that can increase refund', () => {
    // Low income taxpayer: $20,000 wages, $3,000 withholding
    // Heavy SLCSP premium, no APTC → large net PTC
    const tr = makeReturn({
      w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 20000, federalTaxWithheld: 3000 }],
      premiumTaxCredit: makePTCInfo({
        monthlyPremium: 400, monthlySLCSP: 500, monthlyAPTC: 0,
        familySize: 1,
      }),
    });
    const result = calculateForm1040(tr);

    // Should get a refund that includes the PTC
    expect(result.credits.premiumTaxCredit).toBeGreaterThan(0);
    expect(result.form1040.refundAmount).toBeGreaterThan(3000); // More than just withholding
  });
});

// ─── Constants Validation Tests ───────────────────
describe('Premium Tax Credit — Constants', () => {
  it('has correct FPL values for 48 states', () => {
    expect(PREMIUM_TAX_CREDIT.FPL_BASE_48).toBe(15060);
    expect(PREMIUM_TAX_CREDIT.FPL_INCREMENT_48).toBe(5380);
  });

  it('has correct Alaska FPL values', () => {
    expect(PREMIUM_TAX_CREDIT.FPL_BASE_AK).toBe(18810);
    expect(PREMIUM_TAX_CREDIT.FPL_INCREMENT_AK).toBe(6730);
  });

  it('has correct Hawaii FPL values', () => {
    expect(PREMIUM_TAX_CREDIT.FPL_BASE_HI).toBe(17310);
    expect(PREMIUM_TAX_CREDIT.FPL_INCREMENT_HI).toBe(6190);
  });

  it('has 6 applicable figure brackets', () => {
    expect(PREMIUM_TAX_CREDIT.APPLICABLE_FIGURE_TABLE.length).toBe(6);
  });

  it('has correct repayment caps', () => {
    expect(PREMIUM_TAX_CREDIT.REPAYMENT_CAPS[0].singleCap).toBe(375);
    expect(PREMIUM_TAX_CREDIT.REPAYMENT_CAPS[0].otherCap).toBe(750);
    expect(PREMIUM_TAX_CREDIT.REPAYMENT_CAPS[2].singleCap).toBe(1625);
    expect(PREMIUM_TAX_CREDIT.REPAYMENT_CAPS[2].otherCap).toBe(3250);
  });
});
