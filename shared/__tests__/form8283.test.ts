/**
 * Tests for Form 8283 — Noncash Charitable Contributions.
 *
 * Validates per-item classification into Section A (≤$5,000) and Section B (>$5,000),
 * AGI-based percentage limitations by donation category, 5-year carryforward FIFO
 * processing, and integration with Schedule A and the Form 1040 orchestrator.
 *
 * @authority
 *   IRC: Section 170(b)(1) — Percentage limitations on charitable deductions
 *   IRC: Section 170(d)(1) — 5-year carryforward for excess contributions
 *   IRC: Section 170(f)(11) — Substantiation requirements for noncash donations
 *   Form: Form 8283 (Sections A and B)
 *   Pub: Publication 526 — Charitable Contributions
 */

import { describe, it, expect } from 'vitest';
import { calculateForm8283 } from '../src/engine/form8283.js';
import { calculateScheduleA } from '../src/engine/scheduleA.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { FilingStatus, NonCashDonation, CharitableCarryforward, TaxReturn } from '../src/types/index.js';

// ─── Helper: create a non-cash donation ────────────────────
function makeDonation(overrides: Partial<NonCashDonation> = {}): NonCashDonation {
  return {
    id: 'don-1',
    description: 'Clothing',
    doneeOrganization: 'Goodwill',
    dateOfContribution: '2025-06-15',
    fairMarketValue: 500,
    ...overrides,
  };
}

// ─── Helper: minimal TaxReturn ─────────────────────────────
function makeReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'test-return',
    filingStatus: FilingStatus.Single,
    taxYear: 2025,
    dateOfBirth: '1985-01-15',
    w2Income: [],
    income1099INT: [],
    income1099DIV: [],
    income1099B: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099NEC: [],
    income1099K: [],
    income1099DA: [],
    income1099C: [],
    income1099SA: [],
    incomeW2G: [],
    incomeK1: [],
    dependents: [],
    estimatedTaxPayments: [],
    rentalProperties: [],
    form4797Properties: [],
    ...overrides,
  } as TaxReturn;
}

// ─────────────────────────────────────────────────────────────
// Section 1: Section A vs Section B Classification
// ─────────────────────────────────────────────────────────────

