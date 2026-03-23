import { describe, it, expect } from 'vitest';
import { TraceBuilder, NoOpTraceBuilder, createTraceBuilder } from '../src/engine/traceBuilder.js';
import { traceProgressiveTax } from '../src/engine/brackets.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { FilingStatus, TaxReturn, CalculationResult, TraceOptions } from '../src/types/index.js';

// ─── TraceBuilder ────────────────────────────────────────

describe('TraceBuilder', () => {
  it('trace() returns the value unchanged (pass-through)', () => {
    const tb = new TraceBuilder();
    const result = tb.trace('id', 'label', 42);
    expect(result).toBe(42);
  });

  it('build() returns recorded traces', () => {
    const tb = new TraceBuilder();
    tb.trace('line1', 'First', 100);
    tb.trace('line2', 'Second', 200);
    const traces = tb.build();
    expect(traces).toHaveLength(2);
    expect(traces[0].lineId).toBe('line1');
    expect(traces[0].label).toBe('First');
    expect(traces[0].value).toBe(100);
    expect(traces[1].lineId).toBe('line2');
    expect(traces[1].label).toBe('Second');
    expect(traces[1].value).toBe(200);
  });

  it('trace() records formula and authority', () => {
    const tb = new TraceBuilder();
    tb.trace('calc', 'Calculation', 99, { formula: 'a + b', authority: 'IRC \u00a71' });
    const traces = tb.build();
    expect(traces[0].formula).toBe('a + b');
    expect(traces[0].authority).toBe('IRC \u00a71');
  });
});

// ─── NoOpTraceBuilder ────────────────────────────────────

describe('NoOpTraceBuilder', () => {
  it('trace() returns the value unchanged', () => {
    const tb = new NoOpTraceBuilder();
    const result = tb.trace('id', 'label', 77);
    expect(result).toBe(77);
  });

  it('build() always returns empty array', () => {
    const tb = new NoOpTraceBuilder();
    tb.trace('line1', 'First', 100);
    tb.trace('line2', 'Second', 200);
    const traces = tb.build();
    expect(traces).toEqual([]);
  });
});

// ─── createTraceBuilder ──────────────────────────────────

describe('createTraceBuilder', () => {
  it('creates TraceBuilder when enabled', () => {
    const tb = createTraceBuilder(true);
    tb.trace('x', 'X', 1);
    expect(tb.build().length).toBeGreaterThan(0);
  });

  it('creates NoOpTraceBuilder when disabled', () => {
    const tb = createTraceBuilder(false);
    tb.trace('x', 'X', 1);
    expect(tb.build().length).toBe(0);
  });
});

// ─── traceProgressiveTax ─────────────────────────────────

describe('traceProgressiveTax', () => {
  it('returns per-bracket traces for Single $50,000', () => {
    const result = traceProgressiveTax(50000, FilingStatus.Single);
    // 3 brackets hit: 10%, 12%, 22%
    expect(result.traces).toHaveLength(3);
    expect(result.traces[0].lineId).toBe('bracket.10pct');
    result.traces.forEach((t) => {
      expect(t.authority).toBe('IRC \u00a71(a)-(d)');
    });
    expect(result.traces[0].inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lineId: 'bracket.taxableAtRate' }),
      ]),
    );
  });

  it('returns empty traces for zero income', () => {
    const result = traceProgressiveTax(0, FilingStatus.Single);
    expect(result.traces).toEqual([]);
  });
});

// ─── calculateForm1040 with traces ──────────────────────

describe('calculateForm1040 with traces', () => {
  const taxReturn: TaxReturn = {
    filingStatus: FilingStatus.Single,
    firstName: 'Test',
    lastName: 'User',
    dateOfBirth: '1990-01-01',
    w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    income1099DA: [],
    income1099SA: [],
    incomeK1: [],
    rentalProperties: [],
    dependents: [],
    expenses: [],
    incomeDiscovery: {},
  } as unknown as TaxReturn;

  it('does not generate traces when traceOptions is undefined', () => {
    const result: CalculationResult = calculateForm1040(taxReturn);
    expect(result.traces).toBeUndefined();
  });

  it('generates traces when traceOptions.enabled is true', () => {
    const result: CalculationResult = calculateForm1040(taxReturn, { enabled: true });
    expect(result.traces).toBeDefined();
    expect(Array.isArray(result.traces)).toBe(true);
    expect(result.traces!.length).toBeGreaterThan(0);

    // Total Income trace
    const line9 = result.traces!.find((t) => t.lineId === 'form1040.line9');
    expect(line9).toBeDefined();

    // Taxable Income trace
    const line15 = result.traces!.find((t) => t.lineId === 'form1040.line15');
    expect(line15).toBeDefined();

    // Income Tax trace with bracket children
    const line16 = result.traces!.find((t) => t.lineId === 'form1040.line16');
    expect(line16).toBeDefined();
    expect(line16!.children).toBeDefined();
    expect(line16!.children!.length).toBeGreaterThan(0);
  });

  it('traces have correct structure', () => {
    const result: CalculationResult = calculateForm1040(taxReturn, { enabled: true });
    const line9 = result.traces!.find((t) => t.lineId === 'form1040.line9');
    expect(line9).toBeDefined();
    expect(typeof line9!.label).toBe('string');
    expect(typeof line9!.value).toBe('number');
    expect(typeof line9!.authority).toBe('string');
    expect(Array.isArray(line9!.inputs)).toBe(true);
  });
});
