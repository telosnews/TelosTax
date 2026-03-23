import { VehicleInfo, VehicleResult } from '../types/index.js';
import { VEHICLE, VEHICLE_DEPRECIATION } from '../constants/tax2025.js';
import { round2 } from './utils.js';

// ── Expense category keys (order matches UI) ────────────
const EXPENSE_KEYS = [
  'gas', 'oilAndLubes', 'repairs', 'tires', 'insurance',
  'registration', 'licenses', 'garageRent', 'tolls', 'parking',
  'leasePayments', 'otherVehicleExpenses',
] as const;

/**
 * Calculate vehicle expense deduction (backward-compatible wrapper).
 * Returns a single number for Schedule C integration.
 *
 * @authority
 *   IRC: Section 162 — trade or business expenses
 *   IRC: Section 274(d) — substantiation requirements for vehicle expenses
 *   IRC: Section 280F — luxury vehicle depreciation limits
 *   IRC: Section 280F(b)(1) — business use ≤ 50% requires straight-line depreciation
 *   IRC: Section 168 — MACRS depreciation; Section 168(k) — bonus depreciation
 *   IRS Notice: 2025-5 — standard mileage rate ($0.70/mile)
 *   Rev. Proc.: 2025-16 — Section 280F dollar amounts for 2025
 *   Pub: Publication 463 — Travel, Gift, and Car Expenses
 *   Pub: Publication 946 — How to Depreciate Property
 *   Form: Form 4562 — Depreciation and Amortization (Parts IV/V)
 * @scope Standard mileage and actual expense vehicle deduction with depreciation
 */
export function calculateVehicleDeduction(vehicle: VehicleInfo): number {
  const result = calculateVehicleDetailed(vehicle);
  return result.totalDeduction;
}

/**
 * Calculate vehicle deduction with full detail.
 * Returns a VehicleResult with expense breakdown, depreciation, Section 280F,
 * Form 4562 Part V documentation, and validation warnings.
 */
