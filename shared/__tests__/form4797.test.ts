/**
 * Form 4797 — Sales of Business Property
 *
 * Tests for:
 *   1. calculateForm4797 — §1245/§1250/§1231 depreciation recapture
 *   2. convertDisposedRentalsToForm4797 — bridge from disposed rentals
 *
 * @authority IRC §1231, §1245, §1250, §1(h)(1)(E)
 */
import { describe, it, expect } from 'vitest';
import { calculateForm4797 } from '../src/engine/form4797.js';
import { convertDisposedRentalsToForm4797 } from '../src/engine/form1040Sections.js';
import { Form4797Property, RentalProperty } from '../src/types/index.js';

// ═════════════════════════════════════════════════════════════════════════════
// calculateForm4797 — Core recapture engine
// ═════════════════════════════════════════════════════════════════════════════

describe('calculateForm4797 — §1245 recapture', () => {
  it('recaptures all depreciation as ordinary income (up to gain)', () => {
    const props: Form4797Property[] = [{
      id: 'equip1',
      description: 'Office Equipment',
      dateAcquired: '2020-01-01',
      dateSold: '2025-06-15',
      salesPrice: 15000,
      costBasis: 20000,
      depreciationAllowed: 12000,
      isSection1245: true,
    }];

    const result = calculateForm4797(props);
    const p = result.propertyResults[0];

    // adjustedBasis = 20K - 12K = 8K, gain = 15K - 8K = 7K
    expect(p.adjustedBasis).toBe(8000);
    expect(p.gain).toBe(7000);
    expect(p.loss).toBe(0);

    // §1245: min(gain, depreciationAllowed) = min(7K, 12K) = 7K ordinary
    expect(p.section1245OrdinaryIncome).toBe(7000);
    expect(p.section1250OrdinaryIncome).toBe(0);
    expect(p.unrecapturedSection1250Gain).toBe(0);

    // Remaining: 7K - 7K = 0 §1231 gain
    expect(p.section1231GainOrLoss).toBe(0);

    // Aggregate
    expect(result.totalOrdinaryIncome).toBe(7000);
    expect(result.netSection1231GainOrLoss).toBe(0);
    expect(result.unrecapturedSection1250Gain).toBe(0);
  });

  it('gain above depreciation flows to §1231', () => {
    const props: Form4797Property[] = [{
      id: 'equip2',
      description: 'Machinery',
      dateAcquired: '2018-01-01',
      dateSold: '2025-12-01',
      salesPrice: 50000,
      costBasis: 30000,
      depreciationAllowed: 25000,
      isSection1245: true,
    }];

    const result = calculateForm4797(props);
    const p = result.propertyResults[0];

    // adjustedBasis = 30K - 25K = 5K, gain = 50K - 5K = 45K
    expect(p.gain).toBe(45000);
    // §1245 ordinary = min(45K, 25K) = 25K
    expect(p.section1245OrdinaryIncome).toBe(25000);
    // Remaining 20K → §1231
    expect(p.section1231GainOrLoss).toBe(20000);

    expect(result.totalOrdinaryIncome).toBe(25000);
    expect(result.netSection1231GainOrLoss).toBe(20000);
    expect(result.section1231IsGain).toBe(true);
  });
});

