import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

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

describe('calculateForm1040 — Freelancer Scenario', () => {
  it('calculates full return for a single freelancer earning $100k', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [
        { id: '1', payerName: 'Client A', amount: 60000 },
        { id: '2', payerName: 'Client B', amount: 40000 },
      ],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office_expense', amount: 2000 },
        { id: 'e2', scheduleCLine: 25, category: 'utilities', amount: 3600 },
        { id: 'e3', scheduleCLine: 27, category: 'software', amount: 4400 },
      ],
      homeOffice: { method: 'simplified', squareFeet: 200 },
    });

    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // Schedule C: 100000 - 10000 expenses - 1000 home office = 89000
    expect(result.scheduleC).toBeDefined();
    expect(result.scheduleC!.grossIncome).toBe(100000);
    expect(result.scheduleC!.totalExpenses).toBe(10000);
    expect(result.scheduleC!.homeOfficeDeduction).toBe(1000);
    expect(result.scheduleC!.netProfit).toBe(89000);

    // SE tax on 89000
    expect(result.scheduleSE).toBeDefined();
    expect(result.scheduleSE!.netEarnings).toBeGreaterThan(0);

    // Income = 89000 (Schedule C net profit)
    expect(f.totalIncome).toBe(89000);

    // AGI = totalIncome - SE deduction - health insurance - retirement
    expect(f.agi).toBeLessThan(f.totalIncome);
    expect(f.seDeduction).toBeGreaterThan(0);

    // Standard deduction for single
    expect(f.standardDeduction).toBe(15750);
    expect(f.deductionUsed).toBe('standard');

    // QBI deduction should be > 0
    expect(f.qbiDeduction).toBeGreaterThan(0);

    // Taxable income = AGI - standard deduction - QBI (use toBeCloseTo for float precision)
    expect(f.taxableIncome).toBeCloseTo(Math.max(0, f.agi - f.deductionAmount - f.qbiDeduction), 2);

    // Has both income tax and SE tax
    expect(f.incomeTax).toBeGreaterThan(0);
    expect(f.seTax).toBeGreaterThan(0);

    // No withholding for freelancer → owes money
    expect(f.totalWithholding).toBe(0);
    expect(f.amountOwed).toBeGreaterThan(0);
    expect(f.refundAmount).toBe(0);

    // Estimated quarterly should be ~1/4 of what's owed
    expect(f.estimatedQuarterlyPayment).toBeGreaterThan(0);
  });
});

describe('calculateForm1040 — W-2 Employee Scenario', () => {
  it('calculates full return for a MFJ W-2 employee earning $120k', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [
        {
          id: 'w1',
          employerName: 'BigCorp',
          wages: 120000,
          federalTaxWithheld: 18000,
          socialSecurityWages: 120000,
          socialSecurityTax: 7440,
          medicareWages: 120000,
          medicareTax: 1740,
          stateTaxWithheld: 5000,
        },
      ],
    });

    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // No Schedule C or SE
    expect(result.scheduleC).toBeUndefined();
    expect(result.scheduleSE).toBeUndefined();

    // Income = wages
    expect(f.totalWages).toBe(120000);
    expect(f.totalIncome).toBe(120000);

    // No adjustments for W-2 employee
    expect(f.totalAdjustments).toBe(0);
    expect(f.agi).toBe(120000);

    // MFJ standard deduction
    expect(f.standardDeduction).toBe(31500);
    expect(f.deductionUsed).toBe('standard');

    // No QBI for W-2
    expect(f.qbiDeduction).toBe(0);

    // Taxable income = 120000 - 31500 = 88500
    expect(f.taxableIncome).toBe(88500);

    // No SE tax
    expect(f.seTax).toBe(0);

    // Has withholding
    expect(f.totalWithholding).toBe(18000);

    // Should get a refund or owe a small amount
    expect(f.amountOwed + f.refundAmount).toBeGreaterThan(0);
  });
});

