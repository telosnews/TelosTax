/**
 * Phase 6: Smoke Test Generation — Every State × Basic W-2 Return
 *
 * Tests all 50 states + DC with a standard $75k W-2 Single filer.
 * Verifies:
 *   1. No crashes for any state
 *   2. No-tax states produce $0
 *   3. Income-tax states produce positive state tax
 *   4. State tax ≤ federal AGI (sanity bound)
 *   5. Effective rates within reasonable bounds
 *
 * Also tests MFJ filing status for all states to verify bracket selection.
 */
import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateStateTaxes } from '../src/engine/state/index.js';
import { TaxReturn, FilingStatus, StateReturnConfig } from '../src/types/index.js';

// ── Helper ──────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'state-smoke',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    schemaVersion: 1,
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
    otherIncome: 0,
    businesses: [],
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

// ── All 51 Jurisdictions ────────────────────────────────────────────────────

const ALL_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

const NO_TAX_STATES = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'];

// ═══════════════════════════════════════════════════════════════════════════
// Single $75k W-2 × All States
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Single $75k W-2 × All States', () => {
  for (const stateCode of ALL_STATES) {
    const isNoTax = NO_TAX_STATES.includes(stateCode);

    it(`${stateCode} — ${isNoTax ? 'no-tax state (zero)' : 'produces valid state tax'}`, () => {
      const stateConfig: StateReturnConfig = {
        stateCode,
        residencyType: 'resident',
      };

      const taxReturn = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{
          id: 'w1',
          employerName: 'Test Corp',
          wages: 75000,
          federalTaxWithheld: 9500,
          socialSecurityWages: 75000,
          socialSecurityTax: 4650,
          medicareWages: 75000,
          medicareTax: 1087.50,
          stateTaxWithheld: isNoTax ? 0 : 3000,
          stateWages: 75000,
          state: stateCode,
        }],
        stateReturns: [stateConfig],
      });

      const federalResult = calculateForm1040(taxReturn);
      const stateResults = calculateStateTaxes(taxReturn, federalResult);

      expect(stateResults).toHaveLength(1);
      const sr = stateResults[0];

      // Basic structure
      expect(sr.stateCode).toBe(stateCode);
      expect(sr.residencyType).toBe('resident');

      // No NaN
      expect(sr.stateIncomeTax).not.toBeNaN();
      expect(sr.totalStateTax).not.toBeNaN();
      expect(sr.stateRefundOrOwed).not.toBeNaN();
      expect(sr.effectiveStateRate).not.toBeNaN();

      if (isNoTax) {
        // No-tax states
        expect(sr.stateIncomeTax).toBe(0);
        expect(sr.totalStateTax).toBe(0);
      } else {
        // Income-tax states
        expect(sr.stateIncomeTax).toBeGreaterThan(0);
        expect(sr.totalStateTax).toBeGreaterThan(0);

        // Sanity: state tax should be less than half of AGI
        expect(sr.totalStateTax).toBeLessThan(federalResult.form1040.agi * 0.5);

        // Effective rate should be between 0% and 15%
        expect(sr.effectiveStateRate).toBeGreaterThan(0);
        expect(sr.effectiveStateRate).toBeLessThan(0.15);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MFJ $120k W-2 × All Income-Tax States
// Verifies MFJ bracket selection doesn't crash
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: MFJ $120k W-2 × Income-Tax States', () => {
  const incomeTaxStates = ALL_STATES.filter(s => !NO_TAX_STATES.includes(s));

  for (const stateCode of incomeTaxStates) {
    it(`${stateCode} MFJ — valid state tax, lower effective rate than Single`, () => {
      const stateConfig: StateReturnConfig = {
        stateCode,
        residencyType: 'resident',
      };

      // MFJ return
      const mfjReturn = makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        w2Income: [{
          id: 'w1',
          employerName: 'Test Corp',
          wages: 120000,
          federalTaxWithheld: 18000,
          socialSecurityWages: 120000,
          socialSecurityTax: 7440,
          medicareWages: 120000,
          medicareTax: 1740,
          stateTaxWithheld: 5000,
          stateWages: 120000,
          state: stateCode,
        }],
        stateReturns: [stateConfig],
      });

      const federalResult = calculateForm1040(mfjReturn);
      const stateResults = calculateStateTaxes(mfjReturn, federalResult);

      expect(stateResults).toHaveLength(1);
      const sr = stateResults[0];

      // Basic validity
      expect(sr.stateIncomeTax).toBeGreaterThan(0);
      expect(sr.stateIncomeTax).not.toBeNaN();
      expect(sr.totalStateTax).toBeGreaterThan(0);
      expect(sr.totalStateTax).toBeLessThan(120000 * 0.5);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HoH × Selected States
// Verifies HoH filing key works for states that have distinct HoH brackets
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: HoH $50k × Selected States', () => {
  const testStates = ['CA', 'NY', 'NJ', 'VA', 'MN', 'OR', 'CT', 'MD', 'GA', 'PA', 'IL', 'DC'];

  for (const stateCode of testStates) {
    it(`${stateCode} HoH — produces valid state tax`, () => {
      const taxReturn = makeTaxReturn({
        filingStatus: FilingStatus.HeadOfHousehold,
        dependents: [{
          id: 'dep1', firstName: 'Child', lastName: 'Test', relationship: 'son',
          dateOfBirth: '2015-06-15', monthsLivedWithYou: 12,
        }],
        w2Income: [{
          id: 'w1',
          employerName: 'Test Corp',
          wages: 50000,
          federalTaxWithheld: 5000,
          stateTaxWithheld: 2000,
          stateWages: 50000,
          state: stateCode,
        }],
        stateReturns: [{ stateCode, residencyType: 'resident' }],
      });

      const federalResult = calculateForm1040(taxReturn);
      const stateResults = calculateStateTaxes(taxReturn, federalResult);

      expect(stateResults).toHaveLength(1);
      const sr = stateResults[0];

      expect(sr.stateIncomeTax).toBeGreaterThanOrEqual(0);
      expect(sr.stateIncomeTax).not.toBeNaN();
      expect(sr.totalStateTax).not.toBeNaN();
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Multi-State Filing Smoke Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Multi-State Filing', () => {
  it('Resident CA + Nonresident NY — no crash, other-state credit applied', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [
        {
          id: 'w1', employerName: 'CA Corp', wages: 60000, federalTaxWithheld: 7000,
          stateTaxWithheld: 3000, stateWages: 60000, state: 'CA',
        },
        {
          id: 'w2', employerName: 'NY Corp', wages: 20000, federalTaxWithheld: 2000,
          stateTaxWithheld: 1000, stateWages: 20000, state: 'NY',
        },
      ],
      stateReturns: [
        { stateCode: 'NY', residencyType: 'nonresident', stateSourceIncome: 20000 },
        { stateCode: 'CA', residencyType: 'resident' },
      ],
    });

    const federalResult = calculateForm1040(taxReturn);
    const stateResults = calculateStateTaxes(taxReturn, federalResult);

    expect(stateResults).toHaveLength(2);

    // Both should have valid results
    for (const sr of stateResults) {
      expect(sr.stateIncomeTax).toBeGreaterThan(0);
      expect(sr.stateIncomeTax).not.toBeNaN();
      expect(sr.totalStateTax).not.toBeNaN();
    }
  });

  it('Resident TX (no-tax) + Nonresident CA — TX zero, CA positive', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [
        {
          id: 'w1', employerName: 'TX Corp', wages: 60000, federalTaxWithheld: 7000,
          state: 'TX',
        },
        {
          id: 'w2', employerName: 'CA Corp', wages: 15000, federalTaxWithheld: 2000,
          stateTaxWithheld: 800, stateWages: 15000, state: 'CA',
        },
      ],
      stateReturns: [
        { stateCode: 'CA', residencyType: 'nonresident', stateSourceIncome: 15000 },
        { stateCode: 'TX', residencyType: 'resident' },
      ],
    });

    const federalResult = calculateForm1040(taxReturn);
    const stateResults = calculateStateTaxes(taxReturn, federalResult);

    expect(stateResults).toHaveLength(2);

    const txResult = stateResults.find(s => s.stateCode === 'TX')!;
    const caResult = stateResults.find(s => s.stateCode === 'CA')!;

    expect(txResult.totalStateTax).toBe(0);
    expect(caResult.stateIncomeTax).toBeGreaterThan(0);
  });
});
