import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateDependentCareCredit } from '../src/engine/dependentCare.js';
import { calculateSaversCredit } from '../src/engine/saversCredit.js';
import { calculateCleanEnergyCredit } from '../src/engine/cleanEnergy.js';
import { TaxReturn, FilingStatus, CleanEnergyInfo } from '../src/types/index.js';

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
// Sprint 4A: Child and Dependent Care Credit (Form 2441)
// ═══════════════════════════════════════════════════

describe('Sprint 4A — Dependent Care Credit', () => {
  describe('calculateDependentCareCredit (unit)', () => {
    it('calculates credit at 35% for lowest AGI (≤ $15,000)', () => {
      const result = calculateDependentCareCredit(5000, 1, 10000, FilingStatus.Single, 10000);
      // 1 qualifying person → limit $3,000
      // $5,000 expenses capped to $3,000
      // AGI $10,000 ≤ $15,000 → rate 35%
      // Credit = $3,000 * 0.35 = $1,050
      expect(result.qualifyingExpenses).toBe(3000);
      expect(result.creditRate).toBe(0.35);
      expect(result.credit).toBe(1050);
    });

    it('calculates credit at 20% for AGI above $43,000', () => {
      const result = calculateDependentCareCredit(10000, 2, 50000, FilingStatus.Single, 50000);
      // 2+ qualifying persons → limit $6,000
      // $10,000 expenses capped to $6,000
      // AGI $50,000 > $43,000 → rate 20% (floor)
      // Credit = $6,000 * 0.20 = $1,200
      expect(result.qualifyingExpenses).toBe(6000);
      expect(result.creditRate).toBe(0.20);
      expect(result.credit).toBe(1200);
    });

    it('applies intermediate rate correctly', () => {
      // AGI = $25,000 → over $15k by $10,000
      // $10,000 / $2,000 = 5 steps
      // Rate = 35% - 5% = 30%
      const result = calculateDependentCareCredit(4000, 1, 25000, FilingStatus.Single, 25000);
      expect(result.qualifyingExpenses).toBe(3000); // capped at $3k
      expect(result.creditRate).toBe(0.30);
      expect(result.credit).toBe(900);
    });

    it('returns zero for MFS filers', () => {
      const result = calculateDependentCareCredit(5000, 2, 30000, FilingStatus.MarriedFilingSeparately, 30000);
      expect(result.credit).toBe(0);
    });

    it('returns zero when no qualifying persons', () => {
      const result = calculateDependentCareCredit(5000, 0, 30000, FilingStatus.Single, 30000);
      expect(result.credit).toBe(0);
    });

    it('returns zero when no expenses', () => {
      const result = calculateDependentCareCredit(0, 2, 30000, FilingStatus.Single, 30000);
      expect(result.credit).toBe(0);
    });

    it('limits expenses to earned income for MFJ', () => {
      // MFJ with low spouse income — expenses limited to lower earner
      const result = calculateDependentCareCredit(5000, 1, 30000, FilingStatus.MarriedFilingJointly, 2000, 2000);
      // Qualifying expenses = min(5000, 3000, 2000) = $2,000 (limited by earned income)
      expect(result.qualifyingExpenses).toBe(2000);
      expect(result.credit).toBeGreaterThan(0);
    });
  });

  describe('Dependent Care Credit integration (form1040)', () => {
    it('applies dependent care credit as non-refundable', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: '1', employerName: 'Acme', wages: 45000, federalTaxWithheld: 5000 }],
        dependentCare: { totalExpenses: 5000, qualifyingPersons: 1 },
      });
      const result = calculateForm1040(tr);
      // Credit should be non-refundable, reducing tax
      expect(result.credits.dependentCareCredit).toBeGreaterThan(0);
      expect(result.credits.totalNonRefundable).toBeGreaterThanOrEqual(result.credits.dependentCareCredit);
      expect(result.dependentCare).toBeDefined();
    });

    it('does not apply credit when dependentCare is undefined', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: '1', employerName: 'Acme', wages: 45000, federalTaxWithheld: 5000 }],
      });
      const result = calculateForm1040(tr);
      expect(result.credits.dependentCareCredit).toBe(0);
      expect(result.dependentCare).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════
// Sprint 4B: Saver's Credit (Form 8880)
// ═══════════════════════════════════════════════════

