/**
 * Form 8582 — Passive Activity Loss Limitations Tests
 *
 * Tests the IRC §469 passive activity loss limitation implementation:
 *   - calculateForm8582: full Form 8582 computation
 *   - calculateSpecialAllowance: $25k allowance with AGI phase-out
 *   - MFS special rules: $12.5k / $0
 *   - Real estate professional exception
 *   - Disposition handling: IRC §469(g)(1)
 *   - Prior-year unallowed loss carryforward
 *   - Per-activity allocation
 *
 * @authority IRC §469, Form 8582, Publication 925
 */

import { describe, it, expect } from 'vitest';
import { calculateForm8582, calculateSpecialAllowance } from '../src/engine/form8582.js';
import {
  RentalProperty,
  IncomeK1,
  ScheduleEResult,
  PropertyResult,
  FilingStatus,
} from '../src/types/index.js';

// ─── Helpers ──────────────────────────────────────────

function makeProperty(overrides: Partial<RentalProperty> = {}): RentalProperty {
  return {
    id: 'prop-1',
    address: '123 Main St',
    propertyType: 'single_family',
    daysRented: 365,
    personalUseDays: 0,
    rentalIncome: 0,
    ...overrides,
  };
}

function makeK1(overrides: Partial<IncomeK1> = {}): IncomeK1 {
  return {
    id: 'k1-1',
    entityName: 'Acme Partners',
    entityType: 'partnership',
    ...overrides,
  };
}

function makeScheduleEResult(overrides: Partial<ScheduleEResult> = {}): ScheduleEResult {
  return {
    totalRentalIncome: 0,
    totalRentalExpenses: 0,
    netRentalIncome: 0,
    allowableLoss: 0,
    suspendedLoss: 0,
    royaltyIncome: 0,
    scheduleEIncome: 0,
    ...overrides,
  };
}

function makePropResult(overrides: Partial<PropertyResult> = {}): PropertyResult {
  return {
    id: 'prop-1',
    address: '123 Main St',
    rentalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    isPersonalUse: false,
    isExcluded: false,
    ...overrides,
  };
}

// ─── calculateSpecialAllowance ─────────────────────────

describe('calculateSpecialAllowance', () => {
  it('returns $25,000 for Single filer with AGI ≤ $100k', () => {
    expect(calculateSpecialAllowance(80000, FilingStatus.Single, false)).toBe(25000);
    expect(calculateSpecialAllowance(100000, FilingStatus.Single, false)).toBe(25000);
  });

  it('phases out between $100k and $150k AGI', () => {
    // $125k AGI → $25k excess → $12.5k reduction → $12,500 allowance
    expect(calculateSpecialAllowance(125000, FilingStatus.Single, false)).toBe(12500);
  });

  it('returns $0 at AGI ≥ $150k', () => {
    expect(calculateSpecialAllowance(150000, FilingStatus.Single, false)).toBe(0);
    expect(calculateSpecialAllowance(200000, FilingStatus.Single, false)).toBe(0);
  });

  it('returns $25,000 for MFJ with AGI ≤ $100k', () => {
    expect(calculateSpecialAllowance(90000, FilingStatus.MarriedFilingJointly, false)).toBe(25000);
  });

  it('MFS living together → $0 allowance', () => {
    expect(calculateSpecialAllowance(50000, FilingStatus.MarriedFilingSeparately, false)).toBe(0);
    expect(calculateSpecialAllowance(0, FilingStatus.MarriedFilingSeparately, false)).toBe(0);
  });

  it('MFS living apart → $12,500 allowance with $50k–$75k phase-out', () => {
    expect(calculateSpecialAllowance(40000, FilingStatus.MarriedFilingSeparately, true)).toBe(12500);
    expect(calculateSpecialAllowance(50000, FilingStatus.MarriedFilingSeparately, true)).toBe(12500);
    // $62.5k → $12.5k excess → $6.25k reduction → $6,250
    expect(calculateSpecialAllowance(62500, FilingStatus.MarriedFilingSeparately, true)).toBe(6250);
    expect(calculateSpecialAllowance(75000, FilingStatus.MarriedFilingSeparately, true)).toBe(0);
    expect(calculateSpecialAllowance(100000, FilingStatus.MarriedFilingSeparately, true)).toBe(0);
  });

  it('returns $25,000 for HOH with AGI ≤ $100k', () => {
    expect(calculateSpecialAllowance(80000, FilingStatus.HeadOfHousehold, false)).toBe(25000);
  });

  it('works at exact phase-out boundaries', () => {
    // $1 over → $0.50 reduction → $24,999.50
    expect(calculateSpecialAllowance(100001, FilingStatus.Single, false)).toBe(24999.5);
    // $49,999 over → $24,999.50 reduction → $0.50
    expect(calculateSpecialAllowance(149999, FilingStatus.Single, false)).toBe(0.5);
  });
});

