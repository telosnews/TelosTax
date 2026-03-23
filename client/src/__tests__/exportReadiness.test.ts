/**
 * Export Readiness Service Unit Tests
 *
 * Tests the pre-export blocker checks that prevent filing
 * incomplete or invalid tax returns.
 */

import { describe, it, expect } from 'vitest';
import type { TaxReturn } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';
import { checkExportReadiness } from '../services/exportReadiness';

// ─── Helpers ─────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return',
    taxYear: 2025,
    status: 'completed',
    currentStep: 0,
    currentSection: 'finish',
    filingStatus: FilingStatus.Single,
    firstName: 'John',
    lastName: 'Doe',
    addressStreet: '123 Main St',
    addressCity: 'Springfield',
    addressState: 'IL',
    addressZip: '62701',
    dependents: [],
    w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 75000, federalTaxWithheld: 12000 }],
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
    rentalProperties: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    businesses: [],
    otherIncome: 0,
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  } as TaxReturn;
}

// ─── Tests ───────────────────────────────────────

describe('checkExportReadiness', () => {
  it('returns ready for a complete minimal return', () => {
    const result = checkExportReadiness(makeTaxReturn());
    expect(result.ready).toBe(true);
    expect(result.blockerCount).toBe(0);
    expect(result.blockers).toHaveLength(0);
  });

  // ── Personal Info blockers ───────────────────────
  describe('personal info', () => {
    it('blocks when first name is missing', () => {
      const result = checkExportReadiness(makeTaxReturn({ firstName: '' }));
      expect(result.ready).toBe(false);
      const b = result.blockers.find(b => b.message.includes('First name'));
      expect(b).toBeDefined();
      expect(b!.stepId).toBe('personal_info');
    });

    it('blocks when first name is whitespace only', () => {
      const result = checkExportReadiness(makeTaxReturn({ firstName: '   ' }));
      expect(result.ready).toBe(false);
      expect(result.blockers.some(b => b.message.includes('First name'))).toBe(true);
    });

    it('blocks when last name is missing', () => {
      const result = checkExportReadiness(makeTaxReturn({ lastName: '' }));
      expect(result.ready).toBe(false);
      expect(result.blockers.some(b => b.message.includes('Last name'))).toBe(true);
    });

    it('blocks when street address is missing', () => {
      const result = checkExportReadiness(makeTaxReturn({ addressStreet: '' }));
      expect(result.ready).toBe(false);
      expect(result.blockers.some(b => b.message.includes('Street address'))).toBe(true);
    });

    it('blocks when city is missing', () => {
      const result = checkExportReadiness(makeTaxReturn({ addressCity: '' }));
      expect(result.ready).toBe(false);
      expect(result.blockers.some(b => b.message.includes('City'))).toBe(true);
    });

    it('blocks when state is missing', () => {
      const result = checkExportReadiness(makeTaxReturn({ addressState: '' }));
      expect(result.ready).toBe(false);
      expect(result.blockers.some(b => b.message.includes('State'))).toBe(true);
    });

    it('blocks when ZIP is missing', () => {
      const result = checkExportReadiness(makeTaxReturn({ addressZip: '' }));
      expect(result.ready).toBe(false);
      expect(result.blockers.some(b => b.message.includes('ZIP'))).toBe(true);
    });

    it('blocks on all missing personal fields (cumulative)', () => {
      const result = checkExportReadiness(makeTaxReturn({
        firstName: '', lastName: '',
        addressStreet: '', addressCity: '', addressState: '', addressZip: '',
      }));
      expect(result.blockerCount).toBe(6);
    });
  });

  // ── Filing Status blocker ────────────────────────
  it('blocks when filing status is missing', () => {
    const result = checkExportReadiness(makeTaxReturn({ filingStatus: undefined }));
    expect(result.ready).toBe(false);
    expect(result.blockers.some(b => b.message.includes('Filing status'))).toBe(true);
  });

  // ── MFJ spouse name requirement ──────────────────
  describe('MFJ spouse names', () => {
    it('blocks when MFJ spouse first name is missing', () => {
      const result = checkExportReadiness(makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        spouseFirstName: '',
        spouseLastName: 'Smith',
      }));
      expect(result.ready).toBe(false);
      expect(result.blockers.some(b => b.message.includes('Spouse first name'))).toBe(true);
    });

    it('blocks when MFJ spouse last name is missing', () => {
      const result = checkExportReadiness(makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        spouseFirstName: 'Jane',
        spouseLastName: '',
      }));
      expect(result.ready).toBe(false);
      expect(result.blockers.some(b => b.message.includes('Spouse last name'))).toBe(true);
    });

    it('passes when MFJ has both spouse names', () => {
      const result = checkExportReadiness(makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        spouseFirstName: 'Jane',
        spouseLastName: 'Smith',
      }));
      expect(result.blockers.some(b => b.message.includes('Spouse'))).toBe(false);
    });

    it('does not require spouse name for Single filers', () => {
      const result = checkExportReadiness(makeTaxReturn({
        filingStatus: FilingStatus.Single,
      }));
      expect(result.blockers.some(b => b.message.includes('Spouse'))).toBe(false);
    });
  });

  // ── Income source requirement ────────────────────
  describe('income sources', () => {
    it('blocks when no income sources at all', () => {
      const result = checkExportReadiness(makeTaxReturn({
        w2Income: [],
        income1099NEC: [],
        otherIncome: 0,
      }));
      expect(result.ready).toBe(false);
      expect(result.blockers.some(b => b.message.includes('No income sources'))).toBe(true);
    });

    it('passes with only 1099-INT income', () => {
      const result = checkExportReadiness(makeTaxReturn({
        w2Income: [],
        income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 500 }],
      } as any));
      expect(result.blockers.some(b => b.message.includes('No income sources'))).toBe(false);
    });

    it('passes with only rental income', () => {
      const result = checkExportReadiness(makeTaxReturn({
        w2Income: [],
        rentalProperties: [{ id: 'r1', address: '123', propertyType: 'single_family', daysRented: 365, personalUseDays: 0, rentalIncome: 12000 }],
      } as any));
      expect(result.blockers.some(b => b.message.includes('No income sources'))).toBe(false);
    });

    it('passes with only K-1 income', () => {
      const result = checkExportReadiness(makeTaxReturn({
        w2Income: [],
        incomeK1: [{ id: 'k1', entityName: 'LLC', entityType: 'partnership', ordinaryIncome: 10000 }],
      } as any));
      expect(result.blockers.some(b => b.message.includes('No income sources'))).toBe(false);
    });

    it('passes with other income only', () => {
      const result = checkExportReadiness(makeTaxReturn({
        w2Income: [],
        otherIncome: 5000,
      }));
      expect(result.blockers.some(b => b.message.includes('No income sources'))).toBe(false);
    });
  });

  // ── W-2 wages required ───────────────────────────
  describe('W-2 wages', () => {
    it('blocks when W-2 has no wages', () => {
      const result = checkExportReadiness(makeTaxReturn({
        w2Income: [{ id: 'w1', employerName: 'Bad Corp', wages: undefined } as any],
      }));
      expect(result.ready).toBe(false);
      expect(result.blockers.some(b => b.message.includes('Wages amount'))).toBe(true);
    });

    it('passes when W-2 wages are 0', () => {
      const result = checkExportReadiness(makeTaxReturn({
        w2Income: [{ id: 'w1', employerName: 'Low Corp', wages: 0, federalTaxWithheld: 0 }],
      } as any));
      expect(result.blockers.some(b => b.message.includes('Wages amount'))).toBe(false);
    });
  });

  // ── HoH dependent requirement ────────────────────
  describe('HoH dependent requirement', () => {
    it('blocks when HoH has no dependents', () => {
      const result = checkExportReadiness(makeTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [],
      }));
      expect(result.ready).toBe(false);
      expect(result.blockers.some(b =>
        b.message.includes('Head of Household') && b.message.includes('qualifying dependent'),
      )).toBe(true);
    });

    it('passes when HoH has dependents', () => {
      const result = checkExportReadiness(makeTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{ firstName: 'Child', lastName: 'Test', dateOfBirth: '2015-01-01', relationship: 'child', monthsLivedWithYou: 12 }],
      } as any));
      expect(result.blockers.some(b => b.message.includes('Head of Household'))).toBe(false);
    });
  });

  // ── Result structure ─────────────────────────────
  it('all blockers have required fields', () => {
    const result = checkExportReadiness(makeTaxReturn({
      firstName: '', lastName: '', addressStreet: '',
    }));
    for (const b of result.blockers) {
      expect(b.severity).toBe('blocker');
      expect(b.section).toBeTruthy();
      expect(b.stepId).toBeTruthy();
      expect(b.message).toBeTruthy();
    }
  });

  it('ready flag is consistent with blockerCount', () => {
    const clean = checkExportReadiness(makeTaxReturn());
    expect(clean.ready).toBe(true);
    expect(clean.blockerCount).toBe(0);

    const broken = checkExportReadiness(makeTaxReturn({ firstName: '' }));
    expect(broken.ready).toBe(false);
    expect(broken.blockerCount).toBeGreaterThan(0);
    expect(broken.blockerCount).toBe(broken.blockers.length);
  });
});
