import { describe, it, expect } from 'vitest';
import { calculateForm4562, getQuarter, detectConvention } from '../src/engine/form4562.js';
import { DepreciationAsset, MACRSPropertyClass } from '../src/types/index.js';
import { SECTION_179, MACRS_GDS_RATES, MACRS_GDS_RATES_MID_QUARTER } from '../src/constants/tax2025.js';

// ── Helpers ──────────────────────────────────────────────────

function makeAsset(overrides: Partial<DepreciationAsset> = {}): DepreciationAsset {
  return {
    id: 'a1',
    description: 'MacBook Pro',
    cost: 2000,
    dateInService: '2025-06-15',
    propertyClass: 5,
    businessUsePercent: 100,
    ...overrides,
  };
}

// ── Empty / Edge Cases ───────────────────────────────────────

describe('Form 4562 — Empty and edge cases', () => {
  it('returns zero result with no assets', () => {
    const result = calculateForm4562([], 50000);
    expect(result.totalDepreciation).toBe(0);
    expect(result.assetDetails).toHaveLength(0);
    expect(result.section179Deduction).toBe(0);
    expect(result.bonusDepreciationTotal).toBe(0);
  });

  it('returns zero result with null-ish assets', () => {
    const result = calculateForm4562(null as unknown as DepreciationAsset[], 50000);
    expect(result.totalDepreciation).toBe(0);
  });

  it('skips disposed assets', () => {
    const disposed = makeAsset({ disposed: true, section179Election: 2000 });
    const result = calculateForm4562([disposed], 50000);
    expect(result.totalDepreciation).toBe(0);
    expect(result.assetDetails).toHaveLength(0);
  });
});

// ── Section 179 — Part I ─────────────────────────────────────

describe('Form 4562 Part I — Section 179', () => {
  it('single asset: full cost elected → deduction = cost', () => {
    const asset = makeAsset({ cost: 2000, section179Election: 2000 });
    const result = calculateForm4562([asset], 50000);

    expect(result.section179Deduction).toBe(2000);
    expect(result.section179Elected).toBe(2000);
    expect(result.section179Carryforward).toBe(0);
    // With 179 covering full cost, bonus and MACRS should be 0
    expect(result.bonusDepreciationTotal).toBe(0);
    expect(result.macrsCurrentYear).toBe(0);
    expect(result.totalDepreciation).toBe(2000);
  });

  it('partial Section 179 election → remainder gets bonus depreciation', () => {
    const asset = makeAsset({ cost: 5000, section179Election: 1000 });
    const result = calculateForm4562([asset], 50000);

    expect(result.section179Deduction).toBe(1000);
    // Remaining $4,000 gets 100% bonus
    expect(result.bonusDepreciationTotal).toBe(4000);
    expect(result.totalDepreciation).toBe(5000);
  });

  it('no Section 179 election → all goes to bonus depreciation', () => {
    const asset = makeAsset({ cost: 3000, section179Election: 0 });
    const result = calculateForm4562([asset], 50000);

    expect(result.section179Deduction).toBe(0);
    expect(result.bonusDepreciationTotal).toBe(3000);
    expect(result.totalDepreciation).toBe(3000);
  });

  it('Section 179 capped at $2,500,000 limit (OBBBA §70306)', () => {
    const asset = makeAsset({ cost: 3000000, section179Election: 3000000 });
    const result = calculateForm4562([asset], 5000000);

    expect(result.section179Deduction).toBe(SECTION_179.MAX_DEDUCTION);
    // Remaining $500,000 gets bonus depreciation
    expect(result.bonusDepreciationTotal).toBe(500000);
    expect(result.totalDepreciation).toBe(3000000);
  });

  it('Section 179 phaseout when total cost exceeds threshold', () => {
    // Total cost = $4,100,000 (exceeds $4,000,000 by $100,000)
    // Max deduction reduced to $2,500,000 - $100,000 = $2,400,000
    const asset = makeAsset({ cost: 4100000, section179Election: 2500000 });
    const result = calculateForm4562([asset], 5000000);

    expect(result.section179ThresholdReduction).toBe(100000);
    expect(result.section179MaxAfterReduction).toBe(2400000);
    expect(result.section179Deduction).toBe(2400000);
  });

  it('Section 179 fully phased out at extreme cost levels', () => {
    // Total cost = $6,500,000 → reduction = $2,500,000 → max = $0
    const asset = makeAsset({ cost: 6500000, section179Election: 2500000 });
    const result = calculateForm4562([asset], 10000000);

    expect(result.section179MaxAfterReduction).toBe(0);
    expect(result.section179Deduction).toBe(0);
    // All goes to bonus
    expect(result.bonusDepreciationTotal).toBe(6500000);
  });

  it('Section 179 limited by business taxable income — no double-dip', () => {
    const asset = makeAsset({ cost: 10000, section179Election: 10000 });
    // Business income = $3,000 → caps 179 allowed deduction
    const result = calculateForm4562([asset], 3000);

    expect(result.section179BusinessIncomeLimit).toBe(3000);
    expect(result.section179Deduction).toBe(3000);
    expect(result.section179Carryforward).toBe(7000);
    // Per Treas. Reg. §1.179-1(f)(2): basis reduced by ELECTED amount ($10k),
    // not allowed amount ($3k). No basis remains for bonus.
    expect(result.bonusDepreciationTotal).toBe(0);
    expect(result.totalDepreciation).toBe(3000);

    const detail = result.assetDetails[0];
    expect(detail.section179Amount).toBe(3000); // Display = allowed
    expect(detail.depreciableRemaining).toBe(0); // Basis fully allocated (elected)
  });

  it('Section 179 with zero business income → full carryforward, no bonus', () => {
    const asset = makeAsset({ cost: 5000, section179Election: 5000 });
    const result = calculateForm4562([asset], 0);

    expect(result.section179Deduction).toBe(0);
    expect(result.section179Carryforward).toBe(5000);
    // Per Treas. Reg. §1.179-1(f)(2): full elected amount reduces basis → no bonus
    expect(result.bonusDepreciationTotal).toBe(0);
    expect(result.totalDepreciation).toBe(0);
  });

  it('Section 179 with negative business income → zero deduction', () => {
    const asset = makeAsset({ cost: 5000, section179Election: 5000 });
    const result = calculateForm4562([asset], -2000);

    expect(result.section179Deduction).toBe(0);
    expect(result.section179Carryforward).toBe(5000);
  });

  it('multiple assets with Section 179 — proportional allocation', () => {
    const laptop = makeAsset({ id: 'a1', cost: 2000, section179Election: 2000 });
    const camera = makeAsset({ id: 'a2', description: 'Camera', cost: 3000, section179Election: 3000 });
    const result = calculateForm4562([laptop, camera], 50000);

    expect(result.section179Deduction).toBe(5000);
    const laptopDetail = result.assetDetails.find(d => d.assetId === 'a1')!;
    const cameraDetail = result.assetDetails.find(d => d.assetId === 'a2')!;
    expect(laptopDetail.section179Amount).toBe(2000);
    expect(cameraDetail.section179Amount).toBe(3000);
    expect(laptopDetail.totalDepreciation).toBe(2000);
    expect(cameraDetail.totalDepreciation).toBe(3000);
  });
});

