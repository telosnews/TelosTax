/**
 * Tests for K-1 Box 13 (Partner's Deductions) and Box 15 (Partner's Credits)
 *
 * Validates that K-1 Box 13 deductions (charitable, investment interest, other)
 * and Box 15 credits (foreign tax, other credits) are correctly routed through
 * the K-1 routing engine and wired into downstream Form 1040 calculations.
 *
 * @authority
 *   IRC: Sections 701-704 — partnership income and allocations
 *   IRC: Section 170 — charitable contributions (Box 13 Codes A-F)
 *   IRC: Section 163(d) — investment interest expense (Box 13 Code H)
 *   IRC: Section 901 — foreign tax credit (Box 15 Code L)
 *   Form: Schedule K-1 (Form 1065 / Form 1120-S / Form 1041)
 */

import { describe, it, expect } from 'vitest';
import { routeK1Income, aggregateK1Income } from '../src/engine/k1.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { FilingStatus, TaxReturn, IncomeK1 } from '../src/types/index.js';

// ─── Helper: minimal K-1 ─────────────────────────────────
function makeK1(overrides: Partial<IncomeK1> = {}): IncomeK1 {
  return {
    id: 'k1-test',
    entityName: 'Test Partnership',
    entityType: 'partnership',
    ...overrides,
  };
}

// ─── Helper: minimal TaxReturn ────────────────────────────
function makeReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return',
    filingStatus: FilingStatus.Single,
    taxYear: 2025,
    dateOfBirth: '1985-01-15',
    w2Income: [],
    income1099INT: [],
    income1099DIV: [],
    income1099B: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099NEC: [],
    income1099K: [],
    income1099DA: [],
    income1099C: [],
    income1099SA: [],
    incomeW2G: [],
    incomeK1: [],
    dependents: [],
    estimatedTaxPayments: [],
    rentalProperties: [],
    form4797Properties: [],
    ...overrides,
  } as TaxReturn;
}

// ─────────────────────────────────────────────────────────────
// Section 1: routeK1Income — Box 13 Deduction Routing
// ─────────────────────────────────────────────────────────────

