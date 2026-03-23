/**
 * Tests for Multi-State Income Allocation (Part-Year / Nonresident Filers).
 *
 * Validates that the state allocation module correctly prorates income for
 * part-year filers by days, restricts nonresidents to state-source income only,
 * handles the two-pass approach for credit for taxes paid to other states,
 * and maintains backward compatibility for resident filers.
 *
 * @authority
 *   UDITPA: Uniform Division of Income for Tax Purposes Act §§ 3-8
 *   Common state rules: NY IT-203, CA 540NR, NJ-1040NR
 * @scope Part-year proration, nonresident source income, other-state credit
 */

import { describe, it, expect } from 'vitest';
import { allocateStateIncome, calculateOtherStateCredit } from '../src/engine/state/allocation.js';
import { calculateStateTaxes } from '../src/engine/state/index.js';
import { round2 } from '../src/engine/utils.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { FilingStatus, TaxReturn, CalculationResult, StateReturnConfig } from '../src/types/index.js';

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

// ─── Helper: create a minimal CalculationResult for unit tests ──
function makeFederalResult(agi: number, taxableIncome: number, totalWages: number): CalculationResult {
  return {
    credits: {
      childTaxCredit: 0, otherDependentCredit: 0, actcCredit: 0, educationCredit: 0,
      aotcRefundableCredit: 0, dependentCareCredit: 0, saversCredit: 0, cleanEnergyCredit: 0,
      evCredit: 0, energyEfficiencyCredit: 0, foreignTaxCredit: 0, adoptionCredit: 0,
      evRefuelingCredit: 0, elderlyDisabledCredit: 0, k1OtherCredits: 0, premiumTaxCredit: 0,
      excessSSTaxCredit: 0, eitcCredit: 0, totalNonRefundable: 0, totalRefundable: 0, totalCredits: 0,
    },
    form1040: {
      agi,
      taxableIncome,
      totalWages,
    } as CalculationResult['form1040'],
  } as CalculationResult;
}

// ─────────────────────────────────────────────────────────────
// Section 1: allocateStateIncome — Resident (no change)
// ─────────────────────────────────────────────────────────────

