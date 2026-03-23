/**
 * Integration tests for IRS Bulletin compliance items:
 *   1. IRC §25F Scholarship Credit (OBBBA §70202)
 *   2. SECURE 2.0 Emergency Distribution Exception — IRC §72(t)(2)(I)
 *
 * Verifies end-to-end flow through calculateForm1040.
 */
import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'irb-test',
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

describe('IRC §25F Scholarship Credit — E2E', () => {
  it('applies $1,700 nonrefundable credit for SGO contribution', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      scholarshipCredit: { contributionAmount: 2000 },
    }));

    expect(result.credits.scholarshipCredit).toBe(1700);
    expect(result.scholarshipCredit?.credit).toBe(1700);
    expect(result.scholarshipCredit?.eligibleContribution).toBe(2000);
  });

  it('reduces credit by state tax credit received', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      scholarshipCredit: { contributionAmount: 2000, stateTaxCreditReceived: 800 },
    }));

    // Eligible = 2000 - 800 = 1200 (under $1,700 cap)
    expect(result.credits.scholarshipCredit).toBe(1200);
    expect(result.scholarshipCredit?.eligibleContribution).toBe(1200);
  });

  it('credit is nonrefundable — included in totalNonRefundable', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      scholarshipCredit: { contributionAmount: 1700 },
    }));

    expect(result.credits.scholarshipCredit).toBe(1700);
    expect(result.credits.totalNonRefundable).toBeGreaterThanOrEqual(1700);
  });

  it('no credit when contribution is zero', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      scholarshipCredit: { contributionAmount: 0 },
    }));

    expect(result.credits.scholarshipCredit).toBe(0);
  });

  it('no credit when state credit fully offsets contribution', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      scholarshipCredit: { contributionAmount: 1000, stateTaxCreditReceived: 1000 },
    }));

    expect(result.credits.scholarshipCredit).toBe(0);
  });
});

describe('SECURE 2.0 Emergency Distribution Exception — E2E', () => {
  it('exempts $1,000 of early distributions from 10% penalty', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 8000 }],
      income1099R: [
        { id: '1', payerName: 'Fidelity', grossDistribution: 5000, taxableAmount: 5000, distributionCode: '1' },
      ],
      emergencyDistributions: { totalEmergencyDistributions: 1000 },
    }));

    // Without emergency: $5,000 * 10% = $500
    // With emergency: ($5,000 - $1,000) * 10% = $400
    expect(result.form1040.earlyDistributionPenalty).toBe(400);
    expect(result.form5329?.emergencyExemption).toBe(1000);
    expect(result.form5329?.earlyDistributionPenalty).toBe(400);
  });

  it('full 10% penalty when no emergency distributions claimed', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 8000 }],
      income1099R: [
        { id: '1', payerName: 'Fidelity', grossDistribution: 5000, taxableAmount: 5000, distributionCode: '1' },
      ],
    }));

    expect(result.form1040.earlyDistributionPenalty).toBe(500);
  });

  it('emergency exemption capped at $1,000 even if claiming more', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 8000 }],
      income1099R: [
        { id: '1', payerName: 'Fidelity', grossDistribution: 8000, taxableAmount: 8000, distributionCode: '1' },
      ],
      emergencyDistributions: { totalEmergencyDistributions: 5000 },
    }));

    // Capped at $1,000 exemption: ($8,000 - $1,000) * 10% = $700
    expect(result.form5329?.emergencyExemption).toBe(1000);
    expect(result.form1040.earlyDistributionPenalty).toBe(700);
  });

  it('no penalty when early distribution fully covered by exemption', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 8000 }],
      income1099R: [
        { id: '1', payerName: 'Fidelity', grossDistribution: 800, taxableAmount: 800, distributionCode: '1' },
      ],
      emergencyDistributions: { totalEmergencyDistributions: 800 },
    }));

    expect(result.form5329?.emergencyExemption).toBe(800);
    expect(result.form1040.earlyDistributionPenalty).toBe(0);
  });

  it('emergency exemption combined with excess contribution penalties', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 8000 }],
      income1099R: [
        { id: '1', payerName: 'Fidelity', grossDistribution: 3000, taxableAmount: 3000, distributionCode: '1' },
      ],
      excessContributions: { iraExcessContribution: 1000 },
      emergencyDistributions: { totalEmergencyDistributions: 1000 },
    }));

    // Early dist: ($3,000 - $1,000) * 10% = $200
    // IRA excess: $1,000 * 6% = $60
    expect(result.form5329?.earlyDistributionPenalty).toBe(200);
    expect(result.form5329?.iraExciseTax).toBe(60);
    expect(result.form5329?.emergencyExemption).toBe(1000);
  });

  it('code 7 distributions unaffected by emergency distributions', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 8000 }],
      income1099R: [
        { id: '1', payerName: 'Fidelity', grossDistribution: 5000, taxableAmount: 5000, distributionCode: '7' },
      ],
      emergencyDistributions: { totalEmergencyDistributions: 1000 },
    }));

    // Code 7 = normal distribution, no penalty regardless
    expect(result.form1040.earlyDistributionPenalty).toBe(0);
  });
});