// ─── calculateForm8582 — No limitation needed ──────────

describe('calculateForm8582 — no limitation', () => {
  it('returns zero result when no passive activities', () => {
    const result = calculateForm8582(
      makeScheduleEResult(), [], [], 80000, FilingStatus.Single, false,
    );
    expect(result.totalAllowedLoss).toBe(0);
    expect(result.totalSuspendedLoss).toBe(0);
    expect(result.activities).toHaveLength(0);
  });

  it('no limitation when net passive income is positive', () => {
    const props = [
      makeProperty({ id: 'p1', rentalIncome: 20000, mortgageInterest: 5000 }),
      makeProperty({ id: 'p2', rentalIncome: 5000, mortgageInterest: 10000 }),
    ];
    const schedE = makeScheduleEResult({
      netRentalIncome: 10000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 20000, totalExpenses: 5000, netIncome: 15000 }),
        makePropResult({ id: 'p2', rentalIncome: 5000, totalExpenses: 10000, netIncome: -5000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 80000, FilingStatus.Single, false);
    // Net is positive — all losses allowed
    expect(result.combinedNetIncome).toBeGreaterThanOrEqual(0);
    expect(result.totalSuspendedLoss).toBe(0);
  });
});

// ─── calculateForm8582 — Basic $25k allowance ─────────

describe('calculateForm8582 — $25k special allowance', () => {
  it('allows full rental loss ≤ $25k when AGI < $100k', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 10000, mortgageInterest: 20000, depreciation: 5000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -15000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 10000, totalExpenses: 25000, netIncome: -15000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 80000, FilingStatus.Single, false);
    expect(result.totalAllowedLoss).toBe(-15000);
    expect(result.totalSuspendedLoss).toBe(0);
    expect(result.specialAllowance).toBe(25000);
  });

  it('limits loss to $25k when loss exceeds allowance', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 20000, depreciation: 25000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -40000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 45000, netIncome: -40000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 80000, FilingStatus.Single, false);
    expect(result.totalAllowedLoss).toBe(-25000);
    expect(result.totalSuspendedLoss).toBe(15000);
  });

  it('applies AGI phase-out ($125k AGI → $12.5k allowance)', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 25000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -20000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 25000, netIncome: -20000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 125000, FilingStatus.Single, false);
    expect(result.specialAllowance).toBe(12500);
    expect(result.totalAllowedLoss).toBe(-12500);
    expect(result.totalSuspendedLoss).toBe(7500);
  });

  it('fully suspends loss when AGI ≥ $150k', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 25000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -20000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 25000, netIncome: -20000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 200000, FilingStatus.Single, false);
    expect(result.specialAllowance).toBe(0);
    expect(result.totalAllowedLoss).toBe(0);
    expect(result.totalSuspendedLoss).toBe(20000);
  });
});

// ─── Multiple properties — pro-rata allocation ────────

