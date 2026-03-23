/**
 * Filing Options Service Unit Tests
 *
 * Tests eligibility assessment for IRS free filing programs
 * and the Transfer Guide data generation.
 */

import { describe, it, expect } from 'vitest';
import type {
  TaxReturn,
  CalculationResult,
  Form1040Result,
  CreditsResult,
  ScheduleCResult,
  ScheduleSEResult,
  ScheduleAResult,
  ScheduleDResult,
  ScheduleEResult,
} from '../src/types/index.js';
import { FilingStatus } from '../src/types/index.js';
import {
  assessFilingOptions,
  generateTransferGuide,
  FREE_FILE_AGI_LIMIT,
  VITA_AGI_LIMIT,
} from '../src/services/filingOptionsService.js';

// ─── Helpers ─────────────────────────────────────

function makeForm1040(overrides: Partial<Form1040Result> = {}): Form1040Result {
  return {
    totalWages: 52470,
    totalInterest: 1200,
    taxExemptInterest: 0,
    totalDividends: 0,
    qualifiedDividends: 0,
    totalCapitalGainDistributions: 0,
    scheduleDNetGain: 0,
    capitalLossDeduction: 0,
    capitalGainOrLoss: 0,
    taxableSocialSecurity: 0,
    socialSecurityBenefits: 0,
    scheduleEIncome: 0,
    royaltyIncome: 0,
    totalRetirementIncome: 0,
    iraDistributionsGross: 0,
    iraDistributionsTaxable: 0,
    pensionDistributionsGross: 0,
    pensionDistributionsTaxable: 0,
    totalUnemployment: 0,
    total1099MISCIncome: 0,
    scheduleCNetProfit: 0,
    rothConversionTaxable: 0,
    totalIncome: 53670,
    seDeduction: 0,
    selfEmployedHealthInsurance: 0,
    retirementContributions: 0,
    hsaDeduction: 0,
    hsaDeductionComputed: 0,
    studentLoanInterest: 0,
    iraDeduction: 0,
    educatorExpenses: 0,
    earlyWithdrawalPenalty: 0,
    feieExclusion: 0,
    nolDeduction: 0,
    totalAdjustments: 0,
    agi: 53670,
    standardDeduction: 15350,
    itemizedDeduction: 0,
    deductionUsed: 'standard',
    deductionAmount: 15350,
    qbiDeduction: 0,
    schedule1ADeduction: 0,
    homeSaleExclusion: 0,
    taxableIncome: 38320,
    k1OrdinaryIncome: 0,
    k1SEIncome: 0,
    hsaDistributionTaxable: 0,
    hsaDistributionPenalty: 0,
    incomeTax: 4400,
    preferentialTax: 0,
    section1250Tax: 0,
    amtAmount: 0,
    seTax: 0,
    niitTax: 0,
    additionalMedicareTaxW2: 0,
    earlyDistributionPenalty: 0,
    kiddieTaxAmount: 0,
    householdEmploymentTax: 0,
    estimatedTaxPenalty: 0,
    totalTax: 4400,
    totalCredits: 0,
    taxAfterCredits: 4400,
    totalWithholding: 6000,
    estimatedPayments: 0,
    totalPayments: 6000,
    refundAmount: 1600,
    amountOwed: 0,
    totalGamblingIncome: 0,
    cancellationOfDebtIncome: 0,
    investmentInterestDeduction: 0,
    alimonyDeduction: 0,
    alimonyReceivedIncome: 0,
    excessContributionPenalty: 0,
    taxable529Income: 0,
    penalty529: 0,
    k1Section179Deduction: 0,
    premiumTaxCreditNet: 0,
    excessAPTCRepayment: 0,
    form4797OrdinaryIncome: 0,
    form4797Section1231GainOrLoss: 0,
    form4137Tax: 0,
    scheduleFNetProfit: 0,
    foreignTaxPaid: 0,
    extensionFiled: false,
    effectiveTaxRate: 0.082,
    marginalTaxRate: 0.22,
    estimatedQuarterlyPayment: 0,
    ...overrides,
  } as Form1040Result;
}

