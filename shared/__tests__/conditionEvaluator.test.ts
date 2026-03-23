import { describe, it, expect } from 'vitest';
import { evaluateCondition, describeCondition } from '../src/wizard/conditionEvaluator.js';
import { StepCondition } from '../src/wizard/conditionTypes.js';
import { TaxReturn, CalculationResult, FilingStatus } from '../src/types/index.js';

function makeTaxReturn(overrides: Record<string, unknown> = {}): TaxReturn {
  return {
    filingStatus: 1,
    firstName: 'Test', lastName: 'User',
    dateOfBirth: '1990-01-01',
    w2Income: [],
    income1099NEC: [], income1099K: [], income1099INT: [], income1099DIV: [],
    income1099R: [], income1099G: [], income1099MISC: [], income1099B: [], income1099DA: [],
    income1099SA: [], incomeK1: [], rentalProperties: [],
    dependents: [], expenses: [],
    incomeDiscovery: {},
    ...overrides,
  } as unknown as TaxReturn;
}

describe('evaluateCondition — field_equals', () => {
  const condition: StepCondition = { type: 'field_equals', field: 'deductionMethod', value: 'itemized' };

  it('returns true when field matches value', () => {
    const taxReturn = makeTaxReturn({ deductionMethod: 'itemized' });
    expect(evaluateCondition(condition, taxReturn)).toBe(true);
  });

  it('returns false when field does not match', () => {
    const taxReturn = makeTaxReturn({ deductionMethod: 'standard' });
    expect(evaluateCondition(condition, taxReturn)).toBe(false);
  });
});

describe('evaluateCondition — field_exists', () => {
  const condition: StepCondition = { type: 'field_exists', field: 'homeOffice' };

  it('returns true when field is present', () => {
    const taxReturn = makeTaxReturn({ homeOffice: { method: 'simplified' } });
    expect(evaluateCondition(condition, taxReturn)).toBe(true);
  });

  it('returns false when field is null/undefined', () => {
    const taxReturn = makeTaxReturn();
    expect(evaluateCondition(condition, taxReturn)).toBe(false);
  });
});

describe('evaluateCondition — field_truthy', () => {
  const condition: StepCondition = { type: 'field_truthy', field: 'deductionMethod' };

  it('returns true for truthy value', () => {
    const taxReturn = makeTaxReturn({ deductionMethod: 'itemized' });
    expect(evaluateCondition(condition, taxReturn)).toBe(true);
  });

  it('returns false for falsy value', () => {
    const taxReturn = makeTaxReturn({ deductionMethod: '' });
    expect(evaluateCondition(condition, taxReturn)).toBe(false);
  });
});