describe('calculateForm8582 — multiple properties', () => {
  it('allocates allowed loss pro rata across properties', () => {
    const props = [
      makeProperty({ id: 'p1', address: '100 Oak', rentalIncome: 5000, mortgageInterest: 15000 }),
      makeProperty({ id: 'p2', address: '200 Elm', rentalIncome: 3000, mortgageInterest: 23000 }),
    ];
    const schedE = makeScheduleEResult({
      netRentalIncome: -30000,
      propertyResults: [
        makePropResult({ id: 'p1', address: '100 Oak', rentalIncome: 5000, totalExpenses: 15000, netIncome: -10000 }),
        makePropResult({ id: 'p2', address: '200 Elm', rentalIncome: 3000, totalExpenses: 23000, netIncome: -20000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 80000, FilingStatus.Single, false);
    expect(result.totalAllowedLoss).toBe(-25000);
    expect(result.totalSuspendedLoss).toBe(5000);

    // Check pro-rata: p1 has $10k loss (1/3), p2 has $20k loss (2/3)
    const p1 = result.activities.find(a => a.id === 'p1')!;
    const p2 = result.activities.find(a => a.id === 'p2')!;
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    // Together should sum to 25000 allowed, 5000 suspended
    expect(Math.abs(p1.allowedLoss) + Math.abs(p2.allowedLoss)).toBeCloseTo(25000, 0);
    expect(p1.suspendedLoss + p2.suspendedLoss).toBeCloseTo(5000, 0);
  });
});

// ─── MFS special rules ────────────────────────────────

describe('calculateForm8582 — MFS rules', () => {
  it('MFS lived together → $0 allowance, all losses suspended', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 15000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -10000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 15000, netIncome: -10000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 60000, FilingStatus.MarriedFilingSeparately, false);
    expect(result.specialAllowance).toBe(0);
    expect(result.totalAllowedLoss).toBe(0);
    expect(result.totalSuspendedLoss).toBe(10000);
  });

  it('MFS lived apart → $12.5k allowance with $50k phase-out', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 25000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -20000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 25000, netIncome: -20000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 40000, FilingStatus.MarriedFilingSeparately, true);
    expect(result.specialAllowance).toBe(12500);
    expect(result.totalAllowedLoss).toBe(-12500);
    expect(result.totalSuspendedLoss).toBe(7500);
  });
});

// ─── Real estate professional ─────────────────────────

describe('calculateForm8582 — real estate professional', () => {
  it('bypasses PAL limitation entirely', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 30000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -25000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 30000, netIncome: -25000 }),
      ],
    });

    const result = calculateForm8582(
      schedE, props, [], 200000, FilingStatus.Single, false,
      { realEstateProfessional: true },
    );
    // Even at $200k AGI, all losses allowed
    expect(result.totalAllowedLoss).toBe(-25000);
    expect(result.totalSuspendedLoss).toBe(0);
    expect(result.warnings).toContainEqual(expect.stringContaining('Real estate professional'));
  });
});

// ─── K-1 passive activities ────────────────────────────

describe('calculateForm8582 — K-1 passive activities', () => {
  it('includes K-1 Box 2 rental income as passive', () => {
    const k1s = [makeK1({ id: 'k1-1', rentalIncome: -15000 })];
    const schedE = makeScheduleEResult({ netRentalIncome: -15000 });

    const result = calculateForm8582(schedE, [], k1s, 80000, FilingStatus.Single, false);
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].type).toBe('k1_passive');
    // K-1 rental → no active participation → no special allowance
    expect(result.totalAllowedLoss).toBe(0);
    expect(result.totalSuspendedLoss).toBe(15000);
  });

  it('includes K-1 Box 1 ordinary flagged as passive', () => {
    const k1s = [makeK1({
      id: 'k1-1', ordinaryBusinessIncome: -8000, isPassiveActivity: true,
    })];
    const schedE = makeScheduleEResult();

    const result = calculateForm8582(schedE, [], k1s, 80000, FilingStatus.Single, false);
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].type).toBe('k1_passive');
    expect(result.activities[0].name).toContain('passive');
  });

  it('does NOT include K-1 Box 1 when not flagged passive', () => {
    const k1s = [makeK1({
      id: 'k1-1', ordinaryBusinessIncome: -8000, isPassiveActivity: false,
    })];
    const schedE = makeScheduleEResult();

    const result = calculateForm8582(schedE, [], k1s, 80000, FilingStatus.Single, false);
    expect(result.activities).toHaveLength(0);
  });

  it('mixed rental + K-1 passive: correct categorization', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 15000,
    })];
    const k1s = [makeK1({ id: 'k1-1', rentalIncome: -5000 })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -15000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 15000, netIncome: -10000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, k1s, 80000, FilingStatus.Single, false);
    expect(result.activities).toHaveLength(2);
    // Rental with active participation → Line 1
    const rental = result.activities.find(a => a.id === 'p1')!;
    expect(rental.type).toBe('rental');
    expect(rental.activeParticipation).toBe(true);
    // K-1 rental → Line 2
    const k1 = result.activities.find(a => a.id === 'k1-1_rental')!;
    expect(k1.type).toBe('k1_passive');
    expect(k1.activeParticipation).toBe(false);
  });
});