function makeCredits(overrides: Partial<CreditsResult> = {}): CreditsResult {
  return {
    childTaxCredit: 0,
    otherDependentCredit: 0,
    actcCredit: 0,
    educationCredit: 0,
    aotcRefundableCredit: 0,
    dependentCareCredit: 0,
    saversCredit: 0,
    cleanEnergyCredit: 0,
    evCredit: 0,
    energyEfficiencyCredit: 0,
    foreignTaxCredit: 0,
    adoptionCredit: 0,
    evRefuelingCredit: 0,
    elderlyDisabledCredit: 0,
    k1OtherCredits: 0,
    premiumTaxCredit: 0,
    excessSSTaxCredit: 0,
    eitcCredit: 0,
    totalNonRefundable: 0,
    totalRefundable: 0,
    totalCredits: 0,
    ...overrides,
  } as CreditsResult;
}

function makeCalc(overrides: {
  form1040?: Partial<Form1040Result>;
  credits?: Partial<CreditsResult>;
  scheduleC?: Partial<ScheduleCResult>;
  scheduleSE?: Partial<ScheduleSEResult>;
  scheduleA?: Partial<ScheduleAResult>;
  scheduleD?: Partial<ScheduleDResult>;
  scheduleE?: Partial<ScheduleEResult>;
} = {}): CalculationResult {
  return {
    form1040: makeForm1040(overrides.form1040),
    credits: makeCredits(overrides.credits),
    scheduleC: overrides.scheduleC as ScheduleCResult | undefined,
    scheduleSE: overrides.scheduleSE as ScheduleSEResult | undefined,
    scheduleA: overrides.scheduleA as ScheduleAResult | undefined,
    scheduleD: overrides.scheduleD as ScheduleDResult | undefined,
    scheduleE: overrides.scheduleE as ScheduleEResult | undefined,
  } as CalculationResult;
}

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return',
    schemaVersion: 1,
    taxYear: 2025,
    status: 'completed',
    currentStep: 0,
    currentSection: 'finish',
    filingStatus: FilingStatus.Single,
    firstName: 'Jane',
    lastName: 'Doe',
    ssn: '123-45-6789',
    addressStreet: '123 Main St',
    addressCity: 'Springfield',
    addressState: 'IL',
    addressZip: '62704',
    dateOfBirth: '1990-05-15',
    w2Income: [{ employer: 'Acme Corp', wages: 52470, federalWithheld: 6000 }],
    income1099NEC: [],
    businesses: [],
    ...overrides,
  } as TaxReturn;
}

// ─── assessFilingOptions ─────────────────────────

describe('assessFilingOptions', () => {
  describe('freeFile', () => {
    it('eligible when AGI <= $89,000', () => {
      const calc = makeCalc({ form1040: { agi: 50000 } });
      const result = assessFilingOptions(makeTaxReturn(), calc);
      expect(result.freeFile.status).toBe('eligible');
    });

    it('eligible at exactly $89,000', () => {
      const calc = makeCalc({ form1040: { agi: FREE_FILE_AGI_LIMIT } });
      const result = assessFilingOptions(makeTaxReturn(), calc);
      expect(result.freeFile.status).toBe('eligible');
    });

    it('not_eligible when AGI > $89,000', () => {
      const calc = makeCalc({ form1040: { agi: 95000 } });
      const result = assessFilingOptions(makeTaxReturn(), calc);
      expect(result.freeFile.status).toBe('not_eligible');
      expect(result.freeFile.reason).toContain('exceeds');
    });
  });

  describe('vita', () => {
    it('eligible when AGI <= $69,000', () => {
      const calc = makeCalc({ form1040: { agi: 50000 } });
      const result = assessFilingOptions(makeTaxReturn(), calc);
      expect(result.vita.status).toBe('eligible');
    });

    it('eligible at exactly $69,000', () => {
      const calc = makeCalc({ form1040: { agi: VITA_AGI_LIMIT } });
      const result = assessFilingOptions(makeTaxReturn(), calc);
      expect(result.vita.status).toBe('eligible');
    });

    it('not_eligible when AGI > $69,000', () => {
      const calc = makeCalc({ form1040: { agi: 75000 } });
      const result = assessFilingOptions(makeTaxReturn(), calc);
      expect(result.vita.status).toBe('not_eligible');
    });
  });

  describe('tce', () => {
    it('eligible when filer is 60+', () => {
      // Born 1960 → age 65 as of Dec 31, 2025
      const tr = makeTaxReturn({ dateOfBirth: '1960-03-10' });
      const calc = makeCalc();
      const result = assessFilingOptions(tr, calc);
      expect(result.tce.status).toBe('eligible');
      expect(result.tce.reason).toContain('65');
    });

    it('not_eligible when under 60', () => {
      // Born 1990 → age 35 as of Dec 31, 2025
      const tr = makeTaxReturn({ dateOfBirth: '1990-05-15' });
      const calc = makeCalc();
      const result = assessFilingOptions(tr, calc);
      expect(result.tce.status).toBe('not_eligible');
    });

    it('unknown when DOB is missing', () => {
      const tr = makeTaxReturn({ dateOfBirth: undefined });
      const calc = makeCalc();
      const result = assessFilingOptions(tr, calc);
      expect(result.tce.status).toBe('unknown');
    });

    it('eligible at exactly age 60', () => {
      // Born Dec 31, 1965 → age 60 as of Dec 31, 2025
      const tr = makeTaxReturn({ dateOfBirth: '1965-12-31' });
      const calc = makeCalc();
      const result = assessFilingOptions(tr, calc);
      expect(result.tce.status).toBe('eligible');
    });
  });

  describe('freeFileForms', () => {
    it('always eligible regardless of income', () => {
      const calc = makeCalc({ form1040: { agi: 500000 } });
      const result = assessFilingOptions(makeTaxReturn(), calc);
      expect(result.freeFileForms.status).toBe('eligible');
    });
  });
});