// ── Bonus Depreciation — Part II ─────────────────────────────

describe('Form 4562 Part II — Bonus Depreciation', () => {
  it('100% bonus depreciation on current-year asset with no 179', () => {
    const asset = makeAsset({ cost: 8000 });
    const result = calculateForm4562([asset], 50000);

    expect(result.bonusDepreciationTotal).toBe(8000);
    expect(result.macrsCurrentYear).toBe(0);
    expect(result.totalDepreciation).toBe(8000);

    const detail = result.assetDetails[0];
    expect(detail.bonusDepreciation).toBe(8000);
    expect(detail.depreciableRemaining).toBe(0);
  });

  it('bonus only applies to current-year assets, not prior-year', () => {
    const priorAsset = makeAsset({ dateInService: '2024-03-01', cost: 5000 });
    const result = calculateForm4562([priorAsset], 50000);

    expect(result.bonusDepreciationTotal).toBe(0);
    // Should have MACRS instead
    expect(result.macrsPriorYears).toBeGreaterThan(0);
  });

  it('bonus applies to remaining basis after Section 179', () => {
    const asset = makeAsset({ cost: 10000, section179Election: 3000 });
    const result = calculateForm4562([asset], 50000);

    expect(result.section179Deduction).toBe(3000);
    expect(result.bonusDepreciationTotal).toBe(7000); // 10000 - 3000
    expect(result.totalDepreciation).toBe(10000);
  });
});

// ── MACRS Depreciation — Part III ────────────────────────────

describe('Form 4562 Part III — MACRS Depreciation', () => {
  it('prior-year 5-year asset: year 1 rate = 0.32', () => {
    const asset = makeAsset({
      dateInService: '2024-01-15',
      cost: 10000,
      propertyClass: 5,
      priorDepreciation: 2000, // Year 0 depreciation
    });
    const result = calculateForm4562([asset], 50000);

    // Year index = 2025 - 2024 = 1, rate = 0.32
    const detail = result.assetDetails[0];
    expect(detail.yearIndex).toBe(1);
    expect(detail.macrsDepreciation).toBe(3200); // 10000 * 0.32
    expect(result.macrsPriorYears).toBe(3200);
  });

  it('prior-year 7-year asset: year 2 rate = 0.1749', () => {
    const asset = makeAsset({
      dateInService: '2023-06-01',
      cost: 5000,
      propertyClass: 7,
      priorDepreciation: 1939, // Year 0 (0.1429*5000=714.5) + Year 1 (0.2449*5000=1224.5) ≈ 1939
    });
    const result = calculateForm4562([asset], 50000);

    // Year index = 2025 - 2023 = 2, rate = 0.1749
    const detail = result.assetDetails[0];
    expect(detail.yearIndex).toBe(2);
    expect(detail.macrsDepreciation).toBe(874.5); // 5000 * 0.1749 = 874.5
  });

  it('fully depreciated asset: year index beyond rate table → $0', () => {
    const asset = makeAsset({
      dateInService: '2018-01-01',
      cost: 3000,
      propertyClass: 5,
      priorDepreciation: 3000,
    });
    const result = calculateForm4562([asset], 50000);

    // Year index = 2025 - 2018 = 7, 5-year table only has 6 entries (0-5)
    const detail = result.assetDetails[0];
    expect(detail.yearIndex).toBe(7);
    expect(detail.macrsDepreciation).toBe(0);
    expect(detail.totalDepreciation).toBe(0);
  });

  it('MACRS capped by remaining depreciable basis', () => {
    const asset = makeAsset({
      dateInService: '2024-01-01',
      cost: 1000,
      propertyClass: 5,
      priorDepreciation: 900, // Only $100 remaining
    });
    const result = calculateForm4562([asset], 50000);

    // Year 1 rate = 0.32, raw MACRS = 320, but only $100 remaining
    const detail = result.assetDetails[0];
    expect(detail.macrsDepreciation).toBe(100);
  });

  it('3-year property class rates applied correctly', () => {
    const asset = makeAsset({
      dateInService: '2024-06-01',
      cost: 6000,
      propertyClass: 3 as MACRSPropertyClass,
      priorDepreciation: 2000, // Year 0 = 0.3333 * 6000 = 1999.8
    });
    const result = calculateForm4562([asset], 50000);

    // Year index = 1, rate = 0.4445
    const detail = result.assetDetails[0];
    expect(detail.yearIndex).toBe(1);
    expect(detail.macrsDepreciation).toBe(2667); // 6000 * 0.4445 = 2667
  });

  it('prior-year asset with prior Section 179 reduces depreciable basis', () => {
    const asset = makeAsset({
      dateInService: '2024-01-01',
      cost: 8000,
      propertyClass: 5,
      priorSection179: 3000,     // Claimed $3,000 Section 179 in 2024
      priorDepreciation: 1000,   // Year 0 MACRS: (8000-3000)*0.20 = 1000
    });
    const result = calculateForm4562([asset], 50000);

    // Basis after 179: 8000 - 3000 = 5000
    // Year 1 rate: 0.32, MACRS = 5000 * 0.32 = 1600
    const detail = result.assetDetails[0];
    expect(detail.macrsDepreciation).toBe(1600);
  });
});