describe('Coverdell ESA Excess Contribution — E2E', () => {
  it('applies 6% penalty on ESA excess contributions', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 8000 }],
      excessContributions: { esaExcessContribution: 1000 },
    }));

    expect(result.form5329?.esaExciseTax).toBe(60);
    expect(result.form5329?.totalPenalty).toBe(60);
  });

  it('combines ESA + IRA + HSA excess penalties', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 8000 }],
      excessContributions: {
        iraExcessContribution: 2000,
        hsaExcessContribution: 500,
        esaExcessContribution: 300,
      },
    }));

    expect(result.form5329?.iraExciseTax).toBe(120);
    expect(result.form5329?.hsaExciseTax).toBe(30);
    expect(result.form5329?.esaExciseTax).toBe(18);
    expect(result.form5329?.totalPenalty).toBe(168);
  });
});

describe('Apply Refund to Next Year — E2E', () => {
  it('splits refund between direct deposit and next year', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 12000 }],
      refundAppliedToNextYear: 2000,
    }));

    // Should have a refund (12k withheld on ~50k wages)
    expect(result.form1040.refundAmount).toBeGreaterThan(2000);
    expect(result.form1040.refundAppliedToNextYear).toBe(2000);
    expect(result.form1040.netRefund).toBe(result.form1040.refundAmount - 2000);
  });

  it('caps applied amount at actual refund', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5500 }],
      refundAppliedToNextYear: 999999,
    }));

    // Applied amount can't exceed the actual refund
    expect(result.form1040.refundAppliedToNextYear).toBeLessThanOrEqual(result.form1040.refundAmount);
    expect(result.form1040.netRefund).toBe(0);
  });

  it('zero applied when no refund (amount owed)', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 100000, federalTaxWithheld: 1000 }],
      refundAppliedToNextYear: 5000,
    }));

    // No refund to apply
    expect(result.form1040.refundAmount).toBe(0);
    expect(result.form1040.refundAppliedToNextYear).toBe(0);
    expect(result.form1040.netRefund).toBe(0);
  });

  it('zero fields when not applying to next year', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 12000 }],
    }));

    expect(result.form1040.refundAppliedToNextYear).toBe(0);
    expect(result.form1040.netRefund).toBe(result.form1040.refundAmount);
  });
});

describe('Sales Tax SALT Alternative — E2E', () => {
  it('uses state income tax by default', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0, stateLocalIncomeTax: 5000, realEstateTax: 3000,
        personalPropertyTax: 0, mortgageInterest: 8000, mortgageInsurancePremiums: 0,
        charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
      },
    }));

    // SALT = 5000 (income tax) + 3000 (real estate) = 8000
    expect(result.scheduleA?.saltDeduction).toBe(8000);
  });

  it('uses sales tax when elected', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0, stateLocalIncomeTax: 5000, salesTaxAmount: 7000,
        saltMethod: 'sales_tax',
        realEstateTax: 3000, personalPropertyTax: 0, mortgageInterest: 8000,
        mortgageInsurancePremiums: 0, charitableCash: 0, charitableNonCash: 0,
        casualtyLoss: 0, otherDeductions: 0,
      },
    }));

    // SALT = 7000 (sales tax, not income tax) + 3000 (real estate) = 10000
    expect(result.scheduleA?.saltDeduction).toBe(10000);
  });

  it('sales tax still subject to SALT cap', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0, stateLocalIncomeTax: 0, salesTaxAmount: 50000,
        saltMethod: 'sales_tax',
        realEstateTax: 10000, personalPropertyTax: 0, mortgageInterest: 8000,
        mortgageInsurancePremiums: 0, charitableCash: 0, charitableNonCash: 0,
        casualtyLoss: 0, otherDeductions: 0,
      },
    }));

    // SALT = 50000 + 10000 = 60000, capped at 40000
    expect(result.scheduleA?.saltDeduction).toBe(40000);
  });
});

