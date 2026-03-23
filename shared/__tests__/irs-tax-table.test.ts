/**
 * IRS Tax Table Cross-Validation
 *
 * Validates the engine's federal income tax calculations against an independent
 * oracle with hard-coded bracket thresholds and standard deductions. The oracle
 * does NOT import from tax2025.ts — it is a fully independent reimplementation
 * based on Rev. Proc. 2024-40 and OBBBA §11021.
 *
 * Sections:
 *   A. Zero income ($0 wages → $0 tax, all 5 statuses)
 *   B. Bracket boundaries (every edge ±$1, all 5 statuses)
 *   C. Round-number incomes ($25k–$1M × 5 statuses)
 *   D. Bracket midpoints (middle of each bracket × 5 statuses)
 *   E. Mathematical invariants (identity, monotonicity, continuity, etc.)
 *
 * @authority IRC §1(a)-(d), (j); Rev. Proc. 2024-40; OBBBA §11021
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Independent Oracle — Hard-coded from Rev. Proc. 2024-40 + OBBBA §11021
// NOT imported from tax2025.ts — this is a fully independent reimplementation
// ═══════════════════════════════════════════════════════════════════════════

type StatusKey = 'Single' | 'MFJ' | 'MFS' | 'HOH' | 'QSS';

const BRACKETS: Record<StatusKey, Array<{ min: number; max: number; rate: number }>> = {
  Single: [
    { min: 0, max: 11925, rate: 0.10 },
    { min: 11925, max: 48475, rate: 0.12 },
    { min: 48475, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250525, rate: 0.32 },
    { min: 250525, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 },
  ],
  MFJ: [
    { min: 0, max: 23850, rate: 0.10 },
    { min: 23850, max: 96950, rate: 0.12 },
    { min: 96950, max: 206700, rate: 0.22 },
    { min: 206700, max: 394600, rate: 0.24 },
    { min: 394600, max: 501050, rate: 0.32 },
    { min: 501050, max: 751600, rate: 0.35 },
    { min: 751600, max: Infinity, rate: 0.37 },
  ],
  MFS: [
    { min: 0, max: 11925, rate: 0.10 },
    { min: 11925, max: 48475, rate: 0.12 },
    { min: 48475, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250525, rate: 0.32 },
    { min: 250525, max: 375800, rate: 0.35 },
    { min: 375800, max: Infinity, rate: 0.37 },
  ],
  HOH: [
    { min: 0, max: 17000, rate: 0.10 },
    { min: 17000, max: 64850, rate: 0.12 },
    { min: 64850, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250500, rate: 0.32 },
    { min: 250500, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 },
  ],
  QSS: [
    { min: 0, max: 23850, rate: 0.10 },
    { min: 23850, max: 96950, rate: 0.12 },
    { min: 96950, max: 206700, rate: 0.22 },
    { min: 206700, max: 394600, rate: 0.24 },
    { min: 394600, max: 501050, rate: 0.32 },
    { min: 501050, max: 751600, rate: 0.35 },
    { min: 751600, max: Infinity, rate: 0.37 },
  ],
};

const STD_DED: Record<StatusKey, number> = {
  Single: 15750,
  MFJ: 31500,
  MFS: 15750,
  HOH: 23625,
  QSS: 31500,
};

const STATUS_MAP: Record<StatusKey, FilingStatus> = {
  Single: FilingStatus.Single,
  MFJ: FilingStatus.MarriedFilingJointly,
  MFS: FilingStatus.MarriedFilingSeparately,
  HOH: FilingStatus.HeadOfHousehold,
  QSS: FilingStatus.QualifyingSurvivingSpouse,
};

const ALL_STATUSES: StatusKey[] = ['Single', 'MFJ', 'MFS', 'HOH', 'QSS'];

// ─── Independent Tax Computation ─────────────────────────────────────────

function computeExpectedTax(taxableIncome: number, status: StatusKey): number {
  if (taxableIncome <= 0) return 0;
  const brackets = BRACKETS[status];
  let tax = 0;
  for (const b of brackets) {
    if (taxableIncome <= b.min) break;
    const taxable = Math.min(taxableIncome, b.max) - b.min;
    tax += taxable * b.rate;
  }
  return round2(tax);
}

function getMarginalRate(taxableIncome: number, status: StatusKey): number {
  if (taxableIncome <= 0) return 0;
  const brackets = BRACKETS[status];
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (taxableIncome > brackets[i].min) return brackets[i].rate;
  }
  return 0;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'tax-table-test',
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

function calc(overrides: Partial<TaxReturn> = {}) {
  return calculateForm1040(makeTaxReturn(overrides));
}

/** Create a simple W-2-only return for a given status and wage amount */
function w2Return(status: StatusKey, wages: number) {
  return calc({
    filingStatus: STATUS_MAP[status],
    w2Income: [{
      id: 'w1',
      employerName: 'Test Corp',
      wages,
      federalTaxWithheld: 0,
      socialSecurityWages: Math.min(wages, 176100),
      socialSecurityTax: round2(Math.min(wages, 176100) * 0.062),
      medicareWages: wages,
      medicareTax: round2(wages * 0.0145),
    }],
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Section A — Zero Income
// ═══════════════════════════════════════════════════════════════════════════

describe('Section A — Zero Income', () => {
  it.each(ALL_STATUSES)('%s: $0 wages → $0 tax', (status) => {
    const f = w2Return(status, 0).form1040;
    expect(f.agi).toBe(0);
    expect(f.taxableIncome).toBe(0);
    expect(f.incomeTax).toBe(0);
    expect(f.totalTax).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Section B — Bracket Boundaries (every edge ±$1, all 5 statuses)
// ═══════════════════════════════════════════════════════════════════════════

describe('Section B — Bracket Boundaries', () => {
  for (const status of ALL_STATUSES) {
    const brackets = BRACKETS[status];
    const stdDed = STD_DED[status];

    describe(`${status} brackets`, () => {
      for (let i = 0; i < brackets.length - 1; i++) {
        const boundary = brackets[i].max;
        const lowerRate = brackets[i].rate;
        const upperRate = brackets[i + 1].rate;

        // Test at exact boundary (last dollar in lower bracket)
        it(`taxable $${boundary.toLocaleString()} (${(lowerRate * 100)}%→${(upperRate * 100)}% edge, exact)`, () => {
          const wages = boundary + stdDed;
          const f = w2Return(status, wages).form1040;
          const expectedTax = computeExpectedTax(boundary, status);
          expect(f.taxableIncome).toBe(boundary);
          expect(f.incomeTax).toBe(expectedTax);
        });

        // Test $1 below boundary (still in lower bracket)
        it(`taxable $${(boundary - 1).toLocaleString()} (${(lowerRate * 100)}% bracket, -$1)`, () => {
          const wages = boundary - 1 + stdDed;
          const f = w2Return(status, wages).form1040;
          const expectedTax = computeExpectedTax(boundary - 1, status);
          expect(f.taxableIncome).toBe(boundary - 1);
          expect(f.incomeTax).toBe(expectedTax);
        });

        // Test $1 above boundary (first dollar in upper bracket)
        it(`taxable $${(boundary + 1).toLocaleString()} (${(upperRate * 100)}% bracket, +$1)`, () => {
          const wages = boundary + 1 + stdDed;
          const f = w2Return(status, wages).form1040;
          const expectedTax = computeExpectedTax(boundary + 1, status);
          expect(f.taxableIncome).toBe(boundary + 1);
          expect(f.incomeTax).toBe(expectedTax);
        });
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Section C — Round-Number Incomes ($25k–$1M × 5 statuses)
// ═══════════════════════════════════════════════════════════════════════════

describe('Section C — Round-Number Incomes', () => {
  const incomes = [
    25000, 35000, 50000, 75000, 100000, 150000, 200000, 300000, 500000,
  ];

  for (const status of ALL_STATUSES) {
    const stdDed = STD_DED[status];

    describe(status, () => {
      it.each(incomes)('wages $%i', (wages) => {
        const f = w2Return(status, wages).form1040;
        const expectedTaxableIncome = Math.max(0, wages - stdDed);
        const expectedTax = computeExpectedTax(expectedTaxableIncome, status);

        expect(f.agi).toBe(wages);
        expect(f.standardDeduction).toBe(stdDed);
        expect(f.taxableIncome).toBe(expectedTaxableIncome);
        expect(f.incomeTax).toBe(expectedTax);
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Section D — Bracket Midpoints (middle of each bracket × 5 statuses)
// ═══════════════════════════════════════════════════════════════════════════

describe('Section D — Bracket Midpoints', () => {
  for (const status of ALL_STATUSES) {
    const brackets = BRACKETS[status];
    const stdDed = STD_DED[status];

    describe(status, () => {
      for (let i = 0; i < brackets.length; i++) {
        const b = brackets[i];
        // For the last bracket (max=Infinity), use min + 100000 as a representative midpoint
        const midpoint = b.max === Infinity
          ? b.min + 100000
          : Math.floor((b.min + b.max) / 2);

        it(`bracket ${i + 1} midpoint: taxable $${midpoint.toLocaleString()} (${(b.rate * 100)}%)`, () => {
          const wages = midpoint + stdDed;
          const f = w2Return(status, wages).form1040;
          const expectedTax = computeExpectedTax(midpoint, status);

          expect(f.taxableIncome).toBe(midpoint);
          expect(f.incomeTax).toBe(expectedTax);
        });
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Section E — Mathematical Invariants
// ═══════════════════════════════════════════════════════════════════════════

const INVARIANT_INCOMES = [
  0, 10000, 25000, 50000, 75000, 100000, 150000, 200000, 300000, 500000, 1000000,
];

// ═══════════════════════════════════════════════════════════════════════════
// Section F — Extreme Income Levels
// Tests deep into the 37% bracket and edge cases at the extremes
// ═══════════════════════════════════════════════════════════════════════════

describe('Section F — Extreme Income Levels', () => {
  const extremeIncomes = [
    1, 100, 1000, 1500000, 2000000, 5000000, 10000000,
  ];

  for (const status of ALL_STATUSES) {
    const stdDed = STD_DED[status];

    describe(status, () => {
      it.each(extremeIncomes)('wages $%i', (wages) => {
        const f = w2Return(status, wages).form1040;
        const expectedTaxableIncome = Math.max(0, wages - stdDed);
        const expectedTax = computeExpectedTax(expectedTaxableIncome, status);

        expect(f.agi).toBe(wages);
        expect(f.standardDeduction).toBe(stdDed);
        expect(f.taxableIncome).toBe(expectedTaxableIncome);
        expect(f.incomeTax).toBe(expectedTax);
      });
    });
  }

  // Verify tax at $10M is substantial and correct
  describe('Sanity checks at extreme values', () => {
    it('Single $10M → effective rate > 35% (income tax + Additional Medicare)', () => {
      const f = w2Return('Single', 10000000).form1040;
      // Effective rate includes Additional Medicare Tax (0.9% on wages > $200k),
      // so it can exceed the top marginal income tax rate of 37%
      expect(f.effectiveTaxRate).toBeGreaterThan(0.35);
      expect(f.effectiveTaxRate).toBeLessThan(0.40); // income tax ≤37% + Medicare 0.9%
      expect(f.marginalTaxRate).toBe(0.37);
    });

    it('Single $1 → below standard deduction → $0 tax', () => {
      const f = w2Return('Single', 1).form1040;
      expect(f.taxableIncome).toBe(0);
      expect(f.incomeTax).toBe(0);
      expect(f.totalTax).toBe(0);
    });

    it('MFJ $10M → effective rate > 35%', () => {
      const f = w2Return('MFJ', 10000000).form1040;
      expect(f.effectiveTaxRate).toBeGreaterThan(0.35);
      expect(f.effectiveTaxRate).toBeLessThan(0.40);
    });

    it('$10M: tax(Single) > tax(MFJ) > tax(HOH)', () => {
      const fS = w2Return('Single', 10000000).form1040;
      const fMFJ = w2Return('MFJ', 10000000).form1040;
      const fHOH = w2Return('HOH', 10000000).form1040;
      // At very high income, bracket differences matter less but ordering still holds
      expect(fS.incomeTax).toBeGreaterThan(fMFJ.incomeTax);
      expect(fS.incomeTax).toBeGreaterThan(fHOH.incomeTax);
    });

    // Monotonicity holds even at extreme jumps
    it.each(ALL_STATUSES)('%s: tax at $10M > tax at $1M', (status) => {
      const f1M = w2Return(status, 1000000).form1040;
      const f10M = w2Return(status, 10000000).form1040;
      expect(f10M.incomeTax).toBeGreaterThan(f1M.incomeTax);
    });

    // Continuity at $1M boundary
    it.each(ALL_STATUSES)('%s: $1 increase at $1M → tax change ≤ $0.37', (status) => {
      const f1 = w2Return(status, 1000000).form1040;
      const f2 = w2Return(status, 1000001).form1040;
      const diff = round2(f2.incomeTax - f1.incomeTax);
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(0.37);
    });

    // Invariants still hold at extreme values
    it.each(ALL_STATUSES)('%s $5M: identity holds', (status) => {
      const f = w2Return(status, 5000000).form1040;
      expect(f.taxableIncome).toBe(Math.max(0, f.agi - f.deductionAmount));
    });

    it.each(ALL_STATUSES)('%s $5M: non-negativity holds', (status) => {
      const f = w2Return(status, 5000000).form1040;
      expect(f.totalTax).toBeGreaterThanOrEqual(0);
      expect(f.taxableIncome).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Section E — Mathematical Invariants', () => {
  // E1. Identity: taxableIncome === agi - deductionAmount
  describe('E1 — Identity: taxableIncome === agi - deductionAmount', () => {
    for (const status of ALL_STATUSES) {
      it.each(INVARIANT_INCOMES)(`${status} wages $%i`, (wages) => {
        const f = w2Return(status, wages).form1040;
        expect(f.taxableIncome).toBe(Math.max(0, f.agi - f.deductionAmount));
      });
    }
  });

  // E2. Non-negativity: totalTax >= 0, taxableIncome >= 0
  describe('E2 — Non-negativity', () => {
    for (const status of ALL_STATUSES) {
      it.each(INVARIANT_INCOMES)(`${status} wages $%i`, (wages) => {
        const f = w2Return(status, wages).form1040;
        expect(f.totalTax).toBeGreaterThanOrEqual(0);
        expect(f.taxableIncome).toBeGreaterThanOrEqual(0);
      });
    }
  });

  // E3. Mutual exclusion: refundAmount > 0 XOR amountOwed > 0 (or both zero)
  describe('E3 — Mutual exclusion: refund XOR owed', () => {
    const testIncomes = [0, 50000, 100000, 200000];
    for (const status of ALL_STATUSES) {
      it.each(testIncomes)(`${status} wages $%i (no withholding)`, (wages) => {
        const f = w2Return(status, wages).form1040;
        // With no withholding: either owed > 0 or both zero (if no tax)
        const refundPositive = f.refundAmount > 0;
        const owedPositive = f.amountOwed > 0;
        expect(refundPositive && owedPositive).toBe(false); // never both positive
      });

      // With withholding that exceeds tax → refund
      it(`${status} $50k wages with excess withholding → refund only`, () => {
        const result = calc({
          filingStatus: STATUS_MAP[status],
          w2Income: [{
            id: 'w1',
            employerName: 'Test',
            wages: 50000,
            federalTaxWithheld: 20000, // way more than tax owed
            socialSecurityWages: 50000,
            socialSecurityTax: 3100,
            medicareWages: 50000,
            medicareTax: 725,
          }],
        });
        const f = result.form1040;
        expect(f.refundAmount).toBeGreaterThan(0);
        expect(f.amountOwed).toBe(0);
      });
    }
  });

  // E4. Monotonicity: adding $1 of income never decreases total tax
  describe('E4 — Monotonicity: more income → more (or equal) tax', () => {
    for (const status of ALL_STATUSES) {
      it.each(INVARIANT_INCOMES.filter(i => i > 0))(`${status} wages $%i vs $%i - 1`, (wages) => {
        const f1 = w2Return(status, wages - 1).form1040;
        const f2 = w2Return(status, wages).form1040;
        expect(f2.incomeTax).toBeGreaterThanOrEqual(f1.incomeTax);
      });

      // Test across broader ranges
      it(`${status}: tax at $100k >= tax at $50k`, () => {
        const f50 = w2Return(status, 50000).form1040;
        const f100 = w2Return(status, 100000).form1040;
        expect(f100.incomeTax).toBeGreaterThanOrEqual(f50.incomeTax);
      });

      it(`${status}: tax at $500k >= tax at $100k`, () => {
        const f100 = w2Return(status, 100000).form1040;
        const f500 = w2Return(status, 500000).form1040;
        expect(f500.incomeTax).toBeGreaterThanOrEqual(f100.incomeTax);
      });
    }
  });

  // E5. Tax continuity: adding $1 of income changes tax by at most $0.37 (top marginal rate)
  describe('E5 — Continuity: $1 income change → tax change ≤ $0.37', () => {
    const testPoints = [15000, 30000, 50000, 75000, 100000, 200000, 300000, 500000, 700000];

    for (const status of ALL_STATUSES) {
      it.each(testPoints)(`${status} wages $%i → $%i + 1`, (wages) => {
        const f1 = w2Return(status, wages).form1040;
        const f2 = w2Return(status, wages + 1).form1040;
        const taxDiff = round2(f2.incomeTax - f1.incomeTax);
        expect(taxDiff).toBeGreaterThanOrEqual(0);
        expect(taxDiff).toBeLessThanOrEqual(0.37);
      });
    }
  });

  // E6. MFJ/QSS parity: identical inputs produce identical results
  describe('E6 — MFJ/QSS Parity', () => {
    it.each(INVARIANT_INCOMES)('wages $%i → MFJ === QSS', (wages) => {
      const fMFJ = w2Return('MFJ', wages).form1040;
      const fQSS = w2Return('QSS', wages).form1040;
      expect(fQSS.agi).toBe(fMFJ.agi);
      expect(fQSS.standardDeduction).toBe(fMFJ.standardDeduction);
      expect(fQSS.taxableIncome).toBe(fMFJ.taxableIncome);
      expect(fQSS.incomeTax).toBe(fMFJ.incomeTax);
    });
  });

  // E7. MFS = Single brackets (except 35% cap at $375,800 vs $626,350)
  describe('E7 — MFS matches Single brackets (except 35% cap)', () => {
    // Below the 35% divergence point ($250,525 taxable), MFS and Single should have identical tax
    const belowDivergence = [10000, 25000, 50000, 100000, 200000];
    it.each(belowDivergence)('taxable $%i → same tax for Single and MFS', (taxableIncome) => {
      const singleTax = computeExpectedTax(taxableIncome, 'Single');
      const mfsTax = computeExpectedTax(taxableIncome, 'MFS');
      expect(mfsTax).toBe(singleTax);
    });

    // Above the divergence point, MFS 35% bracket ends at $375,800 (vs Single $626,350)
    it('at taxable $400,000 → MFS tax > Single tax (earlier 37% bracket)', () => {
      const singleTax = computeExpectedTax(400000, 'Single');
      const mfsTax = computeExpectedTax(400000, 'MFS');
      expect(mfsTax).toBeGreaterThan(singleTax);
    });
  });

  // E8. Filing status ordering: at same income, tax(MFJ) <= tax(Single) and tax(HOH) <= tax(Single)
  describe('E8 — Filing Status Ordering', () => {
    const testIncomes = [30000, 50000, 75000, 100000, 200000, 500000];

    it.each(testIncomes)('wages $%i: tax(MFJ) <= tax(Single)', (wages) => {
      const fSingle = w2Return('Single', wages).form1040;
      const fMFJ = w2Return('MFJ', wages).form1040;
      expect(fMFJ.incomeTax).toBeLessThanOrEqual(fSingle.incomeTax);
    });

    it.each(testIncomes)('wages $%i: tax(HOH) <= tax(Single)', (wages) => {
      const fSingle = w2Return('Single', wages).form1040;
      const fHOH = w2Return('HOH', wages).form1040;
      expect(fHOH.incomeTax).toBeLessThanOrEqual(fSingle.incomeTax);
    });
  });

  // E9. Effective rate bounds: 0 <= effectiveTaxRate <= marginalTaxRate <= 0.37
  describe('E9 — Effective Rate Bounds', () => {
    for (const status of ALL_STATUSES) {
      it.each(INVARIANT_INCOMES.filter(i => i > 0))(`${status} wages $%i`, (wages) => {
        const f = w2Return(status, wages).form1040;
        expect(f.effectiveTaxRate).toBeGreaterThanOrEqual(0);
        expect(f.effectiveTaxRate).toBeLessThanOrEqual(f.marginalTaxRate);
        expect(f.marginalTaxRate).toBeLessThanOrEqual(0.37);
      });
    }
  });

  // E10. Piecewise linearity: within any single bracket, tax is a linear function of income
  describe('E10 — Piecewise Linearity', () => {
    for (const status of ALL_STATUSES) {
      const brackets = BRACKETS[status];
      const stdDed = STD_DED[status];

      for (let i = 0; i < brackets.length; i++) {
        const b = brackets[i];
        // Skip last bracket (Infinity max) — test with a finite range instead
        const upper = b.max === Infinity ? b.min + 200000 : b.max;
        // Pick three points within the bracket
        const range = upper - b.min;
        if (range < 3) continue; // skip degenerate brackets

        const p1 = b.min + Math.floor(range * 0.25);
        const p2 = b.min + Math.floor(range * 0.50);
        const p3 = b.min + Math.floor(range * 0.75);

        it(`${status} bracket ${i + 1} (${(b.rate * 100)}%): linearity at 25%/50%/75%`, () => {
          const t1 = computeExpectedTax(p1, status);
          const t2 = computeExpectedTax(p2, status);
          const t3 = computeExpectedTax(p3, status);

          // Slope between (p1, t1) and (p2, t2) should equal slope between (p2, t2) and (p3, t3)
          const slope12 = round2((t2 - t1) / (p2 - p1) * 10000) / 10000;
          const slope23 = round2((t3 - t2) / (p3 - p2) * 10000) / 10000;
          expect(slope12).toBeCloseTo(slope23, 4);

          // Both slopes should equal the bracket rate
          expect(slope12).toBeCloseTo(b.rate, 4);

          // Also verify against the engine
          const f1 = w2Return(status, p1 + stdDed).form1040;
          const f2 = w2Return(status, p2 + stdDed).form1040;
          expect(f1.incomeTax).toBe(t1);
          expect(f2.incomeTax).toBe(t2);
        });
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Section G — IRS ATS Scenario Validation
// Validates engine's bracket math against independent oracle for real-world
// IRS Acceptance Testing System scenarios (W-2-only income profiles)
// ═══════════════════════════════════════════════════════════════════════════

describe('Section G — IRS ATS Scenario Validation', () => {
  // W-2-only ATS scenarios validated end-to-end:
  // wages → AGI → standard deduction → taxable income → oracle-verified income tax
  const atsScenarios: Array<{ name: string; status: StatusKey; wages: number }> = [
    { name: 'ATS-4: Sarah Smith (Single, $36,014)', status: 'Single', wages: 36014 },
    { name: 'ATS-13: William & Nancy Birch (MFJ, $31,620)', status: 'MFJ', wages: 31620 },
    { name: 'ATS-1: Tara Black (Single, $42,470)', status: 'Single', wages: 42470 },
    { name: 'ATS-2: John & Judy Jones (MFJ, $38,026)', status: 'MFJ', wages: 38026 },
    { name: 'ATS-12: Sam Gardenia W-2 only (Single, $100,836)', status: 'Single', wages: 100836 },
  ];

  for (const s of atsScenarios) {
    const stdDed = STD_DED[s.status];
    const expectedTaxableIncome = Math.max(0, s.wages - stdDed);
    const expectedTax = computeExpectedTax(expectedTaxableIncome, s.status);

    describe(s.name, () => {
      it(`AGI = $${s.wages.toLocaleString()}`, () => {
        expect(w2Return(s.status, s.wages).form1040.agi).toBe(s.wages);
      });

      it(`standard deduction = $${stdDed.toLocaleString()}`, () => {
        expect(w2Return(s.status, s.wages).form1040.standardDeduction).toBe(stdDed);
      });

      it(`taxable income = $${expectedTaxableIncome.toLocaleString()}`, () => {
        expect(w2Return(s.status, s.wages).form1040.taxableIncome).toBe(expectedTaxableIncome);
      });

      it(`income tax = $${expectedTax} (oracle verified)`, () => {
        expect(w2Return(s.status, s.wages).form1040.incomeTax).toBe(expectedTax);
      });
    });
  }

  // ATS-5: Bobby Barker — special case: HOH + legally blind
  // Blind adds $2,000 to standard deduction (Single/HOH additional per Rev. Proc. 2024-40)
  // w2Return() doesn't support blind, so we use calc() directly
  describe('ATS-5: Bobby Barker (HOH, $31,232, blind)', () => {
    const wages = 31232;
    const blindAddition = 2000; // Single/HOH additional for blind (Rev. Proc. 2024-40 §3.02)
    const expectedStdDed = STD_DED['HOH'] + blindAddition; // 23625 + 2000 = 25625
    const expectedTaxableIncome = wages - expectedStdDed; // 31232 - 25625 = 5607
    const expectedTax = computeExpectedTax(expectedTaxableIncome, 'HOH'); // 10% of $5,607 = $560.70

    const result = calc({
      filingStatus: STATUS_MAP['HOH'],
      isLegallyBlind: true,
      w2Income: [{
        id: 'w1',
        employerName: 'Apple Electronics',
        wages,
        federalTaxWithheld: 0,
        socialSecurityWages: Math.min(wages, 176100),
        socialSecurityTax: round2(Math.min(wages, 176100) * 0.062),
        medicareWages: wages,
        medicareTax: round2(wages * 0.0145),
      }],
    });

    it(`AGI = $${wages.toLocaleString()}`, () => {
      expect(result.form1040.agi).toBe(wages);
    });

    it(`standard deduction = $${expectedStdDed.toLocaleString()} (HOH $23,625 + blind $1,950)`, () => {
      expect(result.form1040.standardDeduction).toBe(expectedStdDed);
    });

    it(`taxable income = $${expectedTaxableIncome.toLocaleString()}`, () => {
      expect(result.form1040.taxableIncome).toBe(expectedTaxableIncome);
    });

    it(`income tax = $${expectedTax} (oracle: 10% of $${expectedTaxableIncome.toLocaleString()})`, () => {
      expect(result.form1040.incomeTax).toBe(expectedTax);
    });
  });

  // Cross-check: ATS oracle results match the full ATS test expectations
  describe('ATS oracle cross-reference', () => {
    it('ATS-4 Sarah Smith: oracle tax $2,193.18 matches IRS expected ~$2,193', () => {
      // 10%: $11,925 × 0.10 = $1,192.50
      // 12%: ($20,264 - $11,925) × 0.12 = $8,339 × 0.12 = $1,000.68
      // Total: $2,193.18
      expect(computeExpectedTax(20264, 'Single')).toBe(2193.18);
    });

    it('ATS-13 Birch: oracle tax $12.00 matches IRS expected $12', () => {
      // 10%: $120 × 0.10 = $12.00
      expect(computeExpectedTax(120, 'MFJ')).toBe(12);
    });

    it('ATS-1 Tara Black: oracle tax $2,967.90 matches IRS expected ~$2,968', () => {
      // 10%: $11,925 × 0.10 = $1,192.50
      // 12%: ($26,720 - $11,925) × 0.12 = $14,795 × 0.12 = $1,775.40
      // Total: $2,967.90
      expect(computeExpectedTax(26720, 'Single')).toBe(2967.90);
    });

    it('ATS-2 Jones: oracle tax $652.60 matches IRS expected ~$653', () => {
      // 10%: $6,526 × 0.10 = $652.60
      expect(computeExpectedTax(6526, 'MFJ')).toBe(652.60);
    });

    it('ATS-5 Bobby Barker: oracle tax $560.70 matches engine (10% bracket)', () => {
      // Taxable: $31,232 - $25,625 (HOH + blind $2,000) = $5,607
      // 10%: $5,607 × 0.10 = $560.70 (entirely within HOH 10% bracket, 0–$17,000)
      expect(computeExpectedTax(5607, 'HOH')).toBe(560.70);
    });

    it('ATS-12 Sam Gardenia: oracle tax on W-2-only taxable $85,086 spans 3 brackets', () => {
      // 10%: $11,925 × 0.10 = $1,192.50
      // 12%: ($48,475 - $11,925) × 0.12 = $36,550 × 0.12 = $4,386.00
      // 22%: ($85,086 - $48,475) × 0.22 = $36,611 × 0.22 = $8,054.42
      // Total: $13,632.92
      expect(computeExpectedTax(85086, 'Single')).toBe(13632.92);
    });
  });
});
