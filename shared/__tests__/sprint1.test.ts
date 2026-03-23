import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateScheduleC } from '../src/engine/scheduleC.js';
import { calculateCredits } from '../src/engine/credits.js';
import { TaxReturn, FilingStatus, Dependent } from '../src/types/index.js';

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

// ─── Sprint 1A: Early Withdrawal Penalty ──────────────────────

describe('Sprint 1A — Early Withdrawal Penalty (1099-INT Box 2)', () => {
  it('reduces AGI by early withdrawal penalty amount', () => {
    // Single filer, $50k wages, $500 early withdrawal penalty
    // totalIncome = 50000 + 2000 (interest) = 52000
    // totalAdjustments = 500 (early withdrawal penalty)
    // AGI = 52000 - 500 = 51500
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099INT: [
        { id: 'i1', payerName: 'Bank A', amount: 2000, earlyWithdrawalPenalty: 500 },
      ],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.earlyWithdrawalPenalty).toBe(500);
    expect(f.totalAdjustments).toBe(500);
    expect(f.agi).toBe(51500);
  });

  it('sums penalties from multiple 1099-INTs', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099INT: [
        { id: 'i1', payerName: 'Bank A', amount: 1000, earlyWithdrawalPenalty: 200 },
        { id: 'i2', payerName: 'Bank B', amount: 1000, earlyWithdrawalPenalty: 300 },
      ],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.earlyWithdrawalPenalty).toBe(500);
  });

  it('handles zero penalty gracefully', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099INT: [
        { id: 'i1', payerName: 'Bank A', amount: 1000 },
      ],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.earlyWithdrawalPenalty).toBe(0);
  });
});

// ─── Sprint 1B: Vehicle Deduction Integration ─────────────────

describe('Sprint 1B — Vehicle Deduction in Schedule C', () => {
  it('applies standard mileage deduction to Schedule C net profit', () => {
    // 10,000 miles * $0.70 = $7,000 vehicle deduction
    // Gross income: 50000, Expenses: 5000, Home office: 0
    // Tentative profit: 45000, Vehicle: 7000
    // Net profit: 45000 - 7000 = 38000
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office', amount: 5000 },
      ],
      vehicle: {
        method: 'standard_mileage',
        businessMiles: 10000,
      },
    });
    const result = calculateForm1040(tr);
    expect(result.scheduleC!.vehicleDeduction).toBe(7000);
    expect(result.scheduleC!.netProfit).toBe(38000);
  });

  it('applies actual method vehicle deduction', () => {
    // 15000 business / 20000 total miles = 75% ratio
    // $8000 actual * 75% = $6000
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000 }],
      expenses: [],
      vehicle: {
        method: 'actual',
        businessMiles: 15000,
        totalMiles: 20000,
        actualExpenses: 8000,
      },
    });
    const result = calculateForm1040(tr);
    expect(result.scheduleC!.vehicleDeduction).toBe(6000);
    expect(result.scheduleC!.netProfit).toBe(44000);
  });

  it('produces zero deduction when no vehicle info', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 50000 }],
      expenses: [],
    });
    const result = calculateForm1040(tr);
    expect(result.scheduleC!.vehicleDeduction).toBe(0);
  });

  it('combines home office and vehicle deductions', () => {
    // Gross: 80000, Expenses: 10000, Tentative: 70000
    // Home office: 200 sqft * $5 = $1000
    // Vehicle: 5000 miles * $0.70 = $3500
    // Net profit: 70000 - 1000 - 3500 = 65500
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 80000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 27, category: 'other', amount: 10000 },
      ],
      homeOffice: { method: 'simplified', squareFeet: 200 },
      vehicle: { method: 'standard_mileage', businessMiles: 5000 },
    });
    const result = calculateForm1040(tr);
    expect(result.scheduleC!.homeOfficeDeduction).toBe(1000);
    expect(result.scheduleC!.vehicleDeduction).toBe(3500);
    expect(result.scheduleC!.netProfit).toBe(65500);
  });
});

// ─── Sprint 1C: 65+/Blind Additional Standard Deduction ──────

