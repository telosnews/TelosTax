import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateForm5329 } from '../src/engine/form5329.js';
import { calculateScheduleC } from '../src/engine/scheduleC.js';
import { routeK1Income, aggregateK1Income } from '../src/engine/k1.js';
import { FilingStatus, TaxReturn, IncomeK1 } from '../src/types/index.js';
import { EXCESS_CONTRIBUTION, DISTRIBUTION_529, ALIMONY } from '../src/constants/tax2025.js';

// ─── Helper: minimal valid TaxReturn ───────────────────
function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint15',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 8000 }],
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
    dependents: [],
    expenses: [],
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════
// A1: Alimony Received as Income (pre-2019)
// IRC §71 (pre-TCJA), TCJA §11051
// ════════════════════════════════════════════════════════

describe('A1: Alimony Received as Income (pre-2019)', () => {
  it('includes alimony received in income for pre-2019 divorce', () => {
    const result = calculateForm1040(baseTaxReturn({
      alimonyReceived: {
        totalReceived: 24000,
        payerSSNLastFour: '1234',
        divorceDate: '2017-06-15',
      },
    }));
    expect(result.form1040.alimonyReceivedIncome).toBe(24000);
    // totalIncome should be higher by 24000 than base (60000 wages)
    expect(result.form1040.totalIncome).toBeGreaterThanOrEqual(84000);
  });

  it('does NOT include alimony received for post-2018 divorce (TCJA repeal)', () => {
    const result = calculateForm1040(baseTaxReturn({
      alimonyReceived: {
        totalReceived: 24000,
        payerSSNLastFour: '5678',
        divorceDate: '2019-03-01', // After TCJA cutoff
      },
    }));
    expect(result.form1040.alimonyReceivedIncome).toBe(0);
    // totalIncome unchanged from base wages
    expect(result.form1040.totalIncome).toBeLessThan(84000);
  });

  it('handles exactly on the cutoff date (Jan 1, 2019 = NOT deductible)', () => {
    const result = calculateForm1040(baseTaxReturn({
      alimonyReceived: {
        totalReceived: 12000,
        divorceDate: '2019-01-01', // Exactly on cutoff — NOT included
      },
    }));
    expect(result.form1040.alimonyReceivedIncome).toBe(0);
  });

  it('handles day before cutoff (Dec 31, 2018 = IS included)', () => {
    const result = calculateForm1040(baseTaxReturn({
      alimonyReceived: {
        totalReceived: 12000,
        divorceDate: '2018-12-31',
      },
    }));
    expect(result.form1040.alimonyReceivedIncome).toBe(12000);
  });

  it('both alimony paid and received work together (different ex-spouses)', () => {
    const result = calculateForm1040(baseTaxReturn({
      alimony: {
        totalPaid: 18000,
        recipientSSNLastFour: '9999',
        divorceDate: '2016-04-01',
      },
      alimonyReceived: {
        totalReceived: 12000,
        payerSSNLastFour: '8888',
        divorceDate: '2015-09-01',
      },
    }));
    expect(result.form1040.alimonyDeduction).toBe(18000);
    expect(result.form1040.alimonyReceivedIncome).toBe(12000);
  });
});

// ════════════════════════════════════════════════════════
// A2: Multiple Schedule C Businesses
// ════════════════════════════════════════════════════════

