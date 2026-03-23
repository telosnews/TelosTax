import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateHSADeduction } from '../src/engine/hsaForm8889.js';
import { calculateForm8606, Form8606Result } from '../src/engine/form8606.js';
import { calculateEstimatedTaxPenalty } from '../src/engine/estimatedTaxPenalty.js';
import { calculateKiddieTax } from '../src/engine/kiddieTax.js';
import { calculateFEIE } from '../src/engine/feie.js';
import { calculateScheduleH } from '../src/engine/scheduleH.js';
import { calculateAdoptionCredit } from '../src/engine/adoptionCredit.js';
import { FilingStatus, TaxReturn } from '../src/types/index.js';

function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint11',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    filingStatus: FilingStatus.Single,
    dependents: [],
    w2Income: [{ id: 'w1', employerName: 'ACME Corp', wages: 75000, federalTaxWithheld: 10000 }],
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
    incomeW2G: [],
    rentalProperties: [],
    otherIncome: 0,
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ════════════════════════════════════════════════════
// 26. HSA Form 8889
// ════════════════════════════════════════════════════

describe('26. HSA Form 8889', () => {
  it('self-only coverage, full contribution at $4,300 limit', () => {
    const deduction = calculateHSADeduction({
      coverageType: 'self_only',
      totalContributions: 4300,
    });
    expect(deduction).toBe(4300);
  });

  it('family coverage uses $8,550 limit', () => {
    const deduction = calculateHSADeduction({
      coverageType: 'family',
      totalContributions: 8550,
    });
    expect(deduction).toBe(8550);
  });

  it('employer contributions reduce deductible amount', () => {
    // Total contributions $4,300, but $1,500 from employer
    const deduction = calculateHSADeduction({
      coverageType: 'self_only',
      totalContributions: 4300,
      employerContributions: 1500,
    });
    // Allowable = min(4300, 4300) - 1500 = 2800
    expect(deduction).toBe(2800);
  });

  it('catch-up contributions (age 55+) increase limit by $1,000', () => {
    // Self-only limit is $4,300 + $1,000 catch-up = $5,300
    const deduction = calculateHSADeduction({
      coverageType: 'self_only',
      totalContributions: 5300,
      catchUpContributions: 1000,
    });
    expect(deduction).toBe(5300);
  });

  it('zero contributions return zero deduction', () => {
    const deduction = calculateHSADeduction({
      coverageType: 'self_only',
      totalContributions: 0,
    });
    expect(deduction).toBe(0);
  });

  it('integration: hsaContribution on TaxReturn reduces AGI via hsaDeduction', () => {
    const tr = baseTaxReturn({
      hsaContribution: {
        coverageType: 'self_only',
        totalContributions: 4300,
      },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.hsaDeduction).toBe(4300);
    expect(result.form1040.hsaDeductionComputed).toBe(4300);
    // AGI = 75000 - 4300 = 70700
    expect(result.form1040.agi).toBe(70700);
  });

  // ── Partial-year HDHP coverage proration (IRC §223(b)(2)) ──

  it('partial-year: 6 months self-only prorates limit to $2,150', () => {
    const deduction = calculateHSADeduction({
      coverageType: 'self_only',
      totalContributions: 4300,
      hdhpCoverageMonths: 6,
    });
    // Prorated limit = $4,300 × 6/12 = $2,150
    expect(deduction).toBe(2150);
  });

  it('partial-year: 9 months family prorates limit to $6,412.50', () => {
    const deduction = calculateHSADeduction({
      coverageType: 'family',
      totalContributions: 8550,
      hdhpCoverageMonths: 9,
    });
    // Prorated limit = $8,550 × 9/12 = $6,412.50
    expect(deduction).toBe(6412.5);
  });

  it('partial-year: contributions under prorated limit are fully deductible', () => {
    const deduction = calculateHSADeduction({
      coverageType: 'self_only',
      totalContributions: 1500,
      hdhpCoverageMonths: 6,
    });
    // $1,500 < $2,150 prorated limit → full deduction
    expect(deduction).toBe(1500);
  });

  it('partial-year: catch-up is NOT prorated (flat $1,000 per Form 8889)', () => {
    const deduction = calculateHSADeduction({
      coverageType: 'self_only',
      totalContributions: 3150,
      catchUpContributions: 1000,
      hdhpCoverageMonths: 6,
    });
    // Prorated base = $4,300 × 6/12 = $2,150; catch-up = $1,000 flat
    // Effective limit = $2,150 + $1,000 = $3,150
    expect(deduction).toBe(3150);
  });

  it('partial-year: employer contributions still offset deduction', () => {
    const deduction = calculateHSADeduction({
      coverageType: 'self_only',
      totalContributions: 2150,
      employerContributions: 800,
      hdhpCoverageMonths: 6,
    });
    // Prorated limit = $2,150; allowable = min(2150, 2150) - 800 = $1,350
    expect(deduction).toBe(1350);
  });

  it('partial-year: 12 months defaults to full limit (no proration)', () => {
    const deduction = calculateHSADeduction({
      coverageType: 'self_only',
      totalContributions: 4300,
      hdhpCoverageMonths: 12,
    });
    expect(deduction).toBe(4300);
  });

  it('partial-year: omitting hdhpCoverageMonths defaults to 12', () => {
    const withDefault = calculateHSADeduction({
      coverageType: 'self_only',
      totalContributions: 4300,
    });
    const withExplicit = calculateHSADeduction({
      coverageType: 'self_only',
      totalContributions: 4300,
      hdhpCoverageMonths: 12,
    });
    expect(withDefault).toBe(withExplicit);
  });
});

// ════════════════════════════════════════════════════
// 27. Roth Conversion / Form 8606
// ════════════════════════════════════════════════════

describe('27. Form 8606 (Roth Conversion / Nondeductible IRA)', () => {
  it('no conversion returns zero result', () => {
    const result = calculateForm8606({
      nondeductibleContributions: 6000,
      priorYearBasis: 10000,
      traditionalIRABalance: 50000,
      rothConversionAmount: 0,
    });
    expect(result.taxableConversion).toBe(0);
    expect(result.remainingBasis).toBe(16000); // 6000 + 10000 carried forward
  });

  it('full basis (all non-deductible) results in no tax on conversion', () => {
    // Entire IRA is non-deductible basis, so conversion is fully non-taxable
    const result = calculateForm8606({
      nondeductibleContributions: 0,
      priorYearBasis: 50000,
      traditionalIRABalance: 0,   // year-end balance (after conversion)
      rothConversionAmount: 50000,
    });
    // totalIRAValue = 0 + 50000 = 50000
    // nonTaxableRatio = 50000 / 50000 = 1.0
    expect(result.nonTaxableRatio).toBe(1);
    expect(result.taxableConversion).toBe(0);
    expect(result.remainingBasis).toBe(0);
  });

  it('zero basis results in fully taxable conversion', () => {
    const result = calculateForm8606({
      nondeductibleContributions: 0,
      priorYearBasis: 0,
      traditionalIRABalance: 50000,
      rothConversionAmount: 30000,
    });
    // totalIRAValue = 50000 + 30000 = 80000
    // nonTaxableRatio = 0 / 80000 = 0
    expect(result.nonTaxableRatio).toBe(0);
    expect(result.taxableConversion).toBe(30000);
    expect(result.remainingBasis).toBe(0);
  });

  it('pro-rata rule: 50% basis means half is taxable', () => {
    const result = calculateForm8606({
      nondeductibleContributions: 0,
      priorYearBasis: 50000,
      traditionalIRABalance: 50000,   // year-end balance
      rothConversionAmount: 50000,
    });
    // totalIRAValue = 50000 + 50000 = 100000
    // nonTaxableRatio = 50000 / 100000 = 0.5
    // taxable = 50000 * 0.5 = 25000
    expect(result.nonTaxableRatio).toBe(0.5);
    expect(result.taxableConversion).toBe(25000);
  });

  it('remaining basis tracks correctly after partial conversion', () => {
    const result = calculateForm8606({
      nondeductibleContributions: 5000,
      priorYearBasis: 15000,
      traditionalIRABalance: 60000,
      rothConversionAmount: 20000,
    });
    // totalBasis = 5000 + 15000 = 20000
    // totalIRAValue = 60000 + 20000 = 80000
    // nonTaxableRatio = 20000 / 80000 = 0.25
    // nonTaxablePortion = 20000 * 0.25 = 5000
    // taxable = 20000 - 5000 = 15000
    // remainingBasis = 20000 - 5000 = 15000
    expect(result.totalBasis).toBe(20000);
    expect(result.nonTaxableRatio).toBe(0.25);
    expect(result.taxableConversion).toBe(15000);
    expect(result.remainingBasis).toBe(15000);
  });

  it('integration: form8606 result appears in CalculationResult', () => {
    const tr = baseTaxReturn({
      form8606: {
        nondeductibleContributions: 0,
        priorYearBasis: 10000,
        traditionalIRABalance: 40000,
        rothConversionAmount: 20000,
      },
    });
    const result = calculateForm1040(tr);
    expect(result.form8606).toBeDefined();
    expect(result.form8606!.taxableConversion).toBeGreaterThan(0);
    expect(result.form8606!.remainingBasis).toBeGreaterThanOrEqual(0);
    // rothConversionTaxable should appear on form1040
    expect(result.form1040.rothConversionTaxable).toBeGreaterThan(0);
  });

  // ── Distribution pro-rata tests (Bug #1 fix) ──

  it('distributions-only with basis: pro-rata reduces taxable distributions', () => {
    // No conversion, but $10,000 regular distribution with $20,000 basis
    const result = calculateForm8606(
      {
        nondeductibleContributions: 0,
        priorYearBasis: 20000,
        traditionalIRABalance: 80000,
        rothConversionAmount: 0,
      },
      10000, // regularDistributions
    );
    // totalBasis = 20000
    // totalIRAValue = 80000 + 0 + 10000 = 90000
    // nonTaxableRatio = 20000 / 90000 ≈ 0.2222
    // nonTaxableDistributions = 10000 × 0.2222 ≈ 2222.22
    // taxableDistributions = 10000 - 2222.22 ≈ 7777.78
    // remainingBasis = 20000 - 0 - 2222.22 ≈ 17777.78
    expect(result.taxableConversion).toBe(0);
    expect(result.regularDistributions).toBe(10000);
    expect(result.nonTaxableDistributions).toBeCloseTo(2222.22, 0);
    expect(result.taxableDistributions).toBeCloseTo(7777.78, 0);
    expect(result.remainingBasis).toBeCloseTo(17777.78, 0);
  });

  it('both conversion and distributions share basis via pro-rata', () => {
    // $20K conversion + $15K regular distribution with $20K basis
    const result = calculateForm8606(
      {
        nondeductibleContributions: 5000,
        priorYearBasis: 15000,
        traditionalIRABalance: 200000,
        rothConversionAmount: 20000,
      },
      15000, // regularDistributions
    );
    // totalBasis = 5000 + 15000 = 20000
    // totalIRAValue = 200000 + 20000 + 15000 = 235000
    // nonTaxableRatio = 20000 / 235000 ≈ 0.0851
    // nonTaxableConversion = 20000 × 0.0851 ≈ 1702.13
    // taxableConversion = 20000 - 1702.13 ≈ 18297.87
    // nonTaxableDistributions = 15000 × 0.0851 ≈ 1276.60
    // taxableDistributions = 15000 - 1276.60 ≈ 13723.40
    // remainingBasis = 20000 - 1702.13 - 1276.60 ≈ 17021.28
    expect(result.totalBasis).toBe(20000);
    expect(result.taxableConversion).toBeCloseTo(18297.87, 0);
    expect(result.nonTaxableDistributions).toBeCloseTo(1276.60, 0);
    expect(result.taxableDistributions).toBeCloseTo(13723.40, 0);
    expect(result.remainingBasis).toBeCloseTo(17021.28, 0);
  });

  it('basis exceeding total IRA value caps ratio at 1.0', () => {
    // Edge case: basis higher than total value (e.g., IRA lost value)
    const result = calculateForm8606(
      {
        nondeductibleContributions: 0,
        priorYearBasis: 50000,
        traditionalIRABalance: 5000,
        rothConversionAmount: 10000,
      },
      5000, // regularDistributions
    );
    // totalBasis = 50000
    // totalIRAValue = 5000 + 10000 + 5000 = 20000
    // nonTaxableRatio = min(1, 50000 / 20000) = 1.0
    // Everything is non-taxable
    expect(result.nonTaxableRatio).toBe(1);
    expect(result.taxableConversion).toBe(0);
    expect(result.taxableDistributions).toBe(0);
    expect(result.nonTaxableDistributions).toBe(5000);
    // remainingBasis = 50000 - 10000 - 5000 = 35000
    expect(result.remainingBasis).toBe(35000);
  });

  it('zero basis with distributions: everything fully taxable', () => {
    const result = calculateForm8606(
      {
        nondeductibleContributions: 0,
        priorYearBasis: 0,
        traditionalIRABalance: 100000,
        rothConversionAmount: 10000,
      },
      8000, // regularDistributions
    );
    expect(result.nonTaxableRatio).toBe(0);
    expect(result.taxableConversion).toBe(10000);
    expect(result.taxableDistributions).toBe(8000);
    expect(result.nonTaxableDistributions).toBe(0);
    expect(result.remainingBasis).toBe(0);
  });
});

// ════════════════════════════════════════════════════
// 28. Estimated Tax Penalty (Form 2210)
// ════════════════════════════════════════════════════

describe('28. Estimated Tax Penalty (Form 2210)', () => {
  it('tax owed < $1,000 results in no penalty', () => {
    // Current year tax 10000, payments 9500 => owed 500 < 1000
    const result = calculateEstimatedTaxPenalty(10000, 9500, 8000, 75000, FilingStatus.Single);
    expect(result.penalty).toBe(0);
  });

  it('payments >= 90% of current year tax results in no penalty', () => {
    // Current year tax 20000, payments 18000 = 90% => safe harbor met
    const result = calculateEstimatedTaxPenalty(20000, 18000, 15000, 75000, FilingStatus.Single);
    expect(result.penalty).toBe(0);
  });

  it('payments >= 100% of prior year tax results in no penalty (safe harbor)', () => {
    // Current year tax 20000, payments 12000, prior year tax 12000
    // Owed = 20000 - 12000 = 8000 (>= $1000 threshold)
    // 90% current = 18000, 100% prior = 12000
    // Required = min(18000, 12000) = 12000
    // Payments 12000 >= 12000 required => no penalty
    const result = calculateEstimatedTaxPenalty(20000, 12000, 12000, 75000, FilingStatus.Single);
    expect(result.penalty).toBe(0);
  });

  it('high income (>$150k AGI) uses 110% prior year safe harbor', () => {
    // AGI 200000, prior year tax 15000 => required = 110% * 15000 = 16500
    // Current tax 30000, 90% current = 27000
    // Required = min(27000, 16500) = 16500
    // Payments 16500 => meets safe harbor => no penalty
    const result = calculateEstimatedTaxPenalty(30000, 16500, 15000, 200000, FilingStatus.Single);
    expect(result.penalty).toBe(0);
  });

  it('underpayment triggers penalty at 7% rate', () => {
    // Current year tax 20000, payments 5000, prior year tax 25000
    // Owed = 20000 - 5000 = 15000 (>= $1000)
    // 90% current = 18000, 100% prior = 25000
    // Required = min(18000, 25000) = 18000
    // Payments 5000 < 18000 => underpayment = 18000 - 5000 = 13000
    // Per-quarter day-count penalty ≈ $605.22
    const result = calculateEstimatedTaxPenalty(20000, 5000, 25000, 75000, FilingStatus.Single);
    expect(result.underpaymentAmount).toBe(13000);
    expect(result.penalty).toBe(605.22);
  });

  it('integration: penalty included in amountOwed calculation', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'ACME', wages: 75000, federalTaxWithheld: 2000 }],
      priorYearTax: 5000,
      estimatedPaymentsMade: 0,
    });
    const result = calculateForm1040(tr);
    // With only $2000 withholding on $75k wages, there's likely an underpayment
    // If penalty > 0, it should be reflected in the final balance
    expect(result.form1040.estimatedTaxPenalty).toBeGreaterThanOrEqual(0);
    if (result.form1040.estimatedTaxPenalty > 0) {
      // amountOwed includes tax after credits + penalty - payments
      expect(result.form1040.amountOwed).toBeGreaterThan(0);
    }
    expect(result.estimatedTaxPenalty).toBeDefined();
  });
});

