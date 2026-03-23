/**
 * Duplicate Detection Unit Tests
 *
 * Tests name normalization, amount matching, and per-type duplicate detection
 * for all supported import types (W-2, 1099-NEC/INT/DIV/R/G/MISC, 1099-B, 1099-DA).
 */

import { describe, it, expect } from 'vitest';
import { checkForDuplicates, checkBatchForDuplicates } from '../services/duplicateDetection';
import type { TaxReturn } from '@telostax/engine';

// ─── Helpers ─────────────────────────────────────

/** Minimal TaxReturn stub with only the fields we need */
function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return',
    schemaVersion: 1,
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
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
    rentalProperties: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    businesses: [],
    otherIncome: 0,
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as TaxReturn;
}

// ═══════════════════════════════════════════════════════════════════════════════
// W-2 DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('W-2 duplicate detection', () => {
  const taxReturn = makeTaxReturn({
    w2Income: [
      { id: 'w2-1', employerName: 'Acme Corporation', wages: 75000, federalTaxWithheld: 12000 },
      { id: 'w2-2', employerName: 'Big Tech Inc.', wages: 120000, federalTaxWithheld: 25000 },
    ],
  });

  it('detects exact duplicate (same name + same wages)', () => {
    const result = checkForDuplicates(taxReturn, 'w2', {
      employerName: 'Acme Corporation',
      wages: 75000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].confidence).toBe('exact');
    expect(result.matches[0].existingId).toBe('w2-1');
  });

  it('detects likely duplicate (same name, different wages)', () => {
    const result = checkForDuplicates(taxReturn, 'w2', {
      employerName: 'Acme Corporation',
      wages: 80000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('likely');
  });

  it('matches case-insensitively', () => {
    const result = checkForDuplicates(taxReturn, 'w2', {
      employerName: 'ACME CORPORATION',
      wages: 75000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
  });

  it('strips common suffixes (Inc, LLC, Corp)', () => {
    const result = checkForDuplicates(taxReturn, 'w2', {
      employerName: 'Big Tech',
      wages: 120000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].existingId).toBe('w2-2');
  });

  it('does not flag a genuinely new employer', () => {
    const result = checkForDuplicates(taxReturn, 'w2', {
      employerName: 'Totally Different Company',
      wages: 75000,
    });
    expect(result.hasDuplicates).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it('handles empty w2Income array', () => {
    const emptyReturn = makeTaxReturn({ w2Income: [] });
    const result = checkForDuplicates(emptyReturn, 'w2', {
      employerName: 'Acme Corporation',
      wages: 75000,
    });
    expect(result.hasDuplicates).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-NEC DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-NEC duplicate detection', () => {
  const taxReturn = makeTaxReturn({
    income1099NEC: [
      { id: 'nec-1', payerName: 'Freelance Client LLC', amount: 5000 },
    ],
  });

  it('detects exact duplicate', () => {
    const result = checkForDuplicates(taxReturn, '1099nec', {
      payerName: 'Freelance Client LLC',
      amount: 5000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
  });

  it('detects likely duplicate (name match, different amount)', () => {
    const result = checkForDuplicates(taxReturn, '1099nec', {
      payerName: 'Freelance Client',
      amount: 7500,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('likely');
  });

  it('no duplicate for different payer', () => {
    const result = checkForDuplicates(taxReturn, '1099nec', {
      payerName: 'Other Client',
      amount: 5000,
    });
    expect(result.hasDuplicates).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-INT DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-INT duplicate detection', () => {
  const taxReturn = makeTaxReturn({
    income1099INT: [
      { id: 'int-1', payerName: 'Chase Bank', amount: 1250 },
    ],
  });

  it('detects exact duplicate', () => {
    const result = checkForDuplicates(taxReturn, '1099int', {
      payerName: 'Chase Bank',
      amount: 1250,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
  });

  it('matches substring (Chase vs JPMorgan Chase)', () => {
    const tr = makeTaxReturn({
      income1099INT: [
        { id: 'int-1', payerName: 'JPMorgan Chase', amount: 1250 },
      ],
    });
    const result = checkForDuplicates(tr, '1099int', {
      payerName: 'Chase',
      amount: 1250,
    });
    expect(result.hasDuplicates).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-DIV DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-DIV duplicate detection', () => {
  const taxReturn = makeTaxReturn({
    income1099DIV: [
      { id: 'div-1', payerName: 'Vanguard', ordinaryDividends: 3000, qualifiedDividends: 2500 },
    ],
  });

  it('detects exact duplicate on ordinaryDividends', () => {
    const result = checkForDuplicates(taxReturn, '1099div', {
      payerName: 'Vanguard',
      ordinaryDividends: 3000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-R DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-R duplicate detection', () => {
  const taxReturn = makeTaxReturn({
    income1099R: [
      { id: 'r-1', payerName: 'Fidelity Investments', grossDistribution: 50000, taxableAmount: 50000 },
    ],
  });

  it('detects exact duplicate on grossDistribution', () => {
    const result = checkForDuplicates(taxReturn, '1099r', {
      payerName: 'Fidelity Investments',
      grossDistribution: 50000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-G DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-G duplicate detection', () => {
  const taxReturn = makeTaxReturn({
    income1099G: [
      { id: 'g-1', payerName: 'California EDD', unemploymentCompensation: 8000 },
    ],
  });

  it('detects exact duplicate', () => {
    const result = checkForDuplicates(taxReturn, '1099g', {
      payerName: 'California EDD',
      unemploymentCompensation: 8000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-MISC DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-MISC duplicate detection', () => {
  const taxReturn = makeTaxReturn({
    income1099MISC: [
      { id: 'misc-1', payerName: 'Rental Agency', otherIncome: 2000 },
    ],
  });

  it('detects exact duplicate', () => {
    const result = checkForDuplicates(taxReturn, '1099misc', {
      payerName: 'Rental Agency',
      otherIncome: 2000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-K DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-K duplicate detection', () => {
  const taxReturn = makeTaxReturn({
    income1099K: [
      { id: 'k-1', platformName: 'Uber Technologies', grossAmount: 45000, cardNotPresent: 0, federalTaxWithheld: 500 },
    ],
  });

  it('detects exact duplicate (name + grossAmount)', () => {
    const result = checkForDuplicates(taxReturn, '1099k', {
      platformName: 'Uber Technologies',
      grossAmount: 45000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
    expect(result.matches[0].existingId).toBe('k-1');
  });

  it('detects likely duplicate (name match, different amount)', () => {
    const result = checkForDuplicates(taxReturn, '1099k', {
      platformName: 'Uber Technologies',
      grossAmount: 50000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('likely');
  });

  it('no duplicate for different platform', () => {
    const result = checkForDuplicates(taxReturn, '1099k', {
      platformName: 'Lyft',
      grossAmount: 45000,
    });
    expect(result.hasDuplicates).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SSA-1099 DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('SSA-1099 duplicate detection', () => {
  it('detects exact duplicate when SSA-1099 already exists', () => {
    const taxReturn = makeTaxReturn({
      incomeSSA1099: { id: 'ssa-1', totalBenefits: 24000, federalTaxWithheld: 3000 } as any,
    });
    const result = checkForDuplicates(taxReturn, 'ssa1099', {
      totalBenefits: 24000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
    expect(result.matches[0].existingId).toBe('ssa-1');
  });

  it('detects likely duplicate when amounts differ', () => {
    const taxReturn = makeTaxReturn({
      incomeSSA1099: { id: 'ssa-1', totalBenefits: 24000, federalTaxWithheld: 3000 } as any,
    });
    const result = checkForDuplicates(taxReturn, 'ssa1099', {
      totalBenefits: 30000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('likely');
  });

  it('no duplicate when no SSA-1099 exists', () => {
    const taxReturn = makeTaxReturn(); // incomeSSA1099 is undefined
    const result = checkForDuplicates(taxReturn, 'ssa1099', {
      totalBenefits: 24000,
    });
    expect(result.hasDuplicates).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-SA DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-SA duplicate detection', () => {
  const taxReturn = makeTaxReturn({
    income1099SA: [
      { id: 'sa-1', payerName: 'HSA Bank', grossDistribution: 2500, distributionCode: '1' },
    ],
  });

  it('detects exact duplicate (name + amount)', () => {
    const result = checkForDuplicates(taxReturn, '1099sa', {
      payerName: 'HSA Bank',
      grossDistribution: 2500,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
    expect(result.matches[0].existingId).toBe('sa-1');
  });

  it('detects likely duplicate (name match only)', () => {
    const result = checkForDuplicates(taxReturn, '1099sa', {
      payerName: 'HSA Bank',
      grossDistribution: 5000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('likely');
  });

  it('no duplicate for different payer', () => {
    const result = checkForDuplicates(taxReturn, '1099sa', {
      payerName: 'Fidelity HSA',
      grossDistribution: 2500,
    });
    expect(result.hasDuplicates).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-Q DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-Q duplicate detection', () => {
  const taxReturn = makeTaxReturn({
    income1099Q: [
      { id: 'q-1', payerName: 'Vanguard 529', grossDistribution: 15000, earnings: 3000, basisReturn: 12000, qualifiedExpenses: 15000, distributionType: 'qualified' as const },
    ],
  });

  it('detects exact duplicate (name + amount)', () => {
    const result = checkForDuplicates(taxReturn, '1099q', {
      payerName: 'Vanguard 529',
      grossDistribution: 15000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
    expect(result.matches[0].existingId).toBe('q-1');
  });

  it('detects likely duplicate (name match only)', () => {
    const result = checkForDuplicates(taxReturn, '1099q', {
      payerName: 'Vanguard 529',
      grossDistribution: 20000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('likely');
  });

  it('no duplicate for different payer', () => {
    const result = checkForDuplicates(taxReturn, '1099q', {
      payerName: 'Fidelity 529',
      grossDistribution: 15000,
    });
    expect(result.hasDuplicates).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-B DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-B duplicate detection', () => {
  const taxReturn = makeTaxReturn({
    income1099B: [
      {
        id: 'b-1', brokerName: 'Schwab', description: '100 shares AAPL',
        dateSold: '2025-06-15', proceeds: 15000, costBasis: 12000, isLongTerm: true,
      },
      {
        id: 'b-2', brokerName: 'Schwab', description: '50 shares MSFT',
        dateSold: '2025-07-01', proceeds: 20000, costBasis: 18000, isLongTerm: false,
      },
    ],
  });

  it('detects exact duplicate (broker + description + date + proceeds)', () => {
    const result = checkForDuplicates(taxReturn, '1099b', {
      brokerName: 'Schwab',
      description: '100 shares AAPL',
      dateSold: '2025-06-15',
      proceeds: 15000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
    expect(result.matches[0].existingId).toBe('b-1');
  });

  it('does not flag different description same broker', () => {
    const result = checkForDuplicates(taxReturn, '1099b', {
      brokerName: 'Schwab',
      description: '200 shares GOOG',
      dateSold: '2025-06-15',
      proceeds: 15000,
    });
    expect(result.hasDuplicates).toBe(false);
  });

  it('does not flag same description different date', () => {
    const result = checkForDuplicates(taxReturn, '1099b', {
      brokerName: 'Schwab',
      description: '100 shares AAPL',
      dateSold: '2025-08-20',
      proceeds: 15000,
    });
    expect(result.hasDuplicates).toBe(false);
  });

  it('detects duplicate for summary imports (PDF) matching on broker name', () => {
    const result = checkForDuplicates(taxReturn, '1099b', {
      brokerName: 'Schwab',
      description: 'Consolidated Summary (PDF Import)',
      dateSold: undefined,
      proceeds: 15000,
    });
    expect(result.hasDuplicates).toBe(true);
    // Should match any existing Schwab entry
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('does not flag summary import for different broker', () => {
    const result = checkForDuplicates(taxReturn, '1099b', {
      brokerName: 'Fidelity',
      description: 'Consolidated Summary (PDF Import)',
      dateSold: undefined,
      proceeds: 15000,
    });
    expect(result.hasDuplicates).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1099-DA DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('1099-DA duplicate detection', () => {
  const taxReturn = makeTaxReturn({
    income1099DA: [
      {
        id: 'da-1', brokerName: 'Coinbase', tokenName: 'Bitcoin',
        dateSold: '2025-03-10', proceeds: 50000, costBasis: 30000, isLongTerm: true,
      },
    ],
  });

  it('detects exact duplicate (broker + token + date + proceeds)', () => {
    const result = checkForDuplicates(taxReturn, '1099da', {
      brokerName: 'Coinbase',
      tokenName: 'Bitcoin',
      dateSold: '2025-03-10',
      proceeds: 50000,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
  });

  it('does not flag different token same broker', () => {
    const result = checkForDuplicates(taxReturn, '1099da', {
      brokerName: 'Coinbase',
      tokenName: 'Ethereum',
      dateSold: '2025-03-10',
      proceeds: 50000,
    });
    expect(result.hasDuplicates).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH DUPLICATE DETECTION (CSV)
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkBatchForDuplicates', () => {
  const taxReturn = makeTaxReturn({
    income1099B: [
      {
        id: 'b-1', brokerName: 'Fidelity', description: '100 shares AAPL',
        dateSold: '2025-06-15', proceeds: 15000, costBasis: 12000, isLongTerm: true,
      },
    ],
  });

  it('counts duplicates in a batch', () => {
    const items = [
      { brokerName: 'Fidelity', description: '100 shares AAPL', dateSold: '2025-06-15', proceeds: 15000 },
      { brokerName: 'Fidelity', description: '50 shares GOOG', dateSold: '2025-07-01', proceeds: 8000 },
      { brokerName: 'Fidelity', description: '100 shares AAPL', dateSold: '2025-06-15', proceeds: 15000 },
    ];
    const result = checkBatchForDuplicates(taxReturn, '1099b', items);
    expect(result.duplicateCount).toBe(2); // items[0] and items[2] match b-1
    expect(result.totalCount).toBe(3);
  });

  it('returns zero duplicates for new items', () => {
    const items = [
      { brokerName: 'Fidelity', description: '200 shares TSLA', dateSold: '2025-08-01', proceeds: 40000 },
    ];
    const result = checkBatchForDuplicates(taxReturn, '1099b', items);
    expect(result.duplicateCount).toBe(0);
    expect(result.totalCount).toBe(1);
  });

  it('handles unknown income type gracefully', () => {
    const result = checkBatchForDuplicates(taxReturn, 'unknown_type', [{ foo: 'bar' }]);
    expect(result.duplicateCount).toBe(0);
    expect(result.totalCount).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('edge cases', () => {
  it('handles unknown income type', () => {
    const tr = makeTaxReturn();
    const result = checkForDuplicates(tr, 'unknown_type', { payerName: 'Test' });
    expect(result.hasDuplicates).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it('handles missing name fields', () => {
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w2-1', employerName: 'Acme', wages: 50000, federalTaxWithheld: 8000 }],
    });
    const result = checkForDuplicates(tr, 'w2', { wages: 50000 });
    expect(result.hasDuplicates).toBe(false);
  });

  it('handles null/undefined taxReturn arrays', () => {
    const tr = makeTaxReturn();
    // Force undefined to simulate missing array
    (tr as any).w2Income = undefined;
    const result = checkForDuplicates(tr, 'w2', { employerName: 'Test', wages: 1000 });
    expect(result.hasDuplicates).toBe(false);
  });

  it('handles float rounding in amount matching', () => {
    const tr = makeTaxReturn({
      income1099INT: [{ id: 'int-1', payerName: 'Bank', amount: 1234.56 }],
    });
    // Amount within 1 cent should match
    const result = checkForDuplicates(tr, '1099int', { payerName: 'Bank', amount: 1234.561 });
    expect(result.hasDuplicates).toBe(true);
    expect(result.matches[0].confidence).toBe('exact');
  });

  it('handles punctuation in names', () => {
    const tr = makeTaxReturn({
      w2Income: [{ id: 'w2-1', employerName: "McDonald's Corp.", wages: 30000, federalTaxWithheld: 4000 }],
    });
    const result = checkForDuplicates(tr, 'w2', { employerName: 'McDonalds Corp', wages: 30000 });
    expect(result.hasDuplicates).toBe(true);
  });
});
