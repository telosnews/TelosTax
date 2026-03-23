import { describe, it, expect } from 'vitest';
import { calculateQBIDeduction } from '../src/engine/qbi.js';
import { FilingStatus } from '../src/types/index.js';

describe('calculateQBIDeduction', () => {
  it('returns 0 for non-positive QBI', () => {
    expect(calculateQBIDeduction(0, 50000, FilingStatus.Single)).toBe(0);
    expect(calculateQBIDeduction(-5000, 50000, FilingStatus.Single)).toBe(0);
  });

  it('calculates 20% of QBI below threshold (Single)', () => {
    // Single threshold = $197,300
    const result = calculateQBIDeduction(100000, 150000, FilingStatus.Single);
    // 20% of QBI = 20000. 20% of taxable income = 30000. Min = 20000
    expect(result).toBe(20000);
  });

  it('limits QBI deduction to 20% of taxable income', () => {
    // QBI is large but taxable income is small
    const result = calculateQBIDeduction(100000, 30000, FilingStatus.Single);
    // 20% of QBI = 20000. 20% of taxable income = 6000. Min = 6000
    expect(result).toBe(6000);
  });

  it('calculates full deduction for MFJ below threshold', () => {
    // MFJ threshold = $394,600
    const result = calculateQBIDeduction(150000, 350000, FilingStatus.MarriedFilingJointly);
    // 20% of QBI = 30000. 20% of taxable income = 70000. Min = 30000
    expect(result).toBe(30000);
  });

  it('fully phases out when above threshold + phase-in range (Single)', () => {
    // Single threshold = 197300, phase-in range = 50000
    // Above 247300 → fully phased out
    const result = calculateQBIDeduction(100000, 300000, FilingStatus.Single);
    expect(result).toBe(0);
  });

  it('partially phases out within phase-in range (Single, SSTB)', () => {
    // Single threshold = 197300, phase-in range = 50000
    // Excess over threshold = 222300 - 197300 = 25000
    // phaseInFraction = 25000 / 50000 = 0.5
    // SSTB: reducedQBI = 100000 * 0.5 = 50000, reducedTentative = 10000
    // reducedWageLimit = 0 (no wages), excessAmount = 10000
    // phaseInReduction = 10000 * 0.5 = 5000, deduction = 10000 - 5000 = 5000
    const result = calculateQBIDeduction(100000, 222300, FilingStatus.Single);
    expect(result).toBe(5000);
  });

  it('fully phases out for MFJ above threshold + range', () => {
    // MFJ threshold = 394600, phase-in range = 100000
    // Above 494600 → fully phased out
    const result = calculateQBIDeduction(100000, 500000, FilingStatus.MarriedFilingJointly);
    expect(result).toBe(0);
  });

  it('handles QualifyingSurvivingSpouse like MFJ', () => {
    const mfj = calculateQBIDeduction(80000, 300000, FilingStatus.MarriedFilingJointly);
    const qss = calculateQBIDeduction(80000, 300000, FilingStatus.QualifyingSurvivingSpouse);
    expect(qss).toBe(mfj);
  });

  it('handles MFS like Single for thresholds', () => {
    const single = calculateQBIDeduction(80000, 250000, FilingStatus.Single);
    const mfs = calculateQBIDeduction(80000, 250000, FilingStatus.MarriedFilingSeparately);
    expect(mfs).toBe(single);
  });

  // ── Bug #12: IRC §199A(a)(2) net capital gain subtraction ──

  it('reduces taxable income limit by net capital gain (qualified dividends)', () => {
    // IRC §199A(a)(2): deduction limited to 20% × (taxable income − net capital gain)
    // QBI = $100K, taxable = $30K, qualified dividends = $5K
    // Without net capital gain: 20% × $30K = $6K
    // With net capital gain:    20% × ($30K − $5K) = 20% × $25K = $5K
    const withoutNCG = calculateQBIDeduction(100000, 30000, FilingStatus.Single, true, 0, 0, 0);
    const withNCG = calculateQBIDeduction(100000, 30000, FilingStatus.Single, true, 0, 0, 5000);
    expect(withoutNCG).toBe(6000);
    expect(withNCG).toBe(5000);
  });

  it('reduces taxable income limit by net capital gain (LTCG + QD)', () => {
    // QBI = $80K, taxable = $50K, net LTCG $10K + QD $3K = net capital gain $13K
    // Limit = 20% × ($50K − $13K) = 20% × $37K = $7,400
    // 20% × QBI = $16K → min($16K, $7.4K) = $7,400
    const result = calculateQBIDeduction(80000, 50000, FilingStatus.Single, true, 0, 0, 13000);
    expect(result).toBe(7400);
  });

  it('net capital gain does not reduce below zero', () => {
    // QBI = $50K, taxable = $10K, net capital gain = $15K (exceeds taxable)
    // Limit = 20% × max(0, $10K − $15K) = 20% × $0 = $0
    const result = calculateQBIDeduction(50000, 10000, FilingStatus.Single, true, 0, 0, 15000);
    expect(result).toBe(0);
  });

  it('net capital gain does NOT affect threshold comparison', () => {
    // Single threshold = $197,300
    // Taxable = $200K (just above threshold), net capital gain = $50K
    // Threshold uses full $200K (above → enters phase-in)
    // But taxable income limit uses ($200K − $50K) = $150K
    // This ensures the W-2/UBIA phase-in kicks in correctly at the right income
    const belowThreshold = calculateQBIDeduction(100000, 190000, FilingStatus.Single, true, 0, 0, 50000);
    // Below threshold: 20% × max(0, $190K − $50K) = 20% × $140K = $28K; min($20K, $28K) = $20K
    expect(belowThreshold).toBe(20000);

    // Above threshold: enters phase-in even though (taxable − NCG) < threshold
    const aboveThreshold = calculateQBIDeduction(100000, 200000, FilingStatus.Single, true, 0, 0, 50000);
    // In phase-in range: more complex calc, but should be LESS than $20K
    expect(aboveThreshold).toBeLessThan(20000);
  });

  it('matches Persona 5 expected value: QBI with qualified dividends (Bug #12)', () => {
    // Denise Carter: Sch C QBI = ~$73,340, taxable before QBI = ~$29,415
    // Qualified dividends = $3,500, net LTCG = 0 (negative LT gains)
    // Net capital gain = $3,500
    // Correct: 20% × ($29,415 − $3,500) = 20% × $25,915 = $5,183
    const result = calculateQBIDeduction(73340, 29415, FilingStatus.HeadOfHousehold, true, 0, 0, 3500);
    expect(result).toBe(5183);
  });
});