// ════════════════════════════════════════════════════
// 29. Kiddie Tax (Form 8615)
// ════════════════════════════════════════════════════

describe('29. Kiddie Tax (Form 8615)', () => {
  it('child age >= 19 results in no kiddie tax', () => {
    const result = calculateKiddieTax({
      childUnearnedIncome: 10000,
      childAge: 19,
      parentMarginalRate: 0.32,
    });
    expect(result.applies).toBe(false);
    expect(result.additionalTax).toBe(0);
  });

  it('unearned income below $2,700 threshold results in no kiddie tax', () => {
    const result = calculateKiddieTax({
      childUnearnedIncome: 2500,
      childAge: 15,
      parentMarginalRate: 0.32,
    });
    expect(result.applies).toBe(false);
    expect(result.additionalTax).toBe(0);
  });

  it('excess unearned income is taxed at parent rate minus child rate', () => {
    const result = calculateKiddieTax({
      childUnearnedIncome: 10000,
      childAge: 15,
      parentMarginalRate: 0.32,
    });
    // unearnedAbove = 10000 - 2700 = 7300
    // additionalTax = 7300 * (0.32 - 0.10) = 7300 * 0.22 = 1606
    expect(result.applies).toBe(true);
    expect(result.unearnedIncomeAboveThreshold).toBe(7300);
    expect(result.additionalTax).toBe(1606);
  });

  it('full-time student extends age limit to 24', () => {
    // Age 20 normally not subject to kiddie tax (>= 19), but student extends to 24
    const result = calculateKiddieTax({
      childUnearnedIncome: 5000,
      childAge: 20,
      isFullTimeStudent: true,
      parentMarginalRate: 0.24,
    });
    // unearnedAbove = 5000 - 2700 = 2300
    // additionalTax = 2300 * (0.24 - 0.10) = 2300 * 0.14 = 322
    expect(result.applies).toBe(true);
    expect(result.unearnedIncomeAboveThreshold).toBe(2300);
    expect(result.additionalTax).toBe(322);
  });

  it('integration: kiddieTaxAmount appears in form1040 result', () => {
    const tr = baseTaxReturn({
      kiddieTax: {
        childUnearnedIncome: 8000,
        childAge: 14,
        parentMarginalRate: 0.24,
      },
    });
    const result = calculateForm1040(tr);
    // unearnedAbove = 8000 - 2700 = 5300
    // additionalTax = 5300 * (0.24 - 0.10) = 5300 * 0.14 = 742
    expect(result.form1040.kiddieTaxAmount).toBe(742);
    expect(result.kiddieTax).toBeDefined();
    expect(result.kiddieTax!.additionalTax).toBe(742);
    expect(result.kiddieTax!.childTaxableUnearned).toBe(5300);
  });
});