describe('Form 8283 — Section A vs Section B classification', () => {
  it('classifies items ≤ $5,000 as Section A', () => {
    const result = calculateForm8283(0, [
      makeDonation({ id: 'don-1', fairMarketValue: 500 }),
      makeDonation({ id: 'don-2', fairMarketValue: 5000 }),
    ], 100000);

    expect(result.sectionAItems).toHaveLength(2);
    expect(result.sectionBItems).toHaveLength(0);
  });

  it('classifies items > $5,000 as Section B', () => {
    const result = calculateForm8283(0, [
      makeDonation({ id: 'don-1', fairMarketValue: 5001 }),
      makeDonation({ id: 'don-2', fairMarketValue: 10000 }),
    ], 100000);

    expect(result.sectionAItems).toHaveLength(0);
    expect(result.sectionBItems).toHaveLength(2);
  });

  it('splits items between Section A and Section B', () => {
    const result = calculateForm8283(0, [
      makeDonation({ id: 'don-1', fairMarketValue: 3000 }),  // Section A
      makeDonation({ id: 'don-2', fairMarketValue: 7000 }),  // Section B
      makeDonation({ id: 'don-3', fairMarketValue: 500 }),   // Section A
    ], 100000);

    expect(result.sectionAItems).toHaveLength(2);
    expect(result.sectionBItems).toHaveLength(1);
    expect(result.sectionBItems[0].fairMarketValue).toBe(7000);
  });

  it('excludes items with zero FMV', () => {
    const result = calculateForm8283(0, [
      makeDonation({ id: 'don-1', fairMarketValue: 0 }),
      makeDonation({ id: 'don-2', fairMarketValue: 1000 }),
    ], 100000);

    expect(result.sectionAItems).toHaveLength(1);
    expect(result.sectionBItems).toHaveLength(0);
    expect(result.totalNonCashFMV).toBe(1000);
  });

  it('excludes items with negative FMV', () => {
    const result = calculateForm8283(0, [
      makeDonation({ id: 'don-1', fairMarketValue: -500 }),
    ], 100000);

    expect(result.sectionAItems).toHaveLength(0);
    expect(result.totalNonCashFMV).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 2: AGI Limits — Cash (60% AGI)
// ─────────────────────────────────────────────────────────────

describe('Form 8283 — Cash donation AGI limits', () => {
  it('allows cash up to 60% of AGI', () => {
    const result = calculateForm8283(50000, [], 100000);

    // 60% of $100k = $60k; $50k is under limit
    expect(result.allowableCashDeduction).toBe(50000);
  });

  it('caps cash at 60% of AGI', () => {
    const result = calculateForm8283(70000, [], 100000);

    // 60% of $100k = $60k
    expect(result.allowableCashDeduction).toBe(60000);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 3: AGI Limits — Non-Cash by Category
// ─────────────────────────────────────────────────────────────

describe('Form 8283 — Non-cash AGI limits by category', () => {
  it('limits ordinary income property to 50% of AGI', () => {
    // Ordinary income property (not capital gain) → 50% limit
    const result = calculateForm8283(0, [
      makeDonation({ fairMarketValue: 60000, isCapitalGainProperty: false }),
    ], 100000);

    // 50% of $100k = $50k
    expect(result.allowableNonCashDeduction).toBe(50000);
    expect(result.totalNonCashFMV).toBe(60000);
  });

  it('limits capital gain property to 30% of AGI', () => {
    const result = calculateForm8283(0, [
      makeDonation({ fairMarketValue: 40000, isCapitalGainProperty: true }),
    ], 100000);

    // 30% of $100k = $30k
    expect(result.allowableNonCashDeduction).toBe(30000);
    expect(result.totalNonCashFMV).toBe(40000);
  });

  it('applies separate limits to each non-cash category', () => {
    const result = calculateForm8283(0, [
      makeDonation({ id: 'don-1', fairMarketValue: 20000, isCapitalGainProperty: false }),  // Ordinary
      makeDonation({ id: 'don-2', fairMarketValue: 15000, isCapitalGainProperty: true }),   // Capital gain
    ], 100000);

    // Ordinary: min($20k, $50k) = $20k
    // Capital gain: min($15k, $30k) = $15k
    // Total: $35k (under 60% overall = $60k)
    expect(result.allowableNonCashDeduction).toBe(35000);
  });

  it('handles non-cash defaulting to ordinary when isCapitalGainProperty not set', () => {
    const result = calculateForm8283(0, [
      makeDonation({ fairMarketValue: 2000 }), // Default: not capital gain → ordinary → 50% limit
    ], 100000);

    expect(result.allowableNonCashDeduction).toBe(2000);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 4: Overall 60% AGI Limit
// ─────────────────────────────────────────────────────────────

describe('Form 8283 — Overall 60% AGI limit', () => {
  it('applies overall 60% AGI cap when cash + non-cash exceed it', () => {
    const result = calculateForm8283(40000, [
      makeDonation({ fairMarketValue: 30000, isCapitalGainProperty: false }),
    ], 100000);

    // Cash: $40k (under 60% cash limit $60k)
    // Non-cash ordinary: $30k (under 50% limit $50k)
    // Subtotal: $70k → exceeds 60% overall ($60k)
    // Prorated: cash = $40k * (60/70) ≈ $34,285.71; non-cash = $30k * (60/70) ≈ $25,714.29
    const totalDeduction = result.allowableCashDeduction + result.allowableNonCashDeduction;
    expect(totalDeduction).toBe(60000);
  });

  it('does not cap when total is under 60% AGI', () => {
    const result = calculateForm8283(20000, [
      makeDonation({ fairMarketValue: 10000, isCapitalGainProperty: false }),
    ], 100000);

    // Cash: $20k + Non-cash: $10k = $30k, under 60% ($60k)
    expect(result.allowableCashDeduction).toBe(20000);
    expect(result.allowableNonCashDeduction).toBe(10000);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 5: 5-Year Carryforward
// ─────────────────────────────────────────────────────────────

describe('Form 8283 — 5-year carryforward', () => {
  it('uses carryforward when room remains under AGI limits', () => {
    const carryforwards: CharitableCarryforward[] = [
      { year: 2024, amount: 5000, category: 'cash' },
    ];

    const result = calculateForm8283(10000, [], 100000, carryforwards);

    // Cash limit: $60k; current cash: $10k; carryforward: $5k
    // Room: $50k; use all $5k
    expect(result.carryforwardUsed).toBe(5000);
    expect(result.allowableCashDeduction).toBe(15000); // $10k + $5k
  });

  it('uses FIFO ordering (oldest carryforward first)', () => {
    const carryforwards: CharitableCarryforward[] = [
      { year: 2023, amount: 3000, category: 'cash' },
      { year: 2024, amount: 4000, category: 'cash' },
    ];

    // AGI $10k → cash limit $6k. Current cash $5k → room for $1k from CF
    const result = calculateForm8283(5000, [], 10000, carryforwards);

    // Room = $6k - $5k = $1k; uses $1k from 2023 (oldest)
    expect(result.carryforwardUsed).toBe(1000);
    expect(result.allowableCashDeduction).toBe(6000);
  });

  it('expires carryforwards older than 5 years', () => {
    const carryforwards: CharitableCarryforward[] = [
      { year: 2019, amount: 5000, category: 'cash' },  // > 5 years ago → expired
    ];

    const result = calculateForm8283(0, [], 100000, carryforwards);

    expect(result.carryforwardUsed).toBe(0);
  });

  it('generates excess carryforward when donations exceed AGI limits', () => {
    const result = calculateForm8283(70000, [], 100000);

    // Cash limit: $60k; donated $70k → excess $10k
    expect(result.allowableCashDeduction).toBe(60000);
    expect(result.excessCarryforward).toBe(10000);
  });

  it('generates non-cash carryforward when exceeding 30% cap gain limit', () => {
    const result = calculateForm8283(0, [
      makeDonation({ fairMarketValue: 40000, isCapitalGainProperty: true }),
    ], 100000);

    // 30% of $100k = $30k allowed; FMV = $40k; excess = $10k
    expect(result.allowableNonCashDeduction).toBe(30000);
    expect(result.excessCarryforward).toBe(10000);
  });

  it('handles zero carryforward array', () => {
    const result = calculateForm8283(5000, [
      makeDonation({ fairMarketValue: 2000 }),
    ], 100000, []);

    expect(result.carryforwardUsed).toBe(0);
    expect(result.allowableCashDeduction).toBe(5000);
    expect(result.allowableNonCashDeduction).toBe(2000);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 6: Edge Cases
// ─────────────────────────────────────────────────────────────

describe('Form 8283 — Edge cases', () => {
  it('handles empty donations array', () => {
    const result = calculateForm8283(5000, [], 100000);

    expect(result.sectionAItems).toHaveLength(0);
    expect(result.sectionBItems).toHaveLength(0);
    expect(result.totalNonCashFMV).toBe(0);
    expect(result.allowableCashDeduction).toBe(5000);
    expect(result.allowableNonCashDeduction).toBe(0);
  });

  it('handles AGI of $0 (all limits are $0)', () => {
    const result = calculateForm8283(5000, [
      makeDonation({ fairMarketValue: 3000 }),
    ], 0);

    expect(result.allowableCashDeduction).toBe(0);
    expect(result.allowableNonCashDeduction).toBe(0);
    expect(result.excessCarryforward).toBe(8000); // All $8k excess
  });

  it('handles all items in one section', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeDonation({ id: `don-${i}`, fairMarketValue: 1000 })
    );
    const result = calculateForm8283(0, items, 100000);

    expect(result.sectionAItems).toHaveLength(5);
    expect(result.sectionBItems).toHaveLength(0);
    expect(result.totalNonCashFMV).toBe(5000);
  });

  it('returns zero excess when donations are exactly at AGI limit', () => {
    const result = calculateForm8283(60000, [], 100000);

    // Exactly at 60% limit
    expect(result.allowableCashDeduction).toBe(60000);
    expect(result.excessCarryforward).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 7: Schedule A Integration
// ─────────────────────────────────────────────────────────────

describe('Form 8283 → Schedule A integration', () => {
  it('Schedule A uses Form 8283 when nonCashDonations provided', () => {
    const result = calculateScheduleA({
      medicalExpenses: 0,
      stateLocalIncomeTax: 5000,
      realEstateTax: 3000,
      personalPropertyTax: 0,
      mortgageInterest: 8000,
      mortgageInsurancePremiums: 0,
      charitableCash: 2000,
      charitableNonCash: 0,  // Ignored when nonCashDonations provided
      nonCashDonations: [
        makeDonation({ id: 'don-1', fairMarketValue: 3000, isCapitalGainProperty: false }),
      ],
      casualtyLoss: 0,
      otherDeductions: 0,
    }, 100000, FilingStatus.Single);

    // Charitable: $2k cash + $3k non-cash = $5k (well under limits for $100k AGI)
    expect(result.charitableDeduction).toBe(5000);
    expect(result.form8283).toBeDefined();
    expect(result.form8283!.totalNonCashFMV).toBe(3000);
    expect(result.form8283!.sectionAItems).toHaveLength(1);
  });

  it('Schedule A falls back to lump-sum when no nonCashDonations', () => {
    const result = calculateScheduleA({
      medicalExpenses: 0,
      stateLocalIncomeTax: 5000,
      realEstateTax: 3000,
      personalPropertyTax: 0,
      mortgageInterest: 8000,
      mortgageInsurancePremiums: 0,
      charitableCash: 2000,
      charitableNonCash: 1500,
      casualtyLoss: 0,
      otherDeductions: 0,
    }, 100000, FilingStatus.Single);

    // Lump-sum: $2k cash + $1.5k non-cash = $3.5k
    expect(result.charitableDeduction).toBe(3500);
    expect(result.form8283).toBeUndefined();
  });

  it('Schedule A backward compatible with existing tests (no new fields)', () => {
    // Exact same inputs as existing scheduleA.test.ts pattern
    const result = calculateScheduleA({
      medicalExpenses: 15000,
      stateLocalIncomeTax: 8000,
      realEstateTax: 4000,
      personalPropertyTax: 0,
      mortgageInterest: 10000,
      mortgageInsurancePremiums: 0,
      charitableCash: 5000,
      charitableNonCash: 2000,
      casualtyLoss: 0,
      otherDeductions: 500,
    }, 120000, FilingStatus.Single);

    // Medical: $15k - 7.5% of $120k ($9k) = $6k
    expect(result.medicalDeduction).toBe(6000);
    // SALT: $12k capped at $40k = $12k
    expect(result.saltDeduction).toBe(12000);
    // Interest: $10k
    expect(result.interestDeduction).toBe(10000);
    // Charitable: $5k + $2k = $7k (under limits)
    expect(result.charitableDeduction).toBe(7000);
    // Other: $500
    expect(result.otherDeduction).toBe(500);
    // No form8283 result (lump-sum path)
    expect(result.form8283).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// Section 8: E2E — Form 1040 Orchestrator Integration
// ─────────────────────────────────────────────────────────────

describe('Form 8283 → Form 1040 E2E integration', () => {
  it('Form 8283 flows through to CalculationResult when nonCashDonations provided', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 5000,
        realEstateTax: 3000,
        personalPropertyTax: 0,
        mortgageInterest: 10000,
        mortgageInsurancePremiums: 0,
        charitableCash: 5000,
        charitableNonCash: 0,
        nonCashDonations: [
          makeDonation({ id: 'art-1', description: 'Painting', fairMarketValue: 8000, isCapitalGainProperty: true, hasQualifiedAppraisal: true }),
        ],
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    }));

    // Should have Form 8283 result at both levels
    expect(result.scheduleA).toBeDefined();
    expect(result.scheduleA!.form8283).toBeDefined();
    expect(result.form8283).toBeDefined();
    expect(result.form8283!.sectionBItems).toHaveLength(1); // $8k > $5k threshold
    expect(result.form8283!.totalNonCashFMV).toBe(8000);
  });

  it('E2E: K-1 Box 13 non-cash charitable + direct non-cash donations combined', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450 }],
      incomeK1: [{
        id: 'k1-1',
        entityName: 'LP Fund',
        entityType: 'partnership',
        ordinaryBusinessIncome: 20000,
        box13CharitableNonCash: 3000,
      }],
      deductionMethod: 'itemized',
      itemizedDeductions: {
        medicalExpenses: 0,
        stateLocalIncomeTax: 5000,
        realEstateTax: 3000,
        personalPropertyTax: 0,
        mortgageInterest: 10000,
        mortgageInsurancePremiums: 0,
        charitableCash: 2000,
        charitableNonCash: 1000,  // Direct non-cash (lump-sum, added to K-1 non-cash)
        casualtyLoss: 0,
        otherDeductions: 0,
      },
    }));

    // K-1 adds $3k non-cash → effective non-cash = $1k + $3k = $4k
    // Total charitable: $2k cash + $4k non-cash = $6k
    // AGI ~$120k → all under limits
    expect(result.scheduleA).toBeDefined();
    expect(result.scheduleA!.charitableDeduction).toBe(6000);
  });

  it('E2E: no Form 8283 when standard deduction is used', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2', employerName: 'Acme', wages: 50000, federalTaxWithheld: 5000, socialSecurityWages: 50000, socialSecurityTax: 3100, medicareWages: 50000, medicareTax: 725 }],
      deductionMethod: 'standard',
    }));

    expect(result.form8283).toBeUndefined();
    expect(result.form1040.deductionUsed).toBe('standard');
  });
});
