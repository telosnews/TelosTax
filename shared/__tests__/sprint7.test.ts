/**
 * Sprint 7 Tests — Bug Fixes (Wrong Numbers for Existing Users)
 *
 * 7A. SE deductible half excludes additional Medicare tax
 * 7B. Dependent standard deduction (reduced for filers claimed as dependents)
 * 7C. Dependent care spouse earned income (lower-earner limitation)
 * 7D. EITC age check for childless filers (age 25-64)
 * 7E. IRA deduction — employer plan coverage flag
 */
import { describe, it, expect } from 'vitest';
import { calculateScheduleSE } from '../src/engine/scheduleSE.js';
import { calculateEITC } from '../src/engine/eitc.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';
import { SE_TAX } from '../src/constants/tax2025.js';

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'sprint7',
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

// ═══════════════════════════════════════════════════
// 7A. SE Deductible Half Excludes Additional Medicare Tax
// ═══════════════════════════════════════════════════

describe('Sprint 7A: SE Deductible Half', () => {
  it('excludes additional Medicare tax from deductible half', () => {
    // High earner: $300k SE income → triggers additional Medicare
    const result = calculateScheduleSE(300000, FilingStatus.Single);

    // Net earnings = 300k × 0.9235 = $277,050
    expect(result.netEarnings).toBeCloseTo(277050, 0);

    // Additional Medicare should be > 0 (above $200k threshold)
    expect(result.additionalMedicareTax).toBeGreaterThan(0);

    // Deductible half should be (SS tax + Medicare tax) / 2
    // NOT (SS tax + Medicare tax + additional Medicare tax) / 2
    const expectedDeductible = (result.socialSecurityTax + result.medicareTax) / 2;
    expect(result.deductibleHalf).toBeCloseTo(expectedDeductible, 2);

    // Verify it does NOT include additional Medicare
    const wrongDeductible = result.totalSETax / 2;
    expect(result.deductibleHalf).toBeLessThan(wrongDeductible);
  });

  it('no difference when no additional Medicare (below threshold)', () => {
    const result = calculateScheduleSE(80000, FilingStatus.Single);

    // Below $200k threshold — no additional Medicare
    expect(result.additionalMedicareTax).toBe(0);

    // Deductible half = totalSETax / 2 (same as before since no additional)
    expect(result.deductibleHalf).toBeCloseTo(result.totalSETax / 2, 2);
  });

  it('deductible half difference is exactly half of additional Medicare', () => {
    const result = calculateScheduleSE(300000, FilingStatus.Single);
    const oldDeductible = result.totalSETax / 2;
    const difference = oldDeductible - result.deductibleHalf;
    expect(difference).toBeCloseTo(result.additionalMedicareTax / 2, 1);
  });

  it('flows through to form1040 SE deduction', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: '1', payerName: 'Client', amount: 300000 }],
      business: { id: 'b', businessName: 'Consulting', accountingMethod: 'cash', didStartThisYear: false },
    });
    const result = calculateForm1040(tr);

    // SE deduction should use the corrected deductible half
    const se = result.scheduleSE!;
    expect(result.form1040.seDeduction).toBe(se.deductibleHalf);
    expect(result.form1040.seDeduction).toBeCloseTo((se.socialSecurityTax + se.medicareTax) / 2, 2);
  });
});

// ═══════════════════════════════════════════════════
// 7B. Dependent Standard Deduction
// ═══════════════════════════════════════════════════