describe('Sprint 1C — Additional Standard Deduction (65+/Blind)', () => {
  it('adds $2,000 for single filer age 65+', () => {
    // Born 1958-06-15 → age 67 in 2025
    // Standard deduction: 15750 + 2000 = 17750
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1958-06-15',
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.standardDeduction).toBe(17750);
  });

  it('adds $2,000 for single filer who is legally blind', () => {
    // Under 65, blind → 15750 + 2000 = 17750
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1990-01-01',
      isLegallyBlind: true,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.standardDeduction).toBe(17750);
  });

  it('adds $4,000 for single filer who is 65+ AND blind', () => {
    // Born 1955 → age 70, blind → 15750 + 2000 + 2000 = 19750
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1955-03-10',
      isLegallyBlind: true,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.standardDeduction).toBe(19750);
  });

  it('adds $1,600 per condition for MFJ (both 65+ and blind)', () => {
    // MFJ, both 65+, both blind → 31500 + 1600*4 = 37900
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      dateOfBirth: '1955-01-01',
      isLegallyBlind: true,
      spouseDateOfBirth: '1956-07-01',
      spouseIsLegallyBlind: true,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.standardDeduction).toBe(37900);
  });

  it('adds $1,600 for MFJ where only one spouse is 65+', () => {
    // MFJ, taxpayer 65+, spouse under 65 → 31500 + 1600 = 33100
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      dateOfBirth: '1958-01-01',
      spouseDateOfBirth: '1990-01-01',
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.standardDeduction).toBe(33100);
  });

  it('does NOT add additional for MFS spouse (they file separately)', () => {
    // MFS — only checks taxpayer, not spouse
    // Taxpayer is 65+ → 15750 + 1600 = 17350
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      dateOfBirth: '1955-01-01',
      spouseDateOfBirth: '1955-01-01', // spouse also 65+ but irrelevant for MFS
      spouseIsLegallyBlind: true, // also irrelevant
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.standardDeduction).toBe(17350); // only taxpayer's additional
  });

  it('uses $2,000 additional for Head of Household (unmarried)', () => {
    // HoH, 65+ → 23625 + 2000 = 25625
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dateOfBirth: '1958-01-01',
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.standardDeduction).toBe(25625);
  });

  it('no additional for filer under 65 and not blind', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1990-01-01',
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.standardDeduction).toBe(15750);
  });

  it('handles missing dateOfBirth gracefully (no additional)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.standardDeduction).toBe(15750);
  });

  it('edge case: born Jan 2, 1961 — turns 65 on Jan 2, 2026 — NOT 65 by end of 2025', () => {
    // IRS: "considered 65 on the day before your 65th birthday"
    // Born Jan 2, 1961 → 65th birthday Jan 2, 2026 → "considered 65" on Jan 1, 2026
    // By end of Dec 31, 2025, they are NOT yet 65
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1961-01-02',
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.standardDeduction).toBe(15750); // no additional
  });

  it('edge case: born Jan 1, 1961 — IRS considers them 65 on Dec 31, 2025', () => {
    // Born Jan 1, 1961 → 65th birthday Jan 1, 2026 → "considered 65" on Dec 31, 2025
    // So they DO get the additional deduction for 2025
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1961-01-01',
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.standardDeduction).toBe(17750); // gets additional
  });
});

// ─── Sprint 1D: Dependent Age Validation for CTC ─────────────

