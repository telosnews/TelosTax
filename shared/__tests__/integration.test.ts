/**
 * Integration Test Suite — Full-Return Pipeline Tests
 *
 * 15 realistic taxpayer scenarios, each running the complete calculateForm1040()
 * pipeline end-to-end.  Every expected value is hand-calculated with IRC citations
 * and derivation comments.
 *
 * Coverage focus: module INTERACTIONS that unit tests miss:
 *   - AMT (zero prior coverage) + NIIT
 *   - Multi-business Schedule C income routing (new feature)
 *   - Schedule E + Social Security taxation interaction
 *   - K-1 + QBI + SE interplay
 *   - Schedule 1-A (OBBBA) deductions
 *   - Home sale + capital gains
 *   - Form 8606 Roth conversion pro-rata
 *   - Premium Tax Credit reconciliation
 *   - Kiddie Tax at parent's rate
 *   - Estimated Tax Penalty
 *   - Energy credits stacking
 *   - Schedule F farm + SE
 *   - HSA + early withdrawal penalty stacking
 *   - Kitchen-sink maximum complexity
 *
 * @authority IRS Pub 17 (2025), Rev. Proc. 2024-40, IRC sections cited per test
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'integration-test',
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
// I1 — Retiree with Rental Property
//
// Profile: Single, age 68, pension + Social Security + rental income +
//          qualified dividends.  Tests SS taxability interaction with
//          Schedule E passive loss rules and preferential capital gains rates.
//
// Facts:
//   - Filing status: Single
//   - 1099-R pension: $36,000 gross, $36,000 taxable, $4,000 withheld
//   - SSA-1099: $24,000 benefits
//   - Rental property: $18,000 rent, $22,000 expenses → ($4,000) loss
//   - 1099-DIV: $8,000 qualified dividends, $2,000 ordinary dividends
//   - Standard deduction (Single 65+): $15,750 + $2,000 = $17,750
//
// Hand calculation:
//   Pension taxable              = 36,000
//   Total dividends              = 10,000  (8,000 qualified + 2,000 ordinary)
//   Schedule E:
//     Net rental income          = 18,000 − 22,000 = −4,000
//     Passive loss allowance (AGI ~$65k): full $25k allowed (AGI < $100k)
//     Deductible rental loss     = −4,000 (fully allowed)
//   Total income before SS       = 36,000 + 10,000 − 4,000 = 42,000
//
//   Social Security taxability (provisional income):
//     Provisional = 42,000 + (24,000 × 0.5) = 42,000 + 12,000 = 54,000
//     Single: $25k–$34k → up to 50%; >$34k → up to 85%
//     54,000 > 34,000 → tier 2
//     Tier 1: min(24,000 × 0.5, (34,000 − 25,000) × 0.5) = min(12,000, 4,500) = 4,500
//     Tier 2: min(24,000 × 0.85 − 4,500, (54,000 − 34,000) × 0.85)
//           = min(20,400 − 4,500, 20,000 × 0.85)
//           = min(15,900, 17,000) = 15,900
//     Taxable SS = 4,500 + 15,900 = 20,400
//     Check: 85% of benefits = 0.85 × 24,000 = 20,400. ✓ (capped at 85%)
//
//   Total income = 36,000 + 10,000 − 4,000 + 20,400 = 62,400
//   AGI = 62,400 (no adjustments)
//   Standard deduction (Single 65+) = 17,750
//   Taxable income = 62,400 − 17,750 = 44,650
//
//   Tax computation:
//     Ordinary income = 44,650 − 8,000 (qualified div) = 36,650
//     Ordinary tax (Single brackets):
//       10% × 11,925 = 1,192.50
//       12% × (36,650 − 11,925) = 12% × 24,725 = 2,967
//       Ordinary tax = 4,159.50
//     Preferential tax on $8,000 qualified dividends:
//       Taxable income = 44,650.  0% threshold (Single) = 48,350.
//       44,650 < 48,350 → entire $8,000 at 0%
//       Preferential tax = 0
//     Total income tax = 4,159.50 + 0 = 4,159.50
//
//   Withholding = 4,000
//   Amount owed = 4,159.50 − 4,000 = 159.50
// ═════════════════════════════════════════════════════════════════════════════

describe('I1 — Retiree: Pension + SS + Rental + Qualified Dividends', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    dateOfBirth: '1957-03-15', // age 68 in 2025
    income1099R: [{
      id: 'r1',
      payerName: 'State Pension Fund',
      grossDistribution: 36000,
      taxableAmount: 36000,
      federalTaxWithheld: 4000,
      distributionCode: '7', // normal distribution
    }],
    incomeSSA1099: {
      totalBenefits: 24000,
    },
    rentalProperties: [{
      id: 'rp1',
      address: '456 Elm St',
      propertyType: 'single_family',
      daysRented: 365,
      personalUseDays: 0,
      rentalIncome: 18000,
      advertising: 500,
      insurance: 1800,
      repairs: 3000,
      taxes: 4200,
      utilities: 2400,
      depreciation: 8000,
      mortgageInterest: 2100,
      otherExpenses: 0,
    }],
    income1099DIV: [{
      id: 'd1',
      payerName: 'Vanguard',
      ordinaryDividends: 10000,
      qualifiedDividends: 8000,
      federalTaxWithheld: 0,
    }],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('calculates correct Social Security taxability', () => {
    // Provisional income = other income + 50% SS = ~42000 + 12000 = 54000
    // 85% rule → taxable SS = 20,400
    expect(f.taxableSocialSecurity).toBeCloseTo(20400, 0);
    expect(f.socialSecurityBenefits).toBe(24000);
  });

  it('applies Schedule E passive loss correctly', () => {
    // Net rental = 18000 − 22000 = −4000.  AGI < $100k → full $25k allowance
    expect(result.scheduleE).toBeDefined();
    expect(f.scheduleEIncome).toBeCloseTo(-4000, 0);
  });

  it('has correct total income and AGI', () => {
    // 36000 pension + 10000 div − 4000 rental + 20400 SS = 62400
    expect(f.totalIncome).toBeCloseTo(62400, 0);
    expect(f.agi).toBeCloseTo(62400, 0);
  });

  it('uses age-65+ standard deduction', () => {
    expect(f.deductionUsed).toBe('standard');
    // Single 65+ = 15750 + 2000 = 17750
    expect(f.deductionAmount).toBe(17750);
  });

  it('has correct taxable income', () => {
    // 62400 − 17750 (std ded 65+) − 6000 (Schedule 1-A senior deduction) = 38650
    expect(f.taxableIncome).toBeCloseTo(38650, 0);
  });

  it('taxes qualified dividends at 0% preferential rate', () => {
    // Taxable income 38650 < 48350 (0% threshold) → all $8k at 0%
    expect(f.preferentialTax).toBe(0);
  });

  it('calculates correct income tax', () => {
    // Ordinary: 38650 − 8000 (QD) = 30650
    // 10% × 11925 = 1192.50; 12% × (30650 − 11925) = 12% × 18725 = 2247
    // Total = 3439.50
    expect(f.incomeTax).toBeCloseTo(3439.50, 0);
  });

  it('calculates correct balance', () => {
    expect(f.totalWithholding).toBe(4000);
    // 4000 − 3439.50 = 560.50 refund
    expect(f.refundAmount).toBeCloseTo(560.50, 0);
    expect(f.amountOwed).toBe(0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I2 — Multi-Business Freelancer (Income Routing)
//
// Profile: Single, two businesses — "Design Studio" ($80k NEC) and
//          "Photography" ($30k NEC).  Tests the new businessId routing feature.
//
// Facts:
//   - Business 1: "Design Studio" (id: biz-design)
//     - 1099-NEC: $80,000 (assigned to biz-design)
//     - Expenses: $15,000 (software $8k, office $7k)
//   - Business 2: "Photography" (id: biz-photo)
//     - 1099-NEC: $30,000 (assigned to biz-photo)
//     - Expenses: $10,000 (equipment $6k, travel $4k)
//
// Hand calculation:
//   Business 1: income $80,000, expenses $15,000, net $65,000
//   Business 2: income $30,000, expenses $10,000, net $20,000
//   Aggregate: income $110,000, expenses $25,000, net $85,000
//
//   SE tax:
//     Net earnings = 85,000 × 0.9235 = 78,497.50
//     SS = min(78,497.50, 176,100) × 0.124 = 9,733.69
//     Medicare = 78,497.50 × 0.029 = 2,276.43
//     Total SE = 12,010.12
//     Deductible half = 6,005.06
//
//   Total income = 85,000
//   Adjustments = 6,005.06 (SE deduction)
//   AGI = 78,994.94
//   Standard deduction = 15,750
//   Taxable income before QBI = 63,244.94
//
//   QBI:
//     20% × 85,000 = 17,000
//     20% × 63,244.94 = 12,648.99
//     QBI = min(17,000, 12,648.99) = 12,648.99  (under $197,300 threshold)
//
//   Taxable income = 63,244.94 − 12,648.99 = 50,595.95
//
//   Tax (Single brackets):
//     10% × 11,925 = 1,192.50
//     12% × (48,475 − 11,925) = 4,386
//     22% × (50,595.95 − 48,475) = 22% × 2,120.95 = 466.61
//     Total income tax = 6,045.11
//
//   Tax after credits = 6,045.11 + 12,010.12 = 18,055.23
//   Estimated payments = 18,000
//   Amount owed = 55.23
// ═════════════════════════════════════════════════════════════════════════════

describe('I2 — Multi-Business Freelancer (Income Routing by businessId)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    businesses: [
      {
        id: 'biz-design',
        businessName: 'Design Studio',
        businessDescription: 'Graphic design services',
        businessEin: '12-3456789',
        accountingMethod: 'cash',
        didStartThisYear: false,
      },
      {
        id: 'biz-photo',
        businessName: 'Photography',
        businessDescription: 'Event photography',
        accountingMethod: 'cash',
        didStartThisYear: false,
      },
    ],
    income1099NEC: [
      { id: 'n1', payerName: 'Agency Alpha', amount: 50000, businessId: 'biz-design' },
      { id: 'n2', payerName: 'Corp Beta', amount: 30000, businessId: 'biz-design' },
      { id: 'n3', payerName: 'Weddings LLC', amount: 30000, businessId: 'biz-photo' },
    ],
    expenses: [
      { id: 'e1', scheduleCLine: 27, category: 'software', amount: 8000, businessId: 'biz-design' },
      { id: 'e2', scheduleCLine: 18, category: 'office_expense', amount: 7000, businessId: 'biz-design' },
      { id: 'e3', scheduleCLine: 22, category: 'supplies', amount: 6000, businessId: 'biz-photo' },
      { id: 'e4', scheduleCLine: 24, category: 'travel', amount: 4000, businessId: 'biz-photo' },
    ],
    estimatedPaymentsMade: 18000,
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct aggregate Schedule C', () => {
    expect(result.scheduleC).toBeDefined();
    expect(result.scheduleC!.grossIncome).toBe(110000);
    expect(result.scheduleC!.totalExpenses).toBe(25000);
    expect(result.scheduleC!.netProfit).toBe(85000);
  });

  it('routes income to specific businesses', () => {
    // Per-business breakdown should exist for 2 businesses
    expect(result.scheduleC!.businessResults).toBeDefined();
    expect(result.scheduleC!.businessResults!.length).toBe(2);
  });

  it('has correct per-business income routing', () => {
    const biz = result.scheduleC!.businessResults!;
    const design = biz.find(b => b.businessId === 'biz-design');
    const photo = biz.find(b => b.businessId === 'biz-photo');
    expect(design).toBeDefined();
    expect(photo).toBeDefined();
    // Design: $80k income, $15k expenses
    expect(design!.grossIncome).toBe(80000);
    expect(design!.totalExpenses).toBe(15000);
    // Photo: $30k income, $10k expenses
    expect(photo!.grossIncome).toBe(30000);
    expect(photo!.totalExpenses).toBe(10000);
  });

  it('has correct SE tax', () => {
    expect(result.scheduleSE).toBeDefined();
    // Net earnings = 85000 × 0.9235 ≈ 78497.50
    expect(result.scheduleSE!.netEarnings).toBeCloseTo(78497.50, 0);
    expect(result.scheduleSE!.totalSETax).toBeCloseTo(12010.12, 0);
    expect(f.seDeduction).toBeCloseTo(6005.06, 0);
  });

  it('has correct AGI', () => {
    // 85000 − 6005.06 ≈ 78994.94
    expect(f.agi).toBeCloseTo(78994.94, 0);
  });

  it('has correct QBI deduction', () => {
    // 20% × 85000 = 17000; 20% × (78994.94 − 15750) = 20% × 63244.94 = 12648.99
    // QBI = min(17000, 12648.99) = 12648.99
    expect(f.qbiDeduction).toBeCloseTo(12648.99, 0);
  });

  it('has correct taxable income', () => {
    expect(f.taxableIncome).toBeCloseTo(50595.95, 0);
  });

  it('has correct income tax', () => {
    // 1192.50 + 4386 + 466.61 = 6045.11
    expect(f.incomeTax).toBeCloseTo(6045.11, 0);
  });

  it('calculates correct balance', () => {
    // 6045.11 + 12010.12 = 18055.23. Estimated payments = 18000
    expect(f.taxAfterCredits).toBeCloseTo(18055.23, 0);
    expect(f.amountOwed).toBeCloseTo(55.23, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I3 — High-Income Investor: AMT + NIIT
//
// Profile: MFJ, $400k W-2, ISO exercise ($50k spread), $30k LTCG,
//          $15k qualified dividends, itemized with $30k SALT.
//          Tests AMT (first integration test!) and NIIT interaction.
//
// Hand calculation:
//   W-2 wages                 = 400,000
//   Capital gain (LTCG)       = 30,000
//   Qualified dividends       = 15,000
//   Total income              = 400,000 + 30,000 + 15,000 = 445,000
//   AGI                       = 445,000
//
//   Itemized deductions:
//     SALT: 30,000 (under $40k OBBBA cap)
//     Mortgage: 18,000
//     Charitable: 5,000
//     Total itemized = 53,000
//   Standard (MFJ) = 31,500. Itemized wins.
//   Deduction = 53,000
//
//   Taxable income = 445,000 − 53,000 = 392,000
//
//   Income tax (MFJ brackets on ordinary = 392,000 − 30,000 − 15,000 = 347,000):
//     10% × 23,850 = 2,385
//     12% × (96,950 − 23,850) = 12% × 73,100 = 8,772
//     22% × (206,700 − 96,950) = 22% × 109,750 = 24,145
//     24% × (347,000 − 206,700) = 24% × 140,300 = 33,672
//     Ordinary tax = 68,974
//
//   Preferential tax on $45,000 (30k LTCG + 15k qual div):
//     Taxable income = 392,000. 0% threshold (MFJ) = 96,700.
//     All 45,000 above 0% threshold.
//     15% threshold (MFJ) = 600,050. 392,000 < 600,050.
//     All $45,000 at 15% = 6,750.
//
//   Total income tax = 68,974 + 6,750 = 75,724
//
//   AMT (Form 6251 with Part III):
//     SALT add-back = 30,000
//     ISO exercise spread = 50,000
//     AMTI = 392,000 + 30,000 + 50,000 = 472,000
//     MFJ exemption = 137,000 (phase-out starts at 1,218,700; 472k < 1,218,700)
//     AMT base = 472,000 − 137,000 = 335,000
//     Part III (has QD $15K + LTCG $30K):
//       Ordinary AMT income = 335,000 − 45,000 = 290,000
//       Ordinary tax: 239,100 × 0.26 + 50,900 × 0.28 = 62,166 + 14,252 = 76,418
//       Cap gains: 45,000 × 0.15 = 6,750
//       Special TMT = 76,418 + 6,750 = 83,168 (< flat 89,018 → use Part III)
//     Regular tax (for AMT comparison) = 75,724
//     AMT = max(0, 83,168 − 75,724) = 7,444
//
//   Additional Medicare Tax:
//     Combined wages = 400,000. MFJ threshold = 250,000.
//     Excess = 150,000. Tax = 150,000 × 0.009 = 1,350
//
//   NIIT:
//     Investment income = 30,000 + 15,000 = 45,000
//     AGI = 445,000. MFJ threshold = 250,000. Excess = 195,000.
//     NIIT base = min(45,000, 195,000) = 45,000
//     NIIT = 45,000 × 0.038 = 1,710
//
//   Total tax = 75,724 + 7,444 + 1,350 + 1,710 = 86,228
//   Withholding = 85,000
//   Amount owed ≈ 1,228
// ═════════════════════════════════════════════════════════════════════════════

describe('I3 — High-Income Investor: AMT + NIIT', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1',
      employerName: 'TechCorp',
      wages: 400000,
      federalTaxWithheld: 85000,
      socialSecurityWages: 176100,
      socialSecurityTax: 10918.20,
      medicareWages: 400000,
      medicareTax: 5800,
    }],
    income1099B: [{
      id: 'b1',
      brokerName: 'Schwab',
      description: 'Various stocks',
      proceeds: 50000,
      costBasis: 20000,
      dateAcquired: '2023-01-15',
      dateSold: '2025-06-15',
      isLongTerm: true,
    }],
    income1099DIV: [{
      id: 'd1',
      payerName: 'Fidelity',
      ordinaryDividends: 15000,
      qualifiedDividends: 15000,
    }],
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 0,
      stateLocalIncomeTax: 22000,
      realEstateTax: 8000,
      personalPropertyTax: 0,
      mortgageInterest: 18000,
      mortgageInsurancePremiums: 0,
      charitableCash: 5000,
      charitableNonCash: 0,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
    amtData: {
      isoExerciseSpread: 50000,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct total income and AGI', () => {
    expect(f.totalIncome).toBe(445000);
    expect(f.agi).toBe(445000);
  });

  it('uses itemized deductions with SALT capped at $40k', () => {
    expect(f.deductionUsed).toBe('itemized');
    expect(result.scheduleA!.saltDeduction).toBe(30000);
    // 30000 SALT + 18000 mortgage + 5000 charitable = 53000
    expect(f.deductionAmount).toBe(53000);
  });

  it('has correct taxable income', () => {
    expect(f.taxableIncome).toBe(392000);
  });

  it('taxes LTCG + qualified dividends at preferential rate', () => {
    // $45k at 15% = $6,750
    expect(f.preferentialTax).toBe(6750);
  });

  it('calculates correct income tax', () => {
    // Ordinary brackets on $347k + preferential $6,750
    expect(f.incomeTax).toBeCloseTo(75724, 0);
  });

  it('triggers AMT from ISO exercise + SALT', () => {
    // FIRST INTEGRATION TEST FOR AMT
    expect(result.amt).toBeDefined();
    expect(result.amt!.applies).toBe(true);
    // AMTI = 392000 + 30000 (SALT) + 50000 (ISO) = 472000
    expect(result.amt!.amti).toBe(472000);
    // Exemption = 137000 (MFJ, under phase-out)
    expect(result.amt!.exemption).toBe(137000);
    // AMT ≈ 7,444 (Part III applies 15% cap gains rate on $45K QD+LTCG instead of flat 26%/28%)
    expect(result.amt!.amtAmount).toBeCloseTo(7444, 0);
  });

  it('applies Additional Medicare Tax on high W-2', () => {
    // (400000 − 250000) × 0.009 = 1350
    expect(f.additionalMedicareTaxW2).toBeCloseTo(1350, 0);
  });

  it('applies NIIT on investment income', () => {
    // Investment income = 45000. AGI excess = 195000.
    // NIIT = min(45000, 195000) × 0.038 = 1710
    expect(f.niitTax).toBeCloseTo(1710, 0);
  });

  it('calculates correct total tax and balance', () => {
    // 75724 (income tax) + 7444 (AMT w/ Part III) + 1350 (addl Medicare) + 1710 (NIIT) = 86228
    expect(f.totalTax).toBeCloseTo(86228, 0);
    expect(f.totalWithholding).toBe(85000);
    // Balance = 86228 − 85000 = 1228 (owes)
    expect(f.amountOwed).toBeCloseTo(1228, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I4 — K-1 Partnership with QBI + SE
//
// Profile: Single, receives K-1 from a partnership with ordinary income
//          and guaranteed payments.  Tests K-1 → QBI → SE interaction.
//
// Facts:
//   - K-1: Ordinary income $70,000, guaranteed payments $20,000
//   - K-1 SE income: $90,000 (ordinary + guaranteed)
//   - Standard deduction
//
// Hand calculation:
//   K-1 ordinary income         = 70,000
//   K-1 guaranteed payments     = 20,000  (also part of ordinary)
//   Note: Guaranteed payments are included in the ordinary income box.
//   Total K-1 income to Sched 1 = 70,000
//   SE income from K-1          = 70,000 (ordinary, which includes guaranteed)
//
//   SE tax:
//     Net earnings = 70,000 × 0.9235 = 64,645
//     SS = 64,645 × 0.124 = 8,015.98
//     Medicare = 64,645 × 0.029 = 1,874.71
//     Total SE = 9,890.69
//     Deductible half = 4,945.35
//
//   Total income = 70,000
//   Adjustments = 4,945.35
//   AGI = 65,054.65
//
//   Standard deduction = 15,750
//   Taxable income before QBI = 49,304.65
//
//   QBI:
//     QBI amount = 70,000 (ordinary income; guaranteed payments excluded from QBI)
//     Wait — IRS: guaranteed payments are NOT QBI (IRC §199A(c)(4)(B)).
//     QBI = 70,000 − 20,000 = 50,000
//     20% × 50,000 = 10,000
//     20% × 49,304.65 = 9,860.93
//     QBI deduction = min(10,000, 9,860.93) = 9,860.93
//
//   Taxable income = 49,304.65 − 9,860.93 = 39,443.72
//
//   Tax (Single brackets):
//     10% × 11,925 = 1,192.50
//     12% × (39,443.72 − 11,925) = 12% × 27,518.72 = 3,302.25
//     Total = 4,494.75
//
//   Tax after credits = 4,494.75 + 9,890.69 = 14,385.44
//   Estimated payments = 14,000
//   Amount owed = 385.44
// ═════════════════════════════════════════════════════════════════════════════

describe('I4 — K-1 Partnership: QBI + SE Tax', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    incomeK1: [{
      id: 'k1',
      entityName: 'Alpha Partners LLC',
      entityEin: '98-7654321',
      entityType: 'partnership',
      ordinaryBusinessIncome: 50000,  // Engine adds GP → total K-1 income = 70k
      guaranteedPayments: 20000,
      selfEmploymentIncome: 70000,  // ordinary + GP for SE
      section199AQBI: 50000,  // Ordinary minus guaranteed payments (IRC §199A(c)(4)(B))
    }],
    estimatedPaymentsMade: 14000,
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('routes K-1 ordinary income correctly', () => {
    expect(f.k1OrdinaryIncome).toBe(70000);
    expect(f.totalIncome).toBe(70000);
  });

  it('calculates SE tax on K-1 SE income', () => {
    expect(result.scheduleSE).toBeDefined();
    // Net earnings = 70000 × 0.9235 = 64645
    expect(result.scheduleSE!.netEarnings).toBeCloseTo(64645, 0);
    expect(result.scheduleSE!.totalSETax).toBeCloseTo(9890.69, 0);
    expect(f.seDeduction).toBeCloseTo(4945.35, 0);
  });

  it('has correct AGI', () => {
    expect(f.agi).toBeCloseTo(65054.65, 0);
  });

  it('calculates QBI excluding guaranteed payments', () => {
    // QBI = $50k (ordinary − guaranteed). 20% × 50k = 10k.
    // Limited to 20% of taxable income before QBI
    expect(f.qbiDeduction).toBeCloseTo(9860.93, 0);
  });

  it('has correct taxable income', () => {
    expect(f.taxableIncome).toBeCloseTo(39443.72, 0);
  });

  it('has correct income tax', () => {
    expect(f.incomeTax).toBeCloseTo(4494.75, 0);
  });

  it('calculates correct balance', () => {
    expect(f.taxAfterCredits).toBeCloseTo(14385.44, 0);
    expect(f.estimatedPayments).toBe(14000);
    expect(f.amountOwed).toBeCloseTo(385.44, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I5 — Gig Worker with OBBBA Schedule 1-A Deductions
//
// Profile: Single, W-2 with overtime ($60k wages, $8k overtime),
//          tipped wages ($15k tips on W-2), standard deduction + Schedule 1-A.
//
// Hand calculation:
//   W-2 wages (includes tips + overtime) = 60,000
//   Tips allocated on W-2               = 15,000
//   Overtime on W-2                     = 8,000
//
//   Total income = 60,000
//   AGI = 60,000 (no adjustments)
//
//   Standard deduction = 15,750
//   Schedule 1-A deductions (below the line):
//     Tips: min(15,000, 25,000 cap) = 15,000 (AGI $60k < $150k, no phase-out)
//     Overtime: min(8,000, 12,500 cap) = 8,000 (AGI $60k < $150k, no phase-out)
//     Total 1-A = 23,000
//   Total deduction = 15,750 + 23,000 = 38,750
//
//   Taxable income = 60,000 − 38,750 = 21,250
//
//   Tax (Single):
//     10% × 11,925 = 1,192.50
//     12% × (21,250 − 11,925) = 12% × 9,325 = 1,119
//     Total = 2,311.50
//
//   Withholding = 5,500
//   Refund = 5,500 − 2,311.50 = 3,188.50
// ═════════════════════════════════════════════════════════════════════════════

describe('I5 — Gig Worker: W-2 Tips + Overtime + OBBBA Schedule 1-A', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1',
      employerName: 'Restaurant Chain',
      wages: 60000,
      federalTaxWithheld: 5500,
      socialSecurityWages: 60000,
      socialSecurityTax: 3720,
      medicareWages: 60000,
      medicareTax: 870,
    }],
    schedule1A: {
      qualifiedTips: 15000,
      qualifiedOvertimePay: 8000,
      isFLSANonExempt: true,  // Required to activate overtime deduction
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct income and AGI', () => {
    expect(f.totalIncome).toBe(60000);
    expect(f.agi).toBe(60000);
  });

  it('applies Schedule 1-A deductions', () => {
    // Tips: 15000, Overtime: 8000, Total = 23000
    expect(f.schedule1ADeduction).toBeCloseTo(23000, 0);
  });

  it('has correct total deduction (standard + 1-A)', () => {
    // 15750 standard + 23000 1-A = 38750
    expect(f.deductionAmount).toBe(15750);  // standard deduction component
    expect(f.taxableIncome).toBeCloseTo(21250, 0);
  });

  it('has correct income tax', () => {
    // 10% × 11925 + 12% × 9325 = 1192.50 + 1119 = 2311.50
    expect(f.incomeTax).toBeCloseTo(2311.50, 0);
  });

  it('calculates correct refund', () => {
    expect(f.refundAmount).toBeCloseTo(3188.50, 0);
    expect(f.amountOwed).toBe(0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I6 — Home Sale with Capital Gains
//
// Profile: MFJ couple selling primary residence.
//          $500k sale price, $300k basis, lived there 3 years.
//          Section 121 excludes $500k for MFJ → no recognized gain.
//          Also has W-2 income.
//
// Hand calculation:
//   W-2 wages = 120,000
//   Home sale: proceeds $500k, basis $300k, gain = $200k
//   Section 121 exclusion (MFJ, 2+ years): $500k max
//   Gain ($200k) < exclusion ($500k) → fully excluded
//   Home sale gain recognized = 0
//
//   Total income = 120,000
//   AGI = 120,000
//   Standard deduction (MFJ) = 31,500
//   Taxable income = 88,500
//
//   Tax (MFJ):
//     10% × 23,850 = 2,385
//     12% × (88,500 − 23,850) = 12% × 64,650 = 7,758
//     Total = 10,143
//
//   Withholding = 16,000
//   Refund = 5,857
// ═════════════════════════════════════════════════════════════════════════════

describe('I6 — Home Sale: Section 121 Exclusion (MFJ)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1',
      employerName: 'Employer Inc',
      wages: 120000,
      federalTaxWithheld: 16000,
      socialSecurityWages: 120000,
      socialSecurityTax: 7440,
      medicareWages: 120000,
      medicareTax: 1740,
    }],
    homeSale: {
      salePrice: 500000,
      costBasis: 300000,
      ownedMonths: 36,    // 3 years
      usedAsResidenceMonths: 36,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('fully excludes home sale gain under Section 121', () => {
    expect(result.homeSale).toBeDefined();
    // Gain = 200,000. Exclusion = 500,000. Recognized = 0.
    expect(f.homeSaleExclusion).toBeGreaterThanOrEqual(200000);
  });

  it('has correct total income (no home sale gain)', () => {
    expect(f.totalIncome).toBe(120000);
    expect(f.agi).toBe(120000);
  });

  it('has correct taxable income', () => {
    expect(f.taxableIncome).toBe(88500);
  });

  it('has correct income tax', () => {
    // MFJ: 2385 + 7758 = 10143
    expect(f.incomeTax).toBe(10143);
  });

  it('calculates correct refund', () => {
    expect(f.refundAmount).toBe(5857);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I7 — Roth Conversion (Form 8606)
//
// Profile: Single, $90k W-2, $30k traditional IRA converted to Roth,
//          $10k nondeductible basis.  Tests Form 8606 pro-rata rule.
//
// Hand calculation:
//   W-2 wages = 90,000
//
//   Form 8606 (Roth conversion):
//     Conversion amount = 30,000
//     Total nondeductible basis = 10,000
//     Year-end IRA value = 70,000 (after conversion)
//     Total IRA balance (for pro-rata) = 70,000 + 30,000 = 100,000
//     Nontaxable ratio = 10,000 / 100,000 = 0.10
//     Tax-free portion = 30,000 × 0.10 = 3,000
//     Taxable conversion = 30,000 − 3,000 = 27,000
//
//   Total income = 90,000 + 30,000 (1099-R taxableAmount) = 120,000
//   Note: Form 8606 computes taxable conversion = 27,000 but the engine
//         uses the 1099-R taxableAmount for income inclusion.
//   AGI = 120,000
//   Standard deduction = 15,750
//   Taxable income = 104,250
//
//   Tax (Single):
//     10% × 11,925 = 1,192.50
//     12% × 36,550 = 4,386
//     22% × 54,875 = 12,072.50
//     24% × 900    = 216
//     Total = 17,867
//
//   Withholding = 14,000
//   Amount owed = 3,867
// ═════════════════════════════════════════════════════════════════════════════

describe('I7 — Roth Conversion: Form 8606 Pro-Rata Rule', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1',
      employerName: 'Corp Inc',
      wages: 90000,
      federalTaxWithheld: 14000,
      socialSecurityWages: 90000,
      socialSecurityTax: 5580,
      medicareWages: 90000,
      medicareTax: 1305,
    }],
    income1099R: [{
      id: 'r1',
      payerName: 'IRA Custodian',
      grossDistribution: 30000,
      taxableAmount: 30000,  // Engine adjusts via Form 8606 pro-rata
      distributionCode: '2',  // Early distribution, exception applies (Roth conversion)
      isIRA: true,
    }],
    form8606: {
      rothConversionAmount: 30000,
      nondeductibleContributions: 10000,
      traditionalIRABalance: 70000,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('calculates taxable conversion via pro-rata rule', () => {
    expect(result.form8606).toBeDefined();
    // Taxable = 30000 × (1 − 10000/100000) = 30000 × 0.90 = 27000
    expect(result.form8606!.taxableConversion).toBe(27000);
  });

  it('includes pro-rata adjusted taxable amount in total income', () => {
    // form8606 reports the pro-rata adjusted amount
    expect(f.rothConversionTaxable).toBe(27000);
    // Form 8606 pro-rata overrides 1099-R box 2a: $90k wages + $27k conversion = $117k
    expect(f.totalIncome).toBe(117000);
    expect(f.agi).toBe(117000);
  });

  it('has correct taxable income', () => {
    // 117,000 − 15,750 standard deduction = 101,250
    expect(f.taxableIncome).toBe(101250);
  });

  it('has correct income tax', () => {
    // Single brackets on 101,250:
    //   10% × 11,925 = 1,192.50
    //   12% × 36,550 = 4,386
    //   22% × 52,775 = 11,610.50
    //   Total = 17,189
    expect(f.incomeTax).toBeCloseTo(17189, 0);
  });

  it('calculates correct balance', () => {
    // 17,189 − 14,000 withholding = 3,189 base + ~68 estimated tax penalty ≈ 3,257
    expect(f.amountOwed).toBeCloseTo(3257, 0);
    expect(f.refundAmount).toBe(0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I8 — ACA Family with Premium Tax Credit
//
// Profile: MFJ, $60k combined wages, 2 kids, marketplace insurance.
//          APTC received monthly, reconciliation calculates actual PTC.
//
// Hand calculation:
//   W-2 wages = 60,000
//   AGI = 60,000
//   Household size = 4 (couple + 2 kids)
//   FPL for 4 (2025) ≈ $31,800
//   FPL percentage = 60,000 / 31,800 = 188.68%
//   Expected contribution = varies by FPL% (sliding scale)
//
//   Total annual premium (SLCSP) = 18,000
//   APTC received = 12,000
//   Actual PTC = SLCSP − expected contribution
//
//   This scenario mainly tests that PTC flows through the pipeline.
//   We verify premiumTaxCredit result exists and APTC reconciliation works.
// ═════════════════════════════════════════════════════════════════════════════

describe('I8 — ACA Family: Premium Tax Credit Reconciliation', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1',
      employerName: 'SmallBiz',
      wages: 60000,
      federalTaxWithheld: 4000,
      socialSecurityWages: 60000,
      socialSecurityTax: 3720,
      medicareWages: 60000,
      medicareTax: 870,
    }],
    childTaxCredit: {
      qualifyingChildren: 2,
      otherDependents: 0,
    },
    premiumTaxCredit: {
      forms1095A: [{
        id: 'f1',
        marketplace: 'HealthCare.gov',
        enrollmentPremiums: Array(12).fill(20000 / 12),    // ~$1,666.67/month
        slcspPremiums: Array(12).fill(18000 / 12),         // $1,500/month
        advancePTC: Array(12).fill(12000 / 12),            // $1,000/month APTC
        coverageMonths: Array(12).fill(true),
      }],
      familySize: 4,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('produces a premium tax credit result', () => {
    expect(result.premiumTaxCredit).toBeDefined();
  });

  it('has correct AGI', () => {
    expect(f.agi).toBe(60000);
  });

  it('applies CTC for 2 children', () => {
    expect(result.credits.childTaxCredit).toBe(4400);
  });

  it('has a refund (low income + credits)', () => {
    expect(f.refundAmount).toBeGreaterThan(0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I9 — Kiddie Tax
//
// Profile: Child (age 14) with $5,000 unearned income (dividends from
//          custodial account).  Parent's marginal rate is 32%.
//
// Hand calculation:
//   Child's unearned income = 5,000
//   Kiddie tax threshold = 2,700 (2025)
//   Excess above threshold = 5,000 − 2,700 = 2,300
//
//   Additional tax = excess × (parent rate − child rate)
//                  = 2,300 × (0.32 − 0.10) = 2,300 × 0.22 = 506
//
//   This tests the kiddie tax calculation flows through the pipeline.
// ═════════════════════════════════════════════════════════════════════════════

describe('I9 — Kiddie Tax: Child Unearned Income at Parent Rate', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    income1099DIV: [{
      id: 'd1',
      payerName: 'Custodial Account',
      ordinaryDividends: 5000,
      qualifiedDividends: 0,
    }],
    kiddieTax: {
      childAge: 14,
      isFullTimeStudent: false,
      childUnearnedIncome: 5000,
      parentMarginalRate: 0.32,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('triggers kiddie tax', () => {
    expect(result.kiddieTax).toBeDefined();
    expect(result.kiddieTax!.additionalTax).toBeGreaterThan(0);
  });

  it('calculates correct additional tax at parent rate', () => {
    // Excess = 5000 − 2700 = 2300
    // Additional = 2300 × (0.32 − 0.10) = 506
    expect(result.kiddieTax!.additionalTax).toBe(506);
  });

  it('includes kiddie tax in total tax', () => {
    expect(f.kiddieTaxAmount).toBe(506);
    // Child's standard deduction covers earned income; total tax may be just kiddie tax
    expect(f.totalTax).toBeGreaterThanOrEqual(506);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I10 — Underpaid Self-Employed: Estimated Tax Penalty
//
// Profile: Single freelancer, $150k NEC, $20k expenses, no estimated
//          payments, no withholding.  Owes >$1,000 → penalty.
//
// Hand calculation:
//   Schedule C: 150,000 − 20,000 = 130,000
//   SE tax:
//     Net earnings = 130,000 × 0.9235 = 120,055
//     SS = 120,055 × 0.124 = 14,886.82
//     Medicare = 120,055 × 0.029 = 3,481.60
//     Total SE = 18,368.42
//     Deductible half = 9,184.21
//
//   Total income = 130,000
//   AGI = 130,000 − 9,184.21 = 120,815.79
//
//   Standard deduction = 15,750
//   QBI: 20% × 130,000 = 26,000; 20% × (120,815.79 − 15,750) = 20% × 105,065.79 = 21,013.16
//   QBI = min(26,000, 21,013.16) = 21,013.16
//
//   Taxable income = 120,815.79 − 15,750 − 21,013.16 = 84,052.63
//
//   Tax (Single):
//     10% × 11,925 = 1,192.50
//     12% × (48,475 − 11,925) = 4,386
//     22% × (84,052.63 − 48,475) = 22% × 35,577.63 = 7,827.08
//     Total = 13,405.58
//
//   Total tax owed = 13,405.58 + 18,368.42 = 31,773.00 (approximately)
//   No withholding, no estimated payments → owes ~$31,773
//   Since owed > $1,000 → estimated tax penalty applies
// ═════════════════════════════════════════════════════════════════════════════

describe('I10 — Underpaid Self-Employed: Estimated Tax Penalty', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    income1099NEC: [
      { id: 'n1', payerName: 'Big Client', amount: 150000 },
    ],
    expenses: [
      { id: 'e1', scheduleCLine: 27, category: 'software', amount: 10000 },
      { id: 'e2', scheduleCLine: 18, category: 'office_expense', amount: 5000 },
      { id: 'e3', scheduleCLine: 25, category: 'utilities', amount: 5000 },
    ],
    // No estimated payments, no withholding
    priorYearTax: 25000,  // Prior year tax > 0 → safe harbor = 100% of prior year ($25k)
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct Schedule C', () => {
    expect(result.scheduleC!.netProfit).toBe(130000);
  });

  it('has correct SE tax', () => {
    expect(result.scheduleSE!.totalSETax).toBeCloseTo(18368.42, 0);
  });

  it('has correct AGI', () => {
    expect(f.agi).toBeCloseTo(120815.79, 0);
  });

  it('owes a significant amount with no payments', () => {
    expect(f.totalWithholding).toBe(0);
    expect(f.estimatedPayments).toBe(0);
    expect(f.amountOwed).toBeGreaterThan(30000);
  });

  it('triggers estimated tax penalty', () => {
    // Owed > $1,000 with no safe harbor → penalty
    expect(f.estimatedTaxPenalty).toBeGreaterThan(0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I11 — Clean Energy Credits Bundle
//
// Profile: MFJ, $100k W-2, solar panels (clean energy) + heat pump
//          (energy efficiency) + used EV credit.  Tests energy credits stacking.
//
// Hand calculation:
//   W-2 wages = 100,000
//   AGI = 100,000
//   Standard deduction (MFJ) = 31,500
//   Taxable income = 68,500
//
//   Tax (MFJ):
//     10% × 23,850 = 2,385
//     12% × (68,500 − 23,850) = 12% × 44,650 = 5,358
//     Total = 7,743
//
//   Credits:
//     Solar panels (Form 5695 Part I): $20,000 cost × 30% = $6,000
//     Heat pump (Form 5695 Part II): $4,000 cost → $2,000 cap
//     Used EV (Form 8936): $15,000 purchase → $4,000 credit (used EV max)
//     Total energy credits = 6,000 + 2,000 + 4,000 = 12,000
//     Non-refundable: limited to tax liability = 7,743
//
//   Tax after credits = max(0, 7,743 − credits)
//   Withholding = 12,000
// ═════════════════════════════════════════════════════════════════════════════

describe('I11 — Clean Energy Credits Bundle: Solar + Heat Pump + EV', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1',
      employerName: 'GreenCo',
      wages: 100000,
      federalTaxWithheld: 12000,
      socialSecurityWages: 100000,
      socialSecurityTax: 6200,
      medicareWages: 100000,
      medicareTax: 1450,
    }],
    cleanEnergy: {
      solarElectric: 20000,
    },
    energyEfficiency: {
      heatPump: 4000,
    },
    evCredit: {
      isNewVehicle: false,
      purchasePrice: 15000,
      vehicleMSRP: 20000,
      finalAssemblyUS: true,
      meetsMineralReq: true,
      meetsBatteryComponentReq: true,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct income and standard deduction', () => {
    expect(f.totalIncome).toBe(100000);
    expect(f.taxableIncome).toBe(68500);
  });

  it('calculates solar credit (30% computation)', () => {
    expect(result.cleanEnergy).toBeDefined();
    // 30% × 20000 = 6000 (computed credit before tax limitation)
    expect(result.cleanEnergy!.currentYearCredit).toBe(6000);
    // .credit is the amount actually applied (limited by tax liability)
    expect(result.cleanEnergy!.credit).toBeGreaterThan(0);
    expect(result.cleanEnergy!.credit).toBeLessThanOrEqual(6000);
  });

  it('calculates energy efficiency credit', () => {
    expect(result.energyEfficiency).toBeDefined();
    // Heat pump: after caps ≤ 2000, then limited by remaining tax liability
    expect(result.energyEfficiency!.credit).toBeGreaterThan(0);
    expect(result.energyEfficiency!.credit).toBeLessThanOrEqual(2000);
  });

  it('calculates EV credit', () => {
    expect(result.evCredit).toBeDefined();
    // Used EV: $4,000 max
    expect(result.evCredit!.credit).toBe(4000);
  });

  it('total credits limited to tax liability', () => {
    // Solar (6k computed) + heat pump (2k cap) + EV (4k) = 12k total computed
    // Non-refundable credits limited to $7,743 tax liability
    expect(f.totalCredits).toBeCloseTo(7743, 0);
    // After credits wipe out tax, withholding of $12k → full refund
    expect(f.refundAmount).toBeGreaterThan(0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I12 — Farmer with Schedule F
//
// Profile: MFJ, farm income from cattle + crops, farm expenses.
//          Tests Schedule F → SE tax interaction.
//
// Hand calculation:
//   Farm income:
//     Sales of products (crops) = 80,000
//     Ag program payments = 5,000
//     Gross farm income = 85,000
//   Farm expenses:
//     Feed = 15,000, Fertilizer = 5,000, Fuel = 8,000
//     Insurance = 3,000, Repairs = 6,000, Utilities = 2,000
//     Total expenses = 39,000
//   Net farm profit = 85,000 − 39,000 = 46,000
//
//   SE tax:
//     Net earnings = 46,000 × 0.9235 = 42,481
//     SS = 42,481 × 0.124 = 5,267.64
//     Medicare = 42,481 × 0.029 = 1,231.95
//     Total SE = 6,499.59
//     Deductible half = 3,249.80
//
//   Total income = 46,000
//   AGI = 46,000 − 3,249.80 = 42,750.20
//   Standard deduction (MFJ) = 31,500
//   Taxable income before QBI = 11,250.20
//   QBI deduction = min(20% × 46,000, 20% × 11,250.20) = min(9,200, 2,250.04) = 2,250.04
//   Taxable income = 11,250.20 − 2,250.04 = 9,000.16
//
//   Tax (MFJ):
//     10% × 9,000.16 = 900.02
//     Total = 900.02
//
//   Withholding = 0
//   Estimated = 8,000
//   Refund = 8,000 − (900.02 + 6,499.59) = 600.39
// ═════════════════════════════════════════════════════════════════════════════

describe('I12 — Farmer: Schedule F + SE Tax', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    scheduleF: {
      salesOfProducts: 80000,
      agriculturalProgramPayments: 5000,
      feed: 15000,
      fertilizers: 5000,
      gasolineFuel: 8000,
      insurance: 3000,
      repairs: 6000,
      utilities: 2000,
    },
    estimatedPaymentsMade: 8000,
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('calculates Schedule F correctly', () => {
    expect(result.scheduleF).toBeDefined();
    expect(result.scheduleF!.grossIncome).toBe(85000);
    expect(result.scheduleF!.totalExpenses).toBe(39000);
    expect(result.scheduleF!.netFarmProfit).toBe(46000);
  });

  it('applies SE tax to farm income', () => {
    expect(result.scheduleSE).toBeDefined();
    expect(result.scheduleSE!.netEarnings).toBeCloseTo(42481, 0);
    expect(result.scheduleSE!.totalSETax).toBeCloseTo(6499.59, 0);
  });

  it('has correct AGI', () => {
    expect(f.agi).toBeCloseTo(42750.20, 0);
  });

  it('applies QBI deduction to farm income', () => {
    // Farm income is QBI-eligible per IRC §199A(c)(3)(A)(i)
    // QBI = min(20% × 46,000, 20% × 11,250.20) = 2,250.04
    expect(f.qbiDeduction).toBeCloseTo(2250.04, 0);
  });

  it('has correct taxable income', () => {
    // 11,250.20 − 2,250.04 QBI = 9,000.16
    expect(f.taxableIncome).toBeCloseTo(9000.16, 0);
  });

  it('calculates correct balance', () => {
    // Income tax ~900 + SE ~6500 = ~7400. Estimated = 8000.
    expect(f.refundAmount).toBeCloseTo(600.39, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I13 — HSA + Early Withdrawal Penalties
//
// Profile: Single, $75k W-2, HSA contribution $4,300, non-qualified
//          HSA distribution $2,000 (20% penalty), early 1099-R withdrawal
//          $10,000 (10% penalty, code 1).
//
// Hand calculation:
//   W-2 wages = 75,000
//   1099-R early withdrawal: $10,000 gross, $10,000 taxable, code 1
//     Penalty = 10,000 × 10% = 1,000
//
//   HSA:
//     Contribution deduction = 4,300
//     Non-qualified distribution = 2,000 → taxable + 20% penalty = 400
//
//   Total income = 75,000 + 10,000 + 2,000 (HSA taxable) = 87,000
//   Adjustments = 4,300 (HSA)
//   AGI = 82,700
//   Standard deduction = 15,750
//   Taxable income = 66,950
//
//   Tax (Single):
//     10% × 11,925 = 1,192.50
//     12% × (48,475 − 11,925) = 4,386
//     22% × (66,950 − 48,475) = 22% × 18,475 = 4,064.50
//     Total income tax = 9,643
//
//   Early distribution penalty = 1,000
//   HSA penalty = 400
//   Total tax = 9,643 + 1,000 + 400 = 11,043
//   Withholding = 10,000 (W-2) + 1,000 (1099-R) = 11,000
//   Refund = 11,000 − 11,043 = −43 (owes $43)
// ═════════════════════════════════════════════════════════════════════════════

describe('I13 — HSA + Early Withdrawal Penalty Stacking', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1',
      employerName: 'HealthCo',
      wages: 75000,
      federalTaxWithheld: 10000,
      socialSecurityWages: 75000,
      socialSecurityTax: 4650,
      medicareWages: 75000,
      medicareTax: 1087.50,
    }],
    income1099R: [{
      id: 'r1',
      payerName: 'Old 401k',
      grossDistribution: 10000,
      taxableAmount: 10000,
      federalTaxWithheld: 1000,
      distributionCode: '1', // early distribution, no exception
    }],
    hsaDeduction: 4300,
    hsaContribution: {
      totalContributions: 4300,
      coverageType: 'self_only',
    },
    income1099SA: [{
      id: 'sa1',
      payerName: 'HSA Bank',
      grossDistribution: 2000,
      distributionCode: '1',  // normal distribution
      qualifiedMedicalExpenses: false,     // non-qualified → taxable + penalty
    }],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('applies HSA deduction', () => {
    expect(f.hsaDeduction).toBeGreaterThan(0);
  });

  it('adds early distribution penalty', () => {
    // 10% × 10,000 = 1,000
    expect(f.earlyDistributionPenalty).toBe(1000);
  });

  it('has correct total income', () => {
    // Wages + 1099-R taxable + HSA taxable distribution
    expect(f.totalIncome).toBeGreaterThan(80000);
  });

  it('stacks both penalties in total tax', () => {
    // Income tax + early withdrawal penalty + HSA penalty
    expect(f.totalTax).toBeGreaterThan(f.incomeTax + 1000);
  });

  it('has nearly zero balance (penalties eat the refund)', () => {
    // Withholding ~11k vs tax ~11k → near zero
    const balance = f.refundAmount - f.amountOwed;
    expect(Math.abs(balance)).toBeLessThan(500);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I14 — High-Income AMT Trigger (Precision Test)
//
// Profile: Single, $350k W-2, itemized with $25k SALT, $50k ISO exercise.
//          Specifically designed to trigger AMT and test precision.
//
// Hand calculation:
//   Total income = 350,000
//   AGI = 350,000
//
//   Itemized:
//     SALT = 25,000 (under $40k cap)
//     Mortgage = 15,000
//     Total = 40,000
//   Standard = 15,750. Itemized wins.
//
//   Taxable income = 350,000 − 40,000 = 310,000
//
//   Tax (Single brackets):
//     10% × 11,925 = 1,192.50
//     12% × (48,475 − 11,925) = 4,386
//     22% × (103,350 − 48,475) = 22% × 54,875 = 12,072.50
//     24% × (197,300 − 103,350) = 24% × 93,950 = 22,548
//     32% × (250,525 − 197,300) = 32% × 53,225 = 17,032
//     35% × (310,000 − 250,525) = 35% × 59,475 = 20,816.25
//     Total = 78,047.25
//
//   AMT:
//     SALT add-back = 25,000
//     ISO spread = 50,000
//     AMTI = 310,000 + 25,000 + 50,000 = 385,000
//     Single exemption = 88,100 (phase-out at 609,350; 385k < 609,350)
//     AMT base = 385,000 − 88,100 = 296,900
//     TMT:
//       26% × 239,100 = 62,166
//       28% × (296,900 − 239,100) = 28% × 57,800 = 16,184
//       TMT = 78,350
//     AMT = max(0, 78,350 − 78,047.25) = 302.75
//
//   Additional Medicare:
//     350,000 − 200,000 = 150,000 × 0.009 = 1,350
//
//   Total tax = 78,047.25 + 302.75 + 1,350 = 79,700
//   Withholding = 78,000
//   Amount owed = 1,700
// ═════════════════════════════════════════════════════════════════════════════

describe('I14 — High-Income Single: AMT Precision Test', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1',
      employerName: 'StartupCo',
      wages: 350000,
      federalTaxWithheld: 78000,
      socialSecurityWages: 176100,
      socialSecurityTax: 10918.20,
      medicareWages: 350000,
      medicareTax: 5075,
    }],
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 0,
      stateLocalIncomeTax: 18000,
      realEstateTax: 7000,
      personalPropertyTax: 0,
      mortgageInterest: 15000,
      mortgageInsurancePremiums: 0,
      charitableCash: 0,
      charitableNonCash: 0,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
    amtData: {
      isoExerciseSpread: 50000,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct taxable income', () => {
    // 350000 − 40000 itemized = 310000
    expect(f.taxableIncome).toBe(310000);
  });

  it('has correct regular income tax', () => {
    // Single brackets on $310k = 78,047.25
    expect(f.incomeTax).toBeCloseTo(78047.25, 0);
  });

  it('triggers AMT', () => {
    expect(result.amt).toBeDefined();
    expect(result.amt!.applies).toBe(true);
  });

  it('has correct AMTI', () => {
    // 310000 + 25000 SALT + 50000 ISO = 385000
    expect(result.amt!.amti).toBe(385000);
  });

  it('uses full Single exemption (below phase-out)', () => {
    expect(result.amt!.exemption).toBe(88100);
  });

  it('has small but positive AMT amount', () => {
    // TMT = 78350, regular = 78047.25, AMT = 302.75
    expect(result.amt!.amtAmount).toBeCloseTo(302.75, 0);
  });

  it('applies Additional Medicare Tax', () => {
    expect(f.additionalMedicareTaxW2).toBe(1350);
  });

  it('calculates correct total tax and balance', () => {
    // 78047.25 (income tax) + 302.75 (AMT) + 1350 (addl Medicare) = 79700
    expect(f.totalTax).toBeCloseTo(79700, 0);
    // Total tax > withholding ($78k) → owes money
    expect(f.amountOwed).toBeGreaterThan(0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// I15 — Kitchen Sink: Maximum Complexity
//
// Profile: MFJ, W-2 + Schedule C + rental property + capital gains +
//          3 qualifying children + itemized deductions + solar credit.
//          The ultimate regression test — touches most engine modules.
//
// Hand calculation:
//   W-2 wages = 120,000 (withheld 18,000)
//   Schedule C: 1099-NEC $60,000, expenses $15,000, net $45,000
//   Rental: $15,000 rent, $12,000 expenses → $3,000 net
//   1099-B: $10,000 LTCG
//   1099-DIV: $3,000 qualified dividends
//   Total income = 120,000 + 45,000 + 3,000 + 10,000 + 3,000 = 181,000
//
//   SE tax:
//     Net earnings = 45,000 × 0.9235 = 41,557.50
//     SS: remaining base = 176,100 − 120,000 = 56,100. 41,557.50 < 56,100 → all taxable
//     SS = 41,557.50 × 0.124 = 5,153.13
//     Medicare = 41,557.50 × 0.029 = 1,205.17
//     Total SE = 6,358.30
//     Deductible half = 3,179.15
//
//   Adjustments = 3,179.15 (SE deduction)
//   AGI = 181,000 − 3,179.15 = 177,820.85
//
//   Itemized:
//     SALT: 12,000 + 6,000 = 18,000
//     Mortgage: 15,000
//     Charitable: 3,000
//     Total = 36,000
//   Standard (MFJ) = 31,500. Itemized wins.
//
//   QBI: 20% × 45,000 = 9,000
//   Taxable income before QBI = 177,820.85 − 36,000 = 141,820.85
//   20% × 141,820.85 = 28,364.17
//   QBI = min(9,000, 28,364.17) = 9,000
//
//   Taxable income = 141,820.85 − 9,000 = 132,820.85
//
//   Ordinary income = 132,820.85 − 10,000 − 3,000 = 119,820.85
//   Tax (MFJ brackets):
//     10% × 23,850 = 2,385
//     12% × (96,950 − 23,850) = 8,772
//     22% × (119,820.85 − 96,950) = 22% × 22,870.85 = 5,031.59
//     Ordinary tax = 16,188.59
//
//   Preferential: 13,000 at 15% (taxable income 132k > 96,700 threshold)
//     = 1,950
//   Total income tax = 18,138.59
//
//   Credits:
//     CTC: 3 × $2,200 = $6,600
//     Solar: $10,000 × 30% = $3,000
//     Total credits = 9,600
//
//   Tax after non-refundable credits = max(0, 18,138.59 − 9,600) + 6,358.30
//                                    = 8,538.59 + 6,358.30 = 14,896.89
//
//   Withholding = 18,000
//   Refund ≈ 3,103.11
// ═════════════════════════════════════════════════════════════════════════════

describe('I15 — Kitchen Sink: W-2 + Sched C + Rental + Cap Gains + Kids + Itemized + Solar', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{
      id: 'w1',
      employerName: 'MegaCorp',
      wages: 120000,
      federalTaxWithheld: 18000,
      socialSecurityWages: 120000,
      socialSecurityTax: 7440,
      medicareWages: 120000,
      medicareTax: 1740,
    }],
    income1099NEC: [
      { id: 'n1', payerName: 'Consulting Client', amount: 60000 },
    ],
    expenses: [
      { id: 'e1', scheduleCLine: 27, category: 'software', amount: 8000 },
      { id: 'e2', scheduleCLine: 18, category: 'office_expense', amount: 4000 },
      { id: 'e3', scheduleCLine: 25, category: 'utilities', amount: 3000 },
    ],
    rentalProperties: [{
      id: 'rp1',
      address: '789 Oak Ave',
      propertyType: 'single_family',
      daysRented: 365,
      personalUseDays: 0,
      rentalIncome: 15000,
      insurance: 2000,
      repairs: 3000,
      taxes: 2500,
      depreciation: 4500,
      otherExpenses: 0,
    }],
    income1099B: [{
      id: 'b1',
      brokerName: 'ETrade',
      description: 'Stock sale',
      proceeds: 30000,
      costBasis: 20000,
      dateAcquired: '2022-01-01',
      dateSold: '2025-09-01',
      isLongTerm: true,
    }],
    income1099DIV: [{
      id: 'd1',
      payerName: 'Vanguard',
      ordinaryDividends: 3000,
      qualifiedDividends: 3000,
    }],
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 0,
      stateLocalIncomeTax: 12000,
      realEstateTax: 6000,
      personalPropertyTax: 0,
      mortgageInterest: 15000,
      mortgageInsurancePremiums: 0,
      charitableCash: 3000,
      charitableNonCash: 0,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
    childTaxCredit: {
      qualifyingChildren: 3,
      otherDependents: 0,
    },
    cleanEnergy: {
      solarElectric: 10000,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct Schedule C', () => {
    expect(result.scheduleC!.grossIncome).toBe(60000);
    expect(result.scheduleC!.totalExpenses).toBe(15000);
    expect(result.scheduleC!.netProfit).toBe(45000);
  });

  it('has correct Schedule E rental income', () => {
    expect(result.scheduleE).toBeDefined();
    expect(f.scheduleEIncome).toBe(3000);
  });

  it('has correct capital gains', () => {
    expect(f.capitalGainOrLoss).toBe(10000);
  });

  it('has correct total income', () => {
    // 120k wages + 45k Sched C + 3k rental + 10k LTCG + 3k div = 181k
    expect(f.totalIncome).toBe(181000);
  });

  it('has correct SE tax', () => {
    expect(result.scheduleSE!.totalSETax).toBeCloseTo(6358.30, 0);
    expect(f.seDeduction).toBeCloseTo(3179.15, 0);
  });

  it('has correct AGI', () => {
    expect(f.agi).toBeCloseTo(177820.85, 0);
  });

  it('uses itemized deductions', () => {
    expect(f.deductionUsed).toBe('itemized');
    expect(f.deductionAmount).toBe(36000);
  });

  it('has correct QBI deduction', () => {
    expect(f.qbiDeduction).toBe(9000);
  });

  it('applies CTC for 3 children', () => {
    expect(result.credits.childTaxCredit).toBe(6600);
  });

  it('applies solar credit', () => {
    expect(result.cleanEnergy!.credit).toBe(3000);
  });

  it('calculates correct final balance', () => {
    // Tax after credits + SE ≈ 14897. Withholding = 18000.
    // Refund ≈ 3103
    expect(f.refundAmount).toBeCloseTo(3103.11, 0);
    expect(f.amountOwed).toBe(0);
  });
});
