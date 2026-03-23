import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';
import { migrateReturn, CURRENT_SCHEMA_VERSION } from '../src/migrations/runner.js';

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test',
    schemaVersion: CURRENT_SCHEMA_VERSION,
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
    incomeW2G: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    rentalProperties: [],
    businesses: [],
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

describe('Military — Moving Expenses Deduction (Form 3903, Schedule 1 Line 14)', () => {
  it('deducts moving expenses for active-duty military member', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'US Army', wages: 60000, federalTaxWithheld: 8000 }],
      isActiveDutyMilitary: true,
      movingExpenses: 3500,
    });

    const result = calculateForm1040(tr);
    const f = result.form1040;

    expect(f.movingExpenses).toBe(3500);
    expect(f.totalAdjustments).toBeGreaterThanOrEqual(3500);
    // AGI should be reduced by moving expenses
    expect(f.agi).toBe(f.totalIncome - f.totalAdjustments);
  });

  it('ignores moving expenses when isActiveDutyMilitary is false', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme Corp', wages: 60000, federalTaxWithheld: 8000 }],
      isActiveDutyMilitary: false,
      movingExpenses: 3500, // Should be ignored
    });

    const result = calculateForm1040(tr);
    expect(result.form1040.movingExpenses).toBe(0);
  });

  it('ignores moving expenses when isActiveDutyMilitary is undefined', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme Corp', wages: 60000, federalTaxWithheld: 8000 }],
      movingExpenses: 3500,
    });

    const result = calculateForm1040(tr);
    expect(result.form1040.movingExpenses).toBe(0);
  });

  it('handles negative moving expenses gracefully (clamps to 0)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'US Army', wages: 60000, federalTaxWithheld: 8000 }],
      isActiveDutyMilitary: true,
      movingExpenses: -500,
    });

    const result = calculateForm1040(tr);
    expect(result.form1040.movingExpenses).toBe(0);
  });

  it('correctly reduces AGI compared to non-military baseline', () => {
    const baseline = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'US Army', wages: 60000, federalTaxWithheld: 8000 }],
    });

    const military = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'US Army', wages: 60000, federalTaxWithheld: 8000 }],
      isActiveDutyMilitary: true,
      movingExpenses: 5000,
    });

    const baseResult = calculateForm1040(baseline);
    const milResult = calculateForm1040(military);

    // AGI should be exactly $5000 less with moving expenses
    expect(milResult.form1040.agi).toBe(baseResult.form1040.agi - 5000);
    expect(milResult.form1040.totalAdjustments).toBe(baseResult.form1040.totalAdjustments + 5000);
  });

  it('works with MFJ filing status and other adjustments', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'US Army', wages: 80000, federalTaxWithheld: 12000 }],
      isActiveDutyMilitary: true,
      movingExpenses: 4000,
      studentLoanInterest: 2500,
    });

    const result = calculateForm1040(tr);
    const f = result.form1040;

    expect(f.movingExpenses).toBe(4000);
    expect(f.studentLoanInterest).toBe(2500);
    // Total adjustments should include both
    expect(f.totalAdjustments).toBeGreaterThanOrEqual(6500);
  });
});

describe('Military — Nontaxable Combat Pay (Form 1040 Line 1i)', () => {
  it('does not affect tax calculation (informational only)', () => {
    const withCombat = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'US Army', wages: 40000, federalTaxWithheld: 5000 }],
      isActiveDutyMilitary: true,
      nontaxableCombatPay: 20000,
    });

    const withoutCombat = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'US Army', wages: 40000, federalTaxWithheld: 5000 }],
      isActiveDutyMilitary: true,
    });

    const resultWith = calculateForm1040(withCombat);
    const resultWithout = calculateForm1040(withoutCombat);

    // Combat pay is nontaxable — should not affect AGI, total income, or total tax
    expect(resultWith.form1040.agi).toBe(resultWithout.form1040.agi);
    expect(resultWith.form1040.totalIncome).toBe(resultWithout.form1040.totalIncome);
    expect(resultWith.form1040.totalTax).toBe(resultWithout.form1040.totalTax);
  });
});

describe('Migration v6 — Military fields', () => {
  it('bumps schema version to 6', () => {
    const oldReturn = { schemaVersion: 5, id: 'test' };
    const migrated = migrateReturn(oldReturn);
    expect(migrated).not.toBeNull();
    expect(migrated!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('leaves existing data intact', () => {
    const oldReturn = {
      schemaVersion: 5,
      id: 'test',
      firstName: 'Jane',
      filingStatus: 'single',
      isLegallyBlind: true,
    };
    const migrated = migrateReturn(oldReturn);
    expect(migrated!.firstName).toBe('Jane');
    expect(migrated!.filingStatus).toBe('single');
    expect(migrated!.isLegallyBlind).toBe(true);
    // New fields should be undefined (not explicitly set)
    expect(migrated!.isActiveDutyMilitary).toBeUndefined();
    expect(migrated!.nontaxableCombatPay).toBeUndefined();
    expect(migrated!.movingExpenses).toBeUndefined();
  });

  it('migrates from v0 through all versions to current', () => {
    const ancient = { id: 'old' };
    const migrated = migrateReturn(ancient);
    expect(migrated!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});