// ── Business Use Percentage ──────────────────────────────────

describe('Form 4562 — Business use percentage', () => {
  it('50% business use → Section 179 and bonus ineligible, MACRS only', () => {
    const asset = makeAsset({ cost: 4000, businessUsePercent: 50, section179Election: 4000 });
    const result = calculateForm4562([asset], 50000);

    // ≤50% business use: Section 179 ineligible per IRC §179(d)(10)
    expect(result.section179Deduction).toBe(0);
    // ≤50% business use: bonus ineligible per IRC §168(k)(2)(D)(i) / §280F
    expect(result.bonusDepreciationTotal).toBe(0);
    // MACRS only: $2,000 × 0.20 (5-year half-year year 0) = $400
    expect(result.macrsCurrentYear).toBe(400);
    expect(result.totalDepreciation).toBe(400);

    const detail = result.assetDetails[0];
    expect(detail.businessUseBasis).toBe(2000);
  });

  it('75% business use with bonus depreciation', () => {
    const asset = makeAsset({ cost: 10000, businessUsePercent: 75 });
    const result = calculateForm4562([asset], 50000);

    // Business-use basis = 7500, 100% bonus
    expect(result.bonusDepreciationTotal).toBe(7500);
    expect(result.totalDepreciation).toBe(7500);
  });

  it('0% business use → no depreciation', () => {
    const asset = makeAsset({ cost: 5000, businessUsePercent: 0 });
    const result = calculateForm4562([asset], 50000);

    expect(result.totalDepreciation).toBe(0);
  });

  it('business use > 100% clamped to 100%', () => {
    const asset = makeAsset({ cost: 3000, businessUsePercent: 150 });
    const result = calculateForm4562([asset], 50000);

    // Should clamp to 100%, so full $3000 depreciable
    expect(result.bonusDepreciationTotal).toBe(3000);
  });
});

// ── Mixed Scenarios ──────────────────────────────────────────

describe('Form 4562 — Mixed scenarios', () => {
  it('current-year + prior-year assets combined', () => {
    const laptop = makeAsset({
      id: 'a1',
      cost: 2000,
      dateInService: '2025-03-01',
      section179Election: 2000,
    });
    const desk = makeAsset({
      id: 'a2',
      description: 'Standing desk',
      cost: 1500,
      dateInService: '2024-07-01',
      propertyClass: 7,
      priorDepreciation: 214, // Year 0: 1500 * 0.1429 ≈ 214.35 → rounded
    });
    const result = calculateForm4562([laptop, desk], 50000);

    // Laptop: full $2,000 via Section 179
    const laptopDetail = result.assetDetails.find(d => d.assetId === 'a1')!;
    expect(laptopDetail.section179Amount).toBe(2000);
    expect(laptopDetail.totalDepreciation).toBe(2000);

    // Desk: year 1, rate = 0.2449, MACRS = 1500 * 0.2449 = 367.35
    const deskDetail = result.assetDetails.find(d => d.assetId === 'a2')!;
    expect(deskDetail.yearIndex).toBe(1);
    expect(deskDetail.macrsDepreciation).toBe(367.35);

    expect(result.section179Deduction).toBe(2000);
    expect(result.macrsPriorYears).toBe(367.35);
    expect(result.totalDepreciation).toBe(2367.35);
  });

  it('multiple current-year assets: some with 179, some without', () => {
    const phone = makeAsset({
      id: 'a1',
      description: 'iPhone',
      cost: 1200,
      section179Election: 1200,
    });
    const printer = makeAsset({
      id: 'a2',
      description: 'Printer',
      cost: 500,
      section179Election: 0,
    });
    const result = calculateForm4562([phone, printer], 50000);

    // Phone: $1,200 via 179
    expect(result.section179Deduction).toBe(1200);
    // Printer: $500 via 100% bonus
    expect(result.bonusDepreciationTotal).toBe(500);
    expect(result.totalDepreciation).toBe(1700);
  });

  it('asset with no dateInService defaults to current year', () => {
    const asset = makeAsset({ dateInService: '' });
    const result = calculateForm4562([asset], 50000);

    // Should be treated as year 0 → gets bonus depreciation
    expect(result.bonusDepreciationTotal).toBe(2000);
  });
});

// ── Warnings ─────────────────────────────────────────────────

describe('Form 4562 — Warnings', () => {
  it('generates carryforward warning when income-limited', () => {
    const asset = makeAsset({ cost: 10000, section179Election: 10000 });
    const result = calculateForm4562([asset], 3000);

    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some(w => w.includes('carryforward'))).toBe(true);
  });

  it('generates business use warning for partial-use assets', () => {
    const asset = makeAsset({ cost: 5000, businessUsePercent: 60 });
    const result = calculateForm4562([asset], 50000);

    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some(w => w.includes('60%'))).toBe(true);
  });

  it('no warnings for simple full-use asset', () => {
    const asset = makeAsset({ cost: 2000 });
    const result = calculateForm4562([asset], 50000);

    expect(result.warnings).toBeUndefined();
  });
});

// ── Per-Asset Detail ─────────────────────────────────────────