export function calculateVehicleDetailed(vehicle: VehicleInfo): VehicleResult {
  if (!vehicle.method) {
    return { method: 'standard_mileage', businessUsePercentage: 0, totalDeduction: 0 };
  }

  // ── Standard mileage method ────────────────────────────
  if (vehicle.method === 'standard_mileage') {
    const businessMiles = vehicle.businessMiles || 0;
    const totalMiles = vehicle.totalMiles || 0;
    const businessPct = totalMiles > 0 ? Math.min(1, businessMiles / totalMiles) : (businessMiles > 0 ? 1 : 0);
    const deduction = round2(businessMiles * VEHICLE.STANDARD_MILEAGE_RATE);
    const warnings = buildWarnings(vehicle, businessPct);
    return {
      method: 'standard_mileage',
      businessUsePercentage: round4(businessPct),
      standardDeduction: deduction,
      totalDeduction: deduction,
      ...(totalMiles > 0 ? { form4562PartV: buildPartV(vehicle, businessMiles, totalMiles) } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  // ── Actual expense method ──────────────────────────────
  const businessMiles = vehicle.businessMiles || 0;
  const totalMiles = vehicle.totalMiles || 0;

  // Guard: need valid total miles and business miles
  if (totalMiles <= 0 || businessMiles <= 0) {
    return { method: 'actual', businessUsePercentage: 0, totalDeduction: 0 };
  }

  const businessPct = Math.min(1, businessMiles / totalMiles);

  // Detect granular vs legacy mode
  const hasGranularExpenses = EXPENSE_KEYS.some(
    (key) => (vehicle[key] as number | undefined) != null && (vehicle[key] as number) > 0,
  );
  const hasDepreciation = (vehicle.vehicleCost || 0) > 0;

  // Build Part V and warnings for actual method
  const partV = buildPartV(vehicle, businessMiles, totalMiles);
  const warnings = buildWarnings(vehicle, businessPct);

  // ── Legacy fallback (no granular categories, no depreciation) ──
  if (!hasGranularExpenses && !hasDepreciation && vehicle.actualExpenses != null) {
    const deduction = round2(businessPct * (vehicle.actualExpenses || 0));
    return {
      method: 'actual',
      businessUsePercentage: round4(businessPct),
      totalActualExpenses: vehicle.actualExpenses || 0,
      businessPortionExpenses: deduction,
      totalDeduction: deduction,
      form4562PartV: partV,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  // ── Sum expense categories ─────────────────────────────
  const expenseBreakdown: Record<string, number> = {};
  let totalActualExpenses = 0;

  for (const key of EXPENSE_KEYS) {
    const val = (vehicle[key] as number | undefined) || 0;
    expenseBreakdown[key] = round2(val * businessPct);
    totalActualExpenses += val;
  }
  totalActualExpenses = round2(totalActualExpenses);

  const businessPortionExpenses = round2(totalActualExpenses * businessPct);

  // ── Compute depreciation (Form 4562) ───────────────────
  const depr = computeVehicleDepreciation(vehicle, businessPct);

  // ── Total actual deduction ─────────────────────────────
  const totalDeduction = round2(businessPortionExpenses + depr.allowed);

  return {
    method: 'actual',
    businessUsePercentage: round4(businessPct),
    totalActualExpenses,
    businessPortionExpenses,
    depreciationComputed: depr.computed,
    depreciationBusinessPortion: depr.businessPortion,
    depreciationAllowed: depr.allowed,
    section280FLimit: depr.section280FLimit,
    section280FApplied: depr.section280FApplied,
    totalDeduction,
    expenseBreakdown,
    depreciationMethod: depr.depreciationMethod,
    form4562PartV: partV,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// ── Depreciation helper (MACRS 5-year / straight-line + Section 280F) ────

interface DepreciationResult {
  computed: number;          // Raw depreciation (before business %)
  businessPortion: number;   // computed * businessPct
  allowed: number;           // After Section 280F limit
  section280FLimit: number;  // The applicable 280F limit
  section280FApplied: boolean; // Whether the limit was binding
  depreciationMethod: 'macrs_200db' | 'straight_line';
}

/**
 * Compute vehicle depreciation with MACRS 5-year or straight-line method.
 *
 * Key rules:
 *   - priorDepreciation reduces the depreciable basis (prevents double-deduction)
 *   - Business use ≤ 50%: must use straight-line depreciation, no bonus (IRC §280F(b)(1))
 *   - Business use > 50%: MACRS 200% DB with bonus depreciation in year 1
 *   - Section 280F luxury limits apply to passenger vehicles (≤ 6,000 lbs)
 *   - Heavy vehicles (> 6,000 lbs GVW) are exempt from Section 280F limits
 */
function computeVehicleDepreciation(
  vehicle: VehicleInfo,
  businessPct: number,
): DepreciationResult {
  const cost = vehicle.vehicleCost || 0;
  const priorDepr = vehicle.priorDepreciation || 0;
  const depreciableBasis = Math.max(0, cost - priorDepr);

  const zero: DepreciationResult = {
    computed: 0, businessPortion: 0, allowed: 0,
    section280FLimit: 0, section280FApplied: false,
    depreciationMethod: 'macrs_200db',
  };

  if (depreciableBasis <= 0 || businessPct <= 0) return zero;

  // Determine year index in MACRS table
  const yearIndex = getYearIndex(vehicle.dateInService);

  // Business use ≤ 50% → straight-line, no bonus depreciation (IRC §280F(b)(1))
  const useStraightLine = businessPct <= 0.50;
  const depreciationMethod = useStraightLine ? 'straight_line' as const : 'macrs_200db' as const;

  // Compute raw depreciation
  let computed: number;
  if (useStraightLine) {
    // Straight-line 5-year rates (half-year convention)
    const rates = VEHICLE_DEPRECIATION.STRAIGHT_LINE_5_YEAR_RATES;
    const rate = yearIndex < rates.length ? rates[yearIndex] : 0;
    computed = round2(depreciableBasis * rate);
  } else if (yearIndex === 0) {
    // First year: 100% bonus depreciation (OBBBA 2025)
    computed = round2(depreciableBasis * VEHICLE_DEPRECIATION.BONUS_DEPRECIATION_RATE);
  } else {
    const rates = VEHICLE_DEPRECIATION.MACRS_5_YEAR_RATES;
    const rate = yearIndex < rates.length ? rates[yearIndex] : 0;
    computed = round2(depreciableBasis * rate);
  }

  // Apply business use percentage
  const businessPortion = round2(computed * businessPct);

  // Check for heavy vehicle (SUV exception: >6,000 lbs GVW)
  const isHeavyVehicle = (vehicle.vehicleWeight || 0) > 6000;

  if (isHeavyVehicle) {
    // No Section 280F limit for heavy vehicles
    return {
      computed, businessPortion, allowed: businessPortion,
      section280FLimit: 0, section280FApplied: false,
      depreciationMethod,
    };
  }

  // Apply Section 280F luxury vehicle limits
  // Use bonus limits only when year 1 + MACRS (not straight-line)
  const useBonus = !useStraightLine && yearIndex === 0;
  const limits = useBonus
    ? VEHICLE_DEPRECIATION.SECTION_280F_LIMITS_BONUS
    : VEHICLE_DEPRECIATION.SECTION_280F_LIMITS_NO_BONUS;

  let limit: number;
  if (yearIndex === 0) limit = limits.year1;
  else if (yearIndex === 1) limit = limits.year2;
  else if (yearIndex === 2) limit = limits.year3;
  else limit = limits.year4Plus;

  const allowed = Math.min(businessPortion, limit);
  const applied = businessPortion > limit;

  return {
    computed, businessPortion, allowed, section280FLimit: limit,
    section280FApplied: applied, depreciationMethod,
  };
}

// ── Form 4562 Part V helper ────────────────────────────

/**
 * Build Form 4562 Part V — Listed Property (Vehicles) informational output.
 *
 * Part V reports vehicle use statistics required by the IRS:
 *   - Total miles driven during the year
 *   - Business, commuting, and other personal miles
 *   - Whether the vehicle was available for personal use
 *   - Whether another vehicle was available for personal use
 *   - Whether written records support business use claim
 *   - Whether records were maintained contemporaneously
 */
function buildPartV(
  vehicle: VehicleInfo,
  businessMiles: number,
  totalMiles: number,
): NonNullable<VehicleResult['form4562PartV']> {
  const commuteMiles = vehicle.commuteMiles || 0;
  const otherMiles = vehicle.otherMiles != null
    ? vehicle.otherMiles
    : Math.max(0, totalMiles - businessMiles - commuteMiles);

  return {
    totalMiles,
    businessMiles,
    commuteMiles,
    otherMiles,
    availableForPersonalUse: vehicle.availableForPersonalUse ?? true,
    hasAnotherVehicle: vehicle.hasAnotherVehicle ?? false,
    writtenEvidence: vehicle.writtenEvidence ?? false,
    writtenEvidenceContemporaneous: vehicle.writtenEvidenceContemporaneous ?? false,
  };
}

// ── Validation warnings helper ─────────────────────────

/**
 * Build validation warnings based on VehicleInfo fields.
 *
 * Warnings are advisory and do not block calculation — they flag
 * situations that may trigger IRS scrutiny or indicate data issues.
 */
function buildWarnings(vehicle: VehicleInfo, businessPct: number): string[] {
  const warnings: string[] = [];

  if (vehicle.writtenEvidence === false) {
    warnings.push('IRS requires written records to substantiate business use (IRC §274(d))');
  }
  if (vehicle.method === 'actual' && businessPct > 0 && businessPct <= 0.50) {
    warnings.push(
      'Business use ≤50%: limited to straight-line depreciation; no bonus depreciation (IRC §280F(b)(1))',
    );
  }
  if ((vehicle.commuteMiles || 0) > 0 && (vehicle.businessMiles || 0) === 0) {
    warnings.push('Commuting expenses are not deductible (IRC §162)');
  }

  return warnings;
}

// ── Year index helper ────────────────────────────────────

function getYearIndex(dateInService?: string): number {
  if (!dateInService) return 0; // Default to first year
  const date = new Date(dateInService + 'T00:00:00');
  if (isNaN(date.getTime())) return 0;
  const yearPlaced = date.getFullYear();
  return Math.max(0, VEHICLE_DEPRECIATION.TAX_YEAR - yearPlaced);
}

// ── Method comparison ────────────────────────────────────

/**
 * Compare both methods for UI display.
 * Overloaded: accepts either a VehicleInfo object or the legacy 3-argument signature.
 */
export function compareVehicleMethods(
  vehicleOrBusinessMiles: VehicleInfo | number,
  totalMiles?: number,
  actualExpenses?: number,
): { standardMileage: number; actual: number } {
  // Legacy 3-argument signature (backward compat for fuzzing tests)
  if (typeof vehicleOrBusinessMiles === 'number') {
    const businessMiles = vehicleOrBusinessMiles;
    const standard = calculateVehicleDeduction({
      method: 'standard_mileage',
      businessMiles,
    });
    const actual = calculateVehicleDeduction({
      method: 'actual',
      businessMiles,
      totalMiles: totalMiles || 0,
      actualExpenses: actualExpenses || 0,
    });
    return { standardMileage: standard, actual };
  }

  // New VehicleInfo signature
  const vehicle = vehicleOrBusinessMiles;
  const standard = calculateVehicleDetailed({ ...vehicle, method: 'standard_mileage' });
  const actual = calculateVehicleDetailed({ ...vehicle, method: 'actual' });
  return { standardMileage: standard.totalDeduction, actual: actual.totalDeduction };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
