import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { calculatePreferentialRateTax } from '../src/engine/capitalGains.js';
import { calculateNIIT } from '../src/engine/niit.js';
import { calculateAdditionalMedicareTaxW2 } from '../src/engine/additionalMedicare.js';
import { calculateCredits } from '../src/engine/credits.js';
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

// ─── Sprint 2A: Preferential Rates for Qualified Dividends & LTCG ──

describe('Sprint 2A — Preferential Rates (0%/15%/20%)', () => {
  describe('calculatePreferentialRateTax (unit)', () => {
    it('taxes qualified dividends at 0% when below threshold (Single)', () => {
      // Single: 0% threshold = $48,350
      // Taxable income = $40,000, all from qualified dividends
      // Ordinary = $0, preferential = $40,000 — all in 0% zone
      const result = calculatePreferentialRateTax(40000, 40000, 0, FilingStatus.Single);
      expect(result.ordinaryTax).toBe(0);
      expect(result.preferentialTax).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it('taxes qualified dividends at 15% when in mid range (Single)', () => {
      // Single: 0% threshold = $48,350, 15% threshold = $533,400
      // Taxable income = $100,000
      // $20,000 ordinary + $80,000 qualified dividends
      // Ordinary = $20,000 at progressive rates
      // QD: starts at $20,000, 0% zone up to $48,350 → $28,350 at 0%
      //   15% zone from $48,350 to $100,000 → $51,650 at 15%
      const result = calculatePreferentialRateTax(100000, 80000, 0, FilingStatus.Single);
      expect(result.ordinaryTax).toBeGreaterThan(0);
      expect(result.preferentialTax).toBeCloseTo(51650 * 0.15, 0);
      expect(result.totalTax).toBe(result.ordinaryTax + result.preferentialTax);
    });

    it('taxes at 20% when above the 15% threshold (Single)', () => {
      // Single: 15% threshold = $533,400
      // Taxable income = $600,000, $100,000 qualified dividends
      // Ordinary = $500,000
      // QD starts at $500,000 — in 15% zone up to $533,400 → $33,400 at 15%
      //   20% zone from $533,400 to $600,000 → $66,600 at 20%
      const result = calculatePreferentialRateTax(600000, 100000, 0, FilingStatus.Single);
      const expected15 = 33400 * 0.15;
      const expected20 = 66600 * 0.20;
      expect(result.preferentialTax).toBeCloseTo(expected15 + expected20, 0);
    });

    it('falls back to progressive tax when no preferential income', () => {
      const result = calculatePreferentialRateTax(50000, 0, 0, FilingStatus.Single);
      expect(result.preferentialTax).toBe(0);
      expect(result.ordinaryTax).toBeGreaterThan(0);
      expect(result.totalTax).toBe(result.ordinaryTax);
    });

    it('caps preferential income to taxable income', () => {
      // If someone reports $50k in QD but only has $30k taxable income
      const result = calculatePreferentialRateTax(30000, 50000, 0, FilingStatus.Single);
      // All $30k should be preferential at 0%
      expect(result.ordinaryTax).toBe(0);
      expect(result.preferentialTax).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it('handles MFJ 0% threshold correctly', () => {
      // MFJ: 0% threshold = $96,700
      // $90,000 taxable, all qualified dividends → all at 0%
      const result = calculatePreferentialRateTax(90000, 90000, 0, FilingStatus.MarriedFilingJointly);
      expect(result.preferentialTax).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it('handles capital gain distributions alongside qualified dividends', () => {
      // $80,000 taxable: $50,000 ordinary, $20,000 QD, $10,000 cap gain distributions
      const result = calculatePreferentialRateTax(80000, 20000, 10000, FilingStatus.Single);
      // Preferential total: $30,000, starts at $50,000
      // In 0% zone: $48,350 - $50,000 = nah, $50k is above $48,350
      // So all $30k is in 15% zone (starts at $50k, ends at $80k, threshold at $533k)
      expect(result.preferentialTax).toBeCloseTo(30000 * 0.15, 0);
    });

    it('returns zero for zero taxable income', () => {
      const result = calculatePreferentialRateTax(0, 5000, 0, FilingStatus.Single);
      expect(result.totalTax).toBe(0);
    });
  });

  describe('integration with form1040', () => {
    it('reduces tax via preferential rates compared to ordinary rates', () => {
      // Single filer, $80k wages, $20k qualified dividends
      // With preferential rates: QD taxed at 0%/15% instead of 22%+
      const trWithQD = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: 'w1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
        income1099DIV: [{
          id: 'd1', payerName: 'Fund', ordinaryDividends: 20000, qualifiedDividends: 20000,
        }],
      });
      const resultQD = calculateForm1040(trWithQD).form1040;

      // Compare with same income but zero qualified dividends (all ordinary)
      const trNoQD = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: 'w1', employerName: 'Acme', wages: 80000, federalTaxWithheld: 10000 }],
        income1099DIV: [{
          id: 'd1', payerName: 'Fund', ordinaryDividends: 20000, qualifiedDividends: 0,
        }],
      });
      const resultNoQD = calculateForm1040(trNoQD).form1040;

      // Same total income, but QD filer should pay less income tax
      expect(resultQD.totalIncome).toBe(resultNoQD.totalIncome);
      expect(resultQD.incomeTax).toBeLessThan(resultNoQD.incomeTax);
      expect(resultQD.preferentialTax).toBeGreaterThan(0);
      expect(resultNoQD.preferentialTax).toBe(0);
    });
  });
});