// ─── Prior-year unallowed losses ──────────────────────

describe('calculateForm8582 — prior-year carryforward', () => {
  it('adds prior-year unallowed to current-year loss', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 15000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -10000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 15000, netIncome: -10000 }),
      ],
    });

    const result = calculateForm8582(
      schedE, props, [], 80000, FilingStatus.Single, false,
      { priorYearUnallowedLoss: 8000 },
    );
    // Total loss: $10k current + $8k prior = $18k
    const act = result.activities[0];
    expect(act.currentYearNetIncome).toBe(-10000);
    expect(act.priorYearUnallowed).toBe(8000);
    expect(act.overallGainOrLoss).toBe(-18000);
    // $18k < $25k allowance → fully allowed
    expect(result.totalAllowedLoss).toBe(-18000);
    expect(result.totalSuspendedLoss).toBe(0);
  });

  it('prior-year loss + current-year loss exceeding $25k → partial suspension', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 0, mortgageInterest: 20000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -20000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 0, totalExpenses: 20000, netIncome: -20000 }),
      ],
    });

    const result = calculateForm8582(
      schedE, props, [], 80000, FilingStatus.Single, false,
      { priorYearUnallowedLoss: 15000 },
    );
    // Total loss: $20k + $15k = $35k, allowance = $25k
    expect(result.totalAllowedLoss).toBe(-25000);
    expect(result.totalSuspendedLoss).toBe(10000);
  });
});

// ─── Disposition handling — IRC §469(g)(1) ────────────

describe('calculateForm8582 — dispositions', () => {
  it('releases all suspended losses on full disposition', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 0, mortgageInterest: 20000,
      disposedDuringYear: true,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -20000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 0, totalExpenses: 20000, netIncome: -20000 }),
      ],
    });

    const result = calculateForm8582(
      schedE, props, [], 200000, FilingStatus.Single, false,
      { priorYearUnallowedLoss: 10000 },
    );
    // Normally at $200k AGI, all losses suspended. But disposition releases them.
    const act = result.activities[0];
    expect(act.disposedDuringYear).toBe(true);
    expect(act.allowedLoss).toBe(-30000); // $20k current + $10k prior
    expect(act.suspendedLoss).toBe(0);
    expect(result.dispositionReleasedLosses).toBeGreaterThan(0);
  });

  it('disposition only releases for disposed activity, not others', () => {
    const props = [
      makeProperty({ id: 'p1', address: '100 Oak', rentalIncome: 0, mortgageInterest: 20000, disposedDuringYear: true }),
      makeProperty({ id: 'p2', address: '200 Elm', rentalIncome: 0, mortgageInterest: 15000 }),
    ];
    const schedE = makeScheduleEResult({
      netRentalIncome: -35000,
      propertyResults: [
        makePropResult({ id: 'p1', address: '100 Oak', rentalIncome: 0, totalExpenses: 20000, netIncome: -20000 }),
        makePropResult({ id: 'p2', address: '200 Elm', rentalIncome: 0, totalExpenses: 15000, netIncome: -15000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 200000, FilingStatus.Single, false);
    const p1 = result.activities.find(a => a.id === 'p1')!;
    const p2 = result.activities.find(a => a.id === 'p2')!;
    // p1 disposed → all loss allowed
    expect(p1.allowedLoss).toBe(-20000);
    expect(p1.suspendedLoss).toBe(0);
    // p2 not disposed, AGI $200k → fully suspended
    expect(p2.suspendedLoss).toBe(15000);
  });
});

// ─── Edge cases ───────────────────────────────────────

describe('calculateForm8582 — edge cases', () => {
  it('handles zero AGI', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 20000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -15000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 20000, netIncome: -15000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 0, FilingStatus.Single, false);
    expect(result.specialAllowance).toBe(25000);
    expect(result.totalAllowedLoss).toBe(-15000);
  });

  it('handles negative AGI', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 20000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -15000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 20000, netIncome: -15000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], -10000, FilingStatus.Single, false);
    expect(result.specialAllowance).toBe(25000);
    expect(result.totalAllowedLoss).toBe(-15000);
  });

  it('handles property with activeParticipation = false', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 15000,
      activeParticipation: false,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -10000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 15000, netIncome: -10000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 80000, FilingStatus.Single, false);
    // Without active participation → no special allowance applies
    // Loss goes to "other passive" (Line 2) → fully suspended unless offset by passive income
    expect(result.totalAllowedLoss).toBe(0);
    expect(result.totalSuspendedLoss).toBe(10000);
  });

  it('skips excluded properties (<15 days)', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 1000, mortgageInterest: 5000, daysRented: 10,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: 0,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 0, totalExpenses: 0, netIncome: 0, isExcluded: true }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 80000, FilingStatus.Single, false);
    expect(result.activities).toHaveLength(0);
  });

  it('skips personal-use properties', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 10000,
      daysRented: 30, personalUseDays: 100,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: 0,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 5000, netIncome: 0, isPersonalUse: true }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 80000, FilingStatus.Single, false);
    expect(result.activities).toHaveLength(0);
  });

  it('suspended loss warning when losses > $25k allowance', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 0, mortgageInterest: 40000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -40000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 0, totalExpenses: 40000, netIncome: -40000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 80000, FilingStatus.Single, false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('suspended');
  });

  it('no form8582Data provided → defaults (no prior loss, not REP)', () => {
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 15000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -10000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 15000, netIncome: -10000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 80000, FilingStatus.Single, false);
    expect(result.totalAllowedLoss).toBe(-10000);
    expect(result.totalSuspendedLoss).toBe(0);
  });
});