describe('K-1 Box 13 — routeK1Income deduction routing', () => {
  it('routes Box 13 charitable cash (Code A/B) correctly', () => {
    const result = routeK1Income(makeK1({
      box13CharitableCash: 5000,
    }));
    expect(result.charitableCash).toBe(5000);
    expect(result.charitableNonCash).toBe(0);
  });

  it('routes Box 13 charitable non-cash (Codes C-F) correctly', () => {
    const result = routeK1Income(makeK1({
      box13CharitableNonCash: 3000,
    }));
    expect(result.charitableNonCash).toBe(3000);
    expect(result.charitableCash).toBe(0);
  });

  it('routes Box 13 investment interest expense (Code H) correctly', () => {
    const result = routeK1Income(makeK1({
      box13InvestmentInterestExpense: 1200,
    }));
    expect(result.investmentInterestExpense).toBe(1200);
  });

  it('routes Box 13 other deductions (Codes I-L) correctly', () => {
    const result = routeK1Income(makeK1({
      box13OtherDeductions: 800,
    }));
    expect(result.otherDeductions).toBe(800);
  });

  it('handles all Box 13 fields together', () => {
    const result = routeK1Income(makeK1({
      box13CharitableCash: 2000,
      box13CharitableNonCash: 1500,
      box13InvestmentInterestExpense: 900,
      box13OtherDeductions: 400,
    }));
    expect(result.charitableCash).toBe(2000);
    expect(result.charitableNonCash).toBe(1500);
    expect(result.investmentInterestExpense).toBe(900);
    expect(result.otherDeductions).toBe(400);
  });

  it('treats negative Box 13 values as zero (floor at 0)', () => {
    const result = routeK1Income(makeK1({
      box13CharitableCash: -500,
      box13InvestmentInterestExpense: -100,
    }));
    expect(result.charitableCash).toBe(0);
    expect(result.investmentInterestExpense).toBe(0);
  });

  it('treats undefined/missing Box 13 fields as zero', () => {
    const result = routeK1Income(makeK1({}));
    expect(result.charitableCash).toBe(0);
    expect(result.charitableNonCash).toBe(0);
    expect(result.investmentInterestExpense).toBe(0);
    expect(result.otherDeductions).toBe(0);
  });

  it('does not affect income routing when only Box 13 is populated', () => {
    const result = routeK1Income(makeK1({
      box13CharitableCash: 10000,
      box13InvestmentInterestExpense: 5000,
    }));
    // Income totals should be zero since no income boxes are populated
    expect(result.totalOrdinaryIncome).toBe(0);
    expect(result.totalIncome).toBe(0);
    expect(result.totalSEIncome).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 2: routeK1Income — Box 15 Credit Routing
// ─────────────────────────────────────────────────────────────

describe('K-1 Box 15 — routeK1Income credit routing', () => {
  it('routes Box 15 foreign tax paid (Code L) correctly', () => {
    const result = routeK1Income(makeK1({
      box15ForeignTaxPaid: 750,
    }));
    expect(result.foreignTaxPaid).toBe(750);
  });

  it('routes Box 15 other credits correctly', () => {
    const result = routeK1Income(makeK1({
      box15OtherCredits: 300,
    }));
    expect(result.otherCredits).toBe(300);
  });

  it('handles both Box 15 fields together', () => {
    const result = routeK1Income(makeK1({
      box15ForeignTaxPaid: 500,
      box15OtherCredits: 200,
    }));
    expect(result.foreignTaxPaid).toBe(500);
    expect(result.otherCredits).toBe(200);
  });

  it('treats negative Box 15 values as zero (floor at 0)', () => {
    const result = routeK1Income(makeK1({
      box15ForeignTaxPaid: -200,
      box15OtherCredits: -100,
    }));
    expect(result.foreignTaxPaid).toBe(0);
    expect(result.otherCredits).toBe(0);
  });

  it('treats undefined/missing Box 15 fields as zero', () => {
    const result = routeK1Income(makeK1({}));
    expect(result.foreignTaxPaid).toBe(0);
    expect(result.otherCredits).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 3: aggregateK1Income — Multi-K1 Aggregation with Box 13/15
// ─────────────────────────────────────────────────────────────

describe('K-1 Box 13/15 — multi-K1 aggregation', () => {
  it('sums Box 13 charitable across multiple K-1s', () => {
    const result = aggregateK1Income([
      makeK1({ id: 'k1-a', box13CharitableCash: 3000, box13CharitableNonCash: 1000 }),
      makeK1({ id: 'k1-b', box13CharitableCash: 2000, box13CharitableNonCash: 500 }),
    ]);
    expect(result.charitableCash).toBe(5000);
    expect(result.charitableNonCash).toBe(1500);
  });

  it('sums Box 13 investment interest across K-1s', () => {
    const result = aggregateK1Income([
      makeK1({ id: 'k1-a', box13InvestmentInterestExpense: 800 }),
      makeK1({ id: 'k1-b', box13InvestmentInterestExpense: 400 }),
      makeK1({ id: 'k1-c', box13InvestmentInterestExpense: 300 }),
    ]);
    expect(result.investmentInterestExpense).toBe(1500);
  });

  it('sums Box 15 foreign tax across K-1s from different entity types', () => {
    const result = aggregateK1Income([
      makeK1({ id: 'k1-a', entityType: 'partnership', box15ForeignTaxPaid: 500 }),
      makeK1({ id: 'k1-b', entityType: 's_corp', box15ForeignTaxPaid: 300 }),
      makeK1({ id: 'k1-c', entityType: 'trust', box15ForeignTaxPaid: 200 }),
    ]);
    expect(result.foreignTaxPaid).toBe(1000);
  });

  it('sums Box 15 other credits across K-1s', () => {
    const result = aggregateK1Income([
      makeK1({ id: 'k1-a', box15OtherCredits: 100 }),
      makeK1({ id: 'k1-b', box15OtherCredits: 250 }),
    ]);
    expect(result.otherCredits).toBe(350);
  });

  it('returns zeros for empty K-1 array', () => {
    const result = aggregateK1Income([]);
    expect(result.charitableCash).toBe(0);
    expect(result.charitableNonCash).toBe(0);
    expect(result.investmentInterestExpense).toBe(0);
    expect(result.otherDeductions).toBe(0);
    expect(result.foreignTaxPaid).toBe(0);
    expect(result.otherCredits).toBe(0);
  });

  it('aggregates Box 13/15 alongside income fields correctly', () => {
    const result = aggregateK1Income([
      makeK1({
        id: 'k1-a',
        ordinaryBusinessIncome: 50000,
        interestIncome: 1000,
        box13CharitableCash: 3000,
        box13InvestmentInterestExpense: 500,
        box15ForeignTaxPaid: 200,
      }),
      makeK1({
        id: 'k1-b',
        entityType: 's_corp',
        ordinaryBusinessIncome: 30000,
        box13CharitableNonCash: 2000,
        box15OtherCredits: 150,
      }),
    ]);
    // Income fields should aggregate normally
    expect(result.ordinaryBusinessIncome).toBe(80000);
    expect(result.interestIncome).toBe(1000);
    // Box 13/15 fields
    expect(result.charitableCash).toBe(3000);
    expect(result.charitableNonCash).toBe(2000);
    expect(result.investmentInterestExpense).toBe(500);
    expect(result.foreignTaxPaid).toBe(200);
    expect(result.otherCredits).toBe(150);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 4: E2E — K-1 Box 13 charitable flows to Schedule A
// ─────────────────────────────────────────────────────────────

describe('K-1 Box 13 charitable → Schedule A integration', () => {
  it('K-1 cash charitable adds to itemized charitable deduction', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 }],
      incomeK1: [makeK1({
        ordinaryBusinessIncome: 20000,
        box13CharitableCash: 5000,
      })],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 5000,
        realEstateTax: 3000,
        personalPropertyTax: 0,
        mortgageInterest: 8000,
        mortgageInsurancePremiums: 0,
        charitableCash: 3000,     // Direct: $3,000
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    }));

    // Schedule A charitable should include direct $3,000 + K-1 $5,000 = $8,000
    // (subject to 60% AGI limit, but AGI ~$120k means limit is ~$72k — well above $8k)
    expect(result.scheduleA).toBeDefined();
    expect(result.scheduleA!.charitableDeduction).toBe(8000);
  });

  it('K-1 non-cash charitable adds to itemized non-cash charitable deduction', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 }],
      incomeK1: [makeK1({
        ordinaryBusinessIncome: 10000,
        box13CharitableNonCash: 4000,
      })],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 5000,
        realEstateTax: 3000,
        personalPropertyTax: 0,
        mortgageInterest: 8000,
        mortgageInsurancePremiums: 0,
        charitableCash: 0,
        charitableNonCash: 2000,  // Direct: $2,000
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    }));

    // Non-cash should be $2,000 (direct) + $4,000 (K-1) = $6,000
    // Subject to 30% AGI limit. AGI ~$110k, so limit is ~$33k — well above $6k
    expect(result.scheduleA).toBeDefined();
    // charitableDeduction includes both cash (0) and non-cash ($6,000)
    expect(result.scheduleA!.charitableDeduction).toBe(6000);
  });

  it('K-1 charitable does not affect standard deduction filers', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000, socialSecurityWages: 50000, socialSecurityTax: 3100, medicareWages: 50000, medicareTax: 725 }],
      incomeK1: [makeK1({
        box13CharitableCash: 10000,
      })],
      deductionMethod: 'standard',
    }));

    // Standard deduction used — no Schedule A
    expect(result.form1040.deductionUsed).toBe('standard');
    expect(result.scheduleA).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// Section 5: E2E — K-1 Box 13 investment interest → Form 4952
