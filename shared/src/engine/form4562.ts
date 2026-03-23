import {
  DepreciationAsset,
  Form4562Result,
  Form4562AssetDetail,
  MACRSPropertyClass,
} from '../types/index.js';
import {
  SECTION_179,
  MACRS_GDS_RATES,
  MACRS_GDS_RATES_MID_QUARTER,
  BONUS_DEPRECIATION_RATE_2025,
  DEPRECIATION_TAX_YEAR,
} from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Form 4562 — Depreciation and Amortization (Parts I–IV).
 *
 * Computes Section 179 immediate expensing, bonus depreciation, and MACRS
 * regular depreciation for a registry of business assets. Returns per-asset
 * detail and aggregate totals that flow to Schedule C Line 13.
 *
 * Software assets (isSoftware: true) use 36-month straight-line amortization
 * per IRC §167(f)(1) instead of MACRS, and are reported on Form 4562 Line 16.
 *
 * @param assets        Array of depreciable business assets
 * @param businessIncome Tentative profit from the business (Section 179 income limit)
 * @returns Form4562Result with per-asset breakdowns and aggregate totals
 *
 * @authority
 *   IRC: Section 179 — Election to expense certain depreciable business assets
 *   IRC: Section 168 — Accelerated cost recovery system (MACRS)
 *   IRC: Section 168(k) — Special depreciation allowance (bonus depreciation)
 *   IRC: Section 167(f)(1) — Computer software (36-month straight-line)
 *   Form: Form 4562 — Depreciation and Amortization
 *   Pub: Publication 946 — How to Depreciate Property
 * @scope GDS half-year and mid-quarter conventions. Software amortization. No ADS.
 */
