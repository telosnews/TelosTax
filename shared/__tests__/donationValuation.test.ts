import { describe, it, expect } from 'vitest';
import {
  searchDonationItems,
  getItemsByCategory,
  calculateDatabaseFMV,
  calculateSliderFMV,
  calculateDepreciatedFMV,
  DONATION_ITEMS,
  DONATION_CATEGORIES,
  DEPRECIATION_SCHEDULES,
  getDepreciationSchedule,
} from '../src/index';
import type { DonationItemEntry } from '../src/index';

// ─── Search ─────────────────────────────────────────────────

describe('searchDonationItems', () => {
  it('exact name match scores highest', () => {
    const results = searchDonationItems('Sofa / Couch');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('Sofa / Couch');
    expect(results[0].score).toBe(1.0);
  });

  it('finds items by substring match in name', () => {
    const results = searchDonationItems('sofa');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.item.name.toLowerCase().includes('sofa'))).toBe(true);
  });

  it('token-based matching: "mens jacket" finds items via keywords', () => {
    const results = searchDonationItems('mens jacket');
    expect(results.length).toBeGreaterThan(0);
  });

  it('apostrophe/hyphen normalization: "men\'s" matches "mens" items', () => {
    const results = searchDonationItems("men's overcoat", 'clothing_mens');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('Overcoat');
  });

  it('category filter narrows results', () => {
    const all = searchDonationItems('shoes');
    const mensOnly = searchDonationItems('shoes', 'clothing_mens');
    expect(all.length).toBeGreaterThan(mensOnly.length);
    expect(mensOnly.every((r) => r.item.category === 'clothing_mens')).toBe(true);
  });

  it('returns empty for no match', () => {
    const results = searchDonationItems('zzqxjkw');
    expect(results).toEqual([]);
  });

  it('respects maxResults limit', () => {
    const results = searchDonationItems('shirt', undefined, 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('ranking: exact name > starts-with > substring > keyword', () => {
    // "Blender" should score higher than items that only match via keywords
    const results = searchDonationItems('blender');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('Blender');
  });

  it('returns empty for empty query', () => {
    expect(searchDonationItems('')).toEqual([]);
    expect(searchDonationItems('   ')).toEqual([]);
  });
});

describe('getItemsByCategory', () => {
  it('returns items sorted alphabetically', () => {
    const items = getItemsByCategory('furniture');
    expect(items.length).toBeGreaterThan(0);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].name.localeCompare(items[i - 1].name)).toBeGreaterThanOrEqual(0);
    }
  });

  it('all returned items match the category', () => {
    const items = getItemsByCategory('electronics');
    expect(items.every((i) => i.category === 'electronics')).toBe(true);
  });
});

// ─── FMV Calculation ────────────────────────────────────────

describe('calculateDatabaseFMV', () => {
  const testItem: DonationItemEntry = {
    id: 'test-1',
    name: 'Test Sofa',
    category: 'furniture',
    lowFMV: 35,
    highFMV: 200,
    source: 'salvation_army',
  };

  it('Good condition = lowFMV', () => {
    expect(calculateDatabaseFMV(testItem, 'good')).toBe(35);
  });

  it('Like New condition = highFMV', () => {
    expect(calculateDatabaseFMV(testItem, 'like_new')).toBe(200);
  });

  it('Very Good condition = midpoint (rounded)', () => {
    // (35 + 200) / 2 = 117.5
    expect(calculateDatabaseFMV(testItem, 'very_good')).toBe(117.5);
  });
});

describe('calculateSliderFMV', () => {
  const testItem: DonationItemEntry = {
    id: 'test-2',
    name: 'Test Item',
    category: 'electronics',
    lowFMV: 20,
    highFMV: 100,
    source: 'goodwill',
  };

  it('position 0.0 = lowFMV', () => {
    expect(calculateSliderFMV(testItem, 0.0)).toBe(20);
  });

  it('position 1.0 = highFMV', () => {
    expect(calculateSliderFMV(testItem, 1.0)).toBe(100);
  });

  it('clamped to [0, 1] for out-of-range inputs', () => {
    expect(calculateSliderFMV(testItem, -0.5)).toBe(20);
    expect(calculateSliderFMV(testItem, 1.5)).toBe(100);
  });

  it('interpolation at arbitrary position', () => {
    // 20 + 0.25 * 80 = 40
    expect(calculateSliderFMV(testItem, 0.25)).toBe(40);
  });

  it('position 0.5 = midpoint', () => {
    // 20 + 0.5 * 80 = 60
    expect(calculateSliderFMV(testItem, 0.5)).toBe(60);
  });

  it('handles zero range (lowFMV === highFMV)', () => {
    const zeroRange: DonationItemEntry = {
      id: 'test-zero', name: 'Test', category: 'furniture',
      lowFMV: 50, highFMV: 50, source: 'goodwill',
    };
    expect(calculateSliderFMV(zeroRange, 0)).toBe(50);
    expect(calculateSliderFMV(zeroRange, 0.5)).toBe(50);
    expect(calculateSliderFMV(zeroRange, 1)).toBe(50);
    expect(calculateDatabaseFMV(zeroRange, 'good')).toBe(50);
    expect(calculateDatabaseFMV(zeroRange, 'very_good')).toBe(50);
    expect(calculateDatabaseFMV(zeroRange, 'like_new')).toBe(50);
  });
});

// ─── Depreciation ───────────────────────────────────────────