describe('Sprint 1D — Dependent Age Validation for CTC', () => {
  it('counts dependent under 17 with 12 months residency as qualifying child', () => {
    // Child born 2010 → age 15 in 2025, 12 months → qualifying child
    // CTC: 1 * $2200 = $2200
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      dependents: [
        {
          id: 'd1', firstName: 'Child', lastName: 'One',
          relationship: 'son', dateOfBirth: '2010-06-15',
          monthsLivedWithYou: 12,
        },
      ],
      childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 },
    });
    const result = calculateForm1040(tr);
    expect(result.credits.childTaxCredit).toBe(2200);
    expect(result.credits.otherDependentCredit).toBe(0);
  });

  it('counts dependent who is exactly 17 as other dependent (not qualifying child)', () => {
    // Child born 2008-03-15 → turns 17 on 2025-03-15, age 17 at end of year
    // Should be "other dependent" ($500), NOT qualifying child ($2200)
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      dependents: [
        {
          id: 'd1', firstName: 'Teen', lastName: 'One',
          relationship: 'daughter', dateOfBirth: '2008-03-15',
          monthsLivedWithYou: 12,
        },
      ],
      childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 }, // Manual says 1, but validation overrides
    });
    const result = calculateForm1040(tr);
    expect(result.credits.childTaxCredit).toBe(0);       // overridden by age validation
    expect(result.credits.otherDependentCredit).toBe(500); // $500 ODC
  });

  it('counts dependent under 17 with only 5 months residency as other dependent', () => {
    // Child born 2012 → age 13, but only 5 months → fails residency test
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      dependents: [
        {
          id: 'd1', firstName: 'Child', lastName: 'One',
          relationship: 'son', dateOfBirth: '2012-06-15',
          monthsLivedWithYou: 5, // fails > 6 months test
        },
      ],
      childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 },
    });
    const result = calculateForm1040(tr);
    expect(result.credits.childTaxCredit).toBe(0);
    expect(result.credits.otherDependentCredit).toBe(500);
  });

  it('handles mixed dependents correctly', () => {
    // Child A: born 2012, 12 months → qualifying (CTC $2200)
    // Child B: born 2008, 12 months → age 17, other dependent (ODC $500)
    // Child C: born 2015, 12 months → qualifying (CTC $2200)
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 100000, federalTaxWithheld: 12000 }],
      dependents: [
        { id: 'd1', firstName: 'A', lastName: 'X', relationship: 'son', dateOfBirth: '2012-01-01', monthsLivedWithYou: 12 },
        { id: 'd2', firstName: 'B', lastName: 'X', relationship: 'daughter', dateOfBirth: '2008-06-01', monthsLivedWithYou: 12 },
        { id: 'd3', firstName: 'C', lastName: 'X', relationship: 'son', dateOfBirth: '2015-09-01', monthsLivedWithYou: 12 },
      ],
      childTaxCredit: { qualifyingChildren: 3, otherDependents: 0 }, // Manual count wrong — validation fixes it
    });
    const result = calculateForm1040(tr);
    expect(result.credits.childTaxCredit).toBe(4400);       // 2 qualifying * $2200
    expect(result.credits.otherDependentCredit).toBe(500);   // 1 other * $500
  });

  it('falls back to manual ChildTaxCreditInfo when no dependents array', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      dependents: [], // empty
      childTaxCredit: { qualifyingChildren: 2, otherDependents: 1 },
    });
    const result = calculateForm1040(tr);
    expect(result.credits.childTaxCredit).toBe(4400);       // 2 * $2200
    expect(result.credits.otherDependentCredit).toBe(500);   // 1 * $500
  });

  it('handles dependent with no dateOfBirth as other dependent', () => {
    // No DOB means we can't verify age → treated as other dependent
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      dependents: [
        { id: 'd1', firstName: 'Child', lastName: 'One', relationship: 'son', monthsLivedWithYou: 12 },
      ],
      childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 },
    });
    const result = calculateForm1040(tr);
    expect(result.credits.childTaxCredit).toBe(0);
    expect(result.credits.otherDependentCredit).toBe(500);
  });
});

// ─── Sprint 1E: Capital Gain Distributions ────────────────────