describe('A2: Multiple Schedule C Businesses', () => {
  it('single business still works (backward compatibility via business field)', () => {
    const result = calculateForm1040(baseTaxReturn({
      w2Income: [],
      business: {
        id: 'biz-1', businessName: 'Freelance LLC', accountingMethod: 'cash', didStartThisYear: false,
      },
      income1099NEC: [{ id: 'nec-1', payerName: 'Client A', amount: 50000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office', amount: 5000 },
      ],
    }));
    expect(result.scheduleC).toBeDefined();
    expect(result.scheduleC!.grossIncome).toBe(50000);
    expect(result.scheduleC!.totalExpenses).toBe(5000);
    expect(result.scheduleC!.netProfit).toBe(45000);
  });

  it('multiple businesses produce per-business breakdown', () => {
    const result = calculateScheduleC(baseTaxReturn({
      w2Income: [],
      businesses: [
        { id: 'biz-1', businessName: 'Consulting', accountingMethod: 'cash', didStartThisYear: false },
        { id: 'biz-2', businessName: 'Retail', accountingMethod: 'cash', didStartThisYear: false },
      ],
      income1099NEC: [{ id: 'nec-1', payerName: 'Client A', amount: 80000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office', amount: 3000, businessId: 'biz-1' },
        { id: 'e2', scheduleCLine: 18, category: 'supplies', amount: 7000, businessId: 'biz-2' },
      ],
    }));
    expect(result.grossIncome).toBe(80000);
    expect(result.totalExpenses).toBe(10000);
    expect(result.netProfit).toBe(70000);
    expect(result.businessResults).toBeDefined();
    expect(result.businessResults!.length).toBe(2);
  });

  it('multi-business aggregate netProfit is correct', () => {
    const result = calculateForm1040(baseTaxReturn({
      w2Income: [],
      businesses: [
        { id: 'biz-1', businessName: 'A', accountingMethod: 'cash', didStartThisYear: false },
        { id: 'biz-2', businessName: 'B', accountingMethod: 'cash', didStartThisYear: false },
      ],
      income1099NEC: [
        { id: 'nec-1', payerName: 'Client X', amount: 100000 },
      ],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'rent', amount: 10000, businessId: 'biz-1' },
        { id: 'e2', scheduleCLine: 18, category: 'supplies', amount: 5000, businessId: 'biz-2' },
      ],
    }));
    expect(result.scheduleC).toBeDefined();
    expect(result.form1040.scheduleCNetProfit).toBe(85000);
  });

  it('businesses array takes precedence over single business field', () => {
    const result = calculateScheduleC(baseTaxReturn({
      business: { id: 'old-biz', businessName: 'Old', accountingMethod: 'cash', didStartThisYear: false },
      businesses: [
        { id: 'new-1', businessName: 'New A', accountingMethod: 'cash', didStartThisYear: false },
        { id: 'new-2', businessName: 'New B', accountingMethod: 'cash', didStartThisYear: false },
      ],
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 50000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'misc', amount: 2000, businessId: 'new-1' },
        { id: 'e2', scheduleCLine: 18, category: 'misc', amount: 3000, businessId: 'new-2' },
      ],
    }));
    expect(result.businessResults).toBeDefined();
    expect(result.businessResults!.length).toBe(2);
    expect(result.businessResults![0].businessId).toBe('new-1');
    expect(result.businessResults![1].businessId).toBe('new-2');
  });

  it('single business in businesses array does not produce businessResults', () => {
    const result = calculateScheduleC(baseTaxReturn({
      businesses: [
        { id: 'solo', businessName: 'Solo Shop', accountingMethod: 'cash', didStartThisYear: false },
      ],
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 30000 }],
      expenses: [{ id: 'e1', scheduleCLine: 18, category: 'rent', amount: 5000, businessId: 'solo' }],
    }));
    // Single business: no per-business breakdown
    expect(result.businessResults).toBeUndefined();
    expect(result.netProfit).toBe(25000);
  });
});

// ════════════════════════════════════════════════════════
// A3: K-1 Section 179 Passthrough (Box 12)
// IRC §179, K-1 Box 12 Code A
// ════════════════════════════════════════════════════════

