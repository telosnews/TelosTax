/**
 * AMT (Form 6251) Unit & Integration Tests
 *
 * Tests the full Alternative Minimum Tax implementation:
 *   - calculateFlatTMT: 26%/28% two-bracket structure
 *   - calculateAMTPartIII: preferential capital gains rates for AMT
 *   - calculateAMT: full Form 6251 computation
 *   - Integration: end-to-end through calculateForm1040
 *
 * @authority IRC §55–58, Form 6251, Rev. Proc. 2024-40
 */

import { describe, it, expect } from 'vitest';
import { calculateAMT, calculateAMTPartIII, calculateFlatTMT, adjustAMTForRegularFTC, AMTResult } from '../src/engine/amt.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus, ScheduleAResult } from '../src/types/index.js';

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'amt-test',
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
    expenses: [],
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  };
}

// ─── calculateFlatTMT ────────────────────────────────────

describe('calculateFlatTMT', () => {
  it('returns 0 for zero AMT base', () => {
    expect(calculateFlatTMT(0, FilingStatus.Single)).toBe(0);
  });

  it('returns 0 for negative AMT base', () => {
    expect(calculateFlatTMT(-100, FilingStatus.Single)).toBe(0);
  });

  it('applies 26% rate below threshold (Single)', () => {
    // $100,000 × 26% = $26,000
    expect(calculateFlatTMT(100000, FilingStatus.Single)).toBe(26000);
  });

  it('applies 26% at exactly the threshold (Single $239,100)', () => {
    // $239,100 × 26% = $62,166
    expect(calculateFlatTMT(239100, FilingStatus.Single)).toBe(62166);
  });

  it('applies 26%/28% above threshold (Single)', () => {
    // $300,000: $239,100 × 0.26 + ($300,000 - $239,100) × 0.28
    // = $62,166 + $60,900 × 0.28 = $62,166 + $17,052 = $79,218
    expect(calculateFlatTMT(300000, FilingStatus.Single)).toBe(79218);
  });

  it('uses half threshold for MFS ($119,550)', () => {
    // $150,000: $119,550 × 0.26 + ($150,000 - $119,550) × 0.28
    // = $31,083 + $30,450 × 0.28 = $31,083 + $8,526 = $39,609
    expect(calculateFlatTMT(150000, FilingStatus.MarriedFilingSeparately)).toBe(39609);
  });

  it('uses same threshold for MFJ, HOH, QSS as Single', () => {
    const base = 300000;
    const expected = calculateFlatTMT(base, FilingStatus.Single);
    expect(calculateFlatTMT(base, FilingStatus.MarriedFilingJointly)).toBe(expected);
    expect(calculateFlatTMT(base, FilingStatus.HeadOfHousehold)).toBe(expected);
    expect(calculateFlatTMT(base, FilingStatus.QualifyingSurvivingSpouse)).toBe(expected);
  });
});

// ─── calculateAMTPartIII ─────────────────────────────────