// ─── Sprint 2B: Net Investment Income Tax (NIIT) ──────────────

describe('Sprint 2B — Net Investment Income Tax (NIIT)', () => {
  describe('calculateNIIT (unit)', () => {
    it('charges 3.8% when AGI exceeds threshold (Single)', () => {
      // Single threshold: $200,000
      // AGI = $250,000, investment income = $30,000
      // AGI excess = $50,000
      // NIIT = 3.8% × min($30,000, $50,000) = 3.8% × $30,000 = $1,140
      expect(calculateNIIT(250000, 30000, FilingStatus.Single)).toBeCloseTo(1140, 2);
    });

    it('uses AGI excess when less than investment income', () => {
      // AGI = $220,000, investment income = $50,000
      // AGI excess = $20,000
      // NIIT = 3.8% × $20,000 = $760
      expect(calculateNIIT(220000, 50000, FilingStatus.Single)).toBeCloseTo(760, 2);
    });

    it('returns $0 when AGI is below threshold', () => {
      expect(calculateNIIT(180000, 30000, FilingStatus.Single)).toBe(0);
    });

    it('returns $0 when AGI equals threshold', () => {
      expect(calculateNIIT(200000, 30000, FilingStatus.Single)).toBe(0);
    });

    it('returns $0 when no investment income', () => {
      expect(calculateNIIT(300000, 0, FilingStatus.Single)).toBe(0);
    });

    it('uses MFJ threshold ($250,000)', () => {
      // MFJ threshold: $250,000
      // AGI = $280,000, investment = $20,000
      // Excess = $30,000, NIIT = 3.8% × $20,000 = $760
      expect(calculateNIIT(280000, 20000, FilingStatus.MarriedFilingJointly)).toBeCloseTo(760, 2);
    });

    it('uses MFS threshold ($125,000)', () => {
      // MFS threshold: $125,000
      // AGI = $150,000, investment = $40,000
      // Excess = $25,000, NIIT = 3.8% × $25,000 = $950
      expect(calculateNIIT(150000, 40000, FilingStatus.MarriedFilingSeparately)).toBeCloseTo(950, 2);
    });

    it('uses HoH threshold ($200,000)', () => {
      expect(calculateNIIT(250000, 30000, FilingStatus.HeadOfHousehold)).toBeCloseTo(1140, 2);
    });
  });

  describe('integration with form1040', () => {
    it('adds NIIT to total tax for high-income investor', () => {
      // Single, $250k wages, $30k dividends
      // AGI well above $200k threshold
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: 'w1', employerName: 'Acme', wages: 250000, federalTaxWithheld: 50000 }],
        income1099DIV: [{
          id: 'd1', payerName: 'Fund', ordinaryDividends: 30000, qualifiedDividends: 20000,
        }],
      });
      const f = calculateForm1040(tr).form1040;
      expect(f.niitTax).toBeGreaterThan(0);
      expect(f.totalTax).toBeGreaterThan(f.incomeTax + f.seTax);
    });

    it('no NIIT for filer below threshold', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{ id: 'w1', employerName: 'Acme', wages: 100000, federalTaxWithheld: 15000 }],
        income1099DIV: [{
          id: 'd1', payerName: 'Fund', ordinaryDividends: 5000, qualifiedDividends: 3000,
        }],
      });
      const f = calculateForm1040(tr).form1040;
      expect(f.niitTax).toBe(0);
    });
  });
});