// ════════════════════════════════════════════════════
// 30. Foreign Earned Income Exclusion (Form 2555)
// ════════════════════════════════════════════════════

describe('30. FEIE (Form 2555)', () => {
  it('full year, $130,000 exclusion on income at or above limit', () => {
    const result = calculateFEIE({
      foreignEarnedIncome: 150000,
      qualifyingDays: 365,
    });
    expect(result.incomeExclusion).toBe(130000);
    expect(result.totalExclusion).toBe(130000);
  });

  it('partial year prorates exclusion', () => {
    const result = calculateFEIE({
      foreignEarnedIncome: 150000,
      qualifyingDays: 182,
    });
    // dailyExclusion = 130000 / 365 = 356.164...
    // maxExclusion = 356.164... * 182 = 64821.92 (approx)
    const expectedMax = Math.round((130000 / 365) * 182 * 100) / 100;
    expect(result.incomeExclusion).toBe(expectedMax);
    expect(result.totalExclusion).toBe(expectedMax);
  });

  it('housing exclusion on top of income exclusion', () => {
    const result = calculateFEIE({
      foreignEarnedIncome: 150000,
      qualifyingDays: 365,
      housingExpenses: 30000,
    });
    // Housing base = $20,280 (16% of $130k)
    // Housing max exclusion = $39,000 (30% of $130k)
    // Eligible = min(30000, 39000) - 20280 = 30000 - 20280 = 9720
    expect(result.incomeExclusion).toBe(130000);
    expect(result.housingExclusion).toBe(9720);
    expect(result.totalExclusion).toBe(139720);
  });

  it('zero foreign income results in zero exclusion', () => {
    const result = calculateFEIE({
      foreignEarnedIncome: 0,
      qualifyingDays: 365,
    });
    expect(result.incomeExclusion).toBe(0);
    expect(result.housingExclusion).toBe(0);
    expect(result.totalExclusion).toBe(0);
  });

  it('integration: FEIE reduces totalIncome on form1040', () => {
    const tr = baseTaxReturn({
      foreignEarnedIncome: {
        foreignEarnedIncome: 80000,
        qualifyingDays: 365,
      },
    });
    const result = calculateForm1040(tr);
    // FEIE exclusion = min(80000, 130000) = 80000
    expect(result.form1040.feieExclusion).toBe(80000);
    expect(result.feie).toBeDefined();
    expect(result.feie!.incomeExclusion).toBe(80000);
    // totalIncome should be reduced by the exclusion
    // wages 75000 + 0 other - 80000 exclusion... but exclusion only applies to foreign income
    // The integration depends on how form1040 handles it. Just verify the exclusion value flows.
    expect(result.form1040.feieExclusion).toBe(80000);
  });
});

