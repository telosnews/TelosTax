import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateScheduleD } from '../src/engine/scheduleD.js';
import { calculateScheduleE } from '../src/engine/scheduleE.js';
import { calculateQBIDeduction, calculateMultiBusinessQBIDeduction } from '../src/engine/qbi.js';
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

// ═══════════════════════════════════════════════════
// Fix 1: Education Credits MFS Disqualification
// ═══════════════════════════════════════════════════

describe('Fix 1: Education Credits MFS Disqualification (IRC §25A(g)(6))', () => {
  it('MFS filer gets $0 AOTC', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      educationCredits: [{
        id: 'ec1',
        type: 'american_opportunity',
        studentName: 'Student',
        institution: 'University',
        tuitionPaid: 4000,
      }],
    });
    const result = calculateForm1040(tr);
    // MFS filers are completely ineligible for AOTC
    expect(result.credits.educationCredit).toBe(0);
    expect(result.credits.aotcRefundableCredit).toBe(0);
  });

  it('MFS filer gets $0 LLC', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      educationCredits: [{
        id: 'ec1',
        type: 'lifetime_learning',
        studentName: 'Student',
        institution: 'University',
        tuitionPaid: 8000,
      }],
    });
    const result = calculateForm1040(tr);
    expect(result.credits.educationCredit).toBe(0);
  });

  it('Single filer still gets AOTC (regression)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      educationCredits: [{
        id: 'ec1',
        type: 'american_opportunity',
        studentName: 'Student',
        institution: 'University',
        tuitionPaid: 4000,
      }],
    });
    const result = calculateForm1040(tr);
    // Single below $80K AGI: full AOTC = 2000 + 25% of 2000 = $2,500
    // Non-refundable: 60% = $1,500. Refundable: 40% = $1,000
    expect(result.credits.educationCredit + result.credits.aotcRefundableCredit).toBe(2500);
  });

  it('MFJ filer still gets LLC (regression)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      educationCredits: [{
        id: 'ec1',
        type: 'lifetime_learning',
        studentName: 'Student',
        institution: 'University',
        tuitionPaid: 8000,
      }],
    });
    const result = calculateForm1040(tr);
    // MFJ below $160K: full LLC = 20% of 8000 = $1,600 (fully non-refundable)
    expect(result.credits.educationCredit).toBe(1600);
  });
});

// ═══════════════════════════════════════════════════
// Fix 2: SE Health Insurance Cap at Net SE Profit
// ═══════════════════════════════════════════════════

describe('Fix 2: SE Health Insurance Cap at Net SE Profit (IRC §162(l))', () => {
  it('caps health insurance premium at net SE profit', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 20000, federalTaxWithheld: 0 }],
      selfEmploymentDeductions: {
        healthInsurancePremiums: 30000, // Exceeds net profit
        sepIraContributions: 0,
        solo401kContributions: 0,
        otherRetirementContributions: 0,
      },
    });
    const result = calculateForm1040(tr);
    // SE profit ~20000, but health premium is 30000 — should be capped
    expect(result.form1040.selfEmployedHealthInsurance).toBeLessThanOrEqual(
      result.form1040.scheduleC?.netProfit || 20000
    );
  });

  it('does not cap when premium is below SE profit', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000, federalTaxWithheld: 0 }],
      selfEmploymentDeductions: {
        healthInsurancePremiums: 10000,
        sepIraContributions: 0,
        solo401kContributions: 0,
        otherRetirementContributions: 0,
      },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.selfEmployedHealthInsurance).toBe(10000);
  });

  it('returns $0 health insurance deduction when SE income is zero', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      selfEmploymentDeductions: {
        healthInsurancePremiums: 15000,
        sepIraContributions: 0,
        solo401kContributions: 0,
        otherRetirementContributions: 0,
      },
    });
    const result = calculateForm1040(tr);
    // No SE income = $0 cap on SE health insurance
    expect(result.form1040.selfEmployedHealthInsurance).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// Fix 3: IRA Deduction Phase-Outs (MFS + Spouse Covered)
// ═══════════════════════════════════════════════════