// ─── Sprint 2C: Additional Medicare Tax on W-2 Wages ──────────

describe('Sprint 2C — Additional Medicare Tax on W-2 (Form 8959)', () => {
  describe('calculateAdditionalMedicareTaxW2 (unit)', () => {
    it('charges 0.9% on wages above $200k threshold (Single)', () => {
      // Single: threshold $200,000
      // $250,000 wages, no SE income
      // Additional Medicare = 0.9% × ($250,000 - $200,000) = $450
      expect(calculateAdditionalMedicareTaxW2(250000, 0, FilingStatus.Single)).toBeCloseTo(450, 2);
    });

    it('returns $0 when wages below threshold', () => {
      expect(calculateAdditionalMedicareTaxW2(180000, 0, FilingStatus.Single)).toBe(0);
    });

    it('uses MFJ threshold ($250,000)', () => {
      // MFJ: $300,000 wages, no SE
      // Additional Medicare = 0.9% × ($300,000 - $250,000) = $450
      expect(calculateAdditionalMedicareTaxW2(300000, 0, FilingStatus.MarriedFilingJointly)).toBeCloseTo(450, 2);
    });

    it('uses MFS threshold ($125,000)', () => {
      // MFS: $175,000 wages, no SE
      // Additional Medicare = 0.9% × ($175,000 - $125,000) = $450
      expect(calculateAdditionalMedicareTaxW2(175000, 0, FilingStatus.MarriedFilingSeparately)).toBeCloseTo(450, 2);
    });

    it('coordinates with SE Additional Medicare to avoid double-counting', () => {
      // $150,000 W-2 wages + $100,000 SE net earnings = $250,000 combined
      // Single threshold: $200,000
      // Total combined Additional Medicare: 0.9% × ($250,000 - $200,000) = $450
      // SE Additional Medicare (computed in scheduleSE): 0.9% × max(0, $100,000 - $200,000) = $0
      // W-2 portion: $450 - $0 = $450
      expect(calculateAdditionalMedicareTaxW2(150000, 100000, FilingStatus.Single)).toBeCloseTo(450, 2);
    });

    it('handles case where SE alone exceeds threshold', () => {
      // $50,000 W-2 wages + $300,000 SE net earnings = $350,000 combined
      // Single threshold: $200,000
      // Total combined: 0.9% × ($350,000 - $200,000) = $1,350
      // SE Additional Medicare: 0.9% × ($300,000 - $200,000) = $900
      // W-2 portion: $1,350 - $900 = $450
      expect(calculateAdditionalMedicareTaxW2(50000, 300000, FilingStatus.Single)).toBeCloseTo(450, 2);
    });

    it('returns $0 when no W-2 wages', () => {
      expect(calculateAdditionalMedicareTaxW2(0, 300000, FilingStatus.Single)).toBe(0);
    });
  });

  describe('integration with form1040', () => {
    it('adds Additional Medicare to total tax for high-wage earner', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{
          id: 'w1', employerName: 'Corp', wages: 250000,
          federalTaxWithheld: 50000, medicareWages: 250000,
        }],
      });
      const f = calculateForm1040(tr).form1040;
      // 0.9% × ($250,000 - $200,000) = $450
      expect(f.additionalMedicareTaxW2).toBeCloseTo(450, 2);
      expect(f.totalTax).toBeGreaterThan(f.incomeTax);
    });

    it('no Additional Medicare for filer below threshold', () => {
      const tr = makeTaxReturn({
        filingStatus: FilingStatus.Single,
        w2Income: [{
          id: 'w1', employerName: 'Corp', wages: 100000,
          federalTaxWithheld: 15000, medicareWages: 100000,
        }],
      });
      const f = calculateForm1040(tr).form1040;
      expect(f.additionalMedicareTaxW2).toBe(0);
    });
  });
});

// ─── Sprint 2D: ACTC (Additional Child Tax Credit) ────────────

