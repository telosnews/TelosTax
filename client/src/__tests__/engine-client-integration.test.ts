/**
 * Engine → Client Integration Tests
 *
 * Verifies that cross-module engine results properly trigger
 * client-side warnings and suggestions. Runs the full engine
 * pipeline, then feeds the results to warningService and
 * suggestionService to verify the complete data flow.
 *
 * Motivation: Unit tests for warnings/suggestions use hand-crafted
 * CalculationResult objects. These tests verify the actual engine
 * output produces the expected client-side alerts.
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '@telostax/engine';
import type { TaxReturn } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';
import { getActiveWarnings } from '../services/warningService';
import { getSuggestions } from '../services/suggestionService';

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'integration-test',
    schemaVersion: 1,
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

// ═════════════════════════════════════════════════════════════════════════════
// ECI1 — High-AGI Rental Loss → Passive Loss Warning
//
// Engine computes rental passive loss limitation. Client warning service
// should detect the high AGI and warn about passive loss phase-out.
// ═════════════════════════════════════════════════════════════════════════════

describe('ECI1 — Engine rental loss triggers passive loss warning', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Employer', wages: 140000, federalTaxWithheld: 25000, socialSecurityWages: 140000, socialSecurityTax: 8680, medicareWages: 140000, medicareTax: 2030 }],
    rentalProperties: [{
      id: 'r1',
      address: '100 Elm St',
      propertyType: 'single_family' as const,
      daysRented: 365,
      personalUseDays: 0,
      rentalIncome: 12000,
      advertising: 0, auto: 0, cleaning: 0, commissions: 0,
      insurance: 2000, legal: 0, management: 0,
      mortgageInterest: 15000, otherInterest: 0,
      repairs: 5000, supplies: 0, taxes: 4000,
      utilities: 2000, depreciation: 4000,
    }],
  });

  const result = calculateForm1040(taxReturn);
  const warnings = getActiveWarnings(taxReturn, result);
  const allWarnings = warnings.flatMap(w => w.warnings);

  it('engine computes rental loss', () => {
    expect(result.scheduleE).toBeDefined();
    expect(result.scheduleE!.netRentalIncome).toBeLessThan(0);
  });

  it('warning service detects passive loss limitation at high AGI', () => {
    const passiveWarn = allWarnings.find(w =>
      w.message.includes('passive rental loss') || w.message.includes('passive loss'),
    );
    expect(passiveWarn).toBeDefined();
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// ECI2 — SE Income with No Estimated Payments → Warning + Suggestion
//
// Engine computes SE tax from 1099-NEC income. Both the warning service
// (estimated payments warning) and suggestion service (estimated payments
// suggestion) should fire.
// ═════════════════════════════════════════════════════════════════════════════

describe('ECI2 — SE income triggers estimated payment warning + suggestion', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    income1099NEC: [{ id: 'n1', payerName: 'Freelance Client', amount: 80000, federalTaxWithheld: 0 }],
    incomeDiscovery: {},
  });

  const result = calculateForm1040(taxReturn);
  const warnings = getActiveWarnings(taxReturn, result);
  const suggestions = getSuggestions(taxReturn, result);
  const allWarnings = warnings.flatMap(w => w.warnings);

  it('engine computes SE tax', () => {
    expect(result.scheduleSE).toBeDefined();
    expect(result.scheduleSE!.totalSETax).toBeGreaterThan(0);
  });

  it('warning service alerts about SE tax with no estimated payments', () => {
    const seWarn = allWarnings.find(w =>
      w.message.includes('self-employment tax') && w.stepId === 'estimated_payments',
    );
    expect(seWarn).toBeDefined();
  });

  it('suggestion service recommends estimated payments', () => {
    const epSuggestion = suggestions.find(s => s.id === 'estimated_payments');
    expect(epSuggestion).toBeDefined();
    expect(epSuggestion!.type).toBe('deduction');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// ECI3 — Dependents with No CTC Claimed → CTC Suggestion
//
// Engine sees qualifying children in the tax return. Suggestion service
// should recommend the Child Tax Credit when it hasn't been claimed.
// ═════════════════════════════════════════════════════════════════════════════

describe('ECI3 — Dependents trigger CTC suggestion from engine data', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Employer', wages: 60000, federalTaxWithheld: 8000, socialSecurityWages: 60000, socialSecurityTax: 3720, medicareWages: 60000, medicareTax: 870 }],
    dependents: [{
      id: 'dep-1',
      firstName: 'Emma',
      lastName: 'Test',
      dateOfBirth: '2016-05-15', // age 9 in 2025
      relationship: 'child',
      monthsLivedWithYou: 12,
    }],
    incomeDiscovery: {},
  });

  const result = calculateForm1040(taxReturn);
  const suggestions = getSuggestions(taxReturn, result);

  it('engine computes AGI correctly', () => {
    expect(result.form1040.agi).toBeCloseTo(60000, 0);
  });

  it('suggestion service recommends CTC for qualifying child', () => {
    const ctc = suggestions.find(s => s.id === 'ctc');
    expect(ctc).toBeDefined();
    expect(ctc!.type).toBe('credit');
    expect(ctc!.estimatedBenefit).toBe(2200);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// ECI4 — High-AGI with Investment Income → NIIT Warning
//
// Engine computes AGI above the NIIT threshold. Warning service should
// detect the NIIT exposure and alert the user.
// ═════════════════════════════════════════════════════════════════════════════

describe('ECI4 — High AGI with investment income triggers NIIT warning', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w1', employerName: 'Employer', wages: 220000, federalTaxWithheld: 45000, socialSecurityWages: 176100, socialSecurityTax: 10918.20, medicareWages: 220000, medicareTax: 3190 }],
    income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 15000, federalTaxWithheld: 0 }],
  });

  const result = calculateForm1040(taxReturn);
  const warnings = getActiveWarnings(taxReturn, result);
  const allWarnings = warnings.flatMap(w => w.warnings);

  it('engine computes NIIT', () => {
    expect(result.form1040.niitTax).toBeGreaterThan(0);
    expect(result.form1040.agi).toBeGreaterThan(200000);
  });

  it('warning service alerts about NIIT surcharge', () => {
    const niitWarn = allWarnings.find(w =>
      w.message.includes('Net Investment Income Tax'),
    );
    expect(niitWarn).toBeDefined();
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// ECI5 — HSA Suggestion for Self-Employed + Engine SE Tax
//
// Self-employed filer with no HSA contributions. Both the engine
// (SE tax computation) and suggestion service (HSA recommendation)
// should work together.
// ═════════════════════════════════════════════════════════════════════════════

describe('ECI5 — Self-employed filer triggers HSA suggestion', () => {
  const taxReturn = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000, federalTaxWithheld: 0 }],
    incomeDiscovery: {},
  });

  const result = calculateForm1040(taxReturn);
  const suggestions = getSuggestions(taxReturn, result);

  it('engine computes SE tax for self-employed income', () => {
    expect(result.scheduleSE).toBeDefined();
    expect(result.scheduleSE!.totalSETax).toBeGreaterThan(0);
  });

  it('suggestion service recommends HSA for self-employed', () => {
    const hsa = suggestions.find(s => s.id === 'hsa');
    expect(hsa).toBeDefined();
    expect(hsa!.type).toBe('deduction');
  });
});
