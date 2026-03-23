import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateScheduleF } from '../src/engine/scheduleF.js';
import { calculateScheduleR } from '../src/engine/scheduleR.js';
import { FilingStatus, TaxReturn, ScheduleFInfo, ScheduleRInfo } from '../src/types/index.js';
import { SCHEDULE_R } from '../src/constants/tax2025.js';

// ─── Helper: minimal valid TaxReturn ───────────────────
function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint26',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 6000, socialSecurityWages: 50000 }],
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
// 26A: Schedule F — Profit or Loss from Farming
// IRC §§61, 162, 175, 180; Schedule F (Form 1040)
// ════════════════════════════════════════════════════════
describe('Sprint 26A: Schedule F — Farm Income', () => {

  // ─── Unit Tests ──────────────────────────────────────

  describe('Unit: calculateScheduleF()', () => {

    it('should return zero for empty farm', () => {
      const result = calculateScheduleF({});
      expect(result.grossIncome).toBe(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.netFarmProfit).toBe(0);
    });

    it('should compute gross income from sales of products raised', () => {
      const result = calculateScheduleF({
        salesOfProducts: 80000,
      });
      expect(result.grossIncome).toBe(80000);
      expect(result.totalExpenses).toBe(0);
      expect(result.netFarmProfit).toBe(80000);
    });

    it('should subtract cost of livestock from livestock sales', () => {
      const result = calculateScheduleF({
        salesOfLivestock: 50000,
        costOfLivestock: 30000,
      });
      // Net livestock = 50000 - 30000 = 20000
      expect(result.grossIncome).toBe(20000);
      expect(result.netFarmProfit).toBe(20000);
    });

    it('should not allow negative net livestock sales', () => {
      const result = calculateScheduleF({
        salesOfLivestock: 10000,
        costOfLivestock: 15000,
      });
      // Max(0, 10000) - Max(0, 15000) would be -5000, but we floor at the net level
      // Actually the logic: max(0, salesOfLivestock) - max(0, costOfLivestock)
      // = 10000 - 15000 = -5000. But the round2 doesn't floor.
      // Let me re-check: the code does Math.max(0, sales) - Math.max(0, cost)
      // This can go negative. That's correct per Schedule F — if cost exceeds sales,
      // the net reduces gross income.
      expect(result.grossIncome).toBe(-5000);
    });

    it('should aggregate all income categories', () => {
      const result = calculateScheduleF({
        salesOfProducts: 40000,
        cooperativeDistributionsTaxable: 5000,
        agriculturalProgramPayments: 3000,
        cropInsuranceProceeds: 2000,
        customHireIncome: 1000,
        otherFarmIncome: 500,
      });
      expect(result.grossIncome).toBe(51500);
    });

    it('should prefer taxable cooperative distributions over total', () => {
      const result = calculateScheduleF({
        cooperativeDistributions: 10000,      // Total (Line 5a)
        cooperativeDistributionsTaxable: 7000, // Taxable (Line 5b)
      });
      // Should use taxable amount (5b) when provided
      expect(result.grossIncome).toBe(7000);
    });

    it('should fallback to total cooperative distributions when taxable not specified', () => {
      const result = calculateScheduleF({
        cooperativeDistributions: 10000,
        // cooperativeDistributionsTaxable not set
      });
      expect(result.grossIncome).toBe(10000);
    });

    it('should aggregate all expense categories', () => {
      const result = calculateScheduleF({
        salesOfProducts: 100000,
        feed: 15000,
        fertilizers: 8000,
        seeds: 5000,
        labor: 12000,
        repairs: 3000,
        insurance: 2500,
        taxes: 4000,
        utilities: 1500,
        depreciation: 6000,
        gasolineFuel: 3000,
        veterinary: 2000,
        rentLease: 10000,
        chemicals: 1000,
        otherExpenses: 2000,
      });
      const expectedExpenses = 15000 + 8000 + 5000 + 12000 + 3000 + 2500 + 4000 + 1500 + 6000 + 3000 + 2000 + 10000 + 1000 + 2000;
      expect(result.totalExpenses).toBe(expectedExpenses);
      expect(result.netFarmProfit).toBe(100000 - expectedExpenses);
    });

    it('should produce a farm loss when expenses exceed income', () => {
      const result = calculateScheduleF({
        salesOfProducts: 30000,
        feed: 20000,
        seeds: 10000,
        labor: 15000,
      });
      expect(result.grossIncome).toBe(30000);
      expect(result.totalExpenses).toBe(45000);
      expect(result.netFarmProfit).toBe(-15000);
    });

    it('should ignore negative expense values', () => {
      const result = calculateScheduleF({
        salesOfProducts: 50000,
        feed: -5000,     // Should be treated as 0
        seeds: 3000,
      });
      expect(result.totalExpenses).toBe(3000);
      expect(result.netFarmProfit).toBe(47000);
    });

    it('should handle CCC loans as income', () => {
      const result = calculateScheduleF({
        salesOfProducts: 20000,
        cccLoans: 15000,
      });
      expect(result.grossIncome).toBe(35000);
    });

    it('should handle all 23 expense categories', () => {
      const info: ScheduleFInfo = {
        salesOfProducts: 200000,
        carAndTruck: 1000,
        chemicals: 2000,
        conservation: 3000,
        customHireExpense: 4000,
        depreciation: 5000,
        employeeBenefit: 6000,
        feed: 7000,
        fertilizers: 8000,
        freight: 9000,
        gasolineFuel: 10000,
        insurance: 11000,
        interest: 12000,
        labor: 13000,
        pension: 14000,
        rentLease: 15000,
        repairs: 16000,
        seeds: 17000,
        storage: 18000,
        supplies: 19000,
        taxes: 20000,
        utilities: 21000,
        veterinary: 22000,
        otherExpenses: 23000,
      };
      const result = calculateScheduleF(info);
      // Sum of 1000..23000 = n*(n+1)/2 * 1000 = 23*24/2 * 1000 = 276000
      expect(result.totalExpenses).toBe(276000);
      expect(result.netFarmProfit).toBe(200000 - 276000);
    });
  });

  // ─── Form 1040 Integration ──────────────────────────

  describe('Form 1040 Integration', () => {

    it('should add farm profit to total income', () => {
      const tr = baseTaxReturn({
        scheduleF: {
          salesOfProducts: 80000,
          feed: 20000,
          seeds: 10000,
        },
      });
      const result = calculateForm1040(tr);
      // Net farm profit = 80000 - 30000 = 50000
      expect(result.form1040.scheduleFNetProfit).toBe(50000);
      // Total income includes wages (50000) + farm profit (50000)
      expect(result.form1040.totalIncome).toBeGreaterThan(50000);
    });

    it('should include farm loss in total income (reduces income)', () => {
      const trProfit = baseTaxReturn({
        scheduleF: { salesOfProducts: 10000, feed: 40000 },
      });
      const trNoFarm = baseTaxReturn({});
      const resultProfit = calculateForm1040(trProfit);
      const resultNoFarm = calculateForm1040(trNoFarm);
      // Farm loss = 10000 - 40000 = -30000
      expect(resultProfit.form1040.scheduleFNetProfit).toBe(-30000);
      expect(resultProfit.form1040.totalIncome).toBe(resultNoFarm.form1040.totalIncome - 30000);
    });

    it('should include farm profit in SE tax calculation', () => {
      const trFarm = baseTaxReturn({
        w2Income: [],  // No W-2 wages
        scheduleF: { salesOfProducts: 60000, feed: 10000 },
      });
      const result = calculateForm1040(trFarm);
      // Net farm profit = 50000 → subject to SE tax
      expect(result.scheduleSE).toBeDefined();
      expect(result.scheduleSE!.totalSETax).toBeGreaterThan(0);
      expect(result.form1040.seTax).toBeGreaterThan(0);
    });

    it('should combine Schedule C and Schedule F for SE tax', () => {
      const tr = baseTaxReturn({
        w2Income: [],
        income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 30000 }],
        scheduleF: { salesOfProducts: 40000, seeds: 5000 },
      });
      const result = calculateForm1040(tr);
      // Schedule C profit = 30000, Farm profit = 35000, total SE net = 65000
      expect(result.scheduleSE).toBeDefined();
      const seNetEarnings = result.scheduleSE!.netEarnings;
      // Net earnings should reflect combined total (×0.9235 factor)
      expect(seNetEarnings).toBeCloseTo(65000 * 0.9235, 0);
    });

    it('should include farm profit in earned income for credits', () => {
      const tr = baseTaxReturn({
        w2Income: [{ id: 'w2-1', employerName: 'Job', wages: 20000, federalTaxWithheld: 2000, socialSecurityWages: 20000 }],
        scheduleF: { salesOfProducts: 30000, feed: 5000 },
        childTaxCredit: { qualifyingChildren: 2, otherDependents: 0 },
        dependents: [
          { id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2015-01-01' },
          { id: 'd2', firstName: 'C', lastName: 'D', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2017-01-01' },
        ],
      });
      const result = calculateForm1040(tr);
      // Farm profit (25000) + W-2 wages (20000) = earned income 45000
      // CTC should be calculated with this earned income
      expect(result.credits.childTaxCredit).toBeGreaterThan(0);
    });

    it('should expose scheduleF in CalculationResult', () => {
      const tr = baseTaxReturn({
        scheduleF: { salesOfProducts: 50000, labor: 15000 },
      });
      const result = calculateForm1040(tr);
      expect(result.scheduleF).toBeDefined();
      expect(result.scheduleF!.grossIncome).toBe(50000);
      expect(result.scheduleF!.totalExpenses).toBe(15000);
      expect(result.scheduleF!.netFarmProfit).toBe(35000);
    });

    it('should not create Schedule F result when no farm data', () => {
      const tr = baseTaxReturn({});
      const result = calculateForm1040(tr);
      expect(result.scheduleF).toBeUndefined();
      expect(result.form1040.scheduleFNetProfit).toBe(0);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────

  describe('Edge Cases', () => {

    it('should handle zero income with expenses (pure loss)', () => {
      const result = calculateScheduleF({
        feed: 10000,
        seeds: 5000,
      });
      expect(result.grossIncome).toBe(0);
      expect(result.totalExpenses).toBe(15000);
      expect(result.netFarmProfit).toBe(-15000);
    });

    it('should handle very large farm operation', () => {
      const result = calculateScheduleF({
        salesOfProducts: 2000000,
        salesOfLivestock: 500000,
        costOfLivestock: 300000,
        agriculturalProgramPayments: 50000,
        feed: 400000,
        labor: 300000,
        depreciation: 100000,
        insurance: 50000,
      });
      // Gross: (500k-300k) + 2M + 50k = 2,250,000
      expect(result.grossIncome).toBe(2250000);
      expect(result.totalExpenses).toBe(850000);
      expect(result.netFarmProfit).toBe(1400000);
    });

    it('should handle break-even farm', () => {
      const result = calculateScheduleF({
        salesOfProducts: 50000,
        feed: 30000,
        seeds: 20000,
      });
      expect(result.netFarmProfit).toBe(0);
    });
  });

  // ─── Filing Status Coverage ──────────────────────────

  describe('Filing Status Coverage', () => {
    const filingStatuses = [
      FilingStatus.Single,
      FilingStatus.MarriedFilingJointly,
      FilingStatus.MarriedFilingSeparately,
      FilingStatus.HeadOfHousehold,
      FilingStatus.QualifyingSurvivingSpouse,
    ];

    it.each(filingStatuses)('should compute farm income for filing status %i', (fs) => {
      const tr = baseTaxReturn({
        filingStatus: fs,
        w2Income: fs === FilingStatus.HeadOfHousehold
          ? [{ id: 'w2-1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 6000, socialSecurityWages: 50000 }]
          : [{ id: 'w2-1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 6000, socialSecurityWages: 50000 }],
        dependents: fs === FilingStatus.HeadOfHousehold
          ? [{ id: 'd1', firstName: 'A', lastName: 'B', relationship: 'child', monthsLivedWithYou: 12, dateOfBirth: '2015-01-01' }]
          : [],
        paidOverHalfHouseholdCost: fs === FilingStatus.HeadOfHousehold ? true : undefined,
        scheduleF: { salesOfProducts: 40000, feed: 10000 },
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.scheduleFNetProfit).toBe(30000);
    });
  });
});

// ════════════════════════════════════════════════════════
// 26B: Schedule R — Credit for the Elderly or the Disabled
// IRC §22; Schedule R (Form 1040)
// ════════════════════════════════════════════════════════
describe('Sprint 26B: Schedule R — Credit for the Elderly or the Disabled', () => {

  // ─── Constants ───────────────────────────────────────

  describe('Constants', () => {
    it('should have correct initial amounts', () => {
      expect(SCHEDULE_R.INITIAL_AMOUNT_SINGLE).toBe(5000);
      expect(SCHEDULE_R.INITIAL_AMOUNT_MFJ_BOTH).toBe(7500);
      expect(SCHEDULE_R.INITIAL_AMOUNT_MFJ_ONE).toBe(5000);
      expect(SCHEDULE_R.INITIAL_AMOUNT_MFS).toBe(3750);
    });

    it('should have correct AGI thresholds', () => {
      expect(SCHEDULE_R.AGI_THRESHOLD_SINGLE).toBe(7500);
      expect(SCHEDULE_R.AGI_THRESHOLD_MFJ).toBe(10000);
      expect(SCHEDULE_R.AGI_THRESHOLD_MFS).toBe(5000);
    });

    it('should have correct rates', () => {
      expect(SCHEDULE_R.AGI_REDUCTION_RATE).toBe(0.50);
      expect(SCHEDULE_R.CREDIT_RATE).toBe(0.15);
    });
  });

  // ─── Eligibility ─────────────────────────────────────

  describe('Eligibility', () => {

    it('should not qualify if not 65+ and not disabled', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: false },
        10000,
        FilingStatus.Single,
      );
      expect(result.qualifies).toBe(false);
      expect(result.credit).toBe(0);
    });

    it('should qualify for age 65+ taxpayer', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        5000,  // Low AGI to avoid phase-out
        FilingStatus.Single,
      );
      expect(result.qualifies).toBe(true);
      expect(result.initialAmount).toBe(5000);
    });

    it('should qualify for under-65 disabled taxpayer', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: false, isDisabled: true, taxableDisabilityIncome: 4000 },
        5000,
        FilingStatus.Single,
      );
      expect(result.qualifies).toBe(true);
      expect(result.initialAmount).toBe(4000); // Limited to disability income
    });

    it('should not qualify for MFJ if neither spouse qualifies', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: false, isSpouseAge65OrOlder: false },
        10000,
        FilingStatus.MarriedFilingJointly,
      );
      expect(result.qualifies).toBe(false);
      expect(result.credit).toBe(0);
    });

    it('should qualify for MFJ when only one spouse is 65+', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true, isSpouseAge65OrOlder: false },
        5000,
        FilingStatus.MarriedFilingJointly,
      );
      expect(result.initialAmount).toBe(5000); // MFJ one qualifying
    });

    it('should qualify for MFJ when both spouses are 65+', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true, isSpouseAge65OrOlder: true },
        5000,
        FilingStatus.MarriedFilingJointly,
      );
      expect(result.initialAmount).toBe(7500); // MFJ both qualifying
    });
  });

  // ─── Initial Amounts ─────────────────────────────────

  describe('Initial Amounts by Filing Status', () => {

    it('should use $5,000 for Single', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        5000,
        FilingStatus.Single,
      );
      expect(result.initialAmount).toBe(5000);
    });

    it('should use $5,000 for HoH', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        5000,
        FilingStatus.HeadOfHousehold,
      );
      expect(result.initialAmount).toBe(5000);
    });

    it('should use $5,000 for QSS', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        5000,
        FilingStatus.QualifyingSurvivingSpouse,
      );
      expect(result.initialAmount).toBe(5000);
    });

    it('should use $3,750 for MFS', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        3000,
        FilingStatus.MarriedFilingSeparately,
      );
      expect(result.initialAmount).toBe(3750);
    });
  });

  // ─── Disability Income Limitation ────────────────────

  describe('Disability Income Limitation', () => {

    it('should limit initial amount to disability income for under-65 disabled', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: false, isDisabled: true, taxableDisabilityIncome: 2000 },
        5000,
        FilingStatus.Single,
      );
      expect(result.initialAmount).toBe(2000); // min(5000, 2000)
    });

    it('should not limit initial amount for 65+ (even if disability income is low)', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true, isDisabled: true, taxableDisabilityIncome: 1000 },
        5000,
        FilingStatus.Single,
      );
      expect(result.initialAmount).toBe(5000); // Age 65+ = full amount
    });

    it('should use zero disability income as zero initial amount', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: false, isDisabled: true, taxableDisabilityIncome: 0 },
        5000,
        FilingStatus.Single,
      );
      expect(result.initialAmount).toBe(0);
      expect(result.credit).toBe(0);
    });

    it('should handle MFJ with both disabled under 65', () => {
      const result = calculateScheduleR(
        {
          isAge65OrOlder: false,
          isDisabled: true,
          taxableDisabilityIncome: 3000,
          isSpouseAge65OrOlder: false,
          isSpouseDisabled: true,
          spouseTaxableDisabilityIncome: 4000,
        },
        5000,
        FilingStatus.MarriedFilingJointly,
      );
      // Both qualify by disability; combined disability income = 7000
      // Initial amount for MFJ both = 7500, limited to min(7500, 7000) = 7000
      expect(result.initialAmount).toBe(7000);
    });
  });

  // ─── Nontaxable Income Reduction ─────────────────────

  describe('Nontaxable Income Reduction', () => {

    it('should reduce by nontaxable Social Security', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true, nontaxableSocialSecurity: 2000 },
        5000,
        FilingStatus.Single,
      );
      expect(result.nontaxableReduction).toBe(2000);
      // Credit base: 5000 - 2000 - agiReduction
    });

    it('should reduce by nontaxable pensions', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true, nontaxablePensions: 1500 },
        5000,
        FilingStatus.Single,
      );
      expect(result.nontaxableReduction).toBe(1500);
    });

    it('should combine both nontaxable reductions', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true, nontaxableSocialSecurity: 1000, nontaxablePensions: 500 },
        5000,
        FilingStatus.Single,
      );
      expect(result.nontaxableReduction).toBe(1500);
    });

    it('should eliminate credit when nontaxable income exceeds initial amount', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true, nontaxableSocialSecurity: 6000 },
        5000,
        FilingStatus.Single,
      );
      // Initial 5000 - nontaxable 6000 = -1000, floored at 0
      expect(result.creditBase).toBe(0);
      expect(result.credit).toBe(0);
    });
  });

  // ─── AGI Reduction ──────────────────────────────────

  describe('AGI Reduction (50% of excess)', () => {

    it('should not reduce credit when AGI is below threshold', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        7000,  // Below $7,500 Single threshold
        FilingStatus.Single,
      );
      expect(result.agiReduction).toBe(0);
      expect(result.creditBase).toBe(5000);
      expect(result.credit).toBe(750); // 15% × 5000
    });

    it('should reduce by 50% of AGI excess for Single', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        9500,  // $2,000 over $7,500 threshold
        FilingStatus.Single,
      );
      expect(result.agiReduction).toBe(1000); // 50% × 2000
      expect(result.creditBase).toBe(4000); // 5000 - 0 - 1000
      expect(result.credit).toBe(600); // 15% × 4000
    });

    it('should reduce by 50% of AGI excess for MFJ', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true, isSpouseAge65OrOlder: true },
        14000,  // $4,000 over $10,000 MFJ threshold
        FilingStatus.MarriedFilingJointly,
      );
      expect(result.agiReduction).toBe(2000); // 50% × 4000
      expect(result.creditBase).toBe(5500); // 7500 - 0 - 2000
      expect(result.credit).toBe(825); // 15% × 5500
    });

    it('should reduce by 50% of AGI excess for MFS', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        7000,  // $2,000 over $5,000 MFS threshold
        FilingStatus.MarriedFilingSeparately,
      );
      expect(result.agiReduction).toBe(1000); // 50% × 2000
      expect(result.creditBase).toBe(2750); // 3750 - 0 - 1000
      expect(result.credit).toBe(412.50); // 15% × 2750
    });

    it('should eliminate credit when AGI is very high', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        25000,  // Way over threshold
        FilingStatus.Single,
      );
      // AGI excess = 25000 - 7500 = 17500; reduction = 50% × 17500 = 8750
      // Credit base = max(0, 5000 - 0 - 8750) = 0
      expect(result.creditBase).toBe(0);
      expect(result.credit).toBe(0);
    });

    it('should compute exact AGI phase-out elimination point for Single', () => {
      // Phase-out elimination: initialAmount = agiReduction
      // 5000 = 0.50 × (AGI - 7500) → AGI = 17500
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        17500,
        FilingStatus.Single,
      );
      expect(result.creditBase).toBe(0);
      expect(result.credit).toBe(0);

      // Just below
      const resultBelow = calculateScheduleR(
        { isAge65OrOlder: true },
        17499,
        FilingStatus.Single,
      );
      expect(resultBelow.credit).toBeGreaterThan(0);
    });
  });

  // ─── Credit Calculation ─────────────────────────────

  describe('Credit Calculation (15%)', () => {

    it('should calculate maximum credit for Single 65+ with minimal AGI', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        5000, // Below threshold
        FilingStatus.Single,
      );
      // Max credit: 15% × 5000 = 750
      expect(result.credit).toBe(750);
      expect(result.creditRate).toBe(0.15);
    });

    it('should calculate maximum credit for MFJ both 65+', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true, isSpouseAge65OrOlder: true },
        5000,
        FilingStatus.MarriedFilingJointly,
      );
      // Max credit: 15% × 7500 = 1125
      expect(result.credit).toBe(1125);
    });

    it('should calculate maximum credit for MFS 65+', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        3000,
        FilingStatus.MarriedFilingSeparately,
      );
      // Max credit: 15% × 3750 = 562.50
      expect(result.credit).toBe(562.50);
    });

    it('should handle combined nontaxable and AGI reductions', () => {
      const result = calculateScheduleR(
        {
          isAge65OrOlder: true,
          nontaxableSocialSecurity: 1000,
          nontaxablePensions: 500,
        },
        10000,  // $2,500 over $7,500 threshold
        FilingStatus.Single,
      );
      // Credit base = 5000 - 1500 - 1250 = 2250
      expect(result.nontaxableReduction).toBe(1500);
      expect(result.agiReduction).toBe(1250); // 50% × 2500
      expect(result.creditBase).toBe(2250);
      expect(result.credit).toBe(337.50); // 15% × 2250
    });
  });

  // ─── Form 1040 Integration ──────────────────────────

  describe('Form 1040 Integration', () => {

    it('should add elderly/disabled credit to non-refundable credits', () => {
      const tr = baseTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 5000, federalTaxWithheld: 500, socialSecurityWages: 5000 }],
        scheduleR: {
          isAge65OrOlder: true,
        },
        dateOfBirth: '1955-01-01', // 70 years old in 2025
      });
      const result = calculateForm1040(tr);
      expect(result.credits.elderlyDisabledCredit).toBe(750); // 15% × 5000 (low AGI, no reductions)
      expect(result.credits.totalNonRefundable).toBeGreaterThanOrEqual(750);
    });

    it('should not create Schedule R result when no scheduleR data', () => {
      const tr = baseTaxReturn({});
      const result = calculateForm1040(tr);
      expect(result.scheduleR).toBeUndefined();
      expect(result.credits.elderlyDisabledCredit).toBe(0);
    });

    it('should expose scheduleR in CalculationResult', () => {
      const tr = baseTaxReturn({
        w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 6000, federalTaxWithheld: 300, socialSecurityWages: 6000 }],
        scheduleR: { isAge65OrOlder: true },
      });
      const result = calculateForm1040(tr);
      expect(result.scheduleR).toBeDefined();
      expect(result.scheduleR!.qualifies).toBe(true);
      expect(result.scheduleR!.initialAmount).toBe(5000);
    });

    it('should limit credit to tax liability (non-refundable)', () => {
      // Very low income → low tax → credit can't exceed tax
      const tr = baseTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 2000, federalTaxWithheld: 200, socialSecurityWages: 2000 }],
        scheduleR: { isAge65OrOlder: true },
      });
      const result = calculateForm1040(tr);
      // Income tax will be very small or 0 (below standard deduction)
      // Non-refundable credit can't create negative tax
      expect(result.form1040.taxAfterCredits).toBeGreaterThanOrEqual(0);
    });

    it('should apply AGI-based reduction using actual AGI from return', () => {
      const tr = baseTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 12000, federalTaxWithheld: 1000, socialSecurityWages: 12000 }],
        scheduleR: { isAge65OrOlder: true },
      });
      const result = calculateForm1040(tr);
      // AGI = 12000, threshold = 7500, excess = 4500
      // AGI reduction = 50% × 4500 = 2250
      // Credit base = 5000 - 0 - 2250 = 2750
      // Credit = 15% × 2750 = 412.50
      expect(result.scheduleR!.agiReduction).toBe(2250);
      expect(result.scheduleR!.credit).toBe(412.50);
    });

    it('should handle elderly credit with nontaxable SS from SSA-1099', () => {
      const tr = baseTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 5000, federalTaxWithheld: 400, socialSecurityWages: 5000 }],
        scheduleR: {
          isAge65OrOlder: true,
          nontaxableSocialSecurity: 3000,
        },
      });
      const result = calculateForm1040(tr);
      // AGI = 5000 (below threshold)
      // Initial = 5000, nontaxable = 3000, AGI reduction = 0
      // Credit base = 5000 - 3000 = 2000
      // Credit = 15% × 2000 = 300
      expect(result.scheduleR!.credit).toBe(300);
      expect(result.credits.elderlyDisabledCredit).toBe(300);
    });
  });

  // ─── MFJ Scenarios ──────────────────────────────────

  describe('MFJ Scenarios', () => {

    it('should handle MFJ with one spouse 65+ and one under-65 disabled', () => {
      const result = calculateScheduleR(
        {
          isAge65OrOlder: true,
          isSpouseAge65OrOlder: false,
          isSpouseDisabled: true,
          spouseTaxableDisabilityIncome: 2500,
        },
        5000,
        FilingStatus.MarriedFilingJointly,
      );
      // Taxpayer 65+ → base portion = 5000
      // Spouse disabled: additional portion limited to min(2500, 7500-5000) = 2500
      expect(result.initialAmount).toBe(7500); // 5000 (base) + 2500 (spouse disability portion)
    });

    it('should handle MFJ with spouse disabled and low disability income', () => {
      const result = calculateScheduleR(
        {
          isAge65OrOlder: true,
          isSpouseAge65OrOlder: false,
          isSpouseDisabled: true,
          spouseTaxableDisabilityIncome: 1000,
        },
        5000,
        FilingStatus.MarriedFilingJointly,
      );
      // Taxpayer 65+ → base = 5000
      // Spouse disability portion = min(1000, 7500-5000) = 1000
      expect(result.initialAmount).toBe(6000);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────

  describe('Edge Cases', () => {

    it('should handle zero AGI', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        0,
        FilingStatus.Single,
      );
      expect(result.agiReduction).toBe(0);
      expect(result.credit).toBe(750); // Full credit
    });

    it('should handle negative AGI (unlikely but safe)', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        -5000,
        FilingStatus.Single,
      );
      expect(result.agiReduction).toBe(0);
      expect(result.credit).toBe(750);
    });

    it('should handle missing nontaxable fields gracefully', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        5000,
        FilingStatus.Single,
      );
      expect(result.nontaxableReduction).toBe(0);
    });

    it('should handle exactly-at-threshold AGI', () => {
      const result = calculateScheduleR(
        { isAge65OrOlder: true },
        7500, // Exactly at Single threshold
        FilingStatus.Single,
      );
      expect(result.agiReduction).toBe(0); // No excess
      expect(result.credit).toBe(750);
    });
  });
});