describe('Sprint 1E — Capital Gain Distributions (1099-DIV Box 2a)', () => {
  it('adds capital gain distributions to total income', () => {
    // Wages: 50000, Ordinary dividends: 2000, Capital gain distributions: 5000
    // Total income: 50000 + 2000 + 5000 = 57000
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099DIV: [
        { id: 'd1', payerName: 'Vanguard', ordinaryDividends: 2000, qualifiedDividends: 1500, capitalGainDistributions: 5000 },
      ],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.totalCapitalGainDistributions).toBe(5000);
    expect(f.totalIncome).toBe(57000);
  });

  it('sums capital gain distributions from multiple 1099-DIVs', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099DIV: [
        { id: 'd1', payerName: 'Vanguard', ordinaryDividends: 1000, qualifiedDividends: 500, capitalGainDistributions: 3000 },
        { id: 'd2', payerName: 'Fidelity', ordinaryDividends: 500, qualifiedDividends: 300, capitalGainDistributions: 2000 },
      ],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.totalCapitalGainDistributions).toBe(5000);
    expect(f.totalDividends).toBe(1500); // ordinary dividends only
    expect(f.totalIncome).toBe(56500); // 50000 + 1500 + 5000
  });

  it('handles zero/missing capital gain distributions', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099DIV: [
        { id: 'd1', payerName: 'Vanguard', ordinaryDividends: 1000, qualifiedDividends: 500 },
      ],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.totalCapitalGainDistributions).toBe(0);
    expect(f.totalIncome).toBe(51000);
  });
});

// ─── Sprint 1 Integration: Combined Scenario ─────────────────

describe('Sprint 1 Integration — All fixes combined', () => {
  it('comprehensive scenario: 65+ blind retiree with early withdrawal penalty and cap gain distributions', () => {
    // Filing: Single, born 1955 (age 70), legally blind
    // Standard deduction: 15750 + 2000 (65+) + 2000 (blind) = 19750
    //
    // Income:
    //   W-2 wages: 30000
    //   Interest: 5000 (with $200 early withdrawal penalty)
    //   Ordinary dividends: 3000
    //   Capital gain distributions: 4000
    //   Total income: 30000 + 5000 + 3000 + 4000 = 42000
    //
    // Adjustments:
    //   Early withdrawal penalty: 200
    //   Total adjustments: 200
    //
    // AGI: 42000 - 200 = 41800
    // Taxable income: 41800 - 19000 = 22800
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      dateOfBirth: '1955-03-10',
      isLegallyBlind: true,
      w2Income: [{ id: 'w1', employerName: 'Part-time', wages: 30000, federalTaxWithheld: 3000 }],
      income1099INT: [
        { id: 'i1', payerName: 'Bank', amount: 5000, earlyWithdrawalPenalty: 200 },
      ],
      income1099DIV: [
        { id: 'd1', payerName: 'Fund', ordinaryDividends: 3000, qualifiedDividends: 2000, capitalGainDistributions: 4000 },
      ],
    });
    const f = calculateForm1040(tr).form1040;

    expect(f.totalIncome).toBe(42000);
    expect(f.earlyWithdrawalPenalty).toBe(200);
    expect(f.totalAdjustments).toBe(200);
    expect(f.agi).toBe(41800);
    expect(f.standardDeduction).toBe(19750);
    // Schedule 1-A enhanced senior deduction ($6,000) reduces taxable income further
    expect(f.schedule1ADeduction).toBe(6000);
    expect(f.taxableIncome).toBe(16050); // 41800 - 19750 - 6000
    expect(f.totalCapitalGainDistributions).toBe(4000);
  });

  it('freelancer with vehicle deduction and dependent validation', () => {
    // Single HoH freelancer, child born 2012 (age 13, qualifies), 12 months
    // Income: 1099-NEC $80000
    // Expenses: $5000
    // Vehicle: 8000 miles * $0.70 = $5600
    // Schedule C net: 80000 - 5000 - 5600 = 69400
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.HeadOfHousehold,
      dateOfBirth: '1985-06-01',
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 80000 }],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'office', amount: 5000 },
      ],
      vehicle: { method: 'standard_mileage', businessMiles: 8000 },
      dependents: [
        { id: 'd1', firstName: 'Kid', lastName: 'One', relationship: 'son', dateOfBirth: '2012-04-15', monthsLivedWithYou: 12 },
      ],
      childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 },
    });
    const result = calculateForm1040(tr);
    expect(result.scheduleC!.vehicleDeduction).toBe(5600);
    expect(result.scheduleC!.netProfit).toBe(69400);
    expect(result.credits.childTaxCredit).toBe(2200);
    expect(result.form1040.standardDeduction).toBe(23625); // HoH, under 65, not blind
  });
});