describe('calculateForm1040 — Mixed Income Scenario', () => {
  it('handles W-2 + freelance + interest + dividends', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [
        {
          id: 'w1',
          employerName: 'DayCorp',
          wages: 80000,
          federalTaxWithheld: 12000,
          socialSecurityWages: 80000,
          socialSecurityTax: 4960,
        },
      ],
      income1099NEC: [
        { id: 'n1', payerName: 'Side Client', amount: 20000 },
      ],
      income1099INT: [
        { id: 'i1', payerName: 'Bank', amount: 500 },
      ],
      income1099DIV: [
        { id: 'd1', payerName: 'Vanguard', ordinaryDividends: 1200, qualifiedDividends: 1000 },
      ],
      expenses: [
        { id: 'e1', scheduleCLine: 27, category: 'software', amount: 3000 },
      ],
    });

    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // Has Schedule C for the freelance income
    expect(result.scheduleC).toBeDefined();
    expect(result.scheduleC!.grossIncome).toBe(20000);
    expect(result.scheduleC!.netProfit).toBe(17000);

    // Total income = wages + interest + dividends + schedule C net
    expect(f.totalWages).toBe(80000);
    expect(f.totalInterest).toBe(500);
    expect(f.totalDividends).toBe(1200);
    expect(f.scheduleCNetProfit).toBe(17000);
    expect(f.totalIncome).toBe(98700);

    // Has both SE deduction and withholding
    expect(f.seDeduction).toBeGreaterThan(0);
    expect(f.totalWithholding).toBe(12000);

    // QBI deduction from schedule C income
    expect(f.qbiDeduction).toBeGreaterThan(0);
  });
});

describe('calculateForm1040 — Itemized Deductions', () => {
  it('uses itemized when they exceed standard deduction', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [
        {
          id: 'w1',
          employerName: 'Corp',
          wages: 150000,
          federalTaxWithheld: 25000,
        },
      ],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 15000, // 7.5% of ~$150k AGI = $11,250 floor → $3,750 deductible
        stateLocalIncomeTax: 8000,
        realEstateTax: 5000,   // Total SALT = 13000, under $40k cap
        personalPropertyTax: 0,
        mortgageInterest: 6000,
        mortgageInsurancePremiums: 0,
        charitableCash: 3000,
        charitableNonCash: 500,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    });

    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    // Schedule A should be computed
    expect(result.scheduleA).toBeDefined();
    expect(result.scheduleA!.saltDeduction).toBe(13000); // Under $40k SALT cap

    // Check if itemized > standard ($15,750 for single)
    const totalItemized = result.scheduleA!.totalItemized;
    if (totalItemized > 15750) {
      expect(f.deductionUsed).toBe('itemized');
      expect(f.deductionAmount).toBe(totalItemized);
    } else {
      expect(f.deductionUsed).toBe('standard');
    }
  });
});

describe('calculateForm1040 — Credits', () => {
  it('applies child tax credit', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [
        {
          id: 'w1',
          employerName: 'Corp',
          wages: 100000,
          federalTaxWithheld: 12000,
        },
      ],
      childTaxCredit: {
        qualifyingChildren: 2,
        otherDependents: 0,
      },
    });

    const result = calculateForm1040(taxReturn);

    // $2,200 per child * 2 = $4,400
    expect(result.credits.childTaxCredit).toBe(4400);
    expect(result.credits.totalCredits).toBe(4400);

    // Tax after credits should be reduced
    expect(result.form1040.taxAfterCredits).toBeLessThan(result.form1040.incomeTax + result.form1040.seTax);
  });

  it('applies education credit (AOTC)', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [
        {
          id: 'w1',
          employerName: 'Corp',
          wages: 60000,
          federalTaxWithheld: 8000,
        },
      ],
      educationCredits: [
        {
          type: 'american_opportunity',
          studentName: 'Student',
          institution: 'University',
          tuitionPaid: 5000,
          scholarships: 0,
        },
      ],
    });

    const result = calculateForm1040(taxReturn);

    // AOTC: 100% of first $2000 + 25% of next $2000 = $2500
    // educationCredit = 60% non-refundable = $1500
    // aotcRefundableCredit = 40% refundable = $1000
    expect(result.credits.educationCredit).toBe(1500);
    expect(result.credits.aotcRefundableCredit).toBe(1000);
  });
});
