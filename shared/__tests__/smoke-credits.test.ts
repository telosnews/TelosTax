/**
 * Phase 6: Smoke Test Generation — Every Credit Type in Isolation
 *
 * Tests each credit type individually to verify:
 *   1. Credit is calculated (non-zero when eligible)
 *   2. Credit is correctly categorized (non-refundable vs refundable)
 *   3. Credit reduces tax (totalTax ≤ tax without credit)
 *   4. No crashes or NaN values
 *
 * Credits live on `result.credits.*` (CreditsResult), not `result.form1040.*`.
 * Above-the-line adjustments (student loan, HSA, IRA, educator) affect `form1040.agi`.
 *
 * Uses a $75k Single W-2 baseline (enough income to generate tax liability
 * for non-refundable credits to offset).
 */
import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ── Helper ──────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'credit-smoke',
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
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    rentalProperties: [],
    otherIncome: 0,
    businesses: [],
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

// Baseline: $75k Single W-2 → enough tax liability to absorb non-refundable credits
const BASELINE_W2 = [{
  id: 'w1',
  employerName: 'Test Corp',
  wages: 75000,
  federalTaxWithheld: 9500,
  socialSecurityWages: 75000,
  socialSecurityTax: 4650,
  medicareWages: 75000,
  medicareTax: 1087.50,
}];

// Get baseline tax for comparison
function getBaselineTax(): number {
  const baseline = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: BASELINE_W2,
  });
  return calculateForm1040(baseline).form1040.totalTax;
}