// ─── generateTransferGuide ───────────────────────

describe('generateTransferGuide', () => {
  it('includes Form 1040 for all returns', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc();
    const guide = generateTransferGuide(tr, calc);
    const f1040 = guide.forms.find(f => f.formId === 'f1040');
    expect(f1040).toBeDefined();
    expect(f1040!.formName).toContain('Form 1040');
  });

  it('includes Schedule C when businesses present', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({
      form1040: { scheduleCNetProfit: 30000 },
      scheduleC: {
        grossReceipts: 50000,
        returnsAndAllowances: 0,
        netReceipts: 50000,
        costOfGoodsSold: 0,
        grossProfit: 50000,
        otherBusinessIncome: 0,
        grossIncome: 50000,
        totalExpenses: 20000,
        tentativeProfit: 30000,
        homeOfficeDeduction: 0,
        vehicleDeduction: 0,
        netProfit: 30000,
        lineItems: {},
      },
    });
    const guide = generateTransferGuide(tr, calc);
    const schedC = guide.forms.find(f => f.formId === 'schedulec');
    expect(schedC).toBeDefined();
    expect(schedC!.lines.length).toBeGreaterThan(0);
  });

  it('excludes Schedule C when no businesses', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc();
    const guide = generateTransferGuide(tr, calc);
    const schedC = guide.forms.find(f => f.formId === 'schedulec');
    expect(schedC).toBeUndefined();
  });

  it('filters out zero-value lines', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ form1040: { totalWages: 52470, totalInterest: 0, totalDividends: 0 } });
    const guide = generateTransferGuide(tr, calc);
    const f1040 = guide.forms.find(f => f.formId === 'f1040')!;
    // Every line in the guide should have a non-zero value
    for (const line of f1040.lines) {
      expect(line.value).not.toBe(0);
    }
  });

  it('formats dollar amounts with $ and commas', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ form1040: { totalWages: 52470, agi: 52470 } });
    const guide = generateTransferGuide(tr, calc);
    const f1040 = guide.forms.find(f => f.formId === 'f1040')!;
    const wagesLine = f1040.lines.find(l => l.line === '1a');
    expect(wagesLine).toBeDefined();
    expect(wagesLine!.formattedValue).toBe('$52,470');
  });

  it('formats negative values with minus sign', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({
      form1040: { capitalGainOrLoss: -3000 },
      scheduleD: {
        shortTermGain: 0,
        shortTermLoss: 0,
        netShortTerm: 0,
        longTermGain: 0,
        longTermLoss: -5000,
        netLongTerm: -5000,
        netGainOrLoss: -5000,
        capitalLossDeduction: 3000,
        capitalLossCarryforward: 2000,
        capitalLossCarryforwardST: 0,
        capitalLossCarryforwardLT: 2000,
      },
    });
    const guide = generateTransferGuide(tr, calc);
    const f1040 = guide.forms.find(f => f.formId === 'f1040')!;
    const capGainLine = f1040.lines.find(l => l.line === '7');
    expect(capGainLine).toBeDefined();
    expect(capGainLine!.formattedValue).toBe('-$3,000');
  });

  it('resolves values from calculationResult', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ form1040: { agi: 82500 } });
    const guide = generateTransferGuide(tr, calc);
    const f1040 = guide.forms.find(f => f.formId === 'f1040')!;
    const agiLine = f1040.lines.find(l => l.line === '11');
    expect(agiLine).toBeDefined();
    expect(agiLine!.value).toBe(82500);
  });

  it('returns forms in definition order', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({
      form1040: { totalWages: 50000, agi: 50000, scheduleCNetProfit: 10000, seDeduction: 707 },
      scheduleC: {
        grossReceipts: 15000, returnsAndAllowances: 0, netReceipts: 15000,
        costOfGoodsSold: 0, grossProfit: 15000, otherBusinessIncome: 0,
        grossIncome: 15000, totalExpenses: 5000, tentativeProfit: 10000,
        homeOfficeDeduction: 0, vehicleDeduction: 0, netProfit: 10000, lineItems: {},
      },
      scheduleSE: {
        netEarnings: 9235, socialSecurityTax: 1145, medicareTax: 268,
        additionalMedicareTax: 0, totalSETax: 1413, deductibleHalf: 707,
      },
    });
    const guide = generateTransferGuide(tr, calc);
    const formIds = guide.forms.map(f => f.formId);
    expect(formIds.indexOf('f1040')).toBeLessThan(formIds.indexOf('schedulec'));
    expect(formIds.indexOf('schedulec')).toBeLessThan(formIds.indexOf('schedulese'));
  });

  it('handles empty return gracefully', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({
      form1040: {
        totalWages: 0, totalInterest: 0, totalDividends: 0,
        totalIncome: 0, agi: 0, deductionAmount: 0, taxableIncome: 0,
        incomeTax: 0, totalTax: 0, totalWithholding: 0, totalPayments: 0,
        refundAmount: 0, amountOwed: 0,
      },
    });
    const guide = generateTransferGuide(tr, calc);
    // Form 1040 may be empty (all zero) → no forms if all lines are zero
    expect(guide.forms.length).toBe(0);
  });

  it('includes Schedule A when itemizing', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({
      form1040: { deductionUsed: 'itemized', deductionAmount: 25000 },
      scheduleA: {
        medicalDeduction: 0,
        saltDeduction: 10000,
        interestDeduction: 12000,
        charitableDeduction: 3000,
        otherDeduction: 0,
        totalItemized: 25000,
      },
    });
    const guide = generateTransferGuide(tr, calc);
    const schedA = guide.forms.find(f => f.formId === 'schedulea');
    expect(schedA).toBeDefined();
    expect(schedA!.lines.length).toBeGreaterThanOrEqual(3);
  });

  it('includes Schedule E when rental income present', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({
      form1040: { scheduleEIncome: 12000 },
      scheduleE: {
        totalRentalIncome: 24000,
        totalRentalExpenses: 12000,
        netRentalIncome: 12000,
        allowableLoss: 0,
        suspendedLoss: 0,
        royaltyIncome: 0,
        scheduleEIncome: 12000,
      },
    });
    const guide = generateTransferGuide(tr, calc);
    const schedE = guide.forms.find(f => f.formId === 'schedulee');
    expect(schedE).toBeDefined();
  });

  it('includes generatedAt timestamp', () => {
    const before = new Date().toISOString();
    const guide = generateTransferGuide(makeTaxReturn(), makeCalc());
    const after = new Date().toISOString();
    expect(guide.generatedAt >= before).toBe(true);
    expect(guide.generatedAt <= after).toBe(true);
  });

  it('includes Schedule 1 when adjustments exist', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({
      form1040: {
        seDeduction: 2297,
        totalAdjustments: 2297,
        scheduleCNetProfit: 30000,
      },
    });
    const guide = generateTransferGuide(tr, calc);
    const sched1 = guide.forms.find(f => f.formId === 'schedule1');
    expect(sched1).toBeDefined();
    const seDeductLine = sched1!.lines.find(l => l.line === '15');
    expect(seDeductLine).toBeDefined();
    expect(seDeductLine!.value).toBe(2297);
  });
});

// ─── Constant sanity checks ─────────────────────

describe('constants', () => {
  it('FREE_FILE_AGI_LIMIT is $89,000', () => {
    expect(FREE_FILE_AGI_LIMIT).toBe(89000);
  });

  it('VITA_AGI_LIMIT is $69,000', () => {
    expect(VITA_AGI_LIMIT).toBe(69000);
  });

});