describe('Form 4562 — Asset detail output', () => {
  it('includes correct per-asset fields', () => {
    const asset = makeAsset({ cost: 3000, section179Election: 1000 });
    const result = calculateForm4562([asset], 50000);

    expect(result.assetDetails).toHaveLength(1);
    const detail = result.assetDetails[0];
    expect(detail.assetId).toBe('a1');
    expect(detail.description).toBe('MacBook Pro');
    expect(detail.cost).toBe(3000);
    expect(detail.businessUseBasis).toBe(3000);
    expect(detail.section179Amount).toBe(1000);
    expect(detail.bonusDepreciation).toBe(2000);
    expect(detail.macrsDepreciation).toBe(0);
    expect(detail.totalDepreciation).toBe(3000);
    expect(detail.depreciableRemaining).toBe(0);
    expect(detail.propertyClass).toBe(5);
    expect(detail.yearIndex).toBe(0);
  });

  it('prior-year asset shows correct remaining basis', () => {
    const asset = makeAsset({
      dateInService: '2023-01-01',
      cost: 10000,
      propertyClass: 7,
      priorDepreciation: 3878, // Year 0 (1429) + Year 1 (2449) = 3878
    });
    const result = calculateForm4562([asset], 50000);

    const detail = result.assetDetails[0];
    expect(detail.yearIndex).toBe(2);
    // Rate at year 2 = 0.1749, MACRS = 10000 * 0.1749 = 1749
    expect(detail.macrsDepreciation).toBe(1749);
    // Remaining: 10000 - 3878 - 1749 = 4373
    expect(detail.depreciableRemaining).toBe(4373);
  });
});

// ── Rate Table Integrity ─────────────────────────────────────

describe('MACRS rate table integrity — half-year', () => {
  for (const [years, rates] of Object.entries(MACRS_GDS_RATES)) {
    it(`${years}-year rates sum to approximately 1.0`, () => {
      const sum = (rates as readonly number[]).reduce((s, r) => s + r, 0);
      expect(sum).toBeCloseTo(1.0, 3);
    });

    it(`${years}-year rates have ${Number(years) + 1} entries (half-year convention)`, () => {
      expect((rates as readonly number[]).length).toBe(Number(years) + 1);
    });
  }
});

// ── Mid-Quarter Convention: getQuarter Helper ────────────────

describe('getQuarter helper', () => {
  it('Q1: Jan–Mar', () => {
    expect(getQuarter('2025-01-15')).toBe(1);
    expect(getQuarter('2025-02-28')).toBe(1);
    expect(getQuarter('2025-03-31')).toBe(1);
  });

  it('Q2: Apr–Jun', () => {
    expect(getQuarter('2025-04-01')).toBe(2);
    expect(getQuarter('2025-05-15')).toBe(2);
    expect(getQuarter('2025-06-30')).toBe(2);
  });

  it('Q3: Jul–Sep', () => {
    expect(getQuarter('2025-07-01')).toBe(3);
    expect(getQuarter('2025-08-15')).toBe(3);
    expect(getQuarter('2025-09-30')).toBe(3);
  });

  it('Q4: Oct–Dec', () => {
    expect(getQuarter('2025-10-01')).toBe(4);
    expect(getQuarter('2025-11-15')).toBe(4);
    expect(getQuarter('2025-12-31')).toBe(4);
  });

  it('defaults to Q1 for empty/invalid input', () => {
    expect(getQuarter('')).toBe(1);
    expect(getQuarter(undefined)).toBe(1);
    expect(getQuarter('not-a-date')).toBe(1);
  });
});

// ── Mid-Quarter Convention: Detection ────────────────────────

describe('detectConvention', () => {
  it('all assets in Q1-Q3 → half-year', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 5000, dateInService: '2025-03-15' }),
      makeAsset({ id: 'a2', cost: 3000, dateInService: '2025-07-01' }),
    ];
    expect(detectConvention(assets)).toBe('half-year');
  });

  it('>40% of basis in Q4 → mid-quarter', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 5000, dateInService: '2025-03-15' }),
      makeAsset({ id: 'a2', cost: 6000, dateInService: '2025-11-01' }),
    ];
    // Q4 = 6000/11000 = 54.5% > 40%
    expect(detectConvention(assets)).toBe('mid-quarter');
  });

  it('exactly 40% in Q4 → half-year (must exceed, not equal)', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 6000, dateInService: '2025-03-15' }),
      makeAsset({ id: 'a2', cost: 4000, dateInService: '2025-11-01' }),
    ];
    // Q4 = 4000/10000 = 40% exactly → half-year
    expect(detectConvention(assets)).toBe('half-year');
  });

  it('single Q4 asset (100% in Q4) → mid-quarter', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 10000, dateInService: '2025-12-01' }),
    ];
    expect(detectConvention(assets)).toBe('mid-quarter');
  });

  it('no current-year assets → half-year (default)', () => {
    expect(detectConvention([])).toBe('half-year');
  });

  it('mixed quarters with Q4 < 40% → half-year', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 7000, dateInService: '2025-03-15' }),
      makeAsset({ id: 'a2', cost: 3000, dateInService: '2025-11-01' }),
    ];
    // Q4 = 3000/10000 = 30% < 40%
    expect(detectConvention(assets)).toBe('half-year');
  });

  it('respects business use percent in basis calculation', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 10000, businessUsePercent: 50, dateInService: '2025-03-15' }),
      // business basis = 5000
      makeAsset({ id: 'a2', cost: 4000, businessUsePercent: 100, dateInService: '2025-11-01' }),
      // business basis = 4000. Q4 = 4000/9000 = 44.4% > 40%
    ];
    expect(detectConvention(assets)).toBe('mid-quarter');
  });
});

// ── Mid-Quarter Convention: Rate Application ─────────────────

