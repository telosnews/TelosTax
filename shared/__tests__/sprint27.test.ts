/**
 * Sprint 27: Form 5695 Improvements (Part I Carryforward) + Deceased Spouse Handling
 *
 * 27A: Form 5695 Part I — carryforward tracking + tax limitation (~15 tests)
 *   - Prior year carryforward added to current year credit
 *   - Non-refundable: capped by tax liability
 *   - Excess carries forward to next year
 *
 * 27B: Deceased Spouse — MFJ year of death, QSS validation (~25 tests)
 *   - IRC §6013(a)(2): MFJ for year of death
 *   - IRC §2(a): QSS for 2 years after death
 *   - Validation of filing status consistency
 */
import { describe, it, expect } from 'vitest';
import { calculateCleanEnergyCredit } from '../src/engine/cleanEnergy.js';
import { validateDeceasedSpouse } from '../src/engine/deceasedSpouse.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { FilingStatus, TaxReturn, CleanEnergyInfo } from '../src/types/index.js';

// ─── Helpers ──────────────────────────────────────
function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint27',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 1,
    currentSection: 'test',
    filingStatus: FilingStatus.Single,
    w2Income: [],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    income1099SA: [],
    incomeW2G: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    incomeK1: [],
    dependents: [],
    businesses: [],
    expenses: [],
    rentalProperties: [],
    otherIncome: 0,
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════
// 27A: Form 5695 Part I — Carryforward + Tax Limitation
// ═══════════════════════════════════════════════════

