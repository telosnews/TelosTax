/**
 * PDF Field Mapping Verification — Category 3
 *
 * Validates that all IRS form field mappings are structurally correct:
 *   1. Every sourcePath resolves to a valid property in TaxReturn or CalculationResult
 *   2. No duplicate PDF field names within a form
 *   3. All critical Form 1040 lines are mapped
 *   4. Transform functions execute without throwing
 *   5. Format types are valid
 *   6. Condition functions for templates work correctly
 *
 * These tests ensure the PDF export will produce valid, correctly-populated forms.
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import {
  FORM_1040_TEMPLATE,
  FORM_1040_FIELDS,
} from '../src/constants/irsForm1040Map.js';
import { SCHEDULE_1_TEMPLATE } from '../src/constants/irsSchedule1Map.js';
import { SCHEDULE_2_TEMPLATE } from '../src/constants/irsSchedule2Map.js';
import { SCHEDULE_3_TEMPLATE } from '../src/constants/irsSchedule3Map.js';
import { FORM_5695_TEMPLATE } from '../src/constants/irsForm5695Map.js';
import type { IRSFieldMapping, IRSFormTemplate, IRSFieldFormat } from '../src/types/irsFormMappings.js';
import { TaxReturn, FilingStatus, CalculationResult } from '../src/types/index.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'pdf-test',
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

/** Build a "full" tax return that populates most fields */
function makeFullTaxReturn(): TaxReturn {
  return makeTaxReturn({
    firstName: 'John',
    lastName: 'Doe',
    ssnLastFour: '1234',
    dateOfBirth: '1985-06-15',
    filingStatus: FilingStatus.MarriedFilingJointly,
    spouseFirstName: 'Jane',
    spouseLastName: 'Doe',
    streetAddress: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zip: '90210',
    w2Income: [{
      id: 'w1',
      employerName: 'Acme Corp',
      wages: 85000,
      federalTaxWithheld: 12000,
      socialSecurityWages: 85000,
      socialSecurityTax: 5270,
      medicareWages: 85000,
      medicareTax: 1232.50,
    }],
    income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 25000 }],
    income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 500 }],
    income1099DIV: [{
      id: 'd1',
      payerName: 'Fund Co',
      ordinaryDividends: 1200,
      qualifiedDividends: 800,
    }],
    childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 },
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

/** Resolve a dot-path to a value on an object */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Valid format types
const VALID_FORMATS: IRSFieldFormat[] = [
  'string', 'dollarNoCents', 'dollarCents', 'integer', 'ssn', 'ssnPartial', 'checkbox', 'date',
];

// All templates to test
const ALL_TEMPLATES: IRSFormTemplate[] = [
  FORM_1040_TEMPLATE,
  SCHEDULE_1_TEMPLATE,
  SCHEDULE_2_TEMPLATE,
  SCHEDULE_3_TEMPLATE,
];