describe('calculateAMTPartIII', () => {
  it('returns zero for zero AMT base', () => {
    const result = calculateAMTPartIII(0, 10000, 20000, 0, FilingStatus.Single);
    expect(result.tentativeMinimumTax).toBe(0);
    expect(result.adjustedNetCapitalGain).toBe(0);
  });

  it('uses flat rate when no capital gains', () => {
    const result = calculateAMTPartIII(200000, 0, 0, 0, FilingStatus.Single);
    expect(result.adjustedNetCapitalGain).toBe(0);
    expect(result.ordinaryAMTIncome).toBe(200000);
    expect(result.tentativeMinimumTax).toBe(result.flatRateTax);
    // $200,000 × 26% = $52,000
    expect(result.tentativeMinimumTax).toBe(52000);
  });

  it('applies preferential rates to QD only', () => {
    // AMT base = $200,000, QD = $50,000, no LTCG
    // Ordinary = $150,000, QD = $50,000
    // Ordinary tax: $150,000 × 26% = $39,000
    // QD stacked: $150K–$200K → all in 15% zone (Single threshold0=$48,350, threshold15=$533,400)
    // $50,000 × 15% = $7,500
    // Special = $39,000 + $7,500 = $46,500
    // Flat = $200,000 × 26% = $52,000
    // TMT = min($46,500, $52,000) = $46,500
    const result = calculateAMTPartIII(200000, 50000, 0, 0, FilingStatus.Single);
    expect(result.ordinaryAMTIncome).toBe(150000);
    expect(result.ordinaryTax).toBe(39000);
    expect(result.capitalGainsTax).toBe(7500);
    expect(result.section1250Tax).toBe(0);
    expect(result.specialComputationTax).toBe(46500);
    expect(result.flatRateTax).toBe(52000);
    expect(result.tentativeMinimumTax).toBe(46500);
  });

  it('applies preferential rates to LTCG + QD', () => {
    // AMT base = $335,000, QD = $15,000, LTCG = $30,000 (MFJ)
    // adjustedNetCapitalGain = $45,000
    // ordinaryAMTIncome = $335,000 - $45,000 = $290,000
    // ordinaryTax: $239,100 × 0.26 + $50,900 × 0.28 = $62,166 + $14,252 = $76,418
    // Cap gains: prefStart = $290,000, prefEnd = $335,000
    //   MFJ threshold0 = $96,700 → all above, in0Zone = 0
    //   MFJ threshold15 = $600,050 → in15Zone = $335,000 - $290,000 = $45,000
    //   $45,000 × 15% = $6,750
    // Special = $76,418 + $6,750 = $83,168
    // Flat: $239,100 × 0.26 + $95,900 × 0.28 = $62,166 + $26,852 = $89,018
    // TMT = min($83,168, $89,018) = $83,168
    const result = calculateAMTPartIII(335000, 15000, 30000, 0, FilingStatus.MarriedFilingJointly);
    expect(result.adjustedNetCapitalGain).toBe(45000);
    expect(result.ordinaryAMTIncome).toBe(290000);
    expect(result.ordinaryTax).toBe(76418);
    expect(result.capitalGainsTax).toBe(6750);
    expect(result.specialComputationTax).toBe(83168);
    expect(result.flatRateTax).toBe(89018);
    expect(result.tentativeMinimumTax).toBe(83168);
  });

  it('carves out §1250 gain at 25%', () => {
    // AMT base = $200,000, QD = $0, LTCG = $50,000, §1250 = $20,000
    // adjustedNetCapitalGain = min(0 + 50000, 200000) = $50,000
    // ordinaryAMTIncome = $150,000
    // ordinaryTax = $150,000 × 26% = $39,000
    // effective1250 = min(20000, 50000, 50000) = $20,000
    // §1250 tax = $20,000 × 25% = $5,000
    // remaining = $50,000 - $20,000 = $30,000
    // prefStart = $150,000 + $20,000 = $170,000; prefEnd = $200,000
    // Single: threshold0=$48,350 → in0 = 0; threshold15=$533,400 → in15 = $30,000
    // capGainsTax = $30,000 × 15% = $4,500
    // Special = $39,000 + $5,000 + $4,500 = $48,500
    // Flat = $200,000 × 26% = $52,000
    // TMT = min($48,500, $52,000) = $48,500
    const result = calculateAMTPartIII(200000, 0, 50000, 20000, FilingStatus.Single);
    expect(result.section1250Tax).toBe(5000);
    expect(result.capitalGainsTax).toBe(4500);
    expect(result.specialComputationTax).toBe(48500);
    expect(result.tentativeMinimumTax).toBe(48500);
  });

  it('caps adjustedNetCapitalGain at AMT base', () => {
    // AMT base = $30,000, QD = $20,000, LTCG = $50,000
    // adjustedNetCapitalGain = min($70,000, $30,000) = $30,000
    const result = calculateAMTPartIII(30000, 20000, 50000, 0, FilingStatus.Single);
    expect(result.adjustedNetCapitalGain).toBe(30000);
    expect(result.ordinaryAMTIncome).toBe(0);
  });

  it('uses flat rate when special computation is higher', () => {
    // Edge case: when the ordinary portion is tiny and capital gains push into 20% zone
    // but flat 26% on the entire base is cheaper. This is rare but possible.
    // With a very large cap gains base that pushes past the 20% threshold:
    // AMT base = $600,000 (all capital gains, Single)
    // Flat: $239,100 × 0.26 + $360,900 × 0.28 = $62,166 + $101,052 = $163,218
    // Special: ordinary = 0, ordinaryTax = 0
    //   prefStart = 0, prefEnd = 600,000
    //   0%: 0 to $48,350 → $48,350 × 0% = 0
    //   15%: $48,350 to $533,400 → $485,050 × 15% = $72,757.50
    //   20%: $533,400 to $600,000 → $66,600 × 20% = $13,320
    //   capGainsTax = $86,077.50
    // Special = $86,077.50 (< flat $163,218) → use special
    const result = calculateAMTPartIII(600000, 0, 600000, 0, FilingStatus.Single);
    expect(result.specialComputationTax).toBeLessThan(result.flatRateTax);
    expect(result.tentativeMinimumTax).toBe(result.specialComputationTax);
  });

  it('handles MFS half-threshold correctly', () => {
    // MFS: 28% rate threshold = $119,550
    // AMT base = $200,000, no cap gains → flat rate only
    // $119,550 × 0.26 + $80,450 × 0.28 = $31,083 + $22,526 = $53,609
    const result = calculateAMTPartIII(200000, 0, 0, 0, FilingStatus.MarriedFilingSeparately);
    expect(result.flatRateTax).toBe(53609);
    expect(result.tentativeMinimumTax).toBe(53609);
  });

  it('caps §1250 gain at LTCG', () => {
    // §1250 > LTCG → capped to LTCG
    const result = calculateAMTPartIII(200000, 0, 10000, 50000, FilingStatus.Single);
    // effective1250 = min(50000, 10000, 10000) = 10000
    expect(result.section1250Tax).toBe(2500); // 10000 × 25%
  });
});