describe('Fix 3: IRA Deduction Phase-Outs', () => {
  it('MFS + covered by employer plan: $0 deduction at income above $10K', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      iraContribution: 7000,
      coveredByEmployerPlan: true,
    });
    const result = calculateForm1040(tr);
    // MFS + covered: phase-out is $0-$10K. AGI ~$50K, well above $10K → $0 deduction
    expect(result.form1040.iraDeduction).toBe(0);
  });

  it('MFS + covered: partial deduction within $0-$10K range', () => {
    // Need low income to be within phase-out range
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 5000, federalTaxWithheld: 0 }],
      iraContribution: 5000,
      coveredByEmployerPlan: true,
    });
    const result = calculateForm1040(tr);
    // AGI ~$5K → 50% through phase-out → deduction = 5000 * 0.5 = $2500
    expect(result.form1040.iraDeduction).toBe(2500);
  });

  it('MFJ + spouse covered (taxpayer NOT covered): full deduction below $236K', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 200000, federalTaxWithheld: 30000 }],
      iraContribution: 7000,
      coveredByEmployerPlan: false,
      spouseCoveredByEmployerPlan: true,
    });
    const result = calculateForm1040(tr);
    // AGI ~$200K, below $236K spouse-covered threshold → full deduction
    expect(result.form1040.iraDeduction).toBe(7000);
  });

  it('MFJ + spouse covered: $0 deduction above $246K', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 300000, federalTaxWithheld: 50000 }],
      iraContribution: 7000,
      coveredByEmployerPlan: false,
      spouseCoveredByEmployerPlan: true,
    });
    const result = calculateForm1040(tr);
    // AGI ~$300K, above $246K → $0 deduction
    expect(result.form1040.iraDeduction).toBe(0);
  });

  it('MFJ + neither covered: full deduction at any income', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 500000, federalTaxWithheld: 80000 }],
      iraContribution: 7000,
      coveredByEmployerPlan: false,
      spouseCoveredByEmployerPlan: false,
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.iraDeduction).toBe(7000);
  });

  it('Single + covered: uses $79K-$89K phase-out (regression)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 84000, federalTaxWithheld: 10000 }],
      iraContribution: 7000,
      coveredByEmployerPlan: true,
    });
    const result = calculateForm1040(tr);
    // AGI ~$84K → 50% through $79K-$89K phase-out → partial deduction
    expect(result.form1040.iraDeduction).toBeGreaterThan(0);
    expect(result.form1040.iraDeduction).toBeLessThan(7000);
  });
});

// ═══════════════════════════════════════════════════
// Fix 4: Wash Sale Basis for Covered Securities
// ═══════════════════════════════════════════════════

describe('Fix 4: Wash Sale Adjustment Always Applied', () => {
  it('covered security (default): wash sale always adjusts basis', () => {
    // 1099-B Box 1e always reports ORIGINAL basis; Box 1g is a separate adjustment.
    // basisReportedToIRS only determines Form 8949 box (A/D vs B/E), not basis adjustment.
    const result = calculateScheduleD(
      [{
        id: '1', brokerName: 'Broker', description: '100 AAPL',
        dateSold: '2025-03-15', proceeds: 7000, costBasis: 10000,
        isLongTerm: false, washSaleLossDisallowed: 2000,
        // basisReportedToIRS is undefined → Box A on Form 8949
      }],
      0, FilingStatus.Single,
    );
    // adjustedBasis = 10000 - 2000 = 8000, loss = 7000 - 8000 = -1000
    expect(result.netShortTerm).toBe(-1000);
  });

  it('covered security (explicit true): same adjustment as default', () => {
    const result = calculateScheduleD(
      [{
        id: '1', brokerName: 'Broker', description: '100 AAPL',
        dateSold: '2025-03-15', proceeds: 7000, costBasis: 10000,
        isLongTerm: false, washSaleLossDisallowed: 2000,
        basisReportedToIRS: true,
      }],
      0, FilingStatus.Single,
    );
    // Same formula: adjustedBasis = 10000 - 2000 = 8000, loss = -1000
    expect(result.netShortTerm).toBe(-1000);
  });

  it('non-covered security: applies wash sale adjustment to basis', () => {
    const result = calculateScheduleD(
      [{
        id: '1', brokerName: 'Broker', description: '100 AAPL',
        dateSold: '2025-03-15', proceeds: 7000, costBasis: 10000,
        isLongTerm: false, washSaleLossDisallowed: 2000,
        basisReportedToIRS: false,
      }],
      0, FilingStatus.Single,
    );
    // Non-covered: adjustedBasis = 10000 - 2000 = 8000, loss = 7000 - 8000 = -1000
    expect(result.netShortTerm).toBe(-1000);
  });

  it('no wash sale: same result regardless of covered status', () => {
    const result = calculateScheduleD(
      [{
        id: '1', brokerName: 'Broker', description: '100 GOOG',
        dateSold: '2025-05-01', proceeds: 15000, costBasis: 10000,
        isLongTerm: true, washSaleLossDisallowed: 0,
      }],
      0, FilingStatus.Single,
    );
    expect(result.netLongTerm).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════
// Fix 5: K-1 Rental Income Through Passive Loss Rules
// ═══════════════════════════════════════════════════

describe('Fix 5: K-1 Rental Income Through Schedule E', () => {
  it('K-1 rental profit offsets direct rental loss', () => {
    const result = calculateScheduleE(
      [{
        id: 'r1', address: '123 Main St', propertyType: 'single_family',
        daysRented: 365, personalUseDays: 0, rentalIncome: 10000,
        mortgageInterest: 20000, taxes: 8000, insurance: 2000,
        // Total expenses: 30000, Net: 10000 - 30000 = -20000
      }],
      10000, // K-1 rental profit
    );
    // Direct rental net: -20000, K-1: +10000, Combined: -10000 (raw)
    expect(result.scheduleEIncome).toBe(-10000);
    expect(result.suspendedLoss).toBe(0);
  });

  it('K-1 rental loss returns raw amount', () => {
    const result = calculateScheduleE(
      [], // No direct properties
      -30000, // K-1 rental loss
    );
    // Raw K-1 loss flows through (no passive loss limitation)
    expect(result.scheduleEIncome).toBe(-30000);
    expect(result.suspendedLoss).toBe(0);
  });

  it('K-1 rental loss returns raw amount regardless of AGI', () => {
    const result = calculateScheduleE(
      [],
      -15000,
    );
    // Raw K-1 rental loss flows through
    expect(result.scheduleEIncome).toBe(-15000);
    expect(result.suspendedLoss).toBe(0);
  });

  it('K-1 rental profit with no direct properties flows through', () => {
    const result = calculateScheduleE(
      [],
      12000, // K-1 rental profit
    );
    expect(result.scheduleEIncome).toBe(12000);
    expect(result.suspendedLoss).toBe(0);
  });

  it('K-1 rental income routes through Schedule E in form1040 (integration)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      incomeK1: [{
        id: 'k1-1',
        entityName: 'Property LP',
        entityType: 'partnership',
        rentalIncome: 15000,
      }],
    });
    const result = calculateForm1040(tr);
    // K-1 rental income should flow through Schedule E, not directly to income
    expect(result.scheduleE).toBeDefined();
    expect(result.scheduleE!.scheduleEIncome).toBe(15000);
  });
});