describe('Mid-quarter convention — rate application', () => {
  it('single Q4 asset with 5-year property → mid-quarter MACRS rate', () => {
    // All basis in Q4 → mid-quarter. With 100% bonus, MACRS on remaining = $0.
    // But let's test with no section 179 and verify the convention is set.
    const asset = makeAsset({
      cost: 10000,
      dateInService: '2025-12-01',
      propertyClass: 5,
    });
    const result = calculateForm4562([asset], 50000);

    expect(result.convention).toBe('mid-quarter');
    // With 100% bonus in 2025, MACRS is $0 but convention is still detected
    expect(result.bonusDepreciationTotal).toBe(10000);
    expect(result.macrsCurrentYear).toBe(0);
    expect(result.assetDetails[0].convention).toBe('mid-quarter');
  });

  it('convention field is set on each asset detail', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 4000, dateInService: '2025-03-15' }),
      makeAsset({ id: 'a2', cost: 6000, dateInService: '2025-11-01' }),
    ];
    const result = calculateForm4562(assets, 50000);

    expect(result.convention).toBe('mid-quarter');
    for (const detail of result.assetDetails) {
      expect(detail.convention).toBe('mid-quarter');
    }
  });

  it('half-year convention → all details show half-year', () => {
    const asset = makeAsset({ cost: 5000, dateInService: '2025-06-15' });
    const result = calculateForm4562([asset], 50000);

    expect(result.convention).toBe('half-year');
    expect(result.assetDetails[0].convention).toBe('half-year');
  });

  it('prior-year asset with stored mid-quarter convention uses MQ rates', () => {
    // Asset placed in service Q4 2024, stored with mid-quarter convention
    const asset = makeAsset({
      dateInService: '2024-11-15',
      cost: 10000,
      propertyClass: 5,
      convention: 'mid-quarter',
      quarterPlaced: 4,
      priorDepreciation: 500, // Year 0: 10000 * 0.05 = 500
    });
    const result = calculateForm4562([asset], 50000);

    const detail = result.assetDetails[0];
    expect(detail.yearIndex).toBe(1);
    // MQ Q4 5-year rate for year 1 = 0.38
    expect(detail.macrsDepreciation).toBe(3800); // 10000 * 0.38
    expect(detail.convention).toBe('mid-quarter');
  });

  it('prior-year asset without convention field defaults to half-year (backward compat)', () => {
    const asset = makeAsset({
      dateInService: '2024-01-15',
      cost: 10000,
      propertyClass: 5,
      priorDepreciation: 2000,
      // No convention or quarterPlaced fields
    });
    const result = calculateForm4562([asset], 50000);

    const detail = result.assetDetails[0];
    expect(detail.yearIndex).toBe(1);
    // Half-year 5-year rate for year 1 = 0.32
    expect(detail.macrsDepreciation).toBe(3200);
    expect(detail.convention).toBe('half-year');
  });
});

// ── Mid-Quarter Convention: Integration ──────────────────────

describe('Mid-quarter convention — integration', () => {
  it('Section 179 + bonus + mid-quarter MACRS combined', () => {
    // Two assets, one in Q4 → mid-quarter
    const assets = [
      makeAsset({
        id: 'a1',
        cost: 3000,
        dateInService: '2025-03-15',
        section179Election: 1000,
      }),
      makeAsset({
        id: 'a2',
        cost: 8000,
        dateInService: '2025-11-01',
        section179Election: 2000,
      }),
    ];
    // Q4 basis: 8000 / (3000+8000) = 72.7% > 40% → mid-quarter
    const result = calculateForm4562(assets, 50000);

    expect(result.convention).toBe('mid-quarter');
    expect(result.section179Deduction).toBe(3000); // 1000 + 2000
    // Remaining after 179 gets 100% bonus
    expect(result.bonusDepreciationTotal).toBe(8000); // (3000-1000) + (8000-2000)
    expect(result.totalDepreciation).toBe(11000);
  });

  it('mix of half-year prior and mid-quarter current assets', () => {
    const assets = [
      // Prior-year asset (half-year, no convention stored)
      makeAsset({
        id: 'prior1',
        cost: 10000,
        dateInService: '2024-06-15',
        propertyClass: 7,
        priorDepreciation: 1429, // Year 0: 10000 * 0.1429
      }),
      // Current-year asset in Q4 (triggers mid-quarter)
      makeAsset({
        id: 'cur1',
        cost: 5000,
        dateInService: '2025-11-15',
        propertyClass: 5,
      }),
    ];
    const result = calculateForm4562(assets, 50000);

    // Current-year convention = mid-quarter (100% in Q4)
    expect(result.convention).toBe('mid-quarter');

    // Prior-year uses half-year rates (default, no stored convention)
    const priorDetail = result.assetDetails.find(d => d.assetId === 'prior1')!;
    expect(priorDetail.yearIndex).toBe(1);
    expect(priorDetail.macrsDepreciation).toBe(2449); // 10000 * 0.2449 (half-year yr 1)
    expect(priorDetail.convention).toBe('half-year');

    // Current-year gets 100% bonus
    const curDetail = result.assetDetails.find(d => d.assetId === 'cur1')!;
    expect(curDetail.bonusDepreciation).toBe(5000);
    expect(curDetail.convention).toBe('mid-quarter');
  });
});

// ── Mid-Quarter Rate Table Integrity ─────────────────────────

// ── Section 179 Exclusion from Convention Detection ──────────