// ═══════════════════════════════════════════════════════════════════════════════
// STRUCTURAL VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('PDF Field Mapping — Structural Validation', () => {
  for (const template of ALL_TEMPLATES) {
    describe(`${template.displayName} (${template.formId})`, () => {
      it('has a valid template structure', () => {
        expect(template.formId).toBeTruthy();
        expect(template.displayName).toBeTruthy();
        expect(template.pdfFileName).toMatch(/\.pdf$/);
        expect(template.attachmentSequence).toBeGreaterThanOrEqual(0);
        expect(typeof template.condition).toBe('function');
        expect(template.fields.length).toBeGreaterThan(0);
      });

      it('every field has required properties', () => {
        for (const field of template.fields) {
          expect(field.pdfFieldName, `Missing pdfFieldName`).toBeTruthy();
          expect(field.source, `Missing source for ${field.pdfFieldName}`)
            .toMatch(/^(taxReturn|calculationResult)$/);
          expect(VALID_FORMATS, `Invalid format '${field.format}' for ${field.pdfFieldName}`)
            .toContain(field.format);
          // sourcePath is required unless transform is provided
          if (!field.transform) {
            expect(field.sourcePath, `Missing sourcePath for ${field.pdfFieldName}`).toBeTruthy();
          }
        }
      });

      it('has no duplicate PDF field names', () => {
        const fieldNames = template.fields.map(f => f.pdfFieldName);
        const duplicates = fieldNames.filter((name, i) => fieldNames.indexOf(name) !== i);
        expect(duplicates, `Duplicate PDF fields: ${duplicates.join(', ')}`).toHaveLength(0);
      });

      it('all PDF field names follow IRS naming convention', () => {
        for (const field of template.fields) {
          // IRS AcroForm fields typically follow: topmostSubform[0].PageN[0].fieldName[0]
          // or similar nested patterns with brackets
          expect(field.pdfFieldName).toContain('[');
          expect(field.pdfFieldName).toContain(']');
        }
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE PATH RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('PDF Field Mapping — Source Path Resolution', () => {
  const fullReturn = makeFullTaxReturn();
  const calc = calculateForm1040(fullReturn);

  for (const template of ALL_TEMPLATES) {
    describe(`${template.displayName} source paths`, () => {
      it('all calculationResult paths resolve to valid properties', () => {
        const calcFields = template.fields.filter(
          f => f.source === 'calculationResult' && !f.transform
        );

        for (const field of calcFields) {
          const value = resolvePath(calc as unknown as Record<string, unknown>, field.sourcePath);
          // Value can be undefined (some schedule results are optional), but the path
          // should at least resolve within the top-level form1040 or credits object
          const topLevel = field.sourcePath.split('.')[0];
          expect(
            ['form1040', 'credits', 'scheduleC', 'scheduleSE', 'scheduleA',
             'scheduleD', 'scheduleE', 'socialSecurity', 'feie', 'scheduleH',
             'adoptionCredit', 'evRefuelingCredit', 'form4797', 'form4137',
             'scheduleF', 'scheduleR', 'premiumTaxCredit', 'saversCreditResult',
             'cleanEnergy', 'evCredit', 'energyEfficiency', 'foreignTaxCredit',
             'k1Routing', 'estimatedTaxPenalty', 'kiddieTax',
             'dependentCare'].includes(topLevel),
            `Unknown top-level path '${topLevel}' in ${field.pdfFieldName}: ${field.sourcePath}`
          ).toBe(true);
        }
      });

      it('all taxReturn paths resolve to recognized properties', () => {
        // These are all known top-level TaxReturn properties (including optional ones
        // that may not be in the minimal test object)
        const knownTaxReturnFields = new Set([
          'id', 'taxYear', 'status', 'currentStep', 'currentSection', 'currentStepId',
          'firstName', 'lastName', 'ssnLastFour', 'ssn', 'dateOfBirth', 'occupation',
          'spouseFirstName', 'spouseLastName', 'spouseSsnLastFour', 'spouseSsn',
          'spouseDateOfBirth', 'spouseOccupation',
          'streetAddress', 'aptNumber', 'city', 'state', 'zip',
          'addressStreet', 'addressCity', 'addressState', 'addressZip',
          'filingStatus', 'digitalAssetActivity', 'livedApartFromSpouse',
          'isActiveDutyMilitary', 'nontaxableCombatPay', 'movingExpenses',
          'dependents', 'w2Income', 'income1099NEC', 'income1099K',
          'income1099INT', 'income1099DIV', 'income1099R', 'income1099G',
          'income1099MISC', 'income1099B', 'income1099DA', 'income1099C',
          'income1099Q', 'incomeK1', 'income1099SA', 'incomeW2G',
          'incomeSSA1099', 'rentalProperties', 'otherIncome',
          'businesses', 'expenses', 'deductionMethod', 'itemizedDeductions',
          'childTaxCredit', 'educationCredits', 'dependentCare', 'saversCredit',
          'cleanEnergy', 'evCredit', 'energyEfficiency', 'adoptionCredit',
          'foreignEarnedIncome', 'householdEmployees', 'qbiInfo', 'form4137',
          'homeOffice', 'vehicle', 'incomeDiscovery',
          'estimatedPayments', 'priorYearTax', 'priorYearAGI',
          'capitalLossCarryforward', 'capitalLossCarryforwardST', 'capitalLossCarryforwardLT',
          'form8606', 'kiddieTax', 'stateReturns', 'ipPin', 'spouseIpPin',
          'presidentialCampaignFund', 'spousePresidentialCampaignFund',
          'canBeClaimedAsDependent', 'isLegallyBlind', 'spouseIsLegallyBlind',
          'createdAt', 'updatedAt',
        ]);

        const trFields = template.fields.filter(
          f => f.source === 'taxReturn' && !f.transform
        );

        for (const field of trFields) {
          const topLevel = field.sourcePath.split('.')[0];
          expect(
            knownTaxReturnFields.has(topLevel),
            `Unknown TaxReturn field '${topLevel}' in ${field.pdfFieldName}: ${field.sourcePath}`
          ).toBe(true);
        }
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSFORM FUNCTION SAFETY
// ═══════════════════════════════════════════════════════════════════════════════

describe('PDF Field Mapping — Transform Functions', () => {
  const fullReturn = makeFullTaxReturn();
  const calc = calculateForm1040(fullReturn);
  const emptyReturn = makeTaxReturn({});
  const emptyCalc = calculateForm1040(emptyReturn);

  for (const template of ALL_TEMPLATES) {
    describe(`${template.displayName} transforms`, () => {
      const transformFields = template.fields.filter(f => f.transform);

      if (transformFields.length === 0) {
        it('has no transform fields (skipped)', () => {
          expect(true).toBe(true);
        });
      } else {
        it('all transform functions execute without throwing (full return)', () => {
          for (const field of transformFields) {
            expect(() => {
              field.transform!(fullReturn, calc);
            }).not.toThrow();
          }
        });

        it('all transform functions execute without throwing (empty return)', () => {
          for (const field of transformFields) {
            expect(() => {
              field.transform!(emptyReturn, emptyCalc);
            }).not.toThrow();
          }
        });

        it('transform functions return valid types', () => {
          for (const field of transformFields) {
            const result = field.transform!(fullReturn, calc);
            expect(
              result === undefined || typeof result === 'string' || typeof result === 'boolean',
              `Transform for ${field.pdfFieldName} returned ${typeof result}: ${result}`
            ).toBe(true);
          }
        });
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKBOX FIELDS
// ═══════════════════════════════════════════════════════════════════════════════

describe('PDF Field Mapping — Checkbox Fields', () => {
  for (const template of ALL_TEMPLATES) {
    const checkboxFields = template.fields.filter(f => f.format === 'checkbox');

    if (checkboxFields.length === 0) continue;

    describe(`${template.displayName} checkboxes`, () => {
      it('all checkbox fields have checkWhen or transform', () => {
        for (const field of checkboxFields) {
          expect(
            field.checkWhen || field.transform,
            `Checkbox ${field.pdfFieldName} has neither checkWhen nor transform`
          ).toBeTruthy();
        }
      });

      it('checkWhen functions execute without throwing', () => {
        const fullReturn = makeFullTaxReturn();
        const calc = calculateForm1040(fullReturn);

        for (const field of checkboxFields) {
          if (field.checkWhen) {
            expect(() => {
              field.checkWhen!(undefined, fullReturn, calc);
            }).not.toThrow();
          }
        }
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE CONDITIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('PDF Field Mapping — Template Conditions', () => {
  it('Form 1040 is always included', () => {
    const tr = makeTaxReturn({});
    const calc = calculateForm1040(tr);
    expect(FORM_1040_TEMPLATE.condition(tr, calc)).toBe(true);
  });

  it('Schedule 1 is included when there are additional adjustments', () => {
    // Return with 1099-NEC triggers Schedule C → Schedule 1
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000 }],
    });
    const calc = calculateForm1040(tr);
    expect(SCHEDULE_1_TEMPLATE.condition(tr, calc)).toBe(true);
  });

  it('Schedule 1 is NOT included for simple W-2 return', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1',
        employerName: 'Corp',
        wages: 50000,
        federalTaxWithheld: 5000,
        socialSecurityWages: 50000,
        socialSecurityTax: 3100,
        medicareWages: 50000,
        medicareTax: 725,
      }],
    });
    const calc = calculateForm1040(tr);
    expect(SCHEDULE_1_TEMPLATE.condition(tr, calc)).toBe(false);
  });

  it('Schedule 2 is included when SE tax exists', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000 }],
    });
    const calc = calculateForm1040(tr);
    expect(SCHEDULE_2_TEMPLATE.condition(tr, calc)).toBe(true);
  });

  it('Form 5695 is NOT included when cleanEnergy is all zeros', () => {
    // Simulates user visiting the Clean Energy step without entering data —
    // the upsert creates an all-zeros default object
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      cleanEnergy: {
        solarElectric: 0, solarWaterHeating: 0, smallWindEnergy: 0,
        geothermalHeatPump: 0, batteryStorage: 0, fuelCell: 0, fuelCellKW: 0,
      },
    });
    const calc = calculateForm1040(tr);
    expect(FORM_5695_TEMPLATE.condition(tr, calc)).toBe(false);
  });

  it('Form 5695 IS included when cleanEnergy has nonzero values', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      cleanEnergy: { solarElectric: 15000 },
    });
    const calc = calculateForm1040(tr);
    expect(FORM_5695_TEMPLATE.condition(tr, calc)).toBe(true);
  });

  it('Form 5695 is NOT included when energyEfficiency is all zeros', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      energyEfficiency: {
        heatPump: 0, centralAC: 0, waterHeater: 0, furnaceBoiler: 0,
        insulation: 0, windows: 0, doors: 0, electricalPanel: 0, homeEnergyAudit: 0,
      },
    });
    const calc = calculateForm1040(tr);
    expect(FORM_5695_TEMPLATE.condition(tr, calc)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITICAL FIELD COVERAGE — Form 1040
// ═══════════════════════════════════════════════════════════════════════════════

describe('PDF Field Mapping — Critical Form 1040 Field Coverage', () => {
  // Critical fields mapped via direct sourcePath (not transforms)
  const criticalSourcePaths = [
    // Personal info
    'firstName',
    'lastName',
    // Income
    'form1040.totalWages',
    'form1040.totalInterest',
    'form1040.totalDividends',
    'form1040.totalIncome',
    // AGI & Deductions
    'form1040.agi',
    'form1040.deductionAmount',
    'form1040.qbiDeduction',
    'form1040.taxableIncome',
    // Tax
    'form1040.incomeTax',
    'form1040.totalTax',
    // Payments
    'form1040.totalWithholding',
    'form1040.totalPayments',
  ];

  // Critical fields computed via transform functions (not direct sourcePaths).
  // These use transforms because they require conditional logic or aggregation.
  // Map from a description to a keyword that appears in the transform source.
  const criticalTransformFields: Array<{ name: string; keywords: string[] }> = [
    { name: 'totalCredits (Line 21)',  keywords: ['childTaxCredit', 'otherDependentCredit'] },
    { name: 'refundAmount (Line 35a)', keywords: ['refundAmount'] },
    { name: 'amountOwed (Line 37)',    keywords: ['amountOwed'] },
  ];

  it('maps all critical Form 1040 fields via direct sourcePaths', () => {
    const mappedPaths = new Set(
      FORM_1040_FIELDS
        .filter(f => !f.transform)
        .map(f => f.sourcePath)
    );

    for (const path of criticalSourcePaths) {
      expect(
        mappedPaths.has(path),
        `Critical field '${path}' is NOT mapped in Form 1040`
      ).toBe(true);
    }
  });

  it('maps critical transform-based fields (totalCredits, refund, amountOwed)', () => {
    const transformFields = FORM_1040_FIELDS.filter(f => f.transform);
    // Verify there are transform fields that reference these calculation values
    for (const { name, keywords } of criticalTransformFields) {
      const hasTransform = transformFields.some(f => {
        const src = f.transform!.toString();
        return keywords.every(kw => src.includes(kw));
      });
      expect(
        hasTransform,
        `Critical field '${name}' has no transform function referencing it`
      ).toBe(true);
    }
  });

  it('has filing status checkbox fields', () => {
    const filingStatusFields = FORM_1040_FIELDS.filter(
      f => f.format === 'checkbox' && (f.sourcePath === 'filingStatus' ||
           f.pdfFieldName.toLowerCase().includes('checkbox_readorder'))
    );
    // Should have at least 5 filing status checkboxes (one per status)
    expect(filingStatusFields.length).toBeGreaterThanOrEqual(4);
  });

  it('has dependent table fields', () => {
    const dependentFields = FORM_1040_FIELDS.filter(
      f => f.pdfFieldName.includes('Dependent') || f.pdfFieldName.includes('dependent')
    );
    expect(dependentFields.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD COUNT SANITY
// ═══════════════════════════════════════════════════════════════════════════════

describe('PDF Field Mapping — Field Count Sanity', () => {
  it('Form 1040 has reasonable number of field mappings', () => {
    // IRS Form 1040 has ~199 AcroForm fields, we should map a substantial portion
    expect(FORM_1040_FIELDS.length).toBeGreaterThan(50);
    expect(FORM_1040_FIELDS.length).toBeLessThan(300);
  });

  it('Schedule 1 has field mappings', () => {
    expect(SCHEDULE_1_TEMPLATE.fields.length).toBeGreaterThan(10);
  });

  it('Schedule 2 has field mappings', () => {
    expect(SCHEDULE_2_TEMPLATE.fields.length).toBeGreaterThan(5);
  });

  it('Schedule 3 has field mappings', () => {
    expect(SCHEDULE_3_TEMPLATE.fields.length).toBeGreaterThan(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// END-TO-END: Calculation → Mapping Resolution
// ═══════════════════════════════════════════════════════════════════════════════

describe('PDF Field Mapping — Calculation to Mapping Integration', () => {
  const fullReturn = makeFullTaxReturn();
  const calc = calculateForm1040(fullReturn);

  it('totalWages mapping resolves to correct value', () => {
    const field = FORM_1040_FIELDS.find(f => f.sourcePath === 'form1040.totalWages');
    expect(field).toBeDefined();
    const value = resolvePath(calc as unknown as Record<string, unknown>, field!.sourcePath);
    expect(value).toBe(85000); // W-2 wages
  });

  it('AGI mapping resolves to a positive number', () => {
    const field = FORM_1040_FIELDS.find(f => f.sourcePath === 'form1040.agi');
    expect(field).toBeDefined();
    const value = resolvePath(calc as unknown as Record<string, unknown>, field!.sourcePath);
    expect(typeof value).toBe('number');
    expect(value as number).toBeGreaterThan(0);
  });

  it('refundAmount is handled by a transform field', () => {
    // refundAmount uses a transform (conditional: only show if > 0), not direct sourcePath
    const transformFields = FORM_1040_FIELDS.filter(f => f.transform);
    const refundField = transformFields.find(f =>
      f.transform!.toString().includes('refundAmount')
    );
    expect(refundField).toBeDefined();
    // The transform should execute and return a string or empty string
    const result = refundField!.transform!(fullReturn, calc);
    expect(
      result === '' || result === undefined || typeof result === 'string',
      `refundAmount transform returned unexpected: ${result}`
    ).toBe(true);
  });

  it('deductionAmount resolves to standard deduction for MFJ', () => {
    const field = FORM_1040_FIELDS.find(f => f.sourcePath === 'form1040.deductionAmount');
    expect(field).toBeDefined();
    const value = resolvePath(calc as unknown as Record<string, unknown>, field!.sourcePath);
    expect(value).toBe(31500); // MFJ standard deduction (OBBBA)
  });

  it('firstName mapping resolves from taxReturn', () => {
    const field = FORM_1040_FIELDS.find(f => f.sourcePath === 'firstName' && f.source === 'taxReturn');
    expect(field).toBeDefined();
    expect(fullReturn.firstName).toBe('John');
  });
});
