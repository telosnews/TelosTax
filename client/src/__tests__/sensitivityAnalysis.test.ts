/**
 * Unit tests for sensitivity analysis data generation.
 *
 * Tests the core calculation logic (not the hook, since that requires React).
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040, FilingStatus } from '@telostax/engine';
import type { TaxReturn } from '@telostax/engine';
import { applyOverrides } from '../components/scenarioLab/useScenarioLab';
import { VARIABLE_DEFINITIONS } from '../components/scenarioLab/variableDefinitions';
import type { SensitivityConfig } from '../components/scenarioLab/types';

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

function makeTaxReturn(): TaxReturn {
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
  } as TaxReturn;
}

// ---------------------------------------------------------------------------
// Sensitivity data generation (synchronous, no hook)
// ---------------------------------------------------------------------------

function generateSensitivityData(
  taxReturn: TaxReturn,
  config: SensitivityConfig,
  baseOverrides: Map<string, unknown> = new Map(),
): { input: number; output: number; delta: number }[] {
  const baseResult = calculateForm1040({
    ...applyOverrides(taxReturn, baseOverrides),
    filingStatus: taxReturn.filingStatus || FilingStatus.Single,
  });
  const baseOutput = baseResult.form1040.refundAmount > 0
    ? baseResult.form1040.refundAmount
    : -baseResult.form1040.amountOwed;

  const { min, max, steps, variableKey } = config;
  const stepSize = (max - min) / Math.max(steps - 1, 1);
  const results: { input: number; output: number; delta: number }[] = [];

  for (let i = 0; i < steps; i++) {
    const inputVal = min + i * stepSize;
    const overrides = new Map(baseOverrides);
    overrides.set(variableKey, inputVal);

    const modified = applyOverrides(taxReturn, overrides);
    const result = calculateForm1040({
      ...modified,
      filingStatus: modified.filingStatus || FilingStatus.Single,
    });
    const output = result.form1040.refundAmount > 0
      ? result.form1040.refundAmount
      : -result.form1040.amountOwed;

    results.push({ input: inputVal, output, delta: output - baseOutput });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sensitivity analysis data generation', () => {
  const tr = makeTaxReturn();

  it('generates correct number of data points', () => {
    const config: SensitivityConfig = {
      variableKey: 'w2_wages',
      outputMetric: 'refundOrOwed',
      min: 0,
      max: 200000,
      steps: 20,
    };
    const data = generateSensitivityData(tr, config);
    expect(data.length).toBe(20);
  });

  it('first point has input equal to min', () => {
    const config: SensitivityConfig = {
      variableKey: 'w2_wages',
      outputMetric: 'refundOrOwed',
      min: 10000,
      max: 100000,
      steps: 10,
    };
    const data = generateSensitivityData(tr, config);
    expect(data[0].input).toBe(10000);
  });

  it('last point has input equal to max', () => {
    const config: SensitivityConfig = {
      variableKey: 'w2_wages',
      outputMetric: 'refundOrOwed',
      min: 10000,
      max: 100000,
      steps: 10,
    };
    const data = generateSensitivityData(tr, config);
    expect(data[data.length - 1].input).toBeCloseTo(100000, 0);
  });

  it('increasing wages decreases refund (more tax owed)', () => {
    const config: SensitivityConfig = {
      variableKey: 'w2_wages',
      outputMetric: 'refundOrOwed',
      min: 50000,
      max: 150000,
      steps: 5,
    };
    const data = generateSensitivityData(tr, config);
    // Higher wages = higher tax = lower net refund (or more owed)
    // At constant withholding, more wages should reduce refund
    const first = data[0].output;
    const last = data[data.length - 1].output;
    expect(last).toBeLessThan(first);
  });

  it('IRA contribution range produces monotonically improving refund', () => {
    const config: SensitivityConfig = {
      variableKey: 'ira_contribution',
      outputMetric: 'refundOrOwed',
      min: 0,
      max: 7000,
      steps: 8,
    };
    const data = generateSensitivityData(tr, config);
    // Higher IRA = lower taxable income = better refund
    for (let i = 1; i < data.length; i++) {
      expect(data[i].output).toBeGreaterThanOrEqual(data[i - 1].output);
    }
  });

  it('delta at the base value is approximately zero', () => {
    const config: SensitivityConfig = {
      variableKey: 'w2_wages',
      outputMetric: 'refundOrOwed',
      min: 70000,
      max: 80000,
      steps: 11,
    };
    const data = generateSensitivityData(tr, config);
    // The point closest to 75000 should have a delta near 0
    const closest = data.reduce((prev, curr) =>
      Math.abs(curr.input - 75000) < Math.abs(prev.input - 75000) ? curr : prev,
    );
    expect(Math.abs(closest.delta)).toBeLessThan(500); // Within $500
  });

  it('works with existing overrides as a starting point', () => {
    const config: SensitivityConfig = {
      variableKey: 'w2_wages',
      outputMetric: 'refundOrOwed',
      min: 50000,
      max: 100000,
      steps: 5,
    };
    const baseOverrides = new Map<string, unknown>([['ira_contribution', 7000]]);
    const data = generateSensitivityData(tr, config, baseOverrides);
    expect(data.length).toBe(5);
    // With IRA deduction, refund should be higher than without
    const dataNoIRA = generateSensitivityData(tr, config);
    expect(data[0].output).toBeGreaterThanOrEqual(dataNoIRA[0].output);
  });
});
