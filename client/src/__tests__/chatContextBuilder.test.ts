/**
 * Chat Context Builder Unit Tests
 *
 * Verifies that the context builder:
 * - Produces PII-safe context (no names, SSN, addresses, DOB)
 * - Correctly counts income items by type
 * - Maps filing status enums to string labels
 * - Handles null/empty returns gracefully
 */

import { describe, it, expect } from 'vitest';
import { buildChatContext } from '../services/chatContextBuilder';
import type { TaxReturn } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';

// ─── Helpers ──────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return-123',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'my_info',
    firstName: 'John',
    lastName: 'Doe',
    ssnLastFour: '1234',
    dateOfBirth: '1990-05-15',
    addressStreet: '123 Main St',
    addressCity: 'Springfield',
    addressState: 'IL',
    addressZip: '62704',
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
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    income1099C: [],
    income1099Q: [],
    rentalProperties: [],
    otherIncome: 0,
    businesses: [],
    expenses: [],
    educationCredits: [],
    deductionMethod: 'standard',
    incomeDiscovery: {},
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as TaxReturn;
}

// ═══════════════════════════════════════════════════
// PII EXCLUSION
// ═══════════════════════════════════════════════════

describe('PII exclusion', () => {
  it('never includes names in the context', () => {
    const tr = makeTaxReturn({
      firstName: 'Jane',
      lastName: 'Smith',
      spouseFirstName: 'Bob',
      spouseLastName: 'Smith',
    });
    const ctx = buildChatContext(tr, 'personal_info', 'my_info');
    const json = JSON.stringify(ctx);

    expect(json).not.toContain('Jane');
    expect(json).not.toContain('Smith');
    expect(json).not.toContain('Bob');
  });

  it('never includes SSN in the context', () => {
    const tr = makeTaxReturn({ ssnLastFour: '9876' });
    const ctx = buildChatContext(tr, 'personal_info', 'my_info');
    const json = JSON.stringify(ctx);

    expect(json).not.toContain('9876');
    expect(json).not.toContain('ssn');
  });

  it('never includes addresses in the context', () => {
    const tr = makeTaxReturn({
      addressStreet: '456 Oak Ave',
      addressCity: 'Chicago',
      addressState: 'IL',
      addressZip: '60601',
    });
    const ctx = buildChatContext(tr, 'personal_info', 'my_info');
    const json = JSON.stringify(ctx);

    expect(json).not.toContain('456 Oak Ave');
    expect(json).not.toContain('Chicago');
    expect(json).not.toContain('60601');
  });

  it('never includes date of birth in the context', () => {
    const tr = makeTaxReturn({ dateOfBirth: '1985-03-20' });
    const ctx = buildChatContext(tr, 'personal_info', 'my_info');
    const json = JSON.stringify(ctx);

    expect(json).not.toContain('1985-03-20');
    expect(json).not.toContain('dateOfBirth');
  });

  it('never includes individual dollar amounts', () => {
    const tr = makeTaxReturn({
      w2Income: [
        { id: '1', employerName: 'Acme Corp', wages: 75000, federalTaxWithheld: 12000 } as any,
      ],
    });
    const ctx = buildChatContext(tr, 'w2_income', 'income');
    const json = JSON.stringify(ctx);

    expect(json).not.toContain('75000');
    expect(json).not.toContain('12000');
    expect(json).not.toContain('Acme');
  });
});

// ═══════════════════════════════════════════════════
// FILING STATUS MAPPING
// ═══════════════════════════════════════════════════