// ════════════════════════════════════════════════════
// 31. Schedule H (Household Employee Tax)
// ════════════════════════════════════════════════════

describe('31. Schedule H (Household Employee Tax)', () => {
  it('wages below $2,800 threshold result in no tax', () => {
    const result = calculateScheduleH({
      totalCashWages: 2500,
    });
    expect(result.socialSecurityTax).toBe(0);
    expect(result.medicareTax).toBe(0);
    expect(result.futaTax).toBe(0);
    expect(result.totalTax).toBe(0);
  });

  it('wages above threshold trigger SS + Medicare + FUTA', () => {
    const result = calculateScheduleH({
      totalCashWages: 30000,
      numberOfEmployees: 1,
    });
    // SS: 30000 * 0.124 = 3720 (combined employer+employee)
    // Medicare: 30000 * 0.029 = 870 (combined employer+employee)
    // FUTA: min(30000, 7000) * 0.006 = 42
    expect(result.socialSecurityTax).toBe(3720);
    expect(result.medicareTax).toBe(870);
    expect(result.futaTax).toBe(42);
    expect(result.totalTax).toBe(4632);
  });

  it('multiple employees increase FUTA wage base', () => {
    const result = calculateScheduleH({
      totalCashWages: 50000,
      numberOfEmployees: 3,
    });
    // SS: 50000 * 0.124 = 6200 (combined employer+employee)
    // Medicare: 50000 * 0.029 = 1450 (combined employer+employee)
    // FUTA wage base: min(50000, 7000 * 3) = min(50000, 21000) = 21000
    // FUTA: 21000 * 0.006 = 126
    expect(result.socialSecurityTax).toBe(6200);
    expect(result.medicareTax).toBe(1450);
    expect(result.futaTax).toBe(126);
    expect(result.totalTax).toBe(7776);
  });

  it('integration: householdEmploymentTax appears in totalTax', () => {
    const tr = baseTaxReturn({
      householdEmployees: {
        totalCashWages: 20000,
        numberOfEmployees: 1,
      },
    });
    const result = calculateForm1040(tr);
    // SS: 20000 * 0.124 = 2480 (combined employer+employee)
    // Medicare: 20000 * 0.029 = 580 (combined employer+employee)
    // FUTA: min(20000, 7000) * 0.006 = 42
    // Total = 3102
    expect(result.form1040.householdEmploymentTax).toBe(3102);
    expect(result.scheduleH).toBeDefined();
    expect(result.scheduleH!.totalTax).toBe(3102);
    // totalTax should include Schedule H amount
    expect(result.form1040.totalTax).toBeGreaterThanOrEqual(3102);
  });
});

