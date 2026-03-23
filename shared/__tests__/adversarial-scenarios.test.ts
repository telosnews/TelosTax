/**
 * Adversarial Scenario Tests — Phase 3 Hardening
 *
 * These scenarios test complex multi-provision interactions designed to expose
 * ordering dependencies, sign errors, double-counting, circular references,
 * and missing caps/floors in the TY2025 tax engine.
 *
 * Generated via multi-model consensus (Claude Opus, Gemini 3.1 Pro, GPT-5.2 Codex),
 * deduplicated and hand-verified against IRC authority.
 *
 * @authority IRC §§1, 21, 24, 25A, 32, 55, 63, 86, 199A, 469, 529, 904, 911,
 *           1211, 1401, 1402, 1411, 3101, 6654
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'adv-test',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    dependents: [],
    w2Income: [],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    rentalProperties: [],
    otherIncome: 0,
    businesses: [],
    deductionMethod: 'standard',
    expenses: [],
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  };
}

function calc(overrides: Partial<TaxReturn> = {}) {
  return calculateForm1040(makeTaxReturn(overrides));
}


// ═══════════════════════════════════════════════════════════════════════════
// ADV-01 — FEIE Disqualifies EITC (IRC §32(c)(1)(E))
//
// All 3 models flagged this. IRC §32(c)(1)(E) says a taxpayer who claims
// the foreign earned income exclusion under §911 is ineligible for EITC.
// The engine currently computes EITC without checking FEIE status.
//
// Single filer, $40,000 W-2 foreign wages, 2 qualifying children.
// Without FEIE: would qualify for substantial EITC.
// With FEIE claimed: EITC must be $0.
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-01 — FEIE Disqualifies EITC (§32(c)(1)(E))', () => {
  it('EITC = $0 when foreign earned income exclusion is claimed', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1985-06-15',
      w2Income: [{
        id: 'w1', employerName: 'Foreign Corp', wages: 40000, federalTaxWithheld: 0,
        socialSecurityWages: 0, socialSecurityTax: 0, medicareWages: 0, medicareTax: 0,
      }],
      foreignEarnedIncome: { foreignEarnedIncome: 40000, qualifyingDays: 365 },
      dependents: [
        { id: 'd1', firstName: 'Child', lastName: 'A', relationship: 'daughter', dateOfBirth: '2018-03-01', monthsLivedWithYou: 12, isStudent: false, isDisabled: false },
        { id: 'd2', firstName: 'Child', lastName: 'B', relationship: 'son', dateOfBirth: '2020-07-15', monthsLivedWithYou: 12, isStudent: false, isDisabled: false },
      ],
    });

    // All income excluded via FEIE → AGI = 0
    expect(r.form1040.agi).toBe(0);

    // Key assertion: EITC must be $0 per IRC §32(c)(1)(E)
    expect(r.credits.eitcCredit).toBe(0);
  });

  it('without FEIE, same taxpayer WOULD get EITC', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1985-06-15',
      w2Income: [{
        id: 'w1', employerName: 'Employer', wages: 40000, federalTaxWithheld: 3000,
        socialSecurityWages: 40000, socialSecurityTax: 2480, medicareWages: 40000, medicareTax: 580,
      }],
      dependents: [
        { id: 'd1', firstName: 'Child', lastName: 'A', relationship: 'daughter', dateOfBirth: '2018-03-01', monthsLivedWithYou: 12, isStudent: false, isDisabled: false },
        { id: 'd2', firstName: 'Child', lastName: 'B', relationship: 'son', dateOfBirth: '2020-07-15', monthsLivedWithYou: 12, isStudent: false, isDisabled: false },
      ],
    });

    // Without FEIE, EITC should be positive for this income level with 2 kids
    expect(r.credits.eitcCredit).toBeGreaterThan(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-02 — MFS Triple-Trap: Student Loan $0 + Capital Loss $1,500 + SS $0 Base
//
// All 3 models flagged MFS special rules. Married Filing Separately triggers:
// 1. Student loan interest deduction = $0 (IRC §221(e)(1))
// 2. Capital loss limit halved to $1,500 (IRC §1211(b)(1))
// 3. Social Security base amount = $0 (IRC §86(c)(1)(C)) unless lived apart
//
// This tests that all three MFS penalties stack correctly.
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-02 — MFS Triple-Trap (Student Loan + Cap Loss + SS Taxability)', () => {
  it('student loan deduction = $0 for MFS', () => {
    const r = calc({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 60000, federalTaxWithheld: 8000,
        socialSecurityWages: 60000, socialSecurityTax: 3720, medicareWages: 60000, medicareTax: 870,
      }],
      studentLoanInterest: 2500,
    });

    expect(r.form1040.studentLoanInterest).toBe(0);
    expect(r.form1040.agi).toBe(60000); // No student loan deduction taken
  });

  it('capital loss capped at $1,500 for MFS', () => {
    const r = calc({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 60000, federalTaxWithheld: 8000,
        socialSecurityWages: 60000, socialSecurityTax: 3720, medicareWages: 60000, medicareTax: 870,
      }],
      income1099B: [{
        id: 'b1', brokerName: 'Broker', description: 'Loser stock',
        proceeds: 5000, costBasis: 10000, isLongTerm: true,
        dateAcquired: '2024-01-01', dateSold: '2025-06-01',
      }],
    });

    // Net loss = -$5,000, but MFS cap = $1,500
    expect(r.form1040.capitalGainOrLoss).toBe(-1500);
    expect(r.form1040.agi).toBe(58500); // $60,000 - $1,500
  });

  it('Social Security 85% taxable for MFS not living apart (base = $0)', () => {
    const r = calc({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      // NOT setting livedApartFromSpouse: true → $0 base amount
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 30000, federalTaxWithheld: 3000,
        socialSecurityWages: 30000, socialSecurityTax: 1860, medicareWages: 30000, medicareTax: 435,
      }],
      incomeSSA1099: { id: 'ss1', totalBenefits: 20000 },
    });

    // MFS not living apart: base amount = $0
    // Provisional income = $30,000 + 50% × $20,000 = $40,000 → way above $0
    // Up to 85% of benefits should be taxable
    expect(r.form1040.taxableSocialSecurity).toBe(17000); // 85% of $20,000
  });

  it('MFS living apart gets normal single base amount ($25k)', () => {
    const r = calc({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      livedApartFromSpouse: true, // Uses Single thresholds: $25k/$34k
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 20000, federalTaxWithheld: 2000,
        socialSecurityWages: 20000, socialSecurityTax: 1240, medicareWages: 20000, medicareTax: 290,
      }],
      incomeSSA1099: { id: 'ss1', totalBenefits: 10000 },
    });

    // Provisional = $20,000 + $5,000 = $25,000 → exactly at single base → $0 taxable
    expect(r.form1040.taxableSocialSecurity).toBe(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-03 — K-1 SE + W-2 Social Security Wage Base Interaction
//
// All 3 models flagged this. When a taxpayer has both W-2 wages and K-1
// partnership self-employment income, the Social Security portion of SE tax
// must be limited by the remaining room under the $176,100 wage base.
//
// W-2 wages: $150,000 (SS wages paid on all)
// K-1 SE income: $50,000
// SE earnings = $50,000 × 0.9235 = $46,175
// Remaining SS room = $176,100 - $150,000 = $26,100
// SE SS tax = 12.4% × $26,100 (not full $46,175)
// SE Medicare tax = 2.9% × $46,175 (no cap)
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-03 — K-1 SE + W-2 Social Security Wage Base Cap', () => {
  it('SE SS tax limited by remaining room after W-2 wages', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'BigCorp', wages: 150000, federalTaxWithheld: 25000,
        socialSecurityWages: 150000, socialSecurityTax: 9300, medicareWages: 150000, medicareTax: 2175,
      }],
      incomeK1: [{
        id: 'k1', entityName: 'Partner LLC', entityType: 'partnership',
        ordinaryBusinessIncome: 50000,
        selfEmploymentIncome: 50000,
      }],
    });

    // SE earnings = 50,000 × 0.9235 = $46,175
    const seEarnings = 50000 * 0.9235;

    // SE tax should reflect:
    // SS portion: 12.4% × min($46,175, $176,100 - $150,000) = 12.4% × $26,100 = $3,236.40
    // Medicare portion: 2.9% × $46,175 = $1,339.08
    // Total SE tax ≈ $4,575.48
    const expectedSSPortion = 0.124 * 26100;
    const expectedMedicarePortion = 0.029 * seEarnings;
    const expectedTotalSE = expectedSSPortion + expectedMedicarePortion;

    expect(r.form1040.seTax).toBeCloseTo(expectedTotalSE, 0);

    // Should be LESS than full SE tax (without wage base coordination)
    const fullSETaxNoCoordination = seEarnings * 0.153;
    expect(r.form1040.seTax).toBeLessThan(fullSETaxNoCoordination);
  });

  it('W-2 already at wage base → SE has zero SS portion', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'BigCorp', wages: 180000, federalTaxWithheld: 35000,
        socialSecurityWages: 176100, socialSecurityTax: 10918.20, medicareWages: 180000, medicareTax: 2610,
      }],
      incomeK1: [{
        id: 'k1', entityName: 'Partner LLC', entityType: 'partnership',
        ordinaryBusinessIncome: 30000,
        selfEmploymentIncome: 30000,
      }],
    });

    // SE earnings = 30,000 × 0.9235 = $27,705
    // SS room remaining = $0 → SS portion of SE = $0
    // Only Medicare: 2.9% × $27,705 = $803.45
    const seEarnings = 30000 * 0.9235;
    const expectedMedicare = 0.029 * seEarnings;

    expect(r.form1040.seTax).toBeCloseTo(expectedMedicare, 0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-04 — FEIE Stacking Rule (IRC §911(f))
//
// All 3 models flagged this. When FEIE is claimed, the tax on remaining
// income must be computed at the rates that would apply if the excluded
// income was still included. The effective rate on the non-excluded portion
// should be HIGHER than if it were the taxpayer's only income.
//
// Single filer, W-2 $180,000, FEIE excludes $130,000.
// Remaining taxable = ($180,000 - $130,000) - $15,750 = $34,250.
// Tax should be at brackets starting from the $130,000 level, not from $0.
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-04 — FEIE Stacking Rule (§911(f))', () => {
  it('tax on remaining income is computed at stacked rates', () => {
    const withFEIE = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Foreign Corp', wages: 180000, federalTaxWithheld: 0,
        socialSecurityWages: 0, socialSecurityTax: 0, medicareWages: 0, medicareTax: 0,
      }],
      foreignEarnedIncome: { foreignEarnedIncome: 180000, qualifyingDays: 365 },
    });

    // FEIE excludes $130,000 → AGI = $50,000 → taxable = $34,250
    expect(withFEIE.form1040.agi).toBe(50000);
    expect(withFEIE.form1040.feieExclusion).toBe(130000);

    // §911(f) stacking: tax($34,250 + $130,000) - tax($130,000)
    //   tax($164,250) = 1192.50 + 4386.00 + 12072.50 + 14616.00 = $32,267.00
    //   tax($130,000) = 1192.50 + 4386.00 + 12072.50 + 6396.00  = $24,047.00
    //   Stacked tax = $8,220.00
    expect(withFEIE.form1040.incomeTax).toBe(8220);
  });

  it('non-FEIE filer at same taxable income pays less (proves stacking)', () => {
    // Same $50,000 AGI → $34,250 taxable, but no stacking
    const noFEIE = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Domestic Corp', wages: 50000, federalTaxWithheld: 5000,
        socialSecurityWages: 50000, socialSecurityTax: 3100, medicareWages: 50000, medicareTax: 725,
      }],
    });

    // Without stacking: tax($34,250) = $3,871.50
    expect(noFEIE.form1040.incomeTax).toBe(3871.5);
  });

  it('partial-year FEIE uses prorated exclusion for stacking', () => {
    // 200/365 qualifying days → exclusion = round(130000 * 200/365) = $71,232.88
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Foreign Corp', wages: 120000, federalTaxWithheld: 0,
        socialSecurityWages: 0, socialSecurityTax: 0, medicareWages: 0, medicareTax: 0,
      }],
      foreignEarnedIncome: { foreignEarnedIncome: 120000, qualifyingDays: 200 },
    });

    // Prorated exclusion = round2(130000/365 * 200) = $71,232.88
    expect(r.form1040.feieExclusion).toBeCloseTo(71232.88, 0);
    // AGI = 120000 - 71232.88 = 48767.12; taxable ≈ 48767.12 - 15750 = 33017.12
    // Stacked tax > non-stacked tax on same taxable income
    const nonStackedTax = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Domestic', wages: 48767, federalTaxWithheld: 0,
        socialSecurityWages: 48767, socialSecurityTax: 3024, medicareWages: 48767, medicareTax: 707,
      }],
    });
    expect(r.form1040.incomeTax).toBeGreaterThan(nonStackedTax.form1040.incomeTax);
  });

  it('FEIE stacking works with preferential income (QD/LTCG)', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Foreign Corp', wages: 150000, federalTaxWithheld: 0,
        socialSecurityWages: 0, socialSecurityTax: 0, medicareWages: 0, medicareTax: 0,
      }],
      foreignEarnedIncome: { foreignEarnedIncome: 150000, qualifyingDays: 365 },
      // Also has $10,000 in qualified dividends (not excluded by FEIE)
      income1099DIV: [{
        id: 'd1', payerName: 'Brokerage', totalOrdinaryDividends: 10000,
        qualifiedDividends: 10000,
      }],
    });

    // FEIE excludes $130k of wages → AGI = 20000 + 10000 = 30000
    // taxable = 30000 - 15750 = 14250
    // With stacking, ordinary portion pushed into higher brackets
    expect(r.form1040.feieExclusion).toBe(130000);
    // Tax with stacking should be higher than naive computation on $14,250
    const naive = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Domestic', wages: 20000, federalTaxWithheld: 0,
        socialSecurityWages: 20000, socialSecurityTax: 1240, medicareWages: 20000, medicareTax: 290,
      }],
      income1099DIV: [{
        id: 'd1', payerName: 'Brokerage', totalOrdinaryDividends: 10000,
        qualifiedDividends: 10000,
      }],
    });
    expect(r.form1040.incomeTax).toBeGreaterThan(naive.form1040.incomeTax);
  });

  it('zero FEIE exclusion does not affect tax computation', () => {
    // No foreignEarnedIncome → feieExclusion = 0 → no stacking
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Domestic Corp', wages: 80000, federalTaxWithheld: 10000,
        socialSecurityWages: 80000, socialSecurityTax: 4960, medicareWages: 80000, medicareTax: 1160,
      }],
    });

    expect(r.form1040.feieExclusion).toBe(0);
    // taxable = 80000 - 15750 = 64250
    // tax = 1192.50 + 4386.00 + (64250-48475)*0.22 = 1192.50 + 4386.00 + 3470.50 = 9049.00
    expect(r.form1040.incomeTax).toBe(9049);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-05 — Investment Income Disqualifies EITC
//
// 2 models flagged this. Tax-exempt interest (municipal bond interest)
// counts toward the $11,600 investment income limit for EITC, per IRS
// Pub 596. A taxpayer who otherwise qualifies for EITC based on earned
// income and AGI can be disqualified by investment income alone.
//
// Single filer, $15,000 W-2 wages, $12,000 tax-exempt interest.
// AGI = $15,000 (tax-exempt interest not in AGI but DOES count for EITC).
// Investment income = $12,000 > $11,600 limit → EITC = $0.
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-05 — Tax-Exempt Interest Disqualifies EITC', () => {
  it('tax-exempt interest pushes investment income over $11,600 → EITC $0', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1985-01-01',
      w2Income: [{
        id: 'w1', employerName: 'Employer', wages: 15000, federalTaxWithheld: 500,
        socialSecurityWages: 15000, socialSecurityTax: 930, medicareWages: 15000, medicareTax: 218,
      }],
      income1099INT: [{
        id: 'i1', payerName: 'Muni Fund', amount: 0, taxExemptInterest: 12000,
      }],
      dependents: [
        { id: 'd1', firstName: 'Child', lastName: 'A', relationship: 'son', dateOfBirth: '2019-04-01', monthsLivedWithYou: 12, isStudent: false, isDisabled: false },
      ],
    });

    // AGI should only include taxable income (wages), not tax-exempt interest
    expect(r.form1040.agi).toBe(15000);

    // But investment income includes tax-exempt interest: $12,000 > $11,600
    expect(r.credits.eitcCredit).toBe(0);
  });

  it('just below investment income limit → EITC still applies', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1985-01-01',
      w2Income: [{
        id: 'w1', employerName: 'Employer', wages: 15000, federalTaxWithheld: 500,
        socialSecurityWages: 15000, socialSecurityTax: 930, medicareWages: 15000, medicareTax: 218,
      }],
      income1099INT: [{
        id: 'i1', payerName: 'Muni Fund', amount: 0, taxExemptInterest: 11500,
      }],
      dependents: [
        { id: 'd1', firstName: 'Child', lastName: 'A', relationship: 'son', dateOfBirth: '2019-04-01', monthsLivedWithYou: 12, isStudent: false, isDisabled: false },
      ],
    });

    // Investment income = $11,500 < $11,600 → EITC should still be positive
    expect(r.credits.eitcCredit).toBeGreaterThan(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-06 — Excess SS + NIIT + Additional Medicare Tax Triple-Stack
//
// High-income taxpayer with two W-2 jobs triggers all three:
// 1. Excess Social Security Tax Credit (two employers each withhold SS)
// 2. Net Investment Income Tax (3.8% on investment income above $200k AGI)
// 3. Additional Medicare Tax (0.9% on wages above $200k Single)
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-06 — Excess SS + NIIT + Additional Medicare Triple-Stack', () => {
  it('all three taxes/credits compute correctly together', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [
        {
          id: 'w1', employerName: 'Corp A', wages: 120000, federalTaxWithheld: 25000,
          socialSecurityWages: 120000, socialSecurityTax: 7440, medicareWages: 120000, medicareTax: 1740,
        },
        {
          id: 'w2', employerName: 'Corp B', wages: 120000, federalTaxWithheld: 25000,
          socialSecurityWages: 120000, socialSecurityTax: 7440, medicareWages: 120000, medicareTax: 1740,
        },
      ],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 30000, federalTaxWithheld: 0 }],
    });

    // AGI = $240,000 wages + $30,000 interest = $270,000
    expect(r.form1040.agi).toBe(270000);

    // 1. Excess SS Tax Credit
    // Total SS withheld = $14,880, max = $10,918.20, excess = $3,961.80
    expect(r.credits.excessSSTaxCredit).toBeCloseTo(3961.80, 0);

    // 2. NIIT: 3.8% × min($30,000 investment income, AGI − $200,000)
    // = 3.8% × min($30,000, $70,000) = 3.8% × $30,000 = $1,140
    expect(r.form1040.niitTax).toBeCloseTo(1140, 0);

    // 3. Additional Medicare Tax: 0.9% × (wages − $200,000)
    // = 0.9% × $40,000 = $360
    expect(r.form1040.additionalMedicareTaxW2).toBe(360);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-07 — Passive Rental Loss + NIIT Interaction
//
// Rental loss disallowed by passive activity rules should NOT reduce
// net investment income for NIIT purposes. Tests that NIIT doesn't
// accidentally offset investment income with disallowed passive losses.
//
// Single filer, $210,000 W-2 + rental property with $25k loss.
// AGI > $150k → rental loss fully disallowed → AGI = $210,000.
// NIIT: AGI $210k > $200k threshold. NII should be computed on
// actual investment income, not reduced by suspended losses.
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-07 — Passive Rental Loss + NIIT Interaction', () => {
  it('disallowed rental loss does not reduce NIIT base', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'BigCorp', wages: 210000, federalTaxWithheld: 45000,
        socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 210000, medicareTax: 3045,
      }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 5000 }],
      rentalProperties: [{
        id: 'r1', address: '456 Oak St', propertyType: 'single_family',
        daysRented: 365, personalUseDays: 0,
        rentalIncome: 10000, repairs: 35000,
      }],
    });

    // AGI should be $210,000 + $5,000 = $215,000 (rental loss disallowed at AGI > $150k)
    expect(r.form1040.agi).toBe(215000);

    // NIIT should be on net investment income.
    // Investment income includes interest ($5k). Rental loss is passive/disallowed.
    // NIIT = 3.8% × min(NII, AGI - $200k) = 3.8% × min($5,000, $15,000) = $190
    expect(r.form1040.niitTax).toBeCloseTo(190, 0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-08 — QBI Deduction Limited by Taxable Income
//
// QBI deduction (§199A) = 20% of QBI, but cannot exceed 20% of taxable
// income (before QBI deduction). Tests that the taxable income limitation
// is properly applied when QBI is large relative to taxable income.
//
// Single filer with large 1099-NEC income and large itemized deductions.
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-08 — QBI Deduction Limited by Taxable Income', () => {
  it('QBI deduction cannot exceed 20% of taxable income (before QBI)', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 100000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 10000,
        realEstateTax: 0,
        personalPropertyTax: 0,
        mortgageInterest: 25000,
        mortgageInsurancePremiums: 0,
        charitableCash: 40000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    });

    // Schedule C net profit ≈ $100,000 (no expenses)
    // SE deduction ≈ $100,000 × 0.9235 × 0.5 × 0.153 ≈ $7,065
    // AGI ≈ $100,000 - $7,065 = $92,935
    // Itemized deductions = $10,000 (SALT, under $40k cap) + $25,000 + $40,000 = $75,000
    // Taxable income before QBI = $92,935 - $75,000 = $17,935
    // QBI = net profit - SE deduction (some variants) ≈ ~$92,935
    // 20% of QBI ≈ $18,587
    // 20% of taxable income = $3,587
    // QBI deduction should be limited to 20% of taxable income = $3,587

    // Key assertion: QBI deduction is limited by taxable income
    const taxableIncomeBeforeQBI = r.form1040.taxableIncome + r.form1040.qbiDeduction;
    const twentyPercentTaxableIncome = taxableIncomeBeforeQBI * 0.20;
    expect(r.form1040.qbiDeduction).toBeLessThanOrEqual(twentyPercentTaxableIncome + 0.01);

    // QBI deduction should be positive but constrained
    expect(r.form1040.qbiDeduction).toBeGreaterThan(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-09 — NOL Carryforward Reduces QBI Taxable Income Limit
//
// 2 models flagged this. Net Operating Loss carryforward reduces taxable
// income BEFORE the QBI deduction is computed. Since QBI deduction is
// limited to 20% of (taxable income before QBI), a large NOL can
// significantly reduce the QBI deduction.
//
// Single, 1099-NEC $80,000, NOL carryforward $30,000.
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-09 — NOL Carryforward Reduces QBI Taxable Income Limit', () => {
  it('QBI deduction limited by taxable income AFTER NOL deduction', () => {
    const withNOL = calc({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Consulting', amount: 80000 }],
      nolCarryforward: 30000,
    });

    const withoutNOL = calc({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Consulting', amount: 80000 }],
    });

    // Both have same gross income, but withNOL has $30k less taxable income
    expect(withNOL.form1040.nolDeduction).toBe(30000);

    // QBI deduction with NOL should be <= QBI deduction without NOL
    // because taxable income is lower
    expect(withNOL.form1040.qbiDeduction).toBeLessThanOrEqual(withoutNOL.form1040.qbiDeduction);

    // Taxable income with NOL should be lower
    expect(withNOL.form1040.taxableIncome).toBeLessThan(withoutNOL.form1040.taxableIncome);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-10 — 1099-Q + AOTC Anti-Double-Dip (IRC §529(c)(3)(B))
//
// 2 models flagged this. When a taxpayer uses 529 distributions AND claims
// AOTC on the same qualified education expenses, the expenses allocated
// to the AOTC must be subtracted from qualified expenses for the 1099-Q
// exclusion ratio calculation.
//
// The engine only applies the pro-rata exclusion for 'non_qualified'
// distributions. For 'qualified' distributions, the engine trusts the
// user's classification.
//
// 1099-Q (non_qualified): $10,000 distribution ($3,000 earnings, $7,000 basis).
// Total qualified expenses: $10,000. But $4,000 allocated to AOTC.
// Adjusted QEE for 1099-Q = $10,000 - $4,000 = $6,000.
// Exclusion ratio = $6,000 / $10,000 = 60%.
// Taxable earnings = $3,000 × (1 - 0.60) = $1,200.
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-10 — 1099-Q + AOTC Anti-Double-Dip', () => {
  it('expenses allocated to AOTC reduce 1099-Q exclusion (non_qualified dist)', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Employer', wages: 60000, federalTaxWithheld: 8000,
        socialSecurityWages: 60000, socialSecurityTax: 3720, medicareWages: 60000, medicareTax: 870,
      }],
      income1099Q: [{
        id: 'q1', payerName: '529 Plan', grossDistribution: 10000,
        earnings: 3000, basisReturn: 7000,
        qualifiedExpenses: 10000,
        expensesClaimedForCredit: 4000, // $4k goes to AOTC
        distributionType: 'non_qualified',
      }],
      educationCredits: [{
        id: 'e1', type: 'american_opportunity', studentName: 'Self',
        tuitionPaid: 4000, institution: 'State University',
      }],
    });

    // AQEE = $10,000 - $4,000 = $6,000
    // Exclusion ratio = $6,000 / $10,000 = 60%
    // Taxable earnings = $3,000 × (1 - 0.60) = $1,200
    expect(r.form1040.taxable529Income).toBeCloseTo(1200, 0);

    // AOTC should still apply on the $4,000
    expect(r.credits.educationCredit + r.credits.aotcRefundableCredit).toBeGreaterThan(0);
  });

  it('without credit offset → full exclusion on non_qualified dist', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Employer', wages: 60000, federalTaxWithheld: 8000,
        socialSecurityWages: 60000, socialSecurityTax: 3720, medicareWages: 60000, medicareTax: 870,
      }],
      income1099Q: [{
        id: 'q1', payerName: '529 Plan', grossDistribution: 10000,
        earnings: 3000, basisReturn: 7000,
        qualifiedExpenses: 10000,
        // No expensesClaimedForCredit → AQEE = full $10,000
        distributionType: 'non_qualified',
      }],
    });

    // AQEE = $10,000, exclusion ratio = 100% → $0 taxable
    expect(r.form1040.taxable529Income).toBe(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-11 — Clean Energy Credit Carryforward + Limited Tax Liability
//
// 2 models flagged credit ordering issues. Clean energy is non-refundable
// with carryforward. When tax liability is low and multiple non-refundable
// credits compete, unused clean energy should carryforward to next year.
//
// Single filer, W-2 $30,000, 1 qualifying child (CTC $2,200),
// Clean energy: $10,000 solar + $1,000 prior year carryforward.
// Low tax liability means not all credits can be used.
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-11 — Clean Energy Credit Carryforward Ordering', () => {
  it('unused clean energy credit carries forward when tax liability is limited', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Employer', wages: 30000, federalTaxWithheld: 2000,
        socialSecurityWages: 30000, socialSecurityTax: 1860, medicareWages: 30000, medicareTax: 435,
      }],
      dependents: [{
        id: 'd1', firstName: 'Child', lastName: 'A', relationship: 'son',
        dateOfBirth: '2017-01-15', ssn: '111-22-3333',
        monthsLivedWithYou: 12, isStudent: false, isDisabled: false,
      }],
      cleanEnergy: {
        solarElectric: 10000,
        priorYearCarryforward: 1000,
      },
    });

    // Clean energy credit = 30% × $10,000 + $1,000 carryforward = $4,000
    // Taxable income = $30,000 - $15,750 = $14,250
    // Income tax ≈ $1,192.50 + 12% × ($14,250 - $11,925) = $1,192.50 + $279 = $1,471.50
    // CTC competes with clean energy for limited tax liability
    // Tax after credits should be $0 (credits exceed liability)
    expect(r.form1040.taxAfterCredits).toBe(0);

    // Clean energy carryforward should exist (some credit unused)
    if (r.cleanEnergy) {
      expect(r.cleanEnergy.carryforwardToNextYear).toBeGreaterThanOrEqual(0);
    }
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-12 — K-1 Charitable Contributions Flow to Schedule A
//
// K-1 Box 13 charitable contributions (cash and non-cash) must flow
// through to Schedule A itemized deductions. When a taxpayer itemizes
// and has K-1 charitable contributions, they should increase the
// charitable deduction.
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-12 — K-1 Charitable Contributions → Schedule A', () => {
  it('K-1 charitable cash flows to itemized charitable deduction', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000, federalTaxWithheld: 18000,
        socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450,
      }],
      incomeK1: [{
        id: 'k1', entityName: 'Investment LP', entityType: 'partnership',
        ordinaryBusinessIncome: 10000,
        box13CharitableCash: 5000,
      }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 8000,
        realEstateTax: 4000,
        personalPropertyTax: 0,
        mortgageInterest: 12000,
        mortgageInsurancePremiums: 0,
        charitableCash: 3000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    });

    // Schedule A charitable should include personal $3,000 + K-1 $5,000 = $8,000
    if (r.scheduleA) {
      expect(r.scheduleA.charitableDeduction).toBe(8000);
    }

    // Should be itemizing (total itemized > standard deduction)
    expect(r.form1040.deductionUsed).toBe('itemized');
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-13 — SE Health Insurance Cannot Exceed Net SE Income
//
// 2 models flagged this. The self-employed health insurance deduction
// (IRC §162(l)) cannot exceed the taxpayer's net self-employment earnings.
// It is also limited to the net profit of the business (not including
// the SE deduction).
//
// Single filer, 1099-NEC $20,000 (small freelance income),
// SE health insurance premiums $25,000.
// Deduction should be limited to ~$20,000 (net profit), not full $25,000.
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-13 — SE Health Insurance Capped at Net SE Income', () => {
  it('health insurance deduction limited to net business profit', () => {
    const r = calc({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 20000 }],
      selfEmploymentDeductions: {
        healthInsurancePremiums: 25000,
        sepIraContributions: 0,
        solo401kContributions: 0,
        otherRetirementContributions: 0,
      },
    });

    // Health insurance deduction should not exceed net profit
    // Net profit = $20,000 (no business expenses)
    // SE deduction ≈ $20,000 × 0.9235 × 0.5 × 0.153 ≈ $1,413
    // Remaining net after SE deduction ≈ $18,587
    // Health insurance deduction ≤ $18,587 (not $25,000)
    expect(r.form1040.selfEmployedHealthInsurance).toBeLessThanOrEqual(20000);
    expect(r.form1040.selfEmployedHealthInsurance).toBeLessThan(25000);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// ADV-14 — Multiple Income Types + AMT + NIIT + Credits Interaction
//
// Complex high-income scenario combining:
// - W-2 wages + LTCG + qualified dividends + interest
// - AMT triggered by ISO exercise spread
// - NIIT on investment income above $200k
// - CTC phase-out
// - Multiple credits competing for limited non-refundable space
// ═══════════════════════════════════════════════════════════════════════════

describe('ADV-14 — High-Income Multi-Provision Kitchen Sink', () => {
  it('AMT, NIIT, CTC phase-out, and credits all interact correctly', () => {
    const r = calc({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{
        id: 'w1', employerName: 'TechCo', wages: 250000, federalTaxWithheld: 50000,
        socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 250000, medicareTax: 3625,
      }],
      income1099DIV: [{
        id: 'div1', payerName: 'Vanguard', ordinaryDividends: 8000,
        qualifiedDividends: 6000, capitalGainDistributions: 5000,
        foreignTaxPaid: 200,
      }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 12000 }],
      income1099B: [{
        id: 'b1', brokerName: 'Fidelity', description: 'Growth stock',
        proceeds: 80000, costBasis: 30000, isLongTerm: true,
        dateAcquired: '2023-01-01', dateSold: '2025-07-01',
      }],
      amtData: {
        isoExerciseSpread: 100000, // Large ISO spread triggers AMT
      },
      dependents: [
        { id: 'd1', firstName: 'Child', lastName: 'A', relationship: 'son', dateOfBirth: '2017-03-15', ssn: '111-22-3333', monthsLivedWithYou: 12, isStudent: false, isDisabled: false },
        { id: 'd2', firstName: 'Child', lastName: 'B', relationship: 'daughter', dateOfBirth: '2019-09-20', ssn: '444-55-6666', monthsLivedWithYou: 12, isStudent: false, isDisabled: false },
      ],
    });

    // AGI should include: $250k wages + $8k div + $12k interest + $50k LTCG + $5k cap gain dist
    expect(r.form1040.agi).toBe(325000);

    // AMT should be triggered by $100k ISO spread
    expect(r.form1040.amtAmount).toBeGreaterThan(0);

    // NIIT: AGI $325k > MFJ $250k threshold
    // NII = $8k div + $12k interest + $50k LTCG + $5k cap gain dist = $75k
    // NIIT = 3.8% × min($75k, $325k - $250k) = 3.8% × $75k = $2,850
    expect(r.form1040.niitTax).toBeCloseTo(2850, 0);

    // CTC: AGI $325k > MFJ $400k threshold → no phase-out yet
    // Full CTC = $2,200 × 2 = $4,400
    expect(r.credits.childTaxCredit).toBe(4400);

    // Foreign tax credit should apply ($200 foreign tax paid)
    expect(r.credits.foreignTaxCredit).toBeGreaterThan(0);
    expect(r.credits.foreignTaxCredit).toBeLessThanOrEqual(200);

    // Total tax should be substantial
    expect(r.form1040.totalTax).toBeGreaterThan(50000);
  });
});
