import { describe, it, expect } from 'vitest';
import {
  calculateTaxCalendar,
  formatDeadlineDate,
  type TaxDeadline,
} from '../services/taxCalendarService';
import { FilingStatus } from '@telostax/engine';
import type { TaxReturn, CalculationResult } from '@telostax/engine';

// ─── Factories ──────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return',
    schemaVersion: 1,
    taxYear: 2025,
    status: 'completed',
    currentStep: 0,
    currentSection: 'finish',
    filingStatus: FilingStatus.Single,
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
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-31T00:00:00Z',
    ...overrides,
  } as TaxReturn;
}

function makeCalc(overrides: Partial<CalculationResult['form1040']> = {}): CalculationResult {
  return {
    credits: {} as CalculationResult['credits'],
    form1040: {
      totalIncome: 75000,
      agi: 75000,
      taxableIncome: 60000,
      incomeTax: 8500,
      seTax: 0,
      totalTax: 8500,
      totalWithholding: 12000,
      totalCredits: 0,
      taxAfterCredits: 8500,
      refundAmount: 3500,
      amountOwed: 0,
      effectiveTaxRate: 0.11,
      marginalTaxRate: 0.22,
      estimatedQuarterlyPayment: 0,
      deductionAmount: 15000,
      deductionUsed: 'standard',
      qbiDeduction: 0,
      seDeduction: 0,
      capitalLossDeduction: 0,
      niitTax: 0,
      additionalMedicareTaxW2: 0,
      earlyDistributionPenalty: 0,
      amtAmount: 0,
      estimatedPayments: 0,
      foreignTaxPaid: 0,
      extensionFiled: false,
      ...overrides,
    },
  } as CalculationResult;
}

// ─── Tests ──────────────────────────────────────────

