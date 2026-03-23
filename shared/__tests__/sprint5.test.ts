import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { routeK1Income, aggregateK1Income } from '../src/engine/k1.js';
import { calculateHSADistribution, aggregateHSADistributions } from '../src/engine/hsaDistributions.js';
import { TaxReturn, FilingStatus, IncomeK1, Income1099SA } from '../src/types/index.js';

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test',
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

// ═══════════════════════════════════════════════════
// Sprint 5A: Schedule K-1 Routing
// ═══════════════════════════════════════════════════

describe('Sprint 5A — K-1 Income Routing', () => {
  describe('routeK1Income (unit)', () => {
    it('routes partnership ordinary income as SE income', () => {
      const k1: IncomeK1 = {
        id: '1',
        entityName: 'ABC Partners',
        entityType: 'partnership',
        ordinaryBusinessIncome: 50000,
        guaranteedPayments: 10000,
      };
      const result = routeK1Income(k1);
      expect(result.ordinaryBusinessIncome).toBe(50000);
      expect(result.guaranteedPayments).toBe(10000);
      // Partnership: SE = ordinary + guaranteed
      expect(result.selfEmploymentIncome).toBe(60000);
      expect(result.totalSEIncome).toBe(60000);
    });

    it('does NOT route S-Corp income as SE income', () => {
      const k1: IncomeK1 = {
        id: '2',
        entityName: 'XYZ Corp',
        entityType: 's_corp',
        ordinaryBusinessIncome: 50000,
        guaranteedPayments: 10000,
      };
      const result = routeK1Income(k1);
      expect(result.ordinaryBusinessIncome).toBe(50000);
      // S-Corp: no SE income
      expect(result.selfEmploymentIncome).toBe(0);
      expect(result.totalSEIncome).toBe(0);
    });

    it('excludes passive partnership ordinary income from SE (IRC §1402(a)(13))', () => {
      const k1: IncomeK1 = {
        id: 'passive1',
        entityName: 'Harbor Point Rentals LLC',
        entityType: 'partnership',
        ordinaryBusinessIncome: -4500,
        isPassiveActivity: true,
      };
      const result = routeK1Income(k1);
      expect(result.ordinaryBusinessIncome).toBe(-4500);
      // Passive partnership: ordinary income excluded from SE per IRC §1402(a)(13)
      expect(result.selfEmploymentIncome).toBe(0);
      expect(result.totalSEIncome).toBe(0);
    });

    it('includes guaranteed payments in SE even for passive partnership', () => {
      const k1: IncomeK1 = {
        id: 'passive2',
        entityName: 'Passive LP with GP',
        entityType: 'partnership',
        ordinaryBusinessIncome: 20000,
        guaranteedPayments: 5000,
        isPassiveActivity: true,
      };
      const result = routeK1Income(k1);
      // Passive: guaranteed payments are ALWAYS SE income (IRC §707(c))
      // But ordinary business income is excluded per IRC §1402(a)(13)
      expect(result.selfEmploymentIncome).toBe(5000);
      expect(result.totalSEIncome).toBe(5000);
    });

    it('routes interest and dividends correctly', () => {
      const k1: IncomeK1 = {
        id: '3',
        entityName: 'Fund LP',
        entityType: 'partnership',
        interestIncome: 1000,
        ordinaryDividends: 5000,
        qualifiedDividends: 3000,
      };
      const result = routeK1Income(k1);
      expect(result.interestIncome).toBe(1000);
      expect(result.ordinaryDividends).toBe(5000);
      expect(result.qualifiedDividends).toBe(3000);
    });

    it('caps qualified dividends at ordinary dividends', () => {
      const k1: IncomeK1 = {
        id: '4',
        entityName: 'Fund LP',
        entityType: 'partnership',
        ordinaryDividends: 2000,
        qualifiedDividends: 5000, // exceeds ordinary
      };
      const result = routeK1Income(k1);
      expect(result.qualifiedDividends).toBe(2000); // capped
    });

    it('routes capital gains and section 1231 gains', () => {
      const k1: IncomeK1 = {
        id: '5',
        entityName: 'Real Estate LP',
        entityType: 'partnership',
        shortTermCapitalGain: 2000,
        longTermCapitalGain: 8000,
        netSection1231Gain: 5000,
      };
      const result = routeK1Income(k1);
      expect(result.shortTermCapitalGain).toBe(2000);
      expect(result.longTermCapitalGain).toBe(8000);
      expect(result.netSection1231Gain).toBe(5000);
      // Section 1231 net gain treated as LTCG for preferential rates
      expect(result.totalPreferentialIncome).toBe(13000); // 8000 + 5000
    });

    it('routes rental income and royalties', () => {
      const k1: IncomeK1 = {
        id: '6',
        entityName: 'Property LP',
        entityType: 'partnership',
        rentalIncome: 12000,
        royalties: 3000,
      };
      const result = routeK1Income(k1);
      expect(result.rentalIncome).toBe(12000);
      expect(result.royalties).toBe(3000);
    });

    it('routes Section 199A QBI', () => {
      const k1: IncomeK1 = {
        id: '7',
        entityName: 'Services LLC',
        entityType: 'partnership',
        ordinaryBusinessIncome: 100000,
        section199AQBI: 90000,
      };
      const result = routeK1Income(k1);
      expect(result.section199AQBI).toBe(90000);
    });

    it('uses explicit Box 14 Code A SE earnings when provided', () => {
      const k1: IncomeK1 = {
        id: '8',
        entityName: 'Partners LP',
        entityType: 'partnership',
        ordinaryBusinessIncome: 50000,
        guaranteedPayments: 10000,
        selfEmploymentIncome: 55000, // explicit Box 14 Code A
      };
      const result = routeK1Income(k1);
      // Should use explicit value instead of computed
      expect(result.selfEmploymentIncome).toBe(55000);
    });

    it('handles empty K-1 with all defaults', () => {
      const k1: IncomeK1 = {
        id: '9',
        entityName: 'Empty LLC',
        entityType: 'partnership',
      };
      const result = routeK1Income(k1);
      expect(result.totalIncome).toBe(0);
      expect(result.totalSEIncome).toBe(0);
    });
  });

  describe('aggregateK1Income (unit)', () => {
    it('aggregates multiple K-1s', () => {
      const k1s: IncomeK1[] = [
        { id: '1', entityName: 'A', entityType: 'partnership', ordinaryBusinessIncome: 30000, guaranteedPayments: 5000 },
        { id: '2', entityName: 'B', entityType: 's_corp', ordinaryBusinessIncome: 20000 },
      ];
      const result = aggregateK1Income(k1s);
      expect(result.ordinaryBusinessIncome).toBe(50000);
      expect(result.guaranteedPayments).toBe(5000);
      // Only partnership has SE income
      expect(result.totalSEIncome).toBe(35000);
    });

    it('returns zeros for empty array', () => {
      const result = aggregateK1Income([]);
      expect(result.totalIncome).toBe(0);
      expect(result.totalSEIncome).toBe(0);
    });
  });

  describe('K-1 integration (form1040)', () => {
    it('includes partnership K-1 income in total income and SE tax', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        incomeK1: [{
          id: '1',
          entityName: 'ABC Partners',
          entityType: 'partnership',
          ordinaryBusinessIncome: 80000,
          guaranteedPayments: 20000,
        }],
      });
      const result = calculateForm1040(tr);
      // K-1 ordinary income should appear in total income
      expect(result.form1040.k1OrdinaryIncome).toBe(100000); // ordinary + guaranteed
      expect(result.form1040.totalIncome).toBeGreaterThanOrEqual(100000);
      // SE tax should apply
      expect(result.form1040.seTax).toBeGreaterThan(0);
      expect(result.form1040.k1SEIncome).toBe(100000);
    });

    it('includes S-Corp K-1 income without SE tax', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        incomeK1: [{
          id: '1',
          entityName: 'XYZ Corp',
          entityType: 's_corp',
          ordinaryBusinessIncome: 80000,
        }],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.k1OrdinaryIncome).toBe(80000);
      expect(result.form1040.totalIncome).toBeGreaterThanOrEqual(80000);
      // No SE tax for S-Corp
      expect(result.form1040.k1SEIncome).toBe(0);
      expect(result.form1040.seTax).toBe(0);
    });

    it('K-1 interest and dividends combine with 1099 totals', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        income1099INT: [{ id: '1', payerName: 'Bank', amount: 500 }],
        income1099DIV: [{ id: '1', payerName: 'Broker', ordinaryDividends: 2000, qualifiedDividends: 1500 }],
        incomeK1: [{
          id: '1',
          entityName: 'Fund LP',
          entityType: 'partnership',
          interestIncome: 300,
          ordinaryDividends: 1000,
          qualifiedDividends: 800,
        }],
      });
      const result = calculateForm1040(tr);
      // Combined interest: 500 + 300 = 800
      expect(result.form1040.totalInterest).toBe(800);
      // Combined dividends: 2000 + 1000 = 3000
      expect(result.form1040.totalDividends).toBe(3000);
    });

    it('K-1 Section 199A QBI flows to QBI deduction', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        incomeK1: [{
          id: '1',
          entityName: 'Services LLC',
          entityType: 'partnership',
          ordinaryBusinessIncome: 100000,
          section199AQBI: 100000,
        }],
      });
      const result = calculateForm1040(tr);
      // QBI deduction should be present (20% of QBI, subject to limits)
      expect(result.form1040.qbiDeduction).toBeGreaterThan(0);
    });

    it('K-1 withholding is included in total withholding', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        incomeK1: [{
          id: '1',
          entityName: 'ABC Partners',
          entityType: 'partnership',
          ordinaryBusinessIncome: 50000,
          federalTaxWithheld: 5000,
        }],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.totalWithholding).toBeGreaterThanOrEqual(5000);
    });

    it('no K-1 data produces no K-1 related amounts', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.k1OrdinaryIncome).toBe(0);
      expect(result.form1040.k1SEIncome).toBe(0);
      expect(result.k1Routing).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════
