/**
 * Phase 9: Bug Fixes + Missing Coverage
 *
 * Bug fixes confirmed by multi-model review (GPT-5.2, Claude Opus 4.6, Gemini 3.1 Pro):
 *   A1. Dependent Care FSA taxable excess not flowing to income (IRC §129)
 *   A2. Passive Activity Loss MAGI includes taxable Social Security (IRC §469(i)(3)(F))
 *   A4. NIIT K-1 rental income double-counting (IRC §1411)
 *   A5. FEIE add-back for student loan / IRA MAGI (IRC §221(b)(2)(C)(iii), §219(g)(3)(A)(ii))
 *
 * Missing coverage (identified by models):
 *   B1. IRA Deduction + FEIE MAGI interaction
 *   B2. Schedule E day-count boundaries (Augusta rule)
 *   B3. Credit stacking / non-refundable cap enforcement
 *   B4. NIIT base composition (K-1 scenarios)
 */
import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateScheduleE } from '../src/engine/scheduleE.js';
import { TaxReturn, FilingStatus, RentalProperty } from '../src/types/index.js';

// ── Helper ──────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'p9-test',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    schemaVersion: 1,
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
    incomeW2G: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    rentalProperties: [],
    otherIncome: 0,
    businesses: [],
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function makeRental(overrides: Partial<RentalProperty> = {}): RentalProperty {
  return {
    id: 'rental-1',
    address: '123 Test St',
    propertyType: 'single_family',
    daysRented: 365,
    personalUseDays: 0,
    rentalIncome: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// A1: Dependent Care FSA Taxable Excess → Income (IRC §129)
// ═══════════════════════════════════════════════════════════════════════════

describe('A1: Dependent Care FSA Taxable Excess Flows to Income', () => {
  it('$7k FSA benefits, MFJ → AGI includes $2k taxable excess', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Employer', wages: 80000, federalTaxWithheld: 8000, socialSecurityWages: 80000, medicareWages: 80000 }],
      dependentCare: {
        totalExpenses: 10000,
        qualifyingPersons: 2,
        employerBenefits: 7000,   // $2k over $5k limit
        spouseEarnedIncome: 50000,
      },
    });
    const result = calculateForm1040(tr);

    // AGI should include $80k wages + $2k taxable FSA excess = $82k
    // (The $2k excess per IRC §129 must appear as income)
    expect(result.form1040.agi).toBeCloseTo(82000, 0);
    expect(result.form1040.totalIncome).toBeCloseTo(82000, 0);
  });

  it('$5k FSA benefits → no taxable excess (at limit)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Employer', wages: 80000, federalTaxWithheld: 8000, socialSecurityWages: 80000, medicareWages: 80000 }],
      dependentCare: {
        totalExpenses: 10000,
        qualifyingPersons: 2,
        employerBenefits: 5000,   // exactly at $5k limit
        spouseEarnedIncome: 50000,
      },
    });
    const result = calculateForm1040(tr);

    // AGI should be exactly $80k (no excess)
    expect(result.form1040.agi).toBeCloseTo(80000, 0);
  });

  it('$3k FSA benefits, MFS (lived apart) → $500 taxable excess ($2.5k MFS limit)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingSeparately,
      livedApartFromSpouse: true,
      w2Income: [{ id: 'w1', employerName: 'Employer', wages: 60000, federalTaxWithheld: 6000, socialSecurityWages: 60000, medicareWages: 60000 }],
      dependentCare: {
        totalExpenses: 5000,
        qualifyingPersons: 1,
        employerBenefits: 3000,   // $500 over $2.5k MFS limit
      },
    });
    const result = calculateForm1040(tr);

    // AGI should include $60k wages + $500 taxable FSA excess = $60.5k
    expect(result.form1040.agi).toBeCloseTo(60500, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A2: Passive Activity Loss MAGI Excludes Taxable SS (IRC §469(i)(3)(F))
// ═══════════════════════════════════════════════════════════════════════════

describe('A2: Passive Activity Loss MAGI Excludes Taxable Social Security (Form 8582)', () => {
  it('$80k wages + $25k SS + rental loss → passive loss not phased out (MAGI = $80k < $100k)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 80000, federalTaxWithheld: 10000, socialSecurityWages: 80000, medicareWages: 80000 }],
      incomeSSA1099: { totalBenefits: 25000 },
      rentalProperties: [makeRental({
        rentalIncome: 20000,
        mortgageInterest: 10000,
        repairs: 5000,
        depreciation: 20000,
        insurance: 5000,
        taxes: 5000,
      })],
    });
    const result = calculateForm1040(tr);

    // MAGI for passive loss = $80k (excludes taxable SS per §469(i)(3)(F))
    // $80k < $100k threshold → full $25k passive loss allowance
    // Net rental = $20k income - $45k expenses = -$25k loss
    // Allowable: full $25k (MAGI $80k < $100k)
    expect(result.form8582).toBeDefined();
    expect(result.form8582!.allowedPassiveLoss).toBe(25000);
    expect(result.form8582!.totalSuspendedLoss).toBe(0);
  });

  it('$110k wages + $30k SS + rental loss → passive loss phased out based on $110k MAGI', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 110000, federalTaxWithheld: 15000, socialSecurityWages: 110000, medicareWages: 110000 }],
      incomeSSA1099: { totalBenefits: 30000 },
      rentalProperties: [makeRental({
        rentalIncome: 20000,
        mortgageInterest: 15000,
        repairs: 10000,
        depreciation: 20000,
        insurance: 5000,
      })],
    });
    const result = calculateForm1040(tr);

    // MAGI for passive loss = $110k (excludes taxable SS)
    // Phase-out: ($110k - $100k) × 50% = $5k reduction
    // Max allowance = $25k - $5k = $20k
    // Net rental = $20k income - $50k expenses = -$30k loss
    // Allowable: $20k (not full $25k, but not $0 either)
    expect(result.form8582).toBeDefined();
    expect(result.form8582!.allowedPassiveLoss).toBe(20000);
  });

  it('$150k wages (no SS) + rental loss → passive loss fully phased out', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 150000, federalTaxWithheld: 25000, socialSecurityWages: 150000, medicareWages: 150000 }],
      rentalProperties: [makeRental({
        rentalIncome: 20000,
        mortgageInterest: 15000,
        repairs: 10000,
        depreciation: 20000,
        insurance: 5000,
      })],
    });
    const result = calculateForm1040(tr);

    // MAGI for passive loss = $150k ≥ $150k → $0 allowance
    expect(result.form8582).toBeDefined();
    expect(result.form8582!.allowedPassiveLoss).toBe(0);
    expect(result.form8582!.totalSuspendedLoss).toBe(30000);
  });

  it('$95k wages + rental loss → passive loss uses wages-only MAGI', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 95000, federalTaxWithheld: 12000, socialSecurityWages: 95000, medicareWages: 95000 }],
      rentalProperties: [makeRental({
        rentalIncome: 10000,
        mortgageInterest: 10000,
        depreciation: 15000,
        insurance: 5000,
      })],
    });
    const result = calculateForm1040(tr);

    // MAGI for passive loss = $95k < $100k → full $25k allowance
    // Net rental = $10k - $30k = -$20k loss
    // Allowable: full $20k (loss < $25k allowance)
    expect(result.form8582).toBeDefined();
    expect(result.form8582!.allowedPassiveLoss).toBe(20000);
    expect(result.form8582!.totalSuspendedLoss).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A4: NIIT K-1 Rental Income Not Double-Counted (IRC §1411)
