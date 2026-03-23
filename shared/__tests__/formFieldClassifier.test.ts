import { describe, it, expect } from 'vitest';
import { setDeepPath } from '../src/engine/utils';
import { classifyFields, classifyField } from '../src/engine/formFieldClassifier';
import type { IRSFieldMapping } from '../src/types/irsFormMappings';
import { FORM_1040_FIELDS } from '../src/constants/irsForm1040Map';
import { SCHEDULE_A_FIELDS } from '../src/constants/irsScheduleAMap';

// ─── setDeepPath ─────────────────────────────────────────────────

describe('setDeepPath', () => {
  it('sets a top-level key', () => {
    const obj = { a: 1, b: 2 };
    const result = setDeepPath(obj, 'a', 99);
    expect(result).toEqual({ a: 99, b: 2 });
    // Must be immutable — original unchanged
    expect(obj.a).toBe(1);
  });

  it('sets a nested key', () => {
    const obj = { a: { b: 1, c: 2 }, d: 3 };
    const result = setDeepPath(obj, 'a.b', 42);
    expect(result).toEqual({ a: { b: 42, c: 2 }, d: 3 });
    expect(obj.a.b).toBe(1);
  });

  it('creates missing intermediary objects', () => {
    const obj = { x: 1 } as Record<string, unknown>;
    const result = setDeepPath(obj, 'a.b.c', 'hello');
    expect(result).toEqual({ x: 1, a: { b: { c: 'hello' } } });
  });

  it('handles deeply nested paths', () => {
    const obj = { directDeposit: { routingNumber: '111', accountNumber: '222' } };
    const result = setDeepPath(obj, 'directDeposit.routingNumber', '999');
    expect(result.directDeposit.routingNumber).toBe('999');
    expect(result.directDeposit.accountNumber).toBe('222');
  });

  it('overwrites non-object intermediate with new object', () => {
    const obj = { a: 'string-value' } as Record<string, unknown>;
    const result = setDeepPath(obj, 'a.b', 10);
    expect(result).toEqual({ a: { b: 10 } });
  });

  it('handles null intermediary', () => {
    const obj = { a: null } as Record<string, unknown>;
    const result = setDeepPath(obj, 'a.b', 'val');
    expect(result).toEqual({ a: { b: 'val' } });
  });
});

// ─── classifyField ───────────────────────────────────────────────

describe('classifyField', () => {
  it('marks calculationResult fields as read-only', () => {
    const mapping: IRSFieldMapping = {
      pdfFieldName: 'test',
      sourcePath: 'form1040.totalWages',
      source: 'calculationResult',
      format: 'dollarNoCents',
    };
    const result = classifyField(mapping);
    expect(result.isEditable).toBe(false);
    expect(result.readOnlyReason).toBe('Computed by tax engine');
  });

  it('marks simple taxReturn path fields as editable', () => {
    const mapping: IRSFieldMapping = {
      pdfFieldName: 'test',
      sourcePath: 'firstName',
      source: 'taxReturn',
      format: 'string',
    };
    const result = classifyField(mapping);
    expect(result.isEditable).toBe(true);
    expect(result.writePath).toBe('firstName');
  });

  it('marks transform-only fields as read-only', () => {
    const mapping: IRSFieldMapping = {
      pdfFieldName: 'test',
      sourcePath: '',
      source: 'taxReturn',
      format: 'string',
      transform: (tr) => `${tr.firstName} ${tr.lastName}`,
    };
    const result = classifyField(mapping);
    expect(result.isEditable).toBe(false);
    expect(result.readOnlyReason).toBe('Derived from multiple fields');
  });

  it('marks transform+inverseTransform fields as editable', () => {
    const mapping: IRSFieldMapping = {
      pdfFieldName: 'test',
      sourcePath: '',
      source: 'taxReturn',
      format: 'dollarNoCents',
      transform: (tr) => String(tr.itemizedDeductions?.medicalExpenses || 0),
      inverseTransform: (v) => ({ medicalExpenses: Number(v) }),
    };
    const result = classifyField(mapping);
    expect(result.isEditable).toBe(true);
  });

  it('respects explicit editable: true override', () => {
    const mapping: IRSFieldMapping = {
      pdfFieldName: 'test',
      sourcePath: 'firstName',
      source: 'taxReturn',
      format: 'string',
      editable: true,
    };
    const result = classifyField(mapping);
    expect(result.isEditable).toBe(true);
  });

  it('explicit editable:true overrides calculationResult source', () => {
    const mapping: IRSFieldMapping = {
      pdfFieldName: 'test',
      sourcePath: 'form1040.agi',
      source: 'calculationResult',
      format: 'dollarNoCents',
      editable: true,
    };
    // Even calculationResult can be forced editable (edge case for custom overrides)
    const result = classifyField(mapping);
    expect(result.isEditable).toBe(true);
  });
});

// ─── classifyFields (batch) ──────────────────────────────────────

describe('classifyFields', () => {
  it('classifies all fields in an array', () => {
    const mappings: IRSFieldMapping[] = [
      { pdfFieldName: 'a', sourcePath: 'firstName', source: 'taxReturn', format: 'string' },
      { pdfFieldName: 'b', sourcePath: 'form1040.agi', source: 'calculationResult', format: 'dollarNoCents' },
    ];
    const results = classifyFields(mappings);
    expect(results).toHaveLength(2);
    expect(results[0].isEditable).toBe(true);
    expect(results[1].isEditable).toBe(false);
  });
});

// ─── Form 1040 field editability ─────────────────────────────────

describe('Form 1040 field classification', () => {
  const classified = classifyFields(FORM_1040_FIELDS);
  const editable = classified.filter(f => f.isEditable);
  const readOnly = classified.filter(f => !f.isEditable);

  it('has expected editable field count (approx 15-40)', () => {
    // Personal info + address + IP PINs + combat pay + combat zone
    expect(editable.length).toBeGreaterThanOrEqual(10);
    expect(editable.length).toBeLessThanOrEqual(40);
  });

  it('marks firstName as editable', () => {
    const firstNameField = classified.find(f => f.mapping.sourcePath === 'firstName');
    expect(firstNameField?.isEditable).toBe(true);
    expect(firstNameField?.writePath).toBe('firstName');
  });

  it('marks totalWages as read-only', () => {
    const wagesField = classified.find(f => f.mapping.sourcePath === 'form1040.totalWages');
    expect(wagesField?.isEditable).toBe(false);
  });

  it('marks AGI as read-only', () => {
    const agiField = classified.find(f => f.mapping.sourcePath === 'form1040.agi');
    expect(agiField?.isEditable).toBe(false);
  });

  it('all calculationResult fields are read-only', () => {
    const calcFields = classified.filter(f => f.mapping.source === 'calculationResult');
    expect(calcFields.every(f => !f.isEditable || f.mapping.editable === true)).toBe(true);
  });
});

// ─── Schedule A field editability ────────────────────────────────

describe('Schedule A field classification', () => {
  const classified = classifyFields(SCHEDULE_A_FIELDS);
  const editable = classified.filter(f => f.isEditable);

  it('has expected editable field count (~10)', () => {
    expect(editable.length).toBeGreaterThanOrEqual(8);
    expect(editable.length).toBeLessThanOrEqual(15);
  });

  it('medical expenses field is editable', () => {
    const medical = classified.find(f => f.mapping.formLabel?.includes('Medical'));
    expect(medical?.isEditable).toBe(true);
  });

  it('total itemized deductions is read-only', () => {
    const total = classified.find(f => f.mapping.pdfFieldName.includes('f1_27'));
    expect(total?.isEditable).toBe(false);
  });
});
