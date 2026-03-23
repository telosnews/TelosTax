import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateScheduleD } from '../src/engine/scheduleD.js';
import { calculateTaxableSocialSecurity } from '../src/engine/socialSecurity.js';
import { calculateScheduleE } from '../src/engine/scheduleE.js';
import { TaxReturn, FilingStatus, Income1099B, RentalProperty } from '../src/types/index.js';

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

function makeTx(overrides: Partial<Income1099B> = {}): Income1099B {
  return {
    id: 'tx1',
    brokerName: 'Test Broker',
    description: '100 shares AAPL',
    dateSold: '2025-06-15',
    proceeds: 10000,
    costBasis: 8000,
    isLongTerm: false,
    ...overrides,
  };
}

function makeProperty(overrides: Partial<RentalProperty> = {}): RentalProperty {
  return {
    id: 'p1',
    address: '123 Main St',
    propertyType: 'single_family',
    daysRented: 365,
    personalUseDays: 0,
    rentalIncome: 24000,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// Sprint 3A: Schedule D — Capital Gains & Losses
// ═══════════════════════════════════════════════════════════

describe('Sprint 3A — Schedule D (Capital Gains & Losses)', () => {
  describe('calculateScheduleD (unit)', () => {
    it('separates short-term and long-term gains', () => {
      const result = calculateScheduleD([
        makeTx({ id: '1', proceeds: 5000, costBasis: 3000, isLongTerm: false }),
        makeTx({ id: '2', proceeds: 10000, costBasis: 6000, isLongTerm: true }),
      ], 0, FilingStatus.Single);

      expect(result.shortTermGain).toBe(2000);
      expect(result.longTermGain).toBe(4000);
      expect(result.netShortTerm).toBe(2000);
      expect(result.netLongTerm).toBe(4000);
      expect(result.netGainOrLoss).toBe(6000);
      expect(result.capitalLossDeduction).toBe(0);
      expect(result.capitalLossCarryforward).toBe(0);
    });

    it('handles net loss with $3,000 deduction limit', () => {
      const result = calculateScheduleD([
        makeTx({ id: '1', proceeds: 2000, costBasis: 12000, isLongTerm: false }), // -10,000
      ], 0, FilingStatus.Single);

      expect(result.netGainOrLoss).toBe(-10000);
      expect(result.capitalLossDeduction).toBe(3000);
      expect(result.capitalLossCarryforward).toBe(7000);
    });

    it('uses $1,500 loss limit for MFS', () => {
      const result = calculateScheduleD([
        makeTx({ id: '1', proceeds: 1000, costBasis: 6000, isLongTerm: false }), // -5,000
      ], 0, FilingStatus.MarriedFilingSeparately);

      expect(result.capitalLossDeduction).toBe(1500);
      expect(result.capitalLossCarryforward).toBe(3500);
    });

    it('applies prior-year carryforward as additional ST loss', () => {
      // $2,000 LTCG + $5,000 carryforward
      const result = calculateScheduleD([
        makeTx({ id: '1', proceeds: 12000, costBasis: 10000, isLongTerm: true }), // +2,000 LT
      ], 5000, FilingStatus.Single);

      // Carryforward adds $5,000 to ST loss
      expect(result.shortTermLoss).toBe(5000);
      expect(result.netShortTerm).toBe(-5000);
      expect(result.netLongTerm).toBe(2000);
      expect(result.netGainOrLoss).toBe(-3000);
      expect(result.capitalLossDeduction).toBe(3000);
      expect(result.capitalLossCarryforward).toBe(0);
    });

    it('handles mixed gains and losses netting out', () => {
      const result = calculateScheduleD([
        makeTx({ id: '1', proceeds: 5000, costBasis: 3000, isLongTerm: false }), // +2,000 ST
        makeTx({ id: '2', proceeds: 1000, costBasis: 3000, isLongTerm: true }),  // -2,000 LT
      ], 0, FilingStatus.Single);

      expect(result.netShortTerm).toBe(2000);
      expect(result.netLongTerm).toBe(-2000);
      expect(result.netGainOrLoss).toBe(0);
      expect(result.capitalLossDeduction).toBe(0);
    });

    it('handles small net loss within deduction limit', () => {
      const result = calculateScheduleD([
        makeTx({ id: '1', proceeds: 4000, costBasis: 6000, isLongTerm: false }), // -2,000
      ], 0, FilingStatus.Single);

      expect(result.netGainOrLoss).toBe(-2000);
      expect(result.capitalLossDeduction).toBe(2000); // full loss, under $3k limit
      expect(result.capitalLossCarryforward).toBe(0);
    });

    it('handles no transactions', () => {
      const result = calculateScheduleD([], 0, FilingStatus.Single);
      expect(result.netGainOrLoss).toBe(0);
      expect(result.capitalLossDeduction).toBe(0);
    });
  });

  describe('Schedule D integration with form1040', () => {
    it('includes LTCG in preferential rate calculation', () => {
      // Use higher income so LTCG falls in the 15% preferential zone (above 0% threshold)
      const tr = makeTaxReturn({
        w2Income: [{ id: 'w', employerName: 'Test', wages: 80000, federalTaxWithheld: 10000 }],
        income1099B: [
          makeTx({ id: '1', proceeds: 20000, costBasis: 10000, isLongTerm: true }), // +10,000 LTCG
        ],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.scheduleDNetGain).toBe(10000);
      // At $80k wages + $10k LTCG, after deduction = ~$75k taxable
      // LTCG stacks on top of ordinary income, landing in 15% preferential zone
      expect(result.form1040.preferentialTax).toBeGreaterThan(0);
      expect(result.scheduleD).toBeDefined();
      expect(result.scheduleD!.netLongTerm).toBe(10000);
    });

    it('applies capital loss deduction to reduce income', () => {
      const tr = makeTaxReturn({
        w2Income: [{ id: 'w', employerName: 'Test', wages: 50000, federalTaxWithheld: 5000 }],
        income1099B: [
          makeTx({ id: '1', proceeds: 2000, costBasis: 12000, isLongTerm: false }), // -10,000 loss
        ],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.capitalLossDeduction).toBe(3000); // capped
      expect(result.form1040.totalIncome).toBe(50000 - 3000); // wages minus loss deduction
      expect(result.scheduleD!.capitalLossCarryforward).toBe(7000);
    });

    it('includes 1099-B withholding in total withholding', () => {
      const tr = makeTaxReturn({
        w2Income: [{ id: 'w', employerName: 'Test', wages: 50000, federalTaxWithheld: 5000 }],
        income1099B: [
          makeTx({ id: '1', proceeds: 15000, costBasis: 10000, isLongTerm: true, federalTaxWithheld: 500 }),
        ],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.totalWithholding).toBe(5500); // 5000 + 500
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Sprint 3B: SSA-1099 — Social Security Benefits
// ═══════════════════════════════════════════════════════════

describe('Sprint 3B — Social Security (SSA-1099)', () => {
  describe('calculateTaxableSocialSecurity (unit)', () => {
    it('returns 0% taxable when below base amount (Single)', () => {
      // Single base = $25,000
      // $20,000 other income + 50% of $10,000 benefits = $25,000 provisional
      const result = calculateTaxableSocialSecurity(10000, 20000, FilingStatus.Single);
      expect(result.taxableBenefits).toBe(0);
      expect(result.taxablePercentage).toBe(0);
      expect(result.provisionalIncome).toBe(25000);
    });

    it('taxes up to 50% in mid range (Single)', () => {
      // Single base = $25,000, adjusted = $34,000
      // $26,000 other income + $5,000 (50% of $10,000) = $31,000 provisional
      // Between $25,000 and $34,000: up to 50% taxable
      const result = calculateTaxableSocialSecurity(10000, 26000, FilingStatus.Single);
      expect(result.taxablePercentage).toBe(0.50);
      expect(result.taxableBenefits).toBe(3000); // min(5000, (31000-25000)*0.5=3000) = 3000
    });

    it('taxes up to 85% above adjusted base (Single)', () => {
      // Single adjusted = $34,000
      // $50,000 other income + $10,000 (50% of $20,000) = $60,000 provisional
      const result = calculateTaxableSocialSecurity(20000, 50000, FilingStatus.Single);
      expect(result.taxablePercentage).toBe(0.85);
      expect(result.taxableBenefits).toBeLessThanOrEqual(20000 * 0.85);
      expect(result.taxableBenefits).toBeGreaterThan(0);
    });

    it('handles MFJ thresholds ($32k / $44k)', () => {
      // MFJ base = $32,000, adjusted = $44,000
      // $30,000 other income + $5,000 (50% of $10,000) = $35,000 provisional
      // Between $32,000 and $44,000: 50% bracket
      const result = calculateTaxableSocialSecurity(10000, 30000, FilingStatus.MarriedFilingJointly);
      expect(result.taxablePercentage).toBe(0.50);
      expect(result.taxableBenefits).toBe(1500); // min(5000, (35000-32000)*0.5=1500) = 1500
    });

    it('MFS always taxes 85% from $0', () => {
      // MFS: base amount = $0, adjusted = $0 → always in 85% bracket
      const result = calculateTaxableSocialSecurity(10000, 5000, FilingStatus.MarriedFilingSeparately);
      expect(result.taxablePercentage).toBe(0.85);
      expect(result.taxableBenefits).toBeGreaterThan(0);
    });

    it('returns 0 for zero benefits', () => {
      const result = calculateTaxableSocialSecurity(0, 50000, FilingStatus.Single);
      expect(result.taxableBenefits).toBe(0);
    });

    it('caps taxable amount at 85% of benefits', () => {
      // Very high income: taxable should never exceed 85% of total benefits
      const result = calculateTaxableSocialSecurity(30000, 500000, FilingStatus.Single);
      expect(result.taxableBenefits).toBe(30000 * 0.85);
    });
  });

  describe('Social Security integration with form1040', () => {
    it('adds taxable SS to total income', () => {
      const tr = makeTaxReturn({
        w2Income: [{ id: 'w', employerName: 'Test', wages: 50000, federalTaxWithheld: 5000 }],
        incomeSSA1099: { id: 'ss', totalBenefits: 20000, federalTaxWithheld: 2000 },
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.taxableSocialSecurity).toBeGreaterThan(0);
      expect(result.form1040.totalIncome).toBeGreaterThan(50000); // wages + some taxable SS
      expect(result.socialSecurity).toBeDefined();
      expect(result.socialSecurity!.totalBenefits).toBe(20000);
    });

    it('includes SSA-1099 withholding in total', () => {
      const tr = makeTaxReturn({
        w2Income: [{ id: 'w', employerName: 'Test', wages: 50000, federalTaxWithheld: 5000 }],
        incomeSSA1099: { id: 'ss', totalBenefits: 20000, federalTaxWithheld: 2000 },
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.totalWithholding).toBe(7000); // 5000 + 2000
    });

    it('returns no taxable SS when only income is low SS benefits', () => {
      const tr = makeTaxReturn({
        incomeSSA1099: { id: 'ss', totalBenefits: 15000 },
      });
      const result = calculateForm1040(tr);
      // Provisional = $0 + $7,500 = $7,500, well below $25k threshold
      expect(result.form1040.taxableSocialSecurity).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Sprint 3C: Schedule E — Rental Income
// ═══════════════════════════════════════════════════════════

describe('Sprint 3C — Schedule E (Rental Income)', () => {
  describe('calculateScheduleE (unit)', () => {
    it('handles net positive rental income', () => {
      const result = calculateScheduleE([
        makeProperty({ rentalIncome: 24000, mortgageInterest: 8000, taxes: 3000, insurance: 1500 }),
      ]);

      expect(result.totalRentalIncome).toBe(24000);
      expect(result.totalRentalExpenses).toBe(12500);
      expect(result.netRentalIncome).toBe(11500);
      expect(result.allowableLoss).toBe(0);
      expect(result.scheduleEIncome).toBe(11500);
    });

    it('handles net rental loss', () => {
      const result = calculateScheduleE([
        makeProperty({ rentalIncome: 10000, mortgageInterest: 15000, taxes: 5000, depreciation: 8000 }),
      ]);

      expect(result.netRentalIncome).toBe(-18000);
      expect(result.allowableLoss).toBe(0);
      expect(result.suspendedLoss).toBe(0);
      expect(result.scheduleEIncome).toBe(-18000);
    });

    it('returns raw net rental loss without limitation', () => {
      const result = calculateScheduleE([
        makeProperty({ rentalIncome: 10000, mortgageInterest: 20000, taxes: 10000 }),
      ]);

      expect(result.netRentalIncome).toBe(-20000);
      expect(result.allowableLoss).toBe(0);
      expect(result.suspendedLoss).toBe(0);
      expect(result.scheduleEIncome).toBe(-20000);
    });

    it('returns raw net loss regardless of AGI', () => {
      const result = calculateScheduleE([
        makeProperty({ rentalIncome: 10000, mortgageInterest: 20000, taxes: 10000 }),
      ]);

      expect(result.netRentalIncome).toBe(-20000);
      expect(result.allowableLoss).toBe(0);
      expect(result.suspendedLoss).toBe(0);
      expect(result.scheduleEIncome).toBe(-20000);
    });

    it('handles multiple properties', () => {
      const result = calculateScheduleE([
        makeProperty({ id: 'p1', rentalIncome: 24000, mortgageInterest: 8000 }),
        makeProperty({ id: 'p2', rentalIncome: 18000, mortgageInterest: 12000, taxes: 5000, insurance: 2000 }),
      ]);

      expect(result.totalRentalIncome).toBe(42000);
      expect(result.totalRentalExpenses).toBe(27000);
      expect(result.netRentalIncome).toBe(15000);
      expect(result.scheduleEIncome).toBe(15000);
    });

    it('handles empty properties array', () => {
      const result = calculateScheduleE([]);
      expect(result.scheduleEIncome).toBe(0);
    });

    it('returns raw net loss for large losses', () => {
      const result = calculateScheduleE([
        makeProperty({ rentalIncome: 10000, mortgageInterest: 30000, taxes: 10000, depreciation: 10000 }),
      ]);

      expect(result.netRentalIncome).toBe(-40000);
      expect(result.allowableLoss).toBe(0);
      expect(result.suspendedLoss).toBe(0);
      expect(result.scheduleEIncome).toBe(-40000);
    });
  });

  describe('Schedule E integration with form1040', () => {
    it('adds positive rental income to totalIncome', () => {
      const tr = makeTaxReturn({
        w2Income: [{ id: 'w', employerName: 'Test', wages: 50000, federalTaxWithheld: 5000 }],
        rentalProperties: [makeProperty({ rentalIncome: 24000, mortgageInterest: 8000 })],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.scheduleEIncome).toBe(16000);
      expect(result.form1040.totalIncome).toBe(50000 + 16000);
      expect(result.scheduleE).toBeDefined();
    });

    it('allows rental loss to reduce totalIncome', () => {
      const tr = makeTaxReturn({
        w2Income: [{ id: 'w', employerName: 'Test', wages: 50000, federalTaxWithheld: 5000 }],
        rentalProperties: [makeProperty({ rentalIncome: 10000, mortgageInterest: 20000 })],
      });
      const result = calculateForm1040(tr);
      // AGI before Schedule E = roughly $50k (below phase-out)
      // Net rental loss = -10,000, fully deductible
      expect(result.form1040.scheduleEIncome).toBe(-10000);
      expect(result.form1040.totalIncome).toBe(50000 - 10000);
    });

    it('includes positive rental income in NIIT calculation', () => {
      const tr = makeTaxReturn({
        w2Income: [{ id: 'w', employerName: 'Test', wages: 250000, federalTaxWithheld: 50000 }],
        rentalProperties: [makeProperty({ rentalIncome: 50000, mortgageInterest: 10000 })],
      });
      const result = calculateForm1040(tr);
      // Rental income of $40k net contributes to NIIT investment income
      expect(result.form1040.niitTax).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Integration: Combined Sprint 3 scenarios
// ═══════════════════════════════════════════════════════════

describe('Sprint 3 — Integration Tests', () => {
  it('retiree: SS + 1099-B + rental income', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      incomeSSA1099: { id: 'ss', totalBenefits: 36000, federalTaxWithheld: 3000 },
      income1099B: [
        makeTx({ id: '1', proceeds: 50000, costBasis: 30000, isLongTerm: true }), // +$20,000 LTCG
      ],
      rentalProperties: [
        makeProperty({ rentalIncome: 24000, mortgageInterest: 6000, insurance: 2000, taxes: 3000 }),
      ],
    });
    const result = calculateForm1040(tr);

    // Verify all income types flow through
    // incomeBeforeSS = $20,000 (cap gains) + $13,000 (rental net) = $33,000
    // Provisional = $33,000 + $18,000 (50% SS) = $51,000, above MFJ $44k → up to 85% taxable
    expect(result.form1040.scheduleDNetGain).toBe(20000);
    expect(result.form1040.taxableSocialSecurity).toBeGreaterThan(0);
    expect(result.form1040.scheduleEIncome).toBe(13000); // 24000 - 11000
    expect(result.form1040.totalIncome).toBeGreaterThan(0);

    // Verify sub-results exist
    expect(result.scheduleD).toBeDefined();
    expect(result.socialSecurity).toBeDefined();
    expect(result.scheduleE).toBeDefined();

    // LTCG should get preferential rates
    expect(result.form1040.preferentialTax).toBeGreaterThanOrEqual(0);
  });

  it('investor with capital loss carryforward', () => {
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w', employerName: 'Test', wages: 80000, federalTaxWithheld: 10000 }],
      income1099B: [
        makeTx({ id: '1', proceeds: 5000, costBasis: 3000, isLongTerm: true }), // +$2,000 LTCG
      ],
      capitalLossCarryforward: 8000, // $8k from last year
    });
    const result = calculateForm1040(tr);

    // Carryforward: $8k ST loss + $2k LTCG = $6k net loss
    // $3k deductible, $3k carries forward
    expect(result.form1040.capitalLossDeduction).toBe(3000);
    expect(result.scheduleD!.capitalLossCarryforward).toBe(3000);
    expect(result.form1040.totalIncome).toBe(80000 - 3000);
  });

  it('no Sprint 3 income types = no change from baseline', () => {
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w', employerName: 'Test', wages: 50000, federalTaxWithheld: 5000 }],
    });
    const result = calculateForm1040(tr);

    expect(result.form1040.scheduleDNetGain).toBe(0);
    expect(result.form1040.capitalLossDeduction).toBe(0);
    expect(result.form1040.taxableSocialSecurity).toBe(0);
    expect(result.form1040.scheduleEIncome).toBe(0);
    expect(result.scheduleD).toBeUndefined();
    expect(result.socialSecurity).toBeUndefined();
    expect(result.scheduleE).toBeUndefined();
    expect(result.form1040.totalIncome).toBe(50000);
  });
});