describe('Sprint 7B: Dependent Standard Deduction', () => {
  it('dependent with $0 earned income gets $1,350 standard deduction', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      canBeClaimedAsDependent: true,
      income1099INT: [{ id: '1', payerName: 'Bank', amount: 2000 }],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.standardDeduction).toBe(1350);
  });

  it('dependent with $5,000 earned income gets $5,450 standard deduction', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      canBeClaimedAsDependent: true,
      w2Income: [{ id: '1', employerName: 'Job', wages: 5000, federalTaxWithheld: 500 }],
    });
    const result = calculateForm1040(tr);
    // $5,000 + $450 = $5,450
    expect(result.form1040.standardDeduction).toBe(5450);
  });

  it('dependent with high earned income gets capped at regular standard deduction', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      canBeClaimedAsDependent: true,
      w2Income: [{ id: '1', employerName: 'Job', wages: 20000, federalTaxWithheld: 2000 }],
    });
    const result = calculateForm1040(tr);
    // $20,000 + $450 = $20,450 → capped at $15,750 (Single standard deduction)
    expect(result.form1040.standardDeduction).toBe(15750);
  });

  it('dependent with $900 earned income gets $1,350 (minimum)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      canBeClaimedAsDependent: true,
      w2Income: [{ id: '1', employerName: 'Job', wages: 900, federalTaxWithheld: 50 }],
    });
    const result = calculateForm1040(tr);
    // $900 + $450 = $1,350 — equals the minimum, so result is $1,350
    expect(result.form1040.standardDeduction).toBe(1350);
  });

  it('dependent 65+ gets additional amount on top of reduced base', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      canBeClaimedAsDependent: true,
      dateOfBirth: '1958-01-15', // age 67 in 2025
      income1099INT: [{ id: '1', payerName: 'Bank', amount: 3000 }],
    });
    const result = calculateForm1040(tr);
    // Base: $1,350 (dependent min, no earned income)
    // Additional: $2,000 (unmarried, 65+)
    expect(result.form1040.standardDeduction).toBe(1350 + 2000);
  });

  it('non-dependent gets regular standard deduction (unchanged)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Job', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.standardDeduction).toBe(15750);
  });

  it('canBeClaimedAsDependent = false works same as undefined', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      canBeClaimedAsDependent: false,
      w2Income: [{ id: '1', employerName: 'Job', wages: 5000, federalTaxWithheld: 500 }],
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.standardDeduction).toBe(15750);
  });
});

// ═══════════════════════════════════════════════════
// 7C. Dependent Care Spouse Earned Income
// ═══════════════════════════════════════════════════

describe('Sprint 7C: Dependent Care Spouse Earned Income', () => {
  it('MFJ with spouse earning $0 → credit is $0 (limited by lower earner)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: '1', employerName: 'Job', wages: 80000, federalTaxWithheld: 10000 }],
      dependentCare: { totalExpenses: 6000, qualifyingPersons: 2, spouseEarnedIncome: 0 },
      dependents: [
        { id: 'd1', firstName: 'Child', lastName: 'One', dateOfBirth: '2020-01-01', relationship: 'child', monthsLivedWithYou: 12 },
      ],
    });
    const result = calculateForm1040(tr);
    expect(result.credits.dependentCareCredit).toBe(0);
  });

  it('MFJ with spouse earning $3,000 → expenses limited to $3k', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: '1', employerName: 'Job', wages: 80000, federalTaxWithheld: 10000 }],
      dependentCare: { totalExpenses: 6000, qualifyingPersons: 2, spouseEarnedIncome: 3000 },
      dependents: [
        { id: 'd1', firstName: 'Child', lastName: 'One', dateOfBirth: '2020-01-01', relationship: 'child', monthsLivedWithYou: 12 },
      ],
    });
    const result = calculateForm1040(tr);
    // Expenses capped at spouse's $3k earned income
    // Credit rate at ~$80k AGI = 20% → $3,000 × 0.20 = $600
    expect(result.credits.dependentCareCredit).toBe(600);
  });

  it('MFJ both earning $50k+ → normal credit (not limited)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: '1', employerName: 'Job', wages: 60000, federalTaxWithheld: 8000 }],
      dependentCare: { totalExpenses: 6000, qualifyingPersons: 2, spouseEarnedIncome: 50000 },
    });
    const result = calculateForm1040(tr);
    // Both spouses earn enough → full $6k expenses qualify
    // Credit rate at ~$60k AGI = 20% → $6,000 × 0.20 = $1,200
    expect(result.credits.dependentCareCredit).toBe(1200);
  });

  it('no spouseEarnedIncome provided → falls back to no limitation', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: '1', employerName: 'Job', wages: 60000, federalTaxWithheld: 8000 }],
      dependentCare: { totalExpenses: 6000, qualifyingPersons: 2 },
    });
    const result = calculateForm1040(tr);
    // Without spouseEarnedIncome, no lower-earner limitation (backward compat)
    expect(result.credits.dependentCareCredit).toBeGreaterThan(0);
  });

  it('Single filer → spouseEarnedIncome is ignored', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Job', wages: 30000, federalTaxWithheld: 3000 }],
      dependentCare: { totalExpenses: 3000, qualifyingPersons: 1, spouseEarnedIncome: 0 },
    });
    const result = calculateForm1040(tr);
    // Single filer — no spouse limitation applies
    expect(result.credits.dependentCareCredit).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════