// ─── Bug fix regression tests ─────────────────────────

describe('calculateForm8582 — special allowance cap (bug fix)', () => {
  it('special allowance does not exceed total net loss when passive income offsets', () => {
    // $30k rental loss + $10k K-1 passive income → net loss $20k
    // Special allowance = $25k but should be capped to $20k (net loss)
    const props = [makeProperty({
      id: 'p1', rentalIncome: 0, mortgageInterest: 30000,
    })];
    const k1s = [makeK1({ id: 'k1-1', rentalIncome: 10000 })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -20000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 0, totalExpenses: 30000, netIncome: -30000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, k1s, 80000, FilingStatus.Single, false);
    expect(result.totalAllowedLoss).toBe(-20000);
    expect(result.totalSuspendedLoss).toBe(10000);

    // Per-activity: rental allowed should not exceed total allowed
    const rental = result.activities.find(a => a.id === 'p1')!;
    expect(Math.abs(rental.allowedLoss)).toBeLessThanOrEqual(20000);
    expect(rental.suspendedLoss).toBe(10000);
  });
});

describe('calculateForm8582 — dispositionGainLoss (bug fix)', () => {
  it('excludes rental disposition gain from activity (flows through Form 4797)', () => {
    // Rental with $20k expenses but sold for $50k gain
    // Form 8582 only tracks the operational loss; disposition gain flows through Form 4797
    const props = [makeProperty({
      id: 'p1', rentalIncome: 0, mortgageInterest: 20000,
      disposedDuringYear: true, dispositionGainLoss: 50000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -20000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 0, totalExpenses: 20000, netIncome: -20000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 200000, FilingStatus.Single, false);
    const act = result.activities[0];
    // Only the -$20k operational loss tracked (disposition gain excluded)
    expect(act.currentYearNetIncome).toBe(-20000);
    // Disposition releases all: full $20k allowed per IRC §469(g)
    expect(act.allowedLoss).toBe(-20000);
    expect(act.suspendedLoss).toBe(0);
  });

  it('tracks only operational loss for disposed rental (disposition loss also goes to Form 4797)', () => {
    // Rental with $10k expenses, sold at $5k loss
    // Form 8582 only tracks the -$10k operational loss
    const props = [makeProperty({
      id: 'p1', rentalIncome: 0, mortgageInterest: 10000,
      disposedDuringYear: true, dispositionGainLoss: -5000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -10000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 0, totalExpenses: 10000, netIncome: -10000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 200000, FilingStatus.Single, false);
    const act = result.activities[0];
    // Only the -$10k operational loss tracked
    expect(act.currentYearNetIncome).toBe(-10000);
    // Disposition releases all: $10k allowed
    expect(act.allowedLoss).toBe(-10000);
    expect(act.suspendedLoss).toBe(0);
  });

  it('includes K-1 dispositionGainLoss in passive activity income', () => {
    const k1s = [makeK1({
      id: 'k1-1', ordinaryBusinessIncome: -8000,
      isPassiveActivity: true, disposedDuringYear: true, dispositionGainLoss: 3000,
    })];
    const schedE = makeScheduleEResult();

    const result = calculateForm8582(schedE, [], k1s, 80000, FilingStatus.Single, false);
    const act = result.activities.find(a => a.id === 'k1-1_passive')!;
    // -$8k ordinary + $3k disposition gain = -$5k
    expect(act.currentYearNetIncome).toBe(-5000);
  });
});

describe('calculateForm8582 — 1099-MISC rents as passive activity (bug fix)', () => {
  it('includes 1099-MISC rents as passive rental income activity', () => {
    const schedE = makeScheduleEResult({ netRentalIncome: 5000 });

    const result = calculateForm8582(
      schedE, [], [], 80000, FilingStatus.Single, false, undefined, 5000,
    );
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].id).toBe('misc1099_rents');
    expect(result.activities[0].name).toBe('1099-MISC Rents');
    expect(result.activities[0].currentYearNetIncome).toBe(5000);
    expect(result.activities[0].activeParticipation).toBe(false);
  });

  it('1099-MISC rent income offsets rental property losses in Form 8582', () => {
    // $30k rental loss + $10k 1099-MISC rent income → net $20k loss
    const props = [makeProperty({
      id: 'p1', rentalIncome: 0, mortgageInterest: 30000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -20000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 0, totalExpenses: 30000, netIncome: -30000 }),
      ],
    });

    const result = calculateForm8582(
      schedE, props, [], 80000, FilingStatus.Single, false, undefined, 10000,
    );
    // Net passive loss = $30k - $10k = $20k, within $25k allowance
    expect(result.totalAllowedLoss).toBe(-20000);
    expect(result.totalSuspendedLoss).toBe(10000);
    expect(result.totalPassiveIncome).toBe(10000);
  });

  it('skips 1099-MISC rents when zero', () => {
    const schedE = makeScheduleEResult();
    const result = calculateForm8582(
      schedE, [], [], 80000, FilingStatus.Single, false, undefined, 0,
    );
    expect(result.activities).toHaveLength(0);
  });
});