describe('evaluateCondition — array_not_empty', () => {
  const condition: StepCondition = { type: 'array_not_empty', field: 'w2Income' };

  it('returns true when array has items', () => {
    const taxReturn = makeTaxReturn({
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    expect(evaluateCondition(condition, taxReturn)).toBe(true);
  });

  it('returns false when array is empty', () => {
    const taxReturn = makeTaxReturn({ w2Income: [] });
    expect(evaluateCondition(condition, taxReturn)).toBe(false);
  });
});

describe('evaluateCondition — array_length_gt', () => {
  it('returns true when array length exceeds min', () => {
    const condition: StepCondition = { type: 'array_length_gt', field: 'dependents', min: 0 };
    const taxReturn = makeTaxReturn({
      dependents: [{ firstName: 'Child', lastName: 'One' }],
    });
    expect(evaluateCondition(condition, taxReturn)).toBe(true);
  });

  it('returns false when array length does not exceed min', () => {
    const condition: StepCondition = { type: 'array_length_gt', field: 'dependents', min: 2 };
    const taxReturn = makeTaxReturn({
      dependents: [{ firstName: 'Child', lastName: 'One' }],
    });
    expect(evaluateCondition(condition, taxReturn)).toBe(false);
  });
});

describe('evaluateCondition — discovery_equals', () => {
  const condition: StepCondition = { type: 'discovery_equals', incomeType: 'w2', value: 'yes' };

  it('returns true when income discovery matches', () => {
    const taxReturn = makeTaxReturn({ incomeDiscovery: { w2: 'yes' } });
    expect(evaluateCondition(condition, taxReturn)).toBe(true);
  });

  it('returns false when discovery does not match', () => {
    const taxReturn = makeTaxReturn({ incomeDiscovery: { w2: 'no' } });
    expect(evaluateCondition(condition, taxReturn)).toBe(false);
  });

  it('returns false when discovery key is missing', () => {
    const taxReturn = makeTaxReturn({ incomeDiscovery: {} });
    expect(evaluateCondition(condition, taxReturn)).toBe(false);
  });
});

describe('evaluateCondition — any (OR)', () => {
  const condition: StepCondition = {
    type: 'any',
    conditions: [
      { type: 'discovery_equals', incomeType: 'w2', value: 'yes' },
      { type: 'discovery_equals', incomeType: '1099nec', value: 'yes' },
    ],
  };

  it('returns true when at least one condition is true', () => {
    const taxReturn = makeTaxReturn({ incomeDiscovery: { w2: 'no', '1099nec': 'yes' } });
    expect(evaluateCondition(condition, taxReturn)).toBe(true);
  });

  it('returns false when no conditions are true', () => {
    const taxReturn = makeTaxReturn({ incomeDiscovery: { w2: 'no', '1099nec': 'no' } });
    expect(evaluateCondition(condition, taxReturn)).toBe(false);
  });
});

describe('evaluateCondition — all (AND)', () => {
  const condition: StepCondition = {
    type: 'all',
    conditions: [
      { type: 'field_truthy', field: 'deductionMethod' },
      { type: 'field_equals', field: 'deductionMethod', value: 'itemized' },
    ],
  };

  it('returns true when all conditions are true', () => {
    const taxReturn = makeTaxReturn({ deductionMethod: 'itemized' });
    expect(evaluateCondition(condition, taxReturn)).toBe(true);
  });

  it('returns false when any condition is false', () => {
    const taxReturn = makeTaxReturn({ deductionMethod: 'standard' });
    expect(evaluateCondition(condition, taxReturn)).toBe(false);
  });
});

describe('evaluateCondition — not', () => {
  const condition: StepCondition = {
    type: 'not',
    condition: { type: 'field_equals', field: 'deductionMethod', value: 'itemized' },
  };

  it('negates the inner condition', () => {
    const taxReturn = makeTaxReturn({ deductionMethod: 'standard' });
    expect(evaluateCondition(condition, taxReturn)).toBe(true);
  });

  it('returns false when inner condition is true', () => {
    const taxReturn = makeTaxReturn({ deductionMethod: 'itemized' });
    expect(evaluateCondition(condition, taxReturn)).toBe(false);
  });
});

describe('evaluateCondition — nested dot-path access', () => {
  it('handles nested field paths', () => {
    const condition: StepCondition = { type: 'field_equals', field: 'homeOffice.method', value: 'simplified' };
    const taxReturn = makeTaxReturn({ homeOffice: { method: 'simplified' } });
    expect(evaluateCondition(condition, taxReturn)).toBe(true);
  });

  it('returns false for missing nested path', () => {
    const taxReturn = makeTaxReturn();

    const equalsCondition: StepCondition = { type: 'field_equals', field: 'homeOffice.method', value: 'simplified' };
    expect(evaluateCondition(equalsCondition, taxReturn)).toBe(false);

    const existsCondition: StepCondition = { type: 'field_exists', field: 'homeOffice.method' };
    expect(evaluateCondition(existsCondition, taxReturn)).toBe(false);
  });
});

describe('evaluateCondition — agi_lte', () => {
  const condition: StepCondition = {
    type: 'agi_lte',
    thresholds: { single: 36500, mfj: 73000, mfs: 36500, hoh: 54750, qss: 73000 },
  };

  function makeCalc(agi: number): CalculationResult {
    return { form1040: { agi } } as unknown as CalculationResult;
  }

  it('returns true when no calculation is provided', () => {
    const taxReturn = makeTaxReturn({ filingStatus: FilingStatus.Single });
    expect(evaluateCondition(condition, taxReturn)).toBe(true);
    expect(evaluateCondition(condition, taxReturn, null)).toBe(true);
  });

  it('returns true when AGI is at or below threshold (Single)', () => {
    const taxReturn = makeTaxReturn({ filingStatus: FilingStatus.Single });
    expect(evaluateCondition(condition, taxReturn, makeCalc(36500))).toBe(true);
    expect(evaluateCondition(condition, taxReturn, makeCalc(30000))).toBe(true);
  });

  it('returns false when AGI exceeds threshold (Single)', () => {
    const taxReturn = makeTaxReturn({ filingStatus: FilingStatus.Single });
    expect(evaluateCondition(condition, taxReturn, makeCalc(36501))).toBe(false);
  });

  it('uses MFJ threshold for married filing jointly', () => {
    const taxReturn = makeTaxReturn({ filingStatus: FilingStatus.MarriedFilingJointly });
    expect(evaluateCondition(condition, taxReturn, makeCalc(73000))).toBe(true);
    expect(evaluateCondition(condition, taxReturn, makeCalc(73001))).toBe(false);
  });

  it('uses HOH threshold for head of household', () => {
    const taxReturn = makeTaxReturn({ filingStatus: FilingStatus.HeadOfHousehold });
    expect(evaluateCondition(condition, taxReturn, makeCalc(54750))).toBe(true);
    expect(evaluateCondition(condition, taxReturn, makeCalc(54751))).toBe(false);
  });

  it('works inside all() combinator', () => {
    const combined: StepCondition = {
      type: 'all',
      conditions: [
        { type: 'discovery_equals', incomeType: 'savers_credit', value: 'yes' },
        condition,
      ],
    };
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      incomeDiscovery: { savers_credit: 'yes' },
    });
    // Discovery yes + AGI under threshold → visible
    expect(evaluateCondition(combined, taxReturn, makeCalc(30000))).toBe(true);
    // Discovery yes + AGI over threshold → hidden
    expect(evaluateCondition(combined, taxReturn, makeCalc(50000))).toBe(false);
    // Discovery no + AGI under threshold → hidden
    const noDisc = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      incomeDiscovery: { savers_credit: 'no' },
    });
    expect(evaluateCondition(combined, noDisc, makeCalc(30000))).toBe(false);
  });
});

