import { describe, it, expect } from 'vitest';
import { calculateScheduleE } from '../src/engine/scheduleE.js';
import type { RentalProperty, RoyaltyProperty } from '../src/types/index.js';

const makeRental = (overrides: Partial<RentalProperty> = {}): RentalProperty => ({
  id: 'r1',
  address: '123 Main St',
  propertyType: 'single_family',
  daysRented: 365,
  personalUseDays: 0,
  rentalIncome: 24000,
  ...overrides,
});

const makeRoyalty = (overrides: Partial<RoyaltyProperty> = {}): RoyaltyProperty => ({
  id: 'roy1',
  description: 'Oil & Gas Lease',
  royaltyType: 'oil_gas',
  royaltyIncome: 10000,
  ...overrides,
});

describe('Schedule E — Royalty Income', () => {
  it('includes royalty property income in scheduleEIncome', () => {
    const result = calculateScheduleE([], 0, 0, 0, [makeRoyalty()]);
    expect(result.royaltyIncome).toBe(10000);
    expect(result.scheduleEIncome).toBe(10000);
  });

  it('deducts royalty property expenses', () => {
    const royalty = makeRoyalty({ depreciation: 3000, taxes: 500 });
    const result = calculateScheduleE([], 0, 0, 0, [royalty]);
    expect(result.royaltyIncome).toBe(10000);
    expect(result.totalRoyaltyExpenses).toBe(3500);
    expect(result.scheduleEIncome).toBe(6500); // 10000 - 3500
  });

  it('combines royalty properties with 1099-MISC royalties', () => {
    const royalty = makeRoyalty({ royaltyIncome: 5000 });
    const misc1099Royalties = 3000;
    const result = calculateScheduleE([], 0, 0, misc1099Royalties, [royalty]);
    expect(result.royaltyIncome).toBe(8000); // 5000 + 3000
    expect(result.scheduleEIncome).toBe(8000);
  });

  it('handles multiple royalty properties', () => {
    const r1 = makeRoyalty({ id: 'r1', royaltyIncome: 10000, depreciation: 2000 });
    const r2 = makeRoyalty({ id: 'r2', description: 'Book Royalties', royaltyType: 'book_literary', royaltyIncome: 5000, legal: 500 });
    const result = calculateScheduleE([], 0, 0, 0, [r1, r2]);
    expect(result.royaltyIncome).toBe(15000);
    expect(result.totalRoyaltyExpenses).toBe(2500);
    expect(result.scheduleEIncome).toBe(12500);
    expect(result.royaltyPropertyResults).toHaveLength(2);
    expect(result.royaltyPropertyResults![0].netIncome).toBe(8000);
    expect(result.royaltyPropertyResults![1].netIncome).toBe(4500);
  });

  it('combines rental and royalty income in scheduleEIncome', () => {
    const rental = makeRental({ rentalIncome: 24000, mortgageInterest: 12000, taxes: 4000 });
    const royalty = makeRoyalty({ royaltyIncome: 8000, depreciation: 1500 });
    const result = calculateScheduleE([rental], 0, 0, 0, [royalty]);
    // Rental net: 24000 - 16000 = 8000
    // Royalty net: 8000 - 1500 = 6500
    expect(result.netRentalIncome).toBe(8000);
    expect(result.royaltyIncome).toBe(8000);
    expect(result.totalRoyaltyExpenses).toBe(1500);
    expect(result.scheduleEIncome).toBe(14500); // 8000 + 6500
  });

  it('royalty properties do not affect rental property results', () => {
    const rental = makeRental();
    const royalty = makeRoyalty();
    const result = calculateScheduleE([rental], 0, 0, 0, [royalty]);
    expect(result.propertyResults).toHaveLength(1);
    expect(result.royaltyPropertyResults).toHaveLength(1);
  });

  it('returns empty result with no income', () => {
    const result = calculateScheduleE([], 0, 0, 0, []);
    expect(result.scheduleEIncome).toBe(0);
    expect(result.royaltyIncome).toBe(0);
    expect(result.totalRoyaltyExpenses).toBe(0);
  });

  it('handles royalty expenses exceeding income (net loss)', () => {
    const royalty = makeRoyalty({ royaltyIncome: 2000, depreciation: 5000 });
    const result = calculateScheduleE([], 0, 0, 0, [royalty]);
    expect(result.royaltyIncome).toBe(2000);
    expect(result.totalRoyaltyExpenses).toBe(5000);
    expect(result.scheduleEIncome).toBe(-3000);
    expect(result.royaltyPropertyResults![0].netIncome).toBe(-3000);
  });
});
