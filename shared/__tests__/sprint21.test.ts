import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculateTaxableSocialSecurity } from '../src/engine/socialSecurity.js';
import { calculateEVRefuelingCredit } from '../src/engine/form8911.js';
import { FilingStatus, TaxReturn } from '../src/types/index.js';
import { SOCIAL_SECURITY, EV_REFUELING } from '../src/constants/tax2025.js';

// ─── Helper: minimal valid TaxReturn ───────────────────
function baseTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-sprint21',
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
// 21A: MFS "Lived Apart" Social Security Exception
// IRC §86(c)(1)(C)(ii), Publication 915
// ════════════════════════════════════════════════════════

describe('21A: MFS "Lived Apart" Social Security Exception', () => {
  describe('Unit tests: calculateTaxableSocialSecurity with livedApartFromSpouse', () => {
    // MFS without lived-apart: base amount = $0, always 85% taxable
    it('MFS without lived-apart flag: uses $0 base amount (85% taxable)', () => {
      const result = calculateTaxableSocialSecurity(
        12000,   // $12,000 SS benefits
        20000,   // $20,000 other income
        FilingStatus.MarriedFilingSeparately,
        0,       // no tax-exempt interest
        false,   // NOT lived apart
      );
      // Provisional income = 20,000 + 6,000 = 26,000
      // With $0 base, $0 adjusted base, everything is in 85% tier
      // Taxable = min(85% * 12,000 = 10,200, formula)
      expect(result.taxablePercentage).toBe(0.85);
      expect(result.taxableBenefits).toBe(10200); // 85% of 12,000
    });

    it('MFS with lived-apart: uses Single thresholds ($25k/$34k)', () => {
      const result = calculateTaxableSocialSecurity(
        12000,   // $12,000 SS benefits
        20000,   // $20,000 other income
        FilingStatus.MarriedFilingSeparately,
        0,
        true,    // lived apart entire year
      );
      // Provisional income = 20,000 + 6,000 = 26,000
      // Single thresholds: base = $25,000, adjusted = $34,000
      // 26,000 is between 25,000 and 34,000 → 50% tier
      // Taxable = min(50% of benefits = 6,000, 50% of (26,000 - 25,000) = 500)
      expect(result.taxablePercentage).toBe(0.50);
      expect(result.taxableBenefits).toBe(500);
    });

    it('MFS+livedApart with provisional income below Single base ($25k): $0 taxable', () => {
      const result = calculateTaxableSocialSecurity(
        1000,    // $1,000 SS benefits
        17800,   // $17,800 other income (ATS Scenario 8 — Carter Lewis)
        FilingStatus.MarriedFilingSeparately,
        0,
        true,
      );
      // Provisional income = 17,800 + 500 = 18,300
      // Single base = $25,000 → below threshold → $0 taxable
      expect(result.provisionalIncome).toBe(18300);
      expect(result.taxableBenefits).toBe(0);
      expect(result.taxablePercentage).toBe(0);
    });

    it('MFS+livedApart with provisional income above Single adjusted base ($34k): 85% tier', () => {
      const result = calculateTaxableSocialSecurity(
        24000,   // $24,000 SS benefits
        40000,   // $40,000 other income
        FilingStatus.MarriedFilingSeparately,
        0,
        true,
      );
      // Provisional income = 40,000 + 12,000 = 52,000
      // Single thresholds: base = $25,000, adjusted = $34,000
      // 52,000 > 34,000 → 85% tier
      expect(result.taxablePercentage).toBe(0.85);
      // Taxable = min(85% * 24,000 = 20,400,
      //   85% * (52,000 - 34,000) = 15,300 + min(50%*24k=12k, 50%*(34k-25k)=4500) = 15,300 + 4,500 = 19,800)
      expect(result.taxableBenefits).toBe(19800);
    });

    it('MFS default (livedApart=false): backward compatible — same as before', () => {
      const withFalse = calculateTaxableSocialSecurity(10000, 30000, FilingStatus.MarriedFilingSeparately, 0, false);
      const withDefault = calculateTaxableSocialSecurity(10000, 30000, FilingStatus.MarriedFilingSeparately, 0);
      expect(withFalse.taxableBenefits).toBe(withDefault.taxableBenefits);
      expect(withFalse.taxablePercentage).toBe(withDefault.taxablePercentage);
    });

    it('livedApart flag has no effect on Single filers', () => {
      const without = calculateTaxableSocialSecurity(10000, 30000, FilingStatus.Single, 0, false);
      const withFlag = calculateTaxableSocialSecurity(10000, 30000, FilingStatus.Single, 0, true);
      expect(without.taxableBenefits).toBe(withFlag.taxableBenefits);
    });

    it('livedApart flag has no effect on MFJ filers', () => {
      const without = calculateTaxableSocialSecurity(10000, 30000, FilingStatus.MarriedFilingJointly, 0, false);
      const withFlag = calculateTaxableSocialSecurity(10000, 30000, FilingStatus.MarriedFilingJointly, 0, true);
      expect(without.taxableBenefits).toBe(withFlag.taxableBenefits);
    });

    it('livedApart flag has no effect on HoH filers', () => {
      const without = calculateTaxableSocialSecurity(10000, 30000, FilingStatus.HeadOfHousehold, 0, false);
      const withFlag = calculateTaxableSocialSecurity(10000, 30000, FilingStatus.HeadOfHousehold, 0, true);
      expect(without.taxableBenefits).toBe(withFlag.taxableBenefits);
    });

    it('livedApart flag has no effect on QSS filers', () => {
      const without = calculateTaxableSocialSecurity(10000, 30000, FilingStatus.QualifyingSurvivingSpouse, 0, false);
      const withFlag = calculateTaxableSocialSecurity(10000, 30000, FilingStatus.QualifyingSurvivingSpouse, 0, true);
      expect(without.taxableBenefits).toBe(withFlag.taxableBenefits);
    });
  });

  describe('Integration: form1040 passes livedApartFromSpouse to SS calculation', () => {
    it('MFS return with livedApart=true uses Single SS thresholds', () => {
      const result = calculateForm1040(baseTaxReturn({
        filingStatus: FilingStatus.MarriedFilingSeparately,
        livedApartFromSpouse: true,
        w2Income: [],
        income1099R: [
          { id: '1099r-1', payerName: 'Pension', grossDistribution: 18000, taxableAmount: 17800, distributionCode: '7', federalTaxWithheld: 2000 },
        ],
        incomeSSA1099: { id: 'ssa-1', totalBenefits: 1000, federalTaxWithheld: 0 },
      }));
      // Provisional income = 17,800 + 500 = 18,300 < Single base ($25,000)
      // → $0 taxable SS
      expect(result.socialSecurity?.taxableBenefits).toBe(0);
    });

    it('MFS return without livedApart flag uses standard MFS ($0 base)', () => {
      const result = calculateForm1040(baseTaxReturn({
        filingStatus: FilingStatus.MarriedFilingSeparately,
        // livedApartFromSpouse not set (defaults to false)
        w2Income: [],
        income1099R: [
          { id: '1099r-1', payerName: 'Pension', grossDistribution: 18000, taxableAmount: 17800, distributionCode: '7', federalTaxWithheld: 2000 },
        ],
        incomeSSA1099: { id: 'ssa-1', totalBenefits: 1000, federalTaxWithheld: 0 },
      }));
      // With MFS $0 base, taxable SS = 85% of $1,000 = $850
      expect(result.socialSecurity?.taxableBenefits).toBe(850);
    });
  });
});