describe('Sprint 27A — Form 5695 Part I Carryforward', () => {
  describe('Unit: calculateCleanEnergyCredit', () => {
    it('returns zero result for empty info', () => {
      const result = calculateCleanEnergyCredit({} as CleanEnergyInfo);
      expect(result.totalExpenditures).toBe(0);
      expect(result.currentYearCredit).toBe(0);
      expect(result.priorYearCarryforward).toBe(0);
      expect(result.totalAvailableCredit).toBe(0);
      expect(result.credit).toBe(0);
      expect(result.carryforwardToNextYear).toBe(0);
    });

    it('calculates current year credit at 30%', () => {
      const result = calculateCleanEnergyCredit({ solarElectric: 20000 });
      expect(result.totalExpenditures).toBe(20000);
      expect(result.currentYearCredit).toBe(6000);
      expect(result.priorYearCarryforward).toBe(0);
      expect(result.totalAvailableCredit).toBe(6000);
      expect(result.credit).toBe(6000);
    });

    it('adds prior year carryforward to current year credit', () => {
      const result = calculateCleanEnergyCredit({
        solarElectric: 10000,
        priorYearCarryforward: 2000,
      });
      expect(result.currentYearCredit).toBe(3000); // 30% of $10k
      expect(result.priorYearCarryforward).toBe(2000);
      expect(result.totalAvailableCredit).toBe(5000); // 3000 + 2000
    });

    it('handles carryforward with no current year expenditures', () => {
      const result = calculateCleanEnergyCredit({
        priorYearCarryforward: 1500,
      });
      expect(result.totalExpenditures).toBe(0);
      expect(result.currentYearCredit).toBe(0);
      expect(result.priorYearCarryforward).toBe(1500);
      expect(result.totalAvailableCredit).toBe(1500);
      expect(result.credit).toBe(1500);
    });

    it('ignores negative carryforward', () => {
      const result = calculateCleanEnergyCredit({
        solarElectric: 5000,
        priorYearCarryforward: -500,
      });
      expect(result.priorYearCarryforward).toBe(0);
      expect(result.totalAvailableCredit).toBe(1500); // 30% of $5k only
    });

    it('applies fuel cell cap with carryforward', () => {
      const result = calculateCleanEnergyCredit({
        fuelCell: 5000,
        fuelCellKW: 2, // 4 half-kW × $500 = $2000 cap
        priorYearCarryforward: 1000,
      });
      expect(result.totalExpenditures).toBe(2000); // Capped
      expect(result.currentYearCredit).toBe(600); // 30% of $2000
      expect(result.totalAvailableCredit).toBe(1600); // 600 + 1000
    });
  });

  describe('Integration: Form 1040 carryforward tracking', () => {
    it('uses full credit when tax liability is sufficient', () => {
      const tr = makeTaxReturn({
        w2Income: [{ id: '1', employerName: 'Acme', wages: 100000, federalTaxWithheld: 15000 }],
        cleanEnergy: { solarElectric: 20000 },
      });
      const result = calculateForm1040(tr);
      expect(result.cleanEnergy!.totalAvailableCredit).toBe(6000);
      expect(result.credits.cleanEnergyCredit).toBe(6000);
      expect(result.cleanEnergy!.carryforwardToNextYear).toBe(0);
    });

    it('carries forward excess credit when tax liability is insufficient', () => {
      const tr = makeTaxReturn({
        w2Income: [{ id: '1', employerName: 'Acme', wages: 18000, federalTaxWithheld: 1000 }],
        cleanEnergy: { solarElectric: 100000 }, // $30k credit
      });
      const result = calculateForm1040(tr);
      // $18k wages - $15k std deduction = $3k taxable → ~$300 tax
      // All $300 of income tax consumed by clean energy credit
      // $30k - $300 = $29,700 carries forward
      expect(result.cleanEnergy!.totalAvailableCredit).toBe(30000);
      const usedCredit = result.credits.cleanEnergyCredit;
      const carryforward = result.cleanEnergy!.carryforwardToNextYear;
      expect(usedCredit + carryforward).toBe(30000);
      expect(carryforward).toBeGreaterThan(0);
      expect(result.form1040.taxAfterCredits).toBeGreaterThanOrEqual(0);
    });

    it('carries forward with prior year carryforward', () => {
      const tr = makeTaxReturn({
        w2Income: [{ id: '1', employerName: 'Acme', wages: 20000, federalTaxWithheld: 1000 }],
        cleanEnergy: { solarElectric: 5000, priorYearCarryforward: 2000 },
      });
      const result = calculateForm1040(tr);
      // $20k wages - $15k deduction = $5k taxable → ~$500 tax
      // Clean energy: $1500 (current) + $2000 (carry) = $3500 available
      // Only ~$500 can be used → $3000 carries forward
      expect(result.cleanEnergy!.totalAvailableCredit).toBe(3500);
      expect(result.cleanEnergy!.carryforwardToNextYear).toBeGreaterThan(0);
      const used = result.credits.cleanEnergyCredit;
      expect(used).toBeLessThan(3500);
      expect(used + result.cleanEnergy!.carryforwardToNextYear).toBe(3500);
    });

    it('no carryforward when no clean energy credit', () => {
      const tr = makeTaxReturn({
        w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      });
      const result = calculateForm1040(tr);
      expect(result.cleanEnergy).toBeUndefined();
    });

    it('zero tax produces full carryforward', () => {
      // No wages = no income tax → full credit carries forward
      const tr = makeTaxReturn({
        cleanEnergy: { solarElectric: 10000 },
      });
      const result = calculateForm1040(tr);
      expect(result.cleanEnergy!.totalAvailableCredit).toBe(3000);
      expect(result.credits.cleanEnergyCredit).toBe(0);
      expect(result.cleanEnergy!.carryforwardToNextYear).toBe(3000);
    });

    it('other non-refundable credits reduce available tax for clean energy', () => {
      // Dependent care + saver's credit consume most of the low tax liability
      const tr = makeTaxReturn({
        w2Income: [{ id: '1', employerName: 'Acme', wages: 22000, federalTaxWithheld: 500 }],
        dependentCare: { totalExpenses: 3000, qualifyingPersons: 1 },
        saversCredit: { totalContributions: 2000 },
        cleanEnergy: { solarElectric: 10000 },
      });
      const result = calculateForm1040(tr);
      // $22k - $15k = $7k taxable → ~$700 tax
      // Dependent care + saver's credit may consume all $700
      // Clean energy credit gets limited and excess carries forward
      expect(result.cleanEnergy!.totalAvailableCredit).toBe(3000);
      expect(result.cleanEnergy!.carryforwardToNextYear).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════
// 27B: Deceased Spouse — Validation
// ═══════════════════════════════════════════════════

describe('Sprint 27B — Deceased Spouse Handling', () => {
  describe('Unit: validateDeceasedSpouse', () => {
    it('returns valid result when no deceased spouse info', () => {
      const tr = makeTaxReturn({ filingStatus: FilingStatus.Single });
      const result = validateDeceasedSpouse(tr);
      expect(result.isValid).toBe(true);
      expect(result.spouseDiedDuringTaxYear).toBe(false);
      expect(result.qualifiesForMFJ).toBe(false);
      expect(result.qualifiesForQSS).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error for invalid date format', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        spouseDateOfDeath: 'not-a-date',
      });
      const result = validateDeceasedSpouse(tr);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Invalid'));
    });

    // ─── Year of death: MFJ allowed ─────────────────
    describe('Year of death — MFJ', () => {
      it('allows MFJ for the year spouse died', () => {
        const tr = makeTaxReturn({
          filingStatus: FilingStatus.MarriedFilingJointly,
          spouseDateOfBirth: '1960-01-15',
          spouseDateOfDeath: '2025-06-15',
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.isValid).toBe(true);
        expect(result.spouseDiedDuringTaxYear).toBe(true);
        expect(result.qualifiesForMFJ).toBe(true);
      });

      it('allows MFS for the year of death', () => {
        const tr = makeTaxReturn({
          filingStatus: FilingStatus.MarriedFilingSeparately,
          spouseDateOfDeath: '2025-03-10',
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.isValid).toBe(true);
        expect(result.spouseDiedDuringTaxYear).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it('rejects QSS for the year of death', () => {
        const tr = makeTaxReturn({
          filingStatus: FilingStatus.QualifyingSurvivingSpouse,
          spouseDateOfDeath: '2025-09-01',
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining('not available for the year of death'));
      });

      it('MFJ year of death: full standard deduction', () => {
        const tr = makeTaxReturn({
          filingStatus: FilingStatus.MarriedFilingJointly,
          spouseDateOfDeath: '2025-06-15',
          w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
        });
        const result = calculateForm1040(tr);
        // Full MFJ standard deduction ($31,500) should apply
        // (no age 65+ for either spouse in this test)
        expect(result.form1040.standardDeduction).toBe(31500);
        expect(result.form1040.deductionUsed).toBe('standard');
      });

      it('MFJ year of death: spouse died Jan 1', () => {
        const tr = makeTaxReturn({
          filingStatus: FilingStatus.MarriedFilingJointly,
          spouseDateOfDeath: '2025-01-01',
          w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 6000 }],
        });
        const result = calculateForm1040(tr);
        expect(result.deceasedSpouseValidation).toBeDefined();
        expect(result.deceasedSpouseValidation!.isValid).toBe(true);
        expect(result.deceasedSpouseValidation!.qualifiesForMFJ).toBe(true);
      });

      it('MFJ year of death: spouse died Dec 31', () => {
        const tr = makeTaxReturn({
          filingStatus: FilingStatus.MarriedFilingJointly,
          spouseDateOfDeath: '2025-12-31',
          w2Income: [{ id: '1', employerName: 'Acme', wages: 70000, federalTaxWithheld: 8000 }],
        });
        const result = calculateForm1040(tr);
        expect(result.deceasedSpouseValidation!.isValid).toBe(true);
        expect(result.deceasedSpouseValidation!.spouseDiedDuringTaxYear).toBe(true);
      });
    });

    // ─── 1 year after death: QSS validation ─────────
    describe('1 year after death — QSS', () => {
      it('allows QSS 1 year after death with qualifying child', () => {
        const tr = makeTaxReturn({
          taxYear: 2025,
          filingStatus: FilingStatus.QualifyingSurvivingSpouse,
          spouseDateOfDeath: '2024-06-15',
          dependents: [{
            id: 'd1', firstName: 'Child', lastName: 'Doe', relationship: 'son',
            dateOfBirth: '2015-03-01', monthsLivedWithYou: 12,
          }],
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.isValid).toBe(true);
        expect(result.qualifiesForQSS).toBe(true);
      });

      it('rejects QSS 1 year after death without qualifying child', () => {
        const tr = makeTaxReturn({
          taxYear: 2025,
          filingStatus: FilingStatus.QualifyingSurvivingSpouse,
          spouseDateOfDeath: '2024-03-10',
          dependents: [],
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining('qualifying dependent child'));
      });

      it('rejects QSS when child lived less than half the year', () => {
        const tr = makeTaxReturn({
          taxYear: 2025,
          filingStatus: FilingStatus.QualifyingSurvivingSpouse,
          spouseDateOfDeath: '2024-11-01',
          dependents: [{
            id: 'd1', firstName: 'Child', lastName: 'Doe', relationship: 'son',
            dateOfBirth: '2015-03-01', monthsLivedWithYou: 5, // Less than half
          }],
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.isValid).toBe(false);
      });

      it('rejects MFJ 1 year after death', () => {
        const tr = makeTaxReturn({
          taxYear: 2025,
          filingStatus: FilingStatus.MarriedFilingJointly,
          spouseDateOfDeath: '2024-06-15',
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining('not available'));
      });
    });

    // ─── 2 years after death: QSS still valid ───────
    describe('2 years after death — QSS', () => {
      it('allows QSS 2 years after death with qualifying child', () => {
        const tr = makeTaxReturn({
          taxYear: 2025,
          filingStatus: FilingStatus.QualifyingSurvivingSpouse,
          spouseDateOfDeath: '2023-08-20',
          dependents: [{
            id: 'd1', firstName: 'Child', lastName: 'Doe', relationship: 'daughter',
            dateOfBirth: '2014-07-10', monthsLivedWithYou: 12,
          }],
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.isValid).toBe(true);
        expect(result.qualifiesForQSS).toBe(true);
      });

      it('QSS provides MFJ brackets and deduction', () => {
        const tr = makeTaxReturn({
          taxYear: 2025,
          filingStatus: FilingStatus.QualifyingSurvivingSpouse,
          spouseDateOfDeath: '2023-08-20',
          dependents: [{
            id: 'd1', firstName: 'Child', lastName: 'Doe', relationship: 'daughter',
            dateOfBirth: '2014-07-10', monthsLivedWithYou: 12,
          }],
          w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
        });
        const result = calculateForm1040(tr);
        // QSS gets the same standard deduction as MFJ ($31,500)
        expect(result.form1040.standardDeduction).toBe(31500);
      });
    });

    // ─── 3+ years after death: QSS expired ──────────
    describe('3+ years after death — QSS expired', () => {
      it('rejects QSS 3 years after death', () => {
        const tr = makeTaxReturn({
          taxYear: 2025,
          filingStatus: FilingStatus.QualifyingSurvivingSpouse,
          spouseDateOfDeath: '2022-05-01',
          dependents: [{
            id: 'd1', firstName: 'Child', lastName: 'Doe', relationship: 'son',
            dateOfBirth: '2015-03-01', monthsLivedWithYou: 12,
          }],
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining('only available for 2 tax years'));
      });

      it('rejects MFJ 3+ years after death', () => {
        const tr = makeTaxReturn({
          taxYear: 2025,
          filingStatus: FilingStatus.MarriedFilingJointly,
          spouseDateOfDeath: '2020-01-01',
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining('not available'));
      });

      it('Single filing 3+ years after death is valid', () => {
        const tr = makeTaxReturn({
          taxYear: 2025,
          filingStatus: FilingStatus.Single,
          spouseDateOfDeath: '2022-01-01',
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.isValid).toBe(true);
      });

      it('HoH filing 3+ years after death is valid', () => {
        const tr = makeTaxReturn({
          taxYear: 2025,
          filingStatus: FilingStatus.HeadOfHousehold,
          spouseDateOfDeath: '2021-07-15',
          dependents: [{
            id: 'd1', firstName: 'Child', lastName: 'Doe', relationship: 'son',
            dateOfBirth: '2015-03-01', monthsLivedWithYou: 12,
          }],
          paidOverHalfHouseholdCost: true,
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.isValid).toBe(true);
      });
    });

    // ─── Edge cases ──────────────────────────────────
    describe('Edge cases', () => {
      it('spouse died before tax year (in prior year, 1 year gap)', () => {
        const tr = makeTaxReturn({
          taxYear: 2025,
          filingStatus: FilingStatus.Single,
          spouseDateOfDeath: '2024-12-31',
        });
        const result = validateDeceasedSpouse(tr);
        // Single is fine 1 year after death
        expect(result.isValid).toBe(true);
      });

      it('MFS after year of death generates warning', () => {
        const tr = makeTaxReturn({
          taxYear: 2025,
          filingStatus: FilingStatus.MarriedFilingSeparately,
          spouseDateOfDeath: '2024-06-15',
        });
        const result = validateDeceasedSpouse(tr);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('MFS');
      });

      it('no validation when spouseDateOfDeath is undefined', () => {
        const tr = makeTaxReturn({
          filingStatus: FilingStatus.MarriedFilingJointly,
        });
        const result = calculateForm1040(tr);
        expect(result.deceasedSpouseValidation).toBeUndefined();
      });
    });
  });

  // ─── Integration: Form 1040 wiring ───────────────
  describe('Integration: Form 1040', () => {
    it('exposes deceased spouse validation in CalculationResult', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        spouseDateOfDeath: '2025-06-15',
        w2Income: [{ id: '1', employerName: 'Acme', wages: 75000, federalTaxWithheld: 9000 }],
      });
      const result = calculateForm1040(tr);
      expect(result.deceasedSpouseValidation).toBeDefined();
      expect(result.deceasedSpouseValidation!.spouseDiedDuringTaxYear).toBe(true);
      expect(result.deceasedSpouseValidation!.qualifiesForMFJ).toBe(true);
    });

    it('includes both spouse incomes for year of death MFJ', () => {
      // Both spouses' W-2s are included (the return reports all income for the year)
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        spouseDateOfDeath: '2025-03-15',
        w2Income: [
          { id: '1', employerName: 'Employer A', wages: 50000, federalTaxWithheld: 6000 },
          { id: '2', employerName: 'Employer B', wages: 30000, federalTaxWithheld: 3500 },
        ],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.totalWages).toBe(80000);
      expect(result.form1040.standardDeduction).toBe(31500); // Full MFJ deduction
    });

    it('QSS filer gets MFJ standard deduction and brackets', () => {
      const tr = makeTaxReturn({
        taxYear: 2025,
        filingStatus: FilingStatus.QualifyingSurvivingSpouse,
        spouseDateOfDeath: '2024-04-20',
        dependents: [{
          id: 'd1', firstName: 'Child', lastName: 'Doe', relationship: 'daughter',
          dateOfBirth: '2016-01-01', monthsLivedWithYou: 12,
        }],
        w2Income: [{ id: '1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 7000 }],
      });
      const result = calculateForm1040(tr);
      // QSS uses same brackets and deductions as MFJ
      expect(result.form1040.standardDeduction).toBe(31500);
      expect(result.deceasedSpouseValidation!.qualifiesForQSS).toBe(true);
    });

    it('deceased spouse with age 65+ gets additional standard deduction for MFJ year of death', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        dateOfBirth: '1955-03-15', // Taxpayer 70, qualifies for 65+ additional
        spouseDateOfBirth: '1958-06-01', // Spouse 67, qualifies for 65+ additional
        spouseDateOfDeath: '2025-09-01',
        w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      });
      const result = calculateForm1040(tr);
      // MFJ base ($31,500) + 2 × $1,600 (married additional for 65+) = $34,700
      // OBBBA §11021 — MFJ standard deduction increased from $30,000 to $31,500
      expect(result.form1040.standardDeduction).toBe(34700);
    });
  });
});

// ═══════════════════════════════════════════════════
// Combined Integration Tests
// ═══════════════════════════════════════════════════

describe('Sprint 27 — Combined Integration', () => {
  it('elderly surviving spouse with clean energy carryforward', () => {
    // QSS filer, 1 year after death, with clean energy credit from prior year
    const tr = makeTaxReturn({
      taxYear: 2025,
      filingStatus: FilingStatus.QualifyingSurvivingSpouse,
      dateOfBirth: '1957-05-01', // 68 years old
      spouseDateOfDeath: '2024-02-15',
      dependents: [{
        id: 'd1', firstName: 'Child', lastName: 'Doe', relationship: 'son',
        dateOfBirth: '2015-03-01', monthsLivedWithYou: 12,
      }],
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 8000 }],
      cleanEnergy: {
        solarElectric: 5000,
        priorYearCarryforward: 2000,
      },
    });
    const result = calculateForm1040(tr);

    // QSS validated
    expect(result.deceasedSpouseValidation).toBeDefined();
    expect(result.deceasedSpouseValidation!.qualifiesForQSS).toBe(true);

    // Clean energy credit with carryforward
    expect(result.cleanEnergy).toBeDefined();
    expect(result.cleanEnergy!.totalAvailableCredit).toBe(3500); // 1500 + 2000
    // With $80k wages, sufficient tax liability to use the credit
    expect(result.credits.cleanEnergyCredit).toBeGreaterThan(0);
  });

  it('MFJ year of death with all income and clean energy', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      spouseDateOfDeath: '2025-07-10',
      w2Income: [
        { id: '1', employerName: 'Corp A', wages: 60000, federalTaxWithheld: 7000 },
        { id: '2', employerName: 'Corp B', wages: 40000, federalTaxWithheld: 5000 },
      ],
      cleanEnergy: { geothermalHeatPump: 15000 },
    });
    const result = calculateForm1040(tr);

    // Full MFJ treatment
    expect(result.form1040.totalWages).toBe(100000);
    expect(result.form1040.standardDeduction).toBe(31500);

    // Clean energy credit: 30% of $15k = $4500
    expect(result.cleanEnergy!.totalAvailableCredit).toBe(4500);
    expect(result.credits.cleanEnergyCredit).toBe(4500);
    expect(result.cleanEnergy!.carryforwardToNextYear).toBe(0);
  });

  it('QSS ineligible → no QSS validation error when filing Single', () => {
    const tr = makeTaxReturn({
      taxYear: 2025,
      filingStatus: FilingStatus.Single,
      spouseDateOfDeath: '2023-06-15',
      w2Income: [{ id: '1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const result = calculateForm1040(tr);
    // Single is valid even though QSS window is open
    expect(result.deceasedSpouseValidation!.isValid).toBe(true);
  });
});