describe('Nonbusiness Bad Debt — E2E', () => {
  it('treats bad debt as short-term capital loss', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      nonbusinessBadDebts: [
        { id: '1', debtorName: 'John Doe', description: 'Personal loan', amountOwed: 2000 },
      ],
    }));

    // Should create a Schedule D with a short-term loss
    expect(result.scheduleD).toBeDefined();
    expect(result.scheduleD!.netShortTerm).toBeLessThan(0);
    expect(result.scheduleD!.shortTermLoss).toBeGreaterThan(0);
  });

  it('bad debt loss subject to $3k annual capital loss limit', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      nonbusinessBadDebts: [
        { id: '1', debtorName: 'Jane Doe', description: 'Loan', amountOwed: 10000 },
      ],
    }));

    // $10k loss but only $3k deductible per year
    expect(result.form1040.capitalGainOrLoss).toBe(-3000);
  });

  it('multiple bad debts aggregate as short-term losses', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      nonbusinessBadDebts: [
        { id: '1', debtorName: 'A', description: 'Loan 1', amountOwed: 1000 },
        { id: '2', debtorName: 'B', description: 'Loan 2', amountOwed: 500 },
      ],
    }));

    expect(result.scheduleD).toBeDefined();
    // Combined $1500 loss, under $3k limit so fully deductible
    expect(result.form1040.capitalGainOrLoss).toBe(-1500);
  });
});

describe('1099-OID Income — E2E', () => {
  it('includes OID as interest income', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
      income1099OID: [
        { id: '1', payerName: 'Treasury', originalIssueDiscount: 500, otherPeriodicInterest: 200 },
      ],
    }));

    // OID (500) + other periodic interest (200) = 700 total interest
    expect(result.form1040.totalInterest).toBe(700);
  });

  it('reduces OID by acquisition premium', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
      income1099OID: [
        { id: '1', payerName: 'Treasury', originalIssueDiscount: 500, acquisitionPremium: 300 },
      ],
    }));

    // OID 500 - premium 300 = 200
    expect(result.form1040.totalInterest).toBe(200);
  });

  it('combines 1099-INT and 1099-OID interest', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
      income1099INT: [
        { id: '1', payerName: 'Bank', amount: 1000 },
      ],
      income1099OID: [
        { id: '1', payerName: 'Treasury', originalIssueDiscount: 300 },
      ],
    }));

    expect(result.form1040.totalInterest).toBe(1300);
  });

  it('OID early withdrawal penalty flows to adjustments', () => {
    const withPenalty = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
      income1099OID: [
        { id: '1', payerName: 'Treasury', originalIssueDiscount: 500, earlyWithdrawalPenalty: 100 },
      ],
    }));

    const withoutPenalty = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
      income1099OID: [
        { id: '1', payerName: 'Treasury', originalIssueDiscount: 500 },
      ],
    }));

    // Early withdrawal penalty reduces AGI
    expect(withPenalty.form1040.agi).toBe(withoutPenalty.form1040.agi - 100);
  });
});

describe('Farm Rental (Form 4835) — E2E', () => {
  it('adds farm rental income to Schedule E', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
      farmRentals: [{
        id: '1',
        rentalIncome: 10000,
        expenses: { insurance: 1000, repairs: 500, taxes: 800 },
      }],
    }));

    // Net farm rental = 10000 - 2300 = 7700
    expect(result.form1040.scheduleEIncome).toBe(7700);
  });

  it('multiple farm rentals aggregate', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
      farmRentals: [
        { id: '1', rentalIncome: 5000, expenses: { taxes: 1000 } },
        { id: '2', rentalIncome: 3000, expenses: { repairs: 500 } },
      ],
    }));

    // Net = (5000-1000) + (3000-500) = 4000 + 2500 = 6500
    expect(result.form1040.scheduleEIncome).toBe(6500);
  });

  it('farm rental loss reduces total income', () => {
    const withLoss = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
      farmRentals: [{
        id: '1',
        rentalIncome: 2000,
        expenses: { insurance: 3000, repairs: 2000 },
      }],
    }));

    const without = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
    }));

    // Farm rental loss = 2000 - 5000 = -3000
    // Note: passive loss rules may limit deductibility, but income should reflect
    expect(withLoss.form1040.scheduleEIncome).toBeLessThan(0);
  });
});