// 7D. EITC Age Check for Childless Filers
// ═══════════════════════════════════════════════════

describe('Sprint 7D: EITC Age Check', () => {
  it('age 24 with 0 children → ineligible', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 10000, 10000, 0, 0,
      '2001-06-15', // age 24 in 2025
      2025,
    );
    expect(credit).toBe(0);
  });

  it('age 25 with 0 children → eligible', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 10000, 10000, 0, 0,
      '2000-06-15', // age 25 in 2025
      2025,
    );
    expect(credit).toBeGreaterThan(0);
  });

  it('age 64 with 0 children → eligible', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 10000, 10000, 0, 0,
      '1961-06-15', // age 64 in 2025
      2025,
    );
    expect(credit).toBeGreaterThan(0);
  });

  it('age 65 with 0 children → ineligible', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 10000, 10000, 0, 0,
      '1960-06-15', // age 65 in 2025
      2025,
    );
    expect(credit).toBe(0);
  });

  it('age 30 with 2 children → no age restriction', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 15000, 15000, 2, 0,
      '1995-06-15', // age 30 in 2025
      2025,
    );
    expect(credit).toBeGreaterThan(0);
  });

  it('age 20 with 1 child → no age restriction (children override)', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 12000, 12000, 1, 0,
      '2005-06-15', // age 20 in 2025
      2025,
    );
    expect(credit).toBeGreaterThan(0);
  });

  it('no DOB provided with 0 children → denied (cannot verify age)', () => {
    const credit = calculateEITC(
      FilingStatus.Single, 10000, 10000, 0, 0,
      undefined,
      2025,
    );
    expect(credit).toBe(0);
  });

  it('flows through form1040 — age 22 with 0 children gets $0 EITC', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '2003-03-15', // age 22 in 2025
      w2Income: [{ id: '1', employerName: 'Job', wages: 10000, federalTaxWithheld: 500 }],
    });
    const result = calculateForm1040(tr);
    expect(result.credits.eitcCredit).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 7E. IRA Deduction — Employer Plan Coverage
// ═══════════════════════════════════════════════════

describe('Sprint 7E: IRA Deduction Employer Plan Coverage', () => {
  it('not covered → full deduction at any income', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Job', wages: 200000, federalTaxWithheld: 30000 }],
      iraContribution: 7000,
      coveredByEmployerPlan: false,
    });
    const result = calculateForm1040(tr);
    // Full $7k deduction regardless of income
    expect(result.form1040.iraDeduction).toBe(7000);
  });

  it('not covered (undefined) → full deduction at any income', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Job', wages: 200000, federalTaxWithheld: 30000 }],
      iraContribution: 7000,
      // coveredByEmployerPlan not set
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.iraDeduction).toBe(7000);
  });

  it('covered + Single below phase-out → full deduction', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Job', wages: 70000, federalTaxWithheld: 8000 }],
      iraContribution: 7000,
      coveredByEmployerPlan: true,
    });
    const result = calculateForm1040(tr);
    // AGI ~$70k < $79k phase-out start → full deduction
    expect(result.form1040.iraDeduction).toBe(7000);
  });

  it('covered + Single above phase-out → $0 deduction', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Job', wages: 100000, federalTaxWithheld: 15000 }],
      iraContribution: 7000,
      coveredByEmployerPlan: true,
    });
    const result = calculateForm1040(tr);
    // AGI ~$100k > $89k ($79k + $10k range) → $0 deduction
    expect(result.form1040.iraDeduction).toBe(0);
  });

  it('covered + Single in phase-out range → partial deduction', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Job', wages: 84000, federalTaxWithheld: 12000 }],
      iraContribution: 7000,
      coveredByEmployerPlan: true,
    });
    const result = calculateForm1040(tr);
    // AGI ~$84k is in $79k-$89k range → partial
    expect(result.form1040.iraDeduction).toBeGreaterThan(0);
    expect(result.form1040.iraDeduction).toBeLessThan(7000);
  });
});
