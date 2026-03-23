/**
 * Unit tests for the Tax Scenario Lab core logic:
 * - useScenarioLab: applyOverrides, diffResults
 * - variableDefinitions: read/write round-trip
 * - reducer actions
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040, FilingStatus } from '@telostax/engine';
import type { TaxReturn } from '@telostax/engine';
import { applyOverrides, diffResults } from '../components/scenarioLab/useScenarioLab';
import { VARIABLE_DEFINITIONS } from '../components/scenarioLab/variableDefinitions';

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return',
    schemaVersion: 1,
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'income',
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w2-1',
      employerName: 'Test Corp',
      wages: 75000,
      federalTaxWithheld: 10000,
      socialSecurityWages: 75000,
      socialSecurityTax: 4650,
      medicareWages: 75000,
      medicareTax: 1088,
    }],
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
    expenses: [],
    dependents: [],
    educationCredits: [],
    deductionMethod: 'standard',
    otherIncome: 0,
    incomeDiscovery: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  } as TaxReturn;
}

// ---------------------------------------------------------------------------
// Variable Read/Write Tests
// ---------------------------------------------------------------------------

describe('variableDefinitions', () => {
  const tr = makeTaxReturn();

  it('reads w2_wages correctly', () => {
    const varDef = VARIABLE_DEFINITIONS.find(v => v.key === 'w2_wages')!;
    expect(varDef.read(tr)).toBe(75000);
  });

  it('writes w2_wages correctly', () => {
    const varDef = VARIABLE_DEFINITIONS.find(v => v.key === 'w2_wages')!;
    const modified = varDef.write(tr, 100000);
    expect(modified.w2Income[0].wages).toBe(100000);
    // Original is unchanged
    expect(tr.w2Income[0].wages).toBe(75000);
  });

  it('reads filing_status correctly', () => {
    const varDef = VARIABLE_DEFINITIONS.find(v => v.key === 'filing_status')!;
    expect(varDef.read(tr)).toBe(String(FilingStatus.Single));
  });

  it('writes filing_status correctly', () => {
    const varDef = VARIABLE_DEFINITIONS.find(v => v.key === 'filing_status')!;
    const modified = varDef.write(tr, String(FilingStatus.MarriedFilingJointly));
    expect(modified.filingStatus).toBe(FilingStatus.MarriedFilingJointly);
  });

  it('reads num_dependents correctly', () => {
    const varDef = VARIABLE_DEFINITIONS.find(v => v.key === 'num_dependents')!;
    expect(varDef.read(tr)).toBe(0);
  });

  it('writes num_dependents and creates stub dependents', () => {
    const varDef = VARIABLE_DEFINITIONS.find(v => v.key === 'num_dependents')!;
    const modified = varDef.write(tr, 2);
    expect(modified.dependents.length).toBe(2);
    expect(modified.dependents[0].firstName).toBe('Dependent');
  });

  it('reads/writes ira_contribution', () => {
    const varDef = VARIABLE_DEFINITIONS.find(v => v.key === 'ira_contribution')!;
    expect(varDef.read(tr)).toBe(0);
    const modified = varDef.write(tr, 7000);
    expect(modified.iraContribution).toBe(7000);
  });

  it('reads/writes deduction_method', () => {
    const varDef = VARIABLE_DEFINITIONS.find(v => v.key === 'deduction_method')!;
    expect(varDef.read(tr)).toBe('standard');
    const modified = varDef.write(tr, 'itemized');
    expect(modified.deductionMethod).toBe('itemized');
  });

  it('writes charitable_cash and auto-switches to itemized', () => {
    const varDef = VARIABLE_DEFINITIONS.find(v => v.key === 'charitable_cash')!;
    const modified = varDef.write(tr, 5000);
    expect(modified.deductionMethod).toBe('itemized');
    expect(modified.itemizedDeductions?.charitableCash).toBe(5000);
  });

  it('creates synthetic W-2 when writing wages to return with no W-2s', () => {
    const noW2 = makeTaxReturn({ w2Income: [] });
    const varDef = VARIABLE_DEFINITIONS.find(v => v.key === 'w2_wages')!;
    const modified = varDef.write(noW2, 50000);
    expect(modified.w2Income.length).toBe(1);
    expect(modified.w2Income[0].wages).toBe(50000);
    expect(modified.w2Income[0].employerName).toBe('Scenario');
  });

  it('SE variable is hidden for W-2-only filers', () => {
    const seDef = VARIABLE_DEFINITIONS.find(v => v.key === 'se_net_profit')!;
    expect(seDef.isRelevant!(tr)).toBe(false);
  });

  it('SE variable is visible when SE income exists', () => {
    const seTr = makeTaxReturn({
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 50000 }],
    });
    const seDef = VARIABLE_DEFINITIONS.find(v => v.key === 'se_net_profit')!;
    expect(seDef.isRelevant!(seTr)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyOverrides Tests
// ---------------------------------------------------------------------------

describe('applyOverrides', () => {
  const tr = makeTaxReturn();

  it('applies a single override', () => {
    const overrides = new Map<string, unknown>([['w2_wages', 100000]]);
    const modified = applyOverrides(tr, overrides);
    expect(modified.w2Income[0].wages).toBe(100000);
  });

  it('applies multiple overrides', () => {
    const overrides = new Map<string, unknown>([
      ['w2_wages', 100000],
      ['ira_contribution', 7000],
      ['deduction_method', 'itemized'],
    ]);
    const modified = applyOverrides(tr, overrides);
    expect(modified.w2Income[0].wages).toBe(100000);
    expect(modified.iraContribution).toBe(7000);
    expect(modified.deductionMethod).toBe('itemized');
  });

  it('does not mutate original', () => {
    const overrides = new Map<string, unknown>([['w2_wages', 100000]]);
    applyOverrides(tr, overrides);
    expect(tr.w2Income[0].wages).toBe(75000);
  });

  it('handles empty overrides', () => {
    const modified = applyOverrides(tr, new Map());
    expect(modified.w2Income[0].wages).toBe(75000);
  });

  it('ignores unknown override keys', () => {
    const overrides = new Map<string, unknown>([['nonexistent_key', 42]]);
    const modified = applyOverrides(tr, overrides);
    expect(modified.w2Income[0].wages).toBe(75000);
  });
});

// ---------------------------------------------------------------------------
// diffResults Tests
// ---------------------------------------------------------------------------

describe('diffResults', () => {
  const tr = makeTaxReturn();
  const baseResult = calculateForm1040({ ...tr, filingStatus: tr.filingStatus || FilingStatus.Single });

  it('returns zero deltas for identical results', () => {
    const delta = diffResults(baseResult, baseResult);
    expect(delta.totalIncome.diff).toBe(0);
    expect(delta.totalTax.diff).toBe(0);
    expect(delta.refundOrOwed.diff).toBe(0);
  });

  it('detects income increase', () => {
    const modified = { ...tr, w2Income: [{ ...tr.w2Income[0], wages: 100000 }] };
    const scenarioResult = calculateForm1040({ ...modified, filingStatus: modified.filingStatus || FilingStatus.Single });
    const delta = diffResults(baseResult, scenarioResult);
    expect(delta.totalIncome.diff).toBeGreaterThan(0);
    expect(delta.totalTax.diff).toBeGreaterThan(0);
  });

  it('detects IRA deduction impact', () => {
    const modified = { ...tr, iraContribution: 7000 };
    const scenarioResult = calculateForm1040({ ...modified, filingStatus: modified.filingStatus || FilingStatus.Single });
    const delta = diffResults(baseResult, scenarioResult);
    expect(delta.totalAdjustments.diff).toBeGreaterThan(0);
    expect(delta.taxableIncome.diff).toBeLessThan(0);
  });

  it('produces consistent delta fields', () => {
    const modified = { ...tr, w2Income: [{ ...tr.w2Income[0], wages: 50000 }] };
    const scenarioResult = calculateForm1040({ ...modified, filingStatus: modified.filingStatus || FilingStatus.Single });
    const delta = diffResults(baseResult, scenarioResult);

    // All expected fields should exist
    expect(delta).toHaveProperty('refundOrOwed');
    expect(delta).toHaveProperty('totalIncome');
    expect(delta).toHaveProperty('totalAdjustments');
    expect(delta).toHaveProperty('agi');
    expect(delta).toHaveProperty('deductionAmount');
    expect(delta).toHaveProperty('taxableIncome');
    expect(delta).toHaveProperty('incomeTax');
    expect(delta).toHaveProperty('totalTax');
    expect(delta).toHaveProperty('totalCredits');
    expect(delta).toHaveProperty('effectiveTaxRate');

    // Each entry should have the right shape
    const entry = delta.totalIncome;
    expect(entry).toHaveProperty('base');
    expect(entry).toHaveProperty('scenario');
    expect(entry).toHaveProperty('diff');
    expect(entry).toHaveProperty('pctChange');
  });
});