// ════════════════════════════════════════════════════════
// 21B: Agricultural Cooperative Patron QBI Flag
// IRC §199A(g) — QBI deduction computed by cooperative, not individual
// ════════════════════════════════════════════════════════

describe('21B: Agricultural Cooperative Patron QBI Flag', () => {
  it('patron=true suppresses QBI deduction entirely', () => {
    const result = calculateForm1040(baseTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w2-1', employerName: 'Farm Co', wages: 50000, federalTaxWithheld: 5000 }],
      business: {
        id: 'biz-1',
        businessName: 'Farm Consulting',
        accountingMethod: 'cash',
        didStartThisYear: false,
      },
      income1099NEC: [{ id: 'nec-1', payerName: 'Co-op', amount: 24328 }],
      qbiInfo: { isAgriculturalCooperativePatron: true },
    }));
    expect(result.form1040.qbiDeduction).toBe(0);
  });

  it('patron=false allows normal QBI deduction', () => {
    const result = calculateForm1040(baseTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w2-1', employerName: 'Farm Co', wages: 50000, federalTaxWithheld: 5000 }],
      business: {
        id: 'biz-1',
        businessName: 'Farm Consulting',
        accountingMethod: 'cash',
        didStartThisYear: false,
      },
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 24328 }],
      qbiInfo: { isAgriculturalCooperativePatron: false },
    }));
    // QBI = 20% of $24,328 = $4,865.60
    expect(result.form1040.qbiDeduction).toBeCloseTo(4866, 0);
  });

  it('qbiInfo undefined: backward compatible — QBI computed normally', () => {
    const result = calculateForm1040(baseTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      business: {
        id: 'biz-1',
        businessName: 'Consulting',
        accountingMethod: 'cash',
        didStartThisYear: false,
      },
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 20000 }],
      // qbiInfo not set at all
    }));
    // QBI = 20% of $20,000 = $4,000
    expect(result.form1040.qbiDeduction).toBeCloseTo(4000, 0);
  });

  it('isAgriculturalCooperativePatron undefined: backward compatible — QBI computed', () => {
    const result = calculateForm1040(baseTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      business: {
        id: 'biz-1',
        businessName: 'Consulting',
        accountingMethod: 'cash',
        didStartThisYear: false,
      },
      income1099NEC: [{ id: 'nec-1', payerName: 'Client', amount: 20000 }],
      qbiInfo: { isSSTB: false }, // isAgriculturalCooperativePatron not set
    }));
    expect(result.form1040.qbiDeduction).toBeCloseTo(4000, 0);
  });

  it('patron=true with no business income: QBI already $0, no effect', () => {
    const result = calculateForm1040(baseTaxReturn({
      filingStatus: FilingStatus.Single,
      qbiInfo: { isAgriculturalCooperativePatron: true },
    }));
    expect(result.form1040.qbiDeduction).toBe(0);
  });

  it('patron flag does not affect other deductions (SE, standard, etc.)', () => {
    const withPatron = calculateForm1040(baseTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w2-1', employerName: 'Farm Co', wages: 50000, federalTaxWithheld: 5000 }],
      business: {
        id: 'biz-1',
        businessName: 'Farm Consulting',
        accountingMethod: 'cash',
        didStartThisYear: false,
      },
      income1099NEC: [{ id: 'nec-1', payerName: 'Co-op', amount: 24328 }],
      qbiInfo: { isAgriculturalCooperativePatron: true },
    }));
    const withoutPatron = calculateForm1040(baseTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w2-1', employerName: 'Farm Co', wages: 50000, federalTaxWithheld: 5000 }],
      business: {
        id: 'biz-1',
        businessName: 'Farm Consulting',
        accountingMethod: 'cash',
        didStartThisYear: false,
      },
      income1099NEC: [{ id: 'nec-1', payerName: 'Co-op', amount: 24328 }],
      qbiInfo: { isAgriculturalCooperativePatron: false },
    }));
    // SE deduction, standard deduction, total income should be same
    expect(withPatron.form1040.totalIncome).toBe(withoutPatron.form1040.totalIncome);
    expect(withPatron.form1040.standardDeduction).toBe(withoutPatron.form1040.standardDeduction);
    expect(withPatron.form1040.seDeduction).toBe(withoutPatron.form1040.seDeduction);
    // Only QBI should differ
    expect(withPatron.form1040.qbiDeduction).toBe(0);
    expect(withoutPatron.form1040.qbiDeduction).toBeGreaterThan(0);
    // Taxable income should be higher for patron (no QBI deduction)
    expect(withPatron.form1040.taxableIncome).toBeGreaterThan(withoutPatron.form1040.taxableIncome);
  });

  it('patron=true for MFJ filing status: QBI suppressed', () => {
    const result = calculateForm1040(baseTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{ id: 'w2-1', employerName: 'Farm Co', wages: 50000, federalTaxWithheld: 5000 }],
      business: {
        id: 'biz-1',
        businessName: 'Farm Consulting',
        accountingMethod: 'cash',
        didStartThisYear: false,
      },
      income1099NEC: [{ id: 'nec-1', payerName: 'Co-op', amount: 30000 }],
      qbiInfo: { isAgriculturalCooperativePatron: true },
    }));
    expect(result.form1040.qbiDeduction).toBe(0);
  });
});

