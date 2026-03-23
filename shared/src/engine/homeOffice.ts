import { HomeOfficeInfo, HomeOfficeResult } from '../types/index.js';
import { HOME_OFFICE, HOME_OFFICE_DEPRECIATION } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate home office deduction using either simplified or actual method.
 *
 * **Simplified**: $5/sqft, max 300 sqft = $1,500 max (Rev. Proc. 2013-13).
 *
 * **Actual (Form 8829)**: Implements the IRS three-tier cascading deduction
 * limit with a gross income limitation:
 *
 *   Tier 1 — Mortgage interest, real estate taxes, casualty losses
 *            (always deductible — would be on Schedule A anyway)
 *   Tier 2 — Operating expenses (insurance, utilities, repairs, rent, etc.)
 *            (limited to remaining gross income after Tier 1)
 *   Tier 3 — Depreciation + excess casualty losses
 *            (limited to remaining gross income after Tiers 1 & 2)
 *
 * Disallowed amounts carry forward to the next tax year.
 *
 * @authority
 *   IRC: Section 280A(c) — home office deduction
 *   Rev. Proc: 2013-13 — simplified method for home office deduction
 *   Form: Form 8829 — Expenses for Business Use of Your Home
 *   Pub: Publication 587 — Business Use of Your Home
 * @scope Full Form 8829 cascade (simplified + actual with 3-tier limit)
 */
export function calculateHomeOfficeDeduction(
  homeOffice: HomeOfficeInfo,
  tentativeProfit: number,
): number {
  const result = calculateHomeOfficeDetailed(homeOffice, tentativeProfit);
  return result.totalDeduction;
}

/**
 * Calculate home office deduction with full Form 8829 detail.
 * Returns a HomeOfficeResult with tier breakdowns, depreciation, and carryovers.
 */