describe('calculateDepreciatedFMV', () => {
  it('year 1 electronics: $1000 → $570 (43% depreciated)', () => {
    const result = calculateDepreciatedFMV({ originalPrice: 1000, ageYears: 1, category: 'electronics' });
    expect(result.estimatedFMV).toBe(570);
    expect(result.depreciationRate).toBe(0.43);
  });

  it('year 5 furniture: $500 → $325 (35% depreciated)', () => {
    const result = calculateDepreciatedFMV({ originalPrice: 500, ageYears: 5, category: 'furniture' });
    expect(result.estimatedFMV).toBe(325);
    expect(result.depreciationRate).toBe(0.35);
  });

  it('floor rate for items older than schedule: electronics floor .90 → 10% retained', () => {
    const result = calculateDepreciatedFMV({ originalPrice: 1000, ageYears: 10, category: 'electronics' });
    expect(result.estimatedFMV).toBe(100);
    expect(result.depreciationRate).toBe(0.9);
  });

  it('zero original price → 0 FMV', () => {
    const result = calculateDepreciatedFMV({ originalPrice: 0, ageYears: 2, category: 'furniture' });
    expect(result.estimatedFMV).toBe(0);
  });

  it('negative original price → 0 FMV', () => {
    const result = calculateDepreciatedFMV({ originalPrice: -500, ageYears: 2, category: 'furniture' });
    expect(result.estimatedFMV).toBe(0);
  });

  it('general fallback for unknown categories', () => {
    const result = calculateDepreciatedFMV({ originalPrice: 1000, ageYears: 1, category: 'general' });
    expect(result.estimatedFMV).toBe(700);
    expect(result.depreciationRate).toBe(0.3);
  });

  it('furniture depreciates slower than electronics (cross-category comparison)', () => {
    const furniture = calculateDepreciatedFMV({ originalPrice: 1000, ageYears: 3, category: 'furniture' });
    const electronics = calculateDepreciatedFMV({ originalPrice: 1000, ageYears: 3, category: 'electronics' });
    expect(furniture.estimatedFMV).toBeGreaterThan(electronics.estimatedFMV);
  });

  it('fractional years: 0.5 year electronics → interpolated between 0% and 43%', () => {
    const result = calculateDepreciatedFMV({ originalPrice: 1000, ageYears: 0.5, category: 'electronics' });
    // At 0.5 years: rate = 0 + 0.5 * (0.43 - 0) = 0.215
    // FMV = 1000 * (1 - 0.215) = 785
    expect(result.estimatedFMV).toBe(785);
    expect(result.depreciationRate).toBe(0.22); // round2(0.215) = 0.22
  });

  it('returns correct method string', () => {
    const result = calculateDepreciatedFMV({ originalPrice: 1000, ageYears: 1, category: 'electronics' });
    expect(result.method).toBe('Depreciation estimate from original cost');
  });

  it('age 0 → no depreciation', () => {
    const result = calculateDepreciatedFMV({ originalPrice: 1000, ageYears: 0, category: 'electronics' });
    expect(result.estimatedFMV).toBe(1000);
    expect(result.depreciationRate).toBe(0);
  });

  it('year 3 clothing: high depreciation', () => {
    const result = calculateDepreciatedFMV({ originalPrice: 100, ageYears: 3, category: 'clothing_mens' });
    expect(result.estimatedFMV).toBe(25);
    expect(result.depreciationRate).toBe(0.75);
  });
});

// ─── Database Integrity ─────────────────────────────────────

describe('donation database integrity', () => {
  it('every item has lowFMV <= highFMV', () => {
    for (const item of DONATION_ITEMS) {
      expect(item.lowFMV).toBeLessThanOrEqual(item.highFMV);
    }
  });

  it('every item has lowFMV >= 0', () => {
    for (const item of DONATION_ITEMS) {
      expect(item.lowFMV).toBeGreaterThanOrEqual(0);
    }
  });

  it('every item references a valid category', () => {
    const validCategories = new Set(DONATION_CATEGORIES.map((c) => c.id));
    for (const item of DONATION_ITEMS) {
      expect(validCategories.has(item.category)).toBe(true);
    }
  });

  it("every item has a valid source ('salvation_army' | 'goodwill')", () => {
    for (const item of DONATION_ITEMS) {
      expect(['salvation_army', 'goodwill']).toContain(item.source);
    }
  });

  it('no duplicate item IDs', () => {
    const ids = DONATION_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('at least 150 items in the database', () => {
    expect(DONATION_ITEMS.length).toBeGreaterThanOrEqual(150);
  });

  it('all keywords are lowercase (if present)', () => {
    for (const item of DONATION_ITEMS) {
      if (item.keywords) {
        for (const kw of item.keywords) {
          expect(kw).toBe(kw.toLowerCase());
        }
      }
    }
  });

  it('every category has at least one item', () => {
    const categoriesWithItems = new Set(DONATION_ITEMS.map((i) => i.category));
    for (const cat of DONATION_CATEGORIES) {
      expect(categoriesWithItems.has(cat.id)).toBe(true);
    }
  });

  it('depreciation schedules include a general fallback', () => {
    const general = getDepreciationSchedule('general');
    expect(general.category).toBe('general');
    expect(general.rates.length).toBeGreaterThan(0);
  });

  it('all depreciation rates are between 0 and 1', () => {
    for (const schedule of DEPRECIATION_SCHEDULES) {
      for (const rate of schedule.rates) {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      }
      expect(schedule.floorRate).toBeGreaterThanOrEqual(0);
      expect(schedule.floorRate).toBeLessThanOrEqual(1);
    }
  });

  it('depreciation rates are monotonically increasing within each schedule', () => {
    for (const schedule of DEPRECIATION_SCHEDULES) {
      for (let i = 1; i < schedule.rates.length; i++) {
        expect(schedule.rates[i]).toBeGreaterThanOrEqual(schedule.rates[i - 1]);
      }
    }
  });
});