describe('A3: K-1 Section 179 Passthrough (Box 12)', () => {
  it('routes section179Deduction in K-1 routing result', () => {
    const k1: IncomeK1 = {
      id: 'k1-1', entityName: 'ABC LLC', entityType: 'partnership',
      ordinaryBusinessIncome: 50000,
      guaranteedPayments: 10000,
      section179Deduction: 15000,
    };
    const result = routeK1Income(k1);
    expect(result.section179Deduction).toBe(15000);
    expect(result.ordinaryBusinessIncome).toBe(50000);
  });

  it('aggregates section179 across multiple K-1s', () => {
    const k1s: IncomeK1[] = [
      { id: 'k1-1', entityName: 'LLC A', entityType: 'partnership', ordinaryBusinessIncome: 30000, section179Deduction: 5000 },
      { id: 'k1-2', entityName: 'LLC B', entityType: 's_corp', ordinaryBusinessIncome: 20000, section179Deduction: 3000 },
    ];
    const result = aggregateK1Income(k1s);
    expect(result.section179Deduction).toBe(8000);
  });

  it('section179 reduces total income in Form 1040', () => {
    const withoutSection179 = calculateForm1040(baseTaxReturn({
      incomeK1: [{
        id: 'k1-1', entityName: 'ABC LLC', entityType: 'partnership',
        ordinaryBusinessIncome: 50000,
      }],
    }));

    const withSection179 = calculateForm1040(baseTaxReturn({
      incomeK1: [{
        id: 'k1-1', entityName: 'ABC LLC', entityType: 'partnership',
        ordinaryBusinessIncome: 50000,
        section179Deduction: 15000,
      }],
    }));

    expect(withSection179.form1040.k1Section179Deduction).toBe(15000);
    expect(withSection179.form1040.totalIncome).toBe(withoutSection179.form1040.totalIncome - 15000);
  });

  it('section179 cannot exceed K-1 ordinary income (no loss creation)', () => {
    const result = calculateForm1040(baseTaxReturn({
      incomeK1: [{
        id: 'k1-1', entityName: 'Small LLC', entityType: 'partnership',
        ordinaryBusinessIncome: 10000,
        section179Deduction: 25000, // Exceeds ordinary income
      }],
    }));
    // K-1 ordinary income = 10000 + 0 guaranteed + 0 other = 10000
    // Section 179 limited to 10000
    expect(result.form1040.k1Section179Deduction).toBe(10000);
  });
});

// ════════════════════════════════════════════════════════
// A4: Form 5329 Excess Contribution Penalties
// IRC §4973(a) (IRA), IRC §4973(g) (HSA)
// ════════════════════════════════════════════════════════

describe('A4: Form 5329 Excess Contribution Penalties', () => {
  it('calculates 6% excise on IRA excess contribution', () => {
    const result = calculateForm5329({
      iraExcessContribution: 1000,
    });
    expect(result.iraExciseTax).toBe(60); // 6% of 1000
    expect(result.hsaExciseTax).toBe(0);
    expect(result.totalPenalty).toBe(60);
  });

  it('calculates 6% excise on HSA excess contribution', () => {
    const result = calculateForm5329({
      hsaExcessContribution: 500,
    });
    expect(result.iraExciseTax).toBe(0);
    expect(result.hsaExciseTax).toBe(30); // 6% of 500
    expect(result.totalPenalty).toBe(30);
  });

  it('calculates both IRA and HSA excess together', () => {
    const result = calculateForm5329({
      iraExcessContribution: 2000,
      hsaExcessContribution: 1000,
    });
    expect(result.iraExciseTax).toBe(120); // 6% of 2000
    expect(result.hsaExciseTax).toBe(60);  // 6% of 1000
    expect(result.totalPenalty).toBe(180);
  });

  it('ignores negative excess contributions', () => {
    const result = calculateForm5329({
      iraExcessContribution: -500,
      hsaExcessContribution: -200,
    });
    expect(result.totalPenalty).toBe(0);
  });

  it('integrates into Form 1040 totalTax', () => {
    const without = calculateForm1040(baseTaxReturn());
    const withExcess = calculateForm1040(baseTaxReturn({
      excessContributions: {
        iraExcessContribution: 3000,
        hsaExcessContribution: 1000,
      },
    }));
    // Penalty = 6% * 3000 + 6% * 1000 = 180 + 60 = 240
    expect(withExcess.form1040.excessContributionPenalty).toBe(240);
    expect(withExcess.form5329).toBeDefined();
    expect(withExcess.form5329!.totalPenalty).toBe(240);
    expect(withExcess.form1040.totalTax).toBe(without.form1040.totalTax + 240);
  });

  it('EXCESS_CONTRIBUTION constant is correct', () => {
    expect(EXCESS_CONTRIBUTION.PENALTY_RATE).toBe(0.06);
  });
});

// ════════════════════════════════════════════════════════
// A5: 1099-Q (529 Distributions)
// IRC §529(c)(3)(A), IRC §529(c)(6)
// ════════════════════════════════════════════════════════