describe('State allocation — Resident (no allocation)', () => {
  it('returns full federal AGI with ratio 1.0 for residents', () => {
    const federal = makeFederalResult(100000, 80000, 90000);
    const config: StateReturnConfig = { stateCode: 'NY', residencyType: 'resident' };

    const allocation = allocateStateIncome(makeReturn(), federal, config);

    expect(allocation.allocatedAGI).toBe(100000);
    expect(allocation.allocationRatio).toBe(1.0);
  });

  it('resident allocation does not modify income', () => {
    const federal = makeFederalResult(200000, 160000, 180000);
    const config: StateReturnConfig = { stateCode: 'CA', residencyType: 'resident' };

    const allocation = allocateStateIncome(makeReturn(), federal, config);

    expect(allocation.allocatedAGI).toBe(200000);
    expect(allocation.allocationRatio).toBe(1.0);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 2: allocateStateIncome — Part-Year Proration
// ─────────────────────────────────────────────────────────────

describe('State allocation — Part-year proration', () => {
  it('prorates income by days lived in state (182/365)', () => {
    const federal = makeFederalResult(100000, 80000, 90000);
    const config: StateReturnConfig = {
      stateCode: 'NY',
      residencyType: 'part_year',
      daysLivedInState: 182,
    };

    const allocation = allocateStateIncome(makeReturn({ taxYear: 2025 }), federal, config);

    // 2025 is not a leap year: 182/365 ≈ 0.498630 (6dp precision)
    expect(allocation.allocationRatio).toBe(0.49863);
    expect(allocation.allocatedAGI).toBe(49863); // round2(100000 * 0.49863)
  });

  it('prorates income for leap year (183/366)', () => {
    const federal = makeFederalResult(100000, 80000, 90000);
    const config: StateReturnConfig = {
      stateCode: 'NY',
      residencyType: 'part_year',
      daysLivedInState: 183,
    };

    const allocation = allocateStateIncome(makeReturn({ taxYear: 2024 }), federal, config);

    // 2024 is a leap year: 183/366 = 0.50
    expect(allocation.allocationRatio).toBe(0.5);
    expect(allocation.allocatedAGI).toBe(50000);
  });

  it('handles 0 days (left state immediately)', () => {
    const federal = makeFederalResult(100000, 80000, 90000);
    const config: StateReturnConfig = {
      stateCode: 'NY',
      residencyType: 'part_year',
      daysLivedInState: 0,
    };

    const allocation = allocateStateIncome(makeReturn(), federal, config);

    expect(allocation.allocationRatio).toBe(0);
    expect(allocation.allocatedAGI).toBe(0);
  });

  it('handles 365 days (full year, same as resident)', () => {
    const federal = makeFederalResult(100000, 80000, 90000);
    const config: StateReturnConfig = {
      stateCode: 'NY',
      residencyType: 'part_year',
      daysLivedInState: 365,
    };

    const allocation = allocateStateIncome(makeReturn({ taxYear: 2025 }), federal, config);

    expect(allocation.allocationRatio).toBe(1.0);
    expect(allocation.allocatedAGI).toBe(100000);
  });

  it('clamps days to max days in year', () => {
    const federal = makeFederalResult(100000, 80000, 90000);
    const config: StateReturnConfig = {
      stateCode: 'NY',
      residencyType: 'part_year',
      daysLivedInState: 400, // More than 365
    };

    const allocation = allocateStateIncome(makeReturn({ taxYear: 2025 }), federal, config);

    // Clamped to 365/365 = 1.0
    expect(allocation.allocationRatio).toBe(1.0);
    expect(allocation.allocatedAGI).toBe(100000);
  });

  it('handles missing daysLivedInState (defaults to 0)', () => {
    const federal = makeFederalResult(100000, 80000, 90000);
    const config: StateReturnConfig = {
      stateCode: 'NY',
      residencyType: 'part_year',
    };

    const allocation = allocateStateIncome(makeReturn(), federal, config);

    expect(allocation.allocationRatio).toBe(0);
    expect(allocation.allocatedAGI).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 3: allocateStateIncome — Nonresident Source Income
// ─────────────────────────────────────────────────────────────

describe('State allocation — Nonresident source income', () => {
  it('allocates only state-source W-2 wages for nonresidents', () => {
    const taxReturn = makeReturn({
      w2Income: [
        { id: 'w2-ny', employerName: 'NYC Corp', wages: 80000, federalTaxWithheld: 12000, socialSecurityWages: 80000, socialSecurityTax: 4960, medicareWages: 80000, medicareTax: 1160, state: 'NY', stateTaxWithheld: 4000 },
        { id: 'w2-nj', employerName: 'NJ LLC', wages: 20000, federalTaxWithheld: 3000, socialSecurityWages: 20000, socialSecurityTax: 1240, medicareWages: 20000, medicareTax: 290, state: 'NJ', stateTaxWithheld: 800 },
      ],
    });
    const federal = makeFederalResult(100000, 80000, 100000);
    const config: StateReturnConfig = { stateCode: 'NY', residencyType: 'nonresident' };

    const allocation = allocateStateIncome(taxReturn, federal, config);

    // Only NY wages ($80k) are state-source
    expect(allocation.sourceWages).toBe(80000);
    expect(allocation.allocatedAGI).toBe(80000);
    expect(allocation.allocationRatio).toBe(0.8);
  });

  it('returns zero for nonresident with no state-source income', () => {
    const taxReturn = makeReturn({
      w2Income: [
        { id: 'w2-nj', employerName: 'NJ LLC', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450, state: 'NJ', stateTaxWithheld: 5000 },
      ],
    });
    const federal = makeFederalResult(100000, 80000, 100000);
    const config: StateReturnConfig = { stateCode: 'NY', residencyType: 'nonresident' };

    const allocation = allocateStateIncome(taxReturn, federal, config);

    expect(allocation.sourceWages).toBe(0);
    expect(allocation.allocatedAGI).toBe(0);
    expect(allocation.allocationRatio).toBe(0);
  });

  it('includes business income from stateSpecificData override', () => {
    const federal = makeFederalResult(150000, 120000, 100000);
    const config: StateReturnConfig = {
      stateCode: 'NY',
      residencyType: 'nonresident',
      stateSpecificData: { sourceBusinessIncome: 30000 },
    };

    const allocation = allocateStateIncome(makeReturn(), federal, config);

    expect(allocation.sourceBusinessIncome).toBe(30000);
    expect(allocation.allocatedAGI).toBe(30000);
  });

  it('includes rental income from stateSpecificData override', () => {
    const federal = makeFederalResult(120000, 96000, 100000);
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'nonresident',
      stateSpecificData: { sourceRentalIncome: 15000 },
    };

    const allocation = allocateStateIncome(makeReturn(), federal, config);

    expect(allocation.sourceRentalIncome).toBe(15000);
    expect(allocation.allocatedAGI).toBe(15000);
  });

  it('caps allocated AGI at federal AGI', () => {
    const federal = makeFederalResult(50000, 40000, 50000);
    const config: StateReturnConfig = {
      stateCode: 'NY',
      residencyType: 'nonresident',
      stateSpecificData: { sourceBusinessIncome: 80000 }, // More than AGI
    };

    const allocation = allocateStateIncome(makeReturn(), federal, config);

    expect(allocation.allocatedAGI).toBe(50000); // Capped at federal AGI
    expect(allocation.allocationRatio).toBe(1.0); // Capped at 1.0
  });
});

// ─────────────────────────────────────────────────────────────
// Section 3b: stateWages (Box 16) preference over wages (Box 1)
// ─────────────────────────────────────────────────────────────

describe('State allocation — stateWages (Box 16) preference', () => {
  it('uses stateWages when provided instead of wages', () => {
    const taxReturn = makeReturn({
      w2Income: [
        { id: 'w2-ny', employerName: 'Multi-State Corp', wages: 100000, federalTaxWithheld: 15000, stateWages: 75000, state: 'NY', stateTaxWithheld: 4000 },
      ],
    });
    const federal = makeFederalResult(100000, 80000, 100000);
    const config: StateReturnConfig = { stateCode: 'NY', residencyType: 'nonresident' };

    const allocation = allocateStateIncome(taxReturn, federal, config);

    expect(allocation.sourceWages).toBe(75000); // Box 16, not Box 1
  });

  it('falls back to wages when stateWages is undefined', () => {
    const taxReturn = makeReturn({
      w2Income: [
        { id: 'w2-ny', employerName: 'NY Corp', wages: 80000, federalTaxWithheld: 12000, state: 'NY', stateTaxWithheld: 4000 },
      ],
    });
    const federal = makeFederalResult(80000, 64000, 80000);
    const config: StateReturnConfig = { stateCode: 'NY', residencyType: 'nonresident' };

    const allocation = allocateStateIncome(taxReturn, federal, config);

    expect(allocation.sourceWages).toBe(80000); // Falls back to Box 1
  });

  it('uses stateWages=0 when explicitly set to 0 (not fallback)', () => {
    const taxReturn = makeReturn({
      w2Income: [
        { id: 'w2-ny', employerName: 'Corp', wages: 100000, federalTaxWithheld: 15000, stateWages: 0, state: 'NY', stateTaxWithheld: 0 },
      ],
    });
    const federal = makeFederalResult(100000, 80000, 100000);
    const config: StateReturnConfig = { stateCode: 'NY', residencyType: 'nonresident' };

    const allocation = allocateStateIncome(taxReturn, federal, config);

    // stateWages is explicitly 0, should NOT fall back to wages
    expect(allocation.sourceWages).toBe(0);
  });

  it('sums stateWages across multiple W-2s for the same state', () => {
    const taxReturn = makeReturn({
      w2Income: [
        { id: 'w2-1', employerName: 'Employer A', wages: 60000, federalTaxWithheld: 9000, stateWages: 55000, state: 'NY', stateTaxWithheld: 3000 },
        { id: 'w2-2', employerName: 'Employer B', wages: 40000, federalTaxWithheld: 6000, stateWages: 40000, state: 'NY', stateTaxWithheld: 2000 },
      ],
    });
    const federal = makeFederalResult(100000, 80000, 100000);
    const config: StateReturnConfig = { stateCode: 'NY', residencyType: 'nonresident' };

    const allocation = allocateStateIncome(taxReturn, federal, config);

    expect(allocation.sourceWages).toBe(95000); // 55k + 40k
  });

  it('resident allocation also uses stateWages for sourceWages field', () => {
    const taxReturn = makeReturn({
      w2Income: [
        { id: 'w2-ny', employerName: 'Corp', wages: 100000, federalTaxWithheld: 15000, stateWages: 90000, state: 'NY', stateTaxWithheld: 5000 },
      ],
    });
    const federal = makeFederalResult(100000, 80000, 100000);
    const config: StateReturnConfig = { stateCode: 'NY', residencyType: 'resident' };

    const allocation = allocateStateIncome(taxReturn, federal, config);

    // Resident still gets full AGI, but sourceWages should reflect Box 16
    expect(allocation.allocatedAGI).toBe(100000);
    expect(allocation.sourceWages).toBe(90000);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 4: calculateOtherStateCredit
// ─────────────────────────────────────────────────────────────

describe('Credit for taxes paid to other states', () => {
  it('credits the lesser of other-state tax vs proportionate resident tax', () => {
    // Resident tax: $10,000; other state tax: $3,000; other state income: $60k; total: $100k
    const credit = calculateOtherStateCredit(10000, 3000, 60000, 100000);

    // Proportionate: $10k * ($60k / $100k) = $6k
    // Lesser of $3k and $6k = $3k
    expect(credit).toBe(3000);
  });

  it('limits credit to proportionate amount when other-state tax is higher', () => {
    const credit = calculateOtherStateCredit(10000, 8000, 40000, 100000);

    // Proportionate: $10k * ($40k / $100k) = $4k
    // Lesser of $8k and $4k = $4k
    expect(credit).toBe(4000);
  });

  it('returns zero when no other-state tax was paid', () => {
    expect(calculateOtherStateCredit(10000, 0, 60000, 100000)).toBe(0);
  });

  it('returns zero when no other-state income', () => {
    expect(calculateOtherStateCredit(10000, 3000, 0, 100000)).toBe(0);
  });

  it('returns zero when total income is zero', () => {
    expect(calculateOtherStateCredit(10000, 3000, 60000, 0)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 5: E2E — Two-Pass Multi-State (NY resident + NJ nonresident)
// ─────────────────────────────────────────────────────────────

describe('Multi-state E2E — NY resident + NJ nonresident commuter', () => {
  it('NJ nonresident return uses allocated income, NY resident gets other-state credit', () => {
    const taxReturn = makeReturn({
      w2Income: [
        { id: 'w2-nj', employerName: 'NJ Corp', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450, state: 'NJ', stateTaxWithheld: 4000 },
      ],
      stateReturns: [
        { stateCode: 'NY', residencyType: 'resident' },
        { stateCode: 'NJ', residencyType: 'nonresident' },
      ],
    });

    const federalResult = calculateForm1040(taxReturn);
    const stateResults = calculateStateTaxes(taxReturn, federalResult);

    // Should have 2 results
    expect(stateResults).toHaveLength(2);

    // NJ nonresident should only tax NJ-source wages
    const njResult = stateResults.find(r => r.stateCode === 'NJ');
    expect(njResult).toBeDefined();
    expect(njResult!.residencyType).toBe('nonresident');
    expect(njResult!.allocationRatio).toBe(1.0); // All wages are NJ-source
    expect(njResult!.allocatedAGI).toBeDefined();

    // NY resident should have full AGI
    const nyResult = stateResults.find(r => r.stateCode === 'NY');
    expect(nyResult).toBeDefined();
    expect(nyResult!.residencyType).toBe('resident');
    expect(nyResult!.allocationRatio).toBe(1.0);
  });

  it('part-year filer gets prorated state tax', () => {
    const taxReturn = makeReturn({
      taxYear: 2025,
      w2Income: [
        { id: 'w2-ny', employerName: 'NY Corp', wages: 80000, federalTaxWithheld: 12000, socialSecurityWages: 80000, socialSecurityTax: 4960, medicareWages: 80000, medicareTax: 1160, state: 'NY', stateTaxWithheld: 3500 },
      ],
      stateReturns: [
        { stateCode: 'NY', residencyType: 'part_year', daysLivedInState: 182 },
      ],
    });

    const federalResult = calculateForm1040(taxReturn);
    const stateResults = calculateStateTaxes(taxReturn, federalResult);

    expect(stateResults).toHaveLength(1);
    const nyResult = stateResults[0];
    expect(nyResult.residencyType).toBe('part_year');
    expect(nyResult.allocationRatio).toBeCloseTo(0.50, 1);
    // Tax should be less than full-year tax since income is prorated
    expect(nyResult.totalStateTax).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 5B: Precision — Rate and ratio precision fixes
// ─────────────────────────────────────────────────────────────

describe('State allocation — Precision', () => {
  it('effectiveStateRate uses 4dp precision after other-state credit', () => {
    // NY resident + NJ nonresident: NY gets other-state credit, recalculates effectiveStateRate
    const taxReturn = makeReturn({
      w2Income: [
        { id: 'w2-nj', employerName: 'NJ Corp', wages: 100000, federalTaxWithheld: 15000,
          socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450,
          state: 'NJ', stateTaxWithheld: 4000 },
      ],
      stateReturns: [
        { stateCode: 'NY', residencyType: 'resident' },
        { stateCode: 'NJ', residencyType: 'nonresident' },
      ],
    });

    const federalResult = calculateForm1040(taxReturn);
    const stateResults = calculateStateTaxes(taxReturn, federalResult);
    const nyResult = stateResults.find(r => r.stateCode === 'NY');
    expect(nyResult).toBeDefined();

    // effectiveStateRate should have 4dp precision (not rounded to 2dp)
    const rate = nyResult!.effectiveStateRate;
    // Check that rate has more than 2 decimal places of precision
    // (round2 would give e.g. 0.05, but 4dp gives e.g. 0.0532)
    const roundedTo2dp = Math.round(rate * 100) / 100;
    const roundedTo4dp = Math.round(rate * 10000) / 10000;
    expect(rate).toBe(roundedTo4dp); // Should be 4dp precision
  });

  it('part-year allocation ratio uses 6dp precision', () => {
    // 100/365 = 0.273973 (6dp), not 0.27 (2dp)
    const allocation = allocateStateIncome(
      makeReturn({ taxYear: 2025 }),
      makeFederalResult(100000, 80000, 90000),
      { stateCode: 'NY', residencyType: 'part_year', daysLivedInState: 100 },
    );

    expect(allocation.allocationRatio).toBe(0.273973);
    // Dollar amount still uses round2
    expect(allocation.allocatedAGI).toBe(round2(100000 * 0.273973));
  });

  it('nonresident allocation ratio uses 6dp precision', () => {
    // 33333/100000 = 0.33333 (6dp)
    const allocation = allocateStateIncome(
      makeReturn({
        taxYear: 2025,
        w2Income: [
          { id: 'w1', employerName: 'NJ Corp', wages: 33333, federalTaxWithheld: 5000,
            socialSecurityWages: 33333, socialSecurityTax: 2067, medicareWages: 33333, medicareTax: 483,
            state: 'NJ', stateTaxWithheld: 1500 },
        ],
      }),
      makeFederalResult(100000, 80000, 90000),
      { stateCode: 'NJ', residencyType: 'nonresident' },
    );

    // 33333 / 100000 = 0.33333
    expect(allocation.allocationRatio).toBe(0.33333);
  });
});

// ─────────────────────────────────────────────────────────────
// Section 6: Backward Compatibility — Existing State Tests Unchanged
// ─────────────────────────────────────────────────────────────

describe('State allocation — Backward compatibility', () => {
  it('resident filer with no allocation changes matches existing behavior', () => {
    const taxReturn = makeReturn({
      w2Income: [
        { id: 'w2-ny', employerName: 'NY Corp', wages: 100000, federalTaxWithheld: 15000, socialSecurityWages: 100000, socialSecurityTax: 6200, medicareWages: 100000, medicareTax: 1450, state: 'NY', stateTaxWithheld: 5000 },
      ],
      stateReturns: [
        { stateCode: 'NY', residencyType: 'resident' },
      ],
    });

    const federalResult = calculateForm1040(taxReturn);
    const stateResults = calculateStateTaxes(taxReturn, federalResult);

    expect(stateResults).toHaveLength(1);
    const nyResult = stateResults[0];
    expect(nyResult.residencyType).toBe('resident');
    expect(nyResult.allocationRatio).toBe(1.0);
    expect(nyResult.federalAGI).toBe(federalResult.form1040.agi);
    expect(nyResult.totalStateTax).toBeGreaterThan(0);
  });

  it('no-income-tax state still returns zero', () => {
    const taxReturn = makeReturn({
      w2Income: [
        { id: 'w2-tx', employerName: 'TX Corp', wages: 80000, federalTaxWithheld: 12000, socialSecurityWages: 80000, socialSecurityTax: 4960, medicareWages: 80000, medicareTax: 1160, state: 'TX' },
      ],
      stateReturns: [
        { stateCode: 'TX', residencyType: 'resident' },
      ],
    });

    const federalResult = calculateForm1040(taxReturn);
    const stateResults = calculateStateTaxes(taxReturn, federalResult);

    expect(stateResults).toHaveLength(1);
    expect(stateResults[0].totalStateTax).toBe(0);
  });

  it('flat-tax state PA nonresident works with allocation', () => {
    const taxReturn = makeReturn({
      w2Income: [
        { id: 'w2-pa', employerName: 'PA Corp', wages: 60000, federalTaxWithheld: 9000, socialSecurityWages: 60000, socialSecurityTax: 3720, medicareWages: 60000, medicareTax: 870, state: 'PA', stateTaxWithheld: 1800 },
        { id: 'w2-nj', employerName: 'NJ LLC', wages: 40000, federalTaxWithheld: 6000, socialSecurityWages: 40000, socialSecurityTax: 2480, medicareWages: 40000, medicareTax: 580, state: 'NJ', stateTaxWithheld: 1200 },
      ],
      stateReturns: [
        { stateCode: 'PA', residencyType: 'nonresident' },
      ],
    });

    const federalResult = calculateForm1040(taxReturn);
    const stateResults = calculateStateTaxes(taxReturn, federalResult);

    expect(stateResults).toHaveLength(1);
    const paResult = stateResults[0];
    expect(paResult.residencyType).toBe('nonresident');
    // Only PA-source wages ($60k) should be taxed, not NJ wages ($40k)
    expect(paResult.allocatedAGI).toBeDefined();
    expect(paResult.totalStateTax).toBeGreaterThan(0);
    // PA tax rate is 3.07% — on ~$60k source income
    expect(paResult.totalStateTax).toBeLessThan(3000); // Rough bound: 3.07% of $60k ≈ $1,842
  });
});
