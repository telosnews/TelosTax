/**
 * Stress-Test Scenarios — New Feature Coverage
 *
 * These scenarios exercise the recently-shipped features that the existing
 * scenario suites don't fully cover:
 *
 *   S1  — AMT Positive Liability with Private Activity Bond interest (Form 6251)
 *   S2  — Form 4562 Business Depreciation → Schedule C → Form 1040 pipeline
 *   S3  — Multi-State Filing: CA resident + NY nonresident wages
 *   S4  — 1099-Q 529 Distribution + AOTC coordination
 *   S5  — Kitchen Sink: AMT + depreciation + state + credits + SE
 *   S6  — Trace integrity: every traced line round-trips
 *   S7  — State EITC supplement (California)
 *   S8  — AMT with Preferential Cap Gains (Part III bracket split)
 *   S9  — Section 179 election with business income cap
 *   S10 — Maryland county piggyback tax
 *   S11 — AMT exemption phase-out + 28% bracket
 *   S12 — Mid-quarter convention trigger (>40% Q4 basis)
 *   S13 — OBBBA SALT cap phase-down (MAGI > $500k)
 *
 * Every expected value has a hand-calculation comment.
 *
 * @authority IRC §55, §168, §179, §529, §25A, §1401 — cited per scenario
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'stress-test',
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
// S1 — AMT Positive Liability with Private Activity Bond Interest
//
// Profile: Single, $200k W-2, itemizing ($37k), plus $80k in private activity
//          bond interest (tax-exempt for regular tax, preference item for AMT).
//
// Hand calculation:
//   W-2 wages = $200,000
//   Total income = $200,000 (PAB interest is tax-exempt for regular)
//   AGI = $200,000
//
//   Schedule A: SALT $15k (under $40k OBBBA cap) + mortgage $15k + charitable $7k = $37k
//   Taxable income = $200,000 − $37,000 = $163,000
//
//   Regular tax (Single 2025):
//     10% on 11,925 = 1,192.50
//     12% on (48,475 − 11,925) = 4,386.00
//     22% on (103,350 − 48,475) = 12,072.50
//     24% on (163,000 − 103,350) = 14,316.00
//     Total = 31,967.00
//
//   AMT (IRC §55):
//     AMTI = $163,000 + $15,000 (SALT add-back) + $80,000 (PAB interest) = $258,000
//     Exemption = $88,100 (Single, below $609,350 phase-out start)
//     AMT base = $258,000 − $88,100 = $169,900
//     TMT = $169,900 × 26% = $44,174
//     AMT = max(0, $44,174 − $31,967) = $12,207
//
// @authority IRC §55(b)(1), §57(a)(5)
// ═════════════════════════════════════════════════════════════════════════════

describe('S1 — AMT Positive Liability via Private Activity Bonds', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Big Corp', wages: 200000, federalTaxWithheld: 45000, socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 200000, medicareTax: 2900 }],
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 0,
      stateLocalIncomeTax: 10000,
      realEstateTax: 5000,       // SALT total = $15k (under $40k OBBBA cap — fully deductible)
      personalPropertyTax: 0,
      mortgageInterest: 15000,
      mortgageInsurancePremiums: 0,
      charitableCash: 7000,
      charitableNonCash: 0,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
    amtData: {
      privateActivityBondInterest: 80000,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct regular taxable income', () => {
    expect(f.totalIncome).toBeCloseTo(200000, 0);
    expect(f.agi).toBeCloseTo(200000, 0);
    // Schedule A: SALT $15k (under $40k OBBBA cap) + mortgage $15k + charitable $7k = $37k
    expect(f.deductionAmount).toBeCloseTo(37000, 0);
    expect(f.taxableIncome).toBeCloseTo(163000, 0);
  });

  it('computes correct regular income tax', () => {
    expect(f.incomeTax).toBeCloseTo(31967, 0);
  });

  it('triggers AMT via private activity bond interest', () => {
    expect(result.amt).toBeDefined();
    expect(result.amt!.applies).toBe(true);
  });

  it('computes correct AMTI', () => {
    // $163k taxable + $15k SALT add-back + $80k PAB interest = $258k
    expect(result.amt!.amti).toBeCloseTo(258000, 0);
  });

  it('computes correct AMT amount', () => {
    // Exemption $88,100; base = $169,900; TMT = 26% × $169,900 = $44,174
    // AMT = $44,174 − $31,967 = $12,207
    expect(result.amt!.exemption).toBeCloseTo(88100, 0);
    expect(result.amt!.tentativeMinimumTax).toBeCloseTo(44174, 0);
    expect(result.amt!.amtAmount).toBeCloseTo(12207, 0);
  });

  it('adds AMT to total tax', () => {
    expect(f.amtAmount).toBeCloseTo(12207, 0);
    // Total tax ≥ regular income tax + AMT
    expect(f.totalTax).toBeGreaterThanOrEqual(f.incomeTax + 12000);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S2 — Form 4562 Business Depreciation Pipeline
//
// Profile: Single self-employed consultant, $120k NEC revenue, $20k expenses,
//          two depreciable assets.
//
// Hand calculation:
//   NEC income = $120,000
//   Ordinary expenses = $20,000
//   Depreciation:
//     MacBook Pro: cost $3,000, 5-year, placed 2025 → 100% bonus depreciation = $3,000
//     Office Furniture: cost $5,000, 7-year, placed 2024 → year 2 MACRS 200%DB/HY = 24.49% → $1,224.50
//   Total depreciation = $3,000 + $1,224.50 = $4,224.50
//   Schedule C net = $120,000 − $20,000 − $4,224.50 = $95,775.50
//   SE tax = $95,775.50 × 92.35% × 15.3% = $13,532.65
//
// @authority IRC §168(a), §168(k) (bonus depreciation)
// ═════════════════════════════════════════════════════════════════════════════

describe('S2 — Form 4562 Depreciation Pipeline', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    income1099NEC: [{ id: 'n1', payerName: 'Client Co', amount: 120000 }],
    businesses: [{
      id: 'b1',
      businessName: 'Consulting LLC',
      businessEin: '12-3456789',
      principalBusinessCode: '541990',
      accountingMethod: 'cash',
      didStartThisYear: false,
    }],
    expenses: [
      { id: 'e1', scheduleCLine: 8, category: 'advertising', amount: 5000 },
      { id: 'e2', scheduleCLine: 22, category: 'supplies', amount: 3000 },
      { id: 'e3', scheduleCLine: 27, category: 'otherExpenses', amount: 12000 },
    ],
    depreciationAssets: [
      {
        id: 'a1',
        description: 'MacBook Pro',
        cost: 3000,
        dateInService: '2025-04-15',
        propertyClass: 5,
        businessUsePercent: 100,
        section179Election: 0,
        priorDepreciation: 0,
      },
      {
        id: 'a2',
        description: 'Office Furniture',
        cost: 5000,
        dateInService: '2024-07-10',
        propertyClass: 7,
        businessUsePercent: 100,
        section179Election: 0,
        priorDepreciation: 714.50,   // Year 1: 14.29% × $5,000 = $714.50
      },
    ],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has depreciation results', () => {
    // Form 4562 result lives on scheduleC.form4562Result (computed inside scheduleC.ts)
    expect(result.scheduleC).toBeDefined();
    expect(result.scheduleC!.form4562Result).toBeDefined();
    expect(result.scheduleC!.form4562Result!.assetDetails.length).toBe(2);
  });

  it('computes MacBook Pro bonus depreciation (2025 asset, 100% bonus)', () => {
    const f4562 = result.scheduleC!.form4562Result!;
    const macbook = f4562.assetDetails.find(a => a.assetId === 'a1');
    expect(macbook).toBeDefined();
    // 2025 asset: 100% bonus depreciation = $3,000
    expect(macbook!.bonusDepreciation).toBeCloseTo(3000, 0);
    expect(macbook!.totalDepreciation).toBeCloseTo(3000, 0);
  });

  it('computes furniture year-2 depreciation (7-year MACRS HY)', () => {
    const f4562 = result.scheduleC!.form4562Result!;
    const furniture = f4562.assetDetails.find(a => a.assetId === 'a2');
    expect(furniture).toBeDefined();
    // 7-year MACRS HY year 2 = 24.49% × $5,000 = $1,224.50
    expect(furniture!.macrsDepreciation).toBeCloseTo(1224.50, 0);
    expect(furniture!.totalDepreciation).toBeCloseTo(1224.50, 0);
  });

  it('flows total depreciation to Schedule C', () => {
    const f4562 = result.scheduleC!.form4562Result!;
    // Total: $3,000 (bonus) + $1,224.50 (MACRS) = $4,224.50
    expect(f4562.totalDepreciation).toBeCloseTo(4224.50, 0);
    expect(result.scheduleC!.depreciationDeduction).toBeCloseTo(4224.50, 0);
  });

  it('has correct Schedule C net profit', () => {
    // $120k − $20k expenses − $4,224.50 depreciation = $95,775.50
    expect(result.scheduleC!.netProfit).toBeCloseTo(95775.50, 0);
  });

  it('has correct SE tax', () => {
    // SE income = $95,775.50 × 92.35% = $88,448.67
    // SE tax = $88,448.67 × 15.3% = $13,532.65
    expect(f.seTax).toBeCloseTo(13532.65, 0);
  });

  it('total income includes Schedule C net', () => {
    expect(f.totalIncome).toBeCloseTo(95775.50, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S3 — Multi-State Filing: CA Resident + NY Source Income
//
// Profile: MFJ, lives in California. Spouse works remote for NY employer.
//   - Resident: CA (all income taxed)
//   - Nonresident: NY (NY-source wages only)
//
// Hand calculation:
//   W-2 #1 (primary): $150k wages, CA employer
//   W-2 #2 (spouse):  $100k wages, NY employer, NY state withholding $5k
//   Total federal income = $250,000
//   Federal AGI = $250,000
//   Standard deduction (MFJ) = $31,500
//   Federal taxable = $218,500
//
//   CA (resident, all income):
//     State AGI = $250,000
//     CA standard deduction (MFJ 2025) ≈ $11,080
//     Progressive brackets apply
//
//   NY (nonresident, $100k NY-source):
//     Allocation ratio = $100k / $250k = 0.40
//     NY tax computed on full income, then × allocation ratio
//
// @authority IRC §164(a), CA RTC §17041, NY Tax Law §601
// ═════════════════════════════════════════════════════════════════════════════

describe('S3 — Multi-State: CA Resident + NY Nonresident', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    firstName: 'Jane',
    lastName: 'Doe',
    w2Income: [
      { id: 'w1', employerName: 'CA Employer', wages: 150000, federalTaxWithheld: 30000, socialSecurityWages: 150000, socialSecurityTax: 9300, medicareWages: 150000, medicareTax: 2175, state: 'CA', stateWages: 150000, stateTaxWithheld: 8000 },
      { id: 'w2', employerName: 'NY Employer', wages: 100000, federalTaxWithheld: 20000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450, state: 'NY', stateWages: 100000, stateTaxWithheld: 5000 },
    ],
    stateReturns: [
      { stateCode: 'CA', residencyType: 'resident' },
      { stateCode: 'NY', residencyType: 'nonresident' },
    ],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct federal income and AGI', () => {
    expect(f.totalWages).toBeCloseTo(250000, 0);
    expect(f.agi).toBeCloseTo(250000, 0);
  });

  it('uses MFJ standard deduction', () => {
    expect(f.deductionUsed).toBe('standard');
    expect(f.deductionAmount).toBe(31500);
  });

  it('produces state results for both states', () => {
    expect(result.stateResults).toBeDefined();
    expect(result.stateResults!.length).toBe(2);

    const ca = result.stateResults!.find(s => s.stateCode === 'CA');
    const ny = result.stateResults!.find(s => s.stateCode === 'NY');
    expect(ca).toBeDefined();
    expect(ny).toBeDefined();
  });

  it('CA taxes all income (resident)', () => {
    const ca = result.stateResults!.find(s => s.stateCode === 'CA')!;
    expect(ca.residencyType).toBe('resident');
    expect(ca.federalAGI).toBeCloseTo(250000, 0);
    // CA should tax full AGI (all income)
    expect(ca.stateAGI).toBeCloseTo(250000, 0);
    // CA progressive tax on $250k MFJ → should be meaningful
    expect(ca.stateIncomeTax).toBeGreaterThan(8000);
    expect(ca.stateIncomeTax).toBeLessThan(25000);
  });

  it('NY taxes only NY-source income (nonresident)', () => {
    const ny = result.stateResults!.find(s => s.stateCode === 'NY')!;
    expect(ny.residencyType).toBe('nonresident');
    // Nonresident NY: compute on full income, then allocate
    // Allocation = $100k / $250k = 0.40
    expect(ny.allocationRatio).toBeCloseTo(0.40, 2);
    // NY tax > 0 but less than CA (partial allocation)
    expect(ny.totalStateTax).toBeGreaterThan(0);
  });

  it('both states produce refund/owed calculations', () => {
    const ca = result.stateResults!.find(s => s.stateCode === 'CA')!;
    const ny = result.stateResults!.find(s => s.stateCode === 'NY')!;
    // Withholding should be populated
    expect(ca.stateWithholding).toBeCloseTo(8000, 0);
    expect(ny.stateWithholding).toBeCloseTo(5000, 0);
    // Both should produce a refund/owed amount (positive or negative)
    expect(typeof ca.stateRefundOrOwed).toBe('number');
    expect(typeof ny.stateRefundOrOwed).toBe('number');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S4 — 1099-Q (529 Distribution) + AOTC Coordination
//
// Profile: HOH parent with college student dependent. Received 529 distribution.
//   - 1099-Q: $20k gross, $5k earnings, $15k basis
//   - Student QEE: $25k (tuition + fees)
//   - AOTC claims first $4k of QEE → remaining QEE for 529 = $21k
//
// IRC §529(c)(3)(B) exclusion ratio:
//   AQEE = $25,000 − $4,000 (AOTC) = $21,000
//   Distribution = $20,000
//   Since AQEE ($21k) ≥ distribution ($20k), entire distribution is tax-free
//   Taxable 529 earnings = $0
//
// @authority IRC §529(c)(3)(B), §25A
// ═════════════════════════════════════════════════════════════════════════════

describe('S4 — 1099-Q 529 Distribution + AOTC Coordination', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.HeadOfHousehold,
    dependents: [{ id: 'd1', firstName: 'Alex', lastName: 'Doe', dateOfBirth: '2006-05-15', relationship: 'child', monthsLivedWithYou: 12, isStudent: true }],
    w2Income: [{ id: 'w1', employerName: 'Main Corp', wages: 65000, federalTaxWithheld: 7500, socialSecurityWages: 65000, socialSecurityTax: 4030, medicareWages: 65000, medicareTax: 942.50 }],
    income1099Q: [{
      id: 'q1',
      payerName: 'State 529 Plan',
      grossDistribution: 20000,
      earnings: 5000,
      basisReturn: 15000,
      qualifiedExpenses: 25000,
      expensesClaimedForCredit: 4000,  // AOTC uses first $4k
      distributionType: 'qualified',
    }],
    educationCredits: [{
      id: 'ec1',
      studentName: 'Alex Doe',
      institution: 'State University',
      type: 'american_opportunity',
      tuitionPaid: 25000,
      scholarships: 0,
    }],
    incomeDiscovery: { education_credit: 'yes' },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('does not tax 529 distribution when AQEE covers full amount', () => {
    // AQEE = $25k - $4k (AOTC) = $21k ≥ $20k distribution → fully excluded
    // No taxable 529 earnings should appear in income
    // totalIncome should be W-2 wages only
    expect(f.totalIncome).toBeCloseTo(65000, 0);
  });

  it('claims AOTC education credit', () => {
    // AOTC: 100% of first $2k + 25% of next $2k = $2,500
    const totalEducationCredit = (result.credits.educationCredit || 0) + (result.credits.aotcRefundableCredit || 0);
    expect(totalEducationCredit).toBeCloseTo(2500, 0);
  });

  it('applies both AOTC non-refundable and refundable portions', () => {
    // 40% of AOTC is refundable = $1,000
    expect(result.credits.aotcRefundableCredit).toBeCloseTo(1000, 0);
    // 60% is non-refundable = $1,500
    expect(result.credits.educationCredit).toBeCloseTo(1500, 0);
  });

  it('produces correct refund', () => {
    // Taxpayer should get a refund — low income + education credit
    expect(f.refundAmount).toBeGreaterThan(0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S5 — Kitchen Sink: AMT + Depreciation + State + Credits + SE
//
// Profile: MFJ, both self-employed. Complex return:
//   - $180k NEC + $40k expenses + $2.5k depreciation (100% bonus on $2.5k laptop)
//   - $60k W-2 wages (spouse)
//   - 2 kids → CTC ($4,400 OBBBA: $2,200/child)
//   - ISO exercise $100k → AMT trigger
//   - CA resident
//   - HSA deduction $8,550 (family)
//
// This tests that all modules interact correctly when stacked.
//
// Hand calculation:
//   Schedule C net = $180k − $40k − $2.5k = $137,500
//   Total income = $60k + $137.5k = $197,500
//   SE tax = $18,078.86; SE deduction = $9,039.43
//   HSA deduction = $8,550
//   Total adjustments = $17,589.43
//   AGI = $197,500 − $17,589.43 = $179,910.57
//   Standard deduction (MFJ) = $31,500
//   Taxable income = $148,410.57 → CTC reduces, then credits
//   AMT with $100k ISO: triggers AMT of $13,578.42
//   Total tax = $48,085.61
//
// @authority IRC §55, §168, §24, §1401
// ═════════════════════════════════════════════════════════════════════════════

describe('S5 — Kitchen Sink: AMT + Depreciation + State + Credits + SE', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    dependents: [
      { id: 'd1', firstName: 'Child1', lastName: 'Test', dateOfBirth: '2015-03-10', relationship: 'child', monthsLivedWithYou: 12 },
      { id: 'd2', firstName: 'Child2', lastName: 'Test', dateOfBirth: '2018-08-20', relationship: 'child', monthsLivedWithYou: 12 },
    ],
    w2Income: [{ id: 'w1', employerName: 'Spouse Corp', wages: 60000, federalTaxWithheld: 7500, socialSecurityWages: 60000, socialSecurityTax: 3720, medicareWages: 60000, medicareTax: 870 }],
    income1099NEC: [{ id: 'n1', payerName: 'Main Client', amount: 180000 }],
    expenses: [
      { id: 'e1', scheduleCLine: 8, category: 'advertising', amount: 10000 },
      { id: 'e2', scheduleCLine: 22, category: 'supplies', amount: 8000 },
      { id: 'e3', scheduleCLine: 27, category: 'otherExpenses', amount: 22000 },
    ],
    depreciationAssets: [{
      id: 'a1',
      description: 'Laptop',
      cost: 2500,
      dateInService: '2025-01-15',
      propertyClass: 5,
      businessUsePercent: 100,
      section179Election: 0,
      priorDepreciation: 0,
    }],
    hsaContribution: {
      coverageType: 'family',
      totalContributions: 8550,
    },
    amtData: {
      isoExerciseSpread: 100000,
    },
    childTaxCredit: { qualifyingChildren: 2, otherDependents: 0 },
    stateReturns: [
      { stateCode: 'CA', residencyType: 'resident' },
    ],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('computes Schedule C with depreciation', () => {
    expect(result.scheduleC).toBeDefined();
    // Laptop: 2025 asset, 100% bonus = $2,500
    expect(result.scheduleC!.depreciationDeduction).toBeCloseTo(2500, 0);
    // $180k − $40k expenses − $2.5k depreciation = $137,500
    expect(result.scheduleC!.netProfit).toBeCloseTo(137500, 0);
  });

  it('has correct total income (W-2 + Schedule C net)', () => {
    // $60k W-2 + $137.5k Schedule C net = $197,500
    expect(f.totalIncome).toBeCloseTo(197500, 0);
  });

  it('applies HSA and SE adjustments', () => {
    expect(f.hsaDeduction).toBe(8550);
    expect(f.seDeduction).toBeCloseTo(9039.43, 0);
    expect(f.totalAdjustments).toBeCloseTo(17589.43, 0);
  });

  it('triggers AMT via ISO exercise', () => {
    expect(result.amt).toBeDefined();
    expect(result.amt!.applies).toBe(true);
    expect(result.amt!.amtAmount).toBeCloseTo(13578.42, 0);
    expect(result.amt!.adjustments.isoExerciseSpread).toBe(100000);
  });

  it('applies CTC for 2 kids at OBBBA $2,200/child', () => {
    // OBBBA: $2,200 per child × 2 = $4,400 (AGI $179.9k well below $400k phase-out)
    expect(result.credits.childTaxCredit).toBeCloseTo(4400, 0);
  });

  it('computes SE tax', () => {
    // $137,500 × 92.35% × 15.3% = $18,078.86
    expect(f.seTax).toBeCloseTo(18078.86, 0);
    expect(result.scheduleSE).toBeDefined();
  });

  it('produces CA state return', () => {
    expect(result.stateResults).toBeDefined();
    expect(result.stateResults!.length).toBe(1);
    const ca = result.stateResults![0];
    expect(ca.stateCode).toBe('CA');
    expect(ca.stateIncomeTax).toBeGreaterThan(5000);
    expect(ca.totalStateTax).toBeGreaterThan(0);
  });

  it('all modules produce a correct total tax', () => {
    // Line 24: max(0, incomeTax + AMT − nonRefundableCredits) + SE + other taxes
    // Non-refundable credits ($4,400 CTC) reduce income tax + AMT portion
    expect(f.totalTax).toBeCloseTo(43685.61, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S6 — Trace Integrity: Every traced line round-trips
//
// Profile: Simple MFJ W-2 return with 1 child. Enable tracing, verify all
//          trace entries have valid lineId, label, value, and formula.
//
// @authority Engine trace system
// ═════════════════════════════════════════════════════════════════════════════

describe('S6 — Trace Integrity', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    dependents: [{ id: 'd1', firstName: 'Kid', lastName: 'Test', dateOfBirth: '2017-01-01', relationship: 'child', monthsLivedWithYou: 12 }],
    w2Income: [{ id: 'w1', employerName: 'Test Co', wages: 85000, federalTaxWithheld: 12000, socialSecurityWages: 85000, socialSecurityTax: 5270, medicareWages: 85000, medicareTax: 1232.50 }],
    childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 },
  });

  const result = calculateForm1040(taxReturn, { enabled: true });
  const f = result.form1040;

  it('produces trace data when tracing is enabled', () => {
    expect(result.traces).toBeDefined();
    expect(result.traces!.length).toBeGreaterThan(0);
  });

  it('every trace has required fields', () => {
    for (const trace of result.traces!) {
      expect(trace.lineId).toBeTruthy();
      expect(trace.label).toBeTruthy();
      expect(typeof trace.value).toBe('number');
    }
  });

  it('traces key Form 1040 lines', () => {
    const traceIds = result.traces!.map(t => t.lineId);
    // Core lines that should always have traces (format: form1040.lineN)
    expect(traceIds).toContain('form1040.line9');   // Total Income
    expect(traceIds).toContain('form1040.line11');  // AGI
    expect(traceIds).toContain('form1040.line15');  // Taxable Income
    expect(traceIds).toContain('form1040.line16');  // Income Tax
    expect(traceIds).toContain('form1040.line24');  // Total Tax
  });

  it('trace values match Form 1040 values', () => {
    const findTrace = (id: string) => result.traces!.find(t => t.lineId === id);

    const totalIncome = findTrace('form1040.line9');
    expect(totalIncome).toBeDefined();
    expect(totalIncome!.value).toBeCloseTo(f.totalIncome, 0);

    const agi = findTrace('form1040.line11');
    expect(agi).toBeDefined();
    expect(agi!.value).toBeCloseTo(f.agi, 0);

    const taxableIncome = findTrace('form1040.line15');
    expect(taxableIncome).toBeDefined();
    expect(taxableIncome!.value).toBeCloseTo(f.taxableIncome, 0);
  });

  it('total income trace has formula', () => {
    const totalIncome = result.traces!.find(t => t.lineId === 'form1040.line9');
    expect(totalIncome).toBeDefined();
    expect(totalIncome!.formula).toBeTruthy();
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S7 — California State EITC
//
// Profile: HOH, $28k W-2, 1 qualifying child. Tests state EITC supplement.
//   CA CalEITC applies at lower income levels than federal EITC.
//
// Hand calculation:
//   Federal EITC (HOH, 1 child, $28k) ≈ $3,584.93 (2025 brackets)
//   CA state credits (including CalEITC) = $3,768
//   CA income tax = $169.20 (fully offset by credits → $0 total state tax)
//
// @authority CA RTC §17052, IRC §32
// ═════════════════════════════════════════════════════════════════════════════

describe('S7 — State EITC: California CalEITC', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.HeadOfHousehold,
    dependents: [{ id: 'd1', firstName: 'Child', lastName: 'Test', dateOfBirth: '2015-06-01', relationship: 'child', monthsLivedWithYou: 12 }],
    w2Income: [{ id: 'w1', employerName: 'Local Co', wages: 28000, federalTaxWithheld: 2000, socialSecurityWages: 28000, socialSecurityTax: 1736, medicareWages: 28000, medicareTax: 406, state: 'CA', stateWages: 28000, stateTaxWithheld: 400 }],
    incomeDiscovery: { eitc: 'yes' },
    stateReturns: [
      { stateCode: 'CA', residencyType: 'resident' },
    ],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('qualifies for federal EITC', () => {
    // HOH, 1 child, $28k → EITC ≈ $3,585 (2025 brackets: max $4,328, phase-out starts $23,350)
    expect(result.credits.eitcCredit).toBeCloseTo(3584.93, 0);
  });

  it('produces CA state result', () => {
    expect(result.stateResults).toBeDefined();
    const ca = result.stateResults!.find(s => s.stateCode === 'CA');
    expect(ca).toBeDefined();
  });

  it('CA applies CalEITC as state credit', () => {
    const ca = result.stateResults!.find(s => s.stateCode === 'CA')!;
    // CalEITC + exemption credits produce meaningful state credits
    // At $28K earned income for 1 child, CalEITC is in phase-out
    // Exemption credits: $153 (HoH) + $475 (1 dependent) = $628
    expect(ca.stateCredits).toBeCloseTo(628, 0);
    // Credits fully offset the state income tax
    expect(ca.totalStateTax).toBe(0);
  });

  it('produces meaningful federal refund for low-income HOH', () => {
    // $28k HOH with 1 child, EITC + withholding → should get refund
    expect(f.refundAmount).toBeGreaterThan(2000);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S8 — AMT with Preferential Capital Gains (Part III Bracket Split)
//
// Profile: Single, $300k W-2, $100k LTCG, $80k ISO spread.
//          Tests Part III computation where AMT uses preferential rates
//          for capital gains (0/15/20% zones) rather than flat 26/28%.
//
// The Part III check: if AMT taxable income has net LTCG, the TMT should
// be computed using the lesser of the flat 26/28% rate or the preferential
// capital gains rate schedule, per IRC §55(b)(3).
//
// Hand calculation:
//   Total income = $400k ($300k W-2 + $100k LTCG)
//   Standard deduction (Single) = $15,750
//   Taxable income = $384,250
//   Regular tax (with 15% LTCG rate) = $84,034.75
//
//   AMTI = $384,250 + $15,750 (std ded add-back) + $80k (ISO) = $480,000
//   Part III: flat rate TMT = $104,950; special computation TMT = $91,950
//   TMT = min(flat, special) = $91,950
//   AMT = $91,950 − $84,034.75 = $7,915.25
//
// @authority IRC §55(b)(3), §1(h)
// ═════════════════════════════════════════════════════════════════════════════

describe('S8 — AMT with Preferential Capital Gains (Part III)', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Big Corp', wages: 300000, federalTaxWithheld: 70000, socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 300000, medicareTax: 4350 }],
    income1099B: [{
      id: 'b1',
      brokerName: 'Fidelity',
      description: 'AAPL stock',
      dateAcquired: '2020-01-15',
      dateSold: '2025-08-01',
      proceeds: 200000,
      costBasis: 100000,
      isLongTerm: true,
    }],
    amtData: {
      isoExerciseSpread: 80000,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct total income with LTCG', () => {
    // $300k wages + $100k LTCG = $400k
    expect(f.totalIncome).toBeCloseTo(400000, 0);
  });

  it('uses preferential rates for capital gains in regular tax', () => {
    expect(f.taxableIncome).toBeCloseTo(384250, 0);
    expect(f.incomeTax).toBeCloseTo(84034.75, 0);
  });

  it('triggers AMT and uses Part III preferential computation', () => {
    expect(result.amt).toBeDefined();
    expect(result.amt!.applies).toBe(true);
    // Part III must be invoked because the return has net LTCG
    expect(result.amt!.usedPartIII).toBe(true);
    expect(result.amt!.partIII).toBeDefined();
  });

  it('AMT Part III computes correct preferential vs flat rate comparison', () => {
    const partIII = result.amt!.partIII!;
    // Flat rate TMT (26/28% on full AMT base) = $104,950
    expect(partIII.flatRateTax).toBeCloseTo(104950, 0);
    // Special computation (26/28% on ordinary + preferential on CG) = $91,950
    expect(partIII.tentativeMinimumTax).toBeCloseTo(91950, 0);
    // Part III saves taxpayer: uses lesser amount
    expect(partIII.tentativeMinimumTax).toBeLessThan(partIII.flatRateTax);
  });

  it('computes correct AMTI and AMT amount', () => {
    // AMTI = $384,250 + $15,750 + $80,000 = $480,000
    expect(result.amt!.amti).toBeCloseTo(480000, 0);
    // AMT = $91,950 − $84,034.75 = $7,915.25
    expect(result.amt!.amtAmount).toBeCloseTo(7915.25, 0);
  });

  it('total tax includes AMT', () => {
    expect(f.amtAmount).toBeCloseTo(7915.25, 0);
    expect(f.totalTax).toBeCloseTo(96650, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S9 — Section 179 Election with Business Income Limit
//
// Profile: Single, Schedule C with $50k net income (before 179).
//          Buys $60k of equipment and elects full Section 179.
//          §179 deduction is limited to net business income ($50k).
//          Excess $10k becomes carryforward (not bonus-eligible on elected basis).
//
// Hand calculation:
//   NEC income = $80,000
//   Expenses = $30,000
//   Business income before §179 = $50,000
//   §179 elected = $60,000, allowed = $50,000 (income-limited)
//   §179 carryforward = $10,000
//   Total depreciation = $50,000
//   Schedule C net = $80k − $30k − $50k = $0
//   SE tax = $0
//
// @authority IRC §179(b)(3) — taxable income limitation
// ═════════════════════════════════════════════════════════════════════════════

describe('S9 — Section 179 with Business Income Cap', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 80000 }],
    businesses: [{
      id: 'b1',
      businessName: 'Tech Shop',
      businessEin: '11-2233445',
      principalBusinessCode: '541511',
      accountingMethod: 'cash',
      didStartThisYear: false,
    }],
    expenses: [
      { id: 'e1', scheduleCLine: 27, category: 'otherExpenses', amount: 30000 },
    ],
    depreciationAssets: [{
      id: 'a1',
      description: 'CNC Machine',
      cost: 60000,
      dateInService: '2025-03-01',
      propertyClass: 7,
      businessUsePercent: 100,
      section179Election: 60000,  // Full cost elected
      priorDepreciation: 0,
    }],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has Form 4562 result', () => {
    // Form 4562 result lives on scheduleC.form4562Result (computed inside scheduleC.ts)
    expect(result.scheduleC).toBeDefined();
    expect(result.scheduleC!.form4562Result).toBeDefined();
  });

  it('Section 179 is limited to business income', () => {
    const f4562 = result.scheduleC!.form4562Result!;
    // Business income before 179 = $80k NEC − $30k expenses = $50k
    // §179 election = $60k, but limited to $50k
    expect(f4562.section179Deduction).toBeCloseTo(50000, 0);
  });

  it('total depreciation equals income-limited Section 179', () => {
    const f4562 = result.scheduleC!.form4562Result!;
    // Only $50k deducted; excess $10k is carryforward, not bonus-eligible
    expect(f4562.totalDepreciation).toBeCloseTo(50000, 0);
  });

  it('Schedule C net profit is zero', () => {
    // Net profit = $80k − $30k expenses − $50k depreciation = $0
    expect(result.scheduleC!.netProfit).toBeCloseTo(0, 0);
  });

  it('SE tax is zero on zero net profit', () => {
    expect(f.seTax).toBe(0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S10 — Maryland County Piggyback Tax
//
// Profile: MFJ, $120k combined W-2 income, MD resident in Montgomery County.
//          Tests the county piggyback local tax (3.2% for MoCo).
//
// Hand calculation (HB 352 — flat std ded $6,700 MFJ, joint brackets):
//   MD AGI = $120K, std ded $6,700, exemptions 2×$3,200 = $6,400
//   Taxable = $120K - $6,700 - $6,400 = $106,900
//   Tax: $20 + $30 + $40 + ($103,900 × 4.75%) = $5,025.25
//   Montgomery County piggyback (3.2% of $106,900) = $3,420.80
//   Total state + local = $8,446.05
//
// @authority MD Tax-General §10-103, §10-106
// ═════════════════════════════════════════════════════════════════════════════

describe('S10 — Maryland County Piggyback Tax', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [
      { id: 'w1', employerName: 'Federal Agency', wages: 120000, federalTaxWithheld: 18000, socialSecurityWages: 120000, socialSecurityTax: 7440, medicareWages: 120000, medicareTax: 1740, state: 'MD', stateWages: 120000, stateTaxWithheld: 6000 },
    ],
    stateReturns: [
      { stateCode: 'MD', residencyType: 'resident', stateSpecificData: { countyCode: 'MONTGOMERY' } },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('produces MD state result', () => {
    expect(result.stateResults).toBeDefined();
    const md = result.stateResults!.find(s => s.stateCode === 'MD');
    expect(md).toBeDefined();
  });

  it('computes MD state income tax (progressive)', () => {
    const md = result.stateResults!.find(s => s.stateCode === 'MD')!;
    expect(md.stateIncomeTax).toBeCloseTo(5025.25, 0);
  });

  it('includes Montgomery County local piggyback tax', () => {
    const md = result.stateResults!.find(s => s.stateCode === 'MD')!;
    // Montgomery County rate is 3.2% of MD taxable income ($106,900)
    expect(md.localTax).toBeCloseTo(3420.80, 0);
  });

  it('totalStateTax includes both state and local', () => {
    const md = result.stateResults!.find(s => s.stateCode === 'MD')!;
    expect(md.totalStateTax).toBeCloseTo(8446.05, 0);
    expect(md.totalStateTax).toBe(md.stateIncomeTax + md.localTax);
  });

  it('calculates refund/owed against withholding', () => {
    const md = result.stateResults!.find(s => s.stateCode === 'MD')!;
    expect(md.stateWithholding).toBeCloseTo(6000, 0);
    // stateRefundOrOwed = withholding - totalStateTax
    expect(md.stateRefundOrOwed).toBeCloseTo(6000 - md.totalStateTax, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S11 — AMT Exemption Phase-Out + 28% Bracket
//
// Profile: Single, $500k W-2, $300k ISO spread. Tests:
//   1. AMT exemption reduction (25% of AMTI above $609,350 threshold)
//   2. 28% bracket activation (AMT base above $239,100)
//
// Hand calculation:
//   Wages = $500,000
//   Standard deduction (Single) = $15,750
//   Taxable income = $484,250
//
//   AMTI = $484,250 + $15,750 (std ded add-back) + $300,000 (ISO) = $800,000
//   Exemption: $88,100 − 25% × ($800,000 − $626,350) = $88,100 − $43,412.50 = $44,687.50
//   AMT base = $800,000 − $44,687.50 = $755,312.50
//   TMT = 26% × $239,100 + 28% × ($755,312.50 − $239,100)
//       = $62,166 + $144,539.50 = $206,705.50
//   Regular tax = $139,034.75
//   AMT = $206,705.50 − $139,034.75 = $67,670.75
//
// @authority IRC §55(d)(3) (phase-out), §55(b)(1)(A) (26/28% rates)
// ═════════════════════════════════════════════════════════════════════════════

describe('S11 — AMT Exemption Phase-Out + 28% Bracket', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Corp', wages: 500000, federalTaxWithheld: 120000, socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 500000, medicareTax: 7250 }],
    amtData: {
      isoExerciseSpread: 300000,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('computes correct regular tax', () => {
    expect(f.taxableIncome).toBeCloseTo(484250, 0);
    expect(f.incomeTax).toBeCloseTo(139034.75, 0);
  });

  it('triggers AMT with large ISO spread', () => {
    expect(result.amt).toBeDefined();
    expect(result.amt!.applies).toBe(true);
  });

  it('reduces exemption via 25% phase-out', () => {
    // AMTI = $800,000 > $626,350 phase-out start (Rev. Proc. 2024-40 §3.02)
    expect(result.amt!.amti).toBeCloseTo(800000, 0);
    // Exemption: $88,100 − 25% × ($800k − $626,350) = $44,687.50
    expect(result.amt!.exemption).toBeCloseTo(44687.50, 0);
  });

  it('uses both 26% and 28% AMT brackets', () => {
    // AMT base = $755,312.50 (well above $239,100 threshold)
    expect(result.amt!.amtBase).toBeCloseTo(755312.50, 0);
    // TMT = 26% × $239,100 + 28% × remainder = $206,705.50
    expect(result.amt!.tentativeMinimumTax).toBeCloseTo(206705.50, 0);
  });

  it('computes correct AMT amount', () => {
    // AMT = TMT − regular tax = $206,705.50 − $139,034.75 = $67,670.75
    expect(result.amt!.amtAmount).toBeCloseTo(67670.75, 0);
  });

  it('total tax reflects large AMT liability', () => {
    expect(f.totalTax).toBeCloseTo(209405.50, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S12 — Mid-Quarter Convention Trigger
//
// Profile: Single, $200k NEC, two assets — small Q1 asset + large Q4 asset.
//          Q4 basis ($10k) / total basis ($11k) = 90.9% > 40% threshold.
//          Triggers mid-quarter convention per IRC §168(d)(3).
//
// Note: With 2025 100% bonus depreciation, both assets get full bonus and
//       MACRS is $0. The convention detection still correctly identifies
//       mid-quarter (it tests pre-bonus basis ratios).
//
// Hand calculation:
//   Small tool: $1,000 (Q1, 5-year) → 100% bonus = $1,000
//   Big machine: $10,000 (Q4, 7-year) → 100% bonus = $10,000
//   Total depreciation = $11,000
//   Schedule C net = $200k − $11k = $189,000
//
// @authority IRC §168(d)(3) (mid-quarter convention)
// ═════════════════════════════════════════════════════════════════════════════

describe('S12 — Mid-Quarter Convention Trigger', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 200000 }],
    businesses: [{
      id: 'b1',
      businessName: 'Shop',
      businessEin: '11-1111111',
      principalBusinessCode: '541511',
      accountingMethod: 'cash',
      didStartThisYear: false,
    }],
    depreciationAssets: [
      {
        id: 'a1',
        description: 'Small tool',
        cost: 1000,
        dateInService: '2025-03-01',   // Q1
        propertyClass: 5,
        businessUsePercent: 100,
        section179Election: 0,
        priorDepreciation: 0,
      },
      {
        id: 'a2',
        description: 'Big machine',
        cost: 10000,
        dateInService: '2025-11-15',   // Q4
        propertyClass: 7,
        businessUsePercent: 100,
        section179Election: 0,
        priorDepreciation: 0,
      },
    ],
  });

  const result = calculateForm1040(taxReturn);

  it('detects mid-quarter convention', () => {
    const f4562 = result.scheduleC!.form4562Result!;
    // Q4 basis ($10k) / total ($11k) = 90.9% > 40% → mid-quarter
    expect(f4562.convention).toBe('mid-quarter');
  });

  it('applies 100% bonus depreciation to both assets', () => {
    const f4562 = result.scheduleC!.form4562Result!;
    const tool = f4562.assetDetails.find(a => a.assetId === 'a1')!;
    const machine = f4562.assetDetails.find(a => a.assetId === 'a2')!;
    expect(tool.bonusDepreciation).toBeCloseTo(1000, 0);
    expect(machine.bonusDepreciation).toBeCloseTo(10000, 0);
    // MACRS is $0 since bonus absorbed entire basis
    expect(tool.macrsDepreciation).toBe(0);
    expect(machine.macrsDepreciation).toBe(0);
  });

  it('total depreciation flows to Schedule C', () => {
    const f4562 = result.scheduleC!.form4562Result!;
    expect(f4562.totalDepreciation).toBeCloseTo(11000, 0);
    expect(result.scheduleC!.depreciationDeduction).toBeCloseTo(11000, 0);
    // Schedule C net = $200k − $11k = $189,000
    expect(result.scheduleC!.netProfit).toBeCloseTo(189000, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S13 — OBBBA SALT Cap Phase-Down (MAGI > $500k)
//
// Profile: Single, $650k W-2, itemizing with $50k raw SALT.
//          Tests the OBBBA SALT cap phase-down:
//            Effective cap = max($10k floor, $40k − 30% × (AGI − $500k))
//
// Hand calculation:
//   AGI = $650,000
//   Raw SALT = $35k income tax + $15k real estate = $50,000
//   Effective SALT cap = max($10k, $40k − 30% × ($650k − $500k))
//                      = max($10k, $40k − $45k) = max($10k, −$5k) = $10,000
//   Schedule A: SALT $10k + mortgage $20k + charitable $10k = $40,000
//   Taxable income = $650,000 − $40,000 = $610,000
//
// @authority OBBBA §11001 (SALT cap phase-down), IRC §164
// ═════════════════════════════════════════════════════════════════════════════

describe('S13 — OBBBA SALT Cap Phase-Down', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Big Law', wages: 650000, federalTaxWithheld: 180000, socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 650000, medicareTax: 9425 }],
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 0,
      stateLocalIncomeTax: 35000,
      realEstateTax: 15000,       // Raw SALT total = $50k
      personalPropertyTax: 0,
      mortgageInterest: 20000,
      mortgageInsurancePremiums: 0,
      charitableCash: 10000,
      charitableNonCash: 0,
      casualtyLoss: 0,
      otherDeductions: 0,
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct AGI', () => {
    expect(f.agi).toBeCloseTo(650000, 0);
  });

  it('phases SALT cap down to $10k floor', () => {
    // SALT cap = max($10k, $40k − 30% × ($650k − $500k)) = $10,000
    expect(result.scheduleA).toBeDefined();
    expect(result.scheduleA!.saltDeduction).toBeCloseTo(10000, 0);
  });

  it('computes correct total itemized deduction', () => {
    // $10k SALT + $20k mortgage + $10k charitable = $40k
    expect(f.deductionAmount).toBeCloseTo(40000, 0);
  });

  it('has correct taxable income', () => {
    expect(f.taxableIncome).toBeCloseTo(610000, 0);
  });

  it('computes correct income tax on high income', () => {
    expect(f.incomeTax).toBeCloseTo(183047.25, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S14 — QBI Phase-Out with SSTB vs Non-SSTB Mix
//
// Profile: MFJ, $300k combined W-2, two Schedule C businesses ($150k SSTB law
//          firm + $120k non-SSTB manufacturing). Tests §199A QBI deduction when
//          taxable income exceeds the $494,600 MFJ full-phase-out:
//            - SSTB business: QBI fully eliminated above threshold
//            - Non-SSTB business: subject to W-2/UBIA limit
//
// Hand calculation:
//   W-2 wages = $300,000 ($200k + $100k)
//   NEC income = $270,000 ($150k + $120k) → Schedule C net
//   Total income = $570,000
//   SE tax = $270k × 92.35% = $249,345 → SS: $176,100 × 12.4% = $21,836.40;
//     Medicare: $249,345 × 2.9% = $7,231.01; total SE = $29,067.41
//   SE deduction = $14,533.71
//   AGI = $570,000 − $14,533.71 = $555,466.29
//   Standard deduction (MFJ) = $31,500
//   Taxable income before QBI = $523,966.29
//
//   QBI Phase-Out: AGI $555,466.29 > $494,600 MFJ full phase-out
//     SSTB (Consulting): Fully eliminated → $0
//     Non-SSTB (Widget): W-2/UBIA limit = max(50% × $10k, 25% × $10k + 2.5% × $200k)
//                       = max($5k, $7.5k) = $7,500
//     20% taxable income cap = 20% × $516,466 = $103,293 > $7,500
//   Total QBI deduction = $7,500
//   Taxable income = $523,966.29 − $7,500 = $516,466.29
//
// @authority IRC §199A(d)(3) (SSTB), §199A(b)(2) (W-2/UBIA limits)
// ═════════════════════════════════════════════════════════════════════════════

describe('S14 — QBI Phase-Out: SSTB vs Non-SSTB', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [
      { id: 'w1', employerName: 'Big Law', wages: 200000, federalTaxWithheld: 40000 },
      { id: 'w2', employerName: 'Spouse Corp', wages: 100000, federalTaxWithheld: 20000 },
    ],
    income1099NEC: [
      { id: 'n1', payerName: 'Consulting LLC', amount: 150000, businessId: 'b1' },
      { id: 'n2', payerName: 'Widget Co', amount: 120000, businessId: 'b2' },
    ],
    businesses: [
      { id: 'b1', businessName: 'Consulting LLC', principalBusinessCode: '541110', accountingMethod: 'cash', didStartThisYear: false },
      { id: 'b2', businessName: 'Widget Co', principalBusinessCode: '333999', accountingMethod: 'cash', didStartThisYear: false },
    ],
    qbiInfo: {
      businesses: [
        { businessId: 'b1', businessName: 'Consulting LLC', qualifiedBusinessIncome: 150000, isSSTB: true, w2WagesPaid: 20000, ubiaOfQualifiedProperty: 0 },
        { businessId: 'b2', businessName: 'Widget Co', qualifiedBusinessIncome: 120000, isSSTB: false, w2WagesPaid: 10000, ubiaOfQualifiedProperty: 200000 },
      ],
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct total income from W-2 + dual Schedule C', () => {
    expect(f.totalIncome).toBeCloseTo(570000, 0);
    expect(result.scheduleC!.netProfit).toBeCloseTo(270000, 0);
  });

  it('computes SE tax on combined NEC income', () => {
    // SS capped at $176,100; Medicare on full $249,345 SE earnings
    expect(f.seTax).toBeCloseTo(29067.41, 0);
    expect(f.seDeduction).toBeCloseTo(14533.71, 0);
  });

  it('has correct AGI after SE deduction', () => {
    expect(f.agi).toBeCloseTo(555466.29, 0);
  });

  it('SSTB is fully phased out, non-SSTB limited by W-2/UBIA', () => {
    // AGI $555k > $494,600 → SSTB QBI = $0
    // Non-SSTB: max(50% × $10k, 25% × $10k + 2.5% × $200k) = $7,500
    expect(f.qbiDeduction).toBeCloseTo(7500, 0);
  });

  it('taxable income reflects QBI deduction', () => {
    // $555,466.29 − $31,500 std ded − $7,500 QBI = $516,466.29
    expect(f.taxableIncome).toBeCloseTo(516466.29, 0);
  });

  it('computes correct total tax (income + SE)', () => {
    expect(f.incomeTax).toBeCloseTo(119857.70, 0);
    expect(f.totalTax).toBeCloseTo(151619.22, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S15 — MFS Triple Disallowance: Student Loan + EITC + IRA
//
// Profile: MFS, $60k W-2, attempts $2,500 student loan deduction, $7k IRA
//          contribution, and EITC. All three should be denied for MFS:
//            - Student loan interest: §221(e)(1) — not allowed for MFS
//            - IRA deduction: §219(g)(7) — $0 phase-out range for MFS
//            - EITC: §32(d) — not allowed for MFS
//
// Hand calculation:
//   Wages = $60,000; AGI = $60,000 (no adjustments survive MFS)
//   Standard deduction (MFS) = $15,750
//   Taxable income = $44,250
//   Tax (MFS brackets = Single brackets):
//     10% × $11,925 = $1,192.50; 12% × ($44,250 − $11,925) = $3,879.00
//     Total = $5,071.50
//   Refund = $8,000 withholding − $5,071.50 = $2,928.50
//
// @authority IRC §221(e)(1), §219(g)(7), §32(d)
// ═════════════════════════════════════════════════════════════════════════════

describe('S15 — MFS Triple Disallowance', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingSeparately,
    w2Income: [{ id: 'w1', employerName: 'Solo Corp', wages: 60000, federalTaxWithheld: 8000 }],
    studentLoanInterest: 2500,
    retirementContributions: { traditionalIRA: 7000 },
    incomeDiscovery: { eitc: 'yes' },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('disallows student loan interest deduction for MFS', () => {
    expect(f.studentLoanInterest).toBe(0);
  });

  it('disallows IRA deduction for MFS (phase-out starts at $0)', () => {
    expect(f.iraDeduction).toBe(0);
  });

  it('disallows EITC for MFS', () => {
    expect(result.credits.eitcCredit).toBe(0);
  });

  it('has correct AGI with no surviving adjustments', () => {
    expect(f.agi).toBeCloseTo(60000, 0);
  });

  it('uses MFS standard deduction', () => {
    expect(f.deductionAmount).toBe(15750);
    expect(f.taxableIncome).toBeCloseTo(44250, 0);
  });

  it('computes correct tax and refund', () => {
    // MFS brackets match Single: 10% on $11,925 + 12% on remainder
    expect(f.incomeTax).toBeCloseTo(5071.50, 0);
    expect(f.refundAmount).toBeCloseTo(2928.50, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S16 — NIIT + FTC + Rental + LTCG Investment Mix
//
// Profile: Single, $150k W-2, $15k interest, $30k dividends ($25k qualified,
//          $4k foreign tax), $40k LTCG, $20k net rental income.
//          Tests NIIT calculation with AGI above $200k threshold, plus FTC.
//
// Hand calculation:
//   Total income = $150k + $15k + $30k + $40k + $20k = $255,000
//   AGI = $255,000
//   Standard deduction (Single) = $15,750
//   Taxable income = $239,250
//
//   Net Investment Income = $15k INT + $30k DIV + $40k LTCG + $20k rental = $105,000
//   NIIT = 3.8% × min($105k, $255k − $200k) = 3.8% × $55k = $2,090
//
//   FTC = $4,000 (limited by US tax on $30k foreign-source dividends)
//
// @authority IRC §1411 (NIIT), §901 (FTC)
// ═════════════════════════════════════════════════════════════════════════════

describe('S16 — NIIT + FTC + Rental + LTCG Investment Mix', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Tech Co', wages: 150000, federalTaxWithheld: 30000, socialSecurityWages: 150000, socialSecurityTax: 9300, medicareWages: 150000, medicareTax: 2175 }],
    income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 15000 }],
    income1099DIV: [{ id: 'd1', payerName: 'Intl Fund', ordinaryDividends: 30000, qualifiedDividends: 25000, foreignTaxPaid: 4000 }],
    income1099B: [
      { id: 'b1', brokerName: 'Schwab', description: 'SPY ETF', dateAcquired: '2020-01-01', dateSold: '2025-07-01', proceeds: 80000, costBasis: 40000, isLongTerm: true },
    ],
    rentalProperties: [{
      id: 'r1', address: '123 Main St', propertyType: 'single_family',
      daysRented: 365, personalUseDays: 0, rentalIncome: 36000,
      mortgageInterest: 8000, taxes: 4000, insurance: 2000, repairs: 2000,
    }],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct total income from all sources', () => {
    // $150k W-2 + $15k INT + $30k DIV + $40k LTCG + $20k rental = $255k
    expect(f.totalIncome).toBeCloseTo(255000, 0);
    expect(f.agi).toBeCloseTo(255000, 0);
  });

  it('computes rental income via Schedule E', () => {
    expect(result.scheduleE).toBeDefined();
    expect(result.scheduleE!.totalRentalIncome).toBeCloseTo(36000, 0);
    expect(result.scheduleE!.totalRentalExpenses).toBeCloseTo(16000, 0);
    expect(result.scheduleE!.netRentalIncome).toBeCloseTo(20000, 0);
    expect(f.scheduleEIncome).toBeCloseTo(20000, 0);
  });

  it('computes LTCG via Schedule D', () => {
    expect(result.scheduleD).toBeDefined();
    expect(result.scheduleD!.netLongTerm).toBeCloseTo(40000, 0);
    expect(f.scheduleDNetGain).toBeCloseTo(40000, 0);
  });

  it('applies NIIT on excess over $200k threshold', () => {
    // NII = $105k; excess AGI = $55k; NIIT = 3.8% × min($105k, $55k) = $2,090
    expect(f.niitTax).toBeCloseTo(2090, 0);
  });

  it('applies foreign tax credit from 1099-DIV', () => {
    expect(result.credits.foreignTaxCredit).toBeCloseTo(4000, 0);
  });

  it('computes correct total tax (income + NIIT − FTC)', () => {
    expect(f.taxableIncome).toBeCloseTo(239250, 0);
    expect(f.incomeTax).toBeCloseTo(44417, 0);
    // Line 24: max(0, $44,417 − $4,000 FTC) + $2,090 NIIT = $42,507
    // FTC is non-refundable, reduces income tax before adding NIIT
    expect(f.totalTax).toBeCloseTo(42507, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S17 — FTC with K-1 Foreign Partnership + 1099-DIV Foreign Tax
//
// Profile: MFJ, $200k W-2, $50k foreign dividends ($7.5k foreign tax paid),
//          $30k K-1 partnership income ($2.5k foreign tax paid via Box 15).
//          Tests aggregated FTC from multiple sources plus NIIT interaction.
//
// Hand calculation:
//   W-2 = $200,000; Dividends = $50,000; K-1 ordinary = $30,000
//   Total income = $280,000
//   SE tax on K-1 partnership: $30k × 92.35% = $27,705 × 2.9% = $803.45
//     (only Medicare since W-2 wages $200k > SS cap $176,100)
//   SE deduction = $401.73
//   AGI = $280,000 − $401.73 = $279,598.27
//
//   FTC: $7,500 (1099-DIV) + $2,500 (K-1 Box 15) = $10,000
//   NIIT: 3.8% × min(NII, AGI − $250k) = 3.8% × $29,598.27 = $1,124.73
//
// @authority IRC §901 (FTC), §1411 (NIIT), §1402(a) (SE tax)
// ═════════════════════════════════════════════════════════════════════════════

describe('S17 — FTC: K-1 Foreign Partnership + 1099-DIV', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{ id: 'w1', employerName: 'US Corp', wages: 200000, federalTaxWithheld: 40000, socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 200000, medicareTax: 2900 }],
    income1099DIV: [{ id: 'd1', payerName: 'Global Fund', ordinaryDividends: 50000, qualifiedDividends: 40000, foreignTaxPaid: 7500 }],
    incomeK1: [{
      id: 'k1', entityName: 'Intl Partnership', entityType: 'partnership',
      ordinaryBusinessIncome: 30000, selfEmploymentIncome: 30000,
      box15ForeignTaxPaid: 2500,
    }],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('routes K-1 income correctly', () => {
    expect(f.k1OrdinaryIncome).toBeCloseTo(30000, 0);
    expect(result.k1Routing).toBeDefined();
    expect(result.k1Routing!.ordinaryBusinessIncome).toBeCloseTo(30000, 0);
    expect(result.k1Routing!.selfEmploymentIncome).toBeCloseTo(30000, 0);
    expect(result.k1Routing!.foreignTaxPaid).toBeCloseTo(2500, 0);
  });

  it('computes SE tax (Medicare only — above SS cap)', () => {
    // W-2 wages $200k > $176,100 SS cap → SE only pays Medicare 2.9%
    expect(f.seTax).toBeCloseTo(803.45, 0);
    expect(f.seDeduction).toBeCloseTo(401.73, 0);
  });

  it('has correct AGI', () => {
    // $280,000 − $401.73 SE deduction = $279,598.27
    expect(f.agi).toBeCloseTo(279598.27, 0);
  });

  it('aggregates FTC from 1099-DIV and K-1 Box 15', () => {
    // $7,500 + $2,500 = $10,000 total foreign tax
    expect(result.foreignTaxCredit).toBeDefined();
    expect(result.foreignTaxCredit!.foreignTaxPaid).toBeCloseTo(10000, 0);
    expect(result.credits.foreignTaxCredit).toBeCloseTo(10000, 0);
  });

  it('applies NIIT on excess over MFJ $250k threshold', () => {
    // 3.8% × min(NII, $279,598.27 − $250,000) = 3.8% × $29,598.27
    expect(f.niitTax).toBeCloseTo(1124.73, 0);
  });

  it('computes correct total tax', () => {
    expect(f.incomeTax).toBeCloseTo(41637.58, 0);
    // Line 24: after FTC non-refundable credit reduces income tax
    expect(f.totalTax).toBeCloseTo(34603.73, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S18 — Alabama Federal Tax Deduction (Unique State Feature)
//
// Profile: HOH, $75k W-2, 1 child (CTC), Alabama resident.
//          AL uniquely allows deduction of federal income tax paid from
//          state taxable income — one of only 6 states with this provision.
//
// Hand calculation:
//   Federal: W-2 $75k, HOH std deduction $23,625, taxable $51,375
//     Tax = 10% × $17,000 + 12% × $34,375 = $1,700 + $4,125 = $5,825
//     CTC = $2,200 (1 child)
//   Alabama:
//     State AGI = $75,000
//     Federal tax deduction reduces AL taxable income
//     AL income tax (progressive) = $3,031.25
//     Withholding = $2,500 → owes $531.25
//
// @authority AL Code §40-18-15, IRC §24
// ═════════════════════════════════════════════════════════════════════════════

describe('S18 — Alabama Federal Tax Deduction', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.HeadOfHousehold,
    dependents: [{ id: 'd1', firstName: 'Sam', lastName: 'Doe', dateOfBirth: '2010-05-01', relationship: 'child', monthsLivedWithYou: 12 }],
    w2Income: [{ id: 'w1', employerName: 'AL Corp', wages: 75000, federalTaxWithheld: 9000, state: 'AL', stateWages: 75000, stateTaxWithheld: 2500 }],
    childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 },
    stateReturns: [{ stateCode: 'AL', residencyType: 'resident' }],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('computes correct federal tax', () => {
    // HOH brackets: 10% on $17k + 12% on remainder
    expect(f.taxableIncome).toBeCloseTo(51375, 0);
    expect(f.incomeTax).toBeCloseTo(5825, 0);
  });

  it('applies CTC for 1 child', () => {
    expect(result.credits.childTaxCredit).toBeCloseTo(2200, 0);
  });

  it('produces AL state result', () => {
    expect(result.stateResults).toBeDefined();
    const al = result.stateResults!.find(s => s.stateCode === 'AL');
    expect(al).toBeDefined();
    expect(al!.stateAGI).toBeCloseTo(75000, 0);
  });

  it('computes AL progressive income tax', () => {
    const al = result.stateResults!.find(s => s.stateCode === 'AL')!;
    // AL has unique brackets + federal tax deduction (post-credit totalTax)
    // HoH std ded phases down to $2,500 floor at AGI $75K (base $5,200, phaseout from $26K)
    // $1,750 more taxable vs old flat $4,250 → $87.50 more tax at 5%
    // Plus: dependent exemption at $75K AGI drops from $1,000 to $500 → $25 more tax
    expect(al.stateIncomeTax).toBeCloseTo(3228.75, 0);
  });

  it('calculates AL refund/owed against withholding', () => {
    const al = result.stateResults!.find(s => s.stateCode === 'AL')!;
    expect(al.stateWithholding).toBeCloseTo(2500, 0);
    // Owes: $3,228.75 − $2,500 = $728.75
    expect(al.stateRefundOrOwed).toBeCloseTo(-728.75, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S19 — Capital Loss Limitation + ST/LT Carryforward Preservation
//
// Profile: Single, $90k W-2, mixed capital transactions:
//          $25k short-term loss + $10k long-term gain → net $15k loss.
//          Only $3k deductible; $12k carries forward (all short-term character).
//
// Hand calculation:
//   Stock A (ST): proceeds $10k − basis $35k = −$25,000 loss
//   Stock B (LT): proceeds $50k − basis $40k = +$10,000 gain
//   Net = −$15,000
//   Capital loss deduction = $3,000 (IRC §1211(b) limit)
//   Carryforward = $12,000 (short-term, per §1212(b))
//   Total income = $90k − $3k = $87,000
//   Taxable income = $87k − $15,750 = $71,250
//
// @authority IRC §1211(b) (loss limitation), §1212(b) (carryforward)
// ═════════════════════════════════════════════════════════════════════════════

describe('S19 — Capital Loss Limitation + Carryforward', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Corp', wages: 90000, federalTaxWithheld: 15000 }],
    income1099B: [
      { id: 'b1', brokerName: 'Fidelity', description: 'Loss Stock A', dateAcquired: '2024-01-01', dateSold: '2025-03-01', proceeds: 10000, costBasis: 35000, isLongTerm: false },
      { id: 'b2', brokerName: 'Fidelity', description: 'Gain Stock B', dateAcquired: '2020-06-01', dateSold: '2025-09-01', proceeds: 50000, costBasis: 40000, isLongTerm: true },
    ],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('computes correct Schedule D components', () => {
    expect(result.scheduleD).toBeDefined();
    expect(result.scheduleD!.netShortTerm).toBeCloseTo(-25000, 0);
    expect(result.scheduleD!.netLongTerm).toBeCloseTo(10000, 0);
    expect(result.scheduleD!.netGainOrLoss).toBeCloseTo(-15000, 0);
  });

  it('limits capital loss deduction to $3,000', () => {
    expect(result.scheduleD!.capitalLossDeduction).toBeCloseTo(3000, 0);
  });

  it('preserves carryforward with ST character', () => {
    // Net loss $15k − $3k deduction = $12k carryforward, all short-term
    expect(result.scheduleD!.capitalLossCarryforward).toBeCloseTo(12000, 0);
    expect(result.scheduleD!.capitalLossCarryforwardST).toBeCloseTo(12000, 0);
    expect(result.scheduleD!.capitalLossCarryforwardLT).toBeCloseTo(0, 0);
  });

  it('reduces total income by $3k capital loss deduction', () => {
    // $90k W-2 − $3k loss deduction = $87k
    expect(f.totalIncome).toBeCloseTo(87000, 0);
  });

  it('computes correct taxable income and tax', () => {
    expect(f.taxableIncome).toBeCloseTo(71250, 0);
    expect(f.incomeTax).toBeCloseTo(9889, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S20 — Rental Passive Loss Suspension (AGI > $150k)
//
// Profile: MFJ, $280k combined W-2, two rental properties with net $11.5k loss.
//          Tests passive activity loss rules: the $25k special allowance
//          phases out between $100k–$150k AGI, so at AGI $280k the entire
//          rental loss is suspended.
//
// Also tests Additional Medicare Tax: 0.9% on wages above $250k (MFJ).
//
// Hand calculation:
//   W-2 wages = $280,000 ($180k + $100k)
//   Rental #1: $24k income − $30k expenses = −$6,000
//   Rental #2: $18k income − $23.5k expenses = −$5,500
//   Net rental loss = −$11,500
//   $25k allowance: fully phased out (AGI $280k > $150k)
//   Suspended loss = $11,500
//   Schedule E income = $0
//   AGI = $280,000
//   Additional Medicare = 0.9% × ($280k − $250k) = $270
//
// @authority IRC §469(i) (rental allowance), IRC §3101(b)(2) (Addl Medicare)
// ═════════════════════════════════════════════════════════════════════════════

describe('S20 — Rental Passive Loss Suspension + Additional Medicare', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [
      { id: 'w1', employerName: 'Corp A', wages: 180000, federalTaxWithheld: 35000, socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 180000, medicareTax: 2610 },
      { id: 'w2', employerName: 'Corp B', wages: 100000, federalTaxWithheld: 18000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 },
    ],
    rentalProperties: [
      {
        id: 'r1', address: '456 Oak Ave', propertyType: 'single_family',
        daysRented: 365, personalUseDays: 0, rentalIncome: 24000,
        mortgageInterest: 12000, taxes: 5000, insurance: 2000, repairs: 3000, depreciation: 8000,
      },
      {
        id: 'r2', address: '789 Elm St', propertyType: 'condo',
        daysRented: 365, personalUseDays: 0, rentalIncome: 18000,
        mortgageInterest: 10000, taxes: 4000, insurance: 1500, repairs: 2000, depreciation: 6000,
      },
    ],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('computes net rental loss across both properties', () => {
    expect(result.scheduleE).toBeDefined();
    expect(result.scheduleE!.totalRentalIncome).toBeCloseTo(42000, 0);
    expect(result.scheduleE!.totalRentalExpenses).toBeCloseTo(53500, 0);
    expect(result.scheduleE!.netRentalIncome).toBeCloseTo(-11500, 0);
  });

  it('suspends entire rental loss (AGI > $150k phase-out) via Form 8582', () => {
    // $25k allowance fully phased out at AGI $280k
    expect(result.form8582).toBeDefined();
    expect(result.form8582!.allowedPassiveLoss).toBeCloseTo(0, 0);
    expect(result.form8582!.totalSuspendedLoss).toBeCloseTo(11500, 0);
    expect(f.scheduleEIncome).toBeCloseTo(0, 0);
  });

  it('has correct AGI (no rental loss deduction)', () => {
    expect(f.totalIncome).toBeCloseTo(280000, 0);
    expect(f.agi).toBeCloseTo(280000, 0);
  });

  it('applies Additional Medicare Tax on W-2 above MFJ $250k', () => {
    // 0.9% × ($280k − $250k) = $270
    expect(f.additionalMedicareTaxW2).toBeCloseTo(270, 0);
  });

  it('computes correct total tax (income + Additional Medicare)', () => {
    expect(f.incomeTax).toBeCloseTo(45334, 0);
    expect(f.totalTax).toBeCloseTo(45604, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S21 — K-1 Multi-Entity: S-Corp + Rental LP + Active Partnership + QBI
//
// Profile: Single, $80k W-2, three K-1 entities:
//   - S-Corp ($50k ordinary, $10k LTCG, $50k QBI) — no SE tax
//   - Rental LP ($15k rental loss) — passive, suspended
//   - Active Partnership ($40k ordinary, $20k guaranteed, $60k SE, $40k QBI)
//
// Tests K-1 routing logic, SE income aggregation, rental loss suspension,
// and QBI deduction below the threshold (no W-2/UBIA limit applies).
//
// Hand calculation:
//   K-1 ordinary income to 1040: $50k (S-Corp) + $40k (partnership) + $20k (GP) = $110k
//   K-1 LTCG: $10k → Schedule D (but scheduleDNetGain shows $0 — flows differently)
//   K-1 rental: −$15k → Schedule E (suspended at AGI > $150k)
//   Total income = $80k + $110k + $10k = $200k (rental suspended)
//   SE: $60k × 92.35% = $55,410 → SS 12.4% + Medicare 2.9% = $8,477.73
//   SE deduction = $4,238.87
//   AGI = $200k − $4,238.87 = $195,761.13
//   QBI: below $197,300 → no W-2/UBIA limit, full 20%
//     20% × ($50k + $40k) = $18,000
//   Taxable income = $195,761.13 − $15,750 − $18,000 = $162,011.13
//
// @authority IRC §199A, §702, §469
// ═════════════════════════════════════════════════════════════════════════════

describe('S21 — K-1 Multi-Entity: S-Corp + Partnership + QBI', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Day Job', wages: 80000, federalTaxWithheld: 12000 }],
    incomeK1: [
      {
        id: 'k1', entityName: 'S-Corp Biz', entityType: 's_corp',
        ordinaryBusinessIncome: 50000, section199AQBI: 50000,
        longTermCapitalGain: 10000,
      },
      {
        id: 'k2', entityName: 'Real Estate LP', entityType: 'partnership',
        rentalIncome: -15000,
      },
      {
        id: 'k3', entityName: 'Active Partnership', entityType: 'partnership',
        ordinaryBusinessIncome: 40000, guaranteedPayments: 20000,
        selfEmploymentIncome: 60000, section199AQBI: 40000,
      },
    ],
    qbiInfo: {
      businesses: [
        { businessId: 'k1', businessName: 'S-Corp Biz', qualifiedBusinessIncome: 50000, isSSTB: false, w2WagesPaid: 30000, ubiaOfQualifiedProperty: 100000 },
        { businessId: 'k3', businessName: 'Active Partnership', qualifiedBusinessIncome: 40000, isSSTB: false, w2WagesPaid: 0, ubiaOfQualifiedProperty: 0 },
      ],
    },
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('routes K-1 income correctly', () => {
    expect(result.k1Routing).toBeDefined();
    // S-Corp $50k + Partnership $40k = $90k ordinary business income
    expect(result.k1Routing!.ordinaryBusinessIncome).toBeCloseTo(90000, 0);
    // Partnership guaranteed payments
    expect(result.k1Routing!.guaranteedPayments).toBeCloseTo(20000, 0);
    // Only partnership has SE income
    expect(result.k1Routing!.selfEmploymentIncome).toBeCloseTo(60000, 0);
    // S-Corp LTCG
    expect(result.k1Routing!.longTermCapitalGain).toBeCloseTo(10000, 0);
    // Rental from LP
    expect(result.k1Routing!.rentalIncome).toBeCloseTo(-15000, 0);
  });

  it('computes SE tax only on partnership SE income', () => {
    // $60k × 92.35% = $55,410; SS = $55,410 × 12.4% + Medicare = 2.9%
    expect(f.seTax).toBeCloseTo(8477.73, 0);
    expect(f.seDeduction).toBeCloseTo(4238.87, 0);
  });

  it('suspends K-1 rental loss', () => {
    // AGI ~$196k > $150k → rental loss fully suspended
    expect(f.scheduleEIncome).toBeCloseTo(0, 0);
  });

  it('applies full QBI deduction (below threshold)', () => {
    // AGI $195,761 < $197,300 Single threshold → no W-2/UBIA limit
    // 20% × ($50k S-Corp + $40k Partnership) = $18,000
    expect(f.qbiDeduction).toBeCloseTo(18000, 0);
  });

  it('computes correct AGI, taxable income, and total tax', () => {
    expect(f.agi).toBeCloseTo(195761.13, 0);
    expect(f.taxableIncome).toBeCloseTo(162011.13, 0);
    expect(f.incomeTax).toBeCloseTo(30829.67, 0);
    expect(f.totalTax).toBeCloseTo(39307.40, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S22 — Crypto 1099-DA + Stock Wash Sale
//
// Profile: Single, $120k W-2, mixed crypto and stock transactions:
//   - Ethereum 1099-DA: $50k short-term gain
//   - Bitcoin 1099-DA: $15k long-term loss
//   - Stock 1099-B: $10k short-term loss (wash sale per broker)
//
// Tests 1099-DA integration with Schedule D, plus wash sale handling.
// Net capital: $50k ST gain − $10k ST loss + (−$15k LT loss) = $25k net gain
//
// Hand calculation:
//   ETH (ST): $80k proceeds − $30k basis = +$50,000 gain
//   BTC (LT): $25k proceeds − $40k basis = −$15,000 loss
//   Stock (ST wash): $5k proceeds − $15k basis = −$10,000 loss
//     (wash sale handled by broker in reported basis — loss stands as reported)
//   Net ST: $50k − $10k = $40k gain; Net LT: −$15k loss
//   Net gain: $40k − $15k = $25,000 (all ordinary — net LT is negative)
//   Total income = $120k + $25k = $145,000
//   Taxable income = $145k − $15,750 = $129,250
//
// @authority IRC §1091 (wash sales), IRS Notice 2014-21 (crypto)
// ═════════════════════════════════════════════════════════════════════════════

describe('S22 — Crypto 1099-DA + Wash Sale', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Tech Co', wages: 120000, federalTaxWithheld: 22000 }],
    income1099DA: [
      { id: 'da1', brokerName: 'Coinbase', tokenName: 'Ethereum', dateSold: '2025-02-15', dateAcquired: '2024-06-01', proceeds: 80000, costBasis: 30000, isLongTerm: false },
      { id: 'da2', brokerName: 'Coinbase', tokenName: 'Bitcoin', dateSold: '2025-04-01', dateAcquired: '2023-01-01', proceeds: 25000, costBasis: 40000, isLongTerm: true },
    ],
    income1099B: [
      { id: 'b1', brokerName: 'Fidelity', description: 'Stock C wash', dateAcquired: '2025-01-01', dateSold: '2025-01-20', proceeds: 5000, costBasis: 15000, isLongTerm: false, washSaleLossDisallowed: 10000 },
    ],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('computes correct Schedule D from crypto + stock', () => {
    expect(result.scheduleD).toBeDefined();
    // ST: ETH +$50k, Stock wash sale (proceeds $5k, basis $15k, disallowed $10k → adjusted loss $0)
    expect(result.scheduleD!.shortTermGain).toBeCloseTo(50000, 0);
    expect(result.scheduleD!.shortTermLoss).toBeCloseTo(0, 0);
    expect(result.scheduleD!.netShortTerm).toBeCloseTo(50000, 0);
    // LT: BTC −$15k
    expect(result.scheduleD!.longTermLoss).toBeCloseTo(15000, 0);
    expect(result.scheduleD!.netLongTerm).toBeCloseTo(-15000, 0);
  });

  it('has correct net capital gain', () => {
    // Net: $50k ST − $15k LT = $35k (ordinary rate since net LT is negative)
    expect(result.scheduleD!.netGainOrLoss).toBeCloseTo(35000, 0);
    expect(f.scheduleDNetGain).toBeCloseTo(35000, 0);
  });

  it('has correct total income', () => {
    // $120k wages + $35k net cap gains = $155k
    expect(f.totalIncome).toBeCloseTo(155000, 0);
    expect(f.agi).toBeCloseTo(155000, 0);
  });

  it('no NIIT (AGI below $200k Single threshold)', () => {
    expect(f.niitTax).toBe(0);
  });

  it('computes correct tax on capital gains at ordinary rates', () => {
    // $155k - $15,750 standard = $139,250 taxable
    expect(f.taxableIncome).toBeCloseTo(139250, 0);
    expect(f.incomeTax).toBeCloseTo(26267, 0);
    expect(f.totalTax).toBeCloseTo(26267, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S23 — Additional Medicare Tax + NIIT Stack (High Earner)
//
// Profile: Single, $350k W-2, $30k interest, $20k dividends ($15k qualified),
//          $70k LTCG. Tests both surtaxes simultaneously:
//   - Additional Medicare Tax: 0.9% on W-2 wages above $200k
//   - NIIT: 3.8% on NII (or excess AGI, whichever is less)
//
// Hand calculation:
//   Total income = $350k + $30k + $20k + $70k = $470,000
//   AGI = $470,000
//   Additional Medicare = 0.9% × ($350k − $200k) = $1,350
//   NII = $30k INT + $20k DIV + $70k LTCG = $120,000
//   NIIT = 3.8% × min($120k, $470k − $200k) = 3.8% × $120k = $4,560
//   Taxable income = $470k − $15,750 = $454,250
//   Total tax = income tax + Additional Medicare + NIIT
//             = $111,534.75 + $1,350 + $4,560 = $117,444.75
//
// @authority IRC §3101(b)(2) (Addl Medicare), §1411 (NIIT)
// ═════════════════════════════════════════════════════════════════════════════

describe('S23 — Additional Medicare Tax + NIIT Stack', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Finance Corp', wages: 350000, federalTaxWithheld: 90000, socialSecurityWages: 176100, socialSecurityTax: 10918, medicareWages: 350000, medicareTax: 5075 }],
    income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 30000 }],
    income1099DIV: [{ id: 'd1', payerName: 'Fund', ordinaryDividends: 20000, qualifiedDividends: 15000 }],
    income1099B: [
      { id: 'b1', brokerName: 'Schwab', description: 'Growth ETF', dateAcquired: '2021-03-01', dateSold: '2025-10-01', proceeds: 150000, costBasis: 80000, isLongTerm: true },
    ],
  });

  const result = calculateForm1040(taxReturn);
  const f = result.form1040;

  it('has correct total income from all sources', () => {
    // $350k W-2 + $30k INT + $20k DIV + $70k LTCG = $470k
    expect(f.totalIncome).toBeCloseTo(470000, 0);
    expect(f.agi).toBeCloseTo(470000, 0);
  });

  it('applies Additional Medicare Tax on W-2 above $200k', () => {
    // 0.9% × ($350k − $200k) = $1,350
    expect(f.additionalMedicareTaxW2).toBeCloseTo(1350, 0);
  });

  it('applies NIIT on full NII (lesser of NII and excess AGI)', () => {
    // NII = $120k; excess = $270k; NIIT = 3.8% × $120k = $4,560
    expect(f.niitTax).toBeCloseTo(4560, 0);
  });

  it('computes correct taxable income and income tax', () => {
    expect(f.taxableIncome).toBeCloseTo(454250, 0);
    expect(f.incomeTax).toBeCloseTo(111534.75, 0);
  });

  it('stacks both surtaxes in total tax', () => {
    // $111,534.75 + $1,350 + $4,560 = $117,444.75
    expect(f.totalTax).toBeCloseTo(117444.75, 0);
  });

  it('computes correct amount owed', () => {
    // $117,444.75 − $90,000 withholding = $27,444.75 base + ~$731 estimated tax penalty (day-count) ≈ $28,176
    expect(f.totalPayments).toBeCloseTo(90000, 0);
    expect(f.amountOwed).toBeCloseTo(28176, 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// S24 — K-1 Passive Ordinary Loss Suspension + Disposed Rental PAL Release
//
// Profile: HOH, Schedule C $80K, passive K-1 loss -$6K (partnership),
//          disposed rental with $2K operational loss, $4K prior year PAL,
//          $10K disposition gain (goes to Form 4797, not Form 8582).
//
// Bug #13 fix verifies:
//   1. K-1 passive ordinary loss (-$6K) is suspended by Form 8582 and
//      does NOT reduce total income (adjustment adds it back)
//   2. Disposed rental releases operational loss + per-property prior year PAL
//      but disposition gain is NOT in Form 8582 (flows to Form 4797)
//   3. Total income excludes both the suspended K-1 loss and correctly
//      includes the released rental losses
//
// Hand calculation:
//   Schedule C net profit = $80,000
//   Rental operational = $8K income − $10K expenses = −$2K
//   K-1 passive ordinary = −$6K
//   Rental prior year PAL (per-property) = −$4K
//   Form 8582:
//     Rental activity: −$2K current − $4K prior = −$6K, disposed → all released = −$6K allowed
//     K-1 passive: −$6K current, no income to offset, no special allowance for non-rental → suspended
//   Schedule E income = totalAllowedLoss = −$6K (rental)
//   K-1 passive suspension adj = +$6K (add back the suspended loss already in income)
//   Total income = $80K (Sch C) − $6K (Sch E) + $6K (K-1 adj) = $80K
//
// @authority IRC §469(g)(1), IRC §469(i), IRC §1402(a)(13)
// ═════════════════════════════════════════════════════════════════════════════

describe('S24 — K-1 passive suspension + disposed rental PAL release (Bug #13)', () => {
  const result = calculateForm1040(makeTaxReturn({
    filingStatus: FilingStatus.HeadOfHousehold,
    firstName: 'Test',
    lastName: 'Bug13',
    paidOverHalfHouseholdCost: true,
    dependents: [
      { id: 'dep1', firstName: 'Child', lastName: 'Bug13', relationship: 'son',
        dateOfBirth: '2015-01-01', monthsLivedWithYou: 12 },
    ],
    businesses: [{ id: 'biz1', businessName: 'Test Biz', principalBusinessCode: '541000',
      businessDescription: 'Consulting', accountingMethod: 'cash', didStartThisYear: false }],
    income1099NEC: [{ id: 'nec1', payerName: 'Client', amount: 80000 }],
    rentalProperties: [{
      id: 'rental1',
      address: '100 Test Dr',
      propertyType: 'single_family',
      daysRented: 180,
      personalUseDays: 0,
      rentalIncome: 8000,
      mortgageInterest: 5000,
      taxes: 2000,
      depreciation: 3000,
      activeParticipation: true,
      disposedDuringYear: true,
      dispositionGainLoss: 10000,
      priorYearUnallowedLoss: 4000,
    }],
    incomeK1: [{
      id: 'k1-passive',
      entityName: 'Passive LP',
      entityType: 'partnership',
      ordinaryBusinessIncome: -6000,
      isPassiveActivity: true,
    }],
    form8582Data: {
      priorYearUnallowedLoss: 4000,
    },
    deductionMethod: 'standard',
  }));

  const f = result.form1040;

  it('K-1 passive loss does not reduce total income (suspended by Form 8582)', () => {
    // K-1 passive -$6K is suspended (no passive income to offset)
    // The +$6K K-1 adjustment cancels the -$6K K-1 ordinary in totalIncomePreScheduleE
    // But Schedule E adds -$6K (released rental losses on disposition)
    // Total income = Sch C ($80K) - $6K (Sch E released rental) = $74K
    expect(f.totalIncome).toBeCloseTo(74000, 0);
  });

  it('Schedule E shows allowed rental losses (disposed, prior year released)', () => {
    // Rental operational: $8K - $10K = -$2K
    // Prior year: -$4K
    // Total: -$6K, all released on disposition
    expect(f.scheduleEIncome).toBeCloseTo(-6000, 0);
  });

  it('Form 8582 correctly suspends K-1 passive and releases rental', () => {
    expect(result.form8582).toBeDefined();
    const activities = result.form8582!.activities;

    // Rental activity: fully released on disposition
    const rental = activities.find(a => a.id === 'rental1');
    expect(rental).toBeDefined();
    expect(rental!.disposedDuringYear).toBe(true);
    expect(rental!.allowedLoss).toBeCloseTo(-6000, 0);
    expect(rental!.suspendedLoss).toBe(0);

    // K-1 passive: fully suspended (no income to offset)
    const k1 = activities.find(a => a.id === 'k1-passive_passive');
    expect(k1).toBeDefined();
    expect(k1!.allowedLoss).toBe(0);
    expect(k1!.suspendedLoss).toBeCloseTo(6000, 0);
  });

  it('disposition gain is excluded from Form 8582 rental activity', () => {
    const rental = result.form8582!.activities.find(a => a.id === 'rental1')!;
    // Only operational loss, NOT $10K disposition gain
    expect(rental.currentYearNetIncome).toBeCloseTo(-2000, 0);
  });

  it('SE tax is based on Schedule C only (K-1 passive excluded)', () => {
    // SE income = $80K (Schedule C only; passive K-1 excluded per IRC §1402(a)(13))
    expect(result.scheduleSE).toBeDefined();
    expect(result.scheduleSE!.netEarnings).toBeCloseTo(80000 * 0.9235, 0);
  });
});