// ─────────────────────────────────────────────────────────────

describe('K-1 Box 13 investment interest → Form 4952 integration', () => {
  it('K-1 investment interest expense triggers Form 4952 even without direct input', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 }],
      income1099INT: [{ id: 'int1', payerName: 'Bank', amount: 5000 }],
      incomeK1: [makeK1({
        ordinaryBusinessIncome: 20000,
        box13InvestmentInterestExpense: 2000,
      })],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 5000,
        realEstateTax: 3000,
        personalPropertyTax: 0,
        mortgageInterest: 8000,
        mortgageInsurancePremiums: 0,
        charitableCash: 1000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    }));

    // K-1 investment interest ($2,000) should be deductible limited to NII
    // NII includes at least the $5,000 interest income, so full $2,000 is deductible
    expect(result.form1040.investmentInterestDeduction).toBe(2000);
  });

  it('K-1 investment interest adds to direct investment interest paid', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 }],
      income1099INT: [{ id: 'int1', payerName: 'Bank', amount: 3000 }],
      incomeK1: [makeK1({
        ordinaryBusinessIncome: 20000,
        box13InvestmentInterestExpense: 1500,
      })],
      investmentInterest: {
        investmentInterestPaid: 1000,  // Direct: $1,000
      },
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 5000,
        realEstateTax: 3000,
        personalPropertyTax: 0,
        mortgageInterest: 8000,
        mortgageInsurancePremiums: 0,
        charitableCash: 1000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    }));

    // Total investment interest = $1,000 (direct) + $1,500 (K-1) = $2,500
    // NII = $3,000 interest income → deduction = min($2,500, $3,000) = $2,500
    expect(result.form1040.investmentInterestDeduction).toBe(2500);
  });

  it('K-1 investment interest is limited by net investment income', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 }],
      income1099INT: [{ id: 'int1', payerName: 'Bank', amount: 500 }],
      incomeK1: [makeK1({
        ordinaryBusinessIncome: 20000,
        box13InvestmentInterestExpense: 3000,
      })],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 5000,
        realEstateTax: 3000,
        personalPropertyTax: 0,
        mortgageInterest: 8000,
        mortgageInsurancePremiums: 0,
        charitableCash: 1000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    }));

    // K-1 investment interest = $3,000, but NII = $500 interest income only
    // Deduction limited to $500
    expect(result.form1040.investmentInterestDeduction).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 6: E2E — K-1 Box 15 foreign tax → FTC
// ─────────────────────────────────────────────────────────────

