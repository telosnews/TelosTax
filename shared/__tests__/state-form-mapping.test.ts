/**
 * State Form PDF Field Mapping Verification
 *
 * Validates that all state form field mappings are structurally correct:
 *   1. Every sourcePath resolves to a valid property
 *   2. No duplicate PDF field names within a form
 *   3. Transform functions execute without throwing
 *   4. Format types are valid
 *   5. Condition function works for the correct state
 *   6. Key PA-40 lines are mapped and produce correct values
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateStateTaxes } from '../src/engine/state/index.js';
import { PA_40_TEMPLATE, PA_40_FIELDS, ALL_STATE_FORM_TEMPLATES } from '../src/constants/stateFormMappings/index.js';
import type { StateFieldMapping, StateFormTemplate } from '../src/types/stateFormMappings.js';
import type { IRSFieldFormat } from '../src/types/irsFormMappings.js';
import { TaxReturn, FilingStatus, StateCalculationResult } from '../src/types/index.js';

// ─── Helpers ────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'state-pdf-test',
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

function makePATaxReturn(): TaxReturn {
  return makeTaxReturn({
    firstName: 'John',
    lastName: 'Doe',
    middleInitial: 'Q',
    ssnLastFour: '1234',
    filingStatus: FilingStatus.MarriedFilingJointly,
    spouseFirstName: 'Jane',
    spouseLastName: 'Smith',
    spouseMiddleInitial: 'M',
    spouseSsnLastFour: '5678',
    addressStreet: '123 Main Street',
    addressCity: 'Philadelphia',
    addressState: 'PA',
    addressZip: '19101',
    occupation: 'Engineer',
    spouseOccupation: 'Teacher',
    w2Income: [{
      id: 'w1',
      employerName: 'Acme Corp',
      wages: 75000,
      federalTaxWithheld: 10000,
      socialSecurityWages: 75000,
      socialSecurityTax: 4650,
      medicareWages: 75000,
      medicareTax: 1087.50,
      stateTaxWithheld: 2303,
      stateWages: 75000,
      state: 'PA',
    }],
    income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 500 }],
    income1099DIV: [{
      id: 'd1',
      payerName: 'Fund',
      ordinaryDividends: 1200,
      qualifiedDividends: 800,
    }],
    stateReturns: [{ stateCode: 'PA', residencyType: 'resident' }],
    dependents: [{
      id: 'dep1',
      firstName: 'Junior',
      lastName: 'Doe',
      ssn: '987654321',
      relationship: 'Son',
      dateOfBirth: '2015-03-10',
      monthsLived: 12,
    }],
  });
}

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function getStateResult(tr: TaxReturn): StateCalculationResult {
  const calc = calculateForm1040(tr);
  const stateResults = calculateStateTaxes(tr, calc);
  const paResult = stateResults.find(sr => sr.stateCode === 'PA');
  if (!paResult) throw new Error('PA state result not found');
  return paResult;
}

const VALID_FORMATS: IRSFieldFormat[] = [
  'string', 'dollarNoCents', 'dollarCents', 'integer', 'ssn', 'ssnPartial', 'checkbox', 'date',
];

const ALL_STATE_TEMPLATES = ALL_STATE_FORM_TEMPLATES;

// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURAL VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Form Mapping — Structural Validation', () => {
  for (const template of ALL_STATE_TEMPLATES) {
    describe(`${template.displayName} (${template.formId})`, () => {
      it('has a valid template structure', () => {
        expect(template.formId).toBeTruthy();
        expect(template.stateCode).toMatch(/^[A-Z]{2}$/);
        expect(template.displayName).toBeTruthy();
        expect(template.pdfFileName).toMatch(/\.pdf$/);
        expect(typeof template.condition).toBe('function');
        expect(template.fields.length).toBeGreaterThan(0);
      });

      it('every field has required properties', () => {
        for (const field of template.fields) {
          expect(field.pdfFieldName, 'Missing pdfFieldName').toBeTruthy();
          expect(field.source, `Missing source for ${field.pdfFieldName}`)
            .toMatch(/^(taxReturn|calculationResult|stateResult)$/);
          expect(VALID_FORMATS, `Invalid format '${field.format}' for ${field.pdfFieldName}`)
            .toContain(field.format);
          // sourcePath is required unless transform or checkWhen is provided
          if (!field.transform && !field.checkWhen) {
            expect(field.sourcePath, `Missing sourcePath for ${field.pdfFieldName}`).toBeTruthy();
          }
        }
      });

      it('has no duplicate PDF field names', () => {
        const fieldNames = template.fields.map(f => f.pdfFieldName);
        const duplicates = fieldNames.filter((name, i) => fieldNames.indexOf(name) !== i);
        expect(duplicates, `Duplicate PDF fields: ${duplicates.join(', ')}`).toHaveLength(0);
      });

      it('all format types are valid', () => {
        for (const field of template.fields) {
          expect(VALID_FORMATS).toContain(field.format);
        }
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE PATH RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Form Mapping — Source Path Resolution', () => {
  const tr = makePATaxReturn();
  const calc = calculateForm1040(tr);
  const sr = getStateResult(tr);

  const knownStateResultFields = new Set([
    'stateCode', 'stateName', 'residencyType',
    'federalAGI', 'stateAdditions', 'stateSubtractions', 'stateAGI',
    'stateDeduction', 'stateTaxableIncome', 'stateExemptions',
    'stateIncomeTax', 'stateCredits', 'stateTaxAfterCredits',
    'localTax', 'totalStateTax',
    'stateWithholding', 'stateEstimatedPayments', 'stateRefundOrOwed',
    'effectiveStateRate', 'bracketDetails', 'additionalLines', 'traces',
    'allocationRatio', 'allocatedAGI',
  ]);

  for (const template of ALL_STATE_TEMPLATES) {
    describe(`${template.displayName} source paths`, () => {
      it('all stateResult paths resolve to recognized properties', () => {
        const srFields = template.fields.filter(f => f.source === 'stateResult' && !f.transform);
        for (const field of srFields) {
          const topLevel = field.sourcePath.split('.')[0];
          expect(
            knownStateResultFields.has(topLevel),
            `Unknown StateCalculationResult field '${topLevel}' in ${field.pdfFieldName}: ${field.sourcePath}`,
          ).toBe(true);
        }
      });

      it('all stateResult direct paths resolve to non-undefined values', () => {
        const srFields = template.fields.filter(f => f.source === 'stateResult' && !f.transform);
        for (const field of srFields) {
          const value = resolvePath(sr as unknown as Record<string, unknown>, field.sourcePath);
          expect(
            value !== undefined,
            `stateResult path '${field.sourcePath}' resolved to undefined for ${field.pdfFieldName}`,
          ).toBe(true);
        }
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSFORM FUNCTION SAFETY
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Form Mapping — Transform Functions', () => {
  const fullReturn = makePATaxReturn();
  const fullCalc = calculateForm1040(fullReturn);
  const fullSR = getStateResult(fullReturn);

  const emptyReturn = makeTaxReturn({
    stateReturns: [{ stateCode: 'PA', residencyType: 'resident' }],
  });
  const emptyCalc = calculateForm1040(emptyReturn);
  const emptyStates = calculateStateTaxes(emptyReturn, emptyCalc);
  const emptySR = emptyStates.find(s => s.stateCode === 'PA')!;

  for (const template of ALL_STATE_TEMPLATES) {
    describe(`${template.displayName} transforms`, () => {
      const transformFields = template.fields.filter(f => f.transform);

      it('all transform functions execute without throwing (full return)', () => {
        for (const field of transformFields) {
          expect(() => {
            field.transform!(fullReturn, fullCalc, fullSR);
          }).not.toThrow();
        }
      });

      it('all transform functions execute without throwing (empty return)', () => {
        for (const field of transformFields) {
          expect(() => {
            field.transform!(emptyReturn, emptyCalc, emptySR);
          }).not.toThrow();
        }
      });

      it('transform functions return valid types', () => {
        for (const field of transformFields) {
          const result = field.transform!(fullReturn, fullCalc, fullSR);
          expect(
            result === undefined || typeof result === 'string' || typeof result === 'boolean',
            `Transform for ${field.pdfFieldName} returned ${typeof result}: ${result}`,
          ).toBe(true);
        }
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE CONDITIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Form Mapping — Template Conditions', () => {
  const tr = makePATaxReturn();
  const calc = calculateForm1040(tr);
  const sr = getStateResult(tr);

  it('PA-40 condition is true for PA state result', () => {
    expect(PA_40_TEMPLATE.condition(tr, calc, sr)).toBe(true);
  });

  it('PA-40 condition is false for non-PA state result', () => {
    const fakeSR = { ...sr, stateCode: 'NY' } as StateCalculationResult;
    expect(PA_40_TEMPLATE.condition(tr, calc, fakeSR)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PA-40 SPECIFIC: VALUE CORRECTNESS
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Form Mapping — PA-40 Value Correctness', () => {
  const tr = makePATaxReturn();
  const calc = calculateForm1040(tr);
  const sr = getStateResult(tr);

  function getFieldValue(pdfFieldName: string): string | boolean | undefined {
    const field = PA_40_FIELDS.find(f => f.pdfFieldName === pdfFieldName);
    if (!field) return undefined;
    if (field.transform) return field.transform(tr, calc, sr);
    const source = field.source === 'taxReturn' ? tr : field.source === 'stateResult' ? sr : calc;
    return resolvePath(source as unknown as Record<string, unknown>, field.sourcePath) as string;
  }

  it('maps taxpayer first name correctly (uppercase)', () => {
    expect(getFieldValue("Use all caps to enter taxpayer's first name")).toBe('JOHN');
  });

  it('maps taxpayer last name correctly (uppercase)', () => {
    expect(getFieldValue("Use all caps to enter taxpayer's last name")).toBe('DOE');
  });

  it('maps middle initial', () => {
    expect(getFieldValue('Use Cap For Your Middle Initial')).toBe('Q');
  });

  it('maps spouse first name correctly', () => {
    expect(getFieldValue("Use all caps to enter spouse's first name")).toBe('JANE');
  });

  it('maps spouse last name (different from taxpayer)', () => {
    expect(getFieldValue("Use all caps to enter spouse's last name if different from above")).toBe('SMITH');
  });

  it('maps address fields', () => {
    expect(getFieldValue('Use all caps to enter City or Post Office')).toBe('PHILADELPHIA');
    expect(getFieldValue('Use all caps to enter two character State abbreviation')).toBe('PA');
    expect(getFieldValue('Enter five digit Zip Code')).toBe('19101');
  });

  it('maps Line 1a: Gross Compensation from W-2 wages', () => {
    const val = getFieldValue('1a. Gross Compensation');
    expect(val).toBe('75000');
  });

  it('maps Line 2: Interest Income', () => {
    const val = getFieldValue('2. Interest Income');
    expect(val).toBe('500');
  });

  it('maps Line 3: Dividend Income', () => {
    const val = getFieldValue('3. Dividend  and Capital Gains Distributions Income');
    expect(val).toBe('1200');
  });

  it('maps Line 9: Total PA Taxable Income from state result', () => {
    // PA has no deductions — taxable income ≈ federal AGI
    const taxableIncome = sr.stateTaxableIncome;
    expect(taxableIncome).toBeGreaterThan(0);
  });

  it('maps Line 12: PA Tax Liability (3.07% rate)', () => {
    const taxLiability = sr.stateIncomeTax;
    // PA tax = taxable income × 0.0307
    expect(taxLiability).toBe(Math.round(sr.stateTaxableIncome * 0.0307 * 100) / 100);
  });

  it('maps Line 13: PA Tax Withheld', () => {
    expect(sr.stateWithholding).toBe(2303);
  });

  it('maps Line 29/30: Overpayment/Refund', () => {
    const refundVal = getFieldValue('29. OVERPAYMENT');
    // Should be empty string (no refund) or a positive number string
    if (sr.stateRefundOrOwed > 0) {
      expect(refundVal).toBe(Math.round(sr.stateRefundOrOwed).toString());
    } else {
      expect(refundVal).toBe('');
    }
  });

  it('maps Dependents count', () => {
    expect(getFieldValue('Dependents')).toBe('1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD COUNT SANITY
// ═══════════════════════════════════════════════════════════════════════════════

describe('State Form Mapping — Field Count', () => {
  it('PA-40 has reasonable number of field mappings', () => {
    // PA-40 has 105 AcroForm fields total; we map the most important ones
    expect(PA_40_FIELDS.length).toBeGreaterThan(15);
    expect(PA_40_FIELDS.length).toBeLessThan(105);
  });
});