// ═══════════════════════════════════════════════════
// Fix 6: QBI Multi-Business Support
// ═══════════════════════════════════════════════════

describe('Fix 6: QBI Multi-Business Support', () => {
  it('below threshold: combined 20% of total QBI (no per-business limitation)', () => {
    const deduction = calculateMultiBusinessQBIDeduction(
      [
        { businessId: 'b1', qualifiedBusinessIncome: 50000, isSSTB: true, w2WagesPaid: 0, ubiaOfQualifiedProperty: 0 },
        { businessId: 'b2', qualifiedBusinessIncome: 30000, isSSTB: false, w2WagesPaid: 10000, ubiaOfQualifiedProperty: 0 },
      ],
      100000, // taxableIncomeBeforeQBI — below $197,300 Single threshold
      FilingStatus.Single,
    );
    // 20% of 80000 = $16,000
    expect(deduction).toBe(16000);
  });

  it('above threshold: SSTB phases out, non-SSTB uses W-2/UBIA limit', () => {
    const deduction = calculateMultiBusinessQBIDeduction(
      [
        // SSTB business: fully above threshold + range → $0
        { businessId: 'b1', qualifiedBusinessIncome: 50000, isSSTB: true, w2WagesPaid: 0, ubiaOfQualifiedProperty: 0 },
        // Non-SSTB business: above threshold, has W-2 wages
        { businessId: 'b2', qualifiedBusinessIncome: 100000, isSSTB: false, w2WagesPaid: 80000, ubiaOfQualifiedProperty: 0 },
      ],
      300000, // taxableIncomeBeforeQBI — above $197,300 + $50K phase-in for Single
      FilingStatus.Single,
    );
    // SSTB: fully phased out at $247,300+ → $0
    // Non-SSTB: min(20% of 100000, 50% of 80000) = min(20000, 40000) = $20,000
    // Total = $20,000
    expect(deduction).toBe(20000);
  });

  it('empty businesses array returns $0', () => {
    const deduction = calculateMultiBusinessQBIDeduction(
      [],
      100000,
      FilingStatus.Single,
    );
    expect(deduction).toBe(0);
  });

  it('legacy single-business path still works (integration)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 80000, federalTaxWithheld: 0 }],
      qbiInfo: {
        isSSTB: false,
        w2WagesPaidByBusiness: 0,
        ubiaOfQualifiedProperty: 0,
        // No businesses array → legacy path
      },
    });
    const result = calculateForm1040(tr);
    // Schedule C profit ~80000, 20% QBI = ~16000 (may be less due to expenses/SE tax)
    expect(result.form1040.qbiDeduction).toBeGreaterThan(0);
  });

  it('multi-business path used when businesses array present (integration)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 80000, federalTaxWithheld: 0 }],
      qbiInfo: {
        businesses: [
          { businessId: 'b1', qualifiedBusinessIncome: 80000, isSSTB: false, w2WagesPaid: 0, ubiaOfQualifiedProperty: 0 },
        ],
      },
    });
    const result = calculateForm1040(tr);
    // Below threshold → 20% of QBI
    expect(result.form1040.qbiDeduction).toBeGreaterThan(0);
  });

  it('combined deduction capped at 20% of taxable income', () => {
    const deduction = calculateMultiBusinessQBIDeduction(
      [
        { businessId: 'b1', qualifiedBusinessIncome: 100000, isSSTB: false, w2WagesPaid: 50000, ubiaOfQualifiedProperty: 0 },
      ],
      10000, // Very low taxable income
      FilingStatus.Single,
    );
    // 20% of QBI = $20,000 but 20% of taxable income = $2,000
    expect(deduction).toBe(2000);
  });
});