describe('describeCondition', () => {
  it('describes field_equals', () => {
    const result = describeCondition({ type: 'field_equals', field: 'deductionMethod', value: 'itemized' });
    expect(result).toContain('deductionMethod');
    expect(result).toContain('itemized');
  });

  it('describes discovery_equals', () => {
    const result = describeCondition({ type: 'discovery_equals', incomeType: 'w2', value: 'yes' });
    expect(result).toContain('w2');
    expect(result).toContain('yes');
  });

  it('describes any', () => {
    const result = describeCondition({
      type: 'any',
      conditions: [
        { type: 'field_truthy', field: 'a' },
        { type: 'field_truthy', field: 'b' },
      ],
    });
    expect(result.toLowerCase()).toMatch(/any|or/);
  });

  it('describes not', () => {
    const result = describeCondition({
      type: 'not',
      condition: { type: 'field_truthy', field: 'x' },
    });
    expect(result).toContain('NOT');
  });

  it('describes agi_lte', () => {
    const result = describeCondition({
      type: 'agi_lte',
      thresholds: { single: 36500, mfj: 73000, mfs: 36500, hoh: 54750, qss: 73000 },
    });
    expect(result).toContain('36,500');
    expect(result).toContain('73,000');
    expect(result.toLowerCase()).toContain('agi');
  });
});