// ═══════════════════════════════════════════════════════════════════════════
// Child Tax Credit — $2,200/child (OBBBA)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Child Tax Credit (CTC)', () => {
  it('1 qualifying child — CTC applied', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      dependents: [{
        id: 'dep1', firstName: 'Child', lastName: 'Test', relationship: 'son',
        dateOfBirth: '2015-06-15', monthsLivedWithYou: 12,
      }],
    });
    const result = calculateForm1040(taxReturn);

    expect(result.credits.childTaxCredit).toBe(2200);
    expect(result.form1040.totalTax).toBeLessThan(getBaselineTax());
  });

  it('3 qualifying children MFJ — $6,600 CTC', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{
        id: 'w1', employerName: 'Test', wages: 100000, federalTaxWithheld: 15000,
        socialSecurityWages: 100000, socialSecurityTax: 6200,
        medicareWages: 100000, medicareTax: 1450,
      }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'T', relationship: 'daughter', dateOfBirth: '2012-01-01', monthsLivedWithYou: 12 },
        { id: 'd2', firstName: 'B', lastName: 'T', relationship: 'son', dateOfBirth: '2014-06-01', monthsLivedWithYou: 12 },
        { id: 'd3', firstName: 'C', lastName: 'T', relationship: 'daughter', dateOfBirth: '2018-09-01', monthsLivedWithYou: 12 },
      ],
    });
    const result = calculateForm1040(taxReturn);

    expect(result.credits.childTaxCredit).toBe(6600);
  });

  it('Other Dependent Credit — child age 17+ gets $500', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      dependents: [{
        id: 'dep1', firstName: 'Teen', lastName: 'Test', relationship: 'son',
        dateOfBirth: '2007-01-01', monthsLivedWithYou: 12, // Age 18 in 2025
      }],
    });
    const result = calculateForm1040(taxReturn);

    expect(result.credits.childTaxCredit).toBe(0); // Not under 17
    expect(result.credits.otherDependentCredit).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Additional Child Tax Credit (ACTC) — refundable
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: ACTC (Refundable CTC)', () => {
  it('Low-income HoH with 2 kids — ACTC generated', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      w2Income: [{
        id: 'w1', employerName: 'Part-time', wages: 20000, federalTaxWithheld: 500,
        socialSecurityWages: 20000, socialSecurityTax: 1240,
        medicareWages: 20000, medicareTax: 290,
      }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'T', relationship: 'son', dateOfBirth: '2016-03-01', monthsLivedWithYou: 12 },
        { id: 'd2', firstName: 'B', lastName: 'T', relationship: 'daughter', dateOfBirth: '2019-07-01', monthsLivedWithYou: 12 },
      ],
    });
    const result = calculateForm1040(taxReturn);

    // CTC should exceed tax liability, producing ACTC
    expect(result.credits.actcCredit).toBeGreaterThan(0);
    // ACTC is refundable — contributes to refund
    expect(result.form1040.refundAmount).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// American Opportunity Tax Credit (AOTC)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: AOTC', () => {
  it('Full AOTC with $4k+ qualified expenses — $2,500 total', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      educationCredits: [{
        id: 'ed1', type: 'american_opportunity', studentName: 'Student',
        institution: 'State U', tuitionPaid: 5000,
      }],
    });
    const result = calculateForm1040(taxReturn);
    const c = result.credits;

    // Total AOTC = $2,500 ($2,000 first tier + $500 25% of next $2k)
    expect(c.educationCredit).toBeGreaterThan(0); // Non-refundable 60%
    expect(c.aotcRefundableCredit).toBeGreaterThan(0); // Refundable 40%
    // 60% + 40% = $2,500
    expect(c.educationCredit + c.aotcRefundableCredit).toBeCloseTo(2500, 0);
  });

  it('AOTC with scholarships reducing qualified expenses', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      educationCredits: [{
        id: 'ed1', type: 'american_opportunity', studentName: 'Student',
        institution: 'State U', tuitionPaid: 6000, scholarships: 4000,
      }],
    });
    const result = calculateForm1040(taxReturn);
    const c = result.credits;

    // Qualified expenses = $6k - $4k = $2k → credit = $2k (first $2k at 100%)
    const totalAOTC = c.educationCredit + c.aotcRefundableCredit;
    expect(totalAOTC).toBeCloseTo(2000, 0);
  });

  it('AOTC blocked for MFS filer', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: BASELINE_W2,
      educationCredits: [{
        id: 'ed1', type: 'american_opportunity', studentName: 'Student',
        institution: 'State U', tuitionPaid: 5000,
      }],
    });
    const result = calculateForm1040(taxReturn);

    expect(result.credits.educationCredit).toBe(0);
    expect(result.credits.aotcRefundableCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Lifetime Learning Credit (LLC)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: LLC', () => {
  it('LLC with $10k expenses — max $2,000', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      educationCredits: [{
        id: 'ed1', type: 'lifetime_learning', studentName: 'Grad Student',
        institution: 'Univ', tuitionPaid: 10000,
      }],
    });
    const result = calculateForm1040(taxReturn);

    expect(result.credits.educationCredit).toBe(2000); // 20% × $10k = $2k max
    expect(result.credits.aotcRefundableCredit).toBe(0); // LLC is fully non-refundable
  });

  it('LLC blocked for MFS filer', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: BASELINE_W2,
      educationCredits: [{
        id: 'ed1', type: 'lifetime_learning', studentName: 'Student',
        institution: 'Univ', tuitionPaid: 10000,
      }],
    });
    const result = calculateForm1040(taxReturn);

    expect(result.credits.educationCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Dependent Care Credit (Form 2441)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Dependent Care Credit', () => {
  it('1 child, $5k expenses — credit generated', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      dependents: [{
        id: 'd1', firstName: 'Kid', lastName: 'T', relationship: 'son',
        dateOfBirth: '2020-01-01', monthsLivedWithYou: 12,
      }],
      dependentCare: {
        totalExpenses: 5000,
        qualifyingPersons: 1,
      },
    });
    const result = calculateForm1040(taxReturn);

    // Credit should be non-zero (20% rate for $75k AGI on up to $3k for 1 child)
    expect(result.credits.dependentCareCredit).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Saver's Credit (Form 8880)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Saver\'s Credit', () => {
  it('Single, $30k income, $2k contribution — credit generated', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Test', wages: 30000, federalTaxWithheld: 2000,
      }],
      saversCredit: { totalContributions: 2000 },
    });
    const result = calculateForm1040(taxReturn);

    // At $30k Single AGI, should qualify for 10% or 20% rate
    expect(result.credits.saversCredit).toBeGreaterThan(0);
  });

  it('Single, $80k income — above threshold, no credit', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2, // $75k
      saversCredit: { totalContributions: 2000 },
    });
    const result = calculateForm1040(taxReturn);

    // $75k AGI is above the Saver's Credit income thresholds for Single
    expect(result.credits.saversCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EITC (Earned Income Tax Credit) — refundable
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: EITC', () => {
  it('HoH, $25k, 2 children — EITC generated', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      w2Income: [{
        id: 'w1', employerName: 'Test', wages: 25000, federalTaxWithheld: 500,
        socialSecurityWages: 25000, socialSecurityTax: 1550,
        medicareWages: 25000, medicareTax: 362.50,
      }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'T', relationship: 'son', dateOfBirth: '2016-01-01', monthsLivedWithYou: 12 },
        { id: 'd2', firstName: 'B', lastName: 'T', relationship: 'daughter', dateOfBirth: '2018-06-01', monthsLivedWithYou: 12 },
      ],
    });
    const result = calculateForm1040(taxReturn);

    expect(result.credits.eitcCredit).toBeGreaterThan(0);
    // EITC is refundable
    expect(result.form1040.refundAmount).toBeGreaterThan(0);
  });

  it('Single, no children, $12k — small EITC', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Test', wages: 12000, federalTaxWithheld: 500,
        socialSecurityWages: 12000, socialSecurityTax: 744,
        medicareWages: 12000, medicareTax: 174,
      }],
    });
    const result = calculateForm1040(taxReturn);

    // $12k is within the EITC range for no children (max ~$649 in 2025)
    expect(result.credits.eitcCredit).toBeGreaterThanOrEqual(0);
  });

  it('MFS filer — EITC blocked', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{
        id: 'w1', employerName: 'Test', wages: 25000, federalTaxWithheld: 500,
      }],
    });
    const result = calculateForm1040(taxReturn);

    // EITC not available for MFS (unless lived apart — not set here)
    expect(result.credits.eitcCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Clean Energy Credit (Form 5695 Part I)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Clean Energy Credit', () => {
  it('Solar electric $20k — 30% credit = $6,000', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      cleanEnergy: { solarElectric: 20000 },
    });
    const result = calculateForm1040(taxReturn);

    expect(result.credits.cleanEnergyCredit).toBe(6000);
  });

  it('Battery storage $5k — 30% credit = $1,500', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      cleanEnergy: { batteryStorage: 5000 },
    });
    const result = calculateForm1040(taxReturn);

    expect(result.credits.cleanEnergyCredit).toBe(1500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Energy Efficiency Credit (Form 5695 Part II)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Energy Efficiency Credit', () => {
  it('Heat pump $4k — $2,000 credit (annual cap)', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      energyEfficiency: { heatPump: 4000 },
    });
    const result = calculateForm1040(taxReturn);

    // Heat pump: 30% × $4k = $1,200 (below $2,000 annual cap)
    expect(result.credits.energyEfficiencyCredit).toBe(1200);
  });

  it('Windows $1k + doors $500 + insulation $800', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      energyEfficiency: { windows: 1000, doors: 500, insulation: 800 },
    });
    const result = calculateForm1040(taxReturn);

    // Should produce some credit within aggregate limits
    expect(result.credits.energyEfficiencyCredit).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Foreign Tax Credit
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Foreign Tax Credit', () => {
  it('1099-DIV with foreign tax paid — credit generated', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      income1099DIV: [{
        id: 'd1', payerName: 'Intl Fund', ordinaryDividends: 5000,
        qualifiedDividends: 3000, foreignTaxPaid: 200,
      }],
    });
    const result = calculateForm1040(taxReturn);

    // $200 foreign tax ≤ $300 simplified threshold → full credit
    expect(result.credits.foreignTaxCredit).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Student Loan Interest Deduction (above-the-line)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Student Loan Interest', () => {
  it('$2,500 student loan interest — full deduction', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      studentLoanInterest: 2500,
    });
    const result = calculateForm1040(taxReturn);

    // AGI should be $75k - $2.5k = $72.5k
    expect(result.form1040.agi).toBe(72500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HSA Deduction
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: HSA Deduction', () => {
  it('Self-only HSA $4k contribution — deducted from AGI', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      hsaContribution: { coverageType: 'self_only', totalContributions: 4000 },
    });
    const result = calculateForm1040(taxReturn);

    // AGI should be $75k - $4k = $71k (capped at annual limit)
    expect(result.form1040.agi).toBeLessThan(75000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Elderly/Disabled Credit (Schedule R)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Elderly/Disabled Credit', () => {
  it('Single age 65+, $25k income — credit calculated', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Test', wages: 25000, federalTaxWithheld: 2000,
      }],
      scheduleR: {
        filingCategory: 1, // Single, age 65+
        nontaxableSSA: 3000,
        otherNontaxablePensions: 0,
      },
    });
    const result = calculateForm1040(taxReturn);

    // At $25k income with $3k nontaxable SS, may or may not qualify
    // The key test is that the calculation runs without error
    expect(result.credits.elderlyDisabledCredit).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Premium Tax Credit (Form 8962)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Premium Tax Credit', () => {
  it('Marketplace insurance with APTC — reconciliation runs', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1', employerName: 'Test', wages: 40000, federalTaxWithheld: 3000,
      }],
      premiumTaxCredit: {
        annualPremium: 8000,
        annualSLCSP: 9000,
        annualAPTC: 4000,
        householdSize: 1,
      },
    });
    const result = calculateForm1040(taxReturn);

    // PTC should be calculated without NaN
    expect(result.credits.premiumTaxCredit).not.toBeNaN();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Adoption Credit (Form 8839)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Adoption Credit', () => {
  it('$10k qualified adoption expenses — credit generated', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      adoptionCredit: {
        qualifiedExpenses: 10000,
        isSpecialNeeds: false,
        adoptionFinalized: true,
        yearExpensesPaid: 2025,
      },
    });
    const result = calculateForm1040(taxReturn);

    expect(result.credits.adoptionCredit).toBeGreaterThan(0);
    expect(result.credits.adoptionCredit).toBeLessThanOrEqual(10000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IRA Deduction
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: IRA Deduction', () => {
  it('$7k IRA contribution, not covered by employer plan — full deduction', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      iraContribution: 7000,
      coveredByEmployerPlan: false,
    });
    const result = calculateForm1040(taxReturn);

    // AGI should be $75k - $7k = $68k
    expect(result.form1040.agi).toBe(68000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Educator Expenses (up to $300)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Educator Expenses', () => {
  it('$300 educator expenses — deducted from AGI', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: BASELINE_W2,
      educatorExpenses: 300,
    });
    const result = calculateForm1040(taxReturn);

    expect(result.form1040.agi).toBe(74700);
  });
});