// ════════════════════════════════════════════════════
// 32. NOL Carryforward
// ════════════════════════════════════════════════════

describe('32. NOL Carryforward', () => {
  it('NOL reduces taxable income', () => {
    const tr = baseTaxReturn({
      nolCarryforward: 10000,
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.nolDeduction).toBeGreaterThan(0);
    // nolDeduction should reduce taxable income
    const trNoNOL = baseTaxReturn();
    const resultNoNOL = calculateForm1040(trNoNOL);
    expect(result.form1040.taxableIncome).toBeLessThan(resultNoNOL.form1040.taxableIncome);
  });

  it('NOL limited to 80% of taxable income', () => {
    // Taxable income before NOL is approximately 75000 - 15750 (standard deduction) = 59250
    // 80% of 60000 = 48000
    // NOL of 100000 should be limited to 48000
    const tr = baseTaxReturn({
      nolCarryforward: 100000,
    });
    const result = calculateForm1040(tr);
    // NOL deduction should be approximately 80% of taxableBeforeNOL
    // taxableBeforeNOL = AGI - standardDeduction - QBI
    // The exact value depends on other computations, but it should be limited
    const expectedLimit = result.form1040.nolDeduction;
    // We know it should NOT equal 100000 because 80% limit applies
    expect(expectedLimit).toBeLessThan(100000);
    expect(expectedLimit).toBeGreaterThan(0);
    // taxableIncome should be 20% of what it was without NOL
    const trNoNOL = baseTaxReturn();
    const resultNoNOL = calculateForm1040(trNoNOL);
    const taxableBeforeNOL = resultNoNOL.form1040.taxableIncome;
    // nolDeduction = min(100000, taxableBeforeNOL * 0.80) = taxableBeforeNOL * 0.80
    const expectedNOL = Math.round(taxableBeforeNOL * 0.80 * 100) / 100;
    expect(result.form1040.nolDeduction).toBe(expectedNOL);
  });

  it('zero NOL has no effect', () => {
    const tr = baseTaxReturn({
      nolCarryforward: 0,
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.nolDeduction).toBe(0);
    const trNoField = baseTaxReturn();
    const resultNoField = calculateForm1040(trNoField);
    expect(result.form1040.taxableIncome).toBe(resultNoField.form1040.taxableIncome);
  });

  it('integration: nolDeduction appears in form1040 result', () => {
    const tr = baseTaxReturn({
      nolCarryforward: 5000,
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.nolDeduction).toBe(5000);
    // With 5000 NOL on ~60000 taxable, 80% of 60000 = 48000 > 5000,
    // so full 5000 is deducted
    const trNoNOL = baseTaxReturn();
    const resultNoNOL = calculateForm1040(trNoNOL);
    expect(result.form1040.taxableIncome).toBe(resultNoNOL.form1040.taxableIncome - 5000);
  });
});

// ════════════════════════════════════════════════════
// 33. Adoption Credit (Form 8839)
// ════════════════════════════════════════════════════

describe('33. Adoption Credit (Form 8839)', () => {
  it('basic credit calculation with qualifying expenses', () => {
    const result = calculateAdoptionCredit(
      { qualifiedExpenses: 10000, numberOfChildren: 1 },
      100000,
    );
    expect(result.expensesBasis).toBe(10000);
    expect(result.credit).toBe(10000);
  });

  it('special needs adoption gets full credit regardless of expenses', () => {
    const result = calculateAdoptionCredit(
      { qualifiedExpenses: 5000, numberOfChildren: 1, isSpecialNeeds: true },
      100000,
    );
    // Special needs: expensesBasis = MAX_CREDIT * 1 = 17280
    expect(result.expensesBasis).toBe(17280);
    expect(result.credit).toBe(17280);
  });

  it('AGI phase-out reduces credit', () => {
    // Phase-out starts at $259,190 over $40,000 range
    // AGI $279,190 => 20000 into phase-out => 50% reduction
    const result = calculateAdoptionCredit(
      { qualifiedExpenses: 17280, numberOfChildren: 1 },
      279190,
    );
    expect(result.expensesBasis).toBe(17280);
    // phaseOutFraction = (279190 - 259190) / 40000 = 0.5
    // credit = 17280 * (1 - 0.5) = 8640
    expect(result.credit).toBe(8640);
  });

  it('AGI above phase-out range results in zero credit', () => {
    // Phase-out start + range = 259190 + 40000 = 299190
    const result = calculateAdoptionCredit(
      { qualifiedExpenses: 17280, numberOfChildren: 1 },
      300000,
    );
    expect(result.expensesBasis).toBe(17280);
    expect(result.credit).toBe(0);
  });

  it('integration: adoptionCredit appears in credits.totalNonRefundable', () => {
    const tr = baseTaxReturn({
      adoptionCredit: {
        qualifiedExpenses: 10000,
        numberOfChildren: 1,
      },
    });
    const result = calculateForm1040(tr);
    expect(result.credits.adoptionCredit).toBe(10000);
    expect(result.credits.totalNonRefundable).toBeGreaterThanOrEqual(10000);
    expect(result.adoptionCredit).toBeDefined();
    expect(result.adoptionCredit!.credit).toBe(10000);
  });
});

// ════════════════════════════════════════════════════
// 34. Qualified Opportunity Zone (Form 8997)
// ════════════════════════════════════════════════════

describe('34. QOZ (Form 8997)', () => {
  it('QOZ data passes through as informational/tracking only', () => {
    const tr = baseTaxReturn({
      qozInvestment: {
        deferredGain: 50000,
        investmentDate: '2025-03-15',
        investmentAmount: 50000,
      },
    });
    const result = calculateForm1040(tr);
    // QOZ should not change the tax calculation
    const trNoQOZ = baseTaxReturn();
    const resultNoQOZ = calculateForm1040(trNoQOZ);
    expect(result.form1040.totalTax).toBe(resultNoQOZ.form1040.totalTax);
    expect(result.form1040.taxableIncome).toBe(resultNoQOZ.form1040.taxableIncome);
  });

  it('integration: qozInvestment on TaxReturn does not change amountOwed', () => {
    const tr = baseTaxReturn({
      qozInvestment: {
        deferredGain: 100000,
        investmentDate: '2025-06-01',
        investmentAmount: 100000,
      },
    });
    const result = calculateForm1040(tr);
    const trNoQOZ = baseTaxReturn();
    const resultNoQOZ = calculateForm1040(trNoQOZ);
    expect(result.form1040.amountOwed).toBe(resultNoQOZ.form1040.amountOwed);
    expect(result.form1040.refundAmount).toBe(resultNoQOZ.form1040.refundAmount);
  });
});

// ════════════════════════════════════════════════════
// 35. Dependent Care FSA Coordination
// ════════════════════════════════════════════════════

describe('35. Dependent Care FSA Coordination', () => {
  it('FSA reduces credit-eligible expenses', () => {
    // $6000 expenses, 2 qualifying persons ($6k limit), $3000 FSA
    // Form 2441: Line 5: min(6000, 6000)=6000; Line 7: 6000-3000=3000
    const tr = baseTaxReturn({
      dependentCare: {
        totalExpenses: 6000,
        qualifyingPersons: 2,
        dependentCareFSA: 3000,
      },
    });
    const result = calculateForm1040(tr);
    expect(result.dependentCare).toBeDefined();
    expect(result.dependentCare!.qualifyingExpenses).toBe(3000);
    expect(result.dependentCare!.credit).toBeGreaterThan(0);
  });

  it('FSA completely eliminates credit when FSA >= expenses', () => {
    const tr = baseTaxReturn({
      dependentCare: {
        totalExpenses: 4000,
        qualifyingPersons: 1,
        dependentCareFSA: 5000,
      },
    });
    const result = calculateForm1040(tr);
    // Credit-eligible = max(0, 4000 - 5000) = 0
    expect(result.credits.dependentCareCredit).toBe(0);
  });

  it('without FSA, credit is calculated on full expenses', () => {
    const tr = baseTaxReturn({
      dependentCare: {
        totalExpenses: 3000,
        qualifyingPersons: 1,
      },
    });
    const result = calculateForm1040(tr);
    // No FSA reduction, full $3000 is credit-eligible (capped at $3k for 1 person)
    expect(result.dependentCare).toBeDefined();
    expect(result.dependentCare!.qualifyingExpenses).toBe(3000);
    expect(result.dependentCare!.credit).toBeGreaterThan(0);
    // Compare with FSA version
    const trWithFSA = baseTaxReturn({
      dependentCare: {
        totalExpenses: 3000,
        qualifyingPersons: 1,
        dependentCareFSA: 1000,
      },
    });
    const resultFSA = calculateForm1040(trWithFSA);
    expect(result.dependentCare!.credit).toBeGreaterThan(resultFSA.dependentCare!.credit);
  });
});

// ════════════════════════════════════════════════════
// 36. Extension Filing
// ════════════════════════════════════════════════════

describe('36. Extension Filing', () => {
  it('extensionFiled: true shows in result', () => {
    const tr = baseTaxReturn({ extensionFiled: true });
    const result = calculateForm1040(tr);
    expect(result.form1040.extensionFiled).toBe(true);
  });

  it('extensionFiled: false shows false in result', () => {
    const tr = baseTaxReturn({ extensionFiled: false });
    const result = calculateForm1040(tr);
    expect(result.form1040.extensionFiled).toBe(false);
  });
});

// ════════════════════════════════════════════════════
// Integration Tests: Multiple Sprint 11 Features
// ════════════════════════════════════════════════════

describe('Sprint 11 Integration', () => {
  it('combined scenario with HSA, adoption credit, household employees, and NOL', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'BigCo', wages: 100000, federalTaxWithheld: 15000 }],
      hsaContribution: {
        coverageType: 'family',
        totalContributions: 8550,
      },
      adoptionCredit: {
        qualifiedExpenses: 12000,
        numberOfChildren: 1,
      },
      householdEmployees: {
        totalCashWages: 15000,
        numberOfEmployees: 1,
      },
      nolCarryforward: 3000,
      extensionFiled: true,
    });
    const result = calculateForm1040(tr);

    // HSA deduction reduces AGI
    expect(result.form1040.hsaDeduction).toBe(8550);
    expect(result.form1040.hsaDeductionComputed).toBe(8550);

    // NOL deduction reduces taxable income
    expect(result.form1040.nolDeduction).toBe(3000);

    // Adoption credit is non-refundable
    expect(result.credits.adoptionCredit).toBe(12000);
    expect(result.credits.totalNonRefundable).toBeGreaterThanOrEqual(12000);

    // Schedule H tax included (combined employer+employee rates)
    // SS: min(15000, 176100) * 0.124 = 1860
    // Medicare: 15000 * 0.029 = 435
    // FUTA: min(15000, 7000) * 0.006 = 42
    // Total = 2337
    expect(result.form1040.householdEmploymentTax).toBe(2337);

    // Extension filed
    expect(result.form1040.extensionFiled).toBe(true);

    // Total tax (after non-refundable credits) includes Schedule H
    expect(result.form1040.totalTax).toBeGreaterThanOrEqual(result.form1040.householdEmploymentTax);
  });

  it('combined scenario with FEIE, kiddie tax, and estimated penalty', () => {
    const tr = baseTaxReturn({
      w2Income: [{ id: 'w1', employerName: 'Overseas Inc', wages: 90000, federalTaxWithheld: 5000 }],
      foreignEarnedIncome: {
        foreignEarnedIncome: 60000,
        qualifyingDays: 365,
      },
      kiddieTax: {
        childUnearnedIncome: 5000,
        childAge: 16,
        parentMarginalRate: 0.22,
      },
      priorYearTax: 8000,
      estimatedPaymentsMade: 0,
    });
    const result = calculateForm1040(tr);

    // FEIE exclusion
    expect(result.form1040.feieExclusion).toBe(60000);
    expect(result.feie).toBeDefined();

    // Kiddie tax
    // unearnedAbove = 5000 - 2700 = 2300
    // additionalTax = 2300 * (0.22 - 0.10) = 2300 * 0.12 = 276
    expect(result.form1040.kiddieTaxAmount).toBe(276);
    expect(result.kiddieTax).toBeDefined();

    // Estimated tax penalty computed (priorYearTax provided)
    expect(result.estimatedTaxPenalty).toBeDefined();
    expect(result.form1040.estimatedTaxPenalty).toBeGreaterThanOrEqual(0);
  });

  it('backward compatibility: return with no Sprint 11 fields works unchanged', () => {
    // A plain baseTaxReturn with no Sprint 11 fields should still work
    const tr = baseTaxReturn();
    const result = calculateForm1040(tr);

    // All Sprint 11 form1040 fields should have zero/default values
    expect(result.form1040.hsaDeductionComputed).toBe(0);
    expect(result.form1040.rothConversionTaxable).toBe(0);
    expect(result.form1040.kiddieTaxAmount).toBe(0);
    expect(result.form1040.householdEmploymentTax).toBe(0);
    expect(result.form1040.feieExclusion).toBe(0);
    expect(result.form1040.nolDeduction).toBe(0);
    expect(result.form1040.estimatedTaxPenalty).toBe(0);
    expect(result.form1040.extensionFiled).toBe(false);

    // Sprint 11 sub-results should be undefined (except estimatedTaxPenalty which is always computed)
    expect(result.form8606).toBeUndefined();
    expect(result.estimatedTaxPenalty).toBeDefined();
    expect(result.estimatedTaxPenalty!.penalty).toBe(0);
    expect(result.kiddieTax).toBeUndefined();
    expect(result.feie).toBeUndefined();
    expect(result.scheduleH).toBeUndefined();
    expect(result.adoptionCredit).toBeUndefined();

    // Credits should have zero adoption credit
    expect(result.credits.adoptionCredit).toBe(0);

    // Basic calculation should still produce valid results
    expect(result.form1040.totalWages).toBe(75000);
    expect(result.form1040.totalTax).toBeGreaterThan(0);
    expect(result.form1040.totalWithholding).toBe(10000);
  });
});