describe('calculateForm4797 — §1250 recapture (real property)', () => {
  it('all straight-line depreciation → entire gain is unrecaptured §1250 (25% rate)', () => {
    // Typical residential rental: all straight-line, no excess depreciation
    const props: Form4797Property[] = [{
      id: 'rental1',
      description: 'Rental Building',
      dateAcquired: '2020-01-01',
      dateSold: '2025-06-15',
      salesPrice: 215000,
      costBasis: 200000,
      depreciationAllowed: 36000,
      isSection1250: true,
      straightLineDepreciation: 36000,  // All straight-line (27.5 yr MACRS)
    }];

    const result = calculateForm4797(props);
    const p = result.propertyResults[0];

    // adjustedBasis = 200K - 36K = 164K, gain = 215K - 164K = 51K
    expect(p.adjustedBasis).toBe(164000);
    expect(p.gain).toBe(51000);

    // No excess depreciation → no §1250 ordinary
    expect(p.section1250OrdinaryIncome).toBe(0);

    // Unrecaptured §1250 = min(51K, 36K) = 36K
    expect(p.unrecapturedSection1250Gain).toBe(36000);

    // §1231 gain = remaining 51K (includes the §1250 portion as a rate classification)
    expect(p.section1231GainOrLoss).toBe(51000);

    expect(result.totalOrdinaryIncome).toBe(0);
    expect(result.netSection1231GainOrLoss).toBe(51000);
    expect(result.section1231IsGain).toBe(true);
    expect(result.unrecapturedSection1250Gain).toBe(36000);
  });

  it('gain less than depreciation → all gain is unrecaptured §1250', () => {
    // Gain < cumulative depreciation
    const props: Form4797Property[] = [{
      id: 'rental2',
      description: 'Rental Building',
      dateAcquired: '2015-01-01',
      dateSold: '2025-06-15',
      salesPrice: 179000,
      costBasis: 200000,
      depreciationAllowed: 36000,
      isSection1250: true,
      straightLineDepreciation: 36000,
    }];

    const result = calculateForm4797(props);
    const p = result.propertyResults[0];

    // adjustedBasis = 164K, gain = 179K - 164K = 15K
    expect(p.gain).toBe(15000);
    expect(p.section1250OrdinaryIncome).toBe(0);

    // Unrecaptured §1250 = min(15K, 36K) = 15K (entire gain)
    expect(p.unrecapturedSection1250Gain).toBe(15000);

    // §1231 = 15K (full remaining gain; §1250 is a rate subset)
    expect(p.section1231GainOrLoss).toBe(15000);

    expect(result.netSection1231GainOrLoss).toBe(15000);
    expect(result.unrecapturedSection1250Gain).toBe(15000);
  });

  it('excess depreciation → ordinary + unrecaptured §1250 + §1231', () => {
    // Accelerated depreciation on commercial property
    const props: Form4797Property[] = [{
      id: 'comm1',
      description: 'Commercial Building',
      dateAcquired: '2010-01-01',
      dateSold: '2025-06-15',
      salesPrice: 400000,
      costBasis: 300000,
      depreciationAllowed: 100000,
      isSection1250: true,
      straightLineDepreciation: 70000,  // Excess = 30K
    }];

    const result = calculateForm4797(props);
    const p = result.propertyResults[0];

    // adjustedBasis = 300K - 100K = 200K, gain = 400K - 200K = 200K
    expect(p.gain).toBe(200000);

    // Excess depreciation = 100K - 70K = 30K
    // §1250 ordinary = min(200K, 30K) = 30K
    expect(p.section1250OrdinaryIncome).toBe(30000);

    // Remaining = 200K - 30K = 170K
    // Unrecaptured §1250 = min(170K, 70K) = 70K
    expect(p.unrecapturedSection1250Gain).toBe(70000);

    // §1231 = 170K (full remaining after ordinary recapture)
    expect(p.section1231GainOrLoss).toBe(170000);

    expect(result.totalOrdinaryIncome).toBe(30000);
    expect(result.netSection1231GainOrLoss).toBe(170000);
    expect(result.unrecapturedSection1250Gain).toBe(70000);
  });
});

