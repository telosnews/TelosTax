/**
 * UI Regression Fixtures
 *
 * These tests generate the exact data the client renders in TaxSummaryStep
 * and ReviewForm1040Step.  Any engine change that alters the shape or values
 * of the form1040 result object will break these snapshots, flagging a
 * potential UI regression *before* a developer has to open the browser.
 *
 * Each fixture verifies:
 *   1. The result object has every field the UI reads (shape test)
 *   2. Display values match expectations (toLocaleString, percentages, etc.)
 *   3. Conditional rendering decisions (e.g., "show SE tax row?") are correct
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus, Form1040Result, CalculationResult } from '../src/types/index.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'ui',
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
    incomeK1: [],
    income1099SA: [],
    rentalProperties: [],
    otherIncome: 0,
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

/**
 * Assert the result has every property the UI components actually reference.
 * This catches cases where an engine refactor removes or renames a field.
 */
function assertUIShape(result: CalculationResult) {
  const f = result.form1040;

  // ─── Fields read by TaxSummaryStep ────────────────
  expect(f).toHaveProperty('refundAmount');
  expect(f).toHaveProperty('amountOwed');
  expect(f).toHaveProperty('totalIncome');
  expect(f).toHaveProperty('taxableIncome');
  expect(f).toHaveProperty('effectiveTaxRate');
  expect(f).toHaveProperty('marginalTaxRate');
  expect(f).toHaveProperty('incomeTax');
  expect(f).toHaveProperty('seTax');
  expect(f).toHaveProperty('totalCredits');
  expect(f).toHaveProperty('taxAfterCredits');
  expect(f).toHaveProperty('totalWithholding');
  expect(f).toHaveProperty('qbiDeduction');
  expect(f).toHaveProperty('seDeduction');
  expect(f).toHaveProperty('deductionUsed');
  expect(f).toHaveProperty('deductionAmount');
  expect(f).toHaveProperty('estimatedQuarterlyPayment');

  // ─── Fields read by ReviewForm1040Step ─────────────
  expect(f).toHaveProperty('totalWages');
  expect(f).toHaveProperty('totalInterest');
  expect(f).toHaveProperty('totalDividends');
  expect(f).toHaveProperty('totalRetirementIncome');
  expect(f).toHaveProperty('totalUnemployment');
  expect(f).toHaveProperty('scheduleCNetProfit');
  expect(f).toHaveProperty('total1099MISCIncome');
  expect(f).toHaveProperty('selfEmployedHealthInsurance');
  expect(f).toHaveProperty('retirementContributions');
  expect(f).toHaveProperty('hsaDeduction');
  expect(f).toHaveProperty('studentLoanInterest');
  expect(f).toHaveProperty('iraDeduction');
  expect(f).toHaveProperty('totalAdjustments');
  expect(f).toHaveProperty('agi');
  expect(f).toHaveProperty('totalTax');
  expect(f).toHaveProperty('estimatedPayments');

  // ─── Sub-results read by ReviewScheduleCStep and TaxSummaryStep ───
  expect(result).toHaveProperty('credits');
  expect(result.credits).toHaveProperty('childTaxCredit');
  expect(result.credits).toHaveProperty('otherDependentCredit');
  expect(result.credits).toHaveProperty('educationCredit');
  expect(result.credits).toHaveProperty('eitcCredit');

  // ─── Type checks (all numeric fields used in template literals) ───
  const numericFields: (keyof Form1040Result)[] = [
    'totalWages', 'totalInterest', 'totalDividends', 'totalRetirementIncome',
    'totalUnemployment', 'total1099MISCIncome', 'scheduleCNetProfit', 'totalIncome',
    'seDeduction', 'selfEmployedHealthInsurance', 'retirementContributions',
    'hsaDeduction', 'studentLoanInterest', 'iraDeduction', 'totalAdjustments',
    'agi', 'deductionAmount', 'qbiDeduction', 'taxableIncome',
    'incomeTax', 'seTax', 'totalTax', 'totalCredits', 'taxAfterCredits',
    'totalWithholding', 'estimatedPayments', 'totalPayments',
    'amountOwed', 'refundAmount',
    'effectiveTaxRate', 'marginalTaxRate', 'estimatedQuarterlyPayment',
  ];

  for (const field of numericFields) {
    expect(typeof f[field]).toBe('number');
    expect(isFinite(f[field] as number), `${field} should be finite`).toBe(true);
    // toLocaleString must not throw on any value
    expect(() => (f[field] as number).toLocaleString()).not.toThrow();
  }

  // deductionUsed must be a valid string for the ternary in the UI
  expect(['standard', 'itemized']).toContain(f.deductionUsed);
}

/**
 * Simulate the conditional rendering logic from TaxSummaryStep:
 * Returns an array of "visible sections" that would render.
 */