// ═══════════════════════════════════════════════════════════════════════════

describe('A4: NIIT K-1 Rental Income Not Double-Counted', () => {
  it('K-1 with $10k rental income + no direct rental → NIIT base includes $10k (not $20k)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 250000, federalTaxWithheld: 40000, socialSecurityWages: 250000, medicareWages: 250000 }],
      incomeK1: [{
        id: 'k1-1',
        entityName: 'Test LLC',
        entityEin: '12-3456789',
        entityType: 'partnership',
        rentalIncome: 10000,
      }],
    });
    const result = calculateForm1040(tr);

    // K-1 rental flows through Schedule E → netRentalIncome = $10k
    // Must NOT be double-counted in NIIT (was previously counted in both
    // rentalIncomeForNIIT and k1InvestmentForNIIT)
    // AGI = $260k; NIIT threshold (Single) = $200k
    // NIIT = 3.8% × min(investment income, AGI - $200k)
    // Investment income should be $10k (K-1 rental only)
    // NIIT = 3.8% × min($10k, $60k) = 3.8% × $10k = $380
    expect(result.form1040.niitTax).toBeCloseTo(380, 0);
  });

  it('K-1 with $10k rental + direct rental $15k → NIIT base includes $25k total', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 250000, federalTaxWithheld: 40000, socialSecurityWages: 250000, medicareWages: 250000 }],
      incomeK1: [{
        id: 'k1-1',
        entityName: 'Test LLC',
        entityEin: '12-3456789',
        entityType: 'partnership',
        rentalIncome: 10000,
      }],
      rentalProperties: [makeRental({
        id: 'rental-2',
        address: '456 Rent Ave',
        rentalIncome: 30000,
        mortgageInterest: 10000,
        insurance: 5000,
      })],
    });
    const result = calculateForm1040(tr);

    // Direct rental net: $30k - $15k expenses = $15k
    // K-1 rental: $10k
    // Schedule E netRentalIncome = $25k (includes both)
    // rentalIncomeForNIIT = $25k (from Schedule E)
    // k1InvestmentForNIIT should NOT include K-1 rental (already in rentalIncomeForNIIT)
    // Investment income = $25k rental
    // AGI ≈ $275k; NIIT = 3.8% × min($25k, $75k) = 3.8% × $25k = $950
    expect(result.form1040.niitTax).toBeCloseTo(950, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B1: IRA Deduction + FEIE MAGI (code now fixed with FEIE add-back)
// ═══════════════════════════════════════════════════════════════════════════

describe('B1: IRA Deduction with FEIE MAGI Add-back', () => {
  it('$130k foreign income, IRA with employer plan → IRA fully phased out (MAGI=$130k > $89k)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Foreign Corp', wages: 130000, federalTaxWithheld: 0, socialSecurityWages: 130000, medicareWages: 130000 }],
      foreignEarnedIncome: {
        foreignEarnedIncome: 130000,
        qualifyingDays: 365,
      },
      iraContribution: 7000,
      coveredByEmployerPlan: true,
    });
    const result = calculateForm1040(tr);

    // FEIE excludes $130k, totalIncome ≈ $0
    // MAGI for IRA = totalIncome + FEIE = $0 + $130k = $130k
    // Single with employer plan: phase-out $79k-$89k → $130k >> $89k → IRA deduction = $0
    expect(result.form1040.iraDeduction).toBe(0);
  });

  it('$75k foreign income, IRA with employer plan → full IRA deduction (MAGI=$75k < $79k)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Foreign Corp', wages: 75000, federalTaxWithheld: 8000, socialSecurityWages: 75000, medicareWages: 75000 }],
      foreignEarnedIncome: {
        foreignEarnedIncome: 75000,
        qualifyingDays: 365,
      },
      iraContribution: 7000,
      coveredByEmployerPlan: true,
    });
    const result = calculateForm1040(tr);

    // FEIE excludes $75k; totalIncome ≈ $0
    // MAGI for IRA = $0 + $75k = $75k < $79k → full deduction
    expect(result.form1040.iraDeduction).toBe(7000);
  });

  it('$84k foreign income, IRA with employer plan → partial IRA deduction (MAGI in $79k-$89k)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Foreign Corp', wages: 84000, federalTaxWithheld: 9000, socialSecurityWages: 84000, medicareWages: 84000 }],
      foreignEarnedIncome: {
        foreignEarnedIncome: 84000,
        qualifyingDays: 365,
      },
      iraContribution: 7000,
      coveredByEmployerPlan: true,
    });
    const result = calculateForm1040(tr);

    // MAGI for IRA = $84k (foreign income added back); in $79k-$89k range → partial deduction
    // ($89k - $84k) / $10k = 50% × $7k = $3,500
    expect(result.form1040.iraDeduction).toBeGreaterThan(0);
    expect(result.form1040.iraDeduction).toBeLessThan(7000);
    expect(result.form1040.iraDeduction).toBeCloseTo(3500, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B2: Schedule E Day-Count Boundaries (Augusta Rule)
// ═══════════════════════════════════════════════════════════════════════════

describe('B2: Schedule E Day-Count Boundaries', () => {
  it('rental exactly 14 days → income excluded (Augusta rule)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 80000, federalTaxWithheld: 10000, socialSecurityWages: 80000, medicareWages: 80000 }],
      rentalProperties: [makeRental({
        daysRented: 14,       // Exactly 14 — excluded per §280A(g)
        personalUseDays: 200,
        rentalIncome: 5000,
        mortgageInterest: 1000,
      })],
    });
    const result = calculateForm1040(tr);

    // <15 days rented → income excluded entirely
    // Schedule E result may exist but income should be 0
    expect(result.form1040.scheduleEIncome).toBe(0);
    // AGI should be just wages
    expect(result.form1040.agi).toBeCloseTo(80000, 0);
  });

  it('rental exactly 15 days → income included', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 80000, federalTaxWithheld: 10000, socialSecurityWages: 80000, medicareWages: 80000 }],
      rentalProperties: [makeRental({
        daysRented: 15,       // 15 — included
        personalUseDays: 0,
        rentalIncome: 5000,
        mortgageInterest: 1000,
      })],
    });
    const result = calculateForm1040(tr);

    // 15 days → income included
    expect(result.scheduleE).toBeDefined();
    // Net = $5k - $1k mortgage = $4k
    expect(result.scheduleE!.netRentalIncome).toBe(4000);
  });

  it('100 rental days, 14 personal days → investment property (14 ≤ threshold)', () => {
    // Personal use threshold = max(14, floor(100 * 0.10)) = max(14, 10) = 14
    // 14 personal days = threshold → NOT personal-use property
    const result = calculateScheduleE(
      [makeRental({
        daysRented: 100,
        personalUseDays: 14,
        rentalIncome: 30000,
        mortgageInterest: 10000,
        depreciation: 25000,
      })],
    );

    // Net = $30k - $35k = -$5k loss (raw, no passive loss limitation)
    expect(result.netRentalIncome).toBe(-5000);
    expect(result.allowableLoss).toBe(0);
    expect(result.scheduleEIncome).toBe(-5000);
  });

  it('100 rental days, 15 personal days → personal-use property', () => {
    // Personal use threshold = max(14, floor(100 * 0.10)) = max(14, 10) = 14
    // 15 > 14 → personal-use property (expenses limited to income)
    const result = calculateScheduleE(
      [makeRental({
        daysRented: 100,
        personalUseDays: 15,
        rentalIncome: 30000,
        mortgageInterest: 10000,
        depreciation: 25000,
      })],
    );

    // Personal-use: expenses capped at income → net = $0 (no loss allowed)
    expect(result.netRentalIncome).toBe(0);
    expect(result.allowableLoss).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B3: Credit Stacking / Non-Refundable Cap Enforcement
// ═══════════════════════════════════════════════════════════════════════════

describe('B3: Credit Stacking / Non-Refundable Cap', () => {
  it('non-refundable credits cannot push tax below $0', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 15000, federalTaxWithheld: 500, socialSecurityWages: 15000, medicareWages: 15000 }],
      childTaxCredit: { qualifyingChildren: 3, otherDependents: 0 },
      dependents: [
        { firstName: 'Child', lastName: 'One', dateOfBirth: '2020-01-01', relationship: 'child', monthsLivedWithYou: 12, ssn: '111-11-1111' },
        { firstName: 'Child', lastName: 'Two', dateOfBirth: '2021-01-01', relationship: 'child', monthsLivedWithYou: 12, ssn: '222-22-2222' },
        { firstName: 'Child', lastName: 'Three', dateOfBirth: '2022-01-01', relationship: 'child', monthsLivedWithYou: 12, ssn: '333-33-3333' },
      ],
    });
    const result = calculateForm1040(tr);

    // Low income + 3 kids → CTC ($6k) likely exceeds small income tax
    // Non-refundable portion should not push taxAfterCredits below $0
    expect(result.form1040.taxAfterCredits).toBeGreaterThanOrEqual(0);
    // totalTax can be > 0 due to SE tax, Medicare, etc.
    expect(result.form1040.totalTax).toBeGreaterThanOrEqual(0);
  });

  it('FTC + CTC + education credit ordering does not produce NaN', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, medicareWages: 100000 }],
      childTaxCredit: { qualifyingChildren: 2, otherDependents: 0 },
      dependents: [
        { firstName: 'A', lastName: 'B', dateOfBirth: '2018-06-01', relationship: 'child', monthsLivedWithYou: 12, ssn: '111-11-1111' },
        { firstName: 'C', lastName: 'D', dateOfBirth: '2019-06-01', relationship: 'child', monthsLivedWithYou: 12, ssn: '222-22-2222' },
      ],
      educationCredits: [
        { type: 'american_opportunity', tuitionPaid: 4000, scholarships: 0 },
      ],
      foreignTaxCredit: {
        foreignTaxPaidOrAccrued: 500,
        foreignSourceTaxableIncome: 5000,
      },
    });
    const result = calculateForm1040(tr);

    // No NaN in critical fields
    expect(Number.isFinite(result.form1040.totalTax)).toBe(true);
    expect(Number.isFinite(result.form1040.totalCredits)).toBe(true);
    expect(Number.isFinite(result.form1040.taxAfterCredits)).toBe(true);
    expect(Number.isFinite(result.form1040.amountOwed)).toBe(true);
    expect(Number.isFinite(result.form1040.refundAmount)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B4: NIIT Base Composition (K-1 Scenarios)
// ═══════════════════════════════════════════════════════════════════════════

describe('B4: NIIT Base Composition — K-1 Scenarios', () => {
  it('K-1 with only interest/dividends → NIIT base not double-counted', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 250000, federalTaxWithheld: 40000, socialSecurityWages: 250000, medicareWages: 250000 }],
      incomeK1: [{
        id: 'k1-1',
        entityName: 'Investment LP',
        entityEin: '12-3456789',
        entityType: 'partnership',
        interestIncome: 5000,
        ordinaryDividends: 3000,
        qualifiedDividends: 2000,
      }],
    });
    const result = calculateForm1040(tr);

    // K-1 interest ($5k) is in allInterest; K-1 dividends ($3k) in allOrdinaryDividends
    // k1InvestmentForNIIT adds them but then subtracts in investmentIncomeForNIIT
    // Net contribution: $5k interest + $3k dividends (not $16k from double-counting)
    // Total investment: $8k; AGI ≈ $258k; NIIT = 3.8% × min($8k, $58k) = $304
    expect(result.form1040.niitTax).toBeCloseTo(304, 0);
  });

  it('Schedule E losses + positive royalties → NIIT handles correctly', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 250000, federalTaxWithheld: 40000, socialSecurityWages: 250000, medicareWages: 250000 }],
      rentalProperties: [makeRental({
        rentalIncome: 10000,
        mortgageInterest: 10000,
        depreciation: 20000,
        insurance: 5000,
      })],
      income1099MISC: [{ id: 'misc-1', payerName: 'Publisher', otherIncome: 0, royalties: 8000 }],
    });
    const result = calculateForm1040(tr);

    // Rental net: $10k - $35k = -$25k loss (rentalIncomeForNIIT = max(0, -$25k) = $0)
    // Royalties: $8k (royaltyIncomeForNIIT = max(0, $8k) = $8k)
    // NIIT investment income should include royalties but not the rental loss
    expect(result.form1040.niitTax).toBeGreaterThan(0);
    expect(Number.isFinite(result.form1040.niitTax)).toBe(true);
  });

  it('Schedule D net loss → NIIT does not include negative cap gains', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Emp', wages: 250000, federalTaxWithheld: 40000, socialSecurityWages: 250000, medicareWages: 250000 }],
      income1099B: [{
        id: 'b1',
        brokerName: 'Broker',
        description: 'Stock A',
        proceeds: 10000,
        costBasis: 25000,
        dateSold: '2025-06-15',
        dateAcquired: '2024-01-15',
        isLongTerm: false,
      }],
      income1099INT: [{ id: 'int1', payerName: 'Bank', amount: 2000 }],
    });
    const result = calculateForm1040(tr);

    // Schedule D: -$15k short-term loss (capped at -$3k deduction)
    // scheduleDGainForNIIT = max(0, netGainOrLoss) = max(0, -$15k) = $0
    // Investment income = $2k interest only
    // AGI ≈ $249k; NIIT threshold = $200k
    // NIIT = 3.8% × min($2k, $49k) = $76
    expect(result.form1040.niitTax).toBeCloseTo(76, 0);
  });
});