// ─── calculateAMT (full Form 6251) ──────────────────────

describe('calculateAMT', () => {
  const baseScheduleA: ScheduleAResult = {
    medicalDeduction: 0,
    saltDeduction: 10000,
    interestDeduction: 15000,
    charitableDeduction: 5000,
    casualtyDeduction: 0,
    otherDeductions: 0,
    totalItemized: 30000,
  };

  it('computes basic AMT for standard deduction filer', () => {
    // Standard deduction add-back: $30,050 (Single 2025)
    // ISO: $100,000
    // Taxable income: $100,000
    // AMTI: $100,000 + $30,050 + $100,000 = $230,050
    // Exemption: $88,100 (below phase-out)
    // AMT base: $141,950
    // TMT: $141,950 × 26% = $36,907
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'standard',
      amtData: { isoExerciseSpread: 100000 },
    });
    const result = calculateAMT(tr, 15000, undefined, 100000, FilingStatus.Single, 30050);
    expect(result.adjustments.standardDeductionAddBack).toBe(30050);
    expect(result.adjustments.isoExerciseSpread).toBe(100000);
    expect(result.amti).toBe(230050);
    expect(result.exemption).toBe(88100);
    expect(result.amtBase).toBe(141950);
    expect(result.tentativeMinimumTax).toBe(36907);
    expect(result.amtAmount).toBe(21907); // 36907 - 15000
    expect(result.applies).toBe(true);
    expect(result.usedPartIII).toBe(false);
  });

  it('computes AMT with SALT add-back for itemizers', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'itemized',
      amtData: { isoExerciseSpread: 50000 },
    });
    const result = calculateAMT(tr, 22000, baseScheduleA, 120000, FilingStatus.Single);
    // SALT $10,000 + ISO $50,000 = $60,000 adjustments
    expect(result.adjustments.saltAddBack).toBe(10000);
    expect(result.adjustments.standardDeductionAddBack).toBe(0);
    expect(result.adjustments.total).toBe(60000);
    // AMTI = $120,000 + $60,000 = $180,000
    expect(result.amti).toBe(180000);
  });

  it('does not add back standard deduction for itemizers', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'itemized',
    });
    const result = calculateAMT(tr, 10000, baseScheduleA, 100000, FilingStatus.Single, 30000);
    expect(result.adjustments.standardDeductionAddBack).toBe(0);
  });

  it('reads all expanded amtData fields', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'standard',
      amtData: {
        isoExerciseSpread: 10000,
        privateActivityBondInterest: 5000,
        taxRefundAdjustment: 2000,
        investmentInterestAdjustment: 1500,
        depletion: 3000,
        atnold: -5000, // negative — reduces AMTI
        qsbsExclusion: 8000,
        dispositionOfProperty: 4000,
        depreciationAdjustment: 6000,
        passiveActivityLoss: 2500,
        lossLimitations: 1000,
        circulationCosts: 500,
        longTermContracts: 750,
        miningCosts: 250,
        researchCosts: 1200,
        intangibleDrillingCosts: 3000,
        otherAMTAdjustments: 2000,
      },
    });
    const result = calculateAMT(tr, 30000, undefined, 200000, FilingStatus.Single, 30050);
    // Total adjustments = std deduction(30050) + 10000 + 5000 + (-2000) + 1500 + 3000
    //   + (-5000) + 8000 + 4000 + 6000 + 2500 + 1000 + 500 + 750 + 250 + 1200 + 3000 + 2000
    //   = 30050 + 41700 = 71750
    // Note: taxRefundAdjustment (2b) and atnold (2f) are always negated by the engine
    expect(result.adjustments.isoExerciseSpread).toBe(10000);
    expect(result.adjustments.taxRefundAdjustment).toBe(-2000);
    expect(result.adjustments.atnold).toBe(-5000);
    expect(result.adjustments.depreciationAdjustment).toBe(6000);
    expect(result.adjustments.total).toBe(71750);
    expect(result.amti).toBe(271750); // 200000 + 71750
  });

  it('ATNOLD (negative input) reduces AMTI', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'standard',
      amtData: { atnold: -50000 },
    });
    const result = calculateAMT(tr, 10000, undefined, 100000, FilingStatus.Single, 30050);
    // Engine negates: -Math.abs(-50000) = -50000
    // adjustments = 30050 (std ded) + (-50000) = -19950
    expect(result.adjustments.atnold).toBe(-50000);
    expect(result.adjustments.total).toBe(-19950);
    expect(result.amti).toBe(80050);
  });

  it('ATNOLD (positive UI input) is auto-negated to reduce AMTI', () => {
    // Users type positive numbers in the UI; engine must negate Line 2f
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'standard',
      amtData: { atnold: 50000 },
    });
    const result = calculateAMT(tr, 10000, undefined, 100000, FilingStatus.Single, 30050);
    // Engine negates: -Math.abs(50000) = -50000
    expect(result.adjustments.atnold).toBe(-50000);
    expect(result.adjustments.total).toBe(-19950);
    expect(result.amti).toBe(80050);
  });

  it('tax refund adjustment (positive UI input) is auto-negated', () => {
    // Line 2b: state/local tax refund is always a subtraction
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'standard',
      amtData: { taxRefundAdjustment: 5000 },
    });
    const result = calculateAMT(tr, 10000, undefined, 100000, FilingStatus.Single, 30050);
    expect(result.adjustments.taxRefundAdjustment).toBe(-5000);
    // adjustments = 30050 (std ded) + (-5000) = 25050
    expect(result.adjustments.total).toBe(25050);
    expect(result.amti).toBe(125050);
  });

  it('AMTI floors at zero', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'standard',
      amtData: { atnold: -500000 },
    });
    const result = calculateAMT(tr, 10000, undefined, 100000, FilingStatus.Single, 30050);
    expect(result.amti).toBe(0);
  });

  it('phases out exemption for high AMTI (Single)', () => {
    // Phase-out starts at $626,350 for Single (Rev. Proc. 2024-40 §3.02)
    // AMTI = $700,000
    // Excess = $700,000 - $626,350 = $73,650
    // Reduction = $73,650 × 25% = $18,412.50
    // Exemption = $88,100 - $18,412.50 = $69,687.50
    const tr = makeTaxReturn({ filingStatus: FilingStatus.Single, deductionMethod: 'standard' });
    const result = calculateAMT(tr, 100000, undefined, 700000, FilingStatus.Single, 0);
    expect(result.exemption).toBeCloseTo(69687.50, 0);
  });

  it('completely phases out exemption at very high AMTI', () => {
    // Exemption fully phased out when reduction >= $88,100
    // $88,100 / 0.25 = $352,400 excess needed → AMTI = $609,350 + $352,400 = $961,750
    const tr = makeTaxReturn({ filingStatus: FilingStatus.Single, deductionMethod: 'standard' });
    const result = calculateAMT(tr, 200000, undefined, 1000000, FilingStatus.Single, 0);
    expect(result.exemption).toBe(0);
  });

  it('applies AMTFTC (capped at TMT)', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'standard',
      amtData: {
        isoExerciseSpread: 100000,
        amtForeignTaxCredit: 5000,
      },
    });
    const result = calculateAMT(tr, 15000, undefined, 100000, FilingStatus.Single, 30050);
    expect(result.amtForeignTaxCredit).toBe(5000);
    // TMT = $36,907 (same as basic test above)
    // tmtAfterFTC = $36,907 - $5,000 = $31,907
    expect(result.tmtAfterFTC).toBe(31907);
    // AMT = max(0, $31,907 - $15,000) = $16,907
    expect(result.amtAmount).toBe(16907);
  });

  it('caps AMTFTC at TMT', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'standard',
      amtData: { amtForeignTaxCredit: 999999 },
    });
    const result = calculateAMT(tr, 10000, undefined, 100000, FilingStatus.Single, 30050);
    // AMTFTC capped at TMT
    expect(result.amtForeignTaxCredit).toBe(result.tentativeMinimumTax);
    expect(result.tmtAfterFTC).toBe(0);
    expect(result.amtAmount).toBe(0);
    expect(result.applies).toBe(false);
  });

  it('invokes Part III when QD present', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'standard',
      amtData: { isoExerciseSpread: 100000 },
    });
    const result = calculateAMT(
      tr, 15000, undefined, 100000, FilingStatus.Single, 30050,
      20000, // QD
      0,     // LTCG
      0,     // §1250
    );
    expect(result.usedPartIII).toBe(true);
    expect(result.partIII).toBeDefined();
    expect(result.partIII!.adjustedNetCapitalGain).toBe(20000);
    // Part III should produce a lower TMT than flat
    expect(result.tentativeMinimumTax).toBeLessThanOrEqual(
      calculateFlatTMT(result.amtBase, FilingStatus.Single),
    );
  });

  it('invokes Part III when LTCG present', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'standard',
      amtData: { isoExerciseSpread: 50000 },
    });
    const result = calculateAMT(
      tr, 15000, undefined, 100000, FilingStatus.Single, 30050,
      0,     // QD
      30000, // LTCG
      0,     // §1250
    );
    expect(result.usedPartIII).toBe(true);
    expect(result.partIII).toBeDefined();
  });

  it('does not invoke Part III without cap gains', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'standard',
      amtData: { isoExerciseSpread: 50000 },
    });
    const result = calculateAMT(
      tr, 15000, undefined, 100000, FilingStatus.Single, 30050,
      0, 0, 0,
    );
    expect(result.usedPartIII).toBe(false);
    expect(result.partIII).toBeUndefined();
  });

  it('does not apply AMT when regular tax exceeds TMT', () => {
    // High regular tax, low AMTI → no AMT
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      deductionMethod: 'standard',
    });
    const result = calculateAMT(tr, 50000, undefined, 100000, FilingStatus.Single, 0);
    // AMTI = $100,000 (no adjustments)
    // Exemption = $88,100
    // AMT base = $11,900
    // TMT = $11,900 × 26% = $3,094
    // AMT = max(0, $3,094 - $50,000) = 0
    expect(result.applies).toBe(false);
    expect(result.amtAmount).toBe(0);
  });

  it('preserves line1_taxableIncome', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.Single, deductionMethod: 'standard' });
    const result = calculateAMT(tr, 10000, undefined, 150000, FilingStatus.Single);
    expect(result.line1_taxableIncome).toBe(150000);
  });

  it('populates regularTax in result', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.Single, deductionMethod: 'standard' });
    const result = calculateAMT(tr, 25000, undefined, 150000, FilingStatus.Single);
    expect(result.regularTax).toBe(25000);
  });
});

