/**
 * Tests for 1099-MISC Box 1 (Rents) and Box 2 (Royalties)
 *
 * Validates that 1099-MISC Box 1 rents and Box 2 royalties are correctly
 * routed through Schedule E and wired into the Form 1040 calculation.
 *
 * Box 1 (Rents) → Schedule E rental income (subject to passive loss rules)
 * Box 2 (Royalties) → Schedule E royalty income (not subject to passive loss rules)
 * Box 3 (Other Income) → Schedule 1 Line 9 "Other Income" (unchanged)
 *
 * @authority
 *   IRC: Section 61(a)(5) — rents as gross income
 *   IRC: Section 61(a)(6) — royalties as gross income
 *   IRC: Section 469 — passive activity loss limitations (rents only)
 *   Form: Schedule E (Form 1040), Part I — Lines 3 (Rents) and 4 (Royalties)
 *   Form: 1099-MISC — Boxes 1, 2, 3
 */

import { describe, it, expect } from 'vitest';
import { calculateScheduleE } from '../src/engine/scheduleE.js';
import { calculateForm1040 } from '../src/engine/form1040.js';
import { FilingStatus, TaxReturn, Income1099MISC } from '../src/types/index.js';

// ─── Helper: minimal TaxReturn ────────────────────────────
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

function make1099MISC(overrides: Partial<Income1099MISC> = {}): Income1099MISC {
  return {
    id: 'misc-1',
    payerName: 'Test Payer',
    otherIncome: 0,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════
// Schedule E unit tests — rents and royalties parameters
// ═════════════════════════════════════════════════════════════

describe('Schedule E — 1099-MISC rents and royalties', () => {
  it('returns zero when no income sources', () => {
    const result = calculateScheduleE([], 0, 0, 0);
    expect(result.scheduleEIncome).toBe(0);
    expect(result.royaltyIncome).toBe(0);
  });

  it('adds 1099-MISC rents to total rental income', () => {
    const result = calculateScheduleE([], 0, 12000, 0);
    expect(result.totalRentalIncome).toBe(12000);
    expect(result.scheduleEIncome).toBe(12000);
  });

  it('adds 1099-MISC royalties to schedule E income', () => {
    const result = calculateScheduleE([], 0, 0, 5000);
    expect(result.royaltyIncome).toBe(5000);
    expect(result.scheduleEIncome).toBe(5000);
  });

  it('combines rents and royalties in schedule E income', () => {
    const result = calculateScheduleE([], 0, 10000, 3000);
    expect(result.totalRentalIncome).toBe(10000);
    expect(result.royaltyIncome).toBe(3000);
    expect(result.scheduleEIncome).toBe(13000);
  });

  it('1099-MISC rents aggregate with K-1 rental income', () => {
    const result = calculateScheduleE([], 8000, 4000, 0);
    expect(result.totalRentalIncome).toBe(12000);
    expect(result.scheduleEIncome).toBe(12000);
  });

  it('returns raw rental loss with royalties', () => {
    // Rental loss of $30k + $5k royalties — no passive loss limitation in Schedule E
    const properties = [{
      id: 'prop-1',
      address: '123 Main St',
      propertyType: 'single_family' as const,
      daysRented: 365,
      personalUseDays: 0,
      rentalIncome: 10000,
      repairs: 40000, // $30k net loss
    }];
    const result = calculateScheduleE(properties, 0, 0, 5000);

    // Raw rental loss flows through (no passive loss limitation)
    expect(result.netRentalIncome).toBe(-30000);
    expect(result.suspendedLoss).toBe(0);
    // Royalties still come through
    expect(result.royaltyIncome).toBe(5000);
    expect(result.scheduleEIncome).toBe(-25000); // -30000 rental + 5000 royalties
  });

  it('handles all sources together: property + K-1 rental + 1099-MISC rents + royalties', () => {
    const properties = [{
      id: 'prop-1',
      address: '456 Oak Ave',
      propertyType: 'single_family' as const,
      daysRented: 365,
      personalUseDays: 0,
      rentalIncome: 20000,
      mortgageInterest: 8000,
      taxes: 3000,
    }];
    const result = calculateScheduleE(properties, 5000, 3000, 2000);
    // Direct rental: $20k - $11k = $9k
    // K-1 rental: $5k
    // 1099-MISC rents: $3k
    // Net rental: $9k + $5k + $3k = $17k
    // Royalties: $2k
    expect(result.netRentalIncome).toBe(17000);
    expect(result.royaltyIncome).toBe(2000);
    expect(result.scheduleEIncome).toBe(19000);
  });
});

// ═════════════════════════════════════════════════════════════
// Full Form 1040 integration tests
// ═════════════════════════════════════════════════════════════

describe('1099-MISC Box 1/2 — Form 1040 integration', () => {
  it('Box 3 still flows to other income (backward compatibility)', () => {
    const result = calculateForm1040(makeReturn({
      income1099MISC: [make1099MISC({ otherIncome: 5000 })],
    }));
    expect(result.form1040.total1099MISCIncome).toBe(5000);
    expect(result.form1040.totalIncome).toBeGreaterThanOrEqual(5000);
  });

  it('Box 1 rents flow through Schedule E', () => {
    const result = calculateForm1040(makeReturn({
      income1099MISC: [make1099MISC({ rents: 15000 })],
    }));
    expect(result.scheduleE).toBeDefined();
    expect(result.scheduleE!.totalRentalIncome).toBe(15000);
    expect(result.form1040.scheduleEIncome).toBe(15000);
  });

  it('Box 2 royalties flow through Schedule E', () => {
    const result = calculateForm1040(makeReturn({
      income1099MISC: [make1099MISC({ royalties: 8000 })],
    }));
    expect(result.scheduleE).toBeDefined();
    expect(result.scheduleE!.royaltyIncome).toBe(8000);
    expect(result.form1040.royaltyIncome).toBe(8000);
    expect(result.form1040.scheduleEIncome).toBe(8000);
  });

  it('all three boxes populated in one 1099-MISC', () => {
    const result = calculateForm1040(makeReturn({
      income1099MISC: [make1099MISC({
        rents: 10000,
        royalties: 5000,
        otherIncome: 3000,
      })],
    }));
    expect(result.form1040.total1099MISCIncome).toBe(3000);  // Box 3 only
    expect(result.scheduleE!.totalRentalIncome).toBe(10000);
    expect(result.scheduleE!.royaltyIncome).toBe(5000);
    expect(result.form1040.scheduleEIncome).toBe(15000);
  });

  it('multiple 1099-MISC forms aggregate correctly', () => {
    const result = calculateForm1040(makeReturn({
      income1099MISC: [
        make1099MISC({ id: 'misc-1', rents: 8000, royalties: 2000, otherIncome: 500 }),
        make1099MISC({ id: 'misc-2', rents: 4000, otherIncome: 1500 }),
        make1099MISC({ id: 'misc-3', royalties: 3000 }),
      ],
    }));
    expect(result.form1040.total1099MISCIncome).toBe(2000);   // 500 + 1500
    expect(result.scheduleE!.totalRentalIncome).toBe(12000);  // 8000 + 4000
    expect(result.scheduleE!.royaltyIncome).toBe(5000);        // 2000 + 3000
  });

  it('1099-MISC rents + K-1 rental income aggregate in Schedule E', () => {
    const result = calculateForm1040(makeReturn({
      income1099MISC: [make1099MISC({ rents: 6000 })],
      incomeK1: [{
        id: 'k1-1',
        entityName: 'RE Partnership',
        entityType: 'partnership',
        rentalIncome: 10000,
      }],
    }));
    expect(result.scheduleE!.totalRentalIncome).toBe(16000); // 6000 + 10000
    expect(result.form1040.scheduleEIncome).toBe(16000);
  });

  it('1099-MISC royalties + K-1 royalties aggregate in Schedule E', () => {
    const result = calculateForm1040(makeReturn({
      income1099MISC: [make1099MISC({ royalties: 4000 })],
      incomeK1: [{
        id: 'k1-1',
        entityName: 'Oil Partnership',
        entityType: 'partnership',
        royalties: 6000,
      }],
    }));
    expect(result.scheduleE!.royaltyIncome).toBe(10000); // 4000 + 6000
    expect(result.form1040.royaltyIncome).toBe(10000);
  });

  it('federal withholding from 1099-MISC is collected', () => {
    const result = calculateForm1040(makeReturn({
      income1099MISC: [make1099MISC({
        rents: 20000,
        federalTaxWithheld: 2000,
      })],
    }));
    expect(result.form1040.totalWithholding).toBeGreaterThanOrEqual(2000);
  });

  it('Box 1/2 undefined or zero has no impact', () => {
    const resultWithBoxes = calculateForm1040(makeReturn({
      income1099MISC: [make1099MISC({
        rents: 0,
        royalties: undefined,
        otherIncome: 5000,
      })],
    }));
    const resultWithout = calculateForm1040(makeReturn({
      income1099MISC: [make1099MISC({ otherIncome: 5000 })],
    }));
    expect(resultWithBoxes.form1040.totalIncome).toBe(resultWithout.form1040.totalIncome);
    expect(resultWithBoxes.form1040.total1099MISCIncome).toBe(5000);
  });

  it('Box 1 rents subject to passive loss rules at high AGI (Form 8582)', () => {
    // $50k rents with high AGI → passive losses should be limited
    // Use a rental property with a loss + 1099-MISC rents to see interaction
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2-1', employerName: 'Corp', wages: 200000, federalTaxWithheld: 40000, socialSecurityWages: 200000, medicareWages: 200000 }],
      rentalProperties: [{
        id: 'prop-1',
        address: '789 Pine St',
        propertyType: 'single_family',
        daysRented: 365,
        personalUseDays: 0,
        rentalIncome: 10000,
        repairs: 40000, // $30k loss
      }],
      income1099MISC: [make1099MISC({ rents: 5000 })],
    }));
    // Net rental: ($10k - $40k) + $5k = -$25k
    // At $200k AGI, passive loss allowance is fully phased out
    // So rental portion = 0 (suspended), but rents contribute to the net
    expect(result.form8582).toBeDefined();
    expect(result.form8582!.totalSuspendedLoss).toBeGreaterThan(0);
  });

  it('royalties included in NIIT investment income', () => {
    const result = calculateForm1040(makeReturn({
      w2Income: [{ id: 'w2-1', employerName: 'Corp', wages: 250000, federalTaxWithheld: 60000, socialSecurityWages: 250000, medicareWages: 250000 }],
      income1099MISC: [make1099MISC({ royalties: 20000 })],
    }));
    // AGI ~$270k, well above $200k NIIT threshold
    // NIIT should apply to royalty income
    expect(result.form1040.niitTax).toBeGreaterThan(0);
  });
});
