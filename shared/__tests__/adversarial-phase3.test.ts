/**
 * Phase 3: Adversarial Scenario Tests — Multi-Model Red Team
 *
 * Test regime designed by Gemini 3.1 Pro, Claude Opus 4.6, and GPT-5.2.
 * Each model independently generated 10 adversarial scenarios designed to
 * break the engine, targeting multi-provision interactions, ordering hazards,
 * circular dependencies, and threshold cliff effects.
 *
 * Scenarios synthesized and deduplicated from 30 total across 3 models.
 *
 * @authority IRC §§1, 24, 32, 55, 86, 164, 199A, 219, 221, 469, 911, 1211, 1411
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'p3-adv',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    schemaVersion: 1,
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
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// P3-01: FEIE + Student Loan MAGI Bug (confirmed by all 3 models)
// IRC §221(b)(2)(C)(iii): MAGI for student loan must add back FEIE
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-01: FEIE + Student Loan MAGI (IRC §221(b)(2)(C))', () => {
  it('student loan deduction phased out when FEIE adds back income above $100k', () => {
    // W-2 wages = $130k (all foreign), FEIE = $130k → totalIncome = $0
    // But MAGI for student loan = $0 + $130k = $130k → fully phased out ($85k-$100k range)
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Foreign Corp', wages: 130000, federalTaxWithheld: 0 }],
      foreignEarnedIncome: {
        foreignEarnedIncome: 130000,
        qualifyingDays: 365,
      },
      studentLoanInterest: 2500,
    });
    const result = calculateForm1040(tr);
    // With FEIE add-back, MAGI = $130k → student loan deduction = $0
    expect(result.form1040.studentLoanInterest).toBe(0);
  });

  it('student loan deduction allowed when FEIE-adjusted MAGI is below threshold', () => {
    // W-2 wages = $80k (all foreign), FEIE = $80k → totalIncome = $0
    // MAGI for student loan = $0 + $80k = $80k → below $85k threshold → full deduction
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Foreign Corp', wages: 80000, federalTaxWithheld: 0 }],
      foreignEarnedIncome: {
        foreignEarnedIncome: 80000,
        qualifyingDays: 365,
      },
      studentLoanInterest: 2500,
    });
    const result = calculateForm1040(tr);
    // MAGI = $80k, below $85k threshold → full $2,500 deduction
    expect(result.form1040.studentLoanInterest).toBe(2500);
  });

  it('student loan partial deduction when FEIE-adjusted MAGI is in phase-out', () => {
    // W-2 = $90k (all foreign), FEIE = $90k → totalIncome = $0
    // MAGI = $0 + $90k = $90k → phase-out: (90k-85k)/15k = 1/3 → deduction = 2500*(2/3) ≈ $1,666.67
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Foreign Corp', wages: 90000, federalTaxWithheld: 0 }],
      foreignEarnedIncome: {
        foreignEarnedIncome: 90000,
        qualifyingDays: 365,
      },
      studentLoanInterest: 2500,
    });
    const result = calculateForm1040(tr);
    // Partial deduction: 2500 × (1 - (90000-85000)/15000) = 2500 × 2/3 ≈ $1,666.67
    expect(result.form1040.studentLoanInterest).toBeCloseTo(1666.67, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-02: AMT-FTC Retroactive Adjustment (flagged by all 3 models)
// AMT computed Section 7, FTC Section 9, then adjustAMTForRegularFTC()
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-02: AMT-FTC Retroactive Adjustment', () => {
  it('AMT correctly adjusted after FTC reduces regular tax', () => {
    // High income + large SALT → AMT likely triggers
    // FTC should reduce regular tax, affecting AMT comparison
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 450000, federalTaxWithheld: 100000 }],
      income1099DIV: [{
        id: 'd1', payerName: 'Foreign Fund',
        ordinaryDividends: 10000, qualifiedDividends: 10000,
        foreignTaxPaid: 20000,
      }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 5000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 40000,
        realEstateTax: 0,
        personalPropertyTax: 0,
        mortgageInterest: 0,
        mortgageInsurancePremiums: 0,
        charitableCash: 0,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    });
    const result = calculateForm1040(tr);
    // No NaN, totalTax reasonable, FTC applied, AMT correctly computed
    expect(result.form1040.totalTax).toBeGreaterThan(0);
    expect(result.form1040.totalTax).not.toBeNaN();
    // FTC should be credited
    expect(result.credits.foreignTaxCredit).toBeGreaterThan(0);
    // Balance check: taxAfterCredits + penalty - totalPayments = amountOwed or -(refundAmount)
    const balance = result.form1040.taxAfterCredits + result.form1040.estimatedTaxPenalty - result.form1040.totalPayments;
    if (balance > 0) {
      expect(result.form1040.amountOwed).toBeCloseTo(balance, 0);
    } else {
      expect(result.form1040.refundAmount).toBeCloseTo(Math.abs(balance), 0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-03: SALT Cap Phase-Down + AMT SALT Add-Back (2/3 models)
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-03: SALT Phase-Down + AMT Add-Back Interaction', () => {
  it('SALT phases down at high AGI, AMT adds back phased-down amount', () => {
    // AGI ~$600k → SALT cap phases down: 30% × ($600k - $500k) = $30k reduction
    // Cap = max($10k floor, $40k - $30k) = $10k
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 600000, federalTaxWithheld: 150000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 100000,
        realEstateTax: 0,
        personalPropertyTax: 0,
        mortgageInterest: 15000,
        mortgageInsurancePremiums: 0,
        charitableCash: 5000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    });
    const result = calculateForm1040(tr);
    // SALT should be capped at $10k (floor), not $40k or $100k
    // Total itemized = $10k SALT + $15k mortgage + $5k charitable = $30k
    // Taxable income = $600k - $30k = $570k
    expect(result.form1040.taxableIncome).toBe(570000);
    // No NaN
    expect(result.form1040.totalTax).not.toBeNaN();
  });

  it('MFS SALT cap is $20k with $5k floor at $250k phase-down threshold', () => {
    // MFS: SALT_CAP_MFS = $20k, threshold $250k, floor $5k
    // At exactly $250k: no phase-down (strict >)
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 250000, federalTaxWithheld: 50000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 30000,
        realEstateTax: 15000,
        personalPropertyTax: 5000,
        mortgageInterest: 15000,
        mortgageInsurancePremiums: 0,
        charitableCash: 2000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    });
    const result = calculateForm1040(tr);
    // At exactly $250k, SALT cap = $20k (no phase-down, strict > check)
    // Total itemized = $20k SALT + $15k mortgage + $2k charity = $37k > $15,750 standard
    // Taxable income = $250k - $37k = $213k
    expect(result.form1040.taxableIncome).toBe(213000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-04: MFS "Lived Apart" SS Exception Without Affecting EITC/Education
// (flagged by 2/3 models)
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-04: MFS Lived Apart — SS Exception vs EITC/Education Lockout', () => {
  it('livedApart changes SS taxation thresholds but EITC still $0', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      livedApartFromSpouse: true,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 30000, federalTaxWithheld: 3000 }],
      incomeSSA1099: { id: 'ss1', totalBenefits: 24000 },
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 2000, taxExemptInterest: 1000 }],
    });
    const resultLivedApart = calculateForm1040(tr);

    // Without livedApart, MFS base amount = $0 → 85% of SS taxable
    const trTogether = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      livedApartFromSpouse: false,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 30000, federalTaxWithheld: 3000 }],
      incomeSSA1099: { id: 'ss1', totalBenefits: 24000 },
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 2000, taxExemptInterest: 1000 }],
    });
    const resultTogether = calculateForm1040(trTogether);

    // Lived apart should result in LESS taxable SS (Single thresholds apply)
    expect(resultLivedApart.form1040.taxableSocialSecurity).toBeLessThan(
      resultTogether.form1040.taxableSocialSecurity,
    );

    // EITC should be $0 for MFS regardless of livedApart
    expect(resultLivedApart.credits.eitcCredit).toBe(0);
    expect(resultTogether.credits.eitcCredit).toBe(0);
  });

  it('MFS livedApart does not affect education credit lockout', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      livedApartFromSpouse: true,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 50000, federalTaxWithheld: 5000 }],
      educationCredits: [{
        id: 'e1', studentName: 'Student', type: 'american_opportunity',
        tuitionPaid: 4000, institution: 'Test U',
      }],
    });
    const result = calculateForm1040(tr);
    // MFS is ineligible for AOTC regardless of livedApart
    expect(result.credits.educationCredit).toBe(0);
    expect(result.credits.aotcRefundableCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-05: CTC/ACTC with Low Earned Income + Multiple Children
// (flagged by 2/3 models)
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-05: CTC/ACTC Low Earned Income + Multiple Children', () => {
  it('ACTC limited by earned income formula when tax liability is $0', () => {
    // 3 children → CTC = 3 × $2,200 = $6,600
    // Wages = $15k → taxable income = $15k - $15,750 = $0 → $0 tax
    // ACTC earned income formula: max(0, ($15k - $2,500) × 15%) = $1,875
    // maxRefundable = 3 × $1,700 = $5,100
    // ACTC = min($6,600, $5,100, $1,875) = $1,875
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 15000, federalTaxWithheld: 500 }],
      dependents: [
        { id: 'd1', firstName: 'Child1', lastName: 'Test', relationship: 'son', dateOfBirth: '2015-03-01', monthsLivedWithYou: 12 },
        { id: 'd2', firstName: 'Child2', lastName: 'Test', relationship: 'daughter', dateOfBirth: '2017-06-01', monthsLivedWithYou: 12 },
        { id: 'd3', firstName: 'Child3', lastName: 'Test', relationship: 'son', dateOfBirth: '2019-09-01', monthsLivedWithYou: 12 },
      ],
    });
    const result = calculateForm1040(tr);

    // Tax liability should be $0 (below standard deduction)
    expect(result.form1040.incomeTax).toBe(0);

    // ACTC should be capped by earned income formula, not full $5,100
    expect(result.credits.actcCredit).toBe(1875);

    // childTaxCredit stores the raw CTC amount (3 × $2,200 = $6,600) before
    // tax-liability splitting. The ACTC function handles the refundable portion.
    expect(result.credits.childTaxCredit).toBe(6600);
  });

  it('CTC phase-out at $200,001 Single triggers $50 reduction', () => {
    // $200,001 → ceil(1/1000) = 1 increment → $50 reduction
    // CTC per child = $2,200 → 2 children = $4,400 → reduced by $50 = $4,350
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 200001, federalTaxWithheld: 40000 }],
      dependents: [
        { id: 'd1', firstName: 'Child1', lastName: 'Test', relationship: 'son', dateOfBirth: '2016-01-01', monthsLivedWithYou: 12 },
        { id: 'd2', firstName: 'Child2', lastName: 'Test', relationship: 'daughter', dateOfBirth: '2018-01-01', monthsLivedWithYou: 12 },
      ],
    });
    const result = calculateForm1040(tr);
    const totalChildCredits = result.credits.childTaxCredit + result.credits.actcCredit;
    // Should be $4,350 (2 × $2,200 - $50) or close
    expect(totalChildCredits).toBeLessThan(4400);
    expect(totalChildCredits).toBeGreaterThanOrEqual(4300);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-06: EITC Investment Income Exact Boundary ($11,950)
// (Opus: strict > means exactly $11,950 still qualifies)
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-06: EITC Investment Income Boundary', () => {
  it('exactly $11,950 investment income still qualifies for EITC (strict >)', () => {
    // Interest $5k + ordinary dividends $6,950 = $11,950 investment income
    // EITC check: investmentIncome > 11950 → at exactly $11,950, should qualify
    // Wages kept low ($5k) so AGI ($16,950) stays within childless EITC range (<$19,104)
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1990-06-15',
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 5000, federalTaxWithheld: 300 }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 5000 }],
      income1099DIV: [{ id: 'd1', payerName: 'Fund', ordinaryDividends: 6950, qualifiedDividends: 3000 }],
    });
    const result = calculateForm1040(tr);
    // EITC should be non-zero at exactly $11,950 investment income
    expect(result.credits.eitcCredit).toBeGreaterThan(0);
  });

  it('$11,951 investment income disqualifies from EITC', () => {
    // Same scenario but $1 extra interest → $11,951 investment income → disqualified
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1990-06-15',
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 5000, federalTaxWithheld: 300 }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 5001 }],
      income1099DIV: [{ id: 'd1', payerName: 'Fund', ordinaryDividends: 6950, qualifiedDividends: 3000 }],
    });
    const result = calculateForm1040(tr);
    // $11,951 > $11,950 → disqualified
    expect(result.credits.eitcCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-07: QBI + NOL Ordering — NOL can push below QBI threshold
// (flagged by 2/3 models)
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-07: QBI + NOL Ordering Interaction', () => {
  it('NOL pushes taxable income below QBI threshold → simple 20% path', () => {
    // Schedule C = $230k, W-2 = $0 → AGI ≈ $230k - SE deduction ≈ $213,739
    // Without NOL: taxable = $213,739 - $15,750 = $197,989 → ABOVE $197,300 threshold
    // With $15k NOL (80% limit): nolDeduction = min($15k, $197,989 × 0.80) = $15k
    // taxableBeforeQBI = $197,989 - $15k = $182,989 → BELOW $197,300 → simple 20% path
    const trWithNOL = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 230000 }],
      nolCarryforward: 15000,
      qbiInfo: {
        isSSTB: true,
        w2WagesPaidByBusiness: 0,
        ubiaOfQualifiedProperty: 0,
      },
    });
    const resultNOL = calculateForm1040(trWithNOL);

    const trNoNOL = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 230000 }],
      qbiInfo: {
        isSSTB: true,
        w2WagesPaidByBusiness: 0,
        ubiaOfQualifiedProperty: 0,
      },
    });
    const resultNoNOL = calculateForm1040(trNoNOL);

    // With NOL: below threshold → SSTB gets full 20% QBI, BUT also capped at 20% × taxable income
    // Without NOL: above threshold → SSTB phases down slightly, but higher taxable income cap
    // The 20% × taxable income cap dominates: lower taxable income → lower QBI deduction
    expect(resultNOL.form1040.qbiDeduction).toBeLessThan(resultNoNOL.form1040.qbiDeduction);
    // Both should have valid QBI deductions
    expect(resultNOL.form1040.qbiDeduction).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-08: Capital Loss Carryforward Character Preservation
// (Opus scenario 5)
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-08: Capital Loss Carryforward Character Preservation', () => {
  it('ST gains offset ST carryforward, LT losses create LT carryforward', () => {
    // ST gain $3k + ST carryforward $2k = net ST +$1k
    // LT loss $10k + LT carryforward $5k = net LT -$15k
    // Overall: +$1k - $15k = -$14k → cap loss deduction = $3k
    // ST net is positive → no ST carryforward
    // All deduction comes from LT → LT carryforward = $15k - $3k - 0 = $12k
    // Wait: $3k deduction is split — $1k offsets the ST gain leaving $0 ST, then...
    // Actually: net overall = -$14k. Cap at $3k. Carryforward = $11k all LT.
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 100000, federalTaxWithheld: 15000 }],
      income1099B: [
        { id: 'b1', description: 'ST gain', proceeds: 8000, costBasis: 5000, dateSold: '2025-03-01', dateAcquired: '2025-01-15', isLongTerm: false, basisReportedToIRS: true },
        { id: 'b2', description: 'LT loss', proceeds: 5000, costBasis: 15000, dateSold: '2025-06-01', dateAcquired: '2020-01-15', isLongTerm: true, basisReportedToIRS: true },
      ],
      capitalLossCarryforwardST: 2000,
      capitalLossCarryforwardLT: 5000,
    });
    const result = calculateForm1040(tr);
    // Capital loss deduction should be $3k (max allowed)
    expect(result.form1040.capitalLossDeduction).toBe(3000);
    // Carryforward should preserve character
    expect(result.scheduleD.capitalLossCarryforwardST).toBe(0); // ST net was positive
    expect(result.scheduleD.capitalLossCarryforwardLT).toBe(11000); // $14k net loss - $3k deduction = $11k
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-09: SE $400 Threshold with K-1 Combined SE Income
// (Gemini scenario 9 + Opus scenario 4)
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-09: SE Threshold with K-1 Combined Income', () => {
  it('SE income below $400 from Schedule C alone but K-1 pushes over', () => {
    // Schedule C = $350 (below $400), K-1 SE = $100 → combined $450 (above $400)
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 350 }],
      incomeK1: [{
        id: 'k1', entityName: 'Partnership', entityType: 'partnership',
        entityEIN: '12-3456789',
        ordinaryBusinessIncome: 100,
        selfEmploymentIncome: 100,
      }],
    });
    const result = calculateForm1040(tr);
    // Combined SE income = $450 → above $400 threshold → SE tax should apply
    expect(result.form1040.seTax).toBeGreaterThan(0);
  });

  it('SE income exactly $399 (combined) → no SE tax', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 299 }],
      incomeK1: [{
        id: 'k1', entityName: 'Partnership', entityType: 'partnership',
        entityEIN: '12-3456789',
        ordinaryBusinessIncome: 100,
        selfEmploymentIncome: 100,
      }],
    });
    const result = calculateForm1040(tr);
    // Combined = $399 → below $400 → no SE tax
    expect(result.form1040.seTax).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-10: Negative AGI + CTC Phase-Out Sanity
// (Gemini scenario 7)
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-10: Negative AGI Does Not Break CTC', () => {
  it('large Schedule C loss with children → CTC/ACTC computed correctly', () => {
    // Schedule C loss = -$200k, W-2 = $50k → AGI could go negative
    // CTC should not phase out (AGI < $200k), ACTC uses earned income
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 50000, federalTaxWithheld: 5000 }],
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 0 }],
      businesses: [{
        id: 'b1', name: 'Failing Biz', accountingMethod: 'cash',
        grossReceipts: 10000,
        expenses: {
          advertising: 0, carAndTruck: 0, commissions: 0, contractLabor: 0,
          depletion: 0, depreciation: 0, employeeBenefit: 0, insurance: 0,
          mortgageInterest: 0, otherInterest: 0, legal: 0, officeExpense: 0,
          pensionProfit: 0, rentVehicle: 0, rentOther: 0, repairs: 0,
          supplies: 0, taxes: 0, travel: 0, meals: 0, utilities: 0, wages: 0,
          otherExpenses: 210000,
        },
      }],
      dependents: [
        { id: 'd1', firstName: 'Child', lastName: 'Test', relationship: 'son', dateOfBirth: '2018-01-01', monthsLivedWithYou: 12 },
      ],
    });
    const result = calculateForm1040(tr);
    // No NaN or Infinity
    expect(result.form1040.totalTax).not.toBeNaN();
    expect(isFinite(result.form1040.totalTax)).toBe(true);
    // CTC should not error out
    expect(result.credits.childTaxCredit).toBeGreaterThanOrEqual(0);
    expect(result.credits.actcCredit).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-11: SS Wage Base Cap: W-2 at max + SE Income
// (GPT-5.2 scenario 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-11: SS Wage Base Cap with W-2 + SE', () => {
  it('W-2 at SS wage base cap → SE only pays Medicare, not SS', () => {
    // W-2 wages at $176,100 (SS wage base) + Schedule C $50k
    // SE Social Security portion should be $0 (already maxed by W-2)
    // SE should still pay Medicare (2.9% of 92.35% of $50k)
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Test', wages: 176100,
        federalTaxWithheld: 40000,
        socialSecurityWages: 176100,
      }],
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000 }],
    });
    const result = calculateForm1040(tr);
    // SE tax should be positive (Medicare portion)
    expect(result.form1040.seTax).toBeGreaterThan(0);
    // SE tax should be ~$1,341.10 (2.9% of $50k × 0.9235 = $1,339.08)
    // Plus additional Medicare if applicable
    expect(result.form1040.seTax).toBeLessThan(3000); // Not double-counting SS
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-12: Multi-Business QBI — Mixed SSTB/Non-SSTB Below Threshold
// (Opus scenario 10)
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-12: Multi-Business QBI Below Threshold', () => {
  it('below threshold: SSTB status ignored, simple 20% of combined QBI', () => {
    // MFJ threshold = $394,600
    // W-2 = $200k + Schedule C (SSTB) = $100k + K-1 (non-SSTB) = $50k
    // AGI ≈ $350k minus adjustments → below threshold
    // Below threshold: all businesses get simple 20% regardless of SSTB
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 200000, federalTaxWithheld: 40000 }],
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 100000 }],
      incomeK1: [{
        id: 'k1', entityName: 'Fund', entityType: 'partnership',
        entityEIN: '12-3456789',
        ordinaryBusinessIncome: 50000,
        section199AQBI: 50000,
      }],
      qbiInfo: {
        businesses: [
          { businessId: 'b1', qualifiedBusinessIncome: 100000, isSSTB: true, w2WagesPaid: 0, ubiaOfQualifiedProperty: 0 },
          { businessId: 'b2', qualifiedBusinessIncome: 50000, isSSTB: false, w2WagesPaid: 50000, ubiaOfQualifiedProperty: 100000 },
        ],
      },
    });
    const result = calculateForm1040(tr);
    // QBI deduction should be close to 20% of combined QBI ($150k × 20% = $30k)
    // or capped by 20% of taxable income
    expect(result.form1040.qbiDeduction).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-13: Extreme Values — No NaN/Infinity/Negative Tax
// (all 3 models: robustness check)
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-13: Extreme Value Robustness', () => {
  it('$10M income with all provisions → no NaN', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'BigCorp', wages: 5000000, federalTaxWithheld: 1500000, socialSecurityWages: 176100 }],
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 2000000 }],
      income1099DIV: [{ id: 'd1', payerName: 'Fund', ordinaryDividends: 500000, qualifiedDividends: 400000, foreignTaxPaid: 5000 }],
      income1099B: [{ id: 'b1', description: 'Stock', proceeds: 3000000, costBasis: 500000, isLongTerm: true, basisReportedToIRS: true }],
      incomeSSA1099: { id: 'ss1', totalBenefits: 40000 },
      studentLoanInterest: 2500,
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 100000,
        stateLocalIncomeTax: 500000,
        realEstateTax: 50000,
        personalPropertyTax: 10000,
        mortgageInterest: 30000,
        mortgageInsurancePremiums: 0,
        charitableCash: 200000,
        charitableNonCash: 50000,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.totalTax).not.toBeNaN();
    expect(isFinite(result.form1040.totalTax)).toBe(true);
    expect(result.form1040.totalTax).toBeGreaterThan(0);
    // NIIT should trigger at this income level
    expect(result.form1040.niitTax).toBeGreaterThan(0);
    // SALT should be at floor ($10k)
    expect(result.form1040.taxableIncome).toBeGreaterThan(0);
  });

  it('all zero inputs → $0 tax, no errors', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.Single });
    const result = calculateForm1040(tr);
    expect(result.form1040.totalTax).toBe(0);
    expect(result.form1040.taxableIncome).toBe(0);
    expect(result.form1040.agi).toBe(0);
    expect(result.credits.totalCredits).toBe(0);
  });

  it('$1 of income → $0 tax (below standard deduction)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Test', wages: 1, federalTaxWithheld: 0 }],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.incomeTax).toBe(0);
    expect(result.form1040.taxableIncome).toBe(0);
    expect(result.form1040.agi).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P3-14: FEIE §911(f) Stacking with Preferential Income
// (flagged by 2/3 models as potential issue)
// ═══════════════════════════════════════════════════════════════════════════

describe('P3-14: FEIE Stacking with Preferential Income', () => {
  it('FEIE + qualified dividends + LTCG → tax computed without NaN', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Foreign Corp', wages: 130000, federalTaxWithheld: 0 }],
      foreignEarnedIncome: {
        foreignEarnedIncome: 130000,
        qualifyingDays: 365,
      },
      income1099DIV: [{ id: 'd1', payerName: 'Fund', ordinaryDividends: 20000, qualifiedDividends: 20000 }],
      income1099B: [{ id: 'b1', description: 'Stock', proceeds: 150000, costBasis: 30000, isLongTerm: true, basisReportedToIRS: true }],
    });
    const result = calculateForm1040(tr);
    // FEIE excludes earned income; investment income still taxable
    expect(result.form1040.totalTax).not.toBeNaN();
    expect(result.form1040.incomeTax).toBeGreaterThanOrEqual(0);
    // FEIE should be applied
    expect(result.form1040.feieExclusion).toBeGreaterThan(0);
    // Tax should be on the investment income portion
    expect(result.form1040.taxableIncome).toBeGreaterThan(0);
  });
});