describe('calculateForm8582 — REP scoped to rentals only (bug fix)', () => {
  it('REP bypasses rental losses but still limits K-1 passive ordinary', () => {
    // REP with $25k rental loss (bypassed) + $10k K-1 passive ordinary loss (still limited)
    const props = [makeProperty({
      id: 'p1', rentalIncome: 5000, mortgageInterest: 30000,
    })];
    const k1s = [makeK1({
      id: 'k1-1', ordinaryBusinessIncome: -10000, isPassiveActivity: true,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -25000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 5000, totalExpenses: 30000, netIncome: -25000 }),
      ],
    });

    const result = calculateForm8582(
      schedE, props, k1s, 200000, FilingStatus.Single, false,
      { realEstateProfessional: true },
    );

    // Rental: fully allowed (REP bypass)
    const rental = result.activities.find(a => a.id === 'p1')!;
    expect(rental.allowedLoss).toBe(-25000);
    expect(rental.suspendedLoss).toBe(0);

    // K-1 passive: still limited (no passive income to offset, no special allowance)
    const k1 = result.activities.find(a => a.id === 'k1-1_passive')!;
    expect(k1.suspendedLoss).toBe(10000);
    expect(k1.allowedLoss).toBe(0);
  });

  it('REP bypasses K-1 rental losses too', () => {
    const k1s = [makeK1({
      id: 'k1-1', rentalIncome: -15000,
    })];
    const schedE = makeScheduleEResult({ netRentalIncome: -15000 });

    const result = calculateForm8582(
      schedE, [], k1s, 200000, FilingStatus.Single, false,
      { realEstateProfessional: true },
    );

    const k1rental = result.activities.find(a => a.id === 'k1-1_rental')!;
    expect(k1rental.allowedLoss).toBe(-15000);
    expect(k1rental.suspendedLoss).toBe(0);
  });

  it('REP with K-1 passive income offsets K-1 passive losses', () => {
    // REP with rental loss (bypassed) + K-1 passive income $5k + K-1 passive loss $8k
    const props = [makeProperty({
      id: 'p1', rentalIncome: 0, mortgageInterest: 20000,
    })];
    const k1s = [
      makeK1({ id: 'k1-inc', ordinaryBusinessIncome: 5000, isPassiveActivity: true }),
      makeK1({ id: 'k1-loss', ordinaryBusinessIncome: -8000, isPassiveActivity: true }),
    ];
    const schedE = makeScheduleEResult({
      netRentalIncome: -20000,
      propertyResults: [
        makePropResult({ id: 'p1', rentalIncome: 0, totalExpenses: 20000, netIncome: -20000 }),
      ],
    });

    const result = calculateForm8582(
      schedE, props, k1s, 200000, FilingStatus.Single, false,
      { realEstateProfessional: true },
    );

    // Rental: bypassed
    const rental = result.activities.find(a => a.id === 'p1')!;
    expect(rental.allowedLoss).toBe(-20000);

    // K-1 passive net: $5k - $8k = -$3k. Only $5k income to offset.
    // Loss K-1 has $8k loss, $5k allowed by income offset, $3k suspended
    const k1loss = result.activities.find(a => a.id === 'k1-loss_passive')!;
    expect(k1loss.suspendedLoss).toBe(3000);
  });
});