describe('Sprint 2D — ACTC (Refundable CTC Portion)', () => {
  it('grants ACTC when CTC exceeds income tax liability', () => {
    // Low-income single parent, $25,000 wages, 1 qualifying child
    // Taxable income: $25,000 - $15,750 standard = $9,250
    // Income tax on $9,250: ~$925 (10% bracket)
    // CTC: $2,200 — exceeds income tax
    // Excess CTC: $2,200 - $925 = $1,275
    // Earned income formula: 15% × ($25,000 - $2,500) = $3,375
    // Max refundable: $1,700
    // ACTC = min($1,000, $1,700, $3,375) = $1,000
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 25000, federalTaxWithheld: 2000 }],
      childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 },
    });
    const result = calculateForm1040(tr);
    expect(result.credits.actcCredit).toBeGreaterThan(0);
    // Refund should be larger because of ACTC
    expect(result.credits.totalRefundable).toBeGreaterThan(0);
  });

  it('grants $0 ACTC when income tax fully absorbs CTC', () => {
    // High-income filer — income tax is well above CTC, no excess
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 200000, federalTaxWithheld: 40000 }],
      childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 },
    });
    const result = calculateForm1040(tr);
    expect(result.credits.actcCredit).toBe(0);
  });

  it('limits ACTC by earned income formula', () => {
    // Very low income — earned income formula limits the refund
    // $5,000 wages, 1 child
    // Taxable: max(0, $5,000 - $15,750) = $0
    // Income tax: $0
    // CTC: $2,200, excess CTC = $2,200
    // Earned income formula: 15% × ($5,000 - $2,500) = $375
    // Max refundable: $1,700
    // ACTC = min($2,200, $1,700, $375) = $375
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 5000, federalTaxWithheld: 0 }],
      childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 },
    });
    const result = calculateForm1040(tr);
    expect(result.credits.actcCredit).toBeCloseTo(375, 0);
  });

  it('limits ACTC to $1,700 per child', () => {
    // $20,000 wages, 1 child
    // Taxable: $4,250 ($20k - $15,750 standard)
    // Income tax: ~$425
    // CTC: $2,200, excess = ~$1,775
    // Earned income formula: 15% × ($20,000 - $2,500) = $2,625
    // Max refundable: 1 × $1,700 = $1,700
    // ACTC = min(~$1,500, $1,700, $2,625) = ~$1,500
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 20000, federalTaxWithheld: 1500 }],
      childTaxCredit: { qualifyingChildren: 1, otherDependents: 0 },
    });
    const result = calculateForm1040(tr);
    expect(result.credits.actcCredit).toBeGreaterThan(0);
    expect(result.credits.actcCredit).toBeLessThanOrEqual(1700);
  });

  it('grants $0 ACTC with zero qualifying children', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 25000, federalTaxWithheld: 2000 }],
      childTaxCredit: { qualifyingChildren: 0, otherDependents: 1 },
    });
    const result = calculateForm1040(tr);
    expect(result.credits.actcCredit).toBe(0);
  });

  it('multiple children increase max refundable', () => {
    // $15,000 wages, 3 children
    // Taxable: $0
    // Income tax: $0
    // CTC: $6,600, excess = $6,600
    // Earned income formula: 15% × ($15,000 - $2,500) = $1,875
    // Max refundable: 3 × $1,700 = $5,100
    // ACTC = min($6,600, $5,100, $1,875) = $1,875
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 15000, federalTaxWithheld: 0 }],
      childTaxCredit: { qualifyingChildren: 3, otherDependents: 0 },
    });
    const result = calculateForm1040(tr);
    expect(result.credits.actcCredit).toBeCloseTo(1875, 0);
  });
});

// ─── Sprint 2E: AOTC Refundable Portion (40%) ────────────────