describe('Filing status mapping', () => {
  it('maps Single correctly', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.Single });
    const ctx = buildChatContext(tr, 'filing_status', 'my_info');
    expect(ctx.filingStatus).toBe('single');
  });

  it('maps Married Filing Jointly correctly', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.MarriedFilingJointly });
    const ctx = buildChatContext(tr, 'filing_status', 'my_info');
    expect(ctx.filingStatus).toBe('married_filing_jointly');
  });

  it('maps Married Filing Separately correctly', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.MarriedFilingSeparately });
    const ctx = buildChatContext(tr, 'filing_status', 'my_info');
    expect(ctx.filingStatus).toBe('married_filing_separately');
  });

  it('maps Head of Household correctly', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.HeadOfHousehold });
    const ctx = buildChatContext(tr, 'filing_status', 'my_info');
    expect(ctx.filingStatus).toBe('head_of_household');
  });

  it('maps Qualifying Surviving Spouse correctly', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.QualifyingSurvivingSpouse });
    const ctx = buildChatContext(tr, 'filing_status', 'my_info');
    expect(ctx.filingStatus).toBe('qualifying_surviving_spouse');
  });

  it('returns undefined when filing status is not set', () => {
    const tr = makeTaxReturn({ filingStatus: undefined });
    const ctx = buildChatContext(tr, 'filing_status', 'my_info');
    expect(ctx.filingStatus).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════
// INCOME TYPE COUNTS
// ═══════════════════════════════════════════════════

describe('Income type counts', () => {
  it('counts W-2s correctly', () => {
    const tr = makeTaxReturn({
      w2Income: [
        { id: '1', employerName: 'A', wages: 50000, federalTaxWithheld: 5000 } as any,
        { id: '2', employerName: 'B', wages: 30000, federalTaxWithheld: 3000 } as any,
      ],
    });
    const ctx = buildChatContext(tr, 'w2_income', 'income');
    expect(ctx.incomeTypeCounts.w2).toBe(2);
  });

  it('counts multiple income types correctly', () => {
    const tr = makeTaxReturn({
      w2Income: [{ id: '1' } as any],
      income1099NEC: [{ id: '1' } as any, { id: '2' } as any],
      income1099INT: [{ id: '1' } as any],
      income1099B: [{ id: '1' } as any, { id: '2' } as any, { id: '3' } as any],
    });
    const ctx = buildChatContext(tr, 'income_overview', 'income');

    expect(ctx.incomeTypeCounts.w2).toBe(1);
    expect(ctx.incomeTypeCounts['1099nec']).toBe(2);
    expect(ctx.incomeTypeCounts['1099int']).toBe(1);
    expect(ctx.incomeTypeCounts['1099b']).toBe(3);
  });

  it('returns zero for empty income arrays', () => {
    const tr = makeTaxReturn();
    const ctx = buildChatContext(tr, 'income_overview', 'income');

    expect(ctx.incomeTypeCounts.w2).toBe(0);
    expect(ctx.incomeTypeCounts['1099nec']).toBe(0);
    expect(ctx.incomeTypeCounts['1099div']).toBe(0);
  });

  it('counts dependents correctly (count only, no details)', () => {
    const tr = makeTaxReturn({
      dependents: [
        { id: '1', firstName: 'Alice', lastName: 'Doe', relationship: 'child', monthsLivedWithYou: 12 } as any,
        { id: '2', firstName: 'Bob', lastName: 'Doe', relationship: 'child', monthsLivedWithYou: 12 } as any,
      ],
    });
    const ctx = buildChatContext(tr, 'dependents', 'my_info');

    expect(ctx.dependentCount).toBe(2);
    // Verify no dependent names leaked
    const json = JSON.stringify(ctx);
    expect(json).not.toContain('Alice');
    expect(json).not.toContain('Bob');
    expect(json).not.toContain('Doe');
  });
});

// ═══════════════════════════════════════════════════
// STEP & SECTION CONTEXT
// ═══════════════════════════════════════════════════

describe('Step and section context', () => {
  it('passes through currentStep and currentSection', () => {
    const tr = makeTaxReturn();
    const ctx = buildChatContext(tr, 'w2_income', 'income');

    expect(ctx.currentStep).toBe('w2_income');
    expect(ctx.currentSection).toBe('income');
  });

  it('includes income discovery flags', () => {
    const tr = makeTaxReturn({
      incomeDiscovery: {
        w2: 'yes',
        '1099nec': 'no',
        '1099int': 'yes',
      },
    });
    const ctx = buildChatContext(tr, 'income_overview', 'income');

    expect(ctx.incomeDiscovery).toEqual({
      w2: 'yes',
      '1099nec': 'no',
      '1099int': 'yes',
    });
  });

  it('includes deduction method when set', () => {
    const tr = makeTaxReturn({ deductionMethod: 'itemized' });
    const ctx = buildChatContext(tr, 'deduction_method', 'deductions');

    expect(ctx.deductionMethod).toBe('itemized');
  });
});

// ═══════════════════════════════════════════════════
// NULL / EMPTY HANDLING
// ═══════════════════════════════════════════════════

describe('Null and empty handling', () => {
  it('returns safe defaults for null taxReturn', () => {
    const ctx = buildChatContext(null, 'welcome', 'my_info');

    expect(ctx.currentStep).toBe('welcome');
    expect(ctx.currentSection).toBe('my_info');
    expect(ctx.filingStatus).toBeUndefined();
    expect(ctx.incomeDiscovery).toEqual({});
    expect(ctx.dependentCount).toBe(0);
    expect(ctx.incomeTypeCounts).toEqual({});
  });

  it('handles missing optional fields gracefully', () => {
    // A return with minimal data (no filingStatus, no dependents, no income)
    const tr = makeTaxReturn({
      filingStatus: undefined,
      deductionMethod: 'standard',
      dependents: [],
      w2Income: [],
    });
    const ctx = buildChatContext(tr, 'welcome', 'my_info');

    expect(ctx.filingStatus).toBeUndefined();
    expect(ctx.deductionMethod).toBe('standard');
    expect(ctx.dependentCount).toBe(0);
    expect(ctx.incomeTypeCounts.w2).toBe(0);
  });
});