// ─── K-1 Disposition Gain Double-Counting (Issue B fix) ─────────
describe('calculateForm8582 — K-1 disposition gain not double-counted', () => {
  it('K-1 with both rental and passive ordinary — gain only on rental activity', () => {
    // K-1 has BOTH rental income (-5000) and passive ordinary income (-3000)
    // plus a $10,000 disposition gain. The gain should only be added to the
    // rental activity (where it was first encountered), not also to passive ordinary.
    const k1s = [makeK1({
      id: 'k1-dual',
      entityName: 'Dual Activity LP',
      rentalIncome: -5000,
      ordinaryBusinessIncome: -3000,
      isPassiveActivity: true,
      disposedDuringYear: true,
      dispositionGainLoss: 10000,
    })];
    const schedE = makeScheduleEResult();
    const result = calculateForm8582(schedE, [], k1s, 80000, FilingStatus.Single, false);

    const rental = result.activities.find(a => a.id === 'k1-dual_rental')!;
    const passive = result.activities.find(a => a.id === 'k1-dual_passive')!;

    // Rental: -5000 + 10000 = 5000 (gain applied here)
    expect(rental.currentYearNetIncome).toBe(5000);
    // Passive ordinary: -3000 only, NO disposition gain added
    expect(passive.currentYearNetIncome).toBe(-3000);
  });

  it('K-1 with only passive ordinary (no rental) — gain goes to passive', () => {
    // When there's NO rental income, the disposition gain should go to passive ordinary
    const k1s = [makeK1({
      id: 'k1-passive-only',
      entityName: 'Passive Only LP',
      rentalIncome: 0,
      ordinaryBusinessIncome: -8000,
      isPassiveActivity: true,
      disposedDuringYear: true,
      dispositionGainLoss: 12000,
    })];
    const schedE = makeScheduleEResult();
    const result = calculateForm8582(schedE, [], k1s, 80000, FilingStatus.Single, false);

    // No rental activity created (rentalIncome === 0)
    const rental = result.activities.find(a => a.id === 'k1-passive-only_rental');
    expect(rental).toBeUndefined();

    // Passive ordinary: -8000 + 12000 = 4000 (gain applied here since no rental)
    const passive = result.activities.find(a => a.id === 'k1-passive-only_passive')!;
    expect(passive.currentYearNetIncome).toBe(4000);
  });
});