describe('Sprint 2E — AOTC Refundable Portion (40%)', () => {
  it('splits AOTC into 60% non-refundable and 40% refundable', () => {
    // $4,000+ tuition → max AOTC = $2,500
    // Non-refundable: 60% × $2,500 = $1,500
    // Refundable: 40% × $2,500 = $1,000
    const result = calculateCredits(
      FilingStatus.Single,
      50000,
      undefined,
      [{
        id: 'e1', type: 'american_opportunity', studentName: 'Student',
        institution: 'University', tuitionPaid: 5000,
      }],
    );
    expect(result.educationCredit).toBe(1500); // non-refundable portion
    expect(result.aotcRefundableCredit).toBe(1000); // refundable portion
    expect(result.totalNonRefundable).toBe(1500);
    expect(result.totalRefundable).toBe(1000);
  });

  it('zero-liability filer still gets refundable AOTC', () => {
    // $10,000 wages, $4,000+ tuition
    // Taxable: $0 (under standard deduction)
    // Income tax: $0
    // Can't use $1,500 non-refundable
    // But gets $1,000 refundable AOTC
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 10000, federalTaxWithheld: 500 }],
      educationCredits: [{
        id: 'e1', type: 'american_opportunity', studentName: 'Student',
        institution: 'University', tuitionPaid: 5000,
      }],
    });
    const result = calculateForm1040(tr);
    expect(result.credits.aotcRefundableCredit).toBe(1000);
    // Should get a refund from the refundable portion
    expect(result.form1040.refundAmount).toBeGreaterThan(0);
  });

  it('LLC credit has no refundable portion', () => {
    const result = calculateCredits(
      FilingStatus.Single,
      50000,
      undefined,
      [{
        id: 'e1', type: 'lifetime_learning', studentName: 'Student',
        institution: 'University', tuitionPaid: 5000,
      }],
    );
    expect(result.educationCredit).toBe(1000); // 20% of $5000, max $2000 → $1000
    expect(result.aotcRefundableCredit).toBe(0);
    expect(result.totalRefundable).toBe(0);
  });

  it('phases out AOTC proportionally (both refundable and non-refundable)', () => {
    // Single phase-out: starts at $80,000, range $10,000
    // AGI = $85,000 → 50% phase-out
    // Full AOTC: $2,500 → after phase-out: $1,250
    // Non-refundable: 60% × $1,250 = $750
    // Refundable: 40% × $1,250 = $500
    const result = calculateCredits(
      FilingStatus.Single,
      85000,
      undefined,
      [{
        id: 'e1', type: 'american_opportunity', studentName: 'Student',
        institution: 'University', tuitionPaid: 5000,
      }],
    );
    expect(result.educationCredit).toBe(750);
    expect(result.aotcRefundableCredit).toBe(500);
  });
});

// ─── Sprint 2F: 1099-R Early Distribution Penalty ─────────────

describe('Sprint 2F — 1099-R Early Distribution Penalty', () => {
  it('applies 10% penalty for code 1 (early, no exception)', () => {
    // Code 1: $10,000 taxable → 10% penalty = $1,000
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099R: [{
        id: 'r1', payerName: '401k Plan', grossDistribution: 10000,
        taxableAmount: 10000, distributionCode: '1',
      }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.earlyDistributionPenalty).toBe(1000);
  });

  it('no penalty for code 2 (early, exception applies)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099R: [{
        id: 'r1', payerName: '401k Plan', grossDistribution: 10000,
        taxableAmount: 10000, distributionCode: '2',
      }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.earlyDistributionPenalty).toBe(0);
  });

  it('no penalty for code 7 (normal distribution)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099R: [{
        id: 'r1', payerName: 'IRA', grossDistribution: 15000,
        taxableAmount: 15000, distributionCode: '7',
      }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.earlyDistributionPenalty).toBe(0);
  });

  it('no penalty for code G (rollover)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099R: [{
        id: 'r1', payerName: '401k', grossDistribution: 50000,
        taxableAmount: 0, distributionCode: 'G',
      }],
    });
    const f = calculateForm1040(tr).form1040;
    expect(f.earlyDistributionPenalty).toBe(0);
    expect(f.totalRetirementIncome).toBe(0); // rollovers are excluded from income
  });

  it('sums penalties from multiple early distributions', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099R: [
        { id: 'r1', payerName: 'Plan A', grossDistribution: 10000, taxableAmount: 10000, distributionCode: '1' },
        { id: 'r2', payerName: 'Plan B', grossDistribution: 5000, taxableAmount: 5000, distributionCode: '1' },
        { id: 'r3', payerName: 'IRA', grossDistribution: 20000, taxableAmount: 20000, distributionCode: '7' }, // normal, no penalty
      ],
    });
    const f = calculateForm1040(tr).form1040;
    // 10% of $10,000 + 10% of $5,000 = $1,500
    expect(f.earlyDistributionPenalty).toBe(1500);
    // Total retirement income: $10,000 + $5,000 + $20,000 = $35,000
    expect(f.totalRetirementIncome).toBe(35000);
  });

  it('penalty is added to total tax and affects amount owed', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000 }],
      income1099R: [{
        id: 'r1', payerName: '401k', grossDistribution: 20000,
        taxableAmount: 20000, distributionCode: '1',
      }],
    });
    const f = calculateForm1040(tr).form1040;
    // Penalty increases total tax
    expect(f.totalTax).toBe(f.incomeTax + f.seTax + f.niitTax + f.additionalMedicareTaxW2 + f.earlyDistributionPenalty);
    expect(f.earlyDistributionPenalty).toBe(2000);
  });
});

