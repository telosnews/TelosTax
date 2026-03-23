import { describe, it, expect } from 'vitest';
import { assessEstimatedPaymentNeed, ESTIMATED_TAX_2026_DUE_DATES } from '../src/engine/estimatedTaxVoucher.js';
import { calculateSafeHarbor } from '../src/engine/estimatedTax.js';
import { FilingStatus } from '../src/types/index.js';
import type { TaxReturn, CalculationResult } from '../src/types/index.js';

// ── Minimal fixture builders ──────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test',
    taxYear: 2025,
    status: 'completed',
    filingStatus: FilingStatus.Single,
    ...overrides,
  } as TaxReturn;
}

function makeCalc(overrides: {
  totalTax?: number;
  totalWithholding?: number;
  agi?: number;
  totalSETax?: number;
} = {}): CalculationResult {
  return {
    form1040: {
      totalTax: overrides.totalTax ?? 0,
      totalWithholding: overrides.totalWithholding ?? 0,
      agi: overrides.agi ?? 0,
    },
    scheduleSE: overrides.totalSETax != null
      ? { totalSETax: overrides.totalSETax }
      : undefined,
  } as unknown as CalculationResult;
}

// ── calculateSafeHarbor MFS fix ─────────────────────────────────

describe('calculateSafeHarbor — MFS threshold fix', () => {
  it('uses $150k threshold for Single filers', () => {
    // AGI $160k > $150k → 110%
    expect(calculateSafeHarbor(10000, 160000, FilingStatus.Single)).toBe(11000);
  });

  it('uses $150k threshold for MFJ filers', () => {
    // AGI $160k > $150k → 110%
    expect(calculateSafeHarbor(10000, 160000, FilingStatus.MarriedFilingJointly)).toBe(11000);
  });

  it('uses $75k threshold for MFS filers', () => {
    // AGI $100k > $75k → 110%
    expect(calculateSafeHarbor(10000, 100000, FilingStatus.MarriedFilingSeparately)).toBe(11000);
  });

  it('MFS filer at $80k gets 110%, Single at $80k gets 100%', () => {
    // MFS: $80k > $75k → 110%
    expect(calculateSafeHarbor(10000, 80000, FilingStatus.MarriedFilingSeparately)).toBe(11000);
    // Single: $80k < $150k → 100%
    expect(calculateSafeHarbor(10000, 80000, FilingStatus.Single)).toBe(10000);
  });

  it('backward compatible — no filingStatus defaults to $150k', () => {
    expect(calculateSafeHarbor(10000, 160000)).toBe(11000);
    expect(calculateSafeHarbor(10000, 140000)).toBe(10000);
  });
});

// ── assessEstimatedPaymentNeed ──────────────────────────────────

describe('assessEstimatedPaymentNeed', () => {
  it('recommends payments when gap >= $1,000', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ totalTax: 15000, totalWithholding: 5000, agi: 80000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);

    expect(rec.recommended).toBe(true);
    expect(rec.annualAmount).toBeGreaterThan(0);
    expect(rec.quarterlyAmount).toBeGreaterThan(0);
    expect(rec.quarterlyAmount).toBeCloseTo(rec.annualAmount / 4, 2);
  });

  it('does NOT recommend when gap < $1,000', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ totalTax: 5500, totalWithholding: 5000, agi: 60000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);

    expect(rec.recommended).toBe(false);
  });

  it('does NOT recommend when withholding covers tax', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ totalTax: 10000, totalWithholding: 12000, agi: 80000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);

    expect(rec.recommended).toBe(false);
    expect(rec.annualAmount).toBe(0);
    expect(rec.quarterlyAmount).toBe(0);
  });

  it('identifies self-employment income', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ totalTax: 20000, totalWithholding: 5000, agi: 80000, totalSETax: 3000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);

    expect(rec.hasSelfEmploymentIncome).toBe(true);
    expect(rec.reasons.some(r => r.includes('self-employment'))).toBe(true);
  });

  it('identifies high-income filers (Single, AGI > $150k)', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.Single });
    const calc = makeCalc({ totalTax: 50000, totalWithholding: 20000, agi: 200000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);

    expect(rec.isHighIncome).toBe(true);
    expect(rec.safeHarborAmount).toBe(55000); // 110% of $50k
  });

  it('uses $75k threshold for MFS filers', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.MarriedFilingSeparately });
    const calc = makeCalc({ totalTax: 20000, totalWithholding: 5000, agi: 100000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);

    expect(rec.isHighIncome).toBe(true); // $100k > $75k
    expect(rec.safeHarborAmount).toBe(22000); // 110% of $20k
    expect(rec.reasons.some(r => r.includes('$75,000'))).toBe(true);
  });

  it('computes correct quarterly amount (safe harbor minus withholding)', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.Single });
    // AGI $80k < $150k → 100% safe harbor → $15k
    // Annual = max(0, 15000 - 5000) = $10k; quarterly = $2500
    const calc = makeCalc({ totalTax: 15000, totalWithholding: 5000, agi: 80000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);

    expect(rec.safeHarborAmount).toBe(15000);
    expect(rec.annualAmount).toBe(10000);
    expect(rec.quarterlyAmount).toBe(2500);
  });

  it('returns calculation basis and note', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ totalTax: 10000, totalWithholding: 5000, agi: 60000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);

    expect(rec.calculationBasis).toBe('safe_harbor_current_year');
    expect(rec.note).toContain('2025 tax liability');
  });

  it('includes correct due dates', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ totalTax: 10000, totalWithholding: 0, agi: 60000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);

    expect(rec.dueDates).toBe(ESTIMATED_TAX_2026_DUE_DATES);
    expect(rec.dueDates).toHaveLength(4);
    expect(rec.dueDates[0].date).toBe('April 15, 2026');
    expect(rec.dueDates[3].date).toBe('January 15, 2027');
  });

  it('recommends at exactly $1,000 gap (boundary)', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ totalTax: 6000, totalWithholding: 5000, agi: 60000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);
    expect(rec.recommended).toBe(true);
  });

  it('does NOT recommend at $999 gap (just below threshold)', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ totalTax: 5999, totalWithholding: 5000, agi: 60000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);
    expect(rec.recommended).toBe(false);
  });

  it('handles zero tax and zero AGI gracefully', () => {
    const tr = makeTaxReturn();
    const calc = makeCalc({ totalTax: 0, totalWithholding: 0, agi: 0 });
    const rec = assessEstimatedPaymentNeed(tr, calc);
    expect(rec.recommended).toBe(false);
    expect(rec.annualAmount).toBe(0);
    expect(rec.quarterlyAmount).toBe(0);
    expect(rec.safeHarborAmount).toBe(0);
  });

  it('uses $150k threshold for HoH filers (not halved)', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.HeadOfHousehold });
    const calc = makeCalc({ totalTax: 20000, totalWithholding: 5000, agi: 100000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);
    expect(rec.isHighIncome).toBe(false); // $100k < $150k
    expect(rec.safeHarborAmount).toBe(20000); // 100% of $20k
  });

  it('uses $150k threshold for QSS filers (not halved)', () => {
    const tr = makeTaxReturn({ filingStatus: FilingStatus.QualifyingSurvivingSpouse });
    const calc = makeCalc({ totalTax: 20000, totalWithholding: 5000, agi: 160000 });
    const rec = assessEstimatedPaymentNeed(tr, calc);
    expect(rec.isHighIncome).toBe(true); // $160k > $150k
    expect(rec.safeHarborAmount).toBe(22000); // 110% of $20k
  });
});