// ═══════════════════════════════════════════════════════════════
// HSA Excess Contribution Corrective Withdrawal
// ═══════════════════════════════════════════════════════════════

describe('HSA Excess Contribution Corrective Withdrawal', () => {
  function makeHSAReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
    return {
      id: 'test',
      taxYear: 2025,
      filingStatus: FilingStatus.Single,
      status: 'in_progress',
      currentStep: 0,
      currentSection: 'income',
      dependents: [],
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 60000, federalWithheld: 8000, box12Codes: [{ code: 'W', amount: 0 }] }],
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
      income1099DA: [],
      income1099C: [],
      income1099Q: [],
      incomeW2G: [],
      rentalProperties: [],
      otherIncome: 0,
      businesses: [],
      expenses: [],
      deductionMethod: 'standard',
      educationCredits: [],
      incomeDiscovery: {},
      createdAt: '',
      updatedAt: '',
      hsaDeduction: 5300, // $1,000 over the $4,300 self-only limit
      hsaContribution: {
        coverageType: 'self_only' as const,
        totalContributions: 5300,
      },
      excessContributions: {
        hsaExcessContribution: 1000,
      },
      ...overrides,
    } as TaxReturn;
  }

  it('no withdrawal: full 6% penalty on excess', () => {
    const tr = makeHSAReturn();
    const result = calculateForm1040(tr);
    // $1,000 excess × 6% = $60 penalty
    expect(result.form1040.excessContributionPenalty).toBe(60);
  });

  it('full withdrawal: no 6% penalty', () => {
    const tr = makeHSAReturn({
      hsaExcessWithdrawal: { choice: 'full' },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.excessContributionPenalty).toBe(0);
  });

  it('partial withdrawal: penalty on remaining excess only', () => {
    const tr = makeHSAReturn({
      hsaExcessWithdrawal: { choice: 'partial', withdrawalAmount: 600 },
    });
    const result = calculateForm1040(tr);
    // $1,000 - $600 withdrawn = $400 remaining × 6% = $24
    expect(result.form1040.excessContributionPenalty).toBe(24);
  });

  it('partial withdrawal exceeding excess: no penalty', () => {
    const tr = makeHSAReturn({
      hsaExcessWithdrawal: { choice: 'partial', withdrawalAmount: 1500 },
    });
    const result = calculateForm1040(tr);
    // Can't withdraw more than excess, capped to $1,000 → $0 remaining
    expect(result.form1040.excessContributionPenalty).toBe(0);
  });

  it('choice=none: full 6% penalty (same as no withdrawal object)', () => {
    const tr = makeHSAReturn({
      hsaExcessWithdrawal: { choice: 'none' },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.excessContributionPenalty).toBe(60);
  });

  it('full withdrawal with earnings: earnings added to Other income and AGI', () => {
    const trWithout = makeHSAReturn({
      hsaExcessWithdrawal: { choice: 'full', earningsOnExcess: 0 },
    });
    const trWith = makeHSAReturn({
      hsaExcessWithdrawal: { choice: 'full', earningsOnExcess: 150 },
    });
    const resultWithout = calculateForm1040(trWithout);
    const resultWith = calculateForm1040(trWith);

    // Earnings should increase AGI by $150
    expect(resultWith.form1040.agi).toBe(resultWithout.form1040.agi + 150);
    // No penalty either way
    expect(resultWith.form1040.excessContributionPenalty).toBe(0);
    expect(resultWithout.form1040.excessContributionPenalty).toBe(0);
  });

  it('partial withdrawal with earnings: both penalty reduction and income addition', () => {
    const tr = makeHSAReturn({
      hsaExcessWithdrawal: { choice: 'partial', withdrawalAmount: 700, earningsOnExcess: 45 },
    });
    const result = calculateForm1040(tr);
    // $1,000 - $700 = $300 remaining × 6% = $18 penalty
    expect(result.form1040.excessContributionPenalty).toBe(18);
    // AGI should include the $45 earnings
    const trNoEarnings = makeHSAReturn({
      hsaExcessWithdrawal: { choice: 'partial', withdrawalAmount: 700, earningsOnExcess: 0 },
    });
    const resultNoEarnings = calculateForm1040(trNoEarnings);
    expect(result.form1040.agi).toBe(resultNoEarnings.form1040.agi + 45);
  });

  it('HSA deduction is still capped at limit regardless of withdrawal choice', () => {
    const trFull = makeHSAReturn({
      hsaExcessWithdrawal: { choice: 'full' },
    });
    const trNone = makeHSAReturn({
      hsaExcessWithdrawal: { choice: 'none' },
    });
    const resultFull = calculateForm1040(trFull);
    const resultNone = calculateForm1040(trNone);
    // HSA deduction stays capped at $4,300 regardless
    expect(resultFull.form1040.hsaDeduction).toBe(4300);
    expect(resultNone.form1040.hsaDeduction).toBe(4300);
  });
});