export function calculateHomeOfficeDetailed(
  homeOffice: HomeOfficeInfo,
  tentativeProfit: number,
): HomeOfficeResult {
  if (!homeOffice.method) {
    return { method: 'simplified', businessPercentage: 0, totalDeduction: 0 };
  }

  // ── Part I: Business percentage ──────────────────────────────────────
  const officeSqft = homeOffice.squareFeet || 0;
  const totalSqft = homeOffice.totalHomeSquareFeet || 0;
  const businessPct = totalSqft > 0
    ? Math.min(1, officeSqft / totalSqft)
    : 0;

  // ── Simplified method ────────────────────────────────────────────────
  if (homeOffice.method === 'simplified') {
    const sqft = Math.min(officeSqft, HOME_OFFICE.SIMPLIFIED_MAX_SQFT);
    const deduction = sqft * HOME_OFFICE.SIMPLIFIED_RATE;
    const limited = round2(Math.min(deduction, Math.max(0, tentativeProfit)));
    return {
      method: 'simplified',
      businessPercentage: businessPct,
      simplifiedDeduction: limited,
      totalDeduction: limited,
    };
  }

  // ── Actual method (Form 8829) ────────────────────────────────────────
  // Detect whether the filer entered granular categories or just the legacy
  // single `actualExpenses` field. If no categories are populated, fall back
  // to the legacy proportional calculation for backward compatibility.
  const hasCategories = !!(
    homeOffice.mortgageInterest ||
    homeOffice.realEstateTaxes ||
    homeOffice.casualtyLosses ||
    homeOffice.insurance ||
    homeOffice.rent ||
    homeOffice.repairsAndMaintenance ||
    homeOffice.utilities ||
    homeOffice.otherExpenses ||
    homeOffice.excessMortgageInterest ||
    homeOffice.excessRealEstateTaxes ||
    homeOffice.homeCostOrValue ||
    homeOffice.priorYearOperatingCarryover ||
    homeOffice.priorYearDepreciationCarryover
  );

  if (!hasCategories && homeOffice.actualExpenses != null) {
    // Legacy backward-compatible: simple ratio × total expenses
    if (totalSqft <= 0 || officeSqft <= 0) {
      return { method: 'actual', businessPercentage: 0, totalDeduction: 0 };
    }
    const legacyDeduction = round2(businessPct * (homeOffice.actualExpenses || 0));
    return {
      method: 'actual',
      businessPercentage: round4(businessPct),
      totalDeduction: legacyDeduction,
    };
  }

  // Guard: need valid square footage for actual method
  if (totalSqft <= 0 || officeSqft <= 0) {
    return { method: 'actual', businessPercentage: 0, totalDeduction: 0 };
  }

  const grossIncome = Math.max(0, tentativeProfit); // Line 8

  // ── Part II, Tier 1: Always-deductible expenses (Lines 9-11) ─────────
  // These are indirect expenses multiplied by business percentage
  const tier1Mortgage = round2((homeOffice.mortgageInterest || 0) * businessPct);
  const tier1Taxes = round2((homeOffice.realEstateTaxes || 0) * businessPct);
  const tier1Casualty = round2((homeOffice.casualtyLosses || 0) * businessPct);
  const tier1Total = round2(tier1Mortgage + tier1Taxes + tier1Casualty);
  const tier1Allowed = tier1Total; // Always fully deductible (Line 14)

  // Line 15: Remaining income for Tiers 2 & 3
  const remainingAfterTier1 = round2(Math.max(0, grossIncome - tier1Allowed));

  // ── Part II, Tier 2: Operating expenses (Lines 16-22) ────────────────
  const tier2ExcessMortgage = round2((homeOffice.excessMortgageInterest || 0) * businessPct);
  const tier2ExcessTaxes = round2((homeOffice.excessRealEstateTaxes || 0) * businessPct);
  const tier2Insurance = round2((homeOffice.insurance || 0) * businessPct);
  const tier2Rent = round2((homeOffice.rent || 0) * businessPct);
  const tier2Repairs = round2((homeOffice.repairsAndMaintenance || 0) * businessPct);
  const tier2Utilities = round2((homeOffice.utilities || 0) * businessPct);
  const tier2Other = round2((homeOffice.otherExpenses || 0) * businessPct);
  const tier2OperatingBizPortion = round2(
    tier2ExcessMortgage + tier2ExcessTaxes + tier2Insurance +
    tier2Rent + tier2Repairs + tier2Utilities + tier2Other,
  );
  const tier2PriorCarryover = round2(homeOffice.priorYearOperatingCarryover || 0);
  const tier2Total = round2(tier2OperatingBizPortion + tier2PriorCarryover); // Line 26
  const tier2Allowed = round2(Math.min(remainingAfterTier1, tier2Total));    // Line 27

  // Line 28: Remaining income for Tier 3
  const remainingAfterTier2 = round2(Math.max(0, remainingAfterTier1 - tier2Allowed));

  // ── Part III: Depreciation ───────────────────────────────────────────
  const depreciationComputed = computeDepreciation(homeOffice, businessPct);

  // ── Part II, Tier 3: Depreciation + excess casualty (Lines 28-33) ────
  const tier3Depreciation = depreciationComputed;
  const tier3PriorCarryover = round2(homeOffice.priorYearDepreciationCarryover || 0);
  const tier3Total = round2(tier3Depreciation + tier3PriorCarryover); // Line 32
  const tier3Allowed = round2(Math.min(remainingAfterTier2, tier3Total)); // Line 33

  // ── Line 36: Total deduction ─────────────────────────────────────────
  const totalDeduction = round2(tier1Allowed + tier2Allowed + tier3Allowed);

  // ── Part IV: Carryovers to next year ─────────────────────────────────
  const operatingExpenseCarryover = round2(Math.max(0, tier2Total - tier2Allowed)); // Line 43
  const depreciationCarryover = round2(Math.max(0, tier3Total - tier3Allowed));     // Line 44

  return {
    method: 'actual',
    businessPercentage: round4(businessPct),
    grossIncome,
    tier1Total,
    tier2Total,
    tier3Total,
    tier1Allowed,
    tier2Allowed,
    tier3Allowed,
    depreciationComputed,
    totalDeduction,
    operatingExpenseCarryover: operatingExpenseCarryover > 0 ? operatingExpenseCarryover : undefined,
    depreciationCarryover: depreciationCarryover > 0 ? depreciationCarryover : undefined,
  };
}