// ════════════════════════════════════════════════════════
// 21C: Form 8911 — Alternative Fuel Vehicle Refueling Property Credit
// IRC §30C, Form 8911
// ════════════════════════════════════════════════════════

describe('21C: Form 8911 (EV Refueling Property Credit)', () => {
  describe('Unit tests: calculateEVRefuelingCredit', () => {
    it('30% of cost for a single personal property', () => {
      const result = calculateEVRefuelingCredit({
        properties: [{ cost: 540 }],
      });
      // 30% of $540 = $162
      expect(result.totalCredit).toBe(162);
      expect(result.totalCost).toBe(540);
      expect(result.propertyResults).toHaveLength(1);
      expect(result.propertyResults[0].credit).toBe(162);
    });

    it('personal property cap: $1,000 per property', () => {
      const result = calculateEVRefuelingCredit({
        properties: [{ cost: 5000 }],
      });
      // 30% of $5,000 = $1,500, but capped at $1,000
      expect(result.totalCredit).toBe(EV_REFUELING.PERSONAL_CAP);
      expect(result.propertyResults[0].credit).toBe(1000);
    });

    it('cost exactly at personal cap breakpoint ($3,333.33)', () => {
      const result = calculateEVRefuelingCredit({
        properties: [{ cost: 3333.33 }],
      });
      // 30% of $3,333.33 = $999.999 → $1,000.00
      expect(result.totalCredit).toBe(1000);
    });

    it('multiple personal properties: per-property caps', () => {
      const result = calculateEVRefuelingCredit({
        properties: [
          { cost: 540 },   // 30% = $162
          { cost: 6000 },  // 30% = $1,800, capped at $1,000
          { cost: 1000 },  // 30% = $300
        ],
      });
      expect(result.totalCredit).toBe(162 + 1000 + 300); // $1,462
      expect(result.propertyResults).toHaveLength(3);
      expect(result.propertyResults[0].credit).toBe(162);
      expect(result.propertyResults[1].credit).toBe(1000);
      expect(result.propertyResults[2].credit).toBe(300);
    });

    it('business use property: $100,000 cap', () => {
      const result = calculateEVRefuelingCredit({
        properties: [{ cost: 200000, isBusinessUse: true }],
      });
      // 30% of $200,000 = $60,000 — under $100k cap
      expect(result.totalCredit).toBe(60000);
    });

    it('business use property at cap: 30% of $400k = $120k, capped at $100k', () => {
      const result = calculateEVRefuelingCredit({
        properties: [{ cost: 400000, isBusinessUse: true }],
      });
      expect(result.totalCredit).toBe(100000);
    });

    it('mixed personal and business properties', () => {
      const result = calculateEVRefuelingCredit({
        properties: [
          { cost: 540 },                       // personal: 30% = $162
          { cost: 50000, isBusinessUse: true }, // business: 30% = $15,000
        ],
      });
      expect(result.totalCredit).toBe(162 + 15000); // $15,162
    });

    it('zero cost property: $0 credit', () => {
      const result = calculateEVRefuelingCredit({
        properties: [{ cost: 0 }],
      });
      expect(result.totalCredit).toBe(0);
    });

    it('negative cost is clamped to 0', () => {
      const result = calculateEVRefuelingCredit({
        properties: [{ cost: -500 }],
      });
      expect(result.totalCredit).toBe(0);
    });

    it('empty properties array: zero result', () => {
      const result = calculateEVRefuelingCredit({ properties: [] });
      expect(result.totalCredit).toBe(0);
      expect(result.propertyResults).toHaveLength(0);
    });

    it('null/undefined info: zero result', () => {
      const result = calculateEVRefuelingCredit(undefined as any);
      expect(result.totalCredit).toBe(0);
    });

    it('constants match IRC §30C values', () => {
      expect(EV_REFUELING.CREDIT_RATE).toBe(0.30);
      expect(EV_REFUELING.PERSONAL_CAP).toBe(1000);
      expect(EV_REFUELING.BUSINESS_CAP).toBe(100000);
    });
  });

  describe('Integration: Form 8911 wired into form1040', () => {
    it('EV refueling credit reduces total tax (non-refundable)', () => {
      const result = calculateForm1040(baseTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        w2Income: [{ id: 'w2-1', employerName: 'Employer', wages: 31620, federalTaxWithheld: 609 }],
        evRefuelingCredit: {
          properties: [{ cost: 540 }], // 30% = $162 credit
        },
      }));
      // AGI = 31,620, Standard deduction = 31,500, Taxable = 120
      // Tax at 10% = $12, Credit available = $162 but limited to tax → $12
      expect(result.credits.evRefuelingCredit).toBeLessThanOrEqual(162);
      expect(result.form1040.incomeTax).toBe(12);
      // Non-refundable credit reduces income tax portion to 0
      // taxAfterCredits corresponds to IRS Form 1040 Line 24 "Total Tax"
      expect(result.form1040.taxAfterCredits).toBe(0);
    });

    it('no EV refueling data: credit is $0 (backward compat)', () => {
      const result = calculateForm1040(baseTaxReturn());
      expect(result.credits.evRefuelingCredit).toBe(0);
      expect(result.evRefuelingCredit).toBeUndefined();
    });

    it('non-refundable: credit cannot create a refund on its own', () => {
      // Scenario: $0 income tax, $500 EV refueling credit → credit capped at $0 tax
      const result = calculateForm1040(baseTaxReturn({
        filingStatus: FilingStatus.MarriedFilingJointly,
        w2Income: [{ id: 'w2-1', employerName: 'Employer', wages: 25000, federalTaxWithheld: 0 }],
        evRefuelingCredit: {
          properties: [{ cost: 5000 }], // 30% = $1,500 → capped at $1,000
        },
      }));
      // AGI = 25,000, Std ded = 30,000, Taxable = $0 → income tax = $0
      // Non-refundable credit can't push below $0
      expect(result.form1040.incomeTax).toBe(0);
      expect(result.form1040.totalTax).toBe(0);
      // Credit is computed but doesn't affect anything since tax is already $0
      expect(result.credits.evRefuelingCredit).toBe(1000);
    });

    it('EV refueling credit flows to CalculationResult', () => {
      const result = calculateForm1040(baseTaxReturn({
        evRefuelingCredit: {
          properties: [{ cost: 2000 }], // 30% = $600
        },
      }));
      expect(result.evRefuelingCredit).toBeDefined();
      expect(result.evRefuelingCredit!.totalCredit).toBe(600);
      expect(result.evRefuelingCredit!.totalCost).toBe(2000);
    });

    it('multiple EV refueling properties with per-property caps', () => {
      const result = calculateForm1040(baseTaxReturn({
        evRefuelingCredit: {
          properties: [
            { cost: 540 },   // $162
            { cost: 10000 }, // $1,000 (capped)
          ],
        },
      }));
      expect(result.evRefuelingCredit!.totalCredit).toBe(1162);
      expect(result.credits.evRefuelingCredit).toBe(1162);
    });
  });
});