// Sprint 5B: HSA Distributions (1099-SA)
// ═══════════════════════════════════════════════════

describe('Sprint 5B — HSA Distributions', () => {
  describe('calculateHSADistribution (unit)', () => {
    it('qualified medical expense distribution is tax-free', () => {
      const dist: Income1099SA = {
        id: '1',
        payerName: 'Fidelity HSA',
        grossDistribution: 3000,
        distributionCode: '1',
        qualifiedMedicalExpenses: true,
      };
      const result = calculateHSADistribution(dist);
      expect(result.taxableAmount).toBe(0);
      expect(result.penaltyAmount).toBe(0);
      expect(result.isQualifiedMedical).toBe(true);
    });

    it('non-qualified Code 1 distribution is taxable with 20% penalty', () => {
      const dist: Income1099SA = {
        id: '2',
        payerName: 'Fidelity HSA',
        grossDistribution: 5000,
        distributionCode: '1',
        qualifiedMedicalExpenses: false,
      };
      const result = calculateHSADistribution(dist);
      expect(result.taxableAmount).toBe(5000);
      expect(result.penaltyAmount).toBe(1000); // 20% of $5,000
      expect(result.isQualifiedMedical).toBe(false);
    });

    it('Code 3 (disability) is always tax-free', () => {
      const dist: Income1099SA = {
        id: '3',
        payerName: 'Fidelity HSA',
        grossDistribution: 5000,
        distributionCode: '3',
        qualifiedMedicalExpenses: false,
      };
      const result = calculateHSADistribution(dist);
      expect(result.taxableAmount).toBe(0);
      expect(result.penaltyAmount).toBe(0);
      expect(result.isQualifiedMedical).toBe(true); // treated as qualified
    });

    it('Code 2 (excess contributions) is taxable with penalty', () => {
      const dist: Income1099SA = {
        id: '4',
        payerName: 'Fidelity HSA',
        grossDistribution: 2000,
        distributionCode: '2',
        qualifiedMedicalExpenses: false,
      };
      const result = calculateHSADistribution(dist);
      expect(result.taxableAmount).toBe(2000);
      expect(result.penaltyAmount).toBe(400); // 20%
    });

    it('Code 5 (prohibited transaction) is taxable with penalty', () => {
      const dist: Income1099SA = {
        id: '5',
        payerName: 'Fidelity HSA',
        grossDistribution: 10000,
        distributionCode: '5',
        qualifiedMedicalExpenses: false,
      };
      const result = calculateHSADistribution(dist);
      expect(result.taxableAmount).toBe(10000);
      expect(result.penaltyAmount).toBe(2000); // 20%
    });

    it('Code 4 (death) is taxable but NO penalty per IRC §223(f)(4)(C)', () => {
      const dist: Income1099SA = {
        id: '6',
        payerName: 'Fidelity HSA',
        grossDistribution: 8000,
        distributionCode: '4',
        qualifiedMedicalExpenses: false,
      };
      const result = calculateHSADistribution(dist);
      expect(result.taxableAmount).toBe(8000);
      expect(result.penaltyAmount).toBe(0); // No penalty for death distributions
    });

    it('defaults to code 1 when no code specified', () => {
      const dist: Income1099SA = {
        id: '7',
        payerName: 'Fidelity HSA',
        grossDistribution: 3000,
        qualifiedMedicalExpenses: false,
      };
      const result = calculateHSADistribution(dist);
      expect(result.distributionCode).toBe('1');
      expect(result.taxableAmount).toBe(3000);
      expect(result.penaltyAmount).toBe(600);
    });
  });

  describe('aggregateHSADistributions (unit)', () => {
    it('aggregates multiple distributions', () => {
      const dists: Income1099SA[] = [
        { id: '1', payerName: 'A', grossDistribution: 3000, distributionCode: '1', qualifiedMedicalExpenses: true },
        { id: '2', payerName: 'B', grossDistribution: 2000, distributionCode: '1', qualifiedMedicalExpenses: false },
      ];
      const result = aggregateHSADistributions(dists, false);
      expect(result.totalTaxable).toBe(2000);
      expect(result.totalPenalty).toBe(400); // 20% of $2,000
      expect(result.results.length).toBe(2);
    });

    it('suppresses penalty for age 65+', () => {
      const dists: Income1099SA[] = [
        { id: '1', payerName: 'A', grossDistribution: 5000, distributionCode: '1', qualifiedMedicalExpenses: false },
      ];
      const result = aggregateHSADistributions(dists, true); // age 65+
      expect(result.totalTaxable).toBe(5000); // still taxable
      expect(result.totalPenalty).toBe(0); // no penalty for 65+
    });

    it('returns zeros for empty array', () => {
      const result = aggregateHSADistributions([], false);
      expect(result.totalTaxable).toBe(0);
      expect(result.totalPenalty).toBe(0);
      expect(result.results.length).toBe(0);
    });
  });

  describe('HSA integration (form1040)', () => {
    it('adds taxable HSA distribution to income and applies penalty', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
        income1099SA: [{
          id: '1',
          payerName: 'Fidelity HSA',
          grossDistribution: 5000,
          distributionCode: '1',
          qualifiedMedicalExpenses: false,
        }],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.hsaDistributionTaxable).toBe(5000);
      expect(result.form1040.hsaDistributionPenalty).toBe(1000); // 20%
      expect(result.form1040.totalIncome).toBeGreaterThanOrEqual(55000); // wages + HSA
      expect(result.form1040.totalTax).toBeGreaterThan(0);
    });

    it('qualified HSA distribution is not taxable', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
        income1099SA: [{
          id: '1',
          payerName: 'Fidelity HSA',
          grossDistribution: 3000,
          distributionCode: '1',
          qualifiedMedicalExpenses: true,
        }],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.hsaDistributionTaxable).toBe(0);
      expect(result.form1040.hsaDistributionPenalty).toBe(0);
    });

    it('waives penalty for age 65+ taxpayer', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        dateOfBirth: '1955-01-01', // age 70 in 2025
        w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
        income1099SA: [{
          id: '1',
          payerName: 'Fidelity HSA',
          grossDistribution: 5000,
          distributionCode: '1',
          qualifiedMedicalExpenses: false,
        }],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.hsaDistributionTaxable).toBe(5000); // still taxable
      expect(result.form1040.hsaDistributionPenalty).toBe(0); // no penalty for 65+
    });

    it('1099-SA withholding is included in total withholding', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        income1099SA: [{
          id: '1',
          payerName: 'Fidelity HSA',
          grossDistribution: 5000,
          distributionCode: '1',
          qualifiedMedicalExpenses: false,
          federalTaxWithheld: 500,
        }],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.totalWithholding).toBeGreaterThanOrEqual(500);
    });

    it('no 1099-SA produces no HSA amounts', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.hsaDistributionTaxable).toBe(0);
      expect(result.form1040.hsaDistributionPenalty).toBe(0);
      expect(result.hsaDistributions).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════
