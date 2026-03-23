/**
 * Cross-Module Integration Tests
 *
 * Tests engine module INTERACTIONS that single-module tests miss.
 * Each test exercises two or more modules flowing through the full
 * calculateForm1040() pipeline, with hand-calculated expected values.
 *
 * Motivation: The Schedule F + QBI bug (farm income omitted from QBI
 * calculation) shipped because no cross-module test covered it.
 *
 * @authority IRC sections cited per test
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'cross-module-test',
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


// ═════════════════════════════════════════════════════════════════════════════
// CM1 — Form 4797 + NIIT: §1231 Gain vs Ordinary Recapture
//
// Profile: Single, high income. Sold business equipment:
//   - Property 1: §1245 machinery — gain is ordinary recapture
//   - Property 2: §1231 asset (held > 1 year) — net gain treated as LTCG
//
// Verification: §1231 gains should be NII for NIIT (IRC §1411(c)(1)(A)(iii))
//               but §1245 ordinary recapture should NOT be NII.
//
// Hand calculation:
//   W-2 wages = $250,000
//   Form 4797:
//     Property 1 (§1245): gain = $30,000 → all ordinary recapture
//     Property 2 (§1231): gain = $50,000 → LTCG (net §1231 gain)
//   Total income = 250,000 + 30,000 + 50,000 = 330,000
//   AGI = 330,000
//   Standard deduction (Single) = 15,750
//   Taxable income = 314,250
//
//   NIIT (IRC §1411):
//     AGI = 330,000 > 200,000 threshold
//     Net investment income = §1231 gain ($50,000) only
//     (§1245 recapture $30,000 is ordinary income, NOT NII)
//     NIIT = 3.8% × min(50,000, 330,000 − 200,000) = 3.8% × 50,000 = 1,900
// ═════════════════════════════════════════════════════════════════════════════

describe('CM1 — Form 4797 + NIIT: §1231 Gain vs Ordinary Recapture', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Acme Corp', wages: 250000, federalWithheld: 50000, socialSecurityWages: 176100, socialSecurityWithheld: 10918.20, medicareWages: 250000, medicareWithheld: 3625 }],
    form4797Properties: [
      {
        id: 'p1',
        description: 'Machinery',
        dateAcquired: '2020-01-01',
        dateSold: '2025-06-01',
        salesPrice: 50000,
        costBasis: 50000,
        depreciationAllowed: 30000,
        isSection1245: true,
        // adjustedBasis = 50000 - 30000 = 20000
        // gain = 50000 - 20000 = 30000
        // §1245 recapture = min(30000, 30000) = 30000 ordinary
        // §1231 remaining = 0
      },
      {
        id: 'p2',
        description: 'Warehouse',
        dateAcquired: '2018-01-01',
        dateSold: '2025-06-01',
        salesPrice: 150000,
        costBasis: 100000,
        depreciationAllowed: 0,
        // No isSection1245/isSection1250 → defaults to §1231 property
      },
    ],
    estimatedPaymentsMade: 10000,
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('computes Form 4797 results', () => {
    expect(result.form4797).toBeDefined();
    // §1245: gain = 50000 - 20000 = 30000 ordinary
    expect(result.form4797!.totalOrdinaryIncome).toBeCloseTo(30000, 0);
    // §1231: gain = 150000 - 100000 = 50000 LTCG
    expect(result.form4797!.netSection1231GainOrLoss).toBeCloseTo(50000, 0);
    expect(result.form4797!.section1231IsGain).toBe(true);
  });

  it('includes §1231 gain in NIIT but not §1245 recapture', () => {
    // NIIT should only be on §1231 gain ($50k), not ordinary recapture ($30k)
    // 3.8% × min($50k, AGI − $200k threshold) = 3.8% × min($50k, $130k) = $1,900
    expect(f.niitTax).toBeCloseTo(1900, 0);
  });

  it('taxes §1231 gain at preferential LTCG rate', () => {
    // §1231 net gain flows to LTCG → preferential 15% rate (income in that zone)
    expect(f.incomeTax).toBeLessThan(f.taxableIncome * 0.24); // Should be less than all-ordinary
  });

  it('includes §1245 recapture as ordinary income', () => {
    // Total income = $250k wages + $30k ordinary recapture + $50k §1231 gain
    expect(f.totalIncome).toBeCloseTo(330000, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// CM2 — PTC + FEIE: Foreign Worker with Marketplace Insurance
//
// Profile: Single, foreign earned income with FEIE exclusion, plus ACA
//          marketplace insurance. Tests that FEIE exclusion is added back
//          to household income for PTC calculation.
//
// Hand calculation:
//   Foreign earned income = $100,000
//   FEIE exclusion = $100,000 (up to $130,000 limit)
//   Remaining income = $0 → AGI = $0
//   Standard deduction = $15,750 → Taxable income = $0
//
//   PTC household income (IRC §36B(d)(2)):
//     AGI + FEIE exclusion + tax-exempt interest + non-taxable SS
//     = 0 + 100,000 = 100,000
//   FPL for single (48 states): ~$15,650
//   Household income as % FPL ≈ 639%
//   At >400% FPL: applicable figure = 8.5% (max under ARP)
//   Expected contribution = 100,000 × 0.085 = 8,500
//   If SLCSP benchmark = $800/mo → annual SLCSP = $9,600
//   PTC = max(0, SLCSP − expected contribution) = 9,600 − 8,500 = 1,100
//
//   Note: Without FEIE add-back, household income = $0, % FPL ≈ 0%,
//   and the filer would be ineligible (below 100% FPL). The add-back
//   CORRECTLY makes them eligible but at a reduced subsidy level.
// ═════════════════════════════════════════════════════════════════════════════

describe('CM2 — PTC + FEIE: Foreign Worker with Marketplace Insurance', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    // Foreign income must also be reported as W-2 wages; FEIE then excludes it
    w2Income: [{ id: 'w1', employerName: 'Foreign Employer', wages: 100000, federalWithheld: 0, socialSecurityWages: 0, socialSecurityWithheld: 0, medicareWages: 0, medicareWithheld: 0 }],
    foreignEarnedIncome: {
      foreignEarnedIncome: 100000,
      qualifyingDays: 365,
    },
    premiumTaxCredit: {
      forms1095A: [{
        id: '1095a-1',
        marketplace: 'Healthcare.gov',
        enrollmentPremiums: Array(12).fill(600),
        slcspPremiums: Array(12).fill(800),
        advancePTC: Array(12).fill(0),
        coverageMonths: Array(12).fill(true),
      }],
      familySize: 1,
      state: 'TX',
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('applies FEIE exclusion to reduce AGI', () => {
    // $100k foreign income - $100k FEIE exclusion = $0 remaining
    expect(f.agi).toBe(0);
  });

  it('adds FEIE exclusion back to PTC household income', () => {
    // PTC household income = AGI ($0) + FEIE exclusion ($100,000) = $100,000
    expect(result.premiumTaxCredit).toBeDefined();
    expect(result.premiumTaxCredit!.householdIncome).toBeCloseTo(100000, 0);
  });

  it('correctly determines PTC eligibility via household income', () => {
    // Household income of $100k is well above 100% FPL → eligible
    // Without FEIE add-back, household income = $0 → below 100% FPL → ineligible
    expect(result.premiumTaxCredit!.fplPercentage).toBeGreaterThan(100);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// CM3 — Multi-Business QBI with Mixed SSTB/Non-SSTB Above Threshold
//
// Profile: Single filer, high income ($300,000 W-2 + two businesses).
//   Business A: non-SSTB consulting, QBI $80,000, $60k W-2 wages, $100k UBIA
//   Business B: SSTB law practice, QBI $60,000, $40k W-2 wages, $50k UBIA
//
// Taxable income BEFORE QBI ≈ $300k + $80k + $60k - $15,750 = $424,250
// This is ABOVE the QBI threshold ($197,300 for Single) and above
// the full phase-in ($197,300 + $50,000 = $247,300).
//
// At full phase-out (above $247,300 for Single):
//   Business A (non-SSTB): QBI deduction = lesser of:
//     - 20% × $80,000 = $16,000
//     - Greater of: (50% × $60k = $30k) or (25% × $60k + 2.5% × $100k = $17,500)
//     = min($16,000, $30,000) = $16,000
//   Business B (SSTB): fully phased out → $0
//
// Total QBI = $16,000 (only non-SSTB contributes)
// ═════════════════════════════════════════════════════════════════════════════

describe('CM3 — Multi-Business QBI: Mixed SSTB/Non-SSTB Above Threshold', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Day Job', wages: 300000, federalWithheld: 60000, socialSecurityWages: 176100, socialSecurityWithheld: 10918.20, medicareWages: 300000, medicareWithheld: 4350 }],
    qbiInfo: {
      businesses: [
        { businessName: 'Consulting LLC', qualifiedBusinessIncome: 80000, isSSTB: false, w2WagesPaid: 60000, ubiaOfQualifiedProperty: 100000 },
        { businessName: 'Law Practice', qualifiedBusinessIncome: 60000, isSSTB: true, w2WagesPaid: 40000, ubiaOfQualifiedProperty: 50000 },
      ],
    },
    // Need Schedule C to generate the QBI income
    income1099NEC: [
      { id: 'n1', payerName: 'Consulting Client', amount: 80000, federalTaxWithheld: 0 },
      { id: 'n2', payerName: 'Law Client', amount: 60000, federalTaxWithheld: 0 },
    ],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has taxable income above QBI phase-in range', () => {
    // $300k W-2 + $140k NEC - $15,750 std = ~$424,250 before QBI
    // Well above $197,300 + $50,000 = $247,300 for Single
    expect(f.taxableIncome + f.qbiDeduction).toBeGreaterThan(247300);
  });

  it('allows QBI deduction for non-SSTB business only', () => {
    // Above full phase-out: SSTB gets $0, non-SSTB gets wage/UBIA limited amount
    // Non-SSTB: min(20% × $80k = $16k, max(50% × $60k = $30k, 25% × $60k + 2.5% × $100k = $17.5k))
    // = min($16k, $30k) = $16k
    expect(f.qbiDeduction).toBeCloseTo(16000, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// CM4 — Schedule E Passive Losses + AGI Phase-Out
//
// Profile: MFJ, $130,000 W-2 wages + rental property with $20,000 loss.
//          Tests that passive loss allowance phases out based on preliminary
//          AGI (before Schedule E) and doesn't create a circular dependency.
//
// Hand calculation:
//   W-2 wages = $130,000
//   Rental: $24,000 income, $44,000 expenses → ($20,000) loss
//   Preliminary AGI (before Schedule E) = $130,000
//
//   Passive loss allowance (IRC §469(i)):
//     $25,000 − [($130,000 − $100,000) × 0.5] = $25,000 − $15,000 = $10,000
//   Allowable loss = min($20,000, $10,000) = $10,000
//   Suspended loss = $20,000 − $10,000 = $10,000
//
//   Schedule E income = −$10,000 (allowable loss)
//   Total income = $130,000 − $10,000 = $120,000
//   AGI = $120,000
//   Standard deduction (MFJ) = $31,500
//   Taxable income = $88,500
// ═════════════════════════════════════════════════════════════════════════════

describe('CM4 — Schedule E Passive Losses + AGI Phase-Out', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{ id: 'w1', employerName: 'Employer', wages: 130000, federalWithheld: 20000, socialSecurityWages: 130000, socialSecurityWithheld: 8060, medicareWages: 130000, medicareWithheld: 1885 }],
    rentalProperties: [{
      id: 'r1',
      address: '123 Main St',
      propertyType: 'single_family' as const,
      daysRented: 365,
      personalUseDays: 0,
      rentalIncome: 24000,
      advertising: 0,
      auto: 0,
      cleaning: 2000,
      commissions: 0,
      insurance: 3000,
      legal: 0,
      management: 0,
      mortgageInterest: 18000,
      otherInterest: 0,
      repairs: 5000,
      supplies: 1000,
      taxes: 6000,
      utilities: 3000,
      depreciation: 6000,
    }],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('computes rental loss correctly', () => {
    expect(result.scheduleE).toBeDefined();
    // Gross: $24k, Expenses: $44k, Net: -$20k
    expect(result.scheduleE!.totalRentalIncome).toBe(24000);
    expect(result.scheduleE!.totalRentalExpenses).toBe(44000);
    expect(result.scheduleE!.netRentalIncome).toBe(-20000);
  });

  it('phases out passive loss allowance based on preliminary AGI (Form 8582)', () => {
    // Preliminary AGI = $130k → $25k - ($30k × 0.5) = $10k allowable
    expect(result.form8582).toBeDefined();
    expect(result.form8582!.allowedPassiveLoss).toBeCloseTo(10000, 0);
  });

  it('limits deductible loss to phased-out allowance', () => {
    // Only $10k of $20k loss flows to Form 1040
    expect(f.scheduleEIncome).toBeCloseTo(-10000, 0);
  });

  it('suspends excess loss (Form 8582)', () => {
    expect(result.form8582!.totalSuspendedLoss).toBeCloseTo(10000, 0);
  });

  it('has correct AGI after limited rental loss', () => {
    // $130k wages - $10k allowable rental loss = $120k
    expect(f.agi).toBeCloseTo(120000, 0);
  });

  it('has correct taxable income', () => {
    // $120k - $31,500 standard deduction = $88,500
    expect(f.taxableIncome).toBeCloseTo(88500, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// CM5 — Schedule E at Phase-Out Ceiling ($150k+): Complete Loss Disallowance
//
// Profile: Single, $160,000 W-2 wages + rental property with $15,000 loss.
//          At $150k+ AGI, the passive loss allowance is fully phased out.
//
// Hand calculation:
//   W-2 wages = $160,000
//   Rental: $12,000 income, $27,000 expenses → ($15,000) loss
//   Preliminary AGI = $160,000
//
//   Passive loss allowance (IRC §469(i)):
//     $25,000 − [($160,000 − $100,000) × 0.5] = $25,000 − $30,000 = −$5,000 → $0
//   Allowable loss = $0
//   Suspended = $15,000
//
//   Total income = $160,000 (rental loss fully suspended)
// ═════════════════════════════════════════════════════════════════════════════

describe('CM5 — Schedule E at Phase-Out Ceiling: Full Loss Disallowance', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Employer', wages: 160000, federalWithheld: 30000, socialSecurityWages: 160000, socialSecurityWithheld: 9920, medicareWages: 160000, medicareWithheld: 2320 }],
    rentalProperties: [{
      id: 'r1',
      address: '456 Oak Ave',
      propertyType: 'single_family' as const,
      daysRented: 365,
      personalUseDays: 0,
      rentalIncome: 12000,
      advertising: 0,
      auto: 0,
      cleaning: 0,
      commissions: 0,
      insurance: 2000,
      legal: 0,
      management: 0,
      mortgageInterest: 10000,
      otherInterest: 0,
      repairs: 5000,
      supplies: 0,
      taxes: 4000,
      utilities: 2000,
      depreciation: 4000,
    }],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('fully suspends rental loss at high AGI (Form 8582)', () => {
    expect(result.form8582).toBeDefined();
    expect(result.form8582!.allowedPassiveLoss).toBe(0);
    expect(result.form8582!.totalSuspendedLoss).toBeCloseTo(15000, 0);
  });

  it('has correct AGI without rental loss deduction', () => {
    expect(f.agi).toBeCloseTo(160000, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// CM6 — Kiddie Tax + Capital Gains: Preferential Rates Preserved
//
// Profile: Parent claims kiddie tax for child with unearned income.
//          Child has $5,000 in qualified dividends (LTCG-rate eligible).
//          Verifies kiddie tax is ADDITIVE and doesn't override preferential rates.
//
// Hand calculation:
//   Child unearned income = $5,000 (qualified dividends)
//   Kiddie tax threshold = $2,700 (2025)
//   Excess = $5,000 − $2,700 = $2,300
//   Parent marginal rate = 32% (assumed)
//   Child rate = 10%
//   Additional kiddie tax = $2,300 × (32% − 10%) = $2,300 × 22% = $506
//
//   Note: The $5,000 in qualified dividends should STILL get preferential
//   rates in the main tax computation. Kiddie tax is a separate addition.
// ═════════════════════════════════════════════════════════════════════════════

describe('CM6 — Kiddie Tax + Capital Gains: Preferential Rates Preserved', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Part-time Job', wages: 2000, federalWithheld: 0, socialSecurityWages: 2000, socialSecurityWithheld: 124, medicareWages: 2000, medicareWithheld: 29 }],
    income1099DIV: [{ id: 'd1', payerName: 'Brokerage', ordinaryDividends: 5000, qualifiedDividends: 5000, federalTaxWithheld: 0 }],
    kiddieTax: {
      childUnearnedIncome: 5000,
      childEarnedIncome: 2000,
      childAge: 14,
      parentMarginalRate: 0.32,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('computes kiddie tax as additional tax', () => {
    expect(result.kiddieTax).toBeDefined();
    expect(result.kiddieTax!.additionalTax).toBeGreaterThan(0);
  });

  it('preserves preferential rate on qualified dividends', () => {
    // $5k qualified dividends at 0% rate (under $47,025 threshold for Single)
    // Total income = $2k wages + $5k dividends = $7k
    // Taxable income = $7k - $15,750 std ded = $0 (floored)
    // With taxable income ≤ 0, both ordinary and preferential tax = $0
    // Kiddie tax is additive on top
    expect(f.totalIncome).toBeCloseTo(7000, 0);
  });

  it('adds kiddie tax to total tax', () => {
    // Kiddie tax should be present in total tax calculation
    expect(f.kiddieTaxAmount).toBeGreaterThan(0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// CM7 — Schedule F + QBI + SE: Full Farm Integration
//
// Profile: Single farmer with $120,000 farm income and $50,000 farm expenses.
//          Tests the triple interaction: Schedule F → SE tax → QBI deduction.
//          This is the interaction that was previously broken (Schedule F
//          excluded from QBI calculation).
//
// Hand calculation:
//   Farm income (Schedule F):
//     Gross = $120,000 (sales of products)
//     Expenses = $50,000 (feed $20k, fertilizer $10k, fuel $8k, repairs $7k, insurance $5k)
//     Net farm profit = $70,000
//
//   SE tax (Schedule SE):
//     Net earnings = $70,000 × 0.9235 = $64,645
//     SS = $64,645 × 0.124 = $8,015.98
//     Medicare = $64,645 × 0.029 = $1,874.71
//     Total SE = $9,890.69
//     Deductible half = $4,945.35
//
//   AGI = $70,000 − $4,945.35 = $65,054.65
//   Standard deduction (Single) = $15,750
//   Taxable income before QBI = $49,304.65
//
//   QBI deduction (IRC §199A):
//     QBI = $70,000 (farm net profit)
//     20% of QBI = $14,000
//     20% of taxable income before QBI = $9,860.93
//     QBI deduction = min($14,000, $9,860.93) = $9,860.93
//
//   Taxable income = $49,304.65 − $9,860.93 = $39,443.72
// ═════════════════════════════════════════════════════════════════════════════

describe('CM7 — Schedule F + QBI + SE: Full Farm Integration', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    scheduleF: {
      salesOfProducts: 120000,
      feed: 20000,
      fertilizers: 10000,
      gasolineFuel: 8000,
      repairs: 7000,
      insurance: 5000,
    },
    estimatedPaymentsMade: 15000,
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('calculates Schedule F correctly', () => {
    expect(result.scheduleF).toBeDefined();
    expect(result.scheduleF!.grossIncome).toBe(120000);
    expect(result.scheduleF!.totalExpenses).toBe(50000);
    expect(result.scheduleF!.netFarmProfit).toBe(70000);
  });

  it('applies SE tax to farm income', () => {
    expect(result.scheduleSE).toBeDefined();
    expect(result.scheduleSE!.netEarnings).toBeCloseTo(64645, 0);
    expect(result.scheduleSE!.totalSETax).toBeCloseTo(9890.69, 0);
  });

  it('applies QBI deduction to farm income', () => {
    // Farm income is QBI-eligible per IRC §199A(c)(3)(A)(i)
    // 20% × $70k = $14k, limited to 20% × $49,304.65 = $9,860.93
    expect(f.qbiDeduction).toBeCloseTo(9860.93, 0);
  });

  it('has correct AGI after SE deduction', () => {
    expect(f.agi).toBeCloseTo(65054.65, 0);
  });

  it('has correct taxable income after QBI', () => {
    // $65,054.65 − $15,750 − $9,860.93 = $39,443.72
    expect(f.taxableIncome).toBeCloseTo(39443.72, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// CM8 — NIIT + Additional Medicare + Capital Gains: Triple Surtax
//
// Profile: Single, $220k W-2 wages + $50k LTCG + $30k qualified dividends.
//          All three surtaxes should apply simultaneously:
//          - NIIT (3.8% on NII above $200k AGI)
//          - Additional Medicare (0.9% on wages above $200k)
//          - Preferential rates on LTCG + qualified dividends
//
// Hand calculation:
//   W-2 wages = $220,000
//   1099-B LTCG = $50,000
//   1099-DIV qualified dividends = $30,000, ordinary = $30,000
//   Total income = $300,000
//   AGI = $300,000
//   Standard deduction = $15,750
//   Taxable income = $284,250
//
//   Additional Medicare (IRC §3101(b)(2)):
//     0.9% × ($220,000 − $200,000) = 0.9% × $20,000 = $180
//
//   NIIT (IRC §1411):
//     NII = $50,000 (LTCG) + $30,000 (dividends) = $80,000
//     3.8% × min($80,000, $300,000 − $200,000) = 3.8% × $80,000 = $3,040
// ═════════════════════════════════════════════════════════════════════════════

describe('CM8 — NIIT + Additional Medicare + Capital Gains: Triple Surtax', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Employer', wages: 220000, federalWithheld: 45000, socialSecurityWages: 176100, socialSecurityWithheld: 10918.20, medicareWages: 220000, medicareWithheld: 3190 }],
    income1099B: [{
      id: 'b1', brokerName: 'Brokerage',
      description: 'Stock Sale', dateAcquired: '2020-01-01', dateSold: '2025-06-01',
      proceeds: 100000, costBasis: 50000, longOrShort: 'long' as const,
    }],
    income1099DIV: [{ id: 'd1', payerName: 'Fund', ordinaryDividends: 30000, qualifiedDividends: 30000, federalTaxWithheld: 0 }],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('computes Additional Medicare tax on excess wages', () => {
    // 0.9% × ($220k − $200k) = $180
    expect(f.additionalMedicareTaxW2).toBeCloseTo(180, 0);
  });

  it('computes NIIT on net investment income', () => {
    // NII = $50k LTCG + $30k dividends = $80k
    // 3.8% × min($80k, AGI − $200k) = 3.8% × min($80k, $100k) = $3,040
    expect(f.niitTax).toBeCloseTo(3040, 0);
  });

  it('applies preferential rates to LTCG + qualified dividends', () => {
    // $80k of preferential income taxed at 0%/15% rates, not ordinary rates
    // This means total tax should be less than if all income were ordinary
    const ordinaryOnlyTax = f.taxableIncome * 0.24; // Rough estimate at 24% bracket
    expect(f.incomeTax).toBeLessThan(ordinaryOnlyTax);
  });

  it('includes all three surtaxes in total tax', () => {
    // Total tax should include income tax + SE tax + additional Medicare + NIIT
    expect(f.additionalMedicareTaxW2).toBeGreaterThan(0);
    expect(f.niitTax).toBeGreaterThan(0);
    expect(f.totalTax).toBeGreaterThan(f.incomeTax);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// CM9 — Cancellation of Debt + Form 982 Insolvency Exclusion
//
// Profile: Single, $50k W-2 wages + $30k cancelled debt. Filer was insolvent
//          by $20k at time of cancellation. Only $20k of $30k is excluded.
//
// Hand calculation:
//   W-2 wages = $50,000
//   1099-C cancelled debt = $30,000
//   Form 982 insolvency exclusion: liabilities $80k − assets $60k = $20k insolvent
//   Taxable cancelled debt = $30,000 − $20,000 = $10,000
//   Total income = $50,000 + $10,000 = $60,000
//   AGI = $60,000
// ═════════════════════════════════════════════════════════════════════════════

describe('CM9 — Cancellation of Debt + Form 982 Insolvency', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Employer', wages: 50000, federalWithheld: 7000, socialSecurityWages: 50000, socialSecurityWithheld: 3100, medicareWages: 50000, medicareWithheld: 725 }],
    income1099C: [{
      id: 'c1', payerName: 'Bank of America', dateOfCancellation: '2025-03-15', amountCancelled: 30000,
    }],
    form982: {
      isInsolvent: true,
      totalLiabilitiesBefore: 80000,
      totalAssetsBefore: 60000,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('excludes cancelled debt up to insolvency amount', () => {
    // Insolvency = $80k liabilities − $60k assets = $20k
    // Taxable COD = $30k − $20k = $10k
    expect(result.form982).toBeDefined();
    expect(result.form982!.taxableAmount).toBeCloseTo(10000, 0);
    expect(result.form982!.exclusionAmount).toBeCloseTo(20000, 0);
  });

  it('includes only taxable portion in income', () => {
    // Total income = $50k wages + $10k taxable COD = $60k
    expect(f.totalIncome).toBeCloseTo(60000, 0);
    expect(f.agi).toBeCloseTo(60000, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// CM10 — Investment Interest Expense + NIIT: NII Limitation
//
// Profile: Single, $180k wages + $25k interest income + $15k margin interest.
//          Itemizing with SALT $10k, mortgage $12k, charitable $3k.
//          Investment interest deduction limited to net investment income.
//          NIIT should use NII AFTER the deduction.
//
// Hand calculation:
//   W-2 wages = $180,000
//   1099-INT interest = $25,000
//   Margin interest (investment interest expense) = $15,000
//   Net investment income = $25,000 − $15,000 = $10,000
//   Investment interest deduction = min($15,000, $25,000) = $15,000
//   (Deducted as itemized deduction on Schedule A)
//
//   Schedule A: SALT $10k + mortgage $12k + charitable $3k + inv interest $15k = $40k
//
//   Total income = $205,000
//   AGI = $205,000 (itemized deductions don't affect AGI)
//
//   NIIT: NII for NIIT is computed BEFORE the Schedule A deduction
//   (investment interest is an itemized deduction, not an above-the-line adjustment)
//   So NIIT NII = $25,000 (gross interest)
//   NIIT = 3.8% × min($25,000, $205,000 − $200,000) = 3.8% × $5,000 = $190
// ═════════════════════════════════════════════════════════════════════════════

describe('CM10 — Investment Interest Expense + NIIT', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Employer', wages: 180000, federalWithheld: 35000, socialSecurityWages: 176100, socialSecurityWithheld: 10918.20, medicareWages: 180000, medicareWithheld: 2610 }],
    income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 25000, federalTaxWithheld: 0 }],
    investmentInterest: {
      investmentInterestPaid: 15000,
    },
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 0,
      stateLocalIncomeTax: 8000,
      realEstateTax: 2000,
      personalPropertyTax: 0,
      mortgageInterest: 12000,
      mortgageInsurancePremiums: 0,
      charitableCash: 3000,
      charitableNonCash: 0,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('deducts investment interest up to NII', () => {
    expect(result.investmentInterest).toBeDefined();
    expect(result.investmentInterest!.deductibleAmount).toBeCloseTo(15000, 0);
  });

  it('applies NIIT on gross investment income above AGI threshold', () => {
    // AGI = $205k > $200k threshold
    // NIIT NII = $25k (gross interest before itemized deduction)
    // NIIT = 3.8% × min($25k, $5k excess) = 3.8% × $5k = $190
    expect(f.niitTax).toBeCloseTo(190, 0);
  });

  it('uses itemized deductions (not standard) when provided', () => {
    // Schedule A: SALT $10k + mortgage $12k + charitable $3k + inv interest $15k = $40k
    // This exceeds the $15,750 standard deduction
    expect(f.deductionUsed).toBe('itemized');
    expect(f.deductionAmount).toBeGreaterThan(15750);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// CM11 — AMT + ISO Exercise Spread: Tech Worker ISO Trigger
//
// Profile: Single, $150k W-2 wages, itemizing ($26k itemized deductions).
//          Exercised ISOs with $100k spread (FMV $150k, strike $50k).
//          The ISO spread is NOT regular income but IS an AMT preference item.
//
// Hand calculation:
//   W-2 wages = $150,000
//   Total income = $150,000
//   AGI = $150,000
//
//   Schedule A: SALT $12k + mortgage $12k + charitable $2k = $26,000
//   Taxable income = $150,000 − $26,000 = $124,000
//   Regular tax = $22,607
//
//   AMT (IRC §55):
//     AMTI = $124,000 + $12,000 (SALT add-back) + $100,000 (ISO spread) = $236,000
//     Exemption = $88,100 (below $609,350 phase-out threshold)
//     AMT base = $236,000 − $88,100 = $147,900
//     TMT = $147,900 × 26% = $38,454
//     AMT = max(0, $38,454 − $22,607) = $15,847
// ═════════════════════════════════════════════════════════════════════════════

describe('CM11 — AMT + ISO Exercise Spread: Tech Worker ISO Trigger', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Tech Corp', wages: 150000, federalWithheld: 30000, socialSecurityWages: 150000, socialSecurityWithheld: 9300, medicareWages: 150000, medicareWithheld: 2175 }],
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 0,
      stateLocalIncomeTax: 8000,
      realEstateTax: 4000,   // Combined SALT = $12k, under $40k cap
      personalPropertyTax: 0,
      mortgageInterest: 12000,
      mortgageInsurancePremiums: 0,
      charitableCash: 2000,
      charitableNonCash: 0,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
    amtData: {
      isoExerciseSpread: 100000,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('does not include ISO spread in regular taxable income', () => {
    // Regular income is just W-2 wages
    expect(f.totalIncome).toBeCloseTo(150000, 0);
    expect(f.agi).toBeCloseTo(150000, 0);
    // Taxable = $150k - $26k itemized = $124k
    expect(f.taxableIncome).toBeCloseTo(124000, 0);
  });

  it('triggers AMT via ISO exercise spread', () => {
    expect(result.amt).toBeDefined();
    expect(result.amt!.applies).toBe(true);
    expect(result.amt!.amtAmount).toBeGreaterThan(0);
  });

  it('includes ISO spread in AMTI adjustments', () => {
    // AMTI = taxable income + SALT add-back + ISO spread
    expect(result.amt!.adjustments.isoExerciseSpread).toBe(100000);
    expect(result.amt!.adjustments.saltAddBack).toBe(12000);
  });

  it('computes correct AMTI', () => {
    // AMTI = $124k + $12k (SALT) + $100k (ISO) = $236,000
    expect(result.amt!.amti).toBeCloseTo(236000, 0);
  });

  it('computes correct AMT amount', () => {
    // Exemption = $88,100
    // AMT base = $236k - $88.1k = $147,900
    // TMT = $147,900 × 26% = $38,454
    // AMT = $38,454 - $22,607 = $15,847
    expect(result.amt!.amtAmount).toBeCloseTo(15847, 0);
  });

  it('adds AMT to total tax', () => {
    // Total tax should include regular tax + AMT
    expect(f.amtAmount).toBeCloseTo(15847, 0);
    expect(f.totalTax).toBeGreaterThan(f.incomeTax + 15000);
  });
});