describe('A5: 1099-Q (529 Distributions)', () => {
  it('qualified 529 distribution is not taxable', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'State 529 Plan',
        grossDistribution: 10000, earnings: 3000, basisReturn: 7000,
        qualifiedExpenses: 10000, distributionType: 'qualified',
      }],
    }));
    expect(result.form1040.taxable529Income).toBe(0);
    expect(result.form1040.penalty529).toBe(0);
  });

  it('non-qualified 529 distribution: earnings are taxable + 10% penalty', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'State 529 Plan',
        grossDistribution: 10000, earnings: 3000, basisReturn: 7000,
        qualifiedExpenses: 0, distributionType: 'non_qualified',
      }],
    }));
    expect(result.form1040.taxable529Income).toBe(3000);
    expect(result.form1040.penalty529).toBe(300); // 10% of 3000
  });

  it('non-qualified with partial qualified expenses — pro-rata allocation', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'College Plan',
        grossDistribution: 20000, earnings: 6000, basisReturn: 14000,
        qualifiedExpenses: 4000, distributionType: 'non_qualified',
      }],
    }));
    // Pro-rata: exclusionRatio = 4000/20000 = 0.2
    // taxFreeEarnings = 6000 * 0.2 = 1200
    // taxable = 6000 - 1200 = 4800
    expect(result.form1040.taxable529Income).toBe(4800);
    expect(result.form1040.penalty529).toBe(480); // 10% of 4800
  });

  it('rollover 529 distribution is not taxable', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'State Plan',
        grossDistribution: 15000, earnings: 5000, basisReturn: 10000,
        qualifiedExpenses: 0, distributionType: 'rollover',
      }],
    }));
    expect(result.form1040.taxable529Income).toBe(0);
    expect(result.form1040.penalty529).toBe(0);
  });

  it('multiple 1099-Q forms aggregate correctly (pro-rata)', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [
        {
          id: 'q-1', payerName: 'Plan A',
          grossDistribution: 10000, earnings: 2000, basisReturn: 8000,
          qualifiedExpenses: 0, distributionType: 'non_qualified',
        },
        {
          id: 'q-2', payerName: 'Plan B',
          grossDistribution: 5000, earnings: 1500, basisReturn: 3500,
          qualifiedExpenses: 5000, distributionType: 'qualified',
        },
        {
          id: 'q-3', payerName: 'Plan C',
          grossDistribution: 8000, earnings: 3000, basisReturn: 5000,
          qualifiedExpenses: 1000, distributionType: 'non_qualified',
        },
      ],
    }));
    // q-1: non_qualified, exclusionRatio=0/10000=0, taxable=2000
    // q-2: qualified → taxable=0
    // q-3: non_qualified, exclusionRatio=1000/8000=0.125, taxFree=375, taxable=2625
    expect(result.form1040.taxable529Income).toBe(4625);
    expect(result.form1040.penalty529).toBe(462.5); // 10% of 4625
  });

  it('529 taxable income increases totalIncome', () => {
    const base = calculateForm1040(baseTaxReturn());
    const with529 = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'Plan',
        grossDistribution: 10000, earnings: 5000, basisReturn: 5000,
        qualifiedExpenses: 0, distributionType: 'non_qualified',
      }],
    }));
    expect(with529.form1040.totalIncome).toBe(base.form1040.totalIncome + 5000);
  });

  it('529 penalty increases totalTax', () => {
    const base = calculateForm1040(baseTaxReturn());
    const with529 = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'Plan',
        grossDistribution: 10000, earnings: 5000, basisReturn: 5000,
        qualifiedExpenses: 0, distributionType: 'non_qualified',
      }],
    }));
    // The penalty is 500 (10% of 5000), but totalTax also includes income tax increase
    expect(with529.form1040.penalty529).toBe(500);
    expect(with529.form1040.totalTax).toBeGreaterThan(base.form1040.totalTax + 499);
  });

  it('DISTRIBUTION_529 constant is correct', () => {
    expect(DISTRIBUTION_529.PENALTY_RATE).toBe(0.10);
  });

  // ── Pro-rata formula tests (IRC §529(c)(3)(B), Pub 970 Ch. 8) ──

  it('AQEE computation: QEE reduced by scholarships and credit expenses', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'Plan',
        grossDistribution: 20000, earnings: 6000, basisReturn: 14000,
        qualifiedExpenses: 15000,
        taxFreeAssistance: 3000,
        expensesClaimedForCredit: 2000,
        distributionType: 'non_qualified',
      }],
    }));
    // AQEE = 15000 - 3000 - 2000 = 10000
    // exclusionRatio = 10000 / 20000 = 0.5
    // taxFreeEarnings = 6000 * 0.5 = 3000
    // taxable = 6000 - 3000 = 3000
    expect(result.form1040.taxable529Income).toBe(3000);
    expect(result.form1040.penalty529).toBe(300);
  });

  it('AQEE >= distribution: all earnings excluded (ratio capped at 1.0)', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'Plan',
        grossDistribution: 10000, earnings: 4000, basisReturn: 6000,
        qualifiedExpenses: 15000,
        distributionType: 'non_qualified',
      }],
    }));
    // AQEE = 15000, exclusionRatio = min(1, 15000/10000) = 1.0
    // taxFreeEarnings = 4000 * 1.0 = 4000, taxable = 0
    expect(result.form1040.taxable529Income).toBe(0);
    expect(result.form1040.penalty529).toBe(0);
  });

  it('zero gross distribution: safe divide-by-zero, no taxable earnings', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'Plan',
        grossDistribution: 0, earnings: 0, basisReturn: 0,
        qualifiedExpenses: 0,
        distributionType: 'non_qualified',
      }],
    }));
    // grossDistribution=0 → exclusionRatio=1, taxFreeEarnings=0*1=0, taxable=0
    expect(result.form1040.taxable529Income).toBe(0);
    expect(result.form1040.penalty529).toBe(0);
  });

  it('100% earnings distribution with partial QEE', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'Plan',
        grossDistribution: 10000, earnings: 10000, basisReturn: 0,
        qualifiedExpenses: 6000,
        distributionType: 'non_qualified',
      }],
    }));
    // exclusionRatio = 6000/10000 = 0.6
    // taxFreeEarnings = 10000 * 0.6 = 6000
    // taxable = 10000 - 6000 = 4000
    expect(result.form1040.taxable529Income).toBe(4000);
    expect(result.form1040.penalty529).toBe(400);
  });

  it('AQEE exactly equals distribution: all earnings excluded', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'Plan',
        grossDistribution: 12000, earnings: 5000, basisReturn: 7000,
        qualifiedExpenses: 12000,
        distributionType: 'non_qualified',
      }],
    }));
    // exclusionRatio = min(1, 12000/12000) = 1.0
    // taxFreeEarnings = 5000 * 1.0 = 5000, taxable = 0
    expect(result.form1040.taxable529Income).toBe(0);
    expect(result.form1040.penalty529).toBe(0);
  });

  it('large scholarship exceeds QEE: AQEE clamped to 0, all earnings taxable', () => {
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'Plan',
        grossDistribution: 15000, earnings: 5000, basisReturn: 10000,
        qualifiedExpenses: 8000,
        taxFreeAssistance: 10000,
        distributionType: 'non_qualified',
      }],
    }));
    // AQEE = max(0, 8000 - 10000) = 0
    // exclusionRatio = 0/15000 = 0, taxFreeEarnings = 0
    // taxable = 5000
    expect(result.form1040.taxable529Income).toBe(5000);
    expect(result.form1040.penalty529).toBe(500);
  });

  it('Pub 970 worksheet example: full worked scenario', () => {
    // Realistic scenario: $25k distribution, $8k earnings, $17k basis
    // QEE $18k, scholarship $3k, credit expenses $2k
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'State 529',
        grossDistribution: 25000, earnings: 8000, basisReturn: 17000,
        qualifiedExpenses: 18000,
        taxFreeAssistance: 3000,
        expensesClaimedForCredit: 2000,
        distributionType: 'non_qualified',
      }],
    }));
    // AQEE = 18000 - 3000 - 2000 = 13000
    // exclusionRatio = 13000/25000 = 0.52
    // taxFreeEarnings = 8000 * 0.52 = 4160
    // taxable = 8000 - 4160 = 3840
    expect(result.form1040.taxable529Income).toBe(3840);
    expect(result.form1040.penalty529).toBe(384);
  });

  it('backward compatibility: old returns without new fields default to 0 (AQEE = QEE)', () => {
    // Simulate an old return that doesn't have the new fields
    const result = calculateForm1040(baseTaxReturn({
      income1099Q: [{
        id: 'q-1', payerName: 'Plan',
        grossDistribution: 20000, earnings: 6000, basisReturn: 14000,
        qualifiedExpenses: 4000,
        // taxFreeAssistance and expensesClaimedForCredit intentionally absent
        distributionType: 'non_qualified',
      }],
    }));
    // AQEE = 4000 - 0 - 0 = 4000
    // exclusionRatio = 4000/20000 = 0.2
    // taxFreeEarnings = 6000 * 0.2 = 1200, taxable = 4800
    expect(result.form1040.taxable529Income).toBe(4800);
    expect(result.form1040.penalty529).toBe(480);
  });
});

