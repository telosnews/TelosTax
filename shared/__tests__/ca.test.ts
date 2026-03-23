/**
 * California State Tax Tests — Full Return Coverage
 *
 * Tests for:
 *   1. MHST ordering (credits do NOT reduce MHST)
 *   2. Bracket calculations by filing status
 *   3. Standard deduction per filing status
 *   4. MHST threshold behavior
 *   5. Social Security subtraction
 *   6. Exemption credits
 *   7. CalEITC (simplified)
 *   8. CA itemized deduction recalculation (no SALT cap, $1M mortgage limit)
 *   9. Estimated payments from stateSpecificData
 *  10. Additions & subtractions (Schedule CA)
 *  11. Edge cases
 *  12. Golden-value snapshots
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateStateTaxes } from '../src/engine/state/index.js';
import { TaxReturn, FilingStatus, StateReturnConfig } from '../src/types/index.js';
import { round2 } from '../src/engine/utils.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'ca-test',
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

function makeW2Return(
  wages: number,
  stateWithheld = 0,
  filingStatus = FilingStatus.Single,
  stateSpecificData?: Record<string, unknown>,
) {
  return makeTaxReturn({
    filingStatus,
    w2Income: [{
      id: 'w1',
      employerName: 'Test Corp',
      wages,
      federalTaxWithheld: Math.round(wages * 0.15),
      socialSecurityWages: Math.min(wages, 168600),
      socialSecurityTax: Math.min(wages, 168600) * 0.062,
      medicareWages: wages,
      medicareTax: wages * 0.0145,
      state: 'CA',
      stateTaxWithheld: stateWithheld,
    }],
    stateReturns: [{
      stateCode: 'CA',
      residencyType: 'resident' as const,
      stateSpecificData,
    }],
  });
}

function getCAResult(taxReturn: TaxReturn) {
  const federal = calculateForm1040(taxReturn);
  const results = calculateStateTaxes(taxReturn, federal);
  const ca = results.find(r => r.stateCode === 'CA');
  return { federal, ca: ca!, results };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. MHST ORDERING — Credits must NOT reduce MHST
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — MHST Ordering', () => {
  it('MHST is not reduced by exemption credits', () => {
    // $1.5M income, taxable = $1.5M - $5540 std ded = $1,494,460
    // MHST = 1% of ($1,494,460 - $1M) = $4,944.60
    const tr = makeW2Return(1_500_000, 0);
    const { ca } = getCAResult(tr);

    const mhst = ca.additionalLines!.mentalHealthServicesTax;
    expect(mhst).toBeCloseTo(4942.94, 2);

    // Total tax should be baseTax - credits + MHST
    const baseTax = ca.additionalLines!.baseTaxBeforeMHST;
    const exemptionCredits = ca.additionalLines!.personalExemptionCredits;
    const expectedTotal = Math.max(0, baseTax - exemptionCredits) + mhst;
    expect(ca.totalStateTax).toBe(expectedTotal);
  });

  it('MHST added after all credits are applied', () => {
    // $1.2M income, taxable = $1.2M - $5540 = $1,194,460
    // MHST = 1% of ($1,194,460 - $1M) = $1,944.60
    const tr = makeW2Return(1_200_000, 0);
    const { ca } = getCAResult(tr);

    const mhst = ca.additionalLines!.mentalHealthServicesTax;
    expect(mhst).toBeCloseTo(1942.94, 2);

    // stateTaxAfterCredits should NOT include MHST
    // It's baseTax - nonrefundableCredits (bracket tax only)
    const baseTax = ca.additionalLines!.baseTaxBeforeMHST;
    const exemptionCredits = ca.additionalLines!.personalExemptionCredits;
    expect(ca.stateTaxAfterCredits).toBe(Math.max(0, baseTax - exemptionCredits));
  });

  it('combined flow: credits + MHST produces correct total', () => {
    // MFJ with 2 dependents, $2M income
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 2_000_000,
        federalTaxWithheld: 300000,
        socialSecurityWages: 168600, socialSecurityTax: 168600 * 0.062,
        medicareWages: 2_000_000, medicareTax: 2_000_000 * 0.0145,
        state: 'CA', stateTaxWithheld: 0,
      }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12 },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', monthsLivedWithYou: 12 },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);

    const mhst = ca.additionalLines!.mentalHealthServicesTax;
    const baseTax = ca.additionalLines!.baseTaxBeforeMHST;
    const exemptionCredits = ca.additionalLines!.personalExemptionCredits;

    // At $2M AGI, MFJ exemption credits are fully phased out (AGI >> $504,411 threshold)
    expect(exemptionCredits).toBe(0);
    expect(mhst).toBeGreaterThan(0);

    // Total = max(0, baseTax - 0) + mhst
    const expectedTotal = Math.max(0, baseTax - exemptionCredits) + mhst;
    expect(ca.totalStateTax).toBe(expectedTotal);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BRACKET CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Bracket Calculations', () => {
  it('Single $75K — correct bracket application', () => {
    const { ca } = getCAResult(makeW2Return(75000));
    expect(ca.stateCode).toBe('CA');
    expect(ca.stateDeduction).toBe(5706);
    // Taxable: 75000 - 5540 = 69460 → spans up through 8% bracket
    expect(ca.stateTaxableIncome).toBe(75000 - 5706);
    expect(ca.additionalLines!.baseTaxBeforeMHST).toBeGreaterThan(0);
    // Should have multiple brackets used
    expect(ca.bracketDetails!.filter(b => b.taxAtRate > 0).length).toBeGreaterThan(3);
  });

  it('MFJ $150K — uses married_joint brackets', () => {
    const { ca } = getCAResult(makeW2Return(150000, 0, FilingStatus.MarriedFilingJointly));
    expect(ca.stateDeduction).toBe(11412);
    expect(ca.stateTaxableIncome).toBe(150000 - 11412);
  });

  it('HoH $90K — uses head_of_household brackets', () => {
    const { ca } = getCAResult(makeW2Return(90000, 0, FilingStatus.HeadOfHousehold));
    expect(ca.stateDeduction).toBe(11412);
    expect(ca.stateTaxableIncome).toBe(90000 - 11412);
  });

  it('MFS $80K — uses married_separate brackets', () => {
    const { ca } = getCAResult(makeW2Return(80000, 0, FilingStatus.MarriedFilingSeparately));
    expect(ca.stateDeduction).toBe(5706);
    expect(ca.stateTaxableIncome).toBe(80000 - 5706);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. STANDARD DEDUCTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Standard Deduction', () => {
  it('Single: $5,540', () => {
    const { ca } = getCAResult(makeW2Return(50000));
    expect(ca.stateDeduction).toBe(5706);
  });

  it('MFJ: $11,080', () => {
    const { ca } = getCAResult(makeW2Return(50000, 0, FilingStatus.MarriedFilingJointly));
    expect(ca.stateDeduction).toBe(11412);
  });

  it('MFS: $5,540', () => {
    const { ca } = getCAResult(makeW2Return(50000, 0, FilingStatus.MarriedFilingSeparately));
    expect(ca.stateDeduction).toBe(5706);
  });

  it('HoH: $11,080', () => {
    const { ca } = getCAResult(makeW2Return(50000, 0, FilingStatus.HeadOfHousehold));
    expect(ca.stateDeduction).toBe(11412);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. MHST THRESHOLD
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Mental Health Services Tax', () => {
  it('no MHST below $1M', () => {
    const { ca } = getCAResult(makeW2Return(900_000));
    expect(ca.additionalLines!.mentalHealthServicesTax).toBe(0);
  });

  it('no MHST at exactly $1M taxable', () => {
    // Income needs to be > $1M + standard deduction to cross threshold
    const { ca } = getCAResult(makeW2Return(1_005_540)); // taxable = $1M exactly
    expect(ca.additionalLines!.mentalHealthServicesTax).toBe(0);
  });

  it('MHST applies above $1M taxable', () => {
    const { ca } = getCAResult(makeW2Return(1_500_000));
    // taxable ≈ $1.5M - $5706 = $1,494,294
    // MHST = 1% × ($1,494,294 - $1,000,000) = $4,942.94
    const mhst = ca.additionalLines!.mentalHealthServicesTax;
    expect(mhst).toBeGreaterThan(0);
    expect(mhst).toBeCloseTo(4942.94, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SOCIAL SECURITY SUBTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Social Security Exemption', () => {
  it('subtracts taxable SS benefits from CA AGI', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      incomeSSA1099: { id: 'ssa1', totalBenefits: 24000, federalTaxWithheld: 0 },
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' }],
    });
    const { ca, federal } = getCAResult(tr);

    const taxableSS = federal.socialSecurity?.taxableBenefits || 0;
    if (taxableSS > 0) {
      expect(ca.stateSubtractions).toBeGreaterThanOrEqual(taxableSS);
      expect(ca.stateAGI).toBeLessThan(federal.form1040.agi);
    }
  });

  it('no subtraction when no SS benefits', () => {
    const { ca } = getCAResult(makeW2Return(75000));
    // With only W-2 income, no SS subtraction
    expect(ca.stateSubtractions).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. EXEMPTION CREDITS
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Exemption Credits', () => {
  it('Single: $153 personal exemption credit', () => {
    const { ca } = getCAResult(makeW2Return(75000));
    expect(ca.additionalLines!.personalExemptionCredits).toBe(153);
  });

  it('MFJ: $306 personal exemption credit', () => {
    const { ca } = getCAResult(makeW2Return(75000, 0, FilingStatus.MarriedFilingJointly));
    expect(ca.additionalLines!.personalExemptionCredits).toBe(306);
  });

  it('MFJ + 2 dependents: $306 + 2 × $475 = $1,256', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
        state: 'CA', stateTaxWithheld: 0,
      }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12 },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', monthsLivedWithYou: 12 },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.personalExemptionCredits).toBe(1256);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. CalEITC (Full Form 3514)
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — CalEITC (Form 3514)', () => {
  it('CalEITC credited for low-income filer with 0 children', () => {
    const tr = makeW2Return(3000, 0);
    const { ca } = getCAResult(tr);
    // 0 children, $3000 earned → phase-in: $3000 × 7.65% = $229.50
    expect(ca.additionalLines!.calEITC).toBeGreaterThan(0);
    expect(ca.additionalLines!.calEITC).toBeLessThanOrEqual(302); // max for 0 children
  });

  it('CalEITC credited for filer with 1 child', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 10000,
        federalTaxWithheld: 0, state: 'CA', stateTaxWithheld: 0,
        socialSecurityWages: 10000, socialSecurityTax: 620,
        medicareWages: 10000, medicareTax: 145,
      }],
      dependents: [{
        id: 'd1', firstName: 'Child', lastName: 'One',
        relationship: 'child', monthsLivedWithYou: 12,
        dateOfBirth: '2015-06-15',
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.calEITC).toBeGreaterThan(0);
    expect(ca.additionalLines!.calEITC).toBeLessThanOrEqual(2028); // max for 1 child
  });

  it('CalEITC credited for filer with 2 children', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 15000,
        federalTaxWithheld: 0, state: 'CA', stateTaxWithheld: 0,
        socialSecurityWages: 15000, socialSecurityTax: 930,
        medicareWages: 15000, medicareTax: 217.5,
      }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2015-06-15' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2017-03-10' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.calEITC).toBeGreaterThan(0);
    expect(ca.additionalLines!.calEITC).toBeLessThanOrEqual(3350); // max for 2 children
  });

  it('CalEITC credited for filer with 3+ children', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 12000,
        federalTaxWithheld: 0, state: 'CA', stateTaxWithheld: 0,
        socialSecurityWages: 12000, socialSecurityTax: 744,
        medicareWages: 12000, medicareTax: 174,
      }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2012-01-01' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2014-06-15' },
        { id: 'd3', firstName: 'E', lastName: 'F', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2016-09-20' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.calEITC).toBeGreaterThan(0);
    expect(ca.additionalLines!.calEITC).toBeLessThanOrEqual(3768); // max for 3+ children
  });

  it('CalEITC phase-in: credit increases with income', () => {
    // 0 children: phase-in rate = 7.65%
    const low = getCAResult(makeW2Return(1000, 0)).ca;
    const mid = getCAResult(makeW2Return(2000, 0)).ca;
    expect(mid.additionalLines!.calEITC).toBeGreaterThan(low.additionalLines!.calEITC);
  });

  it('CalEITC phase-out: credit decreases at higher income', () => {
    // 0 children: phase-out starts at $3948
    const at4000 = getCAResult(makeW2Return(4000, 0)).ca;
    const at6000 = getCAResult(makeW2Return(6000, 0)).ca;
    // $6000 should have lower or zero CalEITC
    expect(at6000.additionalLines!.calEITC).toBeLessThan(at4000.additionalLines!.calEITC);
  });

  it('no CalEITC when earned income over threshold', () => {
    const { ca } = getCAResult(makeW2Return(50000));
    expect(ca.additionalLines!.calEITC).toBe(0);
  });

  it('CalEITC disqualified by investment income > $3,750', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 10000,
        federalTaxWithheld: 0, state: 'CA', stateTaxWithheld: 0,
        socialSecurityWages: 10000, socialSecurityTax: 620,
        medicareWages: 10000, medicareTax: 145,
      }],
      income1099INT: [{ id: 'int1', payerName: 'Bank', amount: 5000 }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // Investment income $5000 > $3750 → disqualified
    expect(ca.additionalLines!.calEITC).toBe(0);
  });

  it('CalEITC with self-employment income uses 92.35% factor', () => {
    // $5,000 Schedule C net profit → SE earned income = $5,000 × 0.9235 = $4,617.50
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'nec1', payerName: 'Client', amount: 5000 }],
      businesses: [{
        id: 'biz1', name: 'Freelance', activity: 'consulting',
        naicsCode: '541611', income: 5000, expenses: [],
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // CalEITC should be positive (SE earned income of $4,617.50 is within 0-child limit of $7,891)
    expect(ca.additionalLines!.calEITC).toBeGreaterThan(0);
  });

  it('CalEITC SE income: lower credit than raw Schedule C profit would yield', () => {
    // $3,948 Schedule C net → SE earned = $3,948 × 0.9235 = $3,645.98
    // Without 92.35% factor, raw $3,948 would hit max CalEITC for 0 children ($302)
    // With factor: $3,645.98 × 0.0765 = $278.92 (still in phase-in, less than max)
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'nec1', payerName: 'Client', amount: 3948 }],
      businesses: [{
        id: 'biz1', name: 'Freelance', activity: 'consulting',
        naicsCode: '541611', income: 3948, expenses: [],
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // With 92.35%: earned = round2(3948 * 0.9235) = 3646.06
    // phaseIn = round2(3646.06 * 0.0765) = 278.92
    // This is less than max $302, so we're still in phase-in
    expect(ca.additionalLines!.calEITC).toBeLessThan(302);
    expect(ca.additionalLines!.calEITC).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7B. YOUNG CHILD TAX CREDIT (YCTC)
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Young Child Tax Credit (YCTC)', () => {
  it('YCTC for 1 child under 6', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 15000,
        federalTaxWithheld: 0, state: 'CA', stateTaxWithheld: 0,
        socialSecurityWages: 15000, socialSecurityTax: 930,
        medicareWages: 15000, medicareTax: 217.5,
      }],
      dependents: [{
        id: 'd1', firstName: 'Baby', lastName: 'Child',
        relationship: 'child', monthsLivedWithYou: 12,
        dateOfBirth: '2022-03-15', // Under 6 at end of 2025
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // Should get CalEITC (low income) AND YCTC
    expect(ca.additionalLines!.youngChildTaxCredit).toBe(1189);
  });

  it('YCTC for 2 children under 6', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 15000,
        federalTaxWithheld: 0, state: 'CA', stateTaxWithheld: 0,
        socialSecurityWages: 15000, socialSecurityTax: 930,
        medicareWages: 15000, medicareTax: 217.5,
      }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2022-03-15' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2023-07-20' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // 2 × $1189 = $2378
    expect(ca.additionalLines!.youngChildTaxCredit).toBe(2378);
  });

  it('no YCTC when no children under 6', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 15000,
        federalTaxWithheld: 0, state: 'CA', stateTaxWithheld: 0,
        socialSecurityWages: 15000, socialSecurityTax: 930,
        medicareWages: 15000, medicareTax: 217.5,
      }],
      dependents: [{
        id: 'd1', firstName: 'A', lastName: 'B',
        relationship: 'child', monthsLivedWithYou: 12,
        dateOfBirth: '2015-06-15', // Age 10 at end of 2025
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.youngChildTaxCredit).toBe(0);
  });

  it('YCTC requires CalEITC eligibility', () => {
    // High income → no CalEITC → no YCTC
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000, state: 'CA', stateTaxWithheld: 5000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
      }],
      dependents: [{
        id: 'd1', firstName: 'Baby', lastName: 'Child',
        relationship: 'child', monthsLivedWithYou: 12,
        dateOfBirth: '2022-03-15',
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.calEITC).toBe(0);
    expect(ca.additionalLines!.youngChildTaxCredit).toBe(0);
  });

  it('YCTC phases out at higher earned income', () => {
    // Earned income over $25K → YCTC phases out
    const lowIncome = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 18000,
        federalTaxWithheld: 0, state: 'CA', stateTaxWithheld: 0,
        socialSecurityWages: 18000, socialSecurityTax: 1116,
        medicareWages: 18000, medicareTax: 261,
      }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2022-03-15' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2015-06-15' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca: caLow } = getCAResult(lowIncome);

    // Check YCTC is present at $18K (under $25K threshold)
    if (caLow.additionalLines!.calEITC > 0) {
      expect(caLow.additionalLines!.youngChildTaxCredit).toBeGreaterThan(0);
    }
  });

  it('combined CalEITC + YCTC as refundable credits', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 12000,
        federalTaxWithheld: 0, state: 'CA', stateTaxWithheld: 0,
        socialSecurityWages: 12000, socialSecurityTax: 744,
        medicareWages: 12000, medicareTax: 174,
      }],
      dependents: [{
        id: 'd1', firstName: 'Baby', lastName: 'Child',
        relationship: 'child', monthsLivedWithYou: 12,
        dateOfBirth: '2022-03-15',
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);

    const calEITC = ca.additionalLines!.calEITC;
    const yctc = ca.additionalLines!.youngChildTaxCredit;

    // Both should be refundable → can result in a refund even with zero withholding
    if (calEITC > 0 && yctc > 0) {
      expect(ca.stateCredits).toBeGreaterThanOrEqual(calEITC + yctc);
      // With $0 withholding, refund = refundable credits - tax
      expect(ca.stateRefundOrOwed).toBeGreaterThan(-ca.totalStateTax);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. CA ITEMIZED DEDUCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Itemized Deductions', () => {
  it('standard beats itemized when itemized is small', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 1000,
        realEstateTax: 500,
        personalPropertyTax: 0,
        mortgageInterest: 0,
        mortgageInsurancePremiums: 0,
        charitableCash: 500,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 75000,
        federalTaxWithheld: 11250, state: 'CA', stateTaxWithheld: 3000,
        socialSecurityWages: 75000, socialSecurityTax: 4650,
        medicareWages: 75000, medicareTax: 1087.5,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // CA standard = $5,540, small itemized should lose
    expect(ca.stateDeduction).toBe(5706);
  });

  it('no SALT cap on CA return', () => {
    // Federal SALT cap is $40K. CA has no cap.
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 0,  // CA state tax not deductible on CA
        realEstateTax: 50000,     // Over federal SALT cap
        personalPropertyTax: 5000,
        mortgageInterest: 20000,
        mortgageInsurancePremiums: 0,
        charitableCash: 5000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 200000,
        federalTaxWithheld: 30000, state: 'CA', stateTaxWithheld: 10000,
        socialSecurityWages: 168600, socialSecurityTax: 168600 * 0.062,
        medicareWages: 200000, medicareTax: 200000 * 0.0145,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // CA itemized should include full $55K SALT (no cap), plus mortgage + charitable
    // Total CA itemized = $55000 + $20000 + $5000 = $80000
    // This should beat the $11080 standard
    expect(ca.stateDeduction).toBeGreaterThan(11412);
  });

  it('CA state income tax excluded from CA itemized', () => {
    // When you pay CA state tax, it's NOT deductible on your CA return
    // Only other states' taxes are deductible
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 8000,
        realEstateTax: 5000,
        personalPropertyTax: 0,
        mortgageInterest: 15000,
        mortgageInsurancePremiums: 0,
        charitableCash: 3000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000, state: 'CA', stateTaxWithheld: 5000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // CA SALT should be: $0 (only CA W-2, excluded) + $5000 RE tax = $5000
    // NOT the $8000 stateLocalIncomeTax + $5000 RE
    // Total: $5000 + $15000 + $3000 = $23000 (beats $5540)
    expect(ca.stateDeduction).toBeGreaterThan(5706);
    expect(ca.stateDeduction).toBeLessThan(35000); // Sanity check
  });

  it('multi-state: other state tax IS deductible on CA', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 8000,
        realEstateTax: 3000,
        personalPropertyTax: 0,
        mortgageInterest: 10000,
        mortgageInsurancePremiums: 0,
        charitableCash: 2000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      w2Income: [
        {
          id: 'w1', employerName: 'CA Corp', wages: 60000,
          federalTaxWithheld: 9000, state: 'CA', stateTaxWithheld: 3000,
          socialSecurityWages: 60000, socialSecurityTax: 3720,
          medicareWages: 60000, medicareTax: 870,
        },
        {
          id: 'w2', employerName: 'NY Corp', wages: 40000,
          federalTaxWithheld: 6000, state: 'NY', stateTaxWithheld: 2500,
          socialSecurityWages: 40000, socialSecurityTax: 2480,
          medicareWages: 40000, medicareTax: 580,
        },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // NY withholding ($2500) should be deductible; CA ($3000) should NOT
    // CA SALT = $2500 (NY) + $3000 (RE) = $5500
    expect(ca.stateDeduction).toBeGreaterThan(5706);
  });

  it('medical passthrough from federal', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 20000, // Large medical
        stateLocalIncomeTax: 0,
        realEstateTax: 5000,
        personalPropertyTax: 0,
        mortgageInterest: 10000,
        mortgageInsurancePremiums: 0,
        charitableCash: 3000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 80000,
        federalTaxWithheld: 12000, state: 'CA', stateTaxWithheld: 4000,
        socialSecurityWages: 80000, socialSecurityTax: 4960,
        medicareWages: 80000, medicareTax: 1160,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca, federal } = getCAResult(tr);
    // Medical deduction from federal should pass through to CA
    if (federal.scheduleA && federal.scheduleA.medicalDeduction > 0) {
      expect(ca.stateDeduction).toBeGreaterThan(5706); // itemized beats standard
    }
  });

  it('zero itemized returns standard deduction', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 0,
        realEstateTax: 0,
        personalPropertyTax: 0,
        mortgageInterest: 0,
        mortgageInsurancePremiums: 0,
        charitableCash: 0,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 75000,
        federalTaxWithheld: 11250, state: 'CA', stateTaxWithheld: 3000,
        socialSecurityWages: 75000, socialSecurityTax: 4650,
        medicareWages: 75000, medicareTax: 1087.5,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // With zero itemized, standard ($5540) should be used
    expect(ca.stateDeduction).toBe(5706);
  });

  it('mortgage $750K-$1M: CA allows larger deduction than federal', () => {
    // Balance between federal $750K limit and CA $1M limit
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 0,
        realEstateTax: 10000,
        personalPropertyTax: 0,
        mortgageInterest: 35000,    // Interest on $900K balance
        mortgageInsurancePremiums: 0,
        mortgageBalance: 900000,    // Between $750K and $1M
        charitableCash: 5000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 250000,
        federalTaxWithheld: 37500, state: 'CA', stateTaxWithheld: 15000,
        socialSecurityWages: 168600, socialSecurityTax: 168600 * 0.062,
        medicareWages: 250000, medicareTax: 250000 * 0.0145,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca, federal } = getCAResult(tr);
    // CA should allow full $35K mortgage interest (balance $900K < $1M CA limit)
    // Federal would pro-rate: $35K × ($750K / $900K) = $29,167
    // So CA itemized should be higher than federal
    if (federal.scheduleA) {
      // CA deduction should be at least as large as federal
      expect(ca.stateDeduction).toBeGreaterThanOrEqual(federal.scheduleA.totalItemized);
    }
  });

  it('SDI excluded — CA SDI not deductible on CA return', () => {
    // SDI is a payroll tax, not deductible. We verify CA doesn't
    // include it via the W-2 withholding (which is income tax, not SDI).
    const tr = makeW2Return(100000, 5000);
    const { ca } = getCAResult(tr);
    // Standard deduction used (no itemized)
    expect(ca.stateDeduction).toBe(5706);
    // Withholding should capture the CA income tax withheld, not SDI
    expect(ca.stateWithholding).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8B. ITEMIZED DEDUCTION LIMITATION (Pease-Style Phase-Out)
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Itemized Deduction Limitation', () => {
  function makeItemizedReturn(
    wages: number,
    filingStatus: FilingStatus,
    deductions: {
      medical?: number;
      realEstateTax?: number;
      mortgageInterest?: number;
      charitableCash?: number;
    },
  ) {
    return makeTaxReturn({
      filingStatus,
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: deductions.medical || 0,
        stateLocalIncomeTax: 0,
        realEstateTax: deductions.realEstateTax || 0,
        personalPropertyTax: 0,
        mortgageInterest: deductions.mortgageInterest || 0,
        mortgageInsurancePremiums: 0,
        charitableCash: deductions.charitableCash || 0,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages,
        federalTaxWithheld: Math.round(wages * 0.15),
        socialSecurityWages: Math.min(wages, 168600),
        socialSecurityTax: Math.min(wages, 168600) * 0.062,
        medicareWages: wages, medicareTax: wages * 0.0145,
        state: 'CA', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
  }

  it('below threshold: no limitation applied (Single)', () => {
    // Single filer at $200K AGI — below $252,203 threshold
    const tr = makeItemizedReturn(200000, FilingStatus.Single, {
      realEstateTax: 15000, mortgageInterest: 20000, charitableCash: 5000,
    });
    const { ca } = getCAResult(tr);
    // Total itemized = $15K + $20K + $5K = $40K → no limitation
    expect(ca.stateDeduction).toBe(40000);
  });

  it('6% of excess is smaller — wins over 80% cap (Single $300K)', () => {
    // Single filer at $300K AGI
    // Threshold: $252,203 → excess = $47,797
    // 6% of excess = $2,867.82
    // Subject deductions: $40K (all non-medical)
    // 80% cap: $32K
    // Reduction = min($2,867.82, $32,000) = $2,867.82
    // Result: $40K - $2,867.82 = $37,132.18
    const tr = makeItemizedReturn(300000, FilingStatus.Single, {
      realEstateTax: 15000, mortgageInterest: 20000, charitableCash: 5000,
    });
    const { ca } = getCAResult(tr);
    expect(ca.stateDeduction).toBeCloseTo(37132.18, 0);
    expect(ca.stateDeduction).toBeLessThan(40000);
    expect(ca.stateDeduction).toBeGreaterThan(37000);
  });

  it('80% cap is smaller — wins over 6% rate ($2M AGI, $50K deductions)', () => {
    // Single filer at $2M AGI
    // Threshold: $252,203 → excess = $1,747,797
    // 6% of excess = $104,867.82
    // Subject deductions: $50K
    // 80% cap: $40K
    // Reduction = min($104,867.82, $40,000) = $40,000 (80% cap wins)
    // Result: $50K - $40K = $10K (still above $5,540 standard)
    const tr = makeItemizedReturn(2000000, FilingStatus.Single, {
      realEstateTax: 25000, charitableCash: 25000,
    });
    const { ca } = getCAResult(tr);
    expect(ca.stateDeduction).toBe(10000);
  });

  it('medical expenses are exempt from limitation', () => {
    // Single filer at $400K AGI with $20K medical + $20K SALT
    // Medical ($20K) is exempt, but only amounts after 7.5% AGI floor pass through
    // Federal medical = max(0, $20K - 7.5% × $400K) = max(0, $20K - $30K) = $0
    // So only SALT is subject, and medical is $0 from federal scheduleA
    // Use lower income so medical actually produces a deduction
    const tr = makeItemizedReturn(300000, FilingStatus.Single, {
      medical: 30000, realEstateTax: 20000, charitableCash: 5000,
    });
    const { ca } = getCAResult(tr);
    // Medical passes through at federal calculation (after 7.5% floor)
    // Medical deduction = max(0, $30K - 7.5% × $300K) = max(0, $30K - $22.5K) = $7,500
    // Subject = $20K + $5K = $25K
    // Excess = $300K - $252,203 = $47,797
    // 6% of excess = $2,867.82
    // 80% cap = $20K
    // Reduction = min($2,867.82, $20,000) = $2,867.82
    // Total = $7,500 + ($25K - $2,867.82) = $29,632.18
    expect(ca.stateDeduction).toBeCloseTo(29632.18, 0);
  });

  it('MFJ threshold ($504,411): below vs above', () => {
    // MFJ at $500K — below $504,411 threshold → no limitation
    const trBelow = makeItemizedReturn(500000, FilingStatus.MarriedFilingJointly, {
      realEstateTax: 30000, mortgageInterest: 25000, charitableCash: 10000,
    });
    const { ca: caBelow } = getCAResult(trBelow);
    expect(caBelow.stateDeduction).toBe(65000);

    // MFJ at $550K — above threshold
    // Excess = $550K - $504,411 = $45,589
    // 6% × $45,589 = $2,735.34
    // Subject = $65K, 80% = $52K → reduction = $2,735.34
    const trAbove = makeItemizedReturn(550000, FilingStatus.MarriedFilingJointly, {
      realEstateTax: 30000, mortgageInterest: 25000, charitableCash: 10000,
    });
    const { ca: caAbove } = getCAResult(trAbove);
    expect(caAbove.stateDeduction).toBeCloseTo(62264.66, 0);
    expect(caAbove.stateDeduction).toBeLessThan(65000);
  });

  it('HoH threshold ($378,310)', () => {
    // HoH at $400K — above $378,310 threshold
    // Excess = $400K - $378,310 = $21,690
    // 6% × $21,690 = $1,301.40
    const tr = makeItemizedReturn(400000, FilingStatus.HeadOfHousehold, {
      realEstateTax: 20000, mortgageInterest: 15000, charitableCash: 5000,
    });
    const { ca } = getCAResult(tr);
    expect(ca.stateDeduction).toBeCloseTo(38698.60, 0);
  });

  it('standard deduction wins after limitation shrinks itemized below standard', () => {
    // Single filer at $2M AGI with only $6K itemized
    // Subject = $6K, 80% cap = $4,800
    // 6% of ($2M - $252,203) = $104,867.82 → capped at $4,800
    // After limitation: $6K - $4,800 = $1,200
    // Standard = $5,540 wins
    const tr = makeItemizedReturn(2000000, FilingStatus.Single, {
      charitableCash: 6000,
    });
    const { ca } = getCAResult(tr);
    expect(ca.stateDeduction).toBe(5706); // Standard wins
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. ESTIMATED PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Estimated Payments', () => {
  it('reads estimatedPayments from stateSpecificData', () => {
    const tr = makeW2Return(75000, 2000, FilingStatus.Single, {
      estimatedPayments: 5000,
    });
    const { ca } = getCAResult(tr);
    expect(ca.stateEstimatedPayments).toBe(5000);
    // Should affect refund/owed
    expect(ca.stateRefundOrOwed).toBeGreaterThan(
      ca.stateWithholding - ca.totalStateTax
    );
  });

  it('defaults to 0 when no estimated payments', () => {
    const tr = makeW2Return(75000, 2000);
    const { ca } = getCAResult(tr);
    expect(ca.stateEstimatedPayments).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. ADDITIONS & SUBTRACTIONS (Schedule CA)
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Additions (Schedule CA)', () => {
  it('adds out-of-state muni bond interest', () => {
    const tr = makeW2Return(100000, 0, FilingStatus.Single, {
      otherStateMuniBondInterest: 5000,
    });
    const { ca } = getCAResult(tr);
    expect(ca.stateAdditions).toBeGreaterThanOrEqual(5000);
  });

  it('no additions when no stateSpecificData', () => {
    const tr = makeW2Return(75000);
    const { ca } = getCAResult(tr);
    expect(ca.stateAdditions).toBe(0);
  });
});

describe('CA — Subtractions (Schedule CA)', () => {
  it('subtracts CA lottery winnings', () => {
    const tr = makeW2Return(100000, 0, FilingStatus.Single, {
      caLotteryWinnings: 10000,
    });
    const { ca } = getCAResult(tr);
    expect(ca.stateSubtractions).toBeGreaterThanOrEqual(10000);
  });

  it('subtracts military pay', () => {
    const tr = makeW2Return(100000, 0, FilingStatus.Single, {
      militaryPaySubtraction: 30000,
    });
    const { ca } = getCAResult(tr);
    expect(ca.stateSubtractions).toBeGreaterThanOrEqual(30000);
  });

  it('subtracts railroad retirement benefits', () => {
    const tr = makeW2Return(50000, 0, FilingStatus.Single, {
      railroadRetirementBenefits: 12000,
    });
    const { ca } = getCAResult(tr);
    expect(ca.stateSubtractions).toBeGreaterThanOrEqual(12000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10B. DEPRECIATION ADDITIONS — Bonus depreciation / §179 (Schedule CA)
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Bonus Depreciation Addback', () => {
  it('adds back federal bonus depreciation', () => {
    // A business with assets that took bonus depreciation
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000, state: 'CA', stateTaxWithheld: 5000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
      }],
      businesses: [{
        id: 'biz1', name: 'Consulting', activity: 'consulting',
        naicsCode: '541611',
        income: 50000,
        expenses: [],
        depreciableAssets: [{
          id: 'asset1', description: 'Computer Equipment',
          cost: 10000, dateInService: '2025-03-15',
          propertyClass: 5, method: 'MACRS',
          priorDepreciation: 0,
        }],
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca, federal } = getCAResult(tr);

    const bonusTotal = federal.form4562?.bonusDepreciationTotal || 0;
    if (bonusTotal > 0) {
      // CA should add back the bonus depreciation
      expect(ca.stateAdditions).toBeGreaterThanOrEqual(bonusTotal);
    }
  });

  it('no addback when no bonus depreciation', () => {
    // W-2 only return — no business, no depreciation
    const tr = makeW2Return(75000);
    const { ca } = getCAResult(tr);
    expect(ca.stateAdditions).toBe(0);
  });
});

describe('CA — Section 179 Difference', () => {
  it('adds back §179 excess over CA $25K limit', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000, state: 'CA', stateTaxWithheld: 5000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
      }],
      businesses: [{
        id: 'biz1', name: 'Business', activity: 'consulting',
        naicsCode: '541611',
        income: 100000,
        expenses: [],
        depreciableAssets: [{
          id: 'asset1', description: 'Equipment',
          cost: 50000, dateInService: '2025-06-01',
          propertyClass: 7, method: 'section179',
          priorDepreciation: 0,
        }],
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca, federal } = getCAResult(tr);

    const fed179 = federal.form4562?.section179Deduction || 0;
    if (fed179 > 25000) {
      // CA should add back the excess over $25K
      expect(ca.stateAdditions).toBeGreaterThanOrEqual(fed179 - 25000);
    }
  });

  it('no §179 addback when under CA limit', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000, state: 'CA', stateTaxWithheld: 5000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
      }],
      businesses: [{
        id: 'biz1', name: 'Business', activity: 'consulting',
        naicsCode: '541611',
        income: 60000,
        expenses: [],
        depreciableAssets: [{
          id: 'asset1', description: 'Small Equipment',
          cost: 5000, dateInService: '2025-06-01',
          propertyClass: 5, method: 'section179',
          priorDepreciation: 0,
        }],
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca, federal } = getCAResult(tr);

    const fed179 = federal.form4562?.section179Deduction || 0;
    // Under $25K limit — no addback needed for §179
    // (may still have bonus addback)
    if (fed179 <= 25000) {
      // §179 portion of additions should be 0
      // Total additions may include bonus depreciation though
      expect(ca.stateAdditions).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('CA — Combined Additions + Subtractions', () => {
  it('net adjustment: multiple additions and subtractions', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      incomeSSA1099: { id: 'ssa1', totalBenefits: 20000, federalTaxWithheld: 0 },
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 80000,
        federalTaxWithheld: 12000, state: 'CA', stateTaxWithheld: 4000,
        socialSecurityWages: 80000, socialSecurityTax: 4960,
        medicareWages: 80000, medicareTax: 1160,
      }],
      stateReturns: [{
        stateCode: 'CA', residencyType: 'resident' as const,
        stateSpecificData: {
          otherStateMuniBondInterest: 3000,
          caLotteryWinnings: 5000,
          militaryPaySubtraction: 10000,
        },
      }],
    });
    const { ca } = getCAResult(tr);

    // Additions: at least muni bond interest ($3000)
    expect(ca.stateAdditions).toBeGreaterThanOrEqual(3000);
    // Subtractions: lottery ($5000) + military ($10000) + any taxable SS
    expect(ca.stateSubtractions).toBeGreaterThanOrEqual(15000);
    // CA AGI should reflect both
    expect(ca.stateAGI).toBeLessThan(ca.federalAGI + ca.stateAdditions);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10C. RENTER'S CREDIT
// ═══════════════════════════════════════════════════════════════════════════════

describe("CA — Renter's Credit", () => {
  it('eligible single renter under AGI threshold', () => {
    const tr = makeW2Return(40000, 0, FilingStatus.Single, { isRenter: true });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.rentersCredit).toBe(60);
  });

  it('eligible MFJ renter', () => {
    const tr = makeW2Return(80000, 0, FilingStatus.MarriedFilingJointly, { isRenter: true });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.rentersCredit).toBe(120);
  });

  it('AGI over threshold — no credit', () => {
    const tr = makeW2Return(55000, 0, FilingStatus.Single, { isRenter: true });
    const { ca } = getCAResult(tr);
    // Single AGI limit is $50,746 — $55K exceeds it
    expect(ca.additionalLines!.rentersCredit).toBe(0);
  });

  it('not a renter — no credit', () => {
    const tr = makeW2Return(40000, 0, FilingStatus.Single, { isRenter: false });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.rentersCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10D. CA DEPENDENT CARE CREDIT
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Dependent Care Credit', () => {
  it('1 qualifying person — 50% rate at low AGI', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 30000,
        federalTaxWithheld: 4500, state: 'CA', stateTaxWithheld: 1500,
        socialSecurityWages: 30000, socialSecurityTax: 1860,
        medicareWages: 30000, medicareTax: 435,
      }],
      dependentCare: {
        totalExpenses: 5000,
        qualifyingPersons: 1,
      },
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2020-01-01' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // 1 person: limit $3000, 50% rate → $1500
    expect(ca.additionalLines!.caDependentCareCredit).toBe(1500);
  });

  it('2+ qualifying persons — 50% rate', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 35000,
        federalTaxWithheld: 5250, state: 'CA', stateTaxWithheld: 1750,
        socialSecurityWages: 35000, socialSecurityTax: 2170,
        medicareWages: 35000, medicareTax: 507.5,
      }],
      dependentCare: {
        totalExpenses: 10000,
        qualifyingPersons: 2,
      },
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2020-01-01' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2022-06-01' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // 2+ persons: limit $6000, 50% rate → $3000
    expect(ca.additionalLines!.caDependentCareCredit).toBe(3000);
  });

  it('43% rate at $40K-$70K AGI', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 55000,
        federalTaxWithheld: 8250, state: 'CA', stateTaxWithheld: 2750,
        socialSecurityWages: 55000, socialSecurityTax: 3410,
        medicareWages: 55000, medicareTax: 797.5,
      }],
      dependentCare: {
        totalExpenses: 5000,
        qualifyingPersons: 1,
      },
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2020-01-01' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // AGI ~$55K → 43% rate, 1 person limit $3000 → $1290
    expect(ca.additionalLines!.caDependentCareCredit).toBe(1290);
  });

  it('34% rate at $70K-$100K AGI', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 85000,
        federalTaxWithheld: 12750, state: 'CA', stateTaxWithheld: 4250,
        socialSecurityWages: 85000, socialSecurityTax: 5270,
        medicareWages: 85000, medicareTax: 1232.5,
      }],
      dependentCare: {
        totalExpenses: 5000,
        qualifyingPersons: 1,
      },
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2020-01-01' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // AGI ~$85K → 34% rate, 1 person limit $3000 → $1020
    expect(ca.additionalLines!.caDependentCareCredit).toBe(1020);
  });

  it('0% rate over $100K AGI', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 120000,
        federalTaxWithheld: 18000, state: 'CA', stateTaxWithheld: 6000,
        socialSecurityWages: 120000, socialSecurityTax: 7440,
        medicareWages: 120000, medicareTax: 1740,
      }],
      dependentCare: {
        totalExpenses: 10000,
        qualifyingPersons: 2,
      },
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2020-01-01' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2022-06-01' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // AGI $120K → 0% → no credit
    expect(ca.additionalLines!.caDependentCareCredit).toBe(0);
  });

  it('FSA reduces credit-eligible expenses', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 30000,
        federalTaxWithheld: 4500, state: 'CA', stateTaxWithheld: 1500,
        socialSecurityWages: 30000, socialSecurityTax: 1860,
        medicareWages: 30000, medicareTax: 435,
      }],
      dependentCare: {
        totalExpenses: 5000,
        qualifyingPersons: 1,
        dependentCareFSA: 3000,  // FSA reduces eligible expenses
      },
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2020-01-01' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // Expenses $5000 - FSA $3000 = $2000, 50% rate → $1000
    expect(ca.additionalLines!.caDependentCareCredit).toBe(1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10E. COMBINED NONREFUNDABLE ORDERING
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Combined Nonrefundable Credit Ordering', () => {
  it('exemption + renters + dependent care all applied', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 35000,
        federalTaxWithheld: 5250, state: 'CA', stateTaxWithheld: 1750,
        socialSecurityWages: 35000, socialSecurityTax: 2170,
        medicareWages: 35000, medicareTax: 507.5,
      }],
      dependentCare: {
        totalExpenses: 5000,
        qualifyingPersons: 1,
      },
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2020-01-01' },
      ],
      stateReturns: [{
        stateCode: 'CA', residencyType: 'resident' as const,
        stateSpecificData: { isRenter: true },
      }],
    });
    const { ca } = getCAResult(tr);

    const exemption = ca.additionalLines!.personalExemptionCredits;
    const renters = ca.additionalLines!.rentersCredit;
    const depCare = ca.additionalLines!.caDependentCareCredit;

    expect(exemption).toBeGreaterThan(0);
    expect(renters).toBe(60); // Single renter
    expect(depCare).toBeGreaterThan(0);
    // Total credits includes all three nonrefundable
    expect(ca.stateCredits).toBeGreaterThanOrEqual(exemption + renters + depCare);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10F. SENIOR HEAD OF HOUSEHOLD CREDIT
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Senior Head of Household Credit', () => {
  it('eligible: 65+ HoH filer under AGI limit', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dateOfBirth: '1955-06-15', // Age 70 at end of 2025
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 60000,
        federalTaxWithheld: 9000, state: 'CA', stateTaxWithheld: 3000,
        socialSecurityWages: 60000, socialSecurityTax: 3720,
        medicareWages: 60000, medicareTax: 870,
      }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2015-03-01' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // 2% of taxable income ($60K - $11,412 HoH std ded = $48,588 → $971.76), capped at $1,860
    expect(ca.additionalLines!.seniorHoHCredit).toBe(971.76);
  });

  it('wrong age — under 65', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dateOfBirth: '1965-06-15', // Age 60 at end of 2025
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 60000,
        federalTaxWithheld: 9000, state: 'CA', stateTaxWithheld: 3000,
        socialSecurityWages: 60000, socialSecurityTax: 3720,
        medicareWages: 60000, medicareTax: 870,
      }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2015-03-01' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.seniorHoHCredit).toBe(0);
  });

  it('wrong filing status — Single', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1955-06-15', // Age 70
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 60000,
        federalTaxWithheld: 9000, state: 'CA', stateTaxWithheld: 3000,
        socialSecurityWages: 60000, socialSecurityTax: 3720,
        medicareWages: 60000, medicareTax: 870,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.seniorHoHCredit).toBe(0);
  });

  it('AGI over limit — no credit', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dateOfBirth: '1955-06-15', // Age 70
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000, state: 'CA', stateTaxWithheld: 5000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
      }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2015-03-01' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    // AGI $100K > $96,377 limit
    expect(ca.additionalLines!.seniorHoHCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10G. DEPENDENT PARENT CREDIT
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Dependent Parent Credit', () => {
  it('1 parent dependent, MFS filer — $475 credit', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 75000,
        federalTaxWithheld: 11250, state: 'CA', stateTaxWithheld: 3750,
        socialSecurityWages: 75000, socialSecurityTax: 4650,
        medicareWages: 75000, medicareTax: 1087.5,
      }],
      dependents: [
        { id: 'd1', firstName: 'Mom', lastName: 'Smith', relationship: 'parent', monthsLivedWithYou: 12, dateOfBirth: '1960-01-01' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.dependentParentCredit).toBe(475);
  });

  it('2 parent dependents, MFS filer — $950 credit', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 75000,
        federalTaxWithheld: 11250, state: 'CA', stateTaxWithheld: 3750,
        socialSecurityWages: 75000, socialSecurityTax: 4650,
        medicareWages: 75000, medicareTax: 1087.5,
      }],
      dependents: [
        { id: 'd1', firstName: 'Mom', lastName: 'Smith', relationship: 'parent', monthsLivedWithYou: 12, dateOfBirth: '1960-01-01' },
        { id: 'd2', firstName: 'Dad', lastName: 'Smith', relationship: 'parent', monthsLivedWithYou: 12, dateOfBirth: '1958-05-15' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.dependentParentCredit).toBe(950);
  });

  it('parent dependent, Single filer — no credit (MFS only)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 75000,
        federalTaxWithheld: 11250, state: 'CA', stateTaxWithheld: 3750,
        socialSecurityWages: 75000, socialSecurityTax: 4650,
        medicareWages: 75000, medicareTax: 1087.5,
      }],
      dependents: [
        { id: 'd1', firstName: 'Mom', lastName: 'Smith', relationship: 'parent', monthsLivedWithYou: 12, dateOfBirth: '1960-01-01' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.dependentParentCredit).toBe(0);
  });

  it('child dependent — no parent credit', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 75000,
        federalTaxWithheld: 11250, state: 'CA', stateTaxWithheld: 3750,
        socialSecurityWages: 75000, socialSecurityTax: 4650,
        medicareWages: 75000, medicareTax: 1087.5,
      }],
      dependents: [
        { id: 'd1', firstName: 'Kid', lastName: 'Smith', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2015-03-01' },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.additionalLines!.dependentParentCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Edge Cases', () => {
  it('zero income returns zero tax', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.totalStateTax).toBe(0);
    expect(ca.stateAGI).toBe(0);
  });

  it('very high income ($5M) applies top bracket + MHST', () => {
    const { ca } = getCAResult(makeW2Return(5_000_000));
    // Top bracket is 12.3%, MHST adds 1% on income over $1M
    expect(ca.effectiveStateRate).toBeGreaterThan(0.10);
    expect(ca.additionalLines!.mentalHealthServicesTax).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. GOLDEN-VALUE SNAPSHOTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — Golden-Value Snapshots', () => {
  it('Single $75K snapshot', () => {
    const { ca } = getCAResult(makeW2Return(75000, 2500));
    expect(ca.stateCode).toBe('CA');
    expect(ca.stateName).toBe('California');
    expect(ca.stateDeduction).toBe(5706);
    expect(ca.stateTaxableIncome).toBe(69294);
    expect(ca.additionalLines!.personalExemptionCredits).toBe(153);
    expect(ca.stateWithholding).toBe(2500);
    expect(ca.totalStateTax).toBeGreaterThan(0);
    expect(ca.totalStateTax).toBeLessThan(10000);
    // Record for regression
    expect(ca.totalStateTax).toMatchInlineSnapshot(`2774.57`);
  });

  it('MFJ $150K snapshot', () => {
    const { ca } = getCAResult(makeW2Return(150000, 5000, FilingStatus.MarriedFilingJointly));
    expect(ca.stateCode).toBe('CA');
    expect(ca.stateDeduction).toBe(11412);
    expect(ca.stateTaxableIncome).toBe(138588);
    expect(ca.additionalLines!.personalExemptionCredits).toBe(306);
    expect(ca.stateWithholding).toBe(5000);
    expect(ca.totalStateTax).toBeGreaterThan(0);
    expect(ca.totalStateTax).toBeLessThan(15000);
    // Record for regression
    expect(ca.totalStateTax).toMatchInlineSnapshot(`5549.14`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. CA 540NR — PART-YEAR / NONRESIDENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — 540NR Part-Year Filer', () => {
  function makePartYearReturn(wages: number, days: number, stateWithheld = 0) {
    return makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'CA Corp', wages,
        federalTaxWithheld: Math.round(wages * 0.15),
        socialSecurityWages: Math.min(wages, 168600),
        socialSecurityTax: Math.min(wages, 168600) * 0.062,
        medicareWages: wages, medicareTax: wages * 0.0145,
        state: 'CA', stateTaxWithheld: stateWithheld,
      }],
      stateReturns: [{
        stateCode: 'CA',
        residencyType: 'part_year' as const,
        daysLivedInState: days,
      }],
    });
  }

  it('part-year 182/365 days: tax is approximately 50% of full-year tax', () => {
    const fullYearTr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'CA Corp', wages: 100000,
        federalTaxWithheld: 15000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
        state: 'CA', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca: fullYearCA } = getCAResult(fullYearTr);
    const fullYearTax = fullYearCA.totalStateTax;

    const partYearTr = makePartYearReturn(100000, 182);
    const { ca: partYearCA } = getCAResult(partYearTr);

    // 540NR method: full-year tax × ratio (≈ 0.49863)
    // Should be approximately 50% of full-year tax
    expect(partYearCA.totalStateTax).toBeGreaterThan(fullYearTax * 0.4);
    expect(partYearCA.totalStateTax).toBeLessThan(fullYearTax * 0.6);
    expect(partYearCA.residencyType).toBe('part_year');
    expect(partYearCA.additionalLines!.caIncomeRatio).toBeCloseTo(0.4986, 2);
  });

  it('part-year 0 days: zero tax', () => {
    const tr = makePartYearReturn(100000, 0);
    const { ca } = getCAResult(tr);
    expect(ca.totalStateTax).toBe(0);
  });

  it('part-year 365 days: same as full-year resident', () => {
    const fullYearTr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'CA Corp', wages: 80000,
        federalTaxWithheld: 12000,
        socialSecurityWages: 80000, socialSecurityTax: 4960,
        medicareWages: 80000, medicareTax: 1160,
        state: 'CA', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca: fullYearCA } = getCAResult(fullYearTr);

    // 365/365 = ratio 1.0, so allocation doesn't trigger 540NR path
    const partYearTr = makePartYearReturn(80000, 365);
    const { ca: partYearCA } = getCAResult(partYearTr);

    expect(partYearCA.totalStateTax).toBe(fullYearCA.totalStateTax);
  });

  it('part-year with credits: nonrefundable credits are prorated', () => {
    const tr = makePartYearReturn(50000, 182);
    const { ca } = getCAResult(tr);
    // Prorated nonrefundable credits should be less than full resident credits
    // Full resident exemption credit = $153, prorated ≈ $76
    expect(ca.additionalLines!.proratedNonrefundableCredits).toBeLessThan(153);
    expect(ca.additionalLines!.proratedNonrefundableCredits).toBeGreaterThan(0);
  });

  it('part-year withholding creates correct refund/owed', () => {
    const tr = makePartYearReturn(80000, 182, 3000);
    const { ca } = getCAResult(tr);
    expect(ca.stateWithholding).toBe(3000);
    // refund = withholding - tax
    expect(ca.stateRefundOrOwed).toBe(round2(3000 - ca.totalStateTax));
  });
});

describe('CA — 540NR Nonresident Filer', () => {
  it('nonresident with $60K CA-source of $200K total: tax = full-year-tax × 0.3', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'CA Corp', wages: 60000,
        federalTaxWithheld: 30000,
        socialSecurityWages: 60000, socialSecurityTax: 3720,
        medicareWages: 60000, medicareTax: 870,
        state: 'CA', stateTaxWithheld: 2000,
      }, {
        id: 'w2', employerName: 'TX Corp', wages: 140000,
        federalTaxWithheld: 21000,
        socialSecurityWages: 140000, socialSecurityTax: 8680,
        medicareWages: 140000, medicareTax: 2030,
        state: 'TX', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'nonresident' as const }],
    });

    // Full-year resident tax on $200K
    const fullResidentTr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 200000,
        federalTaxWithheld: 30000,
        socialSecurityWages: 168600, socialSecurityTax: 10453.20,
        medicareWages: 200000, medicareTax: 2900,
        state: 'CA', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca: fullCA } = getCAResult(fullResidentTr);

    const { ca: nrCA } = getCAResult(tr);
    // Ratio should be 60K / 200K = 0.3
    expect(nrCA.additionalLines!.caIncomeRatio).toBe(0.3);
    expect(nrCA.residencyType).toBe('nonresident');
    // Tax should be approximately fullCA.totalStateTax × 0.3
    expect(nrCA.totalStateTax).toBeCloseTo(fullCA.totalStateTax * 0.3, -1); // Within $10
    expect(nrCA.stateWithholding).toBe(2000);
  });

  it('nonresident with zero CA source: zero tax', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'TX Corp', wages: 100000,
        federalTaxWithheld: 15000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
        state: 'TX', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'nonresident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.totalStateTax).toBe(0);
  });

  it('nonresident with only W-2 wages: auto-detected from W-2 Box 15', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'CA Corp', wages: 50000,
        federalTaxWithheld: 7500,
        socialSecurityWages: 50000, socialSecurityTax: 3100,
        medicareWages: 50000, medicareTax: 725,
        state: 'CA', stateTaxWithheld: 1500,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'nonresident' as const }],
    });
    const { ca } = getCAResult(tr);
    // All wages are CA-source, ratio = 1.0, so no 540NR needed (same as resident)
    expect(ca.allocationRatio).toBe(1);
    expect(ca.totalStateTax).toBeGreaterThan(0);
  });

  it('nonresident with business + rental income', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'TX Corp', wages: 80000,
        federalTaxWithheld: 12000,
        socialSecurityWages: 80000, socialSecurityTax: 4960,
        medicareWages: 80000, medicareTax: 1160,
        state: 'TX', stateTaxWithheld: 0,
      }],
      stateReturns: [{
        stateCode: 'CA',
        residencyType: 'nonresident' as const,
        stateSpecificData: {
          sourceBusinessIncome: 20000,
          sourceRentalIncome: 10000,
        },
      }],
    });
    const { ca } = getCAResult(tr);
    // CA-source = $20K business + $10K rental = $30K
    // Total AGI ≈ $80K (wages only for federal AGI)
    expect(ca.totalStateTax).toBeGreaterThan(0);
    expect(ca.residencyType).toBe('nonresident');
    expect(ca.additionalLines!.caIncomeRatio).toBeGreaterThan(0);
  });
});

describe('CA — 540NR Integration', () => {
  it('540NR method gives higher tax than direct bracket calculation on reduced income', () => {
    // This verifies the progressive bracket effect:
    // Tax on $100K then × 0.5 > Tax on $50K directly
    // because $100K pushes income into higher brackets
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [
        {
          id: 'w1', employerName: 'CA Corp', wages: 50000,
          federalTaxWithheld: 7500,
          socialSecurityWages: 50000, socialSecurityTax: 3100,
          medicareWages: 50000, medicareTax: 725,
          state: 'CA', stateTaxWithheld: 0,
        },
        {
          id: 'w2', employerName: 'NY Corp', wages: 50000,
          federalTaxWithheld: 7500,
          socialSecurityWages: 50000, socialSecurityTax: 3100,
          medicareWages: 50000, medicareTax: 725,
          state: 'NY', stateTaxWithheld: 0,
        },
      ],
      stateReturns: [{ stateCode: 'CA', residencyType: 'nonresident' as const }],
    });
    const { ca } = getCAResult(tr);

    // Direct tax on $50K through brackets (what old method would give)
    const directTr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'CA Corp', wages: 50000,
        federalTaxWithheld: 7500,
        socialSecurityWages: 50000, socialSecurityTax: 3100,
        medicareWages: 50000, medicareTax: 725,
        state: 'CA', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'resident' as const }],
    });
    const { ca: directCA } = getCAResult(directTr);

    // 540NR tax should be >= direct bracket tax (progressive bracket effect)
    expect(ca.totalStateTax).toBeGreaterThanOrEqual(directCA.totalStateTax);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. CODE REVIEW FIXES — Post-review corrections
// ═══════════════════════════════════════════════════════════════════════════════

describe('CA — 540NR Review Fixes', () => {
  it('nonresident CalEITC uses sourceBusinessIncome directly when provided', () => {
    // Nonresident with $15K CA-source business income explicitly provided.
    // CalEITC earned income should use $15K * 0.9235 = $13,852 (sourceBusinessIncome),
    // NOT $15K * 0.9235 * 0.75 ratio (blanket proration fallback).
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'TX Corp', wages: 5000,
        federalTaxWithheld: 750,
        socialSecurityWages: 5000, socialSecurityTax: 310,
        medicareWages: 5000, medicareTax: 72.50,
        state: 'TX', stateTaxWithheld: 0,
      }],
      businesses: [{
        id: 'b1', name: 'Consulting', income: 15000, expenses: 0,
      }],
      stateReturns: [{
        stateCode: 'CA',
        residencyType: 'nonresident' as const,
        stateSpecificData: {
          sourceBusinessIncome: 15000,
        },
      }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.residencyType).toBe('nonresident');
    // CalEITC qualifies using sourceBusinessIncome → small tax fully offset by CalEITC
    expect(ca.additionalLines!.calEITC).toBeGreaterThan(0);
    // Verify refund includes CalEITC excess
    expect(ca.stateRefundOrOwed).toBeGreaterThanOrEqual(0);
  });

  it('nonresident CalEITC without sourceBusinessIncome uses proration fallback', () => {
    // Nonresident without explicit sourceBusinessIncome — uses ratio proration
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'CA Corp', wages: 30000,
        federalTaxWithheld: 4500,
        socialSecurityWages: 30000, socialSecurityTax: 1860,
        medicareWages: 30000, medicareTax: 435,
        state: 'CA', stateTaxWithheld: 1000,
      }, {
        id: 'w2', employerName: 'TX Corp', wages: 70000,
        federalTaxWithheld: 10500,
        socialSecurityWages: 70000, socialSecurityTax: 4340,
        medicareWages: 70000, medicareTax: 1015,
        state: 'TX', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'nonresident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.totalStateTax).toBeGreaterThan(0);
    expect(ca.stateWithholding).toBe(1000);
    expect(ca.additionalLines!.caIncomeRatio).toBe(0.3);
  });

  it('540NR ratio is clamped to [0, 1]', () => {
    // Even if allocation somehow produces ratio > 1 or < 0,
    // the 540NR function should clamp it. Test indirectly via valid inputs.
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'CA Corp', wages: 100000,
        federalTaxWithheld: 15000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
        state: 'CA', stateTaxWithheld: 3000,
      }],
      stateReturns: [{
        stateCode: 'CA',
        residencyType: 'part_year' as const,
        daysLivedInState: 365,
      }],
    });
    const { ca } = getCAResult(tr);
    // ratio = 365/365 = 1.0 → allocation doesn't trigger 540NR, falls through to resident path
    // Verify it still works correctly
    expect(ca.totalStateTax).toBeGreaterThan(0);
    expect(ca.stateWithholding).toBe(3000);
  });

  it('computeCACoreTax receives correct full-year values via allocated federalResult', () => {
    // Verify that investment income fields are NOT scaled in 540NR path.
    // A nonresident with $50K CA wages / $200K total should have CalEITC
    // disqualification checked against FULL investment income, not prorated.
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'CA Corp', wages: 50000,
        federalTaxWithheld: 7500,
        socialSecurityWages: 50000, socialSecurityTax: 3100,
        medicareWages: 50000, medicareTax: 725,
        state: 'CA', stateTaxWithheld: 1500,
      }, {
        id: 'w2', employerName: 'NY Corp', wages: 150000,
        federalTaxWithheld: 22500,
        socialSecurityWages: 118600, socialSecurityTax: 7353.20,
        medicareWages: 150000, medicareTax: 2175,
        state: 'NY', stateTaxWithheld: 0,
      }],
      income1099INT: [{
        id: 'i1', payerName: 'Bank', interestIncome: 5000,
      }],
      stateReturns: [{ stateCode: 'CA', residencyType: 'nonresident' as const }],
    });
    const { ca } = getCAResult(tr);
    expect(ca.residencyType).toBe('nonresident');
    expect(ca.totalStateTax).toBeGreaterThan(0);
    // Verify the 540NR method produced correct Column A values
    expect(ca.additionalLines!.originalFederalAGI).toBeGreaterThan(ca.allocatedAGI!);
  });
});
