/**
 * Phase 6: Smoke Test Generation — Filing Status × Income Type Matrix
 *
 * Generates ~55 smoke tests covering every filing status with every income type.
 * These tests verify:
 *   1. No runtime errors / crashes
 *   2. No NaN in key output fields
 *   3. Structural invariants (AGI ≥ 0 for positive income, tax ≥ 0, etc.)
 *   4. Standard deduction applied correctly per filing status
 *
 * NOT verified: exact dollar amounts (those belong in hand-computed e2e tests).
 */
import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { TaxReturn, FilingStatus } from '../src/types/index.js';
import { STANDARD_DEDUCTION_2025 } from '../src/constants/tax2025.js';

// ── Helper ──────────────────────────────────────────────────────────────────

function makeTaxReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    id: 'smoke-test',
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'review',
    schemaVersion: 1,
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
    incomeW2G: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    rentalProperties: [],
    otherIncome: 0,
    businesses: [],
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

/** Assert no NaN in critical output fields */
function assertNoNaN(f: Record<string, unknown>, label: string) {
  const criticalFields = [
    'totalWages', 'agi', 'taxableIncome', 'incomeTax',
    'totalTax', 'totalPayments', 'refundAmount', 'amountOwed',
    'deductionAmount', 'standardDeduction',
  ];
  for (const field of criticalFields) {
    expect(f[field], `${label}: ${field} should not be NaN`).not.toBeNaN();
  }
}

/** Assert basic structural invariants */
function assertStructuralInvariants(f: Record<string, unknown>, label: string) {
  assertNoNaN(f, label);
  // Tax should never be negative
  expect(f.incomeTax as number, `${label}: incomeTax ≥ 0`).toBeGreaterThanOrEqual(0);
  expect(f.totalTax as number, `${label}: totalTax ≥ 0`).toBeGreaterThanOrEqual(0);
  // Taxable income should never be negative
  expect(f.taxableIncome as number, `${label}: taxableIncome ≥ 0`).toBeGreaterThanOrEqual(0);
}

// ── Filing Status Constants ─────────────────────────────────────────────────

const FILING_STATUSES = [
  { status: FilingStatus.Single, name: 'Single' },
  { status: FilingStatus.MarriedFilingJointly, name: 'MFJ' },
  { status: FilingStatus.MarriedFilingSeparately, name: 'MFS' },
  { status: FilingStatus.HeadOfHousehold, name: 'HoH' },
  { status: FilingStatus.QualifyingSurvivingSpouse, name: 'QSS' },
];

// ── Income Type Factories ───────────────────────────────────────────────────