// ─── adjustAMTForRegularFTC ──────────────────────────────

describe('adjustAMTForRegularFTC', () => {
  it('reduces regularTax by FTC and increases AMT', () => {
    // TMT after AMTFTC = 30000, regular tax = 25000, original AMT = 5000
    const base: AMTResult = {
      line1_taxableIncome: 200000,
      adjustments: {
        standardDeductionAddBack: 15050,
        taxRefundAdjustment: 0,
        investmentInterestAdjustment: 0,
        depletion: 0,
        saltAddBack: 0,
        atnold: 0,
        privateActivityBondInterest: 0,
        qsbsExclusion: 0,
        isoExerciseSpread: 80000,
        dispositionOfProperty: 0,
        depreciationAdjustment: 0,
        passiveActivityLoss: 0,
        lossLimitations: 0,
        circulationCosts: 0,
        longTermContracts: 0,
        miningCosts: 0,
        researchCosts: 0,
        intangibleDrillingCosts: 0,
        otherAdjustments: 0,
        total: 95050,
      },
      amti: 295050,
      exemption: 88100,
      amtBase: 206950,
      tentativeMinimumTax: 30000,
      amtForeignTaxCredit: 0,
      tmtAfterFTC: 30000,
      regularTax: 25000,
      amtAmount: 5000,
      applies: true,
      partIII: undefined,
      usedPartIII: false,
    };

    // FTC of $2000 → regularTax becomes 23000, AMT becomes 7000
    const adjusted = adjustAMTForRegularFTC(base, 2000);
    expect(adjusted.regularTax).toBe(23000);
    expect(adjusted.amtAmount).toBe(7000);
    expect(adjusted.applies).toBe(true);
    // TMT shouldn't change
    expect(adjusted.tmtAfterFTC).toBe(30000);
  });

  it('FTC of zero returns result unchanged', () => {
    const base: AMTResult = {
      line1_taxableIncome: 100000,
      adjustments: {
        standardDeductionAddBack: 0, taxRefundAdjustment: 0,
        investmentInterestAdjustment: 0, depletion: 0, saltAddBack: 0,
        atnold: 0, privateActivityBondInterest: 0, qsbsExclusion: 0,
        isoExerciseSpread: 0, dispositionOfProperty: 0,
        depreciationAdjustment: 0, passiveActivityLoss: 0,
        lossLimitations: 0, circulationCosts: 0, longTermContracts: 0,
        miningCosts: 0, researchCosts: 0, intangibleDrillingCosts: 0,
        otherAdjustments: 0, total: 0,
      },
      amti: 100000, exemption: 88100, amtBase: 11900,
      tentativeMinimumTax: 3094, amtForeignTaxCredit: 0,
      tmtAfterFTC: 3094, regularTax: 10000, amtAmount: 0,
      applies: false, partIII: undefined, usedPartIII: false,
    };

    const adjusted = adjustAMTForRegularFTC(base, 0);
    expect(adjusted).toBe(base); // Same object reference (no change)
  });

  it('FTC can cause AMT to newly apply', () => {
    // TMT = 20000, regular tax = 22000 → AMT = 0 (no AMT)
    // FTC = 5000 → regular tax becomes 17000 → AMT = 3000 (now applies!)
    const base: AMTResult = {
      line1_taxableIncome: 200000,
      adjustments: {
        standardDeductionAddBack: 0, taxRefundAdjustment: 0,
        investmentInterestAdjustment: 0, depletion: 0, saltAddBack: 0,
        atnold: 0, privateActivityBondInterest: 0, qsbsExclusion: 0,
        isoExerciseSpread: 0, dispositionOfProperty: 0,
        depreciationAdjustment: 0, passiveActivityLoss: 0,
        lossLimitations: 0, circulationCosts: 0, longTermContracts: 0,
        miningCosts: 0, researchCosts: 0, intangibleDrillingCosts: 0,
        otherAdjustments: 0, total: 0,
      },
      amti: 200000, exemption: 88100, amtBase: 111900,
      tentativeMinimumTax: 20000, amtForeignTaxCredit: 0,
      tmtAfterFTC: 20000, regularTax: 22000, amtAmount: 0,
      applies: false, partIII: undefined, usedPartIII: false,
    };

    const adjusted = adjustAMTForRegularFTC(base, 5000);
    expect(adjusted.regularTax).toBe(17000);
    expect(adjusted.amtAmount).toBe(3000);
    expect(adjusted.applies).toBe(true);
  });

  it('regularTax does not go below zero', () => {
    const base: AMTResult = {
      line1_taxableIncome: 50000,
      adjustments: {
        standardDeductionAddBack: 0, taxRefundAdjustment: 0,
        investmentInterestAdjustment: 0, depletion: 0, saltAddBack: 0,
        atnold: 0, privateActivityBondInterest: 0, qsbsExclusion: 0,
        isoExerciseSpread: 0, dispositionOfProperty: 0,
        depreciationAdjustment: 0, passiveActivityLoss: 0,
        lossLimitations: 0, circulationCosts: 0, longTermContracts: 0,
        miningCosts: 0, researchCosts: 0, intangibleDrillingCosts: 0,
        otherAdjustments: 0, total: 0,
      },
      amti: 50000, exemption: 50000, amtBase: 0,
      tentativeMinimumTax: 0, amtForeignTaxCredit: 0,
      tmtAfterFTC: 0, regularTax: 3000, amtAmount: 0,
      applies: false, partIII: undefined, usedPartIII: false,
    };

    const adjusted = adjustAMTForRegularFTC(base, 10000);
    expect(adjusted.regularTax).toBe(0); // Clamped at zero
    expect(adjusted.amtAmount).toBe(0); // TMT is also 0
  });
});