/**
 * Compute MACRS depreciation for the home (Form 8829 Part III, Lines 37-42).
 *
 * Residential property uses 27.5-year straight-line with mid-month convention.
 * First-year rate depends on the month the home was placed in service for business.
 * Subsequent years use a flat 3.636% rate (12/330).
 */
function computeDepreciation(
  homeOffice: HomeOfficeInfo,
  businessPct: number,
): number {
  const homeCost = homeOffice.homeCostOrValue || 0;
  const landValue = homeOffice.landValue || 0;

  if (homeCost <= 0 || homeCost <= landValue) return 0;

  // Line 39: Basis of building (exclude land)
  const buildingBasis = round2(homeCost - landValue);

  // Line 40: Business basis = building basis × business percentage
  const businessBasis = round2(buildingBasis * businessPct);
  if (businessBasis <= 0) return 0;

  // Line 41: Depreciation percentage
  const rate = getDepreciationRate(homeOffice.dateFirstUsedForBusiness);

  // Line 42: Depreciation allowable
  return round2(businessBasis * rate);
}

/**
 * Get the MACRS depreciation rate based on when the home was first used for business.
 * - If placed in service in 2025, use first-year rate based on month
 * - If placed in service before 2025, use the subsequent-year rate (3.636%)
 * - If no date provided, use the subsequent-year rate as a safe default
 */
function getDepreciationRate(dateFirstUsed?: string): number {
  if (!dateFirstUsed) {
    return HOME_OFFICE_DEPRECIATION.SUBSEQUENT_YEAR_RATE;
  }

  const date = new Date(dateFirstUsed + 'T00:00:00');
  if (isNaN(date.getTime())) {
    return HOME_OFFICE_DEPRECIATION.SUBSEQUENT_YEAR_RATE;
  }

  const year = date.getFullYear();
  if (year < 2025) {
    return HOME_OFFICE_DEPRECIATION.SUBSEQUENT_YEAR_RATE;
  }

  if (year === 2025) {
    const month = date.getMonth() + 1; // 1-indexed
    return HOME_OFFICE_DEPRECIATION.FIRST_YEAR_RATE_BY_MONTH[month]
      || HOME_OFFICE_DEPRECIATION.SUBSEQUENT_YEAR_RATE;
  }

  // Future year — shouldn't happen for 2025 returns but handle gracefully
  return 0;
}

/**
 * Compare both methods and return the results for UI display.
 *
 * @authority
 *   IRC: Section 280A(c) — home office deduction
 *   Rev. Proc: 2013-13 — simplified method for home office deduction
 *   Form: Form 8829
 */
export function compareHomeOfficeMethods(
  homeOfficeOrSqft: HomeOfficeInfo | number,
  totalHomeSquareFeetOrProfit: number,
  actualExpensesOrUndef?: number,
  tentativeProfitOrUndef?: number,
): { simplified: number; actual: number } {
  // Support both signatures:
  //   compareHomeOfficeMethods(homeOffice, tentativeProfit)           — new
  //   compareHomeOfficeMethods(sqft, totalSqft, expenses, profit)    — legacy
  let homeOffice: HomeOfficeInfo;
  let tentativeProfit: number;

  if (typeof homeOfficeOrSqft === 'object') {
    homeOffice = homeOfficeOrSqft;
    tentativeProfit = totalHomeSquareFeetOrProfit;
  } else {
    homeOffice = {
      method: 'actual',
      squareFeet: homeOfficeOrSqft,
      totalHomeSquareFeet: totalHomeSquareFeetOrProfit,
      actualExpenses: actualExpensesOrUndef,
    };
    tentativeProfit = tentativeProfitOrUndef ?? 0;
  }

  const simplified = calculateHomeOfficeDeduction(
    { method: 'simplified', squareFeet: homeOffice.squareFeet },
    tentativeProfit,
  );
  const actual = calculateHomeOfficeDeduction(
    { ...homeOffice, method: 'actual' },
    tentativeProfit,
  );

  return { simplified, actual };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
