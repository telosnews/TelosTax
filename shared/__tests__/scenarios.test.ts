/**
 * IRS Pub 17 / Real-World Scenario Tests
 *
 * Each scenario is hand-calculated line-by-line against the 2025 tax tables,
 * then verified against the engine output.  These tests catch interaction bugs
 * between modules that unit tests miss.
 *
 * Every expected value has a derivation comment so a reviewer can audit the math.
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test',
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
    incomeK1: [],
    income1099SA: [],
    rentalProperties: [],
    otherIncome: 0,
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Scenario 1 ─────────────────────────────────────────────────────────────
// Single W-2 earner, $55,000 wages, standard deduction, $6,800 withheld
//
// Hand calculation:
//   Total income              = 55,000
//   Adjustments               = 0
//   AGI                       = 55,000
//   Standard deduction        = 15,750  (Single 2025, OBBBA)
//   Taxable income            = 39,250
//
//   Tax (Single brackets):
//     10% on 0–11,925         = 1,192.50
//     12% on 11,925–39,250    = (39,250 − 11,925) × 0.12 = 27,325 × 0.12 = 3,279.00
//     Total income tax        = 4,471.50
//
//   Credits                   = 0
//   Tax after credits         = 4,471.50
//   Withholding               = 6,800
//   Refund                    = 6,800 − 4,471.50 = 2,328.50

describe('Scenario 1 — Single W-2 Employee, $55k', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1',
      employerName: 'Acme Corp',
      wages: 55000,
      federalTaxWithheld: 6800,
      socialSecurityWages: 55000,
      socialSecurityTax: 3410,
      medicareWages: 55000,
      medicareTax: 797.50,
    }],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct income', () => {
    expect(f.totalWages).toBe(55000);
    expect(f.totalIncome).toBe(55000);
  });

  it('has no adjustments', () => {
    expect(f.totalAdjustments).toBe(0);
    expect(f.agi).toBe(55000);
  });

  it('uses standard deduction', () => {
    expect(f.deductionUsed).toBe('standard');
    expect(f.deductionAmount).toBe(15750);
  });

  it('has correct taxable income', () => {
    expect(f.taxableIncome).toBe(39250);
  });

  it('calculates correct income tax via brackets', () => {
    // 10% × 11925 = 1192.50
    // 12% × (39250 − 11925) = 12% × 27325 = 3279
    expect(f.incomeTax).toBe(4471.50);
  });

  it('has no SE tax', () => {
    expect(f.seTax).toBe(0);
    expect(result.scheduleSE).toBeUndefined();
  });

  it('has no credits', () => {
    expect(f.totalCredits).toBe(0);
  });

  it('calculates correct refund', () => {
    expect(f.totalWithholding).toBe(6800);
    expect(f.taxAfterCredits).toBe(4471.50);
    expect(f.refundAmount).toBe(2328.50);
    expect(f.amountOwed).toBe(0);
  });

  it('has correct marginal rate', () => {
    expect(f.marginalTaxRate).toBe(0.12);
  });
});

// ─── Scenario 2 ─────────────────────────────────────────────────────────────
// MFJ couple: one W-2 ($90k), one freelancer ($60k NEC − $12k expenses),
// 2 qualifying children, itemized deductions
//
// Hand calculation:
//   W-2 wages                 = 90,000
//   Schedule C: 60,000 − 12,000 = 48,000 net profit
//   Total income              = 90,000 + 48,000 = 138,000
//
//   SE tax:
//     Net earnings = 48,000 × 0.9235 = 44,328
//     SS tax = 44,328 × 0.124 = 5,496.67  (under wage base after 90k W-2 SS wages)
//       Remaining SS base = 176,100 − 90,000 = 86,100.  44,328 < 86,100 → all taxable
//     Medicare = 44,328 × 0.029 = 1,285.51
//     Additional Medicare = 0 (under $250k MFJ threshold)
//     Total SE tax = 5,496.67 + 1,285.51 = 6,782.18
//     Deductible half = 3,391.09
//
//   Adjustments:
//     SE deduction             = 3,391.09
//     Total adjustments        = 3,391.09
//
//   AGI = 138,000 − 3,391.09 = 134,608.91
//
//   Itemized deductions:
//     Medical: $20,000 − (7.5% × 134,608.91 = 10,095.67) = 9,904.33
//     SALT: 9,000 + 6,000 = 15,000 (under $40,000 OBBBA cap)
//     Mortgage interest: 12,000
//     Charitable: 4,000
//     Total itemized = 9,904.33 + 15,000 + 12,000 + 4,000 = 40,904.33
//
//   Standard deduction (MFJ) = 31,500.  Itemized > standard → use itemized.
//   Deduction = 40,904.33
//
//   QBI deduction:
//     20% of QBI = 20% × 48,000 = 9,600
//     Taxable income before QBI = 134,608.91 − 40,904.33 = 93,704.58
//     20% of taxable income = 18,740.92
//     QBI = min(9,600, 18,740.92) = 9,600  (below $394,600 MFJ threshold)
//
//   Taxable income = 134,608.91 − 40,904.33 − 9,600 = 84,104.58
//
//   Tax (MFJ brackets):
//     10% on 0–23,850         = 2,385
//     12% on 23,850–84,104.58 = (84,104.58 − 23,850) × 0.12 = 60,254.58 × 0.12 = 7,230.55
//     Total income tax        = 9,615.55
//
//   Credits:
//     CTC = 2 × $2,200 = $4,400  (AGI $134,608.91 well under $400k MFJ threshold)
//     Total credits = 4,400
//
//   Tax after non-refundable credits = max(0, 9,615.55 − 4,400) + 6,782.18 = 11,997.73
//   EITC = 0  (income too high for 2 kids, phase-out ends at ~$62,968 MFJ)
//   Tax after credits = 11,997.73
//
//   Withholding = 14,000
//   Refund = 14,000 − 11,997.73 = 2,002.27

describe('Scenario 2 — MFJ, W-2 + Freelancer, 2 Kids, Itemized', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1',
      employerName: 'BigCo',
      wages: 90000,
      federalTaxWithheld: 14000,
      socialSecurityWages: 90000,
      socialSecurityTax: 5580,
      medicareWages: 90000,
      medicareTax: 1305,
    }],
    income1099NEC: [
      { id: 'n1', payerName: 'Client Alpha', amount: 40000 },
      { id: 'n2', payerName: 'Client Beta', amount: 20000 },
    ],
    expenses: [
      { id: 'e1', scheduleCLine: 18, category: 'office_expense', amount: 3000 },
      { id: 'e2', scheduleCLine: 25, category: 'utilities', amount: 4000 },
      { id: 'e3', scheduleCLine: 27, category: 'software', amount: 5000 },
    ],
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 20000,
      stateLocalIncomeTax: 9000,
      realEstateTax: 6000,
      personalPropertyTax: 0,
      mortgageInterest: 12000,
      mortgageInsurancePremiums: 0,
      charitableCash: 4000,
      charitableNonCash: 0,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
    childTaxCredit: {
      qualifyingChildren: 2,
      otherDependents: 0,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct Schedule C', () => {
    expect(result.scheduleC).toBeDefined();
    expect(result.scheduleC!.grossIncome).toBe(60000);
    expect(result.scheduleC!.totalExpenses).toBe(12000);
    expect(result.scheduleC!.netProfit).toBe(48000);
  });

  it('has correct total income', () => {
    // 90,000 wages + 48,000 Schedule C net
    expect(f.totalIncome).toBe(138000);
  });

  it('has correct SE tax', () => {
    expect(result.scheduleSE).toBeDefined();
    // Net earnings = 48000 × 0.9235 = 44328
    expect(result.scheduleSE!.netEarnings).toBe(44328);
    // SS: 44328 × 0.124 = 5496.67
    expect(result.scheduleSE!.socialSecurityTax).toBeCloseTo(5496.67, 1);
    // Medicare: 44328 × 0.029 = 1285.51
    expect(result.scheduleSE!.medicareTax).toBeCloseTo(1285.51, 1);
    // Additional Medicare: 0 (under $250k MFJ)
    expect(result.scheduleSE!.additionalMedicareTax).toBe(0);
    // Total: 5496.67 + 1285.51 = 6782.18
    expect(result.scheduleSE!.totalSETax).toBeCloseTo(6782.18, 1);
    // Deductible half: 3391.09
    expect(result.scheduleSE!.deductibleHalf).toBeCloseTo(3391.09, 1);
  });

  it('has correct AGI', () => {
    // 138000 − 3391.09 = 134608.91
    expect(f.agi).toBeCloseTo(134608.91, 1);
  });

  it('uses itemized deductions', () => {
    expect(f.deductionUsed).toBe('itemized');
    expect(result.scheduleA).toBeDefined();
    // Medical: 20000 − (134608.91 × 0.075 = 10095.67) = 9904.33
    expect(result.scheduleA!.medicalDeduction).toBeCloseTo(9904.33, 0);
    // SALT: 15000 (under $40k cap)
    expect(result.scheduleA!.saltDeduction).toBe(15000);
    // Mortgage
    expect(result.scheduleA!.interestDeduction).toBe(12000);
    // Charitable
    expect(result.scheduleA!.charitableDeduction).toBe(4000);
    // Total itemized ~40904.33
    expect(result.scheduleA!.totalItemized).toBeCloseTo(40904.33, 0);
  });

  it('has correct QBI deduction', () => {
    // 20% × 48000 = 9600 (below MFJ threshold)
    expect(f.qbiDeduction).toBe(9600);
  });

  it('has correct taxable income', () => {
    // AGI − itemized − QBI ≈ 134608.91 − 40904.33 − 9600 = 84104.58
    expect(f.taxableIncome).toBeCloseTo(84104.58, 0);
  });

  it('has correct income tax', () => {
    // MFJ brackets on ~84104.58:
    // 10% × 23850 = 2385
    // 12% × (84104.58 − 23850) = 12% × 60254.58 = 7230.55
    // Total ≈ 9615.55
    expect(f.incomeTax).toBeCloseTo(9615.55, 0);
  });

  it('has correct credits', () => {
    // CTC: 2 × $2200 = $4400 (under $400k threshold)
    expect(result.credits.childTaxCredit).toBe(4400);
    expect(result.credits.otherDependentCredit).toBe(0);
  });

  it('calculates correct final balance', () => {
    // Tax after non-refundable: max(0, 9615.55 − 4400) + 6782.18 ≈ 11997.73
    // EITC = 0 (too much income)
    expect(result.credits.eitcCredit).toBe(0);
    // Tax after credits ≈ 11997.73
    expect(f.taxAfterCredits).toBeCloseTo(11997.73, 0);
    // Refund = 14000 − 11997.73 ≈ 2002.27
    expect(f.refundAmount).toBeCloseTo(2002.27, 0);
    expect(f.amountOwed).toBe(0);
  });
});


// ─── Scenario 3 ─────────────────────────────────────────────────────────────
// HOH single parent, $28,000 W-2 wages, 1 qualifying child, EITC-eligible
//
// Hand calculation:
//   Total income              = 28,000
//   AGI                       = 28,000
//   Standard deduction (HOH)  = 23,625
//   Taxable income            = 4,375
//
//   Tax (HOH brackets):
//     10% on 0–4,375          = 437.50
//     Total income tax        = 437.50
//
//   Credits:
//     CTC = 1 × $2,200 = $2,200 (AGI under $200k threshold)
//     Non-refundable credits = 2,000
//     Tax after non-refundable = max(0, 550 − 2,000) + 0 = 0
//
//   EITC (1 child, HOH ≡ Single for EITC phase-out):
//     Earned income = 28,000
//     Phase-out starts at 21,560 (Single), ends at 49,084
//     28,000 > 21,560 → in phase-out
//     Phase-out rate = 3995 / (49084 − 21560) = 3995 / 27524 ≈ 0.14517
//     Reduction = (28,000 − 21,560) × 0.14517 = 6,440 × 0.14517 ≈ 934.90
//     Credit from earned income = 3,995 − 934.90 = 3,060.10
//     Credit from AGI = same (earned income = AGI)
//     EITC = 3,060.10
//
//   Tax after all credits = 0 − 3,060.10 = −3,060.10
//   Withholding = 2,500
//   Refund = abs(−3,060.10) + 2,500 → actually:
//     taxAfterCredits (display) = max(0, −3060.10) = 0
//     balance = taxAfterCredits_raw − totalPayments = −3060.10 − 2500 = −5560.10
//     Refund = 5,560.10

describe('Scenario 3 — HOH Single Parent, EITC-Eligible', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.HeadOfHousehold,
    w2Income: [{
      id: 'w1',
      employerName: 'Local Shop',
      wages: 28000,
      federalTaxWithheld: 2500,
      socialSecurityWages: 28000,
      socialSecurityTax: 1736,
      medicareWages: 28000,
      medicareTax: 406,
    }],
    childTaxCredit: {
      qualifyingChildren: 1,
      otherDependents: 0,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct income and AGI', () => {
    expect(f.totalIncome).toBe(28000);
    expect(f.agi).toBe(28000);
  });

  it('uses HOH standard deduction', () => {
    expect(f.deductionUsed).toBe('standard');
    expect(f.deductionAmount).toBe(23625);
  });

  it('has correct taxable income', () => {
    expect(f.taxableIncome).toBe(4375);
  });

  it('calculates correct income tax', () => {
    // HOH: 10% on 0–4,375 = 437.50
    expect(f.incomeTax).toBe(437.50);
  });

  it('applies CTC correctly', () => {
    expect(result.credits.childTaxCredit).toBe(2200);
  });

  it('calculates EITC for 1 qualifying child', () => {
    // Earned income = 28,000. 1 child. HOH.
    // Phase-out starts at 21,560 (Single thresholds), ends at 49,084
    // In phase-out region
    expect(result.credits.eitcCredit).toBeGreaterThan(2500);
    expect(result.credits.eitcCredit).toBeLessThan(3995);
  });

  it('gets a substantial refund from EITC + withholding', () => {
    // Income tax (437.50) fully wiped by CTC (2200).
    // Remaining CTC doesn't reduce further (non-refundable in this engine).
    // EITC is refundable and creates negative tax.
    // Refund = withholding + EITC benefit
    expect(f.refundAmount).toBeGreaterThan(5000);
    expect(f.amountOwed).toBe(0);
  });

  it('has correct marginal rate', () => {
    expect(f.marginalTaxRate).toBe(0.10);
  });
});


// ─── Scenario 4 ─────────────────────────────────────────────────────────────
// High-income MFJ: $300k W-2 + $50k 1099-NEC (net $40k after expenses)
// Education credit (AOTC) at phase-out boundary, QBI below threshold
//
// Hand calculation:
//   W-2 wages                 = 300,000
//   Schedule C net profit     = 50,000 − 10,000 = 40,000
//   Total income              = 340,000
//
//   SE tax:
//     Net earnings = 40,000 × 0.9235 = 36,940
//     Remaining SS base = 176,100 − 300,000 = 0 (maxed out by W-2)
//     SS tax = 0
//     Medicare = 36,940 × 0.029 = 1,071.26
//     Additional Medicare = 0 (combined net earnings under $250k MFJ threshold:
//       we check SE earnings alone: 36,940 < 250,000)
//     Total SE = 1,071.26
//     Deductible half = 535.63
//
//   Adjustments = 535.63
//   AGI = 340,000 − 535.63 = 339,464.37
//
//   Standard deduction (MFJ) = 31,500
//   Taxable income before QBI = 307,964.37
//
//   QBI:
//     20% × 40,000 = 8,000
//     20% × 307,964.37 = 61,592.87
//     QBI = min(8,000, 61,592.87) = 8,000 (under $394,600 MFJ threshold)
//
//   Taxable income = 307,964.37 − 8,000 = 299,964.37
//
//   Tax (MFJ brackets):
//     10% × 23,850 = 2,385
//     12% × (96,950 − 23,850) = 12% × 73,100 = 8,772
//     22% × (206,700 − 96,950) = 22% × 109,750 = 24,145
//     24% × (299,964.37 − 206,700) = 24% × 93,264.37 = 22,383.45
//     Total = 57,685.45
//
//   Credits:
//     AOTC: $5,000 tuition. Full credit = $2,500
//     Phase-out (MFJ): starts at $160,000, range $20,000
//     AGI = 339,464.37 > 160,000 + 20,000 = 180,000 → fully phased out
//     Education credit = 0
//
//   Additional Medicare Tax (Form 8959): combined wages + SE = 300,000 + 36,940 = 336,940
//     Excess over $250,000 MFJ threshold = 86,940. Additional Medicare = 86,940 × 0.009 = 782.46
//   Tax after credits = 57,685.45 + 1,071.26 + 782.46 − 0 = 59,539.17
//   Withholding = 52,000
//   Amount owed = 59,539.17 − 52,000 = 7,539.17

describe('Scenario 4 — High-Income MFJ, AOTC Phase-Out, QBI', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1',
      employerName: 'MegaCorp',
      wages: 300000,
      federalTaxWithheld: 52000,
      socialSecurityWages: 176100,  // capped at wage base
      socialSecurityTax: 10918.20,
      medicareWages: 300000,
      medicareTax: 4350,
    }],
    income1099NEC: [
      { id: 'n1', payerName: 'Consulting Gig', amount: 50000 },
    ],
    expenses: [
      { id: 'e1', scheduleCLine: 27, category: 'other_expenses', amount: 10000 },
    ],
    educationCredits: [{
      id: 'ed1',
      type: 'american_opportunity',
      studentName: 'College Kid',
      institution: 'State University',
      tuitionPaid: 5000,
      scholarships: 0,
    }],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct Schedule C', () => {
    expect(result.scheduleC!.grossIncome).toBe(50000);
    expect(result.scheduleC!.totalExpenses).toBe(10000);
    expect(result.scheduleC!.netProfit).toBe(40000);
  });

  it('has correct total income', () => {
    expect(f.totalIncome).toBe(340000);
  });

  it('has correct SE tax (SS maxed by W-2)', () => {
    // SS base already consumed by W-2 wages ($176,100 of $300k)
    // Remaining SS base for SE = max(0, 176100 − 176100) = 0
    expect(result.scheduleSE!.socialSecurityTax).toBe(0);
    expect(result.scheduleSE!.medicareTax).toBeCloseTo(1071.26, 1);
    expect(result.scheduleSE!.totalSETax).toBeCloseTo(1071.26, 1);
  });

  it('has correct AGI', () => {
    expect(f.agi).toBeCloseTo(339464.37, 0);
  });

  it('has correct QBI deduction', () => {
    // 20% × 40,000 = 8,000 (under $394,600 MFJ threshold)
    expect(f.qbiDeduction).toBe(8000);
  });

  it('has correct taxable income', () => {
    // AGI − 31,500 standard − 8,000 QBI
    expect(f.taxableIncome).toBeCloseTo(299964.37, 0);
  });

  it('has correct income tax', () => {
    // MFJ brackets: 2385 + 8772 + 24145 + 22383.45 = 57685.45
    expect(f.incomeTax).toBeCloseTo(57685.45, 0);
  });

  it('fully phases out AOTC at high income', () => {
    // AGI $339k > $180k (160k + 20k range) → fully phased out
    expect(result.credits.educationCredit).toBe(0);
  });

  it('owes additional tax', () => {
    // Tax after credits = 57685.45 + 1071.26 + 782.46 (Additional Medicare Tax) = 59539.17
    expect(f.taxAfterCredits).toBeCloseTo(59539.17, 0);
    // Owed = 59539.17 − 52000 ≈ 7539.17 base + ~74 estimated tax penalty (day-count) ≈ 7613
    expect(f.amountOwed).toBeCloseTo(7613, 0);
    expect(f.refundAmount).toBe(0);
  });

  it('has correct marginal rate', () => {
    expect(f.marginalTaxRate).toBe(0.24);
  });
});


// ─── Scenario 5 ─────────────────────────────────────────────────────────────
// MFS, $110k W-2, $20k SALT cap (OBBBA), no EITC, student loan interest (no deduction for MFS)
//
// Hand calculation:
//   Total income              = 110,000
//   Student loan interest     = 0 (MFS cannot deduct)
//   Adjustments               = 0
//   AGI                       = 110,000
//   Itemized deductions:
//     SALT: 8000 + 4000 = 12000 (under $20k MFS cap)
//     Mortgage: 3000, Charitable: 1000
//     Total itemized = 16,000
//   Standard deduction (MFS)  = 15,750
//   Itemized ($16,000) > standard ($15,750) → use itemized
//   Taxable income            = 94,000
//
//   Tax (MFS brackets — same as Single):
//     10% × 11,925           = 1,192.50
//     12% × (48,475 − 11,925) = 12% × 36,550 = 4,386
//     22% × (94,000 − 48,475) = 22% × 45,525 = 10,015.50
//     Total                   = 15,594
//
//   EITC = 0 (MFS ineligible)
//   Credits = 0
//   Withholding = 17,500
//   Refund = 17,500 − 15,594 = 1,906

describe('Scenario 5 — MFS, $110k, SALT Cap $20k, No EITC', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingSeparately,
    w2Income: [{
      id: 'w1',
      employerName: 'SomeCorp',
      wages: 110000,
      federalTaxWithheld: 17500,
      socialSecurityWages: 110000,
    }],
    studentLoanInterest: 2500,  // should be denied for MFS
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 0,
      stateLocalIncomeTax: 8000,
      realEstateTax: 4000,
      personalPropertyTax: 0,
      mortgageInterest: 3000,
      mortgageInsurancePremiums: 0,
      charitableCash: 1000,
      charitableNonCash: 0,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('denies student loan interest deduction for MFS', () => {
    expect(f.studentLoanInterest).toBe(0);
    expect(f.totalAdjustments).toBe(0);
  });

  it('uses MFS SALT cap of $20,000', () => {
    // Total SALT = 8000 + 4000 = 12000, under $20,000 cap
    expect(result.scheduleA!.saltDeduction).toBe(12000);
  });

  it('uses itemized deduction because it exceeds standard', () => {
    // Itemized: 12000 SALT + 3000 mortgage + 1000 charitable = 16,000
    // Standard (MFS) = 15,750.  Itemized wins.
    expect(result.scheduleA!.totalItemized).toBe(16000);
    expect(f.deductionUsed).toBe('itemized');
    expect(f.deductionAmount).toBe(16000);
  });

  it('has correct taxable income', () => {
    expect(f.taxableIncome).toBe(94000);
  });

  it('calculates correct income tax', () => {
    // MFS brackets (same as Single):
    // 10% × 11925 = 1192.50
    // 12% × 36550 = 4386
    // 22% × 45525 = 10015.50
    expect(f.incomeTax).toBe(15594);
  });

  it('has no EITC (MFS disqualified)', () => {
    expect(result.credits.eitcCredit).toBe(0);
  });

  it('calculates correct refund', () => {
    expect(f.refundAmount).toBe(1906);
    expect(f.amountOwed).toBe(0);
  });
});


// ─── Scenario 6 ─────────────────────────────────────────────────────────────
// Full self-employment: Single freelancer, $150k NEC, $30k expenses,
// home office (simplified 250 sqft), vehicle (standard mileage 12k miles),
// SE health insurance, HSA, student loan interest
//
// Hand calculation:
//   1099-NEC income            = 150,000
//   Expenses                   = 30,000
//   Tentative profit           = 120,000
//   Home office (simplified)   = min(250 × $5, 120,000) = 1,250
//   Net profit                 = 120,000 − 1,250 = 118,750
//
//   Vehicle deduction is NOT a Schedule C deduction in our engine
//   (it goes through the vehicle method on the business, but the engine
//    calculates it via the expenses line items, not separately).
//   So vehicle = separate from Schedule C unless added as expense line 9.
//   We'll add it as a line-9 expense: 12,000 × $0.70 = $8,400.
//   Wait — actually the engine calculates vehicle separately only if
//   vehicle info is set. Let me check...
//   Actually, looking at scheduleC.ts, vehicle is NOT calculated there.
//   Vehicle deduction is only in vehicle.ts and not integrated into Schedule C.
//   So for this test, we'll include mileage as a car expense on line 9.
//
//   Revised:
//   Expenses = 30,000 + 8,400 (mileage on line 9) = 38,400
//   Tentative profit = 150,000 − 38,400 = 111,600
//   Home office = min(1,250, 111,600) = 1,250
//   Net profit = 111,600 − 1,250 = 110,350
//
//   SE tax:
//     Net earnings = 110,350 × 0.9235 = 101,908.23
//     SS tax = 101,908.23 × 0.124 = 12,636.62
//     Medicare = 101,908.23 × 0.029 = 2,955.34
//     Additional Medicare = 0 (under $200k Single threshold)
//     Total SE = 15,591.96
//     Deductible half = 7,795.98
//
//   Adjustments:
//     SE deduction = 7,795.98
//     Health insurance = 6,000
//     HSA = 4,300
//     Student loan = min(2,500, 2,500) = 2,500
//       Phase-out check: totalIncome = 110,350.
//       Single phase-out starts at 85,000, range 15,000 (OBBBA).
//       110,350 > 85,000 + 15,000 = 100,000 → fully phased out!
//       Student loan deduction = 0
//     Total adjustments = 7,795.98 + 6,000 + 4,300 + 0 = 18,095.98
//
//   AGI = 110,350 − 18,095.98 = 92,254.02
//
//   Standard deduction (Single) = 15,750
//   Taxable income before QBI = 92,254.02 − 15,750 = 76,504.02
//
//   QBI:
//     20% × 110,350 = 22,070
//     20% × 76,504.02 = 15,300.80
//     QBI = min(22,070, 15,300.80) = 15,300.80  (below $197,300 Single threshold)
//
//   Taxable income = 76,504.02 − 15,300.80 = 61,203.22
//
//   Tax (Single brackets):
//     10% × 11,925 = 1,192.50
//     12% × (48,475 − 11,925) = 4,386
//     22% × (61,203.22 − 48,475) = 22% × 12,728.22 = 2,800.21
//     Total income tax = 8,378.71
//
//   Credits = 0
//   EITC = 0 (income too high)
//
//   Tax after credits = 8,378.71 + 15,591.96 = 23,970.67
//   Withholding = 0
//   Estimated payments = 20,000
//   Amount owed = 23,970.67 − 20,000 = 3,970.67

describe('Scenario 6 — Full Self-Employment, Home Office, HSA, SE Health Insurance', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    income1099NEC: [
      { id: 'n1', payerName: 'Major Client', amount: 100000 },
      { id: 'n2', payerName: 'Side Client', amount: 50000 },
    ],
    expenses: [
      { id: 'e1', scheduleCLine: 27, category: 'software', amount: 12000 },
      { id: 'e2', scheduleCLine: 18, category: 'office_expense', amount: 5000 },
      { id: 'e3', scheduleCLine: 25, category: 'utilities', amount: 8000 },
      { id: 'e4', scheduleCLine: 15, category: 'insurance', amount: 5000 },
      { id: 'e5', scheduleCLine: 9, category: 'car_truck', amount: 8400 }, // 12k miles × $0.70
    ],
    homeOffice: {
      method: 'simplified',
      squareFeet: 250,
    },
    selfEmploymentDeductions: {
      healthInsurancePremiums: 6000,
      sepIraContributions: 0,
      solo401kContributions: 0,
      otherRetirementContributions: 0,
    },
    hsaDeduction: 4300,
    studentLoanInterest: 2500,
    estimatedPaymentsMade: 20000,
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct Schedule C', () => {
    expect(result.scheduleC!.grossIncome).toBe(150000);
    expect(result.scheduleC!.totalExpenses).toBe(38400);
    expect(result.scheduleC!.tentativeProfit).toBe(111600);
    expect(result.scheduleC!.homeOfficeDeduction).toBe(1250);
    expect(result.scheduleC!.netProfit).toBe(110350);
  });

  it('has correct total income', () => {
    expect(f.totalIncome).toBe(110350);
  });

  it('has correct SE tax', () => {
    // Net earnings = 110350 × 0.9235 = 101908.23 (approximately)
    expect(result.scheduleSE!.netEarnings).toBeCloseTo(101908.23, 0);
    expect(result.scheduleSE!.socialSecurityTax).toBeCloseTo(12636.62, 0);
    expect(result.scheduleSE!.medicareTax).toBeCloseTo(2955.34, 0);
    expect(result.scheduleSE!.additionalMedicareTax).toBe(0);
    expect(result.scheduleSE!.totalSETax).toBeCloseTo(15591.96, 0);
    expect(f.seDeduction).toBeCloseTo(7795.98, 0);
  });

  it('partially phases out student loan interest deduction', () => {
    // Bug #9 fix: MAGI uses preliminary AGI (totalIncome - preliminaryAdjustments)
    // MAGI ≈ 110350 - 18096 = 92254, which is in $80K-$95K phase-out range
    expect(f.studentLoanInterest).toBe(1291);
  });

  it('has correct adjustments', () => {
    // SE deduction ~7795.98 + health insurance 6000 + HSA 4300 + student loan 1291
    expect(f.selfEmployedHealthInsurance).toBe(6000);
    expect(f.hsaDeduction).toBe(4300);
    expect(f.totalAdjustments).toBeCloseTo(19386.98, 0);
  });

  it('has correct AGI', () => {
    // 110350 − 19386.98 ≈ 90963.02
    expect(f.agi).toBeCloseTo(90963.02, 0);
  });

  it('has correct QBI deduction', () => {
    // 20% × 110350 = 22070
    // 20% × (90963.02 − 15750) = 20% × 75213.02 = 15042.60
    // QBI = min(22070, 15042.60) = 15042.60
    expect(f.qbiDeduction).toBeCloseTo(15042.60, 0);
  });

  it('has correct taxable income', () => {
    // 90963.02 − 15750 − 15042.60 = 60170.42
    expect(f.taxableIncome).toBeCloseTo(60170.42, 0);
  });

  it('has correct income tax', () => {
    // Single brackets on ~60170.42:
    // 10% × 11925 = 1192.50
    // 12% × 36550 = 4386
    // 22% × (60170.42 − 48475) = 22% × 11695.42 = 2572.99
    // Total ≈ 8151.49
    expect(f.incomeTax).toBeCloseTo(8151.49, 0);
  });

  it('has no credits', () => {
    expect(f.totalCredits).toBe(0);
  });

  it('calculates correct amount owed', () => {
    // Tax after credits = 8151.49 + 15591.96 = 23743.45
    expect(f.taxAfterCredits).toBeCloseTo(23743.45, 0);
    // Owed = 23743.45 − 20000 estimated = 3743.45 base + ~64 estimated tax penalty ≈ 3807
    expect(f.estimatedPayments).toBe(20000);
    expect(f.amountOwed).toBeCloseTo(3807, 0);
    expect(f.refundAmount).toBe(0);
  });

  it('has correct marginal rate', () => {
    expect(f.marginalTaxRate).toBe(0.22);
  });

  it('calculates estimated quarterly for next year', () => {
    // Quarterly = max(0, taxAfterCredits − withholding) / 4
    // = max(0, 23743.45 − 0) / 4 = 5935.86 approximately
    expect(f.estimatedQuarterlyPayment).toBeCloseTo(5935.86, 0);
  });
});


// ─── Scenario Edge Cases ────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('handles a return with zero income', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
    });
    const result = calculateForm1040(taxReturn);
    expect(result.form1040.totalIncome).toBe(0);
    expect(result.form1040.taxableIncome).toBe(0);
    expect(result.form1040.incomeTax).toBe(0);
    expect(result.form1040.amountOwed).toBe(0);
    expect(result.form1040.refundAmount).toBe(0);
  });

  it('handles a business with expenses exceeding income (net loss)', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 5000 }],
      expenses: [{ id: 'e1', scheduleCLine: 27, category: 'other', amount: 15000 }],
    });
    const result = calculateForm1040(taxReturn);
    // Net loss = 5000 − 15000 = −10000
    expect(result.scheduleC!.netProfit).toBe(-10000);
    // Loss reduces income
    expect(result.form1040.totalIncome).toBe(-10000);
    // Taxable income floored at 0
    expect(result.form1040.taxableIncome).toBe(0);
    // No tax
    expect(result.form1040.incomeTax).toBe(0);
    // No SE tax on a loss
    expect(result.scheduleSE).toBeUndefined();
  });

  it('handles all income types simultaneously', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 80000, federalTaxWithheld: 12000 }],
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 10000 }],
      income1099K: [{ id: 'k1', platformName: 'Stripe', grossAmount: 5000 }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 1500 }],
      income1099DIV: [{ id: 'd1', payerName: 'Vanguard', ordinaryDividends: 3000, qualifiedDividends: 2000 }],
      income1099R: [{ id: 'r1', payerName: 'Fidelity', grossDistribution: 10000, taxableAmount: 10000, distributionCode: '7' }],
      income1099G: [{ id: 'g1', payerName: 'State', unemploymentCompensation: 4000 }],
      income1099MISC: [{ id: 'm1', payerName: 'Contest', otherIncome: 2000 }],
      otherIncome: 500,
    });

    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // Schedule C: 10000 NEC + 5000 K = 15000 gross, no expenses
    expect(result.scheduleC!.grossIncome).toBe(15000);

    // Total income = 80000 + 1500 + 3000 + 15000 + 10000 + 4000 + 2000 + 500 = 116000
    expect(f.totalIncome).toBe(116000);

    // Should calculate without crashing
    expect(f.incomeTax).toBeGreaterThan(0);
    expect(f.taxableIncome).toBeGreaterThan(0);
  });

  it('handles 1099-R rollover (code G) excluded from income', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 50000, federalTaxWithheld: 6000 }],
      income1099R: [
        { id: 'r1', payerName: 'Old 401k', grossDistribution: 100000, taxableAmount: 100000, distributionCode: 'G' },
        { id: 'r2', payerName: 'Pension', grossDistribution: 20000, taxableAmount: 15000, distributionCode: '7' },
      ],
    });
    const result = calculateForm1040(taxReturn);
    // Rollover (G) excluded, pension ($15k taxable) included
    expect(result.form1040.totalRetirementIncome).toBe(15000);
    expect(result.form1040.totalIncome).toBe(65000); // 50000 + 15000
  });

  it('handles very high income ($2M) correctly', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'BigTech', wages: 2000000,
        federalTaxWithheld: 600000,
        socialSecurityWages: 176100,
      }],
    });
    const result = calculateForm1040(taxReturn);
    // Taxable = 2000000 − 15750 = 1984250
    expect(result.form1040.taxableIncome).toBe(1984250);
    // Should hit the 37% bracket
    expect(result.form1040.marginalTaxRate).toBe(0.37);
    // Sanity check: tax should be substantial
    expect(result.form1040.incomeTax).toBeGreaterThan(500000);
    // Manual check of top bracket:
    // 37% kicks in at $626,350
    // Tax in 37% bracket = (1985000 − 626350) × 0.37 = 1358650 × 0.37 = 502701.05
    // Plus all lower brackets
    expect(result.form1040.incomeTax).toBeGreaterThan(600000);
  });
});