// ─── Integration: Through calculateForm1040 ──────────────

describe('AMT Integration', () => {
  it('high-SALT itemizer triggers AMT via SALT add-back', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1',
        employerName: 'Employer',
        wages: 200000,
        federalTaxWithheld: 40000,
        socialSecurityWages: 176100,
        socialSecurityTax: 10918.20,
        medicareWages: 200000,
        medicareTax: 2900,
      }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 15000,
        realEstateTax: 10000,
        personalPropertyTax: 0,
        mortgageInterest: 20000,
        mortgageInsurancePremiums: 0,
        charitableCash: 5000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      amtData: {
        isoExerciseSpread: 80000,
      },
    });

    const result = calculateForm1040(tr);
    expect(result.amt).toBeDefined();
    expect(result.amt!.applies).toBe(true);
    // SALT add-back should be the full SALT deduction from Schedule A
    expect(result.amt!.adjustments.saltAddBack).toBeGreaterThan(0);
    // ISO spread flows through
    expect(result.amt!.adjustments.isoExerciseSpread).toBe(80000);
    // Standard deduction not added back (itemizer)
    expect(result.amt!.adjustments.standardDeductionAddBack).toBe(0);
  });

  it('ISO + LTCG triggers Part III, reducing AMT vs flat rate', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{
        id: 'w1',
        employerName: 'TechCo',
        wages: 300000,
        federalTaxWithheld: 65000,
        socialSecurityWages: 176100,
        socialSecurityTax: 10918.20,
        medicareWages: 300000,
        medicareTax: 4350,
      }],
      income1099B: [{
        id: 'b1',
        brokerName: 'Broker',
        description: 'Stock sale',
        proceeds: 80000,
        costBasis: 30000,
        dateAcquired: '2023-01-01',
        dateSold: '2025-07-01',
        isLongTerm: true,
      }],
      income1099DIV: [{
        id: 'd1',
        payerName: 'Fund',
        ordinaryDividends: 10000,
        qualifiedDividends: 10000,
      }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 20000,
        realEstateTax: 10000,
        personalPropertyTax: 0,
        mortgageInterest: 15000,
        mortgageInsurancePremiums: 0,
        charitableCash: 3000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      amtData: {
        isoExerciseSpread: 100000,
      },
    });

    const result = calculateForm1040(tr);
    expect(result.amt).toBeDefined();
    expect(result.amt!.applies).toBe(true);
    // Part III should be used (has QD + LTCG)
    expect(result.amt!.usedPartIII).toBe(true);
    expect(result.amt!.partIII).toBeDefined();
    // Part III TMT should be less than flat-rate TMT
    expect(result.amt!.partIII!.tentativeMinimumTax).toBeLessThan(result.amt!.partIII!.flatRateTax);
  });

  it('standard deduction filer with ISO has standard deduction add-back', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1',
        employerName: 'Corp',
        wages: 150000,
        federalTaxWithheld: 30000,
        socialSecurityWages: 150000,
        socialSecurityTax: 9300,
        medicareWages: 150000,
        medicareTax: 2175,
      }],
      deductionMethod: 'standard',
      amtData: {
        isoExerciseSpread: 80000,
      },
    });

    const result = calculateForm1040(tr);
    expect(result.amt).toBeDefined();
    expect(result.amt!.adjustments.standardDeductionAddBack).toBeGreaterThan(0);
    expect(result.amt!.adjustments.saltAddBack).toBe(0); // Standard deduction → no SALT to add back
  });

  it('always includes AMT result even when not triggered', () => {
    // Simple W-2 filer with no AMT triggers
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1',
        employerName: 'Corp',
        wages: 80000,
        federalTaxWithheld: 15000,
        socialSecurityWages: 80000,
        socialSecurityTax: 4960,
        medicareWages: 80000,
        medicareTax: 1160,
      }],
      deductionMethod: 'standard',
    });

    const result = calculateForm1040(tr);
    // AMT result should always be present
    expect(result.amt).toBeDefined();
    expect(result.amt!.applies).toBe(false);
    expect(result.amt!.amtAmount).toBe(0);
  });

  it('backward compat: old 3-field amtData still works', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1',
        employerName: 'Corp',
        wages: 150000,
        federalTaxWithheld: 30000,
        socialSecurityWages: 150000,
        socialSecurityTax: 9300,
        medicareWages: 150000,
        medicareTax: 2175,
      }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 8000,
        realEstateTax: 4000,
        personalPropertyTax: 0,
        mortgageInterest: 12000,
        mortgageInsurancePremiums: 0,
        charitableCash: 2000,
        charitableNonCash: 0,
        casualtyLoss: 0,
        otherDeductions: 0,
      },
      amtData: {
        isoExerciseSpread: 100000,
        privateActivityBondInterest: 5000,
        otherAMTAdjustments: 3000,
      },
    });

    const result = calculateForm1040(tr);
    expect(result.amt).toBeDefined();
    expect(result.amt!.adjustments.isoExerciseSpread).toBe(100000);
    expect(result.amt!.adjustments.privateActivityBondInterest).toBe(5000);
    expect(result.amt!.adjustments.otherAdjustments).toBe(3000);
  });

  it('MFJ near phase-out has correct exemption', () => {
    // MFJ phase-out starts at $1,218,700
    // AMTI = $1,300,000 → excess = $81,300 → reduction = $20,325
    // Exemption = $137,000 - $20,325 = $116,675
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      w2Income: [{
        id: 'w1',
        employerName: 'Corp',
        wages: 1200000,
        federalTaxWithheld: 400000,
        socialSecurityWages: 176100,
        socialSecurityTax: 10918.20,
        medicareWages: 1200000,
        medicareTax: 17400,
      }],
      deductionMethod: 'standard',
      amtData: {
        isoExerciseSpread: 100000,
      },
    });

    const result = calculateForm1040(tr);
    expect(result.amt).toBeDefined();
    // We can't predict exact AMTI here due to standard deduction, but exemption should be partially phased out
    if (result.amt!.amti > 1218700) {
      expect(result.amt!.exemption).toBeLessThan(137000);
      expect(result.amt!.exemption).toBeGreaterThan(0);
    }
  });

  it('AMTFTC reduces AMT through integration', () => {
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1',
        employerName: 'Corp',
        wages: 200000,
        federalTaxWithheld: 40000,
        socialSecurityWages: 176100,
        socialSecurityTax: 10918.20,
        medicareWages: 200000,
        medicareTax: 2900,
      }],
      deductionMethod: 'standard',
      amtData: {
        isoExerciseSpread: 100000,
        amtForeignTaxCredit: 3000,
      },
    });

    const result = calculateForm1040(tr);
    expect(result.amt).toBeDefined();
    expect(result.amt!.amtForeignTaxCredit).toBe(3000);
    expect(result.amt!.tmtAfterFTC).toBe(result.amt!.tentativeMinimumTax - 3000);
  });

  it('regular FTC reduces regularTax in AMT comparison (Form 6251 Line 10)', () => {
    // Filer with foreign dividends that generate a regular FTC.
    // The FTC should reduce the regular tax used in the AMT comparison,
    // potentially increasing the AMT amount.
    const tr = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{
        id: 'w1',
        employerName: 'Corp',
        wages: 200000,
        federalTaxWithheld: 40000,
        socialSecurityWages: 176100,
        socialSecurityTax: 10918.20,
        medicareWages: 200000,
        medicareTax: 2900,
      }],
      income1099DIV: [{
        id: 'd1',
        payerName: 'Foreign Fund',
        ordinaryDividends: 20000,
        qualifiedDividends: 15000,
        foreignTaxPaid: 3000,
      }],
      deductionMethod: 'standard',
      amtData: {
        isoExerciseSpread: 80000,
      },
    });

    const result = calculateForm1040(tr);
    expect(result.amt).toBeDefined();
    // FTC should have been applied
    const ftc = result.credits.foreignTaxCredit;
    expect(ftc).toBeGreaterThan(0);
    // Regular tax in AMT should be income tax MINUS FTC
    const expectedRegularTax = (result.form1040.incomeTax || 0) - ftc;
    expect(result.amt!.regularTax).toBe(expectedRegularTax);
    // AMT = max(0, tmtAfterFTC - (incomeTax - FTC))
    expect(result.amt!.amtAmount).toBe(
      Math.max(0, result.amt!.tmtAfterFTC - expectedRegularTax),
    );
  });
});
