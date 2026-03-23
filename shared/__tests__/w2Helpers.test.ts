/**
 * Tests for W-2 Helper Utilities.
 *
 * Validates Box 12 aggregation and Box 13 extraction functions
 * used for auto-deriving retirement plan coverage, salary deferrals,
 * and HSA employer contributions from W-2 data.
 *
 * @authority IRS Form W-2 Instructions — Box 12 Codes, Box 13 Checkboxes
 */

import { describe, it, expect } from 'vitest';
import { sumBox12Codes, hasRetirementPlanCoverage, totalSalaryDeferrals, totalEmployerHSAContributions } from '../src/engine/w2Helpers.js';
import { W2Income } from '../src/types/index.js';

// ─── Helper: minimal W-2 ────────────────────────────
function makeW2(overrides: Partial<W2Income> = {}): W2Income {
  return {
    id: 'test',
    employerName: 'Test Corp',
    wages: 100000,
    federalTaxWithheld: 15000,
    ...overrides,
  };
}

// ─── sumBox12Codes ──────────────────────────────────

describe('sumBox12Codes', () => {
  it('sums a single matching code from one W-2', () => {
    const w2s = [makeW2({ box12: [{ code: 'D', amount: 5000 }] })];
    expect(sumBox12Codes(w2s, ['D'])).toBe(5000);
  });

  it('sums multiple matching codes from one W-2', () => {
    const w2s = [makeW2({
      box12: [
        { code: 'D', amount: 5000 },
        { code: 'W', amount: 2000 },
        { code: 'DD', amount: 12000 },
      ],
    })];
    expect(sumBox12Codes(w2s, ['D', 'W'])).toBe(7000);
  });

  it('sums across multiple W-2s', () => {
    const w2s = [
      makeW2({ id: 'w2-1', box12: [{ code: 'D', amount: 5000 }] }),
      makeW2({ id: 'w2-2', box12: [{ code: 'D', amount: 3000 }] }),
    ];
    expect(sumBox12Codes(w2s, ['D'])).toBe(8000);
  });

  it('returns 0 when no matching codes', () => {
    const w2s = [makeW2({ box12: [{ code: 'DD', amount: 12000 }] })];
    expect(sumBox12Codes(w2s, ['D'])).toBe(0);
  });

  it('returns 0 when box12 is undefined', () => {
    const w2s = [makeW2()];
    expect(sumBox12Codes(w2s, ['D'])).toBe(0);
  });

  it('returns 0 when box12 is empty array', () => {
    const w2s = [makeW2({ box12: [] })];
    expect(sumBox12Codes(w2s, ['D'])).toBe(0);
  });

  it('returns 0 for empty W-2 array', () => {
    expect(sumBox12Codes([], ['D'])).toBe(0);
  });

  it('handles fractional amounts with rounding', () => {
    const w2s = [makeW2({
      box12: [
        { code: 'D', amount: 1234.567 },
        { code: 'D', amount: 2345.678 },
      ],
    })];
    expect(sumBox12Codes(w2s, ['D'])).toBe(3580.25); // round2(3580.245)
  });
});

// ─── hasRetirementPlanCoverage ───────────────────────

describe('hasRetirementPlanCoverage', () => {
  it('returns true when one W-2 has retirement plan checked', () => {
    const w2s = [makeW2({ box13: { retirementPlan: true } })];
    expect(hasRetirementPlanCoverage(w2s)).toBe(true);
  });

  it('returns true when any W-2 has retirement plan checked', () => {
    const w2s = [
      makeW2({ id: 'w2-1' }),
      makeW2({ id: 'w2-2', box13: { retirementPlan: true } }),
    ];
    expect(hasRetirementPlanCoverage(w2s)).toBe(true);
  });

  it('returns false when no W-2 has retirement plan', () => {
    const w2s = [
      makeW2({ id: 'w2-1' }),
      makeW2({ id: 'w2-2', box13: { statutoryEmployee: true } }),
    ];
    expect(hasRetirementPlanCoverage(w2s)).toBe(false);
  });

  it('returns false when box13 is undefined', () => {
    const w2s = [makeW2()];
    expect(hasRetirementPlanCoverage(w2s)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasRetirementPlanCoverage([])).toBe(false);
  });

  it('returns false when retirementPlan is explicitly false', () => {
    const w2s = [makeW2({ box13: { retirementPlan: false } })];
    expect(hasRetirementPlanCoverage(w2s)).toBe(false);
  });
});

// ─── totalSalaryDeferrals ───────────────────────────

describe('totalSalaryDeferrals', () => {
  it('sums all deferral codes (D, E, G, S, AA, etc.)', () => {
    const w2s = [makeW2({
      box12: [
        { code: 'D', amount: 5000 },   // 401k
        { code: 'AA', amount: 3000 },  // Roth 401k
        { code: 'W', amount: 2000 },   // HSA — NOT a deferral
      ],
    })];
    expect(totalSalaryDeferrals(w2s)).toBe(8000);
  });

  it('includes 403b and 457b codes', () => {
    const w2s = [makeW2({
      box12: [
        { code: 'E', amount: 4000 },   // 403b
        { code: 'G', amount: 3000 },   // 457b
        { code: 'BB', amount: 2000 },  // Roth 403b
        { code: 'EE', amount: 1000 },  // Roth 457b
      ],
    })];
    expect(totalSalaryDeferrals(w2s)).toBe(10000);
  });

  it('includes SIMPLE (S) and SEP (F) and 501c18D (H)', () => {
    const w2s = [makeW2({
      box12: [
        { code: 'S', amount: 3000 },
        { code: 'F', amount: 2000 },
        { code: 'H', amount: 1000 },
      ],
    })];
    expect(totalSalaryDeferrals(w2s)).toBe(6000);
  });
});

// ─── totalEmployerHSAContributions ──────────────────

describe('totalEmployerHSAContributions', () => {
  it('sums code W across W-2s', () => {
    const w2s = [
      makeW2({ id: 'w2-1', box12: [{ code: 'W', amount: 1500 }] }),
      makeW2({ id: 'w2-2', box12: [{ code: 'W', amount: 500 }] }),
    ];
    expect(totalEmployerHSAContributions(w2s)).toBe(2000);
  });

  it('returns 0 when no code W entries', () => {
    const w2s = [makeW2({ box12: [{ code: 'D', amount: 5000 }] })];
    expect(totalEmployerHSAContributions(w2s)).toBe(0);
  });
});