describe('Convention detection — Section 179 exclusion (Treas. Reg. §1.168(d)-1(b)(4)(ii))', () => {
  it('Section 179 on Q1 asset shifts convention from half-year to mid-quarter', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 100000, dateInService: '2025-01-15', section179Election: 100000 }),
      makeAsset({ id: 'a2', cost: 10000, dateInService: '2025-11-01' }),
    ];
    // Without §179 exclusion: Q4 = 10k/110k = 9.1% → half-year
    // With §179 exclusion: Q4 = 10k/10k = 100% → mid-quarter
    const result = calculateForm4562(assets, 200000);
    expect(result.convention).toBe('mid-quarter');
  });

  it('Section 179 on Q4 asset shifts convention from mid-quarter to half-year', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 40000, dateInService: '2025-03-15' }),
      makeAsset({ id: 'a2', cost: 60000, dateInService: '2025-11-01', section179Election: 60000 }),
    ];
    // Without §179 exclusion: Q4 = 60k/100k = 60% → mid-quarter
    // With §179 exclusion: Q4 = 0/40k = 0% → half-year
    const result = calculateForm4562(assets, 200000);
    expect(result.convention).toBe('half-year');
  });

  it('detectConvention with explicit section179Allocations map', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 50000, dateInService: '2025-02-01' }),
      makeAsset({ id: 'a2', cost: 30000, dateInService: '2025-11-15' }),
    ];
    // Without §179: Q4 = 30k/80k = 37.5% → half-year
    // With §179 removing $25k from a1: Q4 = 30k/55k = 54.5% → mid-quarter
    const sec179Map = new Map([['a1', 25000]]);
    expect(detectConvention(assets, sec179Map)).toBe('mid-quarter');
  });

  it('detectConvention without section179Allocations uses gross basis (backward compat)', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 50000, dateInService: '2025-02-01' }),
      makeAsset({ id: 'a2', cost: 30000, dateInService: '2025-11-15' }),
    ];
    // Without §179 map: Q4 = 30k/80k = 37.5% → half-year
    expect(detectConvention(assets)).toBe('half-year');
  });

  it('all basis eliminated by Section 179 → default to half-year', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 50000, dateInService: '2025-11-01', section179Election: 50000 }),
    ];
    // All basis in Q4 but fully covered by §179 → totalBasis = 0 → half-year
    const result = calculateForm4562(assets, 200000);
    expect(result.convention).toBe('half-year');
  });
});

// ── >50% Business Use Eligibility ────────────────────────────

describe('>50% business use eligibility (IRC §179(d)(10) / §280F)', () => {
  it('51% business use → Section 179 and bonus eligible', () => {
    const asset = makeAsset({ cost: 10000, businessUsePercent: 51, section179Election: 10000 });
    const result = calculateForm4562([asset], 50000);

    // 51% > 50%: both Section 179 and bonus eligible
    const businessBasis = 5100; // 10000 * 0.51
    expect(result.section179Deduction).toBe(businessBasis);
    expect(result.totalDepreciation).toBe(businessBasis);
  });

  it('49% business use → Section 179 and bonus ineligible', () => {
    const asset = makeAsset({ cost: 10000, businessUsePercent: 49, section179Election: 10000 });
    const result = calculateForm4562([asset], 50000);

    // 49% ≤ 50%: Section 179 ineligible
    expect(result.section179Deduction).toBe(0);
    // 49% ≤ 50%: bonus ineligible
    expect(result.bonusDepreciationTotal).toBe(0);
    // MACRS only: $4,900 × 0.20 (5-year half-year year 0) = $980
    expect(result.macrsCurrentYear).toBe(980);
  });

  it('mixed assets: only >50% assets get Section 179', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 5000, businessUsePercent: 100, section179Election: 5000 }),
      makeAsset({ id: 'a2', cost: 5000, businessUsePercent: 40, section179Election: 5000 }),
    ];
    const result = calculateForm4562(assets, 50000);

    // Only a1 qualifies for §179
    expect(result.section179Deduction).toBe(5000);

    const a1 = result.assetDetails.find(d => d.assetId === 'a1')!;
    expect(a1.section179Amount).toBe(5000);

    const a2 = result.assetDetails.find(d => d.assetId === 'a2')!;
    expect(a2.section179Amount).toBe(0);
    expect(a2.bonusDepreciation).toBe(0);
    // a2 gets MACRS only: $2000 * 0.20 = $400
    expect(a2.macrsDepreciation).toBe(400);
  });
});

// ── Prior-Year quarterPlaced Fallback ────────────────────────

describe('Prior-year mid-quarter — quarterPlaced fallback', () => {
  it('derives quarter from dateInService when quarterPlaced is missing', () => {
    const asset = makeAsset({
      dateInService: '2024-11-15',
      cost: 10000,
      propertyClass: 5,
      convention: 'mid-quarter',
      // quarterPlaced intentionally omitted
      priorDepreciation: 500, // Year 0: 10000 * 0.05 = 500 (Q4 5-year MQ rate)
    });
    const result = calculateForm4562([asset], 50000);

    const detail = result.assetDetails[0];
    expect(detail.yearIndex).toBe(1);
    // Should derive Q4 from dateInService and use MQ Q4 5-year year 1 rate = 0.38
    expect(detail.macrsDepreciation).toBe(3800);
    expect(detail.convention).toBe('mid-quarter');
  });

  it('prefers explicit quarterPlaced over dateInService derivation', () => {
    const asset = makeAsset({
      dateInService: '2024-11-15', // Would derive Q4
      cost: 10000,
      propertyClass: 5,
      convention: 'mid-quarter',
      quarterPlaced: 3, // Explicitly Q3 (overrides date derivation)
      priorDepreciation: 1500, // Year 0: 10000 * 0.15 = 1500 (Q3 5-year MQ rate)
    });
    const result = calculateForm4562([asset], 50000);

    const detail = result.assetDetails[0];
    // Should use explicit Q3, not derived Q4
    // MQ Q3 5-year year 1 rate = 0.34
    expect(detail.macrsDepreciation).toBe(3400);
  });
});