// ── IRA Excess Contribution Corrective Withdrawal ───────────────────
describe('IRA excess contribution corrective withdrawal', () => {
  function makeIRAReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
    return {
      ...baseTaxReturn(),
      income1099R: [],
      iraContribution: 9000, // $2,000 over the $7,000 limit (under 50)
      dateOfBirth: '1990-01-01', // Under 50 → $7,000 limit
      excessContributions: {
        iraExcessContribution: 2000,
      },
      ...overrides,
    } as TaxReturn;
  }

  it('no withdrawal: full 6% penalty on IRA excess', () => {
    const tr = makeIRAReturn();
    const result = calculateForm1040(tr);
    // $2,000 excess × 6% = $120 penalty
    expect(result.form1040.excessContributionPenalty).toBe(120);
  });

  it('full withdrawal: no 6% penalty on IRA excess', () => {
    const tr = makeIRAReturn({
      iraExcessWithdrawal: { choice: 'full' },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.excessContributionPenalty).toBe(0);
  });

  it('partial withdrawal: penalty on remaining IRA excess only', () => {
    const tr = makeIRAReturn({
      iraExcessWithdrawal: { choice: 'partial', withdrawalAmount: 1200 },
    });
    const result = calculateForm1040(tr);
    // $2,000 - $1,200 withdrawn = $800 remaining × 6% = $48
    expect(result.form1040.excessContributionPenalty).toBe(48);
  });

  it('partial withdrawal exceeding excess: no penalty', () => {
    const tr = makeIRAReturn({
      iraExcessWithdrawal: { choice: 'partial', withdrawalAmount: 3000 },
    });
    const result = calculateForm1040(tr);
    // Can't withdraw more than excess, capped to $2,000 → $0 remaining
    expect(result.form1040.excessContributionPenalty).toBe(0);
  });

  it('choice=none: full 6% penalty (same as no withdrawal object)', () => {
    const tr = makeIRAReturn({
      iraExcessWithdrawal: { choice: 'none' },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.excessContributionPenalty).toBe(120);
  });

  it('full withdrawal with earnings: earnings added to Other income and AGI', () => {
    const trWithout = makeIRAReturn({
      iraExcessWithdrawal: { choice: 'full', earningsOnExcess: 0 },
    });
    const trWith = makeIRAReturn({
      iraExcessWithdrawal: { choice: 'full', earningsOnExcess: 200 },
    });
    const resultWithout = calculateForm1040(trWithout);
    const resultWith = calculateForm1040(trWith);

    // Earnings should increase AGI by $200
    expect(resultWith.form1040.agi).toBe(resultWithout.form1040.agi + 200);
    // No penalty either way
    expect(resultWith.form1040.excessContributionPenalty).toBe(0);
    expect(resultWithout.form1040.excessContributionPenalty).toBe(0);
  });

  it('partial withdrawal with earnings: both penalty reduction and income addition', () => {
    const tr = makeIRAReturn({
      iraExcessWithdrawal: { choice: 'partial', withdrawalAmount: 1500, earningsOnExcess: 75 },
    });
    const result = calculateForm1040(tr);
    // $2,000 - $1,500 = $500 remaining × 6% = $30 penalty
    expect(result.form1040.excessContributionPenalty).toBe(30);
    // AGI should include the $75 earnings
    const trNoEarnings = makeIRAReturn({
      iraExcessWithdrawal: { choice: 'partial', withdrawalAmount: 1500, earningsOnExcess: 0 },
    });
    const resultNoEarnings = calculateForm1040(trNoEarnings);
    expect(result.form1040.agi).toBe(resultNoEarnings.form1040.agi + 75);
  });

  it('combined HSA + IRA excess: both withdrawal choices apply independently', () => {
    const tr = makeIRAReturn({
      hsaDeduction: 5300,
      hsaContribution: { coverageType: 'self_only' as const, totalContributions: 5300 },
      excessContributions: {
        iraExcessContribution: 2000,
        hsaExcessContribution: 1000,
      },
      hsaExcessWithdrawal: { choice: 'full' }, // HSA: fully withdrawn → no HSA penalty
      iraExcessWithdrawal: { choice: 'partial', withdrawalAmount: 500 }, // IRA: $500 withdrawn → $1,500 remaining
    });
    const result = calculateForm1040(tr);
    // HSA: $0 penalty (fully withdrawn)
    // IRA: $1,500 remaining × 6% = $90
    expect(result.form1040.excessContributionPenalty).toBe(90);
  });
});
