import { Income1099C, Form982Info, Form982Result } from '../types/index.js';
import { round2 } from './utils.js';

/**
 * Calculate taxable cancellation of debt income.
 *
 * When debt is cancelled, the amount is generally taxable income (Schedule 1, Line 8z).
 * Form 982 allows exclusion if the taxpayer was insolvent or in bankruptcy.
 *
 * Insolvency exclusion: Excluded amount = min(total cancelled, insolvency amount)
 * where insolvency amount = total liabilities - total assets (FMV) immediately before discharge.
 *
 * Bankruptcy exclusion: Full exclusion if discharged in Title 11 bankruptcy (takes precedence).
 *
 * Qualified principal residence debt and qualified farm debt have separate exclusion rules.
 *
 * @authority
 *   IRC: Section 61(a)(11) — gross income includes income from discharge of indebtedness
 *   IRC: Section 108 — income from discharge of indebtedness (exclusions)
 *   IRC: Section 108(b)(2) — reduction of tax attributes (mandatory order)
 *   Form: Form 982
 * @scope COD income with exclusions (bankruptcy, insolvency, QPRI, farm)
 * @limitations General business credit and minimum tax credit not tracked
 */
export function calculateCancellationOfDebt(
  forms1099C: Income1099C[],
  form982?: Form982Info,
): Form982Result {
  const zeroReductions = {
    nolReduction: 0,
    gbcReduction: 0,
    mtcReduction: 0,
    capitalLossReduction: 0,
    basisReduction: 0,
    palReduction: 0,
  };

  // Aggregate all 1099-C cancelled amounts
  const totalCancelledDebt = round2(
    forms1099C.reduce((sum, f) => sum + Math.max(0, f.amountCancelled), 0),
  );

  if (totalCancelledDebt <= 0) {
    return {
      totalCancelledDebt: 0,
      insolvencyAmount: 0,
      exclusionAmount: 0,
      taxableAmount: 0,
      ...zeroReductions,
    };
  }

  // Without Form 982, all cancelled debt is taxable
  if (!form982) {
    return {
      totalCancelledDebt,
      insolvencyAmount: 0,
      exclusionAmount: 0,
      taxableAmount: totalCancelledDebt,
      ...zeroReductions,
    };
  }

  let exclusionAmount = 0;

  // Bankruptcy exclusion (Line 1a) — full exclusion
  if (form982.isBankruptcy) {
    exclusionAmount = totalCancelledDebt;
    return {
      totalCancelledDebt,
      insolvencyAmount: 0,
      exclusionAmount,
      taxableAmount: 0,
      ...zeroReductions, // Attribute reduction computed later via applyAttributeReduction()
    };
  }

  // Insolvency exclusion (Line 1b) — limited to amount of insolvency
  if (form982.isInsolvent) {
    const insolvencyAmount = round2(
      Math.max(0, form982.totalLiabilitiesBefore - form982.totalAssetsBefore),
    );
    exclusionAmount = round2(Math.min(totalCancelledDebt, insolvencyAmount));
    const taxableAmount = round2(totalCancelledDebt - exclusionAmount);
    return {
      totalCancelledDebt,
      insolvencyAmount,
      exclusionAmount,
      taxableAmount,
      ...zeroReductions,
    };
  }

  // Qualified principal residence exclusion (Line 1e) — full exclusion for qualified mortgage
  if (form982.isQualifiedPrincipalResidence) {
    return {
      totalCancelledDebt,
      insolvencyAmount: 0,
      exclusionAmount: totalCancelledDebt,
      taxableAmount: 0,
      ...zeroReductions,
    };
  }

  // Qualified farm debt exclusion (Line 1c) — full exclusion for qualified farm indebtedness
  if (form982.isQualifiedFarmDebt) {
    return {
      totalCancelledDebt,
      insolvencyAmount: 0,
      exclusionAmount: totalCancelledDebt,
      taxableAmount: 0,
      ...zeroReductions,
    };
  }

  // No exclusion applies
  return {
    totalCancelledDebt,
    insolvencyAmount: 0,
    exclusionAmount: 0,
    taxableAmount: totalCancelledDebt,
    ...zeroReductions,
  };
}

/**
 * Compute Part II attribute reductions for Form 982.
 *
 * Per IRC §108(b)(2), when debt is excluded from income, the taxpayer must reduce
 * tax attributes in a mandatory order by the exclusion amount. This prevents a
 * double benefit (excluding income AND keeping the tax attributes).
 *
 * Mandatory order (§108(b)(2)):
 *   (A) NOL for the year + carryovers
 *   (B) General business credit carryover (not tracked — always 0)
 *   (C) Minimum tax credit (not tracked — always 0)
 *   (D) Net capital loss + carryover
 *   (E) Basis reduction under §1017
 *   (F) Passive activity loss / credit carryover
 *
 * The exclusion amount is allocated in this order until fully consumed.
 * Any remainder goes to basis reduction (Line 8).
 */
export function applyAttributeReduction(
  result: Form982Result,
  availableAttributes: {
    nol: number;             // Current-year NOL deduction + prior-year carryforward
    capitalLoss: number;     // Current-year capital loss deduction + carryforward
    passiveActivityLoss: number; // Disallowed passive activity loss (suspended/carryover)
  },
): Form982Result {
  const exclusion = result.exclusionAmount;
  if (exclusion <= 0) return result;

  let remaining = exclusion;

  // Line 4: NOL — reduce by min(remaining, available NOL)
  const nolReduction = round2(Math.min(remaining, Math.max(0, availableAttributes.nol)));
  remaining = round2(remaining - nolReduction);

  // Line 5: General business credit — not tracked, skip
  const gbcReduction = 0;

  // Line 6: Minimum tax credit — not tracked, skip
  const mtcReduction = 0;

  // Line 7: Capital loss — reduce by min(remaining, available capital loss + carryforward)
  const capitalLossReduction = round2(Math.min(remaining, Math.max(0, availableAttributes.capitalLoss)));
  remaining = round2(remaining - capitalLossReduction);

  // Line 9: Passive activity loss — reduce by min(remaining, available PAL)
  // NOTE: Per IRC ordering, PAL (F) comes AFTER basis (E), but the form puts
  // basis on Line 8 and PAL on Line 9. We compute PAL first, then basis gets
  // the remainder, matching actual IRC order: basis reduction is the catchall.
  const palReduction = round2(Math.min(remaining, Math.max(0, availableAttributes.passiveActivityLoss)));
  remaining = round2(remaining - palReduction);

  // Line 8: Basis reduction — remainder after all other attributes
  const basisReduction = round2(remaining);

  return {
    ...result,
    nolReduction,
    gbcReduction,
    mtcReduction,
    capitalLossReduction,
    basisReduction,
    palReduction,
  };
}