describe('MACRS mid-quarter rate table integrity', () => {
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  for (const [years, quarterRates] of Object.entries(MACRS_GDS_RATES_MID_QUARTER)) {
    it(`${years}-year property has 4 quarter entries`, () => {
      expect((quarterRates as readonly (readonly number[])[]).length).toBe(4);
    });

    for (let q = 0; q < 4; q++) {
      const rates = (quarterRates as readonly (readonly number[])[])[q];

      it(`${years}-year ${quarters[q]} rates sum to approximately 1.0`, () => {
        const sum = rates.reduce((s: number, r: number) => s + r, 0);
        expect(sum).toBeCloseTo(1.0, 3);
      });

      it(`${years}-year ${quarters[q]} rates have ${Number(years) + 1} entries`, () => {
        expect(rates.length).toBe(Number(years) + 1);
      });
    }
  }
});

// ── §179 Double-Dip Prevention (Treas. Reg. §1.179-1(f)(2)) ─

describe('§179 basis reduction uses elected amount, not allowed (Treas. Reg. §1.179-1(f)(2))', () => {
  it('income-limited §179: no bonus on elected basis', () => {
    // $10k asset, $10k election, $3k income
    // Allowed = $3k, Elected = $10k, Carryforward = $7k
    // Basis reduced by elected ($10k) → $0 for bonus
    const asset = makeAsset({ cost: 10000, section179Election: 10000 });
    const result = calculateForm4562([asset], 3000);

    expect(result.section179Deduction).toBe(3000);
    expect(result.section179Carryforward).toBe(7000);
    expect(result.bonusDepreciationTotal).toBe(0); // NOT $7k
    expect(result.totalDepreciation).toBe(3000); // NOT $10k

    // Total lifetime benefit = $3k now + $7k carryforward = $10k (correct)
    expect(result.section179Deduction + result.section179Carryforward).toBe(10000);
  });

  it('partial §179 election with income limit: bonus on un-elected basis only', () => {
    // $20k asset, $8k election, $5k income
    // Allowed = $5k, Elected = $8k, Carryforward = $3k
    // Basis reduced by elected ($8k) → $12k for bonus
    const asset = makeAsset({ cost: 20000, section179Election: 8000 });
    const result = calculateForm4562([asset], 5000);

    expect(result.section179Deduction).toBe(5000);
    expect(result.section179Carryforward).toBe(3000);
    expect(result.bonusDepreciationTotal).toBe(12000); // 20000 - 8000 = 12000
    expect(result.totalDepreciation).toBe(17000); // 5000 + 12000
  });

  it('proportional allocation with income limit: two assets', () => {
    // Asset A: $6000, elect $6000; Asset B: $4000, elect $4000
    // Total elected = $10k, capped at $10k. Income = $6k.
    // allowedScale = 6000/10000 = 0.6, electedScale = 10000/10000 = 1.0
    // Asset A: allowed = 3600, elected = 6000
    // Asset B: allowed = 2400, elected = 4000
    const assets = [
      makeAsset({ id: 'a1', cost: 6000, section179Election: 6000 }),
      makeAsset({ id: 'a2', cost: 4000, section179Election: 4000 }),
    ];
    const result = calculateForm4562(assets, 6000);

    expect(result.section179Deduction).toBe(6000);
    expect(result.section179Carryforward).toBe(4000);

    const a1 = result.assetDetails.find(d => d.assetId === 'a1')!;
    const a2 = result.assetDetails.find(d => d.assetId === 'a2')!;

    // Display amounts (allowed)
    expect(a1.section179Amount).toBe(3600);
    expect(a2.section179Amount).toBe(2400);

    // Bonus = 0 for both (basis fully reduced by elected amounts)
    expect(a1.bonusDepreciation).toBe(0);
    expect(a2.bonusDepreciation).toBe(0);

    // Remaining basis = 0 (elected covers full cost)
    expect(a1.depreciableRemaining).toBe(0);
    expect(a2.depreciableRemaining).toBe(0);
  });
});

// ── Future-Year Asset Guard ──────────────────────────────────

describe('Future-year asset guard', () => {
  it('asset placed in service after tax year → no depreciation', () => {
    const asset = makeAsset({
      dateInService: '2026-03-15',
      cost: 10000,
      section179Election: 10000,
    });
    const result = calculateForm4562([asset], 50000);

    expect(result.totalDepreciation).toBe(0);
    expect(result.section179Deduction).toBe(0);
    expect(result.bonusDepreciationTotal).toBe(0);
    expect(result.assetDetails).toHaveLength(0);
  });

  it('future-year asset mixed with current-year asset', () => {
    const assets = [
      makeAsset({ id: 'cur', cost: 5000, dateInService: '2025-06-15' }),
      makeAsset({ id: 'future', cost: 10000, dateInService: '2026-01-01' }),
    ];
    const result = calculateForm4562(assets, 50000);

    // Only the current-year asset generates depreciation
    expect(result.assetDetails).toHaveLength(1);
    expect(result.assetDetails[0].assetId).toBe('cur');
    expect(result.bonusDepreciationTotal).toBe(5000);
    expect(result.totalDepreciation).toBe(5000);
  });
});

// ── Phantom Carryforward Advisory Warning ────────────────────

describe('Phantom carryforward advisory warning', () => {
  it('warns when §179 carryforward exists with 100% bonus available', () => {
    const asset = makeAsset({ cost: 10000, section179Election: 10000 });
    const result = calculateForm4562([asset], 3000);

    expect(result.section179Carryforward).toBe(7000);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some(w => w.includes('Advisory'))).toBe(true);
    expect(result.warnings!.some(w => w.includes('bonus depreciation'))).toBe(true);
  });

  it('no advisory when no carryforward', () => {
    const asset = makeAsset({ cost: 5000, section179Election: 5000 });
    const result = calculateForm4562([asset], 50000);

    // No carryforward → no advisory
    const advisory = result.warnings?.filter(w => w.includes('Advisory'));
    expect(advisory?.length ?? 0).toBe(0);
  });
});