describe('Sprint 4B — Saver\'s Credit', () => {
  describe('calculateSaversCredit (unit)', () => {
    it('gives 50% rate for Single filer with AGI ≤ $23,750', () => {
      const result = calculateSaversCredit(2000, 20000, FilingStatus.Single);
      // Contributions capped at $2,000
      // AGI $20,000 ≤ $23,750 → 50% rate
      // Credit = $2,000 * 0.50 = $1,000
      expect(result.eligibleContributions).toBe(2000);
      expect(result.creditRate).toBe(0.50);
      expect(result.credit).toBe(1000);
    });

    it('gives 20% rate for Single filer with AGI between $23,750 and $25,750', () => {
      const result = calculateSaversCredit(2000, 25000, FilingStatus.Single);
      expect(result.creditRate).toBe(0.20);
      expect(result.credit).toBe(400);
    });

    it('gives 10% rate for Single filer with AGI between $25,750 and $36,500', () => {
      const result = calculateSaversCredit(2000, 30000, FilingStatus.Single);
      expect(result.creditRate).toBe(0.10);
      expect(result.credit).toBe(200);
    });

    it('gives 0% rate for Single filer with AGI above $36,500', () => {
      const result = calculateSaversCredit(2000, 40000, FilingStatus.Single);
      expect(result.creditRate).toBe(0);
      expect(result.credit).toBe(0);
    });

    it('uses MFJ thresholds and $4,000 cap', () => {
      const result = calculateSaversCredit(5000, 45000, FilingStatus.MarriedFilingJointly);
      // MFJ: $4,000 cap, AGI $45,000 ≤ $47,500 → 50%
      expect(result.eligibleContributions).toBe(4000);
      expect(result.creditRate).toBe(0.50);
      expect(result.credit).toBe(2000);
    });

    it('uses HoH thresholds', () => {
      const result = calculateSaversCredit(2000, 36000, FilingStatus.HeadOfHousehold);
      // HoH: AGI $36,000 ≤ $35,625? No → $36,000 ≤ $38,625 → 20%
      expect(result.creditRate).toBe(0.20);
      expect(result.credit).toBe(400);
    });

    it('returns zero for no contributions', () => {
      const result = calculateSaversCredit(0, 20000, FilingStatus.Single);
      expect(result.credit).toBe(0);
    });

    it('caps contributions at $2,000 for non-MFJ', () => {
      const result = calculateSaversCredit(5000, 20000, FilingStatus.Single);
      expect(result.eligibleContributions).toBe(2000);
    });
  });

  describe('Saver\'s Credit integration (form1040)', () => {
    it('applies saver\'s credit as non-refundable', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: '1', employerName: 'Acme', wages: 22000, federalTaxWithheld: 2000 }],
        saversCredit: { totalContributions: 2000 },
      });
      const result = calculateForm1040(tr);
      // AGI ~$22,000, Single → 50% rate → $1,000 credit
      expect(result.credits.saversCredit).toBeGreaterThan(0);
      expect(result.saversCreditResult).toBeDefined();
      expect(result.saversCreditResult!.creditRate).toBe(0.50);
    });

    it('does not apply credit when AGI too high', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
        saversCredit: { totalContributions: 2000 },
      });
      const result = calculateForm1040(tr);
      // AGI ~$80,000 > $36,500 → 0% rate
      expect(result.credits.saversCredit).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════
// Sprint 4C: Residential Clean Energy Credit (Form 5695)
// ═══════════════════════════════════════════════════

