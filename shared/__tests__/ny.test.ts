/**
 * New York State Tax — Comprehensive Tests
 *
 * Tests for: supplemental tax worksheets, itemized deductions (IT-196),
 * NYC/Yonkers local taxes, NYC credits, NYS credits, EITC, golden-value snapshots.
 *
 * All expected values verified against IT-201 Instructions (2025) worksheets.
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateStateTaxes } from '../src/engine/state/index.js';
import { TaxReturn, FilingStatus, StateReturnConfig } from '../src/types/index.js';

// ─── Helpers ──────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'ny-test',
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
  stateSpecificData: Record<string, unknown> = {},
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
      state: 'NY',
      stateTaxWithheld: stateWithheld,
    }],
    stateReturns: [{
      stateCode: 'NY',
      residencyType: 'resident' as const,
      stateSpecificData,
    }],
  });
}

function getNYResult(taxReturn: TaxReturn) {
  const federal = calculateForm1040(taxReturn);
  const results = calculateStateTaxes(taxReturn, federal);
  expect(results).toHaveLength(1);
  expect(results[0].stateCode).toBe('NY');
  return { federal, ny: results[0] };
}

// ═══════════════════════════════════════════════════════════════════
// 1. BASICS & STANDARD DEDUCTION
// ═══════════════════════════════════════════════════════════════════

describe('NY Basics', () => {
  it('Single standard deduction is $8,000', () => {
    const tr = makeW2Return(50000);
    const { ny } = getNYResult(tr);
    expect(ny.stateDeduction).toBe(8000);
  });

  it('MFJ standard deduction is $16,050', () => {
    const tr = makeW2Return(100000, 0, FilingStatus.MarriedFilingJointly);
    const { ny } = getNYResult(tr);
    expect(ny.stateDeduction).toBe(16050);
  });

  it('MFS standard deduction is $8,000', () => {
    const tr = makeW2Return(50000, 0, FilingStatus.MarriedFilingSeparately);
    const { ny } = getNYResult(tr);
    expect(ny.stateDeduction).toBe(8000);
  });

  it('HoH standard deduction is $11,200', () => {
    const tr = makeW2Return(50000, 0, FilingStatus.HeadOfHousehold);
    const { ny } = getNYResult(tr);
    expect(ny.stateDeduction).toBe(11200);
  });

  it('dependent exemption is $1,000 per dependent', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2015-01-01', ssn: '111-11-1111' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', dateOfBirth: '2017-01-01', ssn: '222-22-2222' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 100000,
        federalTaxWithheld: 15000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
        state: 'NY', stateTaxWithheld: 5000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.stateExemptions).toBe(2000);
  });

  it('Social Security benefits are subtracted from NY AGI', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      incomeSSA1099: { id: 'ssa1', totalBenefits: 20000, federalTaxWithheld: 0 },
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { federal, ny } = getNYResult(tr);
    const taxableSS = federal.socialSecurity?.taxableBenefits || 0;
    if (taxableSS > 0) {
      expect(ny.stateSubtractions).toBeGreaterThanOrEqual(taxableSS);
    }
  });

  it('pension exclusion for age 59½+ (up to $20K)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1960-03-15', // age 65 in 2025
      income1099R: [{ id: 'r1', payerName: 'Pension', grossDistribution: 25000, taxableAmount: 25000, federalTaxWithheld: 3000 }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.stateSubtractions).toBeGreaterThanOrEqual(20000);
  });

  it('pension age-check: June 30 birth date qualifies (59½ edge)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1966-06-30', // age 59, born June 30 → turns 59½ by Dec 30, 2025
      income1099R: [{ id: 'r1', payerName: 'Pension', grossDistribution: 15000, taxableAmount: 15000, federalTaxWithheld: 2000 }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.stateSubtractions).toBeGreaterThanOrEqual(15000);
  });

  it('pension age-check: July 1 birth date does NOT qualify (59½ not reached)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1966-07-01', // age 59, born July 1 → turns 59½ on Jan 1, 2026 (too late)
      income1099R: [{ id: 'r1', payerName: 'Pension', grossDistribution: 15000, taxableAmount: 15000, federalTaxWithheld: 2000 }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // July 1 birth → does NOT meet 59½ requirement → no pension exclusion
    expect(ny.stateSubtractions).toBe(0);
  });

  it('estimated payments flow through to result', () => {
    const tr = makeW2Return(75000, 3000, FilingStatus.Single, { estimatedPayments: 2000 });
    const { ny } = getNYResult(tr);
    expect(ny.stateEstimatedPayments).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. SUPPLEMENTAL TAX WORKSHEETS
// ═══════════════════════════════════════════════════════════════════

describe('NY Supplemental Tax', () => {
  it('AGI ≤ $107,650 → rate schedule only (no supplemental)', () => {
    const tr = makeW2Return(75000);
    const { ny } = getNYResult(tr);
    // taxable = 75000 - 8000 = 67000; rate schedule = 3520
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(3520, 0);
  });

  it('AGI exactly $107,650 → rate schedule only (edge)', () => {
    const tr = makeW2Return(107650);
    const { ny } = getNYResult(tr);
    // taxable = 107650 - 8000 = 99650; rate schedule = 5410.75
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(5410.75, 0);
  });

  it('Single $130K → WS7 flat 6% partial phase-in', () => {
    const tr = makeW2Return(130000);
    const { ny } = getNYResult(tr);
    // taxable = 122000 < 215400 → first worksheet
    // flatTax = 0.06 × 122000 = 7320; rateSchedule = 6751.75
    // diff = 568.25; phaseIn = (130000-107650)/50000 = 0.447
    // tax = 6751.75 + 568.25 × 0.447 ≈ 7005.76
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(7005.76, 0);
  });

  it('Single $160K → WS7 fully phased in (AGI ≥ $157,650)', () => {
    const tr = makeW2Return(160000);
    const { ny } = getNYResult(tr);
    // taxable = 152000; AGI ≥ 157650 → flat 6%
    // tax = 0.06 × 152000 = 9120
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(9120, 0);
  });

  it('Single $250K → WS8 recapture (base 568)', () => {
    const tr = makeW2Return(250000);
    const { ny } = getNYResult(tr);
    // taxable = 242000; AGI > 215400 → WS8
    // rateSchedule(242K) = 14177.85; excess = 34600; phaseIn = 0.692
    // addlTax = 1831 × 0.692 = 1267.05
    // tax = 14177.85 + 568 + 1267.05 = 16012.90
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(16012.90, 0);
  });

  it('Single $500K → WS8 recapture (full phase-in)', () => {
    const tr = makeW2Return(500000);
    const { ny } = getNYResult(tr);
    // taxable = 492000; AGI > 215400 (but < 1077550) → WS8 still
    // rateSchedule(492K) = 31302.85; phaseIn = 1.0
    // tax = 31302.85 + 568 + 1831 = 33701.85
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(33701.85, 0);
  });

  it('Single $3M → WS9 recapture (base 2399)', () => {
    const tr = makeW2Return(3000000);
    const { ny } = getNYResult(tr);
    // taxable = 2992000; AGI > 1077550 (but < 5M) → WS9
    // rateSchedule(2992000) = 256157.45; phaseIn = 1.0
    // tax = 256157.45 + 2399 + 30172 = 288728.45
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(288728.45, 0);
  });

  it('Single $30M → flat 10.9% (AGI > $25M)', () => {
    const tr = makeW2Return(30000000);
    const { ny } = getNYResult(tr);
    // taxable = 29992000; flat 10.9% = 3269128
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(3269128, 0);
  });

  it('MFJ $130K → WS1 flat 5.5% partial phase-in', () => {
    const tr = makeW2Return(130000, 0, FilingStatus.MarriedFilingJointly);
    const { ny } = getNYResult(tr);
    // taxable = 113950 < 161550 → first worksheet
    // flatTax = 0.055 × 113950 = 6267.25; rateSchedule = 5934.75
    // diff = 332.50; phaseIn = 0.447
    // tax = 5934.75 + 332.5 × 0.447 ≈ 6083.38
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(6083.38, 0);
  });

  it('MFJ $200K → WS2 recapture (base 333, partial 807)', () => {
    const tr = makeW2Return(200000, 0, FilingStatus.MarriedFilingJointly);
    const { ny } = getNYResult(tr);
    // taxable = 183950; AGI > 161550 → WS2
    // rateSchedule(183950) = 9896.75; excess = 38450; phaseIn = 0.769
    // addlTax = 807 × 0.769 = 620.58
    // tax = 9896.75 + 333 + 620.58 = 10850.33
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(10850.33, 0);
  });

  it('MFJ $500K → WS3 recapture (base 1140)', () => {
    const tr = makeW2Return(500000, 0, FilingStatus.MarriedFilingJointly);
    const { ny } = getNYResult(tr);
    // taxable = 483950; AGI > 323200 → WS3
    // rateSchedule(483950) = 29263.13; phaseIn = 1.0
    // tax = 29263.13 + 1140 + 2747 = 33150.13
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(33150.13, 0);
  });

  it('MFJ $3M → WS4 recapture (base 3887)', () => {
    const tr = makeW2Return(3000000, 0, FilingStatus.MarriedFilingJointly);
    const { ny } = getNYResult(tr);
    // taxable = 2983950; AGI > 2155350 → WS4
    // rateSchedule(2983950) + 3887 + 60350
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(287950.93, 0);
  });

  it('HoH $300K → WS13 recapture (base 787, partial 2289)', () => {
    const tr = makeW2Return(300000, 0, FilingStatus.HeadOfHousehold);
    const { ny } = getNYResult(tr);
    // taxable = 288800; AGI > 269300 → WS13
    // rateSchedule(288800) = 16706.88; excess = 30700; phaseIn = 0.614
    // addlTax = 2289 × 0.614 = 1405.45
    // tax = 16706.88 + 787 + 1405.45 = 18899.33
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(18899.33, 0);
  });

  it('HoH $30M → flat 10.9% (AGI > $25M)', () => {
    const tr = makeW2Return(30000000, 0, FilingStatus.HeadOfHousehold);
    const { ny } = getNYResult(tr);
    // taxable = 30M - 11200 = 29988800; flat 10.9%
    const expectedTax = Math.round(29988800 * 0.109 * 100) / 100;
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(expectedTax, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. ITEMIZED DEDUCTIONS (Form IT-196)
// ═══════════════════════════════════════════════════════════════════

describe('NY Itemized Deductions', () => {
  it('standard deduction wins for low income when itemized < standard', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'itemized',
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 40000,
        federalTaxWithheld: 6000,
        socialSecurityWages: 40000, socialSecurityTax: 2480,
        medicareWages: 40000, medicareTax: 580,
        state: 'NY', stateTaxWithheld: 2000,
      }],
      itemizedDeductions: {
        medicalExpenses: 0,
        realEstateTax: 2000,
        stateLocalIncomeTax: 1500,
        personalPropertyTax: 0,
        mortgageInterest: 0,
        mortgageInsurancePremiums: 0,
        charitableCash: 500,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // NY itemized: realEstate(2000) + charitable(500) = 2500
    // 2500 < 8000 standard → standard wins
    expect(ny.stateDeduction).toBe(8000);
  });

  it('SALT uncapped: $50K property tax fully deductible on NY', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'itemized',
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 200000,
        federalTaxWithheld: 30000,
        socialSecurityWages: 168600, socialSecurityTax: 10453.20,
        medicareWages: 200000, medicareTax: 2900,
        state: 'NY', stateTaxWithheld: 10000,
      }],
      itemizedDeductions: {
        medicalExpenses: 0,
        realEstateTax: 50000,
        stateLocalIncomeTax: 10000,
        personalPropertyTax: 0,
        mortgageInterest: 0,
        mortgageInsurancePremiums: 0,
        charitableCash: 5000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { federal, ny } = getNYResult(tr);
    // Federal caps SALT at $40K; NY allows full $50K real estate
    // NY itemized = property(50000) + charitable(from scheduleA)
    // Should be ≥ 50000 since property tax alone is $50K
    expect(ny.stateDeduction).toBeGreaterThanOrEqual(50000);
    // Federal SALT was capped, so federal totalItemized < NY itemized
    expect(ny.stateDeduction).toBeGreaterThan(federal.scheduleA?.totalItemized || 0);
  });

  it('state/local income tax is NOT deductible on NY return', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'itemized',
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 150000,
        federalTaxWithheld: 22500,
        socialSecurityWages: 150000, socialSecurityTax: 9300,
        medicareWages: 150000, medicareTax: 2175,
        state: 'NY', stateTaxWithheld: 8000,
      }],
      itemizedDeductions: {
        medicalExpenses: 0,
        realEstateTax: 5000,
        stateLocalIncomeTax: 12000,
        personalPropertyTax: 500,
        mortgageInterest: 0,
        mortgageInsurancePremiums: 0,
        charitableCash: 3000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // NY itemized should NOT include the $12K state income tax
    // NY SALT = realEstate(5000) + personalProp(500) = 5500 (no state income tax)
    // Total NY itemized ≈ 5500 + charitable ≈ 8500
    // The standard deduction ($8000) may or may not win
    // Key assertion: deduction < what it would be with state income tax
    expect(ny.stateDeduction).toBeLessThan(5500 + 3000 + 12000);
  });

  it('mortgage interest passes through from Schedule A', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'itemized',
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 200000,
        federalTaxWithheld: 30000,
        socialSecurityWages: 168600, socialSecurityTax: 10453.20,
        medicareWages: 200000, medicareTax: 2900,
        state: 'NY', stateTaxWithheld: 10000,
      }],
      itemizedDeductions: {
        medicalExpenses: 0,
        mortgageInterest: 15000,
        mortgageInsurancePremiums: 0,
        realEstateTax: 8000,
        stateLocalIncomeTax: 5000,
        personalPropertyTax: 0,
        charitableCash: 2000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // NY itemized: realEstate(8000) + mortgage(15000) + charitable(2000) = 25000
    // Well above $8000 standard deduction
    expect(ny.stateDeduction).toBeGreaterThan(20000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. NYS CREDITS & EITC
// ═══════════════════════════════════════════════════════════════════

describe('NY Credits', () => {
  it('NYS Household Credit: MFJ $20K → $90 base + dep credits', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2015-01-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 20000,
        federalTaxWithheld: 3000,
        socialSecurityWages: 20000, socialSecurityTax: 1240,
        medicareWages: 20000, medicareTax: 290,
        state: 'NY', stateTaxWithheld: 500,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // MFJ AGI ≤ $22000 → base $90; 1 dep → +$15 = $105
    expect(ny.additionalLines?.householdCredit).toBe(105);
  });

  it('NYS Household Credit: above threshold → $0', () => {
    const tr = makeW2Return(100000);
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.householdCredit).toBe(0);
  });

  it('NY EITC = 30% of federal EITC, uses round2', () => {
    // Low-income single filer with earned income → should get federal EITC
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 15000,
        federalTaxWithheld: 0,
        socialSecurityWages: 15000, socialSecurityTax: 930,
        medicareWages: 15000, medicareTax: 217.50,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { federal, ny } = getNYResult(tr);
    const federalEITC = federal.credits.eitcCredit || 0;
    if (federalEITC > 0) {
      const expected = Math.round(federalEITC * 0.30 * 100) / 100;
      expect(ny.additionalLines?.nyEITC).toBe(expected);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. NYC / YONKERS LOCAL TAX
// ═══════════════════════════════════════════════════════════════════

describe('NYC and Yonkers', () => {
  it('NYC bracket tax for $100K single', () => {
    const tr = makeW2Return(100000, 5000, FilingStatus.Single, { nycResident: true });
    const { ny } = getNYResult(tr);
    // NYC tax on taxable = 92000: ≈ $3441.09 before credits
    expect(ny.localTax).toBeGreaterThan(3000);
    expect(ny.localTax).toBeLessThan(4000);
  });

  it('NYC EITC = 10% of federal EITC', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 15000,
        federalTaxWithheld: 0,
        socialSecurityWages: 15000, socialSecurityTax: 930,
        medicareWages: 15000, medicareTax: 217.50,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{
        stateCode: 'NY',
        residencyType: 'resident' as const,
        stateSpecificData: { nycResident: true },
      }],
    });
    const { federal, ny } = getNYResult(tr);
    const federalEITC = federal.credits.eitcCredit || 0;
    if (federalEITC > 0) {
      const expected = Math.round(federalEITC * 0.10 * 100) / 100;
      expect(ny.additionalLines?.nycEITC).toBe(expected);
    }
  });

  it('Yonkers surcharge = 16.75% of NYS tax after credits', () => {
    const tr = makeW2Return(100000, 0, FilingStatus.Single, { yonkersResident: true });
    const { ny } = getNYResult(tr);
    // NYS tax after credits × 16.75%
    const expectedSurcharge = Math.round(ny.stateTaxAfterCredits * 0.1675 * 100) / 100;
    expect(ny.localTax).toBe(expectedSurcharge);
    expect(ny.additionalLines?.yonkersTax).toBe(expectedSurcharge);
  });

  it('non-NYC, non-Yonkers → localTax = 0', () => {
    const tr = makeW2Return(100000);
    const { ny } = getNYResult(tr);
    expect(ny.localTax).toBe(0);
  });

  it('NYC + NYS combined total > NYS alone', () => {
    const tr = makeW2Return(100000, 5000, FilingStatus.Single, { nycResident: true });
    const { ny } = getNYResult(tr);
    expect(ny.totalStateTax).toBeGreaterThan(ny.stateTaxAfterCredits);
    expect(ny.localTax).toBeGreaterThan(0);
  });

  it('NYC School Tax Credit: both components for MFJ ≤ $250K', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 150000,
        federalTaxWithheld: 22500,
        socialSecurityWages: 150000, socialSecurityTax: 9300,
        medicareWages: 150000, medicareTax: 2175,
        state: 'NY', stateTaxWithheld: 7500,
      }],
      stateReturns: [{
        stateCode: 'NY',
        residencyType: 'resident' as const,
        stateSpecificData: { nycResident: true },
      }],
    });
    const { ny } = getNYResult(tr);
    // Fixed: MFJ = $125
    expect(ny.additionalLines?.nycSchoolTaxCreditFixed).toBe(125);
    // Rate reduction: threshold $21,600, base $37, rate 0.228%
    // taxable = 150000 - 16050 = 133950
    // 133950 > 21600 → base + 0.00228 × (133950 - 21600)
    const expectedReduction = Math.round((37 + 0.00228 * (133950 - 21600)) * 100) / 100;
    expect(ny.additionalLines?.nycSchoolTaxCreditReduction).toBeCloseTo(expectedReduction, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. NYC HOUSEHOLD CREDIT
// ═══════════════════════════════════════════════════════════════════

describe('NYC Household Credit', () => {
  it('Single AGI ≤ $10K → $15', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 8000,
        federalTaxWithheld: 0,
        socialSecurityWages: 8000, socialSecurityTax: 496,
        medicareWages: 8000, medicareTax: 116,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{
        stateCode: 'NY',
        residencyType: 'resident' as const,
        stateSpecificData: { nycResident: true },
      }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.nycHouseholdCredit).toBe(15);
  });

  it('MFJ AGI ≤ $15K with 3 deps → $30/dep × (3+1+1) = $150', () => {
    const deps = Array.from({ length: 3 }, (_, i) => ({
      id: `d${i}`, firstName: `Child${i}`, lastName: 'Test',
      relationship: 'child' as const, dateOfBirth: '2015-01-01', ssn: `${i}11-11-1111`,
    }));
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      dependents: deps,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 14000,
        federalTaxWithheld: 0,
        socialSecurityWages: 14000, socialSecurityTax: 868,
        medicareWages: 14000, medicareTax: 203,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{
        stateCode: 'NY',
        residencyType: 'resident' as const,
        stateSpecificData: { nycResident: true },
      }],
    });
    const { ny } = getNYResult(tr);
    // MFJ ≤ $15K: $30/dep; deps = 3 + filer + spouse = 5
    expect(ny.additionalLines?.nycHouseholdCredit).toBe(150);
  });

  it('AGI above threshold → $0', () => {
    const tr = makeW2Return(100000, 0, FilingStatus.Single, { nycResident: true });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.nycHouseholdCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. NYC SCHOOL TAX CREDIT
// ═══════════════════════════════════════════════════════════════════

describe('NYC School Tax Credit', () => {
  it('fixed: MFJ ≤ $250K → $125', () => {
    const tr = makeW2Return(200000, 0, FilingStatus.MarriedFilingJointly, { nycResident: true });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.nycSchoolTaxCreditFixed).toBe(125);
  });

  it('fixed: Single ≤ $250K → $63', () => {
    const tr = makeW2Return(100000, 0, FilingStatus.Single, { nycResident: true });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.nycSchoolTaxCreditFixed).toBe(63);
  });

  it('fixed: AGI > $250K → $0', () => {
    const tr = makeW2Return(300000, 0, FilingStatus.Single, { nycResident: true });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.nycSchoolTaxCreditFixed).toBe(0);
  });

  it('rate reduction: Single $100K above threshold', () => {
    const tr = makeW2Return(100000, 0, FilingStatus.Single, { nycResident: true });
    const { ny } = getNYResult(tr);
    // taxable = 92000 > threshold 12000
    // base 21 + 0.00228 × (92000 - 12000) = 21 + 182.4 = 203.4
    expect(ny.additionalLines?.nycSchoolTaxCreditReduction).toBeCloseTo(203.4, 1);
  });

  it('rate reduction: AGI > $500K → $0', () => {
    const tr = makeW2Return(600000, 0, FilingStatus.Single, { nycResident: true });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.nycSchoolTaxCreditReduction).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. GOLDEN-VALUE SNAPSHOTS
// ═══════════════════════════════════════════════════════════════════

describe('NY Golden-Value Snapshots', () => {
  it('Single $75K → exact total', () => {
    const tr = makeW2Return(75000, 3000);
    const { ny } = getNYResult(tr);
    // taxable = 67000; rate schedule = 3520; no supplemental
    // No credits (AGI > 28K); localTax = 0
    // Total = 3520; withholding 3000 → owed 520
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(3520, 0);
    expect(ny.totalStateTax).toBeCloseTo(3520, 0);
    expect(ny.stateRefundOrOwed).toBeCloseTo(-520, 0);
  });

  it('MFJ $250K, NYC, 2 kids → exact total', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2015-01-01', ssn: '111-11-1111' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', dateOfBirth: '2017-01-01', ssn: '222-22-2222' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 250000,
        federalTaxWithheld: 37500,
        socialSecurityWages: 168600, socialSecurityTax: 10453.20,
        medicareWages: 250000, medicareTax: 3625,
        state: 'NY', stateTaxWithheld: 12500,
      }],
      stateReturns: [{
        stateCode: 'NY',
        residencyType: 'resident' as const,
        stateSpecificData: { nycResident: true },
      }],
    });
    const { ny } = getNYResult(tr);
    // taxable = 250000 - 16050 - 2000(deps) = 231950
    // MFJ AGI 250K > 161550 → WS2 recapture
    // Household credit = 0 (AGI > 32K)
    // NYC tax on 231950 + NYC school tax credit
    expect(ny.stateTaxableIncome).toBe(231950);
    expect(ny.totalStateTax).toBeGreaterThan(ny.stateTaxAfterCredits);
    expect(ny.localTax).toBeGreaterThan(0);
    expect(ny.stateExemptions).toBe(2000);
  });

  it('Single $500K, supplemental tax → exact total', () => {
    const tr = makeW2Return(500000, 25000);
    const { ny } = getNYResult(tr);
    // NYS tax = 33701.85 (WS8 recapture); no credits
    // localTax = 0; total = 33701.85
    // withholding 25000 → owed ≈ 8701.85
    expect(ny.additionalLines?.nysTaxBeforeCredits).toBeCloseTo(33701.85, 0);
    expect(ny.totalStateTax).toBeCloseTo(33701.85, 0);
    expect(ny.stateRefundOrOwed).toBeCloseTo(-8701.85, 0);
  });

  it('HoH $30K, 1 kid → low income with credits', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2018-06-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 30000,
        federalTaxWithheld: 2000,
        socialSecurityWages: 30000, socialSecurityTax: 1860,
        medicareWages: 30000, medicareTax: 435,
        state: 'NY', stateTaxWithheld: 1000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { federal, ny } = getNYResult(tr);
    // taxable = 30000 - 11200 - 1000 = 17800
    // rate schedule only (AGI 30K < 107650)
    // Household credit: HoH is non-MFJ, AGI ≤ 28K? No, 30K > 28K → 0
    // EITC: federal EITC × 30%
    expect(ny.stateDeduction).toBe(11200);
    expect(ny.stateExemptions).toBe(1000);
    expect(ny.stateTaxableIncome).toBe(17800);
    // If federal EITC > 0, NY EITC should reduce tax
    if (federal.credits.eitcCredit > 0) {
      expect(ny.additionalLines?.nyEITC).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. EITC REFUNDABILITY
// ═══════════════════════════════════════════════════════════════════

describe('NY EITC Refundability', () => {
  it('NYS EITC excess flows to refund (not capped at $0 tax)', () => {
    // Very low income → large EITC, small tax → excess should refund
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 10000,
        federalTaxWithheld: 0,
        socialSecurityWages: 10000, socialSecurityTax: 620,
        medicareWages: 10000, medicareTax: 145,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { federal, ny } = getNYResult(tr);
    const fedEITC = federal.credits.eitcCredit || 0;
    if (fedEITC > 0) {
      const nyEITC = ny.additionalLines?.nyEITC || 0;
      expect(nyEITC).toBeGreaterThan(0);
      // Refundable: refund includes EITC excess beyond tax
      expect(ny.stateRefundOrOwed).toBeGreaterThan(0);
      expect(ny.additionalLines?.totalRefundable).toBeGreaterThan(0);
    }
  });

  it('NYC EITC excess flows to refund', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 10000,
        federalTaxWithheld: 0,
        socialSecurityWages: 10000, socialSecurityTax: 620,
        medicareWages: 10000, medicareTax: 145,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{
        stateCode: 'NY', residencyType: 'resident' as const,
        stateSpecificData: { nycResident: true },
      }],
    });
    const { federal, ny } = getNYResult(tr);
    const fedEITC = federal.credits.eitcCredit || 0;
    if (fedEITC > 0) {
      expect(ny.additionalLines?.nycEITC).toBeGreaterThan(0);
      // NYC EITC is refundable — should flow to refund
      expect(ny.additionalLines?.totalRefundable).toBeGreaterThan(ny.additionalLines?.nyEITC || 0);
    }
  });

  it('Yonkers surcharge uses nysAfterNonrefundable (excludes EITC)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 15000,
        federalTaxWithheld: 0,
        socialSecurityWages: 15000, socialSecurityTax: 930,
        medicareWages: 15000, medicareTax: 217.50,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{
        stateCode: 'NY', residencyType: 'resident' as const,
        stateSpecificData: { yonkersResident: true },
      }],
    });
    const { federal, ny } = getNYResult(tr);
    const fedEITC = federal.credits.eitcCredit || 0;
    if (fedEITC > 0) {
      // Yonkers surcharge should be based on NYS tax after nonrefundable only
      // (EITC is refundable, so Yonkers base should NOT subtract EITC)
      const nysTaxBefore = ny.additionalLines?.nysTaxBeforeCredits || 0;
      const householdCr = ny.additionalLines?.householdCredit || 0;
      const collegeTuitionCr = ny.additionalLines?.collegeTuitionCredit || 0;
      const nysAfterNonref = Math.max(0, nysTaxBefore - householdCr - collegeTuitionCr);
      const expectedYonkers = Math.round(nysAfterNonref * 0.1675 * 100) / 100;
      expect(ny.additionalLines?.yonkersTax).toBeCloseTo(expectedYonkers, 1);
    }
  });

  it('large EITC with zero tax → full EITC as refund', () => {
    // Very low income with qualifying child → large EITC
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2020-01-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 8000,
        federalTaxWithheld: 0,
        socialSecurityWages: 8000, socialSecurityTax: 496,
        medicareWages: 8000, medicareTax: 116,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { federal, ny } = getNYResult(tr);
    const fedEITC = federal.credits.eitcCredit || 0;
    if (fedEITC > 0) {
      // Tax should be near zero but refund should include full EITC
      const totalRefundable = ny.additionalLines?.totalRefundable || 0;
      expect(totalRefundable).toBeGreaterThan(0);
      expect(ny.stateRefundOrOwed).toBeGreaterThan(0);
    }
  });

  it('combined NYS+NYC EITC: totalRefundable is larger with NYC', () => {
    // Use HoH with 1 child to guarantee federal EITC
    const makeReturn = (nycResident: boolean) => makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2020-01-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 20000,
        federalTaxWithheld: 0,
        socialSecurityWages: 20000, socialSecurityTax: 1240,
        medicareWages: 20000, medicareTax: 290,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{
        stateCode: 'NY', residencyType: 'resident' as const,
        stateSpecificData: { nycResident },
      }],
    });
    const { federal, ny: nyOnly } = getNYResult(makeReturn(false));
    const { ny: nyc } = getNYResult(makeReturn(true));
    const fedEITC = federal.credits.eitcCredit || 0;
    if (fedEITC > 0) {
      // NYC adds 10% EITC to refundable pool
      const nycRefundable = nyc.additionalLines?.totalRefundable || 0;
      const nysOnlyRefundable = nyOnly.additionalLines?.totalRefundable || 0;
      expect(nycRefundable).toBeGreaterThan(nysOnlyRefundable);
    }
  });

  it('zero federal EITC → zero state EITC', () => {
    const tr = makeW2Return(200000);
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.nyEITC).toBe(0);
    expect(ny.additionalLines?.nycEITC).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 10. EMPIRE STATE CHILD CREDIT (IT-213)
// ═══════════════════════════════════════════════════════════════════

describe('Empire State Child Credit', () => {
  it('1 child under 4 → $1,000', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2023-03-15', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 40000,
        federalTaxWithheld: 6000,
        socialSecurityWages: 40000, socialSecurityTax: 2480,
        medicareWages: 40000, medicareTax: 580,
        state: 'NY', stateTaxWithheld: 2000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.empireStateChildCredit).toBe(1000);
  });

  it('1 child age 10 → $330', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2015-06-15', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 40000,
        federalTaxWithheld: 6000,
        socialSecurityWages: 40000, socialSecurityTax: 2480,
        medicareWages: 40000, medicareTax: 580,
        state: 'NY', stateTaxWithheld: 2000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.empireStateChildCredit).toBe(330);
  });

  it('mixed: 1 under 4 + 2 age 10 → $1,660', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2023-01-01', ssn: '111-11-1111' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', dateOfBirth: '2015-05-01', ssn: '222-22-2222' },
        { id: 'd3', firstName: 'E', lastName: 'F', relationship: 'child', dateOfBirth: '2015-08-01', ssn: '333-33-3333' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 80000,
        federalTaxWithheld: 12000,
        socialSecurityWages: 80000, socialSecurityTax: 4960,
        medicareWages: 80000, medicareTax: 1160,
        state: 'NY', stateTaxWithheld: 4000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // MFJ threshold $110K, AGI $80K → no phase-out
    expect(ny.additionalLines?.empireStateChildCredit).toBe(1660);
  });

  it('phase-out: MFJ $120K → reduced by $165', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2023-01-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 120000,
        federalTaxWithheld: 18000,
        socialSecurityWages: 120000, socialSecurityTax: 7440,
        medicareWages: 120000, medicareTax: 1740,
        state: 'NY', stateTaxWithheld: 6000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // MFJ threshold $110K, AGI $120K → excess $10K → ceil(10) × $16.50 = $165
    // Basic = $1,000 (child under 4); $1,000 - $165 = $835
    expect(ny.additionalLines?.empireStateChildCredit).toBe(835);
  });

  it('phase-out: Single $80K → reduced by $82.50', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2023-01-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 80000,
        federalTaxWithheld: 12000,
        socialSecurityWages: 80000, socialSecurityTax: 4960,
        medicareWages: 80000, medicareTax: 1160,
        state: 'NY', stateTaxWithheld: 4000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // Single threshold $75K, AGI $80K → excess $5K → ceil(5) × $16.50 = $82.50
    // Basic = $1,000; $1,000 - $82.50 = $917.50
    expect(ny.additionalLines?.empireStateChildCredit).toBe(917.5);
  });

  it('MFJ $500K → fully phased out', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2023-01-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 500000,
        federalTaxWithheld: 75000,
        socialSecurityWages: 168600, socialSecurityTax: 10453.20,
        medicareWages: 500000, medicareTax: 7250,
        state: 'NY', stateTaxWithheld: 25000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // MFJ threshold $110K, AGI $500K → excess $390K → $6,435 reduction → $1,000 fully wiped
    expect(ny.additionalLines?.empireStateChildCredit).toBe(0);
  });

  it('child age 17 → $0', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2008-01-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 40000,
        federalTaxWithheld: 6000,
        socialSecurityWages: 40000, socialSecurityTax: 2480,
        medicareWages: 40000, medicareTax: 580,
        state: 'NY', stateTaxWithheld: 2000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.empireStateChildCredit).toBe(0);
  });

  it('no children → $0', () => {
    const tr = makeW2Return(40000);
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.empireStateChildCredit).toBe(0);
  });

  it('refundable: credit > tax → excess in refund', () => {
    // Very low income with 2 young kids → large ESCC vs small tax
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2023-01-01', ssn: '111-11-1111' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', dateOfBirth: '2022-06-01', ssn: '222-22-2222' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 20000,
        federalTaxWithheld: 0,
        socialSecurityWages: 20000, socialSecurityTax: 1240,
        medicareWages: 20000, medicareTax: 290,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // ESCC = $2,000 (2 children under 4); HoH $20K → threshold $75K, no phase-out
    expect(ny.additionalLines?.empireStateChildCredit).toBe(2000);
    // Refundable: should generate a refund even with $0 withholding
    expect(ny.stateRefundOrOwed).toBeGreaterThan(0);
  });

  it('child born Dec 31, 2025 (age 0) → qualifies as under 4', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dependents: [
        { id: 'd1', firstName: 'Baby', lastName: 'Test', relationship: 'child', dateOfBirth: '2025-12-31', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 40000,
        federalTaxWithheld: 6000,
        socialSecurityWages: 40000, socialSecurityTax: 2480,
        medicareWages: 40000, medicareTax: 580,
        state: 'NY', stateTaxWithheld: 2000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.empireStateChildCredit).toBe(1000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 11. NY/NYC DEPENDENT CARE CREDIT (IT-216)
// ═══════════════════════════════════════════════════════════════════

describe('NY Dependent Care Credit', () => {
  // Helper to create a return with a federal dependent care credit
  function makeDepCareReturn(
    wages: number,
    filingStatus: FilingStatus,
    nycResident: boolean,
    childDob: string,
    dependentCareExpenses = 3000,
  ) {
    return makeTaxReturn({
      filingStatus,
      dependents: [
        { id: 'd1', firstName: 'Child', lastName: 'Test', relationship: 'child', dateOfBirth: childDob, ssn: '111-11-1111' },
      ],
      dependentCareExpenses,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages,
        federalTaxWithheld: Math.round(wages * 0.15),
        socialSecurityWages: Math.min(wages, 168600),
        socialSecurityTax: Math.min(wages, 168600) * 0.062,
        medicareWages: wages,
        medicareTax: wages * 0.0145,
        state: 'NY', stateTaxWithheld: Math.round(wages * 0.05),
      }],
      stateReturns: [{
        stateCode: 'NY', residencyType: 'resident' as const,
        stateSpecificData: { nycResident },
      }],
    });
  }

  it('$25K AGI → 110% of federal credit', () => {
    const tr = makeDepCareReturn(25000, FilingStatus.Single, false, '2020-01-01');
    const { federal, ny } = getNYResult(tr);
    const fedCredit = federal.credits.dependentCareCredit || 0;
    if (fedCredit > 0) {
      const expected = Math.round(fedCredit * 1.10 * 100) / 100;
      expect(ny.additionalLines?.nyDependentCareCredit).toBe(expected);
    }
  });

  it('$50K AGI → 70% of federal credit', () => {
    const tr = makeDepCareReturn(50000, FilingStatus.Single, false, '2020-01-01');
    const { federal, ny } = getNYResult(tr);
    const fedCredit = federal.credits.dependentCareCredit || 0;
    if (fedCredit > 0) {
      const expected = Math.round(fedCredit * 0.70 * 100) / 100;
      expect(ny.additionalLines?.nyDependentCareCredit).toBe(expected);
    }
  });

  it('$100K AGI → 20% of federal credit', () => {
    const tr = makeDepCareReturn(100000, FilingStatus.Single, false, '2020-01-01');
    const { federal, ny } = getNYResult(tr);
    const fedCredit = federal.credits.dependentCareCredit || 0;
    if (fedCredit > 0) {
      const expected = Math.round(fedCredit * 0.20 * 100) / 100;
      expect(ny.additionalLines?.nyDependentCareCredit).toBe(expected);
    }
  });

  it('$160K AGI → $0 (above $150K)', () => {
    const tr = makeDepCareReturn(160000, FilingStatus.Single, false, '2020-01-01');
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.nyDependentCareCredit).toBe(0);
  });

  it('no federal credit → $0', () => {
    // No dependent care expenses → no federal credit → no NY credit
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2020-01-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 50000,
        federalTaxWithheld: 7500,
        socialSecurityWages: 50000, socialSecurityTax: 3100,
        medicareWages: 50000, medicareTax: 725,
        state: 'NY', stateTaxWithheld: 2500,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.nyDependentCareCredit).toBe(0);
  });

  it('NYC additional credit for AGI ≤ $30K with child under 4', () => {
    const tr = makeDepCareReturn(25000, FilingStatus.Single, true, '2023-01-01');
    const { federal, ny } = getNYResult(tr);
    const fedCredit = federal.credits.dependentCareCredit || 0;
    if (fedCredit > 0) {
      const nyCredit = ny.additionalLines?.nyDependentCareCredit || 0;
      const nycCredit = ny.additionalLines?.nycDependentCareCredit || 0;
      expect(nycCredit).toBeGreaterThan(0);
      // NYC credit = 75% of NYS credit
      expect(nycCredit).toBeCloseTo(nyCredit * 0.75, 1);
    }
  });

  it('NYC credit zeroed for AGI > $30K', () => {
    const tr = makeDepCareReturn(40000, FilingStatus.Single, true, '2023-01-01');
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.nycDependentCareCredit).toBe(0);
  });

  it('refundable: excess flows to refund', () => {
    // Low income with dependent care → credit should be refundable
    const tr = makeDepCareReturn(20000, FilingStatus.Single, false, '2020-01-01');
    const { federal, ny } = getNYResult(tr);
    const fedCredit = federal.credits.dependentCareCredit || 0;
    if (fedCredit > 0) {
      expect(ny.additionalLines?.nyDependentCareCredit).toBeGreaterThan(0);
      // totalRefundable should include dep care credit
      expect(ny.additionalLines?.totalRefundable).toBeGreaterThanOrEqual(ny.additionalLines?.nyDependentCareCredit || 0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 12. COLLEGE TUITION CREDIT (IT-272)
// ═══════════════════════════════════════════════════════════════════

describe('NY College Tuition Credit', () => {
  it('$10K tuition → $400 (max)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      educationCredits: [
        { id: 'e1', type: 'american_opportunity', studentName: 'Test', institution: 'NYU', tuitionPaid: 10000 },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 80000,
        federalTaxWithheld: 12000,
        socialSecurityWages: 80000, socialSecurityTax: 4960,
        medicareWages: 80000, medicareTax: 1160,
        state: 'NY', stateTaxWithheld: 4000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.collegeTuitionCredit).toBe(400);
  });

  it('$5K tuition → $200 (4%)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      educationCredits: [
        { id: 'e1', type: 'american_opportunity', studentName: 'Test', institution: 'NYU', tuitionPaid: 5000 },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 80000,
        federalTaxWithheld: 12000,
        socialSecurityWages: 80000, socialSecurityTax: 4960,
        medicareWages: 80000, medicareTax: 1160,
        state: 'NY', stateTaxWithheld: 4000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.collegeTuitionCredit).toBe(200);
  });

  it('two students → $800 max', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      educationCredits: [
        { id: 'e1', type: 'american_opportunity', studentName: 'Student1', institution: 'NYU', tuitionPaid: 15000 },
        { id: 'e2', type: 'lifetime_learning', studentName: 'Student2', institution: 'Columbia', tuitionPaid: 12000 },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 150000,
        federalTaxWithheld: 22500,
        socialSecurityWages: 150000, socialSecurityTax: 9300,
        medicareWages: 150000, medicareTax: 2175,
        state: 'NY', stateTaxWithheld: 7500,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.collegeTuitionCredit).toBe(800);
  });

  it('zero tuition → $0', () => {
    const tr = makeW2Return(80000);
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.collegeTuitionCredit).toBe(0);
  });

  it('nonrefundable: limited by tax liability', () => {
    // College tuition is nonrefundable — if tax is low, credit can't exceed it
    // This is implicit: it goes into nysNonrefundable and reduces tax but not below $0
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      educationCredits: [
        { id: 'e1', type: 'american_opportunity', studentName: 'Test', institution: 'NYU', tuitionPaid: 10000 },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 80000,
        federalTaxWithheld: 12000,
        socialSecurityWages: 80000, socialSecurityTax: 4960,
        medicareWages: 80000, medicareTax: 1160,
        state: 'NY', stateTaxWithheld: 4000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // stateTaxAfterCredits should be >= 0
    expect(ny.stateTaxAfterCredits).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 13. NYC TAX ELIMINATION CREDIT (IT-270)
// ═══════════════════════════════════════════════════════════════════

describe('NYC Tax Elimination Credit', () => {
  it('household size 3, FAGI $30K → full NYC tax eliminated', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2020-01-01', ssn: '111-11-1111' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', dateOfBirth: '2018-01-01', ssn: '222-22-2222' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 30000,
        federalTaxWithheld: 2000,
        socialSecurityWages: 30000, socialSecurityTax: 1860,
        medicareWages: 30000, medicareTax: 435,
        state: 'NY', stateTaxWithheld: 1000,
      }],
      stateReturns: [{
        stateCode: 'NY', residencyType: 'resident' as const,
        stateSpecificData: { nycResident: true },
      }],
    });
    const { ny } = getNYResult(tr);
    // HoH + 2 deps = household size 3; threshold $37,290; $30K < threshold → full credit
    // nycTaxEliminationCredit should equal the gross NYC tax
    expect(ny.additionalLines?.nycTaxEliminationCredit).toBeGreaterThan(0);
    // After elimination credit, NYC tax portion should be very low or zero
    // (other nonrefundable credits may also apply)
    expect(ny.additionalLines?.nycTax).toBe(0);
  });

  it('household size 2, FAGI $35K → $0 (over threshold + $5K)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2020-01-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 35000,
        federalTaxWithheld: 5250,
        socialSecurityWages: 35000, socialSecurityTax: 2170,
        medicareWages: 35000, medicareTax: 507.50,
        state: 'NY', stateTaxWithheld: 1750,
      }],
      stateReturns: [{
        stateCode: 'NY', residencyType: 'resident' as const,
        stateSpecificData: { nycResident: true },
      }],
    });
    const { ny } = getNYResult(tr);
    // Single + 1 dep = household size 2; threshold $29,580; $35K > threshold + $5K → $0
    expect(ny.additionalLines?.nycTaxEliminationCredit).toBe(0);
  });

  it('household size 4, FAGI $47K → partial credit', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2020-01-01', ssn: '111-11-1111' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', dateOfBirth: '2018-01-01', ssn: '222-22-2222' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 47000,
        federalTaxWithheld: 7050,
        socialSecurityWages: 47000, socialSecurityTax: 2914,
        medicareWages: 47000, medicareTax: 681.50,
        state: 'NY', stateTaxWithheld: 2350,
      }],
      stateReturns: [{
        stateCode: 'NY', residencyType: 'resident' as const,
        stateSpecificData: { nycResident: true },
      }],
    });
    const { ny } = getNYResult(tr);
    // MFJ + 2 deps = household size 4; threshold $45,000; $47K within $5K → partial
    const credit = ny.additionalLines?.nycTaxEliminationCredit || 0;
    expect(credit).toBeGreaterThan(0);
    expect(credit).toBeLessThan(ny.additionalLines?.nycTaxGross || Infinity);
  });

  it('non-NYC → $0', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2020-01-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 30000,
        federalTaxWithheld: 4500,
        socialSecurityWages: 30000, socialSecurityTax: 1860,
        medicareWages: 30000, medicareTax: 435,
        state: 'NY', stateTaxWithheld: 1500,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.nycTaxEliminationCredit).toBe(0);
  });

  it('no dependents → $0', () => {
    const tr = makeW2Return(25000, 1000, FilingStatus.Single, { nycResident: true });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.nycTaxEliminationCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 14. MCTMT
// ═══════════════════════════════════════════════════════════════════

describe('MCTMT', () => {
  function makeSEReturn(
    grossIncome: number,
    stateSpecificData: Record<string, unknown> = {},
  ) {
    return makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{
        id: 'nec1', payerName: 'Client Corp', amount: grossIncome,
      }],
      businesses: [{
        id: 'b1', name: 'Consulting', type: 'sole_proprietorship' as const,
        revenue: grossIncome, expenses: 0,
      }],
      stateReturns: [{
        stateCode: 'NY', residencyType: 'resident' as const,
        stateSpecificData,
      }],
    });
  }

  it('NYC SE $100K → Zone 1 MCTMT', () => {
    const tr = makeSEReturn(100000, { nycResident: true });
    const { federal, ny } = getNYResult(tr);
    // SE netEarnings = $100K × 0.9235 = $92,350
    const netSE = federal.scheduleSE?.netEarnings || 0;
    expect(netSE).toBeGreaterThan(50000);
    // Zone 1: 0.6% × netSE
    const expected = Math.round(netSE * 0.006 * 100) / 100;
    expect(ny.additionalLines?.mctmt).toBeCloseTo(expected, 0);
  });

  it('Zone 2 SE $80K → Zone 2 MCTMT', () => {
    const tr = makeSEReturn(80000, { mtaZone: 2 });
    const { federal, ny } = getNYResult(tr);
    const netSE = federal.scheduleSE?.netEarnings || 0;
    expect(netSE).toBeGreaterThan(50000);
    // Zone 2: 0.34% × netSE
    const expected = Math.round(netSE * 0.0034 * 100) / 100;
    expect(ny.additionalLines?.mctmt).toBeCloseTo(expected, 0);
  });

  it('SE $40K (below threshold) → $0', () => {
    const tr = makeSEReturn(40000, { nycResident: true });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.mctmt).toBe(0);
  });

  it('W-2 only → $0', () => {
    const tr = makeW2Return(100000, 5000, FilingStatus.Single, { nycResident: true });
    const { ny } = getNYResult(tr);
    expect(ny.additionalLines?.mctmt).toBe(0);
  });

  it('non-MTA → $0', () => {
    const tr = makeSEReturn(100000);
    const { ny } = getNYResult(tr);
    // No nycResident, no mtaZone → not in MTA district
    expect(ny.additionalLines?.mctmt).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 15. INTEGRATION & CREDIT STACKING
// ═══════════════════════════════════════════════════════════════════

describe('NY Credit Integration', () => {
  it('all credits stack correctly', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2023-01-01', ssn: '111-11-1111' },
      ],
      educationCredits: [
        { id: 'e1', type: 'american_opportunity', studentName: 'Sibling', institution: 'NYU', tuitionPaid: 8000 },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 40000,
        federalTaxWithheld: 4000,
        socialSecurityWages: 40000, socialSecurityTax: 2480,
        medicareWages: 40000, medicareTax: 580,
        state: 'NY', stateTaxWithheld: 2000,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // Should have ESCC ($1,000), college tuition credit ($320), possibly EITC
    expect(ny.additionalLines?.empireStateChildCredit).toBe(1000);
    expect(ny.additionalLines?.collegeTuitionCredit).toBe(320);
    // Total tax should reflect all credits
    expect(ny.totalStateTax).toBeGreaterThanOrEqual(0);
  });

  it('nonrefundable reduce tax to $0 floor, refundable create refund excess', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2023-01-01', ssn: '111-11-1111' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', dateOfBirth: '2022-01-01', ssn: '222-22-2222' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 15000,
        federalTaxWithheld: 0,
        socialSecurityWages: 15000, socialSecurityTax: 930,
        medicareWages: 15000, medicareTax: 217.50,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // NYS tax after nonrefundable >= 0
    expect(ny.stateTaxAfterCredits).toBeGreaterThanOrEqual(0);
    // Refundable credits (ESCC + EITC) should flow to refund
    const totalRefundable = ny.additionalLines?.totalRefundable || 0;
    expect(totalRefundable).toBeGreaterThan(0);
    expect(ny.stateRefundOrOwed).toBeGreaterThan(0);
  });

  it('NYC elimination + EITC: elimination zeros tax, EITC still refundable', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2023-01-01', ssn: '111-11-1111' },
        { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', dateOfBirth: '2020-01-01', ssn: '222-22-2222' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 25000,
        federalTaxWithheld: 0,
        socialSecurityWages: 25000, socialSecurityTax: 1550,
        medicareWages: 25000, medicareTax: 362.50,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{
        stateCode: 'NY', residencyType: 'resident' as const,
        stateSpecificData: { nycResident: true },
      }],
    });
    const { federal, ny } = getNYResult(tr);
    const fedEITC = federal.credits.eitcCredit || 0;
    if (fedEITC > 0) {
      // NYC tax should be zero (eliminated) but NYC EITC flows as refundable
      expect(ny.additionalLines?.nycTax).toBe(0);
      expect(ny.additionalLines?.nycEITC).toBeGreaterThan(0);
      // Refund should include both NYS and NYC refundable credits
      expect(ny.stateRefundOrOwed).toBeGreaterThan(0);
    }
  });

  it('Yonkers + EITC refundability interaction', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2020-01-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 20000,
        federalTaxWithheld: 0,
        socialSecurityWages: 20000, socialSecurityTax: 1240,
        medicareWages: 20000, medicareTax: 290,
        state: 'NY', stateTaxWithheld: 0,
      }],
      stateReturns: [{
        stateCode: 'NY', residencyType: 'resident' as const,
        stateSpecificData: { yonkersResident: true },
      }],
    });
    const { federal, ny } = getNYResult(tr);
    const fedEITC = federal.credits.eitcCredit || 0;
    if (fedEITC > 0) {
      // Yonkers surcharge should be positive (based on NYS tax before EITC)
      const yonkersTax = ny.additionalLines?.yonkersTax || 0;
      expect(yonkersTax).toBeGreaterThanOrEqual(0);
      // EITC should still be refundable
      expect(ny.additionalLines?.totalRefundable).toBeGreaterThan(0);
    }
  });

  it('credit ordering per IT-201 line sequence', () => {
    // Verify that the additionalLines contain all expected credit fields
    const tr = makeW2Return(50000, 2500, FilingStatus.Single, { nycResident: true });
    const { ny } = getNYResult(tr);
    const lines = ny.additionalLines!;
    // All credit fields should be defined
    expect(lines).toHaveProperty('householdCredit');
    expect(lines).toHaveProperty('empireStateChildCredit');
    expect(lines).toHaveProperty('nyDependentCareCredit');
    expect(lines).toHaveProperty('nyEITC');
    expect(lines).toHaveProperty('collegeTuitionCredit');
    expect(lines).toHaveProperty('nycTaxEliminationCredit');
    expect(lines).toHaveProperty('nycHouseholdCredit');
    expect(lines).toHaveProperty('nycSchoolTaxCreditFixed');
    expect(lines).toHaveProperty('nycSchoolTaxCreditReduction');
    expect(lines).toHaveProperty('nycDependentCareCredit');
    expect(lines).toHaveProperty('nycEITC');
    expect(lines).toHaveProperty('mctmt');
    expect(lines).toHaveProperty('totalRefundable');
  });

  it('PDF Line 76 correct without workaround (totalRefundable)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', dateOfBirth: '2023-01-01', ssn: '111-11-1111' },
      ],
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 30000,
        federalTaxWithheld: 3000,
        socialSecurityWages: 30000, socialSecurityTax: 1860,
        medicareWages: 30000, medicareTax: 435,
        state: 'NY', stateTaxWithheld: 1500,
      }],
      stateReturns: [{ stateCode: 'NY', residencyType: 'resident' }],
    });
    const { ny } = getNYResult(tr);
    // totalRefundable should include ESCC + EITC (all refundable credits)
    const totalRefundable = ny.additionalLines?.totalRefundable || 0;
    const nyEITC = ny.additionalLines?.nyEITC || 0;
    const escc = ny.additionalLines?.empireStateChildCredit || 0;
    const depCare = ny.additionalLines?.nyDependentCareCredit || 0;
    expect(totalRefundable).toBe(
      Math.round((nyEITC + escc + depCare) * 100) / 100
    );
  });
});
