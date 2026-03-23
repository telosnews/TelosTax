import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculatePreferentialRateTax } from '../src/engine/capitalGains.js';
import { calculateForm4797 } from '../src/engine/form4797.js';
import { FilingStatus, TaxReturn, Form4797Property } from '../src/types/index.js';
import { CAPITAL_GAINS_RATES } from '../src/constants/tax2025.js';

// ─── Helper: minimal valid TaxReturn ───────────────────
function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint22',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    filingStatus: FilingStatus.Single,
    w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 60000, federalTaxWithheld: 8000 }],
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
// 22A: 25% Unrecaptured Section 1250 Rate Zone
// IRC §1(h)(1)(E), Schedule D Tax Worksheet
// ════════════════════════════════════════════════════════

describe('22A: 25% Unrecaptured Section 1250 Rate Zone', () => {
  describe('Constants', () => {
    it('RATE_25 constant = 0.25', () => {
      expect(CAPITAL_GAINS_RATES.RATE_25).toBe(0.25);
    });
  });

  describe('Unit tests: calculatePreferentialRateTax with section 1250 gain', () => {
    it('no section 1250 gain — backward compatible (section1250Tax = 0)', () => {
      const result = calculatePreferentialRateTax(
        100000, 10000, 20000, FilingStatus.Single,
      );
      expect(result.section1250Tax).toBe(0);
      expect(result.ordinaryTax).toBeGreaterThan(0);
      expect(result.preferentialTax).toBeGreaterThan(0);
      expect(result.totalTax).toBe(result.ordinaryTax + result.preferentialTax);
    });

    it('section1250 = 0 explicitly — same as omitted', () => {
      const result = calculatePreferentialRateTax(
        100000, 10000, 20000, FilingStatus.Single, 0,
      );
      expect(result.section1250Tax).toBe(0);
    });

    it('basic section 1250 gain — flat 25% rate (per Schedule D Tax Worksheet)', () => {
      // $100k taxable, $0 QD, $30k LTCG (of which $10k is unrecaptured 1250)
      const result = calculatePreferentialRateTax(
        100000, 0, 30000, FilingStatus.Single, 10000,
      );
      // Per IRC §1(h)(1)(E): flat 25% on unrecaptured 1250 gain
      // $10k × 25% = $2,500
      expect(result.section1250Tax).toBe(2500);
      // Remaining $20k LTCG gets 0%/15%/20% treatment
      expect(result.preferentialTax).toBeGreaterThan(0);
      // Total = ordinary + 1250 + preferential
      expect(result.totalTax).toBe(
        result.ordinaryTax + result.section1250Tax + result.preferentialTax,
      );
    });

    it('section 1250 gain capped at LTCG amount', () => {
      // $10k LTCG but $20k unrecaptured 1250 — capped at LTCG
      const result = calculatePreferentialRateTax(
        100000, 0, 10000, FilingStatus.Single, 20000,
      );
      // Effective 1250 = $10k (capped to LTCG)
      // When all LTCG is 1250 and no QD, special = ordinary($90k) + 25%×$10k
      // Regular = progressiveTax($100k). Since 25% > 22% bracket, regular wins
      // section1250Tax adjusted: regularTax - ordinaryTax = tax on the $10k at ordinary rates
      expect(result.section1250Tax).toBe(2200); // effective 22% bracket rate
      expect(result.preferentialTax).toBe(0); // no remaining LTCG
    });

    it('section 1250 gain capped at taxable income', () => {
      const result = calculatePreferentialRateTax(
        5000, 0, 10000, FilingStatus.Single, 10000,
      );
      // Taxable income only $5k, effective 1250 = $5k
      // Special = 0 + 25%×5k = $1250. Regular = progressiveTax(5k) = $500
      // min(1250, 500) = 500 → regular wins
      expect(result.section1250Tax).toBe(500);
      expect(result.totalTax).toBe(500);
    });

    it('all LTCG is section 1250, no other preferential — adjusts to ordinary rate', () => {
      const result = calculatePreferentialRateTax(
        100000, 0, 20000, FilingStatus.Single, 20000,
      );
      // All $20k LTCG is 1250, no QD. Ordinary = $80k (22% bracket)
      // Special = progressiveTax($80k) + 25%×$20k. Regular = progressiveTax($100k)
      // Since 25% > 22%, regular is cheaper → section1250Tax adjusted
      expect(result.section1250Tax).toBe(4400); // $20k at effective 22%
      expect(result.preferentialTax).toBe(0); // nothing left for 0/15/20
    });

    it('section 1250 gain with qualified dividends — QD uses 0/15/20 zones', () => {
      // $100k taxable, $5k QD, $15k LTCG (of which $10k is 1250)
      const result = calculatePreferentialRateTax(
        100000, 5000, 15000, FilingStatus.Single, 10000,
      );
      // 1250: $10k × 25% = $2,500
      expect(result.section1250Tax).toBe(2500);
      // Remaining $5k LTCG + $5k QD = $10k preferential at 0/15/20 rates
      expect(result.preferentialTax).toBeGreaterThan(0);
    });

    it('zero taxable income — all zeros', () => {
      const result = calculatePreferentialRateTax(
        0, 0, 10000, FilingStatus.Single, 5000,
      );
      expect(result.section1250Tax).toBe(0);
      expect(result.preferentialTax).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it('negative unrecaptured gain treated as zero', () => {
      const result = calculatePreferentialRateTax(
        100000, 0, 20000, FilingStatus.Single, -5000,
      );
      expect(result.section1250Tax).toBe(0);
    });

    it('MFJ filing status — section 1250 at 25%', () => {
      const result = calculatePreferentialRateTax(
        200000, 10000, 30000, FilingStatus.MarriedFilingJointly, 15000,
      );
      expect(result.section1250Tax).toBe(3750); // $15k × 25%
      expect(result.totalTax).toBe(
        result.ordinaryTax + result.section1250Tax + result.preferentialTax,
      );
    });

    it('MFS filing status — section 1250 at 25%', () => {
      const result = calculatePreferentialRateTax(
        80000, 0, 20000, FilingStatus.MarriedFilingSeparately, 10000,
      );
      expect(result.section1250Tax).toBe(2500); // $10k × 25%
    });

    it('HoH filing status — section 1250 at 25%', () => {
      const result = calculatePreferentialRateTax(
        100000, 0, 20000, FilingStatus.HeadOfHousehold, 8000,
      );
      expect(result.section1250Tax).toBe(2000); // $8k × 25%
    });

    it('QSS filing status — section 1250 at 25%', () => {
      const result = calculatePreferentialRateTax(
        200000, 10000, 30000, FilingStatus.QualifyingSurvivingSpouse, 15000,
      );
      expect(result.section1250Tax).toBe(3750);
    });

    it('low bracket — min(special, regular) ensures no tax increase', () => {
      // $20k taxable, $15k LTCG with $5k unrecaptured 1250
      // Special: ordinary(5k) + 25%×5k + 0%×10k = $500 + $1250 + $0 = $1750
      // Regular: progressiveTax(20k) ≈ $2,162
      // min(1750, 2162) = 1750 → special wins, 1250 stays at $1,250
      const result = calculatePreferentialRateTax(
        20000, 0, 15000, FilingStatus.Single, 5000,
      );
      expect(result.section1250Tax).toBe(1250); // 25% flat
      expect(result.totalTax).toBeLessThan(2200); // less than all at ordinary rates
    });

    it('all income is preferential with 1250 — 25% vs 0% stacking', () => {
      // $30k taxable, all LTCG, $10k is 1250
      const result = calculatePreferentialRateTax(
        30000, 0, 30000, FilingStatus.Single, 10000,
      );
      // Special: ordinary(0) + 25%×10k + 0%×20k = $0 + $2500 + $0 = $2500
      // Regular: progressiveTax(30k) ≈ $3,381
      // min(2500, 3381) = 2500 → special wins
      expect(result.section1250Tax).toBe(2500); // $10k × 25%
      // Remaining $20k → all in 0% zone (threshold $48,350)
      expect(result.preferentialTax).toBe(0);
      expect(result.totalTax).toBe(2500);
    });

    it('large section 1250 gain — high bracket, 25% clearly beneficial', () => {
      // $300k taxable, $0 QD, $50k LTCG with $30k unrecaptured 1250
      const result = calculatePreferentialRateTax(
        300000, 0, 50000, FilingStatus.Single, 30000,
      );
      // Ordinary = $250k (in 35% bracket), 25% < 35% → definitely beneficial
      expect(result.section1250Tax).toBe(7500); // $30k × 25%
    });

    it('no preferential income — all ordinary (backward compat)', () => {
      const result = calculatePreferentialRateTax(
        100000, 0, 0, FilingStatus.Single, 5000,
      );
      // No LTCG, so 1250 is capped at 0
      expect(result.section1250Tax).toBe(0);
      expect(result.preferentialTax).toBe(0);
    });

    it('regular tax lower than special — totalTax uses regular', () => {
      // Scenario where 25% on 1250 makes special > regular
      // This happens when ordinary portion is very low bracket and 25% is too high
      // E.g. $10k taxable, all LTCG, $10k is 1250
      // Special: ordinary(0) + 25%×10k = $2500
      // Regular: progressiveTax(10k) = $1000 (10% bracket)
      // min(2500, 1000) = 1000 → regular wins
      const result = calculatePreferentialRateTax(
        10000, 0, 10000, FilingStatus.Single, 10000,
      );
      expect(result.totalTax).toBe(1000); // regular tax wins
      // section1250Tax adjusted down from $2500
      expect(result.section1250Tax).toBeLessThan(2500);
      expect(result.section1250Tax).toBe(1000); // all tax attributed to 1250
    });

    it('special tax equals regular tax — no adjustment needed', () => {
      // Edge case: special = regular
      const resultWith = calculatePreferentialRateTax(
        50000, 0, 1, FilingStatus.Single, 1,
      );
      // Very small 1250 gain shouldn't cause issues
      expect(resultWith.totalTax).toBeGreaterThan(0);
    });
  });

  describe('Backward compatibility with existing tests', () => {
    it('no section 1250 param — matches old behavior exactly', () => {
      const withParam = calculatePreferentialRateTax(100000, 10000, 20000, FilingStatus.Single, 0);
      const withoutParam = calculatePreferentialRateTax(100000, 10000, 20000, FilingStatus.Single);
      expect(withParam.ordinaryTax).toBe(withoutParam.ordinaryTax);
      expect(withParam.preferentialTax).toBe(withoutParam.preferentialTax);
      expect(withParam.totalTax).toBe(withoutParam.totalTax);
    });
  });

  describe('Integration: section1250Tax flows through form1040', () => {
    it('unrecapturedSection1250Gain on TaxReturn produces section1250Tax', () => {
      const tr = baseTaxReturn({
        income1099DIV: [{
          id: 'div1', payerName: 'Vanguard',
          ordinaryDividends: 5000, qualifiedDividends: 5000,
          capitalGainDistributions: 20000,
        }],
        unrecapturedSection1250Gain: 8000,
      });
      const result = calculateForm1040(tr);
      // Section 1250 tax should appear (at 25% flat since high enough bracket)
      expect(result.form1040.section1250Tax).toBeGreaterThan(0);
    });

    it('no unrecapturedSection1250Gain — section1250Tax = 0', () => {
      const tr = baseTaxReturn({
        income1099DIV: [{
          id: 'div1', payerName: 'Vanguard',
          ordinaryDividends: 5000, qualifiedDividends: 5000,
          capitalGainDistributions: 20000,
        }],
      });
      const result = calculateForm1040(tr);
      expect(result.form1040.section1250Tax).toBe(0);
    });

    it('section1250Tax increases tax compared to no 1250 gain', () => {
      const trWith = baseTaxReturn({
        income1099DIV: [{
          id: 'div1', payerName: 'Vanguard',
          ordinaryDividends: 5000, qualifiedDividends: 5000,
          capitalGainDistributions: 30000,
        }],
        unrecapturedSection1250Gain: 10000,
      });
      const trWithout = baseTaxReturn({
        income1099DIV: [{
          id: 'div1', payerName: 'Vanguard',
          ordinaryDividends: 5000, qualifiedDividends: 5000,
          capitalGainDistributions: 30000,
        }],
      });
      const resultWith = calculateForm1040(trWith);
      const resultWithout = calculateForm1040(trWithout);

      // With 1250, total tax should be higher (25% on 1250 portion instead of 15%)
      expect(resultWith.form1040.incomeTax).toBeGreaterThan(resultWithout.form1040.incomeTax);
      expect(resultWith.form1040.section1250Tax).toBeGreaterThan(0);
      expect(resultWithout.form1040.section1250Tax).toBe(0);
    });
  });
});

// ════════════════════════════════════════════════════════
// 22B: Form 4797 Engine Module
// IRC §§1231, 1245, 1250; Form 4797
// ════════════════════════════════════════════════════════

describe('22B: Form 4797 — Sales of Business Property', () => {
  // ─── Helper ──────────────────────────
  function makeProperty(overrides: Partial<Form4797Property> = {}): Form4797Property {
    return {
      id: 'prop-1',
      description: 'Office Equipment',
      dateAcquired: '2020-01-15',
      dateSold: '2025-06-01',
      salesPrice: 50000,
      costBasis: 40000,
      depreciationAllowed: 15000,
      ...overrides,
    };
  }

  describe('Empty/edge cases', () => {
    it('empty array returns all zeros', () => {
      const result = calculateForm4797([]);
      expect(result.totalOrdinaryIncome).toBe(0);
      expect(result.netSection1231GainOrLoss).toBe(0);
      expect(result.section1231IsGain).toBe(false);
      expect(result.unrecapturedSection1250Gain).toBe(0);
      expect(result.totalGain).toBe(0);
      expect(result.totalLoss).toBe(0);
      expect(result.propertyResults).toHaveLength(0);
    });

    it('single property with no gain/loss (sales price = adjusted basis)', () => {
      const result = calculateForm4797([makeProperty({
        salesPrice: 25000, costBasis: 40000, depreciationAllowed: 15000,
        // adjustedBasis = 40000 - 15000 = 25000, salesPrice = 25000 → gain = 0
      })]);
      expect(result.totalGain).toBe(0);
      expect(result.totalLoss).toBe(0);
      expect(result.totalOrdinaryIncome).toBe(0);
    });
  });

  describe('Section 1245 — Full depreciation recapture', () => {
    it('gain ≤ depreciation — all recaptured as ordinary income', () => {
      const result = calculateForm4797([makeProperty({
        id: 'equip-1',
        description: 'Machinery',
        salesPrice: 30000,
        costBasis: 40000,
        depreciationAllowed: 15000,
        isSection1245: true,
        // adjustedBasis = 40000 - 15000 = 25000
        // gain = 30000 - 25000 = 5000
        // §1245 ordinary = min(5000, 15000) = 5000
      })]);
      expect(result.propertyResults[0].gain).toBe(5000);
      expect(result.propertyResults[0].section1245OrdinaryIncome).toBe(5000);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(0);
      expect(result.totalOrdinaryIncome).toBe(5000);
    });

    it('gain > depreciation — excess goes to §1231', () => {
      const result = calculateForm4797([makeProperty({
        id: 'equip-2',
        salesPrice: 65000,
        costBasis: 40000,
        depreciationAllowed: 15000,
        isSection1245: true,
        // adjustedBasis = 25000, gain = 40000
        // §1245 ordinary = min(40000, 15000) = 15000
        // §1231 = 40000 - 15000 = 25000
      })]);
      expect(result.propertyResults[0].gain).toBe(40000);
      expect(result.propertyResults[0].section1245OrdinaryIncome).toBe(15000);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(25000);
      expect(result.totalOrdinaryIncome).toBe(15000);
      expect(result.netSection1231GainOrLoss).toBe(25000);
      expect(result.section1231IsGain).toBe(true);
    });

    it('loss on §1245 property — no recapture, all §1231 loss', () => {
      const result = calculateForm4797([makeProperty({
        salesPrice: 20000,
        costBasis: 40000,
        depreciationAllowed: 15000,
        isSection1245: true,
        // adjustedBasis = 25000, loss = 5000
      })]);
      expect(result.propertyResults[0].loss).toBe(5000);
      expect(result.propertyResults[0].section1245OrdinaryIncome).toBe(0);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(-5000);
      expect(result.totalLoss).toBe(5000);
      expect(result.section1231IsGain).toBe(false);
    });

    it('depreciation = 0, gain exists — no recapture, all §1231', () => {
      const result = calculateForm4797([makeProperty({
        salesPrice: 50000,
        costBasis: 40000,
        depreciationAllowed: 0,
        isSection1245: true,
      })]);
      expect(result.propertyResults[0].section1245OrdinaryIncome).toBe(0);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(10000);
    });

    it('gain exactly equals depreciation — all recaptured', () => {
      const result = calculateForm4797([makeProperty({
        salesPrice: 40000,
        costBasis: 40000,
        depreciationAllowed: 15000,
        isSection1245: true,
        // adjustedBasis = 25000, gain = 15000 = depreciation
      })]);
      expect(result.propertyResults[0].section1245OrdinaryIncome).toBe(15000);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(0);
    });
  });

  describe('Section 1250 — Partial depreciation recapture + unrecaptured gain', () => {
    it('no excess depreciation — all gain is unrecaptured 1250 (25% zone)', () => {
      const result = calculateForm4797([makeProperty({
        id: 'bldg-1',
        description: 'Office Building',
        salesPrice: 200000,
        costBasis: 180000,
        depreciationAllowed: 30000,
        isSection1250: true,
        straightLineDepreciation: 30000,
        // adjustedBasis = 150000, gain = 50000
        // excess = 30000 - 30000 = 0 → no ordinary recapture
        // unrecaptured = min(50000, 30000) = 30000 (rate classification, not subtracted from §1231)
        // §1231 = 50000 - 0 = 50000 (full gain after ordinary recapture)
      })]);
      expect(result.propertyResults[0].gain).toBe(50000);
      expect(result.propertyResults[0].section1250OrdinaryIncome).toBe(0);
      expect(result.propertyResults[0].unrecapturedSection1250Gain).toBe(30000);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(50000);
      expect(result.unrecapturedSection1250Gain).toBe(30000);
    });

    it('excess depreciation exists — excess recaptured as ordinary', () => {
      const result = calculateForm4797([makeProperty({
        id: 'bldg-2',
        salesPrice: 200000,
        costBasis: 180000,
        depreciationAllowed: 40000,
        isSection1250: true,
        straightLineDepreciation: 30000,
        // adjustedBasis = 140000, gain = 60000
        // excess = 40000 - 30000 = 10000
        // ordinary = min(60000, 10000) = 10000
        // remaining = 60000 - 10000 = 50000
        // unrecaptured = min(50000, 30000) = 30000 (rate classification)
        // §1231 = 50000 (full remaining after ordinary recapture)
      })]);
      expect(result.propertyResults[0].section1250OrdinaryIncome).toBe(10000);
      expect(result.propertyResults[0].unrecapturedSection1250Gain).toBe(30000);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(50000);
      expect(result.totalOrdinaryIncome).toBe(10000);
    });

    it('gain less than excess depreciation — all ordinary, no unrecaptured', () => {
      const result = calculateForm4797([makeProperty({
        salesPrice: 145000,
        costBasis: 180000,
        depreciationAllowed: 40000,
        isSection1250: true,
        straightLineDepreciation: 30000,
        // adjustedBasis = 140000, gain = 5000
        // excess = 10000, ordinary = min(5000, 10000) = 5000
        // remaining = 0 → unrecaptured = 0, §1231 = 0
      })]);
      expect(result.propertyResults[0].section1250OrdinaryIncome).toBe(5000);
      expect(result.propertyResults[0].unrecapturedSection1250Gain).toBe(0);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(0);
    });

    it('gain exactly equals total depreciation — all recaptured, no §1231', () => {
      const result = calculateForm4797([makeProperty({
        salesPrice: 180000,
        costBasis: 180000,
        depreciationAllowed: 40000,
        isSection1250: true,
        straightLineDepreciation: 30000,
        // adjustedBasis = 140000, gain = 40000
        // excess = 10000, ordinary = 10000
        // remaining = 30000, unrecaptured = min(30000, 30000) = 30000 (rate classification)
        // §1231 = 30000 (full remaining after ordinary recapture)
      })]);
      expect(result.propertyResults[0].section1250OrdinaryIncome).toBe(10000);
      expect(result.propertyResults[0].unrecapturedSection1250Gain).toBe(30000);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(30000);
    });

    it('loss on §1250 property — no recapture', () => {
      const result = calculateForm4797([makeProperty({
        salesPrice: 130000,
        costBasis: 180000,
        depreciationAllowed: 40000,
        isSection1250: true,
        straightLineDepreciation: 30000,
        // adjustedBasis = 140000, loss = 10000
      })]);
      expect(result.propertyResults[0].loss).toBe(10000);
      expect(result.propertyResults[0].section1250OrdinaryIncome).toBe(0);
      expect(result.propertyResults[0].unrecapturedSection1250Gain).toBe(0);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(-10000);
    });

    it('straightLineDepreciation = 0 — all excess recapture, no unrecaptured', () => {
      const result = calculateForm4797([makeProperty({
        salesPrice: 200000,
        costBasis: 180000,
        depreciationAllowed: 30000,
        isSection1250: true,
        straightLineDepreciation: 0,
        // adjustedBasis = 150000, gain = 50000
        // excess = 30000, ordinary = min(50000, 30000) = 30000
        // remaining = 20000, unrecaptured = min(20000, 0) = 0
        // §1231 = 20000
      })]);
      expect(result.propertyResults[0].section1250OrdinaryIncome).toBe(30000);
      expect(result.propertyResults[0].unrecapturedSection1250Gain).toBe(0);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(20000);
    });

    it('straightLineDepreciation omitted defaults to 0', () => {
      const result = calculateForm4797([makeProperty({
        salesPrice: 200000,
        costBasis: 180000,
        depreciationAllowed: 30000,
        isSection1250: true,
        // straightLineDepreciation omitted → defaults to 0
      })]);
      // excess = 30000 - 0 = 30000, all ordinary
      expect(result.propertyResults[0].section1250OrdinaryIncome).toBe(30000);
      expect(result.propertyResults[0].unrecapturedSection1250Gain).toBe(0);
    });
  });

  describe('Section 1231 — Netting gains and losses', () => {
    it('net §1231 gain → treated as LTCG (section1231IsGain = true)', () => {
      const result = calculateForm4797([
        makeProperty({
          id: 'a', salesPrice: 70000, costBasis: 40000, depreciationAllowed: 0,
          // gain = 30000, all §1231
        }),
      ]);
      expect(result.netSection1231GainOrLoss).toBe(30000);
      expect(result.section1231IsGain).toBe(true);
    });

    it('net §1231 loss → treated as ordinary loss (section1231IsGain = false)', () => {
      const result = calculateForm4797([
        makeProperty({
          id: 'a', salesPrice: 30000, costBasis: 40000, depreciationAllowed: 0,
          // loss = 10000, all §1231
        }),
      ]);
      expect(result.netSection1231GainOrLoss).toBe(-10000);
      expect(result.section1231IsGain).toBe(false);
    });

    it('multiple properties: gains and losses net together', () => {
      const result = calculateForm4797([
        makeProperty({
          id: 'gain', salesPrice: 80000, costBasis: 50000, depreciationAllowed: 0,
          // gain = 30000
        }),
        makeProperty({
          id: 'loss', salesPrice: 30000, costBasis: 50000, depreciationAllowed: 0,
          // loss = 20000
        }),
      ]);
      expect(result.netSection1231GainOrLoss).toBe(10000); // 30000 - 20000
      expect(result.section1231IsGain).toBe(true);
      expect(result.totalGain).toBe(30000);
      expect(result.totalLoss).toBe(20000);
    });

    it('net zero §1231 → not a gain', () => {
      const result = calculateForm4797([
        makeProperty({ id: 'a', salesPrice: 60000, costBasis: 50000, depreciationAllowed: 0 }),
        makeProperty({ id: 'b', salesPrice: 40000, costBasis: 50000, depreciationAllowed: 0 }),
      ]);
      expect(result.netSection1231GainOrLoss).toBe(0);
      expect(result.section1231IsGain).toBe(false);
    });

    it('three properties — complex netting', () => {
      const result = calculateForm4797([
        makeProperty({ id: 'a', salesPrice: 100000, costBasis: 60000, depreciationAllowed: 0 }), // gain 40k
        makeProperty({ id: 'b', salesPrice: 20000, costBasis: 50000, depreciationAllowed: 0 }),  // loss 30k
        makeProperty({ id: 'c', salesPrice: 55000, costBasis: 50000, depreciationAllowed: 0 }),  // gain 5k
      ]);
      expect(result.netSection1231GainOrLoss).toBe(15000); // 40k - 30k + 5k
      expect(result.section1231IsGain).toBe(true);
      expect(result.propertyResults).toHaveLength(3);
    });
  });

  describe('No recapture designation (neither §1245 nor §1250)', () => {
    it('all gain goes to §1231 — no recapture', () => {
      const result = calculateForm4797([makeProperty({
        salesPrice: 60000, costBasis: 40000, depreciationAllowed: 10000,
        // adjustedBasis = 30000, gain = 30000
        // No isSection1245 or isSection1250 → all §1231
      })]);
      expect(result.propertyResults[0].section1245OrdinaryIncome).toBe(0);
      expect(result.propertyResults[0].section1250OrdinaryIncome).toBe(0);
      expect(result.propertyResults[0].unrecapturedSection1250Gain).toBe(0);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(30000);
    });

    it('loss goes to §1231', () => {
      const result = calculateForm4797([makeProperty({
        salesPrice: 20000, costBasis: 40000, depreciationAllowed: 10000,
        // adjustedBasis = 30000, loss = 10000
      })]);
      expect(result.propertyResults[0].section1231GainOrLoss).toBe(-10000);
    });
  });

  describe('Mixed property types', () => {
    it('§1245 + §1250 properties combined', () => {
      const result = calculateForm4797([
        makeProperty({
          id: 'equip',
          description: 'Equipment',
          salesPrice: 35000,
          costBasis: 30000,
          depreciationAllowed: 12000,
          isSection1245: true,
          // adjustedBasis = 18000, gain = 17000
          // §1245 ordinary = min(17000, 12000) = 12000
          // §1231 = 5000
        }),
        makeProperty({
          id: 'bldg',
          description: 'Building',
          salesPrice: 250000,
          costBasis: 200000,
          depreciationAllowed: 50000,
          isSection1250: true,
          straightLineDepreciation: 50000,
          // adjustedBasis = 150000, gain = 100000
          // excess = 0, ordinary = 0
          // unrecaptured = min(100000, 50000) = 50000
          // §1231 = 100000 (full remaining gain after ordinary recapture)
        }),
      ]);
      expect(result.totalOrdinaryIncome).toBe(12000); // only from §1245
      expect(result.unrecapturedSection1250Gain).toBe(50000);
      expect(result.netSection1231GainOrLoss).toBe(105000); // 5000 + 100000
      expect(result.section1231IsGain).toBe(true);
    });

    it('§1245 gain + §1250 loss — netting', () => {
      const result = calculateForm4797([
        makeProperty({
          id: 'equip',
          salesPrice: 40000,
          costBasis: 30000,
          depreciationAllowed: 10000,
          isSection1245: true,
          // adjustedBasis = 20000, gain = 20000
          // §1245 ordinary = 10000, §1231 = 10000
        }),
        makeProperty({
          id: 'bldg',
          salesPrice: 100000,
          costBasis: 200000,
          depreciationAllowed: 50000,
          isSection1250: true,
          straightLineDepreciation: 50000,
          // adjustedBasis = 150000, loss = 50000
        }),
      ]);
      expect(result.totalOrdinaryIncome).toBe(10000);
      expect(result.unrecapturedSection1250Gain).toBe(0); // loss, so no recapture
      expect(result.netSection1231GainOrLoss).toBe(-40000); // 10000 - 50000
      expect(result.section1231IsGain).toBe(false);
    });

    it('multiple §1250 properties — unrecaptured gains sum', () => {
      const result = calculateForm4797([
        makeProperty({
          id: 'bldg1', salesPrice: 200000, costBasis: 180000,
          depreciationAllowed: 30000, isSection1250: true, straightLineDepreciation: 30000,
          // gain = 50000, unrecaptured = 30000
        }),
        makeProperty({
          id: 'bldg2', salesPrice: 150000, costBasis: 120000,
          depreciationAllowed: 20000, isSection1250: true, straightLineDepreciation: 20000,
          // gain = 50000, unrecaptured = 20000
        }),
      ]);
      expect(result.unrecapturedSection1250Gain).toBe(50000); // 30000 + 20000
    });
  });

  describe('Per-property result details', () => {
    it('adjustedBasis calculated correctly', () => {
      const result = calculateForm4797([makeProperty({
        costBasis: 100000, depreciationAllowed: 35000,
      })]);
      expect(result.propertyResults[0].adjustedBasis).toBe(65000);
    });

    it('propertyId and description preserved', () => {
      const result = calculateForm4797([makeProperty({
        id: 'my-prop-42',
        description: 'Warehouse',
      })]);
      expect(result.propertyResults[0].propertyId).toBe('my-prop-42');
      expect(result.propertyResults[0].description).toBe('Warehouse');
    });

    it('multiple properties — correct number of results', () => {
      const result = calculateForm4797([
        makeProperty({ id: 'a' }),
        makeProperty({ id: 'b' }),
        makeProperty({ id: 'c' }),
      ]);
      expect(result.propertyResults).toHaveLength(3);
    });
  });

  describe('Integration: Form 4797 + capitalGains 25% zone', () => {
    it('unrecaptured §1250 gain from form4797 feeds the 25% rate zone', () => {
      // Simulate: sell building with $30k unrecaptured gain
      const form4797Result = calculateForm4797([makeProperty({
        id: 'bldg',
        salesPrice: 200000,
        costBasis: 180000,
        depreciationAllowed: 30000,
        isSection1250: true,
        straightLineDepreciation: 30000,
      })]);

      // Feed the unrecaptured 1250 into capital gains calculation
      const taxResult = calculatePreferentialRateTax(
        200000,  // taxable income
        5000,    // qualified dividends
        50000,   // total LTCG (including §1231 gain + cap gain distributions)
        FilingStatus.Single,
        form4797Result.unrecapturedSection1250Gain, // $30,000
      );

      expect(form4797Result.unrecapturedSection1250Gain).toBe(30000);
      // 25% flat on $30k = $7,500 (per Schedule D Tax Worksheet)
      expect(taxResult.section1250Tax).toBe(7500);
      expect(taxResult.preferentialTax).toBeGreaterThan(0); // remaining $20k LTCG + $5k QD
      expect(taxResult.totalTax).toBe(
        taxResult.ordinaryTax + taxResult.section1250Tax + taxResult.preferentialTax,
      );
    });

    it('form1040 integration — unrecapturedSection1250Gain on TaxReturn', () => {
      const tr = baseTaxReturn({
        income1099B: [{
          id: 'b1', brokerName: 'Fidelity', description: 'REIT Fund',
          dateSold: '2025-09-15', proceeds: 50000, costBasis: 30000, isLongTerm: true,
        }],
        unrecapturedSection1250Gain: 12000,
      });
      const result = calculateForm1040(tr);
      // Section 1250 tax should appear on the result
      expect(result.form1040.section1250Tax).toBeGreaterThan(0);
      // It should be part of incomeTax
      expect(result.form1040.incomeTax).toBeGreaterThan(0);
    });
  });
});
