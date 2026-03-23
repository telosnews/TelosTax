/**
 * Deduction Finder Context Builder — Unit Tests
 */

import { describe, it, expect } from 'vitest';
import type { TaxReturn, CalculationResult, Form1040Result } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';
import { buildReturnContext } from '../services/deductionFinderContext';

// ─── Helpers ─────────────────────────────────────

function makeReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-1',
    schemaVersion: 1,
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'personal',
    filingStatus: FilingStatus.Single,
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
    businesses: [],
    expenses: [],
    otherIncome: 0,
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  } as TaxReturn;
}

function makeCalc(overrides: Partial<Form1040Result> = {}): CalculationResult {
  return {
    form1040: {
      agi: 75000,
      marginalTaxRate: 0.22,
      ...overrides,
    } as Form1040Result,
  } as CalculationResult;
}

// ─── Tests ──────────────────────────────────────

describe('buildReturnContext', () => {
  it('maps filing status', () => {
    const ctx = buildReturnContext(makeReturn({ filingStatus: FilingStatus.MarriedFilingJointly }), makeCalc());
    expect(ctx.filingStatus).toBe(FilingStatus.MarriedFilingJointly);
  });

  it('counts dependents and minor dependents', () => {
    const ctx = buildReturnContext(
      makeReturn({
        dependents: [
          { id: '1', firstName: 'Child', lastName: 'A', relationship: 'child', dateOfBirth: '2018-06-15', monthsLivedWithYou: 12 },
          { id: '2', firstName: 'Teen', lastName: 'B', relationship: 'child', dateOfBirth: '2009-03-01', monthsLivedWithYou: 12 },
          { id: '3', firstName: 'Adult', lastName: 'C', relationship: 'child', dateOfBirth: '2000-01-01', monthsLivedWithYou: 12 },
        ],
      }),
      makeCalc(),
    );
    expect(ctx.dependentCount).toBe(3);
    expect(ctx.minorDependentCount).toBe(1); // Only the 2018 child is under 13 in 2025
  });

  it('detects Schedule C presence from 1099-NEC', () => {
    const ctx = buildReturnContext(
      makeReturn({ income1099NEC: [{ id: '1', payerName: 'Client', amount: 5000 }] }),
      makeCalc(),
    );
    expect(ctx.hasScheduleC).toBe(true);
  });

  it('detects Schedule C presence from businesses', () => {
    const ctx = buildReturnContext(
      makeReturn({ businesses: [{ id: '1', businessName: 'Freelance', naicsCode: '541511' }] as any }),
      makeCalc(),
    );
    expect(ctx.hasScheduleC).toBe(true);
  });

  it('detects home office', () => {
    const ctx = buildReturnContext(
      makeReturn({ homeOffice: { method: 'simplified' } as any }),
      makeCalc(),
    );
    expect(ctx.hasHomeOffice).toBe(true);
  });

  it('detects HSA from deduction amount', () => {
    const ctx = buildReturnContext(
      makeReturn({ hsaDeduction: 3600 }),
      makeCalc(),
    );
    expect(ctx.hasHSA).toBe(true);
  });

  it('detects student loan interest', () => {
    const ctx = buildReturnContext(
      makeReturn({ studentLoanInterest: 2500 }),
      makeCalc(),
    );
    expect(ctx.hasStudentLoanInterest).toBe(true);
  });

  it('detects mortgage interest from itemized deductions', () => {
    const ctx = buildReturnContext(
      makeReturn({ itemizedDeductions: { mortgageInterest: 12000 } as any }),
      makeCalc(),
    );
    expect(ctx.hasMortgageInterest).toBe(true);
  });

  it('detects charitable deductions', () => {
    const ctx = buildReturnContext(
      makeReturn({ itemizedDeductions: { charitableCash: 1000, charitableNonCash: 500 } as any }),
      makeCalc(),
    );
    expect(ctx.hasCharitableDeductions).toBe(true);
  });

  it('detects SE health insurance', () => {
    const ctx = buildReturnContext(
      makeReturn({ selfEmploymentDeductions: { healthInsurancePremiums: 6000 } as any }),
      makeCalc(),
    );
    expect(ctx.hasSEHealthInsurance).toBe(true);
  });

  it('reads AGI and marginal rate from calculation', () => {
    const ctx = buildReturnContext(
      makeReturn(),
      makeCalc({ agi: 120000, marginalTaxRate: 0.24 }),
    );
    expect(ctx.agi).toBe(120000);
    expect(ctx.marginalRate).toBe(0.24);
  });

  it('handles null calculation gracefully', () => {
    const ctx = buildReturnContext(makeReturn(), null);
    expect(ctx.agi).toBe(0);
    expect(ctx.marginalRate).toBe(0);
  });

  it('handles missing filing status', () => {
    const ctx = buildReturnContext(makeReturn({ filingStatus: undefined }), makeCalc());
    expect(ctx.filingStatus).toBeNull();
  });

  // ── Phase 1: TAX_YEAR fix ─────────────────────────

  it('uses taxReturn.taxYear not hardcoded 2025', () => {
    // A child born 2015-06-15 is under 13 in 2027 but NOT under 13 in 2029
    const ctx2027 = buildReturnContext(
      makeReturn({
        taxYear: 2027,
        dependents: [
          { id: '1', firstName: 'Child', lastName: 'A', relationship: 'child', dateOfBirth: '2015-06-15', monthsLivedWithYou: 12 },
        ],
      }),
      makeCalc(),
    );
    expect(ctx2027.minorDependentCount).toBe(1); // 12 years old in 2027

    const ctx2029 = buildReturnContext(
      makeReturn({
        taxYear: 2029,
        dependents: [
          { id: '1', firstName: 'Child', lastName: 'A', relationship: 'child', dateOfBirth: '2015-06-15', monthsLivedWithYou: 12 },
        ],
      }),
      makeCalc(),
    );
    expect(ctx2029.minorDependentCount).toBe(0); // 14 years old in 2029
  });

  // ── Phase 1: New context fields ───────────────────

  it('computes childUnder17Count', () => {
    const ctx = buildReturnContext(
      makeReturn({
        taxYear: 2025,
        dependents: [
          { id: '1', firstName: 'Child', lastName: 'A', relationship: 'child', dateOfBirth: '2018-06-15', monthsLivedWithYou: 12 },
          { id: '2', firstName: 'Teen', lastName: 'B', relationship: 'child', dateOfBirth: '2010-03-01', monthsLivedWithYou: 12 },
          { id: '3', firstName: 'Adult', lastName: 'C', relationship: 'child', dateOfBirth: '2000-01-01', monthsLivedWithYou: 12 },
        ],
      }),
      makeCalc(),
    );
    expect(ctx.childUnder17Count).toBe(2); // 2018 (age 7) and 2010 (age 15) are under 17
    expect(ctx.minorDependentCount).toBe(1); // Only 2018 (age 7) is under 13
  });

  it('detects gambling winnings from W-2G', () => {
    const ctx = buildReturnContext(
      makeReturn({ incomeW2G: [{ id: '1', payerName: 'Casino', grossWinnings: 5000 }] as any }),
      makeCalc(),
    );
    expect(ctx.hasGamblingWinnings).toBe(true);
  });

  it('detects SALT from state/local income tax', () => {
    const ctx = buildReturnContext(
      makeReturn({ itemizedDeductions: { stateLocalIncomeTax: 5000 } as any }),
      makeCalc(),
    );
    expect(ctx.hasSALT).toBe(true);
  });

  it('detects SALT from real estate tax', () => {
    const ctx = buildReturnContext(
      makeReturn({ itemizedDeductions: { realEstateTax: 3000 } as any }),
      makeCalc(),
    );
    expect(ctx.hasSALT).toBe(true);
  });

  it('computes itemizingDelta from calculation', () => {
    const ctx = buildReturnContext(
      makeReturn(),
      {
        form1040: {
          agi: 75000,
          marginalTaxRate: 0.22,
          standardDeduction: 15000,
          itemizedDeduction: 18000,
        } as any,
      } as any,
    );
    expect(ctx.itemizingDelta).toBe(3000); // 18000 - 15000
  });

  it('itemizingDelta is negative when standard deduction is better', () => {
    const ctx = buildReturnContext(
      makeReturn(),
      {
        form1040: {
          agi: 75000,
          marginalTaxRate: 0.22,
          standardDeduction: 15000,
          itemizedDeduction: 10000,
        } as any,
      } as any,
    );
    expect(ctx.itemizingDelta).toBe(-5000);
  });

  it('detects Schedule C from 1099-MISC', () => {
    const ctx = buildReturnContext(
      makeReturn({ income1099MISC: [{ id: '1', payerName: 'Client', amount: 3000 }] as any }),
      makeCalc(),
    );
    expect(ctx.hasScheduleC).toBe(true);
  });
});