// ─── Sprint 2 Integration: Combined High-Income Scenario ──────

describe('Sprint 2 Integration — Combined Scenarios', () => {
  it('high-income investor: preferential rates + NIIT + Additional Medicare', () => {
    // MFJ: $300k wages, $50k ordinary dividends ($40k qualified), $10k cap gain distributions, $20k interest
    // Total income: $300k + $50k + $10k + $20k = $380k
    // AGI: $380k (no adjustments)
    //
    // NIIT: investment income = $20k + $50k + $10k = $80k
    //   AGI excess over $250k threshold: $130k
    //   NIIT = 3.8% × min($80k, $130k) = 3.8% × $80k = $3,040
    //
    // Additional Medicare: wages $300k, MFJ threshold $250k
    //   0.9% × $50k = $450
    //
    // Preferential: $40k QD + $10k cap gains = $50k at preferential rates
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{
        id: 'w1', employerName: 'Corp', wages: 300000,
        federalTaxWithheld: 60000, medicareWages: 300000,
      }],
      income1099DIV: [{
        id: 'd1', payerName: 'Fund', ordinaryDividends: 50000,
        qualifiedDividends: 40000, capitalGainDistributions: 10000,
      }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 20000 }],
    });
    const f = calculateForm1040(tr).form1040;

    expect(f.totalIncome).toBe(380000);
    expect(f.niitTax).toBeCloseTo(3040, 0);
    expect(f.additionalMedicareTaxW2).toBeCloseTo(450, 0);
    expect(f.preferentialTax).toBeGreaterThan(0);
    // Total tax includes income tax + NIIT + Additional Medicare
    expect(f.totalTax).toBe(
      f.incomeTax + f.seTax + f.niitTax + f.additionalMedicareTaxW2 + f.earlyDistributionPenalty,
    );
  });

  it('low-income family: ACTC + AOTC refundable create a refund', () => {
    // Single parent, $20,000 wages, 2 children, 1 in college
    // Standard deduction: $15,750
    // Taxable: $4,250
    // Income tax: ~$425
    // CTC: 2 × $2,200 = $4,400 (non-refundable)
    // AOTC: $2,500 → $1,500 non-refundable + $1,000 refundable
    //
    // Non-refundable total: $4,000 + $1,500 = $5,500
    // Applied to $500 income tax → reduces to $0, but $5,000 unused
    //
    // ACTC: excess CTC = $4,000 - min($4,000, $500 - $1,500 other non-ref ... complex)
    //   Let's just verify the refund exists
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 20000, federalTaxWithheld: 1500 }],
      childTaxCredit: { qualifyingChildren: 2, otherDependents: 0 },
      educationCredits: [{
        id: 'e1', type: 'american_opportunity', studentName: 'Kid A',
        institution: 'CC', tuitionPaid: 5000,
      }],
    });
    const result = calculateForm1040(tr);
    const f = result.form1040;

    // Should have both ACTC and AOTC refundable
    expect(result.credits.actcCredit).toBeGreaterThan(0);
    expect(result.credits.aotcRefundableCredit).toBe(1000);
    expect(result.credits.totalRefundable).toBeGreaterThan(1000); // ACTC + AOTC refundable

    // Should get a refund (withholding + refundable credits > tax)
    expect(f.refundAmount).toBeGreaterThan(0);
  });

  it('early retirement withdrawal with penalty and preferential dividends', () => {
    // Single, $40k wages, $15k early 1099-R (code 1), $10k qualified dividends
    // Early distribution penalty: 10% × $15,000 = $1,500
    // Preferential: $10k QD at favorable rates
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Acme', wages: 40000, federalTaxWithheld: 5000 }],
      income1099R: [{
        id: 'r1', payerName: '401k', grossDistribution: 15000,
        taxableAmount: 15000, distributionCode: '1',
      }],
      income1099DIV: [{
        id: 'd1', payerName: 'Fund', ordinaryDividends: 10000, qualifiedDividends: 10000,
      }],
    });
    const f = calculateForm1040(tr).form1040;

    expect(f.totalRetirementIncome).toBe(15000);
    expect(f.earlyDistributionPenalty).toBe(1500);
    expect(f.preferentialTax).toBeGreaterThan(0); // QD taxed at preferential rates
    expect(f.totalTax).toBe(f.incomeTax + f.seTax + f.niitTax + f.additionalMedicareTaxW2 + 1500);
  });
});