export function calculateForm4562(
  assets: DepreciationAsset[],
  businessIncome: number,
): Form4562Result {
  const zero: Form4562Result = {
    totalCostSection179Property: 0,
    section179Limit: SECTION_179.MAX_DEDUCTION,
    section179ThresholdReduction: 0,
    section179MaxAfterReduction: SECTION_179.MAX_DEDUCTION,
    section179Elected: 0,
    section179BusinessIncomeLimit: Math.max(0, businessIncome),
    section179Deduction: 0,
    section179Carryforward: 0,
    bonusDepreciationTotal: 0,
    macrsCurrentYear: 0,
    macrsPriorYears: 0,
    totalDepreciation: 0,
    convention: 'half-year',
    assetDetails: [],
  };

  // Filter out disposed assets — they don't generate depreciation
  const activeAssets = (assets || []).filter(a => !a.disposed);
  if (activeAssets.length === 0) return zero;

  // ── Classify assets by placement year ─────────────────────
  const currentYearAssets: DepreciationAsset[] = [];
  const priorYearAssets: DepreciationAsset[] = [];

  for (const asset of activeAssets) {
    const yearIndex = getYearIndex(asset.dateInService);
    if (yearIndex < 0) continue; // Future-year asset — not yet depreciable
    if (yearIndex === 0) {
      currentYearAssets.push(asset);
    } else {
      priorYearAssets.push(asset);
    }
  }

  // ── Part I: Section 179 Election (Lines 1-13) ────────────
  // Must compute before convention detection so §179 reduces the 40% test basis.
  const section179Result = computeSection179(
    currentYearAssets,
    Math.max(0, businessIncome),
  );

  // ── Convention detection (IRC §168(d)(3)) ────────────────
  // Uses post-§179 basis for the 40% test per Treas. Reg. §1.168(d)-1(b)(4)(ii).
  // Assumption: Form 1040 filers are calendar-year taxpayers; "last 3 months" = Oct–Dec.
  const convention = detectConvention(currentYearAssets, section179Result.electedAllocations);

  // ── Compute per-asset depreciation ────────────────────────
  const assetDetails: Form4562AssetDetail[] = [];
  let bonusTotal = 0;
  let macrsCurrentTotal = 0;
  let macrsPriorTotal = 0;

  // Current-year assets: Section 179 → Bonus → MACRS
  for (const asset of currentYearAssets) {
    const detail = computeCurrentYearAsset(
      asset,
      section179Result.allocations,
      section179Result.electedAllocations,
      convention,
    );
    assetDetails.push(detail);
    bonusTotal += detail.bonusDepreciation;
    macrsCurrentTotal += detail.macrsDepreciation;
  }

  // Prior-year assets: MACRS only (no 179, no bonus)
  for (const asset of priorYearAssets) {
    const detail = computePriorYearAsset(asset);
    assetDetails.push(detail);
    macrsPriorTotal += detail.macrsDepreciation;
  }

  bonusTotal = round2(bonusTotal);
  macrsCurrentTotal = round2(macrsCurrentTotal);
  macrsPriorTotal = round2(macrsPriorTotal);

  // ── Part IV: Summary ──────────────────────────────────────
  const totalDepreciation = round2(
    section179Result.deduction + bonusTotal + macrsCurrentTotal + macrsPriorTotal,
  );

  // ── Warnings ──────────────────────────────────────────────
  const warnings: string[] = [];
  if (section179Result.carryforward > 0) {
    warnings.push(
      `Section 179 carryforward of $${section179Result.carryforward.toLocaleString()} — ` +
      'deduction limited by business income (IRC §179(b)(3))',
    );
    // Advisory: with 100% bonus, skipping §179 may yield a larger current-year deduction
    if (BONUS_DEPRECIATION_RATE_2025 >= 1.0) {
      warnings.push(
        `Advisory: With 100% bonus depreciation available in ${DEPRECIATION_TAX_YEAR}, ` +
        'the Section 179 election created a carryforward instead of an immediate deduction. ' +
        'Consider reducing the Section 179 election — bonus depreciation is not income-limited ' +
        'and may provide a larger current-year deduction.',
      );
    }
  }
  for (const asset of activeAssets) {
    if (asset.businessUsePercent < 100 && asset.businessUsePercent > 0) {
      warnings.push(
        `"${asset.description}" has ${asset.businessUsePercent}% business use — ` +
        'only the business portion is depreciable',
      );
    }
  }

  return {
    totalCostSection179Property: section179Result.totalCost,
    section179Limit: SECTION_179.MAX_DEDUCTION,
    section179ThresholdReduction: section179Result.thresholdReduction,
    section179MaxAfterReduction: section179Result.maxAfterReduction,
    section179Elected: section179Result.elected,
    section179BusinessIncomeLimit: Math.max(0, businessIncome),
    section179Deduction: section179Result.deduction,
    section179Carryforward: section179Result.carryforward,
    bonusDepreciationTotal: bonusTotal,
    macrsCurrentYear: macrsCurrentTotal,
    macrsPriorYears: macrsPriorTotal,
    totalDepreciation,
    convention,
    assetDetails,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// ── IRC §167(f)(1) Software Amortization ────────────────────
// Off-the-shelf computer software is amortized ratably over 36 months beginning
// with the month it's placed in service. This is NOT MACRS — it uses straight-line
// monthly amortization with no half-year or mid-quarter convention.
// Reported on Form 4562 Line 16 ("Other depreciation").

const SOFTWARE_AMORTIZATION_MONTHS = 36;

/**
 * Compute 36-month straight-line amortization for software per IRC §167(f)(1).
 * @param cost           Original cost of the software
 * @param dateInService  Date placed in service (YYYY-MM-DD)
 * @param priorDepreciation Accumulated depreciation from prior years
 * @returns Current year amortization amount
 */
function computeSoftwareAmortization(
  cost: number,
  dateInService: string,
  priorDepreciation: number,
): number {
  const monthlyAmount = round2(cost / SOFTWARE_AMORTIZATION_MONTHS);
  const startDate = new Date(dateInService + 'T00:00:00');
  if (isNaN(startDate.getTime())) return 0;

  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth(); // 0-11

  // Calculate months of service during the tax year (DEPRECIATION_TAX_YEAR)
  // Amortization begins the month the software is placed in service
  const taxYearStart = new Date(DEPRECIATION_TAX_YEAR, 0, 1);
  const taxYearEnd = new Date(DEPRECIATION_TAX_YEAR, 11, 31);
  const amortStart = startDate < taxYearStart ? taxYearStart : startDate;

  // End of 36-month period
  const amortEndMonth = startMonth + SOFTWARE_AMORTIZATION_MONTHS;
  const amortEndYear = startYear + Math.floor(amortEndMonth / 12);
  const amortEndMo = amortEndMonth % 12;
  const amortEnd = new Date(amortEndYear, amortEndMo, 0); // Last day of the month before

  if (amortStart > taxYearEnd || amortEnd < taxYearStart) return 0;

  // Count full months in the tax year
  const firstMonth = amortStart <= taxYearStart ? 0 : amortStart.getMonth();
  const lastMonth = amortEnd >= taxYearEnd ? 11 : amortEnd.getMonth();
  const monthsInYear = lastMonth - firstMonth + 1;

  const yearAmortization = round2(monthlyAmount * Math.max(0, monthsInYear));

  // Don't exceed remaining basis
  const remaining = round2(Math.max(0, cost - priorDepreciation));
  return round2(Math.min(yearAmortization, remaining));
}

// ── Section 179 Computation ─────────────────────────────────

interface Section179Result {
  totalCost: number;
  thresholdReduction: number;
  maxAfterReduction: number;
  elected: number;
  deduction: number;
  carryforward: number;
  /** Per-asset Section 179 allowed allocation (after income limit) — for basis reduction */
  allocations: Map<string, number>;
  /** Per-asset Section 179 elected allocation (after cap, before income limit) — for convention test */
  electedAllocations: Map<string, number>;
}

/**
 * Compute Section 179 deduction (Form 4562 Part I, Lines 1-13).
 *
 * Key rules:
 *   - Maximum deduction: $1,250,000 (2025)
 *   - Phaseout: dollar-for-dollar reduction when total cost > $3,130,000
 *   - Limited to aggregate taxable income from active businesses
 *   - Only current-year assets qualify (placed in service during tax year)
 *   - Election is per-asset — taxpayer chooses how much to expense per asset
 */
function computeSection179(
  currentYearAssets: DepreciationAsset[],
  businessIncome: number,
): Section179Result {
  const allocations = new Map<string, number>();
  const electedAllocations = new Map<string, number>();

  // Section 179 requires > 50% business use per IRC §179(d)(10)
  const eligible = currentYearAssets.filter(a => (a.businessUsePercent ?? 100) > 50);

  // Total cost of all Section 179-eligible property placed in service
  const totalCost = round2(
    eligible.reduce((sum, a) => {
      const basisPct = Math.min(100, Math.max(0, a.businessUsePercent ?? 100)) / 100;
      return sum + round2(a.cost * basisPct);
    }, 0),
  );

  // Sum of all Section 179 elections (each capped at the asset's business-use basis)
  let totalElected = round2(
    eligible.reduce((sum, a) => {
      const elected = Math.max(0, a.section179Election || 0);
      if (elected <= 0) return sum;
      const basisPct = Math.min(100, Math.max(0, a.businessUsePercent ?? 100)) / 100;
      const maxForAsset = round2(a.cost * basisPct);
      return sum + Math.min(elected, maxForAsset);
    }, 0),
  );

  if (totalElected <= 0) {
    return {
      totalCost,
      thresholdReduction: 0,
      maxAfterReduction: SECTION_179.MAX_DEDUCTION,
      elected: 0,
      deduction: 0,
      carryforward: 0,
      allocations,
      electedAllocations,
    };
  }

  // Line 1: Maximum deduction
  const maxDeduction = SECTION_179.MAX_DEDUCTION;

  // Line 3: Threshold reduction (dollar-for-dollar above $3,130,000)
  const thresholdReduction = round2(Math.max(0, totalCost - SECTION_179.PHASE_OUT_THRESHOLD));

  // Line 4: Adjusted maximum
  const maxAfterReduction = round2(Math.max(0, maxDeduction - thresholdReduction));

  // Line 5-6: Can't elect more than the adjusted maximum
  const electedCapped = round2(Math.min(totalElected, maxAfterReduction));

  // Line 11: Business income limitation
  const incomeLimit = round2(Math.max(0, businessIncome));

  // Line 12: Actual deduction = lesser of elected (after phaseout) and income limit
  const deduction = round2(Math.min(electedCapped, incomeLimit));

  // Line 13: Carryforward = elected that couldn't be deducted due to income limit
  const carryforward = round2(Math.max(0, electedCapped - deduction));

  // Two scale factors: elected (after cap) and allowed (after income limit)
  const allowedScale = totalElected > 0 ? deduction / totalElected : 0;
  const electedScale = totalElected > 0 ? electedCapped / totalElected : 0;

  // Filter to assets that actually have elections, then allocate proportionally.
  // The last electing asset absorbs any ±$0.01 rounding remainder so that
  // sum(allocations) === deduction and sum(electedAllocations) === electedCapped.
  const electingAssets = eligible.filter(a => Math.max(0, a.section179Election || 0) > 0);
  let allocatedSum = 0;
  let electedAllocatedSum = 0;

  for (let i = 0; i < electingAssets.length; i++) {
    const asset = electingAssets[i];
    const elected = Math.max(0, asset.section179Election || 0);
    const basisPct = Math.min(100, Math.max(0, asset.businessUsePercent ?? 100)) / 100;
    const maxForAsset = round2(asset.cost * basisPct);
    const validElected = Math.min(elected, maxForAsset);

    if (i === electingAssets.length - 1) {
      // Last asset: plug the remainder to ensure exact aggregate match
      allocations.set(asset.id, round2(Math.min(Math.max(0, deduction - allocatedSum), maxForAsset)));
      electedAllocations.set(asset.id, round2(Math.min(Math.max(0, electedCapped - electedAllocatedSum), maxForAsset)));
    } else {
      const alloc = round2(Math.min(validElected * allowedScale, maxForAsset));
      const electedAlloc = round2(Math.min(validElected * electedScale, maxForAsset));
      allocations.set(asset.id, alloc);
      electedAllocations.set(asset.id, electedAlloc);
      allocatedSum += alloc;
      electedAllocatedSum += electedAlloc;
    }
  }

  return {
    totalCost,
    thresholdReduction,
    maxAfterReduction,
    elected: totalElected,
    deduction,
    carryforward,
    allocations,
    electedAllocations,
  };
}

// ── Current-Year Asset Depreciation ─────────────────────────

/**
 * Compute depreciation for an asset placed in service during the current tax year.
 *
 * Depreciation stack: Section 179 → Bonus → MACRS (year 0 rate).
 * With 100% bonus in 2025, MACRS is typically $0 for current-year assets.
 */
function computeCurrentYearAsset(
  asset: DepreciationAsset,
  section179AllowedAllocations: Map<string, number>,
  section179ElectedAllocations: Map<string, number>,
  convention: 'half-year' | 'mid-quarter',
): Form4562AssetDetail {
  const basisPct = Math.min(100, Math.max(0, asset.businessUsePercent ?? 100)) / 100;
  const businessUseBasis = round2(asset.cost * basisPct);

  // ── IRC §167(f)(1): Software uses 36-month SL amortization ──
  // No Section 179, no bonus — ratably over 36 months from month placed in service.
  // Reported on Form 4562 Line 16 ("Other depreciation").
  if (asset.isSoftware) {
    const amortization = computeSoftwareAmortization(
      businessUseBasis,
      asset.dateInService,
      0, // No prior depreciation for current-year asset
    );
    return {
      assetId: asset.id,
      description: asset.description || '',
      cost: asset.cost,
      businessUseBasis,
      section179Amount: 0,
      bonusDepreciation: 0,
      macrsDepreciation: amortization, // Reported as "other depreciation" in the total
      totalDepreciation: amortization,
      depreciableRemaining: round2(Math.max(0, businessUseBasis - amortization)),
      propertyClass: asset.propertyClass,
      yearIndex: 0,
      convention: 'half-year', // Not applicable for software, but field is required
    };
  }

  // Display amount = what's actually deducted this year (after income limit)
  const section179Amount = round2(section179AllowedAllocations.get(asset.id) || 0);

  // Basis reduction = full ELECTED amount per Treas. Reg. §1.179-1(f)(2).
  // Even if income-limited, the elected amount reduces depreciable basis.
  // The difference (elected - allowed) becomes carryforward, not bonus-eligible basis.
  const section179BasisReduction = round2(section179ElectedAllocations.get(asset.id) || 0);

  // Remaining basis after Section 179 (uses elected for basis reduction)
  const afterSection179 = round2(Math.max(0, businessUseBasis - section179BasisReduction));

  // Bonus depreciation: 100% of remaining basis (Part II, Line 14)
  // Requires > 50% business use for listed property (IRC §168(k)(2)(D)(i) / §280F).
  // Applied to all assets as a conservative default since we don't track listed vs non-listed.
  const bonusEligible = (asset.businessUsePercent ?? 100) > 50;
  const bonusDepreciation = bonusEligible
    ? round2(afterSection179 * BONUS_DEPRECIATION_RATE_2025)
    : 0;

  // MACRS on remaining basis after 179 + bonus
  const afterBonus = round2(Math.max(0, afterSection179 - bonusDepreciation));

  let macrsRate = 0;
  if (convention === 'mid-quarter') {
    const quarter = getQuarter(asset.dateInService);
    const mqRates = MACRS_GDS_RATES_MID_QUARTER[asset.propertyClass];
    if (mqRates && mqRates[quarter - 1]) {
      macrsRate = mqRates[quarter - 1][0];
    }
  } else {
    const rates = MACRS_GDS_RATES[asset.propertyClass];
    macrsRate = rates && rates.length > 0 ? rates[0] : 0;
  }
  const macrsDepreciation = round2(afterBonus * macrsRate);

  const totalDepreciation = round2(section179Amount + bonusDepreciation + macrsDepreciation);
  // Remaining depreciable basis accounts for elected §179 (not just allowed),
  // since the full elected amount reduces basis even when income-limited.
  const depreciableRemaining = round2(
    Math.max(0, businessUseBasis - section179BasisReduction - bonusDepreciation - macrsDepreciation),
  );

  return {
    assetId: asset.id,
    description: asset.description || '',
    cost: asset.cost,
    businessUseBasis,
    section179Amount,
    bonusDepreciation,
    macrsDepreciation,
    totalDepreciation,
    depreciableRemaining,
    propertyClass: asset.propertyClass,
    yearIndex: 0,
    convention,
  };
}

// ── Prior-Year Asset Depreciation ───────────────────────────

/**
 * Compute MACRS depreciation for an asset placed in service in a prior year.
 *
 * No Section 179 or bonus — those only apply in the year placed in service.
 * Uses the MACRS rate for the asset's year index in the recovery schedule.
 * If the asset was placed in service under mid-quarter convention (stored in
 * asset.convention/asset.quarterPlaced), continues using mid-quarter rates.
 */
function computePriorYearAsset(asset: DepreciationAsset): Form4562AssetDetail {
  const basisPct = Math.min(100, Math.max(0, asset.businessUsePercent ?? 100)) / 100;
  const businessUseBasis = round2(asset.cost * basisPct);

  // ── IRC §167(f)(1): Software uses 36-month SL amortization ──
  if (asset.isSoftware) {
    const priorDepr = asset.priorDepreciation || 0;
    const amortization = computeSoftwareAmortization(
      businessUseBasis,
      asset.dateInService,
      priorDepr,
    );
    return {
      assetId: asset.id,
      description: asset.description || '',
      cost: asset.cost,
      businessUseBasis,
      section179Amount: 0,
      bonusDepreciation: 0,
      macrsDepreciation: amortization,
      totalDepreciation: amortization,
      depreciableRemaining: round2(Math.max(0, businessUseBasis - priorDepr - amortization)),
      propertyClass: asset.propertyClass,
      yearIndex: getYearIndex(asset.dateInService),
      convention: 'half-year', // Not applicable for software
    };
  }

  // Reduce basis by prior Section 179 (claimed in the year placed in service)
  const basisAfterPrior179 = round2(
    Math.max(0, businessUseBasis - (asset.priorSection179 || 0)),
  );

  const yearIndex = getYearIndex(asset.dateInService);

  // Determine which rate table to use based on stored convention
  const assetConvention = asset.convention || 'half-year';
  let rates: readonly number[] | undefined;

  if (assetConvention === 'mid-quarter') {
    // Derive quarter from stored field or fall back to dateInService
    // (prevents data corruption when convention is stored but quarterPlaced is missing)
    const quarter = asset.quarterPlaced || getQuarter(asset.dateInService);
    const mqRates = MACRS_GDS_RATES_MID_QUARTER[asset.propertyClass];
    rates = mqRates?.[quarter - 1];
  } else {
    rates = MACRS_GDS_RATES[asset.propertyClass];
  }

  // If year index exceeds the rate table, asset is fully depreciated
  if (!rates || yearIndex >= rates.length) {
    return {
      assetId: asset.id,
      description: asset.description || '',
      cost: asset.cost,
      businessUseBasis,
      section179Amount: 0,
      bonusDepreciation: 0,
      macrsDepreciation: 0,
      totalDepreciation: 0,
      depreciableRemaining: round2(Math.max(0, basisAfterPrior179 - (asset.priorDepreciation || 0))),
      propertyClass: asset.propertyClass,
      yearIndex,
      convention: assetConvention,
    };
  }

  // MACRS depreciation for this year
  // Note: We apply the rate to the original depreciable basis (after 179),
  // NOT the basis minus prior depreciation. MACRS rates are designed to sum to 100%.
  const macrsDepreciation = round2(basisAfterPrior179 * rates[yearIndex]);

  // Ensure we don't depreciate below zero (remaining basis check)
  const priorDepr = asset.priorDepreciation || 0;
  const remainingBefore = round2(Math.max(0, basisAfterPrior179 - priorDepr));
  const allowedMacrs = round2(Math.min(macrsDepreciation, remainingBefore));

  const depreciableRemaining = round2(Math.max(0, remainingBefore - allowedMacrs));

  return {
    assetId: asset.id,
    description: asset.description || '',
    cost: asset.cost,
    businessUseBasis,
    section179Amount: 0,
    bonusDepreciation: 0,
    macrsDepreciation: allowedMacrs,
    totalDepreciation: allowedMacrs,
    depreciableRemaining,
    propertyClass: asset.propertyClass,
    yearIndex,
    convention: assetConvention,
  };
}

// ── Convention Detection (IRC §168(d)(3)) ───────────────────

/**
 * Determine the calendar quarter from a date string.
 * Returns 1-4 (Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec).
 */
export function getQuarter(dateInService?: string): 1 | 2 | 3 | 4 {
  if (!dateInService) return 1;
  const date = new Date(dateInService + 'T00:00:00');
  if (isNaN(date.getTime())) return 1;
  const month = date.getMonth(); // 0-11
  return (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
}

/**
 * Detect whether the mid-quarter convention is required for current-year assets.
 *
 * IRC §168(d)(3): The mid-quarter convention applies if the aggregate bases
 * of property placed in service during the last 3 months of the tax year
 * EXCEED 40% of the aggregate bases of all property placed in service during
 * the tax year. "Exceed" means strictly greater than 40%.
 *
 * Per Treas. Reg. §1.168(d)-1(b)(4)(ii), the basis used for the 40% test is
 * the depreciable basis AFTER subtracting Section 179 elected amounts (but
 * before bonus depreciation).
 *
 * Only current-year (year index = 0) assets are considered.
 * Assumes calendar-year taxpayer — "last 3 months" = Oct–Dec (Q4).
 */
export function detectConvention(
  currentYearAssets: DepreciationAsset[],
  section179Allocations?: Map<string, number>,
): 'half-year' | 'mid-quarter' {
  if (currentYearAssets.length === 0) return 'half-year';

  let totalBasis = 0;
  let q4Basis = 0;

  for (const asset of currentYearAssets) {
    // Software uses 36-month SL amortization, not MACRS — exclude from convention test
    if (asset.isSoftware) continue;

    const basisPct = Math.min(100, Math.max(0, asset.businessUsePercent ?? 100)) / 100;
    const grossBasis = round2(asset.cost * basisPct);

    // Subtract Section 179 elected amount from basis for the 40% test
    const sec179 = round2(Math.max(0, section179Allocations?.get(asset.id) || 0));
    const basis = round2(Math.max(0, grossBasis - sec179));

    totalBasis += basis;
    if (getQuarter(asset.dateInService) === 4) {
      q4Basis += basis;
    }
  }

  if (totalBasis <= 0) return 'half-year';

  // Strictly exceeds 40% → mid-quarter
  return (q4Basis / totalBasis) > 0.40 ? 'mid-quarter' : 'half-year';
}

// ── Year Index Helper ───────────────────────────────────────

/**
 * Determine the MACRS year index for an asset based on its date placed in service.
 * Year 0 = placed in service during the current tax year (2025).
 * Year 1 = placed in service during the prior year (2024), etc.
 * Returns -1 for future-year assets (placed in service after the tax year) —
 * these are not yet depreciable.
 */
function getYearIndex(dateInService?: string): number {
  if (!dateInService) return 0;
  const date = new Date(dateInService + 'T00:00:00');
  if (isNaN(date.getTime())) return 0;
  const yearPlaced = date.getFullYear();
  if (yearPlaced > DEPRECIATION_TAX_YEAR) return -1; // Not yet depreciable
  return DEPRECIATION_TAX_YEAR - yearPlaced;
}