describe('calculateTaxCalendar', () => {
  // Use a fixed date well before deadlines
  const jan2026 = new Date(2026, 0, 15); // Jan 15, 2026

  it('always includes filing deadline and extension deadline', () => {
    const tr = makeTaxReturn();
    const cal = calculateTaxCalendar(tr, makeCalc(), jan2026);

    const filing = cal.deadlines.find(d => d.id === 'filing_deadline');
    expect(filing).toBeDefined();
    expect(filing!.date).toBe('2026-04-15');
    expect(filing!.type).toBe('filing');

    const ext = cal.deadlines.find(d => d.id === 'extension_deadline');
    expect(ext).toBeDefined();
    expect(ext!.date).toBe('2026-10-15');
    expect(ext!.type).toBe('extension');
  });

  it('W-2 only filer: no quarterly payment deadlines', () => {
    const tr = makeTaxReturn();
    const cal = calculateTaxCalendar(tr, makeCalc(), jan2026);

    const payments = cal.deadlines.filter(d => d.type === 'payment');
    expect(payments).toHaveLength(0);
  });

  it('SE filer with 1099-NEC: includes all 4 quarterly deadlines', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'nec-1', payerName: 'Client Co', amount: 50000, federalTaxWithheld: 0 }],
    });
    const calc = makeCalc({ estimatedQuarterlyPayment: 3000 });
    const cal = calculateTaxCalendar(tr, calc, jan2026);

    const payments = cal.deadlines.filter(d => d.type === 'payment');
    expect(payments).toHaveLength(4);
    expect(payments[0].date).toBe('2026-04-15');
    expect(payments[1].date).toBe('2026-06-16');
    expect(payments[2].date).toBe('2026-09-15');
    expect(payments[3].date).toBe('2027-01-15');
    expect(payments[0].amount).toBe(3000);
  });

  it('Schedule C business triggers quarterly deadlines when amount > 0', () => {
    const tr = makeTaxReturn({
      businesses: [{ id: 'biz-1', businessName: 'My LLC', accountingMethod: 'cash', didStartThisYear: false }] as TaxReturn['businesses'],
    });
    const cal = calculateTaxCalendar(tr, makeCalc({ estimatedQuarterlyPayment: 2000 }), jan2026);

    const payments = cal.deadlines.filter(d => d.type === 'payment');
    expect(payments).toHaveLength(4);
  });

  it('Schedule C business with $0 quarterly payment: no payment deadlines', () => {
    const tr = makeTaxReturn({
      businesses: [{ id: 'biz-1', businessName: 'My LLC', accountingMethod: 'cash', didStartThisYear: false }] as TaxReturn['businesses'],
    });
    const cal = calculateTaxCalendar(tr, makeCalc({ estimatedQuarterlyPayment: 0 }), jan2026);

    const payments = cal.deadlines.filter(d => d.type === 'payment');
    expect(payments).toHaveLength(0);
  });

  it('K-1 income triggers quarterly deadlines when amount > 0', () => {
    const tr = makeTaxReturn({
      incomeK1: [{ id: 'k1-1', entityName: 'Partnership', entityType: 'partnership', ordinaryBusinessIncome: 30000 }] as TaxReturn['incomeK1'],
    });
    const cal = calculateTaxCalendar(tr, makeCalc({ estimatedQuarterlyPayment: 1500 }), jan2026);

    const payments = cal.deadlines.filter(d => d.type === 'payment');
    expect(payments).toHaveLength(4);
  });

  it('Schedule F (farm) triggers quarterly deadlines when amount > 0', () => {
    const tr = makeTaxReturn({
      scheduleF: { farmName: 'Green Acres', grossIncome: 80000 } as TaxReturn['scheduleF'],
    });
    const cal = calculateTaxCalendar(tr, makeCalc({ estimatedQuarterlyPayment: 4000 }), jan2026);

    const payments = cal.deadlines.filter(d => d.type === 'payment');
    expect(payments).toHaveLength(4);
  });

  it('$1k+ owed triggers quarterly deadlines even without SE income', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ amountOwed: 2500, estimatedQuarterlyPayment: 625 });
    const cal = calculateTaxCalendar(tr, calc, jan2026);

    const payments = cal.deadlines.filter(d => d.type === 'payment');
    expect(payments).toHaveLength(4);
    expect(payments[0].amount).toBe(625);
  });

  it('IRA contribution shows deadline when iraContribution > 0', () => {
    const tr = makeTaxReturn({ iraContribution: 7000 });
    const cal = calculateTaxCalendar(tr, makeCalc(), jan2026);

    const ira = cal.deadlines.find(d => d.id === 'ira_contribution');
    expect(ira).toBeDefined();
    expect(ira!.date).toBe('2026-04-15');
    expect(ira!.type).toBe('contribution');
  });

  it('IRA contribution not shown when iraContribution is 0', () => {
    const tr = makeTaxReturn();
    const cal = calculateTaxCalendar(tr, makeCalc(), jan2026);

    const ira = cal.deadlines.find(d => d.id === 'ira_contribution');
    expect(ira).toBeUndefined();
  });

  it('HSA contribution shows deadline when hsaDeduction > 0', () => {
    const tr = makeTaxReturn({ hsaDeduction: 4300 });
    const cal = calculateTaxCalendar(tr, makeCalc(), jan2026);

    const hsa = cal.deadlines.find(d => d.id === 'hsa_contribution');
    expect(hsa).toBeDefined();
  });

  it('Solo 401(k) deadline shows when employer contribution > 0', () => {
    const tr = makeTaxReturn({
      selfEmploymentDeductions: {
        solo401kEmployerContribution: 15000,
        solo401kContributions: 15000,
      } as TaxReturn['selfEmploymentDeductions'],
    });
    const cal = calculateTaxCalendar(tr, makeCalc(), jan2026);

    const solo = cal.deadlines.find(d => d.id === 'solo401k_employer');
    expect(solo).toBeDefined();
    expect(solo!.notes).toContain('Oct 15');
  });

  it('Solo 401(k) deadline not shown when no solo 401k data', () => {
    const tr = makeTaxReturn();
    const cal = calculateTaxCalendar(tr, makeCalc(), jan2026);

    const solo = cal.deadlines.find(d => d.id === 'solo401k_employer');
    expect(solo).toBeUndefined();
  });

  // ─── Status tests ────────────────────────────────

  it('status is "upcoming" when deadline is >30 days away', () => {
    const tr = makeTaxReturn();
    const feb1 = new Date(2026, 1, 1); // Feb 1 — 73 days before Apr 15
    const cal = calculateTaxCalendar(tr, makeCalc(), feb1);

    const filing = cal.deadlines.find(d => d.id === 'filing_deadline');
    expect(filing!.status).toBe('upcoming');
  });

  it('status is "due_soon" when deadline is within 30 days', () => {
    const tr = makeTaxReturn();
    const apr1 = new Date(2026, 3, 1); // Apr 1 — 14 days before Apr 15
    const cal = calculateTaxCalendar(tr, makeCalc(), apr1);

    const filing = cal.deadlines.find(d => d.id === 'filing_deadline');
    expect(filing!.status).toBe('due_soon');
  });

  it('status is "overdue" when deadline has passed', () => {
    const tr = makeTaxReturn();
    const may1 = new Date(2026, 4, 1); // May 1 — past Apr 15
    const cal = calculateTaxCalendar(tr, makeCalc(), may1);

    const filing = cal.deadlines.find(d => d.id === 'filing_deadline');
    expect(filing!.status).toBe('overdue');
  });

  // ─── nextDeadline ─────────────────────────────────

  it('nextDeadline is the soonest non-overdue deadline', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 50000, federalTaxWithheld: 0 }],
    });
    const cal = calculateTaxCalendar(tr, makeCalc({ estimatedQuarterlyPayment: 2000 }), jan2026);

    expect(cal.nextDeadline).toBeDefined();
    expect(cal.nextDeadline!.date).toBe('2026-04-15');
  });

  it('nextDeadline is null when all deadlines are overdue', () => {
    const tr = makeTaxReturn();
    const farFuture = new Date(2028, 0, 1);
    const cal = calculateTaxCalendar(tr, makeCalc(), farFuture);

    expect(cal.nextDeadline).toBeNull();
  });

  // ─── Extension filed ────────────────────────────────

  it('extensionFiled: filing deadline shows as completed', () => {
    const tr = makeTaxReturn({ extensionFiled: true });
    const cal = calculateTaxCalendar(tr, makeCalc(), jan2026);

    const filing = cal.deadlines.find(d => d.id === 'filing_deadline');
    expect(filing!.status).toBe('completed');
    expect(filing!.label).toContain('Extension Filed');
  });

  it('extensionFiled: extension deadline becomes primary filing type', () => {
    const tr = makeTaxReturn({ extensionFiled: true });
    const cal = calculateTaxCalendar(tr, makeCalc(), jan2026);

    const ext = cal.deadlines.find(d => d.id === 'extension_deadline');
    expect(ext!.type).toBe('filing');
    expect(ext!.label).toBe('Extended Filing Deadline');
  });

  it('extensionFiled: nextDeadline skips completed filing deadline', () => {
    const tr = makeTaxReturn({ extensionFiled: true });
    const may2026 = new Date(2026, 4, 1); // After Apr 15 but before Oct 15
    const cal = calculateTaxCalendar(tr, makeCalc(), may2026);

    expect(cal.nextDeadline).toBeDefined();
    expect(cal.nextDeadline!.id).toBe('extension_deadline');
  });

  it('extensionFiled: Solo 401(k) deadline shifts to Oct 15', () => {
    const tr = makeTaxReturn({
      extensionFiled: true,
      selfEmploymentDeductions: {
        solo401kEmployerContribution: 15000,
        solo401kContributions: 15000,
      } as TaxReturn['selfEmploymentDeductions'],
    });
    const cal = calculateTaxCalendar(tr, makeCalc(), jan2026);

    const solo = cal.deadlines.find(d => d.id === 'solo401k_employer');
    expect(solo!.date).toBe('2026-10-15');
  });

  // ─── Handles missing calculation ───────────────────

  it('works without calculation result', () => {
    const tr = makeTaxReturn({
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 50000, federalTaxWithheld: 0 }],
    });
    const cal = calculateTaxCalendar(tr, undefined, jan2026);

    // Should still show quarterly payments (detected via 1099-NEC) but no amount
    const payments = cal.deadlines.filter(d => d.type === 'payment');
    expect(payments).toHaveLength(4);
    expect(payments[0].amount).toBeUndefined();
  });
});

describe('formatDeadlineDate', () => {
  it('formats ISO date to readable string', () => {
    expect(formatDeadlineDate('2026-04-15')).toBe('Apr 15, 2026');
    expect(formatDeadlineDate('2027-01-15')).toBe('Jan 15, 2027');
  });
});