// ════════════════════════════════════════════════════════
// Integration: All Sprint 15 features together
// ════════════════════════════════════════════════════════

describe('Sprint 15: Integration — all features combined', () => {
  it('taxpayer with all 5 Sprint 15 features', () => {
    const result = calculateForm1040(baseTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w2-1', employerName: 'BigCo', wages: 100000, federalTaxWithheld: 15000 }],
      // A1: Alimony received (pre-2019)
      alimonyReceived: {
        totalReceived: 18000,
        payerSSNLastFour: '4567',
        divorceDate: '2017-08-15',
      },
      // A2: Multiple businesses
      businesses: [
        { id: 'biz-1', businessName: 'Consulting', accountingMethod: 'cash', didStartThisYear: false },
        { id: 'biz-2', businessName: 'E-commerce', accountingMethod: 'cash', didStartThisYear: true },
      ],
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 40000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office', amount: 3000, businessId: 'biz-1' },
        { id: 'e2', scheduleCLine: 18, category: 'shipping', amount: 2000, businessId: 'biz-2' },
      ],
      // A3: K-1 with Section 179
      incomeK1: [{
        id: 'k1-1', entityName: 'Investment LLC', entityType: 'partnership',
        ordinaryBusinessIncome: 25000,
        guaranteedPayments: 5000,
        section179Deduction: 8000,
      }],
      // A4: Excess contributions
      excessContributions: {
        iraExcessContribution: 1500,
        hsaExcessContribution: 500,
      },
      // A5: Non-qualified 529
      income1099Q: [{
        id: 'q-1', payerName: 'State Plan',
        grossDistribution: 12000, earnings: 4000, basisReturn: 8000,
        qualifiedExpenses: 0, distributionType: 'non_qualified',
      }],
    }));

    // Verify each feature
    expect(result.form1040.alimonyReceivedIncome).toBe(18000);
    expect(result.scheduleC).toBeDefined();
    expect(result.scheduleC!.businessResults).toBeDefined();
    expect(result.scheduleC!.businessResults!.length).toBe(2);
    expect(result.form1040.k1Section179Deduction).toBe(8000);
    expect(result.form1040.excessContributionPenalty).toBe(120); // 6% of (1500+500) = 120
    expect(result.form1040.taxable529Income).toBe(4000);
    expect(result.form1040.penalty529).toBe(400);

    // Verify all features contribute to final calculation
    expect(result.form1040.totalIncome).toBeGreaterThan(0);
    expect(result.form1040.totalTax).toBeGreaterThan(0);
    expect(result.form1040.amountOwed + result.form1040.refundAmount).toBeGreaterThanOrEqual(0);
  });

  it('existing 866+ tests baseline: base return still computes correctly', () => {
    const result = calculateForm1040(baseTaxReturn());
    expect(result.form1040.totalWages).toBe(60000);
    expect(result.form1040.agi).toBeGreaterThan(0);
    expect(result.form1040.taxableIncome).toBeGreaterThan(0);
    expect(result.form1040.incomeTax).toBeGreaterThan(0);
    // Sprint 15 fields all zero for base case
    expect(result.form1040.alimonyReceivedIncome).toBe(0);
    expect(result.form1040.excessContributionPenalty).toBe(0);
    expect(result.form1040.taxable529Income).toBe(0);
    expect(result.form1040.penalty529).toBe(0);
    expect(result.form1040.k1Section179Deduction).toBe(0);
  });
});