describe('K-1 Box 15 foreign tax → Foreign Tax Credit integration', () => {
  it('K-1 foreign tax triggers FTC even without 1099-DIV foreign tax', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 80000, federalTaxWithheld: 12000, socialSecurityWages: 80000, socialSecurityTax: 4960, medicareWages: 80000, medicareTax: 1160 }],
      incomeK1: [makeK1({
        ordinaryBusinessIncome: 30000,
        interestIncome: 2000,
        box15ForeignTaxPaid: 1000,
      })],
    }));

    // Foreign tax paid = $1,000 from K-1
    expect(result.form1040.foreignTaxPaid).toBe(1000);
    // FTC should be calculated
    expect(result.foreignTaxCredit).toBeDefined();
    expect(result.credits.foreignTaxCredit).toBeGreaterThan(0);
  });

  it('K-1 foreign tax adds to 1099-DIV foreign tax for combined FTC', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 80000, federalTaxWithheld: 12000, socialSecurityWages: 80000, socialSecurityTax: 4960, medicareWages: 80000, medicareTax: 1160 }],
      income1099DIV: [{
        id: 'div1',
        payerName: 'Vanguard',
        ordinaryDividends: 5000,
        qualifiedDividends: 3000,
        foreignTaxPaid: 400,
      }],
      incomeK1: [makeK1({
        ordinaryBusinessIncome: 20000,
        box15ForeignTaxPaid: 600,
      })],
    }));

    // Total foreign tax = $400 (1099-DIV) + $600 (K-1) = $1,000
    expect(result.form1040.foreignTaxPaid).toBe(1000);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 7: E2E — K-1 Box 15 other credits → nonrefundable credits
// ─────────────────────────────────────────────────────────────

describe('K-1 Box 15 other credits → nonrefundable credits integration', () => {
  it('K-1 other credits appear in credits result', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 80000, federalTaxWithheld: 12000, socialSecurityWages: 80000, socialSecurityTax: 4960, medicareWages: 80000, medicareTax: 1160 }],
      incomeK1: [makeK1({
        ordinaryBusinessIncome: 20000,
        box15OtherCredits: 500,
      })],
    }));

    expect(result.credits.k1OtherCredits).toBe(500);
    // Should be included in nonrefundable total
    expect(result.credits.totalNonRefundable).toBeGreaterThanOrEqual(500);
  });

  it('K-1 other credits are zero when not provided', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000, socialSecurityWages: 50000, socialSecurityTax: 3100, medicareWages: 50000, medicareTax: 725 }],
      incomeK1: [makeK1({
        ordinaryBusinessIncome: 10000,
      })],
    }));

    expect(result.credits.k1OtherCredits).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 8: Mixed entity types with Box 13/15
// ─────────────────────────────────────────────────────────────

describe('K-1 Box 13/15 — mixed entity type handling', () => {
  it('routes Box 13/15 for S-Corp K-1s (no SE income effect)', () => {
    const result = routeK1Income(makeK1({
      entityType: 's_corp',
      ordinaryBusinessIncome: 50000,
      box13CharitableCash: 3000,
      box13InvestmentInterestExpense: 500,
      box15ForeignTaxPaid: 200,
    }));

    // S-Corp: no SE income
    expect(result.totalSEIncome).toBe(0);
    // But Box 13/15 still routes correctly
    expect(result.charitableCash).toBe(3000);
    expect(result.investmentInterestExpense).toBe(500);
    expect(result.foreignTaxPaid).toBe(200);
  });

  it('routes Box 13/15 for trust/estate K-1s', () => {
    const result = routeK1Income(makeK1({
      entityType: 'trust',
      ordinaryBusinessIncome: 10000,
      box13CharitableNonCash: 2000,
      box15OtherCredits: 100,
    }));

    expect(result.totalSEIncome).toBe(0);
    expect(result.charitableNonCash).toBe(2000);
    expect(result.otherCredits).toBe(100);
  });

  it('aggregates Box 13/15 across mixed entity types', () => {
    const result = aggregateK1Income([
      makeK1({ id: 'k1-partnership', entityType: 'partnership', ordinaryBusinessIncome: 30000, box13CharitableCash: 2000, box15ForeignTaxPaid: 300 }),
      makeK1({ id: 'k1-scorp', entityType: 's_corp', ordinaryBusinessIncome: 40000, box13CharitableCash: 1000, box15ForeignTaxPaid: 200 }),
      makeK1({ id: 'k1-trust', entityType: 'trust', box13CharitableNonCash: 500, box15OtherCredits: 50 }),
    ]);

    expect(result.charitableCash).toBe(3000);
    expect(result.charitableNonCash).toBe(500);
    expect(result.foreignTaxPaid).toBe(500);
    expect(result.otherCredits).toBe(50);
    // Only partnership has SE income
    expect(result.totalSEIncome).toBe(30000);
  });
});