describe('calculateForm8582 — per-property priorYearUnallowedLoss (Bug #13)', () => {
  it('uses per-property priorYearUnallowedLoss for disposed rental', () => {
    // Disposed rental with $1,800 operational loss and $3,200 prior year suspended loss
    // on the property itself. IRC §469(g)(1): disposition releases ALL losses.
    const props = [makeProperty({
      id: 'rental1', rentalIncome: 10800,
      mortgageInterest: 4200, insurance: 900, repairs: 1500,
      taxes: 2400, depreciation: 3600,
      activeParticipation: true,
      disposedDuringYear: true, dispositionGainLoss: 15000,
      priorYearUnallowedLoss: 3200,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -1800,
      propertyResults: [
        makePropResult({ id: 'rental1', rentalIncome: 10800, totalExpenses: 12600, netIncome: -1800 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 50000, FilingStatus.HeadOfHousehold, false, {
      priorYearUnallowedLoss: 3200,
    });

    const act = result.activities[0];
    // Operational loss only (disposition gain excluded)
    expect(act.currentYearNetIncome).toBe(-1800);
    // Prior year loss from the property
    expect(act.priorYearUnallowed).toBe(3200);
    // Total: -$1,800 - $3,200 = -$5,000
    expect(act.overallGainOrLoss).toBe(-5000);
    // Disposed: ALL losses released per IRC §469(g)
    expect(act.allowedLoss).toBe(-5000);
    expect(act.suspendedLoss).toBe(0);
  });

  it('allocates remaining global prior year to non-property activities', () => {
    // Rental with $2,000 per-property prior loss + K-1 passive loss
    // Global prior = $5,000: $2,000 goes to rental (per-property), $3,000 to K-1
    const props = [makeProperty({
      id: 'rental1', rentalIncome: 0, mortgageInterest: 10000,
      activeParticipation: true,
      priorYearUnallowedLoss: 2000,
    })];
    const k1s = [makeK1({
      id: 'k1-1', ordinaryBusinessIncome: -5000, isPassiveActivity: true,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -10000,
      propertyResults: [
        makePropResult({ id: 'rental1', rentalIncome: 0, totalExpenses: 10000, netIncome: -10000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, k1s, 80000, FilingStatus.Single, false, {
      priorYearUnallowedLoss: 5000,
    });

    const rental = result.activities.find(a => a.id === 'rental1')!;
    expect(rental.priorYearUnallowed).toBe(2000);

    const k1 = result.activities.find(a => a.id === 'k1-1_passive')!;
    // Remaining $3,000 allocated proportionally: K-1 share = $5K / ($10K + $5K) × $3K = $1K
    expect(k1.priorYearUnallowed).toBe(1000);
  });

  it('does not double-count per-property and global prior year', () => {
    // Single rental with $4,000 per-property prior, global also $4,000
    // The $4,000 is the SAME loss — no double counting
    const props = [makeProperty({
      id: 'rental1', rentalIncome: 5000, mortgageInterest: 8000,
      activeParticipation: true,
      priorYearUnallowedLoss: 4000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -3000,
      propertyResults: [
        makePropResult({ id: 'rental1', rentalIncome: 5000, totalExpenses: 8000, netIncome: -3000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 80000, FilingStatus.Single, false, {
      priorYearUnallowedLoss: 4000,
    });

    const act = result.activities[0];
    expect(act.priorYearUnallowed).toBe(4000);
    // Overall = -$3,000 - $4,000 = -$7,000
    expect(act.overallGainOrLoss).toBe(-7000);
    // $25k allowance covers the full $7,000
    expect(act.allowedLoss).toBe(-7000);
  });

  it('disposed rental releases both operational and per-property prior year (without disposition gain)', () => {
    // Operational loss: -$8,000, per-property prior: $6,000
    // Disposition gain $20,000 excluded from Form 8582 (flows to Form 4797)
    // Total released: $8,000 + $6,000 = $14,000
    const props = [makeProperty({
      id: 'r1', rentalIncome: 12000, mortgageInterest: 20000,
      disposedDuringYear: true, dispositionGainLoss: 20000,
      priorYearUnallowedLoss: 6000,
    })];
    const schedE = makeScheduleEResult({
      netRentalIncome: -8000,
      propertyResults: [
        makePropResult({ id: 'r1', rentalIncome: 12000, totalExpenses: 20000, netIncome: -8000 }),
      ],
    });

    const result = calculateForm8582(schedE, props, [], 120000, FilingStatus.Single, false, {
      priorYearUnallowedLoss: 6000,
    });

    const act = result.activities[0];
    expect(act.currentYearNetIncome).toBe(-8000);
    expect(act.priorYearUnallowed).toBe(6000);
    expect(act.overallGainOrLoss).toBe(-14000);
    // ALL released on disposition
    expect(act.allowedLoss).toBe(-14000);
    expect(act.suspendedLoss).toBe(0);
    expect(act.disposedDuringYear).toBe(true);
  });
});