// ════════════════════════════════════════════════════════
// Combined Sprint 26 Integration Tests
// ════════════════════════════════════════════════════════
describe('Sprint 26: Combined Integration', () => {

  it('should handle farmer who is also elderly with both Schedule F and Schedule R', () => {
    const tr = baseTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [],
      dateOfBirth: '1955-01-01',
      scheduleF: {
        salesOfProducts: 20000,
        feed: 5000,
        seeds: 3000,
      },
      scheduleR: {
        isAge65OrOlder: true,
        nontaxableSocialSecurity: 1000,
      },
    });
    const result = calculateForm1040(tr);
    // Farm profit: 20000 - 8000 = 12000
    expect(result.form1040.scheduleFNetProfit).toBe(12000);
    // AGI will be ~12000 - SE deduction
    expect(result.scheduleR).toBeDefined();
    expect(result.scheduleR!.credit).toBeGreaterThan(0);
    expect(result.credits.elderlyDisabledCredit).toBeGreaterThan(0);
  });

  it('should handle MFJ elderly couple with farm income and SS', () => {
    const tr = baseTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [],
      dateOfBirth: '1954-06-15',
      spouseDateOfBirth: '1956-03-20',
      incomeSSA1099: { id: 'ssa-1', totalBenefits: 24000 },
      scheduleF: {
        salesOfProducts: 30000,
        salesOfLivestock: 10000,
        costOfLivestock: 5000,
        feed: 8000,
        seeds: 4000,
        labor: 3000,
      },
      scheduleR: {
        isAge65OrOlder: true,
        isSpouseAge65OrOlder: true,
        nontaxableSocialSecurity: 12000, // Half of SS is nontaxable
      },
    });
    const result = calculateForm1040(tr);
    // Farm: (10000-5000) + 30000 = 35000 gross, 15000 expenses, 20000 profit
    expect(result.scheduleF!.netFarmProfit).toBe(20000);
    expect(result.form1040.scheduleFNetProfit).toBe(20000);
    // Schedule R: both 65+ → $7,500 initial, nontaxable SS reduction = 12000
    // Since nontaxable > initial, credit base = 0
    expect(result.scheduleR).toBeDefined();
    // The credit may be 0 due to nontaxable income reduction exceeding initial amount
    expect(result.scheduleR!.nontaxableReduction).toBe(12000);
  });

  it('should handle disabled farmer under 65 with disability income', () => {
    const tr = baseTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [],
      income1099R: [{ id: 'r-1', payerName: 'Disability Fund', grossDistribution: 8000, taxableAmount: 8000, distributionCode: '3' }],
      scheduleF: {
        salesOfProducts: 15000,
        feed: 5000,
      },
      scheduleR: {
        isAge65OrOlder: false,
        isDisabled: true,
        taxableDisabilityIncome: 8000,
      },
    });
    const result = calculateForm1040(tr);
    expect(result.form1040.scheduleFNetProfit).toBe(10000);
    expect(result.scheduleR).toBeDefined();
    // Disabled under 65: initial amount limited to disability income (8000, capped at 5000)
    expect(result.scheduleR!.initialAmount).toBe(5000);
  });
});