describe('Sprint 4C — Clean Energy Credit', () => {
  describe('calculateCleanEnergyCredit (unit)', () => {
    it('calculates 30% credit on solar electric', () => {
      const result = calculateCleanEnergyCredit({ solarElectric: 20000 });
      expect(result.totalExpenditures).toBe(20000);
      expect(result.credit).toBe(6000);
    });

    it('calculates 30% credit on combined expenditures', () => {
      const info: CleanEnergyInfo = {
        solarElectric: 15000,
        solarWaterHeating: 3000,
        smallWindEnergy: 5000,
        geothermalHeatPump: 10000,
        batteryStorage: 8000,
      };
      const result = calculateCleanEnergyCredit(info);
      expect(result.totalExpenditures).toBe(41000);
      expect(result.credit).toBe(12300);
    });

    it('caps fuel cell credit at $500/0.5kW', () => {
      const info: CleanEnergyInfo = {
        fuelCell: 50000,   // $50,000 spent
        fuelCellKW: 5,     // 5 kW capacity
        // Cap = (5 / 0.5) * $500 = 10 * $500 = $5,000
      };
      const result = calculateCleanEnergyCredit(info);
      expect(result.totalExpenditures).toBe(5000); // capped
      expect(result.credit).toBe(1500); // 30% of $5,000
    });

    it('returns zero for no expenditures', () => {
      const result = calculateCleanEnergyCredit({});
      expect(result.credit).toBe(0);
    });

    it('returns zero for null info', () => {
      const result = calculateCleanEnergyCredit(null as any);
      expect(result.credit).toBe(0);
    });

    it('ignores negative values', () => {
      const result = calculateCleanEnergyCredit({ solarElectric: -5000 });
      expect(result.totalExpenditures).toBe(0);
      expect(result.credit).toBe(0);
    });

    it('handles fuel cell with no kW (no cap)', () => {
      const result = calculateCleanEnergyCredit({ fuelCell: 10000 });
      // No fuelCellKW specified → no cap applied
      expect(result.totalExpenditures).toBe(10000);
      expect(result.credit).toBe(3000);
    });
  });

  describe('Clean Energy Credit integration (form1040)', () => {
    it('applies clean energy credit as non-refundable', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
        cleanEnergy: { solarElectric: 25000 },
      });
      const result = calculateForm1040(tr);
      // Credit = $25,000 * 0.30 = $7,500
      expect(result.credits.cleanEnergyCredit).toBe(7500);
      expect(result.credits.totalNonRefundable).toBeGreaterThanOrEqual(7500);
      expect(result.cleanEnergy).toBeDefined();
      expect(result.cleanEnergy!.credit).toBe(7500);
    });

    it('does not apply credit when cleanEnergy is undefined', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
      });
      const result = calculateForm1040(tr);
      expect(result.credits.cleanEnergyCredit).toBe(0);
      expect(result.cleanEnergy).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════
// Combined Integration Tests
// ═══════════════════════════════════════════════════

describe('Sprint 4 — Combined Integration', () => {
  it('applies all three Sprint 4 credits together', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 12000 }],
      dependentCare: { totalExpenses: 4000, qualifyingPersons: 1 },
      saversCredit: { totalContributions: 2000 },
      cleanEnergy: { solarElectric: 10000 },
    });
    const result = calculateForm1040(tr);

    // All three credits should be present
    expect(result.credits.dependentCareCredit).toBeGreaterThan(0);
    // Saver's credit phases out above $36,500 for Single — may be $0
    // Clean energy credit: 30% of $10k = $3000 (total available)
    expect(result.cleanEnergy!.totalAvailableCredit).toBe(3000); // 30% of $10k
    // With sufficient income tax, the full clean energy credit should be used
    expect(result.credits.cleanEnergyCredit).toBe(3000);

    // Total non-refundable includes all three
    expect(result.credits.totalNonRefundable).toBeGreaterThanOrEqual(
      result.credits.dependentCareCredit + result.credits.saversCredit + result.credits.cleanEnergyCredit
    );

    // All three result objects should be present
    expect(result.dependentCare).toBeDefined();
    expect(result.saversCreditResult).toBeDefined();
    expect(result.cleanEnergy).toBeDefined();

    // No carryforward when tax liability is sufficient
    expect(result.cleanEnergy!.carryforwardToNextYear).toBe(0);
  });

  it('non-refundable credits cannot reduce income tax below $0', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 18000, federalTaxWithheld: 1000 }],
      cleanEnergy: { solarElectric: 100000 },  // $30k credit against low tax
    });
    const result = calculateForm1040(tr);

    // Tax after credits should be ≥ 0 (non-refundable credits can't go negative)
    expect(result.form1040.taxAfterCredits).toBeGreaterThanOrEqual(0);
  });

  it('has no Sprint 4 credits when none are specified', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: '1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 7000 }],
    });
    const result = calculateForm1040(tr);
    expect(result.credits.dependentCareCredit).toBe(0);
    expect(result.credits.saversCredit).toBe(0);
    expect(result.credits.cleanEnergyCredit).toBe(0);
    expect(result.dependentCare).toBeUndefined();
    expect(result.saversCreditResult).toBeUndefined();
    expect(result.cleanEnergy).toBeUndefined();
  });
});
