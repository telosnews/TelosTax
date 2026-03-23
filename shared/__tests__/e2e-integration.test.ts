/**
 * End-to-End Integration Tests — Phase 6: Multi-Model Hardening Strategy
 *
 * Full realistic tax return scenarios with hand-computed expected values.
 * Tests the entire pipeline: income → adjustments → deductions → tax → credits →
 * additional taxes → payments → refund/owed.
 *
 * Each scenario uses 2025 constants (OBBBA-updated where applicable).
 */
import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'e2e-test',
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

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 1: Single W-2 Employee — Straightforward Standard Deduction
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: Single W-2 Employee ($75k)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [
      {
        id: 'w1',
        employerName: 'Acme Corp',
        wages: 75000,
        federalTaxWithheld: 9500,
        socialSecurityWages: 75000,
        socialSecurityTax: 4650,
        medicareWages: 75000,
        medicareTax: 1087.50,
        stateWages: 75000,
        stateTaxWithheld: 3200,
      },
    ],
  });

  it('computes correct income, deductions, and tax', () => {
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // ── Income ──
    expect(f.totalWages).toBe(75000);
    expect(f.totalIncome).toBe(75000);

    // ── AGI ── (no adjustments)
    expect(f.agi).toBe(75000);

    // ── Deduction ── Single standard = $15,750 (OBBBA)
    expect(f.deductionUsed).toBe('standard');
    expect(f.standardDeduction).toBe(15750);
    expect(f.deductionAmount).toBe(15750);

    // ── Taxable Income ── 75000 - 15750 = 59250
    expect(f.taxableIncome).toBe(59250);

    // ── Tax Computation ──
    // 10%: 11925 * 0.10 = 1192.50
    // 12%: (48475 - 11925) * 0.12 = 36550 * 0.12 = 4386.00
    // 22%: (59250 - 48475) * 0.22 = 10775 * 0.22 = 2370.50
    // Total = 1192.50 + 4386.00 + 2370.50 = 7949.00
    expect(f.incomeTax).toBe(7949);

    // ── No additional taxes ──
    expect(f.seTax).toBe(0);
    expect(f.niitTax).toBe(0);
    expect(f.additionalMedicareTaxW2).toBe(0);

    // ── Payments ──
    expect(f.totalWithholding).toBe(9500);
    expect(f.totalPayments).toBe(9500);

    // ── Refund ── 9500 - 7949 = 1551
    expect(f.refundAmount).toBe(1551);
    expect(f.amountOwed).toBe(0);
  });

  it('has correct effective tax rate', () => {
    const result = calculateForm1040(taxReturn);
    // 7949 / 75000 = ~10.6%
    expect(result.form1040.effectiveTaxRate).toBeCloseTo(0.106, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 2: MFJ Family with Children + AOTC
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: MFJ Family ($120k, 2 children, AOTC)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [
      {
        id: 'w1',
        employerName: 'Primary Inc',
        wages: 80000,
        federalTaxWithheld: 8000,
      },
      {
        id: 'w2',
        employerName: 'Secondary LLC',
        wages: 40000,
        federalTaxWithheld: 4000,
      },
    ],
    childTaxCredit: {
      qualifyingChildren: 2,
      otherDependents: 0,
    },
    educationCredits: [
      {
        id: 'edu1',
        type: 'american_opportunity',
        studentName: 'Child 1',
        institution: 'State University',
        tuitionPaid: 6000,
        scholarships: 0,
      },
    ],
  });

  it('computes full pipeline correctly', () => {
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // ── Income ──
    expect(f.totalWages).toBe(120000);
    expect(f.totalIncome).toBe(120000);
    expect(f.agi).toBe(120000);

    // ── Deduction ── MFJ standard = $31,500 (OBBBA)
    expect(f.standardDeduction).toBe(31500);
    expect(f.deductionAmount).toBe(31500);

    // ── Taxable Income ── 120000 - 31500 = 88500
    expect(f.taxableIncome).toBe(88500);

    // ── Tax ── (MFJ brackets)
    // 10%: 23850 * 0.10 = 2385.00
    // 12%: (88500 - 23850) * 0.12 = 64650 * 0.12 = 7758.00
    // Total = 2385 + 7758 = 10143
    expect(f.incomeTax).toBe(10143);

    // ── Credits ──
    // CTC: 2 × $2,200 = $4,400 (below $400k MFJ threshold)
    expect(result.credits.childTaxCredit).toBe(4400);

    // AOTC: 100% of $2000 + 25% of $2000 = $2,500 (below $160k MFJ threshold)
    // 60% non-refundable = $1,500, 40% refundable = $1,000
    expect(result.credits.educationCredit).toBe(1500);
    expect(result.credits.aotcRefundableCredit).toBe(1000);

    // Total non-refundable = 4400 + 1500 = 5900
    expect(result.credits.totalNonRefundable).toBe(5900);

    // ── Tax After Credits ──
    // Income tax (10143) - non-refundable credits (5900) = 4243 (floor at 0)
    // No SE tax, NIIT, etc.
    expect(f.taxAfterCredits).toBeLessThan(f.incomeTax);

    // ── Payments ──
    expect(f.totalWithholding).toBe(12000);

    // Should get a refund (credits + withholding > tax)
    expect(f.refundAmount).toBeGreaterThan(0);
    expect(f.amountOwed).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 3: Self-Employed Freelancer (SE Tax + QBI)
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: Single Freelancer ($100k, SE tax + QBI)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    income1099NEC: [
      { id: '1', payerName: 'Client Alpha', amount: 70000 },
      { id: '2', payerName: 'Client Beta', amount: 30000 },
    ],
    expenses: [
      { id: 'e1', scheduleCLine: 18, category: 'office_expense', amount: 3000 },
      { id: 'e2', scheduleCLine: 25, category: 'utilities', amount: 2000 },
    ],
  });

  it('computes SE tax and QBI deduction', () => {
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // ── Schedule C ──
    expect(result.scheduleC).toBeDefined();
    expect(result.scheduleC!.grossIncome).toBe(100000);
    expect(result.scheduleC!.totalExpenses).toBe(5000);
    expect(result.scheduleC!.netProfit).toBe(95000);

    // ── SE Tax ──
    // Net earnings = 95000 * 0.9235 = 87732.50
    // SS tax = min(87732.50, 176100) * 0.124 = 10878.83
    // Medicare = 87732.50 * 0.029 = 2544.24
    // Total SE = 13423.07 (approx)
    expect(result.scheduleSE).toBeDefined();
    expect(result.scheduleSE!.totalSETax).toBeGreaterThan(13000);
    expect(result.scheduleSE!.totalSETax).toBeLessThan(14000);

    // ── SE Deduction (half of SE tax) ──
    const seDeduction = result.scheduleSE!.deductibleHalf;
    expect(seDeduction).toBeGreaterThan(6500);
    expect(seDeduction).toBeLessThan(7000);
    expect(f.seDeduction).toBe(seDeduction);

    // ── AGI ── totalIncome - SE deduction
    expect(f.totalIncome).toBe(95000);
    expect(f.agi).toBe(95000 - seDeduction);

    // ── QBI Deduction ──
    // Taxable income before QBI is below $191,950 threshold
    // QBI = 20% of net profit = 20% * 95000 = $19,000
    // But QBI limited to 20% of taxable income (before QBI)
    expect(f.qbiDeduction).toBeGreaterThan(0);

    // ── Taxable Income ── AGI - standard deduction - QBI (use toBeCloseTo for float precision)
    expect(f.taxableIncome).toBeCloseTo(
      f.agi - f.deductionAmount - f.qbiDeduction, 2,
    );

    // ── SE Tax appears in total ──
    expect(f.seTax).toBeGreaterThan(0);
    expect(f.totalTax).toBeGreaterThan(f.incomeTax);

    // ── No withholding → owes taxes ──
    expect(f.totalWithholding).toBe(0);
    expect(f.amountOwed).toBeGreaterThan(0);
    expect(f.refundAmount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 4: High-Income Investor (Capital Gains, NIIT, Dividends)
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: High-Income Investor ($250k W-2, $50k LTCG, $20k qualified divs)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [
      {
        id: 'w1',
        employerName: 'BigCorp',
        wages: 250000,
        federalTaxWithheld: 55000,
        socialSecurityWages: 176100,
        socialSecurityTax: 10918.20,
        medicareWages: 250000,
        medicareTax: 3625,
      },
    ],
    income1099B: [
      {
        id: 'b1',
        brokerageName: 'Fidelity',
        description: 'VTI shares',
        proceeds: 80000,
        costBasis: 30000,
        dateSold: '2025-08-15',
        dateAcquired: '2022-03-01',
        isLongTerm: true,
      },
    ],
    income1099DIV: [
      {
        id: 'd1',
        payerName: 'Vanguard',
        ordinaryDividends: 20000,
        qualifiedDividends: 20000,
      },
    ],
    income1099INT: [
      { id: 'i1', payerName: 'Chase Bank', amount: 5000 },
    ],
  });

  it('applies preferential cap gains rates and NIIT', () => {
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // ── Income ──
    expect(f.totalWages).toBe(250000);
    expect(f.capitalGainOrLoss).toBe(50000); // 80k - 30k
    expect(f.totalDividends).toBe(20000);
    expect(f.qualifiedDividends).toBe(20000);

    // Total income = 250k + 50k + 20k + 5k = 325k
    expect(f.totalIncome).toBe(325000);
    expect(f.agi).toBe(325000);

    // ── Taxable Income ── 325000 - 15750 = 309250
    expect(f.taxableIncome).toBe(309250);

    // ── Preferential rates should apply ──
    // Qualified divs ($20k) + LTCG ($50k) = $70k at 15% rate
    expect(f.preferentialTax).toBeGreaterThan(0);

    // ── NIIT ──
    // AGI = $325k, threshold = $200k → excess = $125k
    // Investment income = cap gains ($50k) + divs ($20k) + interest ($5k) = $75k
    // NIIT = 3.8% × min($75k, $125k) = 3.8% × $75k = $2,850
    expect(f.niitTax).toBe(2850);

    // ── Additional Medicare Tax ──
    // W-2 wages = $250k, threshold = $200k → excess = $50k
    // Additional Medicare = 0.9% × $50k = $450
    expect(f.additionalMedicareTaxW2).toBe(450);

    // ── Total tax includes NIIT + additional Medicare ──
    expect(f.totalTax).toBeGreaterThan(f.incomeTax + f.niitTax + f.additionalMedicareTaxW2 - 1);

    // ── Withholding ──
    expect(f.totalWithholding).toBe(55000);

    // Effective rate should be significant
    expect(f.effectiveTaxRate).toBeGreaterThan(0.15);
    expect(f.effectiveTaxRate).toBeLessThan(0.30);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 5: HoH with EITC (Low Income, 2 Children)
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: Head of Household ($28k, 2 children, EITC)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.HeadOfHousehold,
    w2Income: [
      {
        id: 'w1',
        employerName: 'Local Store',
        wages: 28000,
        federalTaxWithheld: 1200,
      },
    ],
    childTaxCredit: {
      qualifyingChildren: 2,
      otherDependents: 0,
    },
    eitcQualifyingChildren: 2,
  });

  it('receives substantial EITC and ACTC refund', () => {
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // ── Income ──
    expect(f.totalWages).toBe(28000);
    expect(f.agi).toBe(28000);

    // ── Deduction ── HoH standard = $23,625
    expect(f.standardDeduction).toBe(23625);

    // ── Taxable Income ── 28000 - 23625 = 4375
    expect(f.taxableIncome).toBe(4375);

    // ── Tax ── 10%: 4375 * 0.10 = 437.50
    expect(f.incomeTax).toBeCloseTo(437.50, 0);

    // ── CTC ── 2 × $2,200 = $4,400 (below $200k threshold)
    expect(result.credits.childTaxCredit).toBe(4400);

    // CTC ($4,400) exceeds tax ($437.50) → excess → ACTC
    // ACTC = min(excess, $1700*2, 15%*(28000-2500))
    //      = min(3962.50, 3400, 3825) = $3,400
    expect(result.credits.actcCredit).toBeGreaterThan(0);

    // ── EITC ──
    // 2 children, HoH, $28k earned income
    // Phase-in: 40% of $17,880 (max earned income for max credit) → max credit = $7,152
    // $28k is in plateau range ($17,880 - $23,350 phase-out start for non-MFJ)
    // Phase-out: starts at $23,350 for 2 children (non-MFJ)
    // Excess = 28000 - 23350 = 4650
    // Phase-out rate (2 children) = 21.06%
    // Reduction = 4650 * 0.2106 = 979.29
    // EITC ≈ 7152 - 979.29 = 6172.71
    expect(result.credits.eitcCredit).toBeGreaterThan(5000);
    expect(result.credits.eitcCredit).toBeLessThan(7200);

    // ── Refund ──
    // Should get substantial refund from EITC + ACTC + withholding
    expect(f.refundAmount).toBeGreaterThan(5000);
    expect(f.amountOwed).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 6: MFJ with State Tax (Virginia — Progressive)
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: MFJ with Virginia State Tax ($100k)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [
      {
        id: 'w1',
        employerName: 'Federal Agency',
        wages: 100000,
        federalTaxWithheld: 12000,
        stateWages: 100000,
        stateTaxWithheld: 4000,
      },
    ],
    stateReturns: [
      {
        stateCode: 'VA',
        residencyType: 'resident',
      },
    ],
  });

  it('computes both federal and Virginia state tax', () => {
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // ── Federal ──
    expect(f.totalWages).toBe(100000);
    expect(f.agi).toBe(100000);
    expect(f.taxableIncome).toBe(100000 - 31500); // 68500

    // ── State results exist ──
    expect(result.stateResults).toBeDefined();
    expect(result.stateResults).toHaveLength(1);

    const va = result.stateResults![0];
    expect(va.stateCode).toBe('VA');
    expect(va.federalAGI).toBe(100000);

    // Virginia is progressive: 2%/3%/5%/5.75%
    expect(va.stateIncomeTax).toBeGreaterThan(0);
    expect(va.totalStateTax).toBeGreaterThan(0);
    expect(va.effectiveStateRate).toBeGreaterThan(0);
    expect(va.effectiveStateRate).toBeLessThan(0.06); // Max VA rate is 5.75%
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 7: MFJ with Flat Tax State (Pennsylvania)
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: MFJ with Pennsylvania Flat Tax ($80k)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [
      {
        id: 'w1',
        employerName: 'Pittsburgh Corp',
        wages: 80000,
        federalTaxWithheld: 8000,
        stateWages: 80000,
        stateTaxWithheld: 2400,
      },
    ],
    stateReturns: [
      {
        stateCode: 'PA',
        residencyType: 'resident',
      },
    ],
  });

  it('applies PA flat rate correctly', () => {
    const result = calculateForm1040(taxReturn);

    expect(result.stateResults).toBeDefined();
    expect(result.stateResults).toHaveLength(1);

    const pa = result.stateResults![0];
    expect(pa.stateCode).toBe('PA');

    // PA flat rate = 3.07%
    // PA taxes wages directly (no standard deduction in the traditional sense)
    expect(pa.stateIncomeTax).toBeGreaterThan(0);
    expect(pa.totalStateTax).toBeGreaterThan(0);

    // Effective rate should be close to 3.07%
    expect(pa.effectiveStateRate).toBeGreaterThan(0.02);
    expect(pa.effectiveStateRate).toBeLessThan(0.04);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 8: No-Tax State (Texas)
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: Single with Texas (No Income Tax)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [
      {
        id: 'w1',
        employerName: 'Houston Energy',
        wages: 90000,
        federalTaxWithheld: 12000,
      },
    ],
    stateReturns: [
      {
        stateCode: 'TX',
        residencyType: 'resident',
      },
    ],
  });

  it('returns zero state tax for Texas', () => {
    const result = calculateForm1040(taxReturn);

    expect(result.stateResults).toBeDefined();
    expect(result.stateResults).toHaveLength(1);

    const tx = result.stateResults![0];
    expect(tx.stateCode).toBe('TX');
    expect(tx.stateIncomeTax).toBe(0);
    expect(tx.totalStateTax).toBe(0);
    expect(tx.effectiveStateRate).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 9: Mixed Income — W-2 + Interest + Dividends + Retirement
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: Single Mixed Income ($60k W-2, $3k int, $5k div, $20k 401k dist)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [
      {
        id: 'w1',
        employerName: 'MidCorp',
        wages: 60000,
        federalTaxWithheld: 7500,
      },
    ],
    income1099INT: [
      { id: 'i1', payerName: 'Bank A', amount: 2000 },
      { id: 'i2', payerName: 'Bank B', amount: 1000 },
    ],
    income1099DIV: [
      {
        id: 'd1',
        payerName: 'Schwab',
        ordinaryDividends: 5000,
        qualifiedDividends: 3000,
      },
    ],
    income1099R: [
      {
        id: 'r1',
        payerName: '401k Plan',
        grossDistribution: 20000,
        taxableAmount: 20000,
        federalTaxWithheld: 4000,
        distributionCode: '7', // Normal
      },
    ],
  });

  it('aggregates all income sources correctly', () => {
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // ── Individual Sources ──
    expect(f.totalWages).toBe(60000);
    expect(f.totalDividends).toBe(5000);
    expect(f.qualifiedDividends).toBe(3000);
    expect(f.totalRetirementIncome).toBe(20000);

    // ── Total Income = 60k + 3k int + 5k div + 20k retirement = 88k ──
    expect(f.totalIncome).toBe(88000);
    expect(f.agi).toBe(88000);

    // ── Taxable = 88000 - 15750 = 72250 ──
    expect(f.taxableIncome).toBe(72250);

    // ── Tax should reflect preferential rate on $3k qualified divs ──
    expect(f.incomeTax).toBeGreaterThan(0);
    expect(f.preferentialTax).toBeGreaterThan(0);

    // ── Withholding from W-2 + 1099-R ──
    expect(f.totalWithholding).toBe(11500); // 7500 + 4000
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 10: Itemized Deductions (Mortgage + SALT + Charity)
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: MFJ Itemized Deductions ($150k, mortgage + SALT + charity)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [
      {
        id: 'w1',
        employerName: 'BigLaw',
        wages: 150000,
        federalTaxWithheld: 25000,
      },
    ],
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 0,
      stateLocalIncomeTax: 12000,    // SALT components (combined cap $40,000)
      realEstateTax: 3000,           // Part of SALT total
      personalPropertyTax: 0,
      mortgageInterest: 18000,
      mortgageInsurancePremiums: 0,
      charitableCash: 8000,
      charitableNonCash: 2000,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
  });

  it('itemizes when exceeding standard deduction with SALT cap', () => {
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    expect(f.agi).toBe(150000);

    // ── Itemized ──
    // Mortgage: $18,000
    // SALT: $12k + $3k = $15,000 (below OBBBA $40k cap → full deduction)
    // Charity: $8,000 + $2,000 = $10,000
    // Total itemized = $43,000 > $31,500 standard → itemizes
    expect(f.deductionUsed).toBe('itemized');
    expect(f.itemizedDeduction).toBe(43000);
    expect(f.deductionAmount).toBe(43000);

    // ── Taxable = 150000 - 43000 = 107000 ──
    expect(f.taxableIncome).toBe(107000);

    // ── Tax ── (MFJ brackets on $107k)
    // 10%: 23850 * 0.10 = 2385
    // 12%: (96950 - 23850) * 0.12 = 73100 * 0.12 = 8772
    // 22%: (107000 - 96950) * 0.22 = 10050 * 0.22 = 2211
    // Total = 2385 + 8772 + 2211 = 13368
    expect(f.incomeTax).toBe(13368);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 11: MFS — Restricted Credits + Separate Brackets
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: MFS — Restricted Rules ($80k)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingSeparately,
    w2Income: [
      {
        id: 'w1',
        employerName: 'Corp',
        wages: 80000,
        federalTaxWithheld: 12000,
      },
    ],
    educationCredits: [
      {
        id: 'edu1',
        type: 'american_opportunity',
        studentName: 'Self',
        institution: 'University',
        tuitionPaid: 5000,
        scholarships: 0,
      },
    ],
  });

  it('denies education credits for MFS and uses MFS brackets', () => {
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // ── MFS standard deduction = $15,750 ──
    expect(f.standardDeduction).toBe(15750);
    expect(f.taxableIncome).toBe(80000 - 15750); // 64250

    // ── Tax ── (MFS brackets = same as Single)
    // 10%: 11925 * 0.10 = 1192.50
    // 12%: (48475 - 11925) * 0.12 = 4386
    // 22%: (64250 - 48475) * 0.22 = 3470.50
    // Total = 1192.50 + 4386 + 3470.50 = 9049
    expect(f.incomeTax).toBe(9049);

    // ── Education credits = $0 (MFS ineligible per IRC §25A(g)(6)) ──
    expect(result.credits.educationCredit).toBe(0);
    expect(result.credits.aotcRefundableCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 12: Cross-Validation — Refund vs Owed Accounting Identity
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: Accounting Identity Checks', () => {
  const scenarios = [
    { name: 'high-withholding → refund', wages: 80000, withholding: 15000 },
    { name: 'low-withholding → owed', wages: 80000, withholding: 5000 },
    { name: 'exact-match → zero', wages: 50000, withholding: 4350 },
  ];

  for (const { name, wages, withholding } of scenarios) {
    it(`satisfies totalPayments - totalTax identity (${name})`, () => {
      const taxReturn = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [
          {
            id: 'w1',
            employerName: 'Corp',
            wages,
            federalTaxWithheld: withholding,
          },
        ],
      });

      const result = calculateForm1040(taxReturn);
      const f = result.form1040;

      // Fundamental identity: refundAmount - amountOwed = totalPayments - taxAfterCredits - estimatedTaxPenalty
      const netResult = f.refundAmount - f.amountOwed;
      const netPayments = f.totalPayments - f.taxAfterCredits - f.estimatedTaxPenalty;
      expect(netResult).toBeCloseTo(netPayments, 2);

      // Exactly one of refund/owed should be non-zero (or both zero)
      expect(f.refundAmount >= 0).toBe(true);
      expect(f.amountOwed >= 0).toBe(true);
      if (f.refundAmount > 0) expect(f.amountOwed).toBe(0);
      if (f.amountOwed > 0) expect(f.refundAmount).toBe(0);

      // Tax after credits ≥ 0
      expect(f.taxAfterCredits).toBeGreaterThanOrEqual(0);
    });
  }

  it('totalTax ≥ taxAfterCredits (credits can only reduce)', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [
        { id: 'w1', employerName: 'Corp', wages: 100000, federalTaxWithheld: 15000 },
      ],
      childTaxCredit: { qualifyingChildren: 2, otherDependents: 0 },
    });

    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // totalTax should be > 0 before credits
    expect(f.totalTax).toBeGreaterThan(0);

    // taxAfterCredits = max(0, incomeTax + amt - nonRefundable) + SE + NIIT + ...
    // It should be ≤ totalTax (or equal if no non-refundable credits apply to SE/NIIT)
    expect(f.taxAfterCredits).toBeLessThanOrEqual(f.totalTax);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 13: Multi-State Filing (CA + TX)
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: Multi-State Filing (CA resident + TX income)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [
      {
        id: 'w1',
        employerName: 'CA Tech Co',
        wages: 120000,
        federalTaxWithheld: 20000,
        stateWages: 120000,
        stateTaxWithheld: 6000,
      },
    ],
    stateReturns: [
      { stateCode: 'CA', residencyType: 'resident' },
      { stateCode: 'TX', residencyType: 'nonresident' },
    ],
  });

  it('computes CA progressive tax and TX zero tax', () => {
    const result = calculateForm1040(taxReturn);

    expect(result.stateResults).toHaveLength(2);

    const ca = result.stateResults!.find(s => s.stateCode === 'CA')!;
    const tx = result.stateResults!.find(s => s.stateCode === 'TX')!;

    // CA should have substantial progressive tax
    expect(ca.stateIncomeTax).toBeGreaterThan(3000);
    expect(ca.effectiveStateRate).toBeGreaterThan(0.03);

    // TX should be zero
    expect(tx.stateIncomeTax).toBe(0);
    expect(tx.totalStateTax).toBe(0);
  });
});