function getVisibleSections(f: Form1040Result) {
  const sections: string[] = [];
  sections.push(f.refundAmount > 0 ? 'refund-hero' : 'owed-hero');
  sections.push('stat-grid'); // always visible
  sections.push('tax-breakdown'); // always visible
  if (f.seTax > 0) sections.push('se-tax-row');
  if (f.totalCredits > 0) sections.push('credits-row');
  if (f.totalWithholding > 0) sections.push('withholding-row');
  if (f.qbiDeduction > 0 || f.seDeduction > 0 || f.deductionAmount > 0) sections.push('savings-section');
  if (f.estimatedQuarterlyPayment > 0) sections.push('estimated-quarterly');
  return sections;
}

// ──────────────────────────────────────────────────────────────────────────────
// Fixture 1: Simple W-2 Employee (Refund)
// ──────────────────────────────────────────────────────────────────────────────

describe('UI Fixture 1: Simple W-2 Employee', () => {
  const tr = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1', employerName: 'Acme', wages: 55000, federalTaxWithheld: 6800,
    }],
  });
  const result = calculateForm1040(tr);
  const f = result.form1040;

  it('has correct UI shape', () => assertUIShape(result));

  it('shows refund hero (not owed)', () => {
    expect(f.refundAmount).toBeGreaterThan(0);
    expect(f.amountOwed).toBe(0);
    const sections = getVisibleSections(f);
    expect(sections).toContain('refund-hero');
    expect(sections).not.toContain('owed-hero');
  });

  it('hides SE-related sections', () => {
    const sections = getVisibleSections(f);
    expect(sections).not.toContain('se-tax-row');
    expect(sections).not.toContain('estimated-quarterly');
  });

  it('shows savings section (standard deduction > 0)', () => {
    const sections = getVisibleSections(f);
    expect(sections).toContain('savings-section');
  });

  it('renders correct display values', () => {
    expect(f.totalIncome.toLocaleString()).toBe('55,000');
    expect(f.taxableIncome.toLocaleString()).toBe('39,250');
    expect((f.effectiveTaxRate * 100).toFixed(1)).toBe('8.1');
    expect((f.marginalTaxRate * 100).toFixed(0)).toBe('12');
  });

  it('hides credits row (no credits)', () => {
    const sections = getVisibleSections(f);
    expect(sections).not.toContain('credits-row');
  });

  it('shows withholding row', () => {
    const sections = getVisibleSections(f);
    expect(sections).toContain('withholding-row');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Fixture 2: Self-Employed Freelancer (Owes Tax)
// ──────────────────────────────────────────────────────────────────────────────

describe('UI Fixture 2: Self-Employed Freelancer (Owes Tax)', () => {
  const tr = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 100000 }],
    expenses: [{ id: 'e1', scheduleCLine: 27, category: 'software', amount: 15000 }],
    homeOffice: { method: 'simplified', squareFeet: 200 },
  });
  const result = calculateForm1040(tr);
  const f = result.form1040;

  it('has correct UI shape', () => assertUIShape(result));

  it('shows owed hero (not refund)', () => {
    expect(f.amountOwed).toBeGreaterThan(0);
    expect(f.refundAmount).toBe(0);
    const sections = getVisibleSections(f);
    expect(sections).toContain('owed-hero');
  });

  it('shows SE tax row', () => {
    const sections = getVisibleSections(f);
    expect(sections).toContain('se-tax-row');
  });

  it('shows estimated quarterly payments', () => {
    const sections = getVisibleSections(f);
    expect(sections).toContain('estimated-quarterly');
    expect(f.estimatedQuarterlyPayment).toBeGreaterThan(0);
  });

  it('shows QBI deduction in savings section', () => {
    expect(f.qbiDeduction).toBeGreaterThan(0);
    expect(f.seDeduction).toBeGreaterThan(0);
    const sections = getVisibleSections(f);
    expect(sections).toContain('savings-section');
  });

  it('ReviewForm1040Step shows Schedule C net profit line', () => {
    expect(f.scheduleCNetProfit).toBeGreaterThan(0);
    // The UI conditionally renders this row when scheduleCNetProfit > 0
  });

  it('ReviewForm1040Step shows adjustments section', () => {
    expect(f.totalAdjustments).toBeGreaterThan(0);
    // The UI conditionally renders this section when totalAdjustments > 0
  });

  it('has Schedule C sub-result for ReviewScheduleCStep', () => {
    expect(result.scheduleC).toBeDefined();
    expect(result.scheduleC!.grossIncome).toBe(100000);
    expect(result.scheduleC!.totalExpenses).toBe(15000);
    expect(result.scheduleC!.homeOfficeDeduction).toBe(1000); // 200 × $5
    expect(result.scheduleC!.netProfit).toBe(84000);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Fixture 3: Family with Credits (CTC + EITC)
// ──────────────────────────────────────────────────────────────────────────────

describe('UI Fixture 3: Family with CTC + EITC', () => {
  const tr = makeTaxReturn({
    filingStatus: FilingStatus.HeadOfHousehold,
    w2Income: [{ id: 'w1', employerName: 'Store', wages: 30000, federalTaxWithheld: 2500 }],
    childTaxCredit: { qualifyingChildren: 2, otherDependents: 0 },
  });
  const result = calculateForm1040(tr);
  const f = result.form1040;

  it('has correct UI shape', () => assertUIShape(result));

  it('shows refund (EITC is refundable)', () => {
    expect(f.refundAmount).toBeGreaterThan(0);
    const sections = getVisibleSections(f);
    expect(sections).toContain('refund-hero');
  });

  it('shows credits row', () => {
    expect(f.totalCredits).toBeGreaterThan(0);
    const sections = getVisibleSections(f);
    expect(sections).toContain('credits-row');
  });

  it('credits breakdown is available for UI', () => {
    expect(result.credits.childTaxCredit).toBe(4400);
    expect(result.credits.eitcCredit).toBeGreaterThan(0);
  });

  it('refund exceeds withholding (EITC is refundable)', () => {
    expect(f.refundAmount).toBeGreaterThan(f.totalWithholding);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Fixture 4: MFJ with Itemized Deductions + Education
// ──────────────────────────────────────────────────────────────────────────────

describe('UI Fixture 4: MFJ Itemized + Education Credit', () => {
  const tr = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingJointly,
    w2Income: [{ id: 'w1', employerName: 'Corp', wages: 100000, federalTaxWithheld: 15000 }],
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 0, stateLocalIncomeTax: 8000, realEstateTax: 5000,
      personalPropertyTax: 0, mortgageInterest: 18000, mortgageInsurancePremiums: 0,
      charitableCash: 5000, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
    },
    educationCredits: [{
      id: 'e1', type: 'american_opportunity', studentName: 'Kid', institution: 'State U', tuitionPaid: 4000,
    }],
  });
  const result = calculateForm1040(tr);
  const f = result.form1040;

  it('has correct UI shape', () => assertUIShape(result));

  it('uses itemized deduction (shown in label)', () => {
    expect(f.deductionUsed).toBe('itemized');
    expect(f.deductionAmount).toBeGreaterThan(31500); // More than MFJ standard
  });

  it('has education credit', () => {
    expect(result.credits.educationCredit).toBe(1500); // 60% non-refundable of full AOTC ($2500)
    expect(result.credits.aotcRefundableCredit).toBe(1000); // 40% refundable
    expect(f.totalCredits).toBeGreaterThan(0);
    const sections = getVisibleSections(f);
    expect(sections).toContain('credits-row');
  });

  it('Schedule A sub-result exists for itemized breakdown', () => {
    expect(result.scheduleA).toBeDefined();
    expect(result.scheduleA!.saltDeduction).toBe(13000); // Under $40k SALT cap
    expect(result.scheduleA!.interestDeduction).toBe(18000);
    expect(result.scheduleA!.charitableDeduction).toBe(5000);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Fixture 5: Empty Return (first load / no data yet)
// ──────────────────────────────────────────────────────────────────────────────

describe('UI Fixture 5: Empty Return (first-load state)', () => {
  const tr = makeTaxReturn();
  const result = calculateForm1040(tr);
  const f = result.form1040;

  it('has correct UI shape', () => assertUIShape(result));

  it('shows $0 everywhere without crashing', () => {
    expect(f.totalIncome).toBe(0);
    expect(f.taxableIncome).toBe(0);
    expect(f.incomeTax).toBe(0);
    expect(f.amountOwed).toBe(0);
    expect(f.refundAmount).toBe(0);
    expect(f.totalCredits).toBe(0);
    expect(f.totalWithholding).toBe(0);
  });

  it('effective rate is 0% (no divide by zero)', () => {
    expect(f.effectiveTaxRate).toBe(0);
    // The UI does (f.effectiveTaxRate * 100).toFixed(1) → "0.0%"
    expect((f.effectiveTaxRate * 100).toFixed(1)).toBe('0.0');
  });

  it('marginal rate renders as 0%', () => {
    // calculateProgressiveTax returns 0 marginalRate for $0 income
    expect((f.marginalTaxRate * 100).toFixed(0)).toBe('0');
  });

  it('no conditional sections render', () => {
    const sections = getVisibleSections(f);
    expect(sections).not.toContain('se-tax-row');
    expect(sections).not.toContain('credits-row');
    expect(sections).not.toContain('withholding-row');
    expect(sections).not.toContain('estimated-quarterly');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Fixture 6: High-Income (verifies number formatting at scale)
// ──────────────────────────────────────────────────────────────────────────────

describe('UI Fixture 6: High-Income Number Formatting', () => {
  const tr = makeTaxReturn({
    filingStatus: FilingStatus.Single,
    w2Income: [{
      id: 'w1', employerName: 'BigTech', wages: 500000, federalTaxWithheld: 150000,
      socialSecurityWages: 176100,
    }],
  });
  const result = calculateForm1040(tr);
  const f = result.form1040;

  it('has correct UI shape', () => assertUIShape(result));

  it('formats large numbers correctly for display', () => {
    // toLocaleString must produce comma-separated strings
    expect(f.totalIncome.toLocaleString()).toMatch(/500,000/);
    expect(f.incomeTax.toLocaleString()).toMatch(/\d{1,3}(,\d{3})*/);
    // Refund or owed should be formatted
    const displayAmount = f.refundAmount > 0 ? f.refundAmount : f.amountOwed;
    expect(displayAmount.toLocaleString()).toMatch(/\d{1,3}(,\d{3})*/);
  });

  it('effective rate is reasonable for $500k income', () => {
    // Effective rate should be roughly 20-30%
    expect(f.effectiveTaxRate).toBeGreaterThan(0.15);
    expect(f.effectiveTaxRate).toBeLessThan(0.35);
  });

  it('marginal rate is 35% at $500k', () => {
    // Single $500k: in the 35% bracket (250,525–626,350)
    expect(f.marginalTaxRate).toBe(0.35);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Fixture 7: MFS return (special rules rendered in UI)
// ──────────────────────────────────────────────────────────────────────────────

describe('UI Fixture 7: MFS Special Rules', () => {
  const tr = makeTaxReturn({
    filingStatus: FilingStatus.MarriedFilingSeparately,
    w2Income: [{ id: 'w1', employerName: 'Corp', wages: 80000, federalTaxWithheld: 10000 }],
    studentLoanInterest: 2500,
    deductionMethod: 'itemized',
    itemizedDeductions: {
      medicalExpenses: 0, stateLocalIncomeTax: 8000, realEstateTax: 4000,
      personalPropertyTax: 0, mortgageInterest: 3000, mortgageInsurancePremiums: 0,
      charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
    },
  });
  const result = calculateForm1040(tr);
  const f = result.form1040;

  it('has correct UI shape', () => assertUIShape(result));

  it('denies student loan interest (MFS restriction)', () => {
    expect(f.studentLoanInterest).toBe(0);
    // UI should NOT show student loan interest row since it's 0
  });

  it('uses $20k SALT cap for MFS', () => {
    // Total SALT = 12000, under $20k cap
    expect(result.scheduleA!.saltDeduction).toBe(12000);
  });

  it('honors force-itemize election even when itemized is lower', () => {
    // Itemized: 12k SALT + 3k mortgage = 15k. Standard MFS = 15,750.
    // User elected 'itemized' → engine respects the election (e.g., for state tax benefit).
    expect(f.deductionUsed).toBe('itemized');
    expect(f.deductionAmount).toBe(15000);
  });

  it('EITC is zero (MFS ineligible)', () => {
    expect(result.credits.eitcCredit).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Cross-cutting: Render safety for all filing statuses
// ──────────────────────────────────────────────────────────────────────────────

describe('UI Cross-Cutting: All Filing Statuses Render Safely', () => {
  const statuses = [
    { status: FilingStatus.Single, label: 'Single' },
    { status: FilingStatus.MarriedFilingJointly, label: 'MFJ' },
    { status: FilingStatus.MarriedFilingSeparately, label: 'MFS' },
    { status: FilingStatus.HeadOfHousehold, label: 'HOH' },
    { status: FilingStatus.QualifyingSurvivingSpouse, label: 'QSS' },
  ];

  for (const { status, label } of statuses) {
    it(`${label}: UI shape is valid with $75k income`, () => {
      const tr = makeTaxReturn({
        filingStatus: status,
        w2Income: [{ id: 'w1', employerName: 'Test', wages: 75000, federalTaxWithheld: 10000 }],
      });
      const result = calculateForm1040(tr);
      assertUIShape(result);
    });

    it(`${label}: percentage formatting does not produce NaN`, () => {
      const tr = makeTaxReturn({
        filingStatus: status,
        w2Income: [{ id: 'w1', employerName: 'Test', wages: 75000, federalTaxWithheld: 10000 }],
      });
      const result = calculateForm1040(tr);
      const f = result.form1040;
      const effectiveStr = (f.effectiveTaxRate * 100).toFixed(1);
      const marginalStr = (f.marginalTaxRate * 100).toFixed(0);
      expect(effectiveStr).not.toBe('NaN');
      expect(marginalStr).not.toBe('NaN');
    });
  }
});