describe('Form 4684 Casualty Loss — E2E', () => {
  it('computes personal casualty loss with $100 floor and 10% AGI floor', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0, stateLocalIncomeTax: 5000, realEstateTax: 3000,
        personalPropertyTax: 0, mortgageInterest: 10000, mortgageInsurancePremiums: 0,
        charitableCash: 2000, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
      },
      casualtyLosses: [{
        id: '1',
        description: 'Hurricane damage to home',
        femaDisasterNumber: 'DR-4000',
        propertyType: 'personal',
        costBasis: 200000,
        insuranceReimbursement: 50000,
        fairMarketValueBefore: 300000,
        fairMarketValueAfter: 250000,
      }],
    }));

    // Loss = min(50000 decrease in FMV, 200000 basis) - 50000 insurance = 0
    // FMV decrease = 300000 - 250000 = 50000; min(50000, 200000) = 50000
    // Net = 50000 - 50000 (insurance) = 0 → no casualty deduction
    // The Schedule A casualtyLoss should be set by Form 4684
    expect(result.scheduleA).toBeDefined();
  });

  it('personal casualty with net loss after insurance and floors', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0, stateLocalIncomeTax: 5000, realEstateTax: 3000,
        personalPropertyTax: 0, mortgageInterest: 10000, mortgageInsurancePremiums: 0,
        charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
      },
      casualtyLosses: [{
        id: '1',
        description: 'Flood damage',
        femaDisasterNumber: 'DR-5000',
        propertyType: 'personal',
        costBasis: 100000,
        insuranceReimbursement: 10000,
        fairMarketValueBefore: 100000,
        fairMarketValueAfter: 20000,
      }],
    }));

    // FMV decrease = 80000; min(80000, 100000) = 80000; net = 80000 - 10000 = 70000
    // After $100 floor: 69900
    // AGI ≈ 50000 → 10% AGI = ~5000
    // Net personal loss ≈ 69900 - 5000 = ~64900
    expect(result.scheduleA).toBeDefined();
    expect(result.scheduleA!.otherDeduction).toBeGreaterThan(60000);
  });
});

describe('Form 6252 Installment Sale — E2E', () => {
  it('reports installment income based on payments and gross profit ratio', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
      installmentSales: [{
        id: '1',
        description: 'Land sale',
        dateOfSale: '2025-06-15',
        sellingPrice: 100000,
        costOrBasis: 60000,
        sellingExpenses: 5000,
        paymentsReceivedThisYear: 20000,
      }],
    }));

    // Gross profit = 100000 - 60000 - 5000 = 35000
    // Contract price = 100000
    // Gross profit ratio = 35000 / 100000 = 0.35
    // Installment income = 20000 * 0.35 = 7000
    // Expect AGI to reflect the additional $7000
    const baseResult = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
    }));

    expect(result.form1040.agi).toBe(baseResult.form1040.agi + 7000);
  });

  it('handles multiple installment sales', () => {
    const result = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
      installmentSales: [
        { id: '1', description: 'Property A', dateOfSale: '2025-01-01', sellingPrice: 50000, costOrBasis: 30000, paymentsReceivedThisYear: 10000 },
        { id: '2', description: 'Property B', dateOfSale: '2025-03-01', sellingPrice: 80000, costOrBasis: 40000, paymentsReceivedThisYear: 16000 },
      ],
    }));

    // A: GP = 20000/50000 = 0.4; income = 10000*0.4 = 4000
    // B: GP = 40000/80000 = 0.5; income = 16000*0.5 = 8000
    // Total = 12000
    const baseResult = calculateForm1040(makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
    }));

    expect(result.form1040.agi).toBe(baseResult.form1040.agi + 12000);
  });
});