// Combined Integration Tests
// ═══════════════════════════════════════════════════

describe('Sprint 5 — Combined Integration', () => {
  it('K-1 and HSA together with W-2 income', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 7000 }],
      incomeK1: [{
        id: '1',
        entityName: 'Partners LLC',
        entityType: 'partnership',
        ordinaryBusinessIncome: 40000,
        interestIncome: 500,
        section199AQBI: 40000,
      }],
      income1099SA: [{
        id: '1',
        payerName: 'HSA Trust',
        grossDistribution: 2000,
        distributionCode: '1',
        qualifiedMedicalExpenses: false,
      }],
    });
    const result = calculateForm1040(tr);

    // K-1 income included
    expect(result.form1040.k1OrdinaryIncome).toBe(40000);
    expect(result.form1040.k1SEIncome).toBe(40000);
    expect(result.form1040.seTax).toBeGreaterThan(0);

    // HSA distribution included
    expect(result.form1040.hsaDistributionTaxable).toBe(2000);
    expect(result.form1040.hsaDistributionPenalty).toBe(400);

    // QBI deduction from K-1
    expect(result.form1040.qbiDeduction).toBeGreaterThan(0);

    // Total income includes everything
    expect(result.form1040.totalIncome).toBeGreaterThanOrEqual(102000); // 60k + 40k + 2k
  });

  it('multiple K-1s from different entity types', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      incomeK1: [
        {
          id: '1',
          entityName: 'Partnership A',
          entityType: 'partnership',
          ordinaryBusinessIncome: 30000,
          guaranteedPayments: 5000,
        },
        {
          id: '2',
          entityName: 'S-Corp B',
          entityType: 's_corp',
          ordinaryBusinessIncome: 50000,
        },
      ],
    });
    const result = calculateForm1040(tr);

    // Only partnership income is SE income
    expect(result.form1040.k1SEIncome).toBe(35000); // 30k + 5k
    // But both contribute to total income
    expect(result.form1040.k1OrdinaryIncome).toBeGreaterThanOrEqual(85000);
  });

  it('Sprint 5 features do not break baseline W-2 only return', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const result = calculateForm1040(tr);

    // Basic return should work normally
    expect(result.form1040.totalWages).toBe(50000);
    expect(result.form1040.totalIncome).toBe(50000);
    expect(result.form1040.k1OrdinaryIncome).toBe(0);
    expect(result.form1040.k1SEIncome).toBe(0);
    expect(result.form1040.hsaDistributionTaxable).toBe(0);
    expect(result.form1040.hsaDistributionPenalty).toBe(0);
    expect(result.k1Routing).toBeUndefined();
    expect(result.hsaDistributions).toBeUndefined();
  });

  // ── Bug #12: QBI deduction net capital gain (IRC §199A(a)(2)) ──

  it('reduces QBI deduction by net capital gain from qualified dividends (Bug #12)', () => {
    // Self-employed consultant with qualified dividends
    // Sch C net = $80,000, QD = $5,000 from dividends
    // Standard deduction (Single) = $15,000
    // AGI ≈ $80,000 - $5,652 (1/2 SE) = $74,348
    // Taxable before QBI ≈ $74,348 - $15,000 = $59,348
    // Net capital gain = $5,000 (qualified dividends, no LTCG)
    // QBI deduction = 20% × min(QBI, taxable − NCG)
    //               = 20% × min(~$74K, $59,348 − $5,000) = 20% × ~$54,348
    // Without fix: would use 20% × $59,348
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      businesses: [{
        id: 'biz1', businessName: 'Test Consulting', principalBusinessCode: '541610',
        businessDescription: 'Consulting', accountingMethod: 'cash', didStartThisYear: false,
      }],
      income1099NEC: [{ id: 'nec1', payerName: 'Client', amount: 80000 }],
      income1099DIV: [{
        id: 'div1', payerName: 'Vanguard', ordinaryDividends: 5000, qualifiedDividends: 5000,
      }],
      qbiInfo: { isSSTB: true, w2WagesPaidByBusiness: 0, ubiaOfQualifiedProperty: 0 },
    });
    const result = calculateForm1040(tr);

    // With net capital gain subtracted, QBI deduction should be lower
    // The taxable income limit = 20% × (taxable − $5K QD)
    // Without fix: 20% × taxable (higher)
    const qbi = result.form1040.qbiDeduction;

    // Verify QBI < 20% × taxable income (proves net capital gain was subtracted)
    const taxableBeforeQBI = result.form1040.agi - result.form1040.deductionAmount;
    const maxWithoutNCG = Math.round(taxableBeforeQBI * 0.20 * 100) / 100;
    const maxWithNCG = Math.round(Math.max(0, taxableBeforeQBI - 5000) * 0.20 * 100) / 100;

    // QBI should be limited to the NCG-reduced amount, not the full taxable amount
    expect(qbi).toBeLessThanOrEqual(maxWithNCG + 1); // +1 for rounding tolerance
    expect(qbi).toBeLessThan(maxWithoutNCG); // strictly less when QD > 0
  });
});