describe('calculateForm4797 — loss and netting', () => {
  it('loss → no recapture, all to §1231 netting', () => {
    const props: Form4797Property[] = [{
      id: 'loss1',
      description: 'Rental sold at loss',
      dateAcquired: '2020-01-01',
      dateSold: '2025-06-15',
      salesPrice: 150000,
      costBasis: 200000,
      depreciationAllowed: 30000,
      isSection1250: true,
      straightLineDepreciation: 30000,
    }];

    const result = calculateForm4797(props);
    const p = result.propertyResults[0];

    // adjustedBasis = 170K, loss = 150K - 170K = -20K
    expect(p.gain).toBe(0);
    expect(p.loss).toBe(20000);
    expect(p.section1250OrdinaryIncome).toBe(0);
    expect(p.unrecapturedSection1250Gain).toBe(0);
    expect(p.section1231GainOrLoss).toBe(-20000);

    expect(result.netSection1231GainOrLoss).toBe(-20000);
    expect(result.section1231IsGain).toBe(false);
  });

  it('multiple properties: net §1231 gain vs loss', () => {
    const props: Form4797Property[] = [
      {
        id: 'gain',
        description: 'Rental A (gain)',
        dateAcquired: '2018-01-01',
        dateSold: '2025-06-15',
        salesPrice: 250000,
        costBasis: 200000,
        depreciationAllowed: 20000,
        isSection1250: true,
        straightLineDepreciation: 20000,
      },
      {
        id: 'loss',
        description: 'Rental B (loss)',
        dateAcquired: '2019-01-01',
        dateSold: '2025-06-15',
        salesPrice: 100000,
        costBasis: 150000,
        depreciationAllowed: 10000,
        isSection1250: true,
        straightLineDepreciation: 10000,
      },
    ];

    const result = calculateForm4797(props);

    // Property A: adjusted = 180K, gain = 70K, §1250 ordinary = 0, unrecaptured = 20K, §1231 = 70K
    // Property B: adjusted = 140K, loss = -40K, §1231 = -40K
    // Net §1231 = 70K + (-40K) = 30K (gain)
    expect(result.netSection1231GainOrLoss).toBe(30000);
    expect(result.section1231IsGain).toBe(true);
    expect(result.unrecapturedSection1250Gain).toBe(20000);
    expect(result.totalOrdinaryIncome).toBe(0);
  });

  it('returns empty result for no properties', () => {
    const result = calculateForm4797([]);
    expect(result.totalOrdinaryIncome).toBe(0);
    expect(result.netSection1231GainOrLoss).toBe(0);
    expect(result.unrecapturedSection1250Gain).toBe(0);
    expect(result.propertyResults).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// convertDisposedRentalsToForm4797 — Bridge function
// ═════════════════════════════════════════════════════════════════════════════

describe('convertDisposedRentalsToForm4797 — bridge function', () => {
  const makeRental = (overrides: Partial<RentalProperty>): RentalProperty => ({
    id: 'r1',
    address: '123 Main St',
    propertyType: 'single_family',
    daysRented: 365,
    personalUseDays: 0,
    rentalIncome: 12000,
    ...overrides,
  });

  it('converts disposed rental with sale details to Form4797Property', () => {
    const rentals = [makeRental({
      disposedDuringYear: true,
      salesPrice: 250000,
      costBasis: 200000,
      cumulativeDepreciation: 36000,
    })];

    const result = convertDisposedRentalsToForm4797(rentals);
    expect(result).toHaveLength(1);

    const p = result[0];
    expect(p.id).toBe('rental-4797-r1');
    expect(p.description).toBe('123 Main St');
    expect(p.salesPrice).toBe(250000);
    expect(p.costBasis).toBe(200000);
    expect(p.depreciationAllowed).toBe(36000);
    expect(p.isSection1250).toBe(true);
    expect(p.straightLineDepreciation).toBe(36000);
  });

  it('skips non-disposed rentals', () => {
    const rentals = [makeRental({
      disposedDuringYear: false,
      salesPrice: 250000,
      costBasis: 200000,
    })];

    expect(convertDisposedRentalsToForm4797(rentals)).toHaveLength(0);
  });

  it('skips disposed rentals without salesPrice', () => {
    const rentals = [makeRental({
      disposedDuringYear: true,
      costBasis: 200000,
      // salesPrice missing
    })];

    expect(convertDisposedRentalsToForm4797(rentals)).toHaveLength(0);
  });

  it('skips disposed rentals without costBasis', () => {
    const rentals = [makeRental({
      disposedDuringYear: true,
      salesPrice: 250000,
      // costBasis missing
    })];

    expect(convertDisposedRentalsToForm4797(rentals)).toHaveLength(0);
  });

  it('handles zero cumulativeDepreciation', () => {
    const rentals = [makeRental({
      disposedDuringYear: true,
      salesPrice: 210000,
      costBasis: 200000,
      // cumulativeDepreciation not set → defaults to 0
    })];

    const result = convertDisposedRentalsToForm4797(rentals);
    expect(result).toHaveLength(1);
    expect(result[0].depreciationAllowed).toBe(0);
    expect(result[0].straightLineDepreciation).toBe(0);
  });

  it('converts multiple disposed rentals, skips non-disposed', () => {
    const rentals = [
      makeRental({ id: 'disposed1', disposedDuringYear: true, salesPrice: 200000, costBasis: 180000, cumulativeDepreciation: 20000 }),
      makeRental({ id: 'active', disposedDuringYear: false }),
      makeRental({ id: 'disposed2', disposedDuringYear: true, salesPrice: 150000, costBasis: 160000, cumulativeDepreciation: 15000 }),
    ];

    const result = convertDisposedRentalsToForm4797(rentals);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('rental-4797-disposed1');
    expect(result[1].id).toBe('rental-4797-disposed2');
  });
});