// ── Mid-Quarter MACRS with ≤50% Business Use (no bonus) ──────

describe('Mid-quarter MACRS rate path — no bonus (≤50% business use)', () => {
  it('Q4 asset with 50% business use → MQ MACRS only (no bonus, no §179)', () => {
    // Single Q4 asset → mid-quarter. 50% business use → no bonus, no §179.
    const asset = makeAsset({
      cost: 10000,
      dateInService: '2025-12-01',
      propertyClass: 5,
      businessUsePercent: 50,
    });
    const result = calculateForm4562([asset], 50000);

    expect(result.convention).toBe('mid-quarter');
    expect(result.section179Deduction).toBe(0);
    expect(result.bonusDepreciationTotal).toBe(0);
    // Business basis = $5000, MQ Q4 5-year year 0 rate = 0.05
    expect(result.macrsCurrentYear).toBe(250); // 5000 * 0.05
    expect(result.totalDepreciation).toBe(250);

    const detail = result.assetDetails[0];
    expect(detail.convention).toBe('mid-quarter');
    expect(detail.macrsDepreciation).toBe(250);
  });

  it('Q1 asset with 40% business use → HY MACRS only', () => {
    const asset = makeAsset({
      cost: 10000,
      dateInService: '2025-02-01',
      propertyClass: 7,
      businessUsePercent: 40,
    });
    const result = calculateForm4562([asset], 50000);

    expect(result.convention).toBe('half-year');
    expect(result.section179Deduction).toBe(0);
    expect(result.bonusDepreciationTotal).toBe(0);
    // Business basis = $4000, HY 7-year year 0 rate = 0.1429
    expect(result.macrsCurrentYear).toBe(571.6); // 4000 * 0.1429
  });
});

// ── §179 Election Capped at Business-Use Basis ──────────────

describe('§179 election capped at business-use basis', () => {
  it('election exceeding business basis is capped', () => {
    // $10k asset, 60% business use → $6k basis. $10k election → capped at $6k.
    const asset = makeAsset({ cost: 10000, businessUsePercent: 60, section179Election: 10000 });
    const result = calculateForm4562([asset], 50000);

    // §179 capped at $6,000 (business basis); covers full basis so bonus = $0
    expect(result.section179Deduction).toBe(6000);
    expect(result.bonusDepreciationTotal).toBe(0);
    expect(result.totalDepreciation).toBe(6000);

    const detail = result.assetDetails[0];
    expect(detail.businessUseBasis).toBe(6000);
    expect(detail.section179Amount).toBe(6000);
    expect(detail.depreciableRemaining).toBe(0);
  });

  it('partial election under business basis → remainder to bonus', () => {
    // $10k asset, 80% use → $8k basis. $5k election → $5k §179, $3k bonus.
    const asset = makeAsset({ cost: 10000, businessUsePercent: 80, section179Election: 5000 });
    const result = calculateForm4562([asset], 50000);

    expect(result.section179Deduction).toBe(5000);
    expect(result.bonusDepreciationTotal).toBe(3000);
    expect(result.totalDepreciation).toBe(8000);
  });
});

// ── Boundary Date: Last Day of Tax Year ──────────────────────

describe('Boundary date — last day of tax year', () => {
  it('dateInService = 2025-12-31 → current year (yearIndex 0)', () => {
    const asset = makeAsset({ cost: 5000, dateInService: '2025-12-31' });
    const result = calculateForm4562([asset], 50000);

    expect(result.assetDetails).toHaveLength(1);
    expect(result.assetDetails[0].yearIndex).toBe(0);
    expect(result.bonusDepreciationTotal).toBe(5000);
  });

  it('dateInService = 2026-01-01 → future year (skipped)', () => {
    const asset = makeAsset({ cost: 5000, dateInService: '2026-01-01' });
    const result = calculateForm4562([asset], 50000);

    expect(result.assetDetails).toHaveLength(0);
    expect(result.totalDepreciation).toBe(0);
  });
});

// ── §179 Rounding Plug (3+ Asset Proportional Allocation) ────

describe('§179 rounding plug — multi-asset proportional allocation', () => {
  it('3 assets with equal elections: sum of allocations equals aggregate deduction', () => {
    // 3 assets each electing $3,333. Total = $9,999. Income = $7,000.
    // allowedScale = 7000/9999 = 0.70007... → rounding could cause ±$0.01.
    const assets = [
      makeAsset({ id: 'a1', cost: 3333, section179Election: 3333 }),
      makeAsset({ id: 'a2', cost: 3333, section179Election: 3333 }),
      makeAsset({ id: 'a3', cost: 3333, section179Election: 3333 }),
    ];
    const result = calculateForm4562(assets, 7000);

    expect(result.section179Deduction).toBe(7000);

    // Sum of per-asset §179 allocations must equal aggregate deduction exactly
    const allocationSum = result.assetDetails.reduce((s, d) => s + d.section179Amount, 0);
    expect(allocationSum).toBe(7000);
  });

  it('4 assets with unequal elections: sum matches aggregate', () => {
    const assets = [
      makeAsset({ id: 'a1', cost: 1111, section179Election: 1111 }),
      makeAsset({ id: 'a2', cost: 2222, section179Election: 2222 }),
      makeAsset({ id: 'a3', cost: 3333, section179Election: 3333 }),
      makeAsset({ id: 'a4', cost: 4444, section179Election: 4444 }),
    ];
    // Total elected = 11,110. Income = 8,000.
    const result = calculateForm4562(assets, 8000);

    expect(result.section179Deduction).toBe(8000);
    expect(result.section179Carryforward).toBe(3110);

    const allocationSum = result.assetDetails.reduce((s, d) => s + d.section179Amount, 0);
    expect(allocationSum).toBe(8000);

    // Verify no bonus on elected basis (elected = full cost for all)
    expect(result.bonusDepreciationTotal).toBe(0);
  });
});