const INCOME_TYPES: { name: string; overrides: Partial<TaxReturn> }[] = [
  {
    name: 'W-2 only ($60k)',
    overrides: {
      w2Income: [{ id: 'w1', employerName: 'Test Co', wages: 60000, federalTaxWithheld: 7000 }],
    },
  },
  {
    name: '1099-NEC freelance ($50k)',
    overrides: {
      income1099NEC: [{ id: 'n1', payerName: 'Client A', amount: 50000 }],
      businesses: [{ id: 'b1', businessName: 'Freelance', accountingMethod: 'cash' as const, didStartThisYear: false }],
    },
  },
  {
    name: '1099-INT interest ($5k)',
    overrides: {
      income1099INT: [{ id: 'i1', payerName: 'Bank A', amount: 5000 }],
    },
  },
  {
    name: '1099-DIV dividends ($10k ord / $8k qual)',
    overrides: {
      income1099DIV: [{ id: 'd1', payerName: 'Vanguard', ordinaryDividends: 10000, qualifiedDividends: 8000 }],
    },
  },
  {
    name: '1099-B long-term cap gain ($20k)',
    overrides: {
      income1099B: [{ id: 'b1', brokerName: 'Schwab', description: '100 sh AAPL', dateSold: '2025-06-01', proceeds: 30000, costBasis: 10000, isLongTerm: true }],
    },
  },
  {
    name: '1099-B short-term cap gain ($15k)',
    overrides: {
      income1099B: [{ id: 'b1', brokerName: 'Schwab', description: '50 sh TSLA', dateSold: '2025-03-01', proceeds: 25000, costBasis: 10000, isLongTerm: false }],
    },
  },
  {
    name: '1099-R retirement ($30k, code 7)',
    overrides: {
      income1099R: [{ id: 'r1', payerName: 'Fidelity', grossDistribution: 30000, taxableAmount: 30000, federalTaxWithheld: 3000, distributionCode: '7' }],
    },
  },
  {
    name: '1099-G unemployment ($12k)',
    overrides: {
      income1099G: [{ id: 'g1', payerName: 'State UI', unemploymentCompensation: 12000, federalTaxWithheld: 1200 }],
    },
  },
  {
    name: 'SSA-1099 Social Security ($20k) + W-2 ($30k)',
    overrides: {
      // SS alone → AGI=0 (not taxable when it's sole income). Add W-2 to trigger provisional income.
      w2Income: [{ id: 'w1', employerName: 'Part-time', wages: 30000, federalTaxWithheld: 3000 }],
      incomeSSA1099: { id: 'ss1', totalBenefits: 20000, federalTaxWithheld: 0 },
    },
  },
  {
    name: 'K-1 partnership ordinary ($40k)',
    overrides: {
      incomeK1: [{ id: 'k1', entityName: 'Partner LLC', entityType: 'partnership' as const, ordinaryBusinessIncome: 40000 }],
    },
  },
  {
    name: 'Rental income ($18k net)',
    overrides: {
      rentalProperties: [{
        id: 'rp1', address: '123 Main St', propertyType: 'single_family' as const,
        daysRented: 365, personalUseDays: 0, rentalIncome: 24000,
        mortgageInterest: 3000, taxes: 2000, insurance: 1000,
      }],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Filing Status × Income Type Matrix (5 × 11 = 55 combos)
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Filing Status × Income Type', () => {
  for (const fs of FILING_STATUSES) {
    describe(`${fs.name}`, () => {
      for (const income of INCOME_TYPES) {
        it(`${income.name} — no crash, valid structure`, () => {
          const taxReturn = makeTaxReturn({
            filingStatus: fs.status,
            ...income.overrides,
          });
          const result = calculateForm1040(taxReturn);
          const f = result.form1040;

          assertStructuralInvariants(f as unknown as Record<string, unknown>, `${fs.name} + ${income.name}`);

          // Standard deduction should match filing status
          const expectedStdDed = STANDARD_DEDUCTION_2025[fs.status];
          expect(f.standardDeduction).toBe(expectedStdDed);

          // AGI should be positive for positive income
          expect(f.agi).toBeGreaterThan(0);
        });
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge Cases: Empty & Zero Returns per Filing Status
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Empty Returns by Filing Status', () => {
  for (const fs of FILING_STATUSES) {
    it(`${fs.name} — empty return produces zero tax`, () => {
      const taxReturn = makeTaxReturn({ filingStatus: fs.status });
      const result = calculateForm1040(taxReturn);
      const f = result.form1040;

      assertNoNaN(f as unknown as Record<string, unknown>, `${fs.name} empty`);
      expect(f.agi).toBe(0);
      expect(f.taxableIncome).toBe(0);
      expect(f.incomeTax).toBe(0);
      expect(f.totalTax).toBe(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Multi-Income Combos — Two Income Types Together
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Multi-Income Combos (Single)', () => {
  it('W-2 + interest + dividends', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 50000, federalTaxWithheld: 6000 }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 2000 }],
      income1099DIV: [{ id: 'd1', payerName: 'Fund', ordinaryDividends: 3000, qualifiedDividends: 2000 }],
    });
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    assertStructuralInvariants(f as unknown as Record<string, unknown>, 'W-2+INT+DIV');
    expect(f.agi).toBe(55000);
  });

  it('W-2 + 1099-NEC (mixed employee/freelance)', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 40000, federalTaxWithheld: 4000 }],
      income1099NEC: [{ id: 'n1', payerName: 'Side Gig', amount: 20000 }],
      businesses: [{ id: 'b1', businessName: 'Side', accountingMethod: 'cash' as const, didStartThisYear: false }],
    });
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    assertStructuralInvariants(f as unknown as Record<string, unknown>, 'W-2+NEC');
    // AGI should be slightly below $60k due to deductible half of SE tax
    expect(f.agi).toBeLessThan(60000);
    expect(f.agi).toBeGreaterThan(55000);
  });

  it('1099-R + SSA-1099 (retiree)', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      income1099R: [{ id: 'r1', payerName: 'Fidelity', grossDistribution: 40000, taxableAmount: 40000, federalTaxWithheld: 5000, distributionCode: '7' }],
      incomeSSA1099: { id: 'ss1', totalBenefits: 24000, federalTaxWithheld: 0 },
    });
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    assertStructuralInvariants(f as unknown as Record<string, unknown>, 'Retiree');
    // Some portion of SS should be taxable when combined with $40k pension
    expect(f.agi).toBeGreaterThan(40000);
  });

  it('1099-B LTCG + 1099-B STCG + dividends (investor)', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099B: [
        { id: 'b1', brokerName: 'Schwab', description: 'AAPL', dateSold: '2025-06-01', proceeds: 50000, costBasis: 30000, isLongTerm: true },
        { id: 'b2', brokerName: 'Schwab', description: 'TSLA', dateSold: '2025-02-01', proceeds: 20000, costBasis: 15000, isLongTerm: false },
      ],
      income1099DIV: [{ id: 'd1', payerName: 'VTI', ordinaryDividends: 5000, qualifiedDividends: 4000 }],
    });
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    assertStructuralInvariants(f as unknown as Record<string, unknown>, 'Investor');
    // AGI = LTCG $20k + STCG $5k + ordinary div $5k = $30k
    expect(f.agi).toBe(30000);
  });

  it('Rental + K-1 + interest (passive income)', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.MarriedFilingJointly,
      rentalProperties: [{
        id: 'rp1', address: '456 Oak', propertyType: 'single_family' as const,
        daysRented: 365, personalUseDays: 0, rentalIncome: 30000,
        mortgageInterest: 5000, taxes: 3000, insurance: 1500, repairs: 1000,
      }],
      incomeK1: [{ id: 'k1', entityName: 'Invest LLC', entityType: 'partnership' as const, ordinaryBusinessIncome: 25000, interestIncome: 2000 }],
      income1099INT: [{ id: 'i1', payerName: 'Bank', amount: 3000 }],
    });
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    assertStructuralInvariants(f as unknown as Record<string, unknown>, 'Passive');
    expect(f.agi).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Loss Scenarios — Capital Losses, Business Losses
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Loss Scenarios', () => {
  it('Capital loss exceeding $3k limit', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 50000, federalTaxWithheld: 5000 }],
      income1099B: [
        { id: 'b1', brokerName: 'Schwab', description: 'Bad stock', dateSold: '2025-06-01', proceeds: 5000, costBasis: 25000, isLongTerm: true },
      ],
    });
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    assertStructuralInvariants(f as unknown as Record<string, unknown>, 'Cap loss');
    // Net loss of $20k, but deduction limited to $3k
    expect(f.agi).toBe(47000); // $50k - $3k cap loss deduction
  });

  it('Business loss (Schedule C)', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 60000, federalTaxWithheld: 7000 }],
      income1099NEC: [{ id: 'n1', payerName: 'Client', amount: 10000 }],
      businesses: [{ id: 'b1', businessName: 'Side Biz', accountingMethod: 'cash' as const, didStartThisYear: false }],
      expenses: [
        { id: 'e1', scheduleCLine: 18, category: 'Office supplies', amount: 25000, businessId: 'b1' },
      ],
    });
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    assertStructuralInvariants(f as unknown as Record<string, unknown>, 'Biz loss');
    // $10k NEC - $25k expenses = -$15k Schedule C loss → offsets W-2 income
    expect(f.agi).toBeLessThan(60000);
  });

  it('Capital loss carryforward from prior year', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      w2Income: [{ id: 'w1', employerName: 'Corp', wages: 50000, federalTaxWithheld: 5000 }],
      // Need a 1099-B (even a zero-gain one) to trigger capital gains/loss processing
      income1099B: [{ id: 'b1', brokerName: 'Broker', description: 'None', dateSold: '2025-06-01', proceeds: 0, costBasis: 0, isLongTerm: true }],
      capitalLossCarryforwardLT: 8000,
    });
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    assertStructuralInvariants(f as unknown as Record<string, unknown>, 'Carryforward');
    // $8k carryforward, limited to $3k deduction → AGI = $50k - $3k = $47k
    expect(f.agi).toBe(47000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Special Income Types — W-2G, 1099-MISC, 1099-SA, other income
// ═══════════════════════════════════════════════════════════════════════════

describe('Phase 6 Smoke: Special Income Types', () => {
  it('W-2G gambling winnings ($10k)', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      incomeW2G: [{ id: 'wg1', payerName: 'Casino', grossWinnings: 10000, federalTaxWithheld: 2500 }],
    });
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    assertStructuralInvariants(f as unknown as Record<string, unknown>, 'Gambling');
    expect(f.agi).toBe(10000);
  });

  it('1099-MISC other income ($8k)', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      income1099MISC: [{ id: 'm1', payerName: 'Contest', otherIncome: 8000 }],
    });
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    assertStructuralInvariants(f as unknown as Record<string, unknown>, '1099-MISC');
    expect(f.agi).toBe(8000);
  });

  it('Other income ($5k)', () => {
    const taxReturn = makeTaxReturn({
      filingStatus: FilingStatus.Single,
      otherIncome: 5000,
    });
    const result = calculateForm1040(taxReturn);
    const f = result.form1040;

    assertStructuralInvariants(f as unknown as Record<string, unknown>, 'Other');
    expect(f.agi).toBe(5000);
  });
});
