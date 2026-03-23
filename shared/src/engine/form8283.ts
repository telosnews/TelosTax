import { NonCashDonation, CharitableCarryforward, Form8283Result } from '../types/index.js';
import { CHARITABLE_AGI_LIMITS, FORM_8283 } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Form 8283 — Noncash Charitable Contributions.
 *
 * Classifies per-item donations into Section A (FMV ≤ $5,000) and Section B
 * (FMV > $5,000), applies AGI-based percentage limitations by donation category,
 * processes prior-year carryforwards using FIFO ordering, and computes excess
 * carryforward amounts for future years.
 *
 * AGI Limitation Categories (IRC §170(b)(1)):
 *   - Cash to public charities: 60% AGI
 *   - Non-cash ordinary income property to public: 50% AGI
 *   - Non-cash capital gain property to public: 30% AGI
 *   - Overall limit: 60% AGI
 *
 * @authority
 *   IRC: Section 170(b)(1) — Percentage limitations on charitable deductions
 *   IRC: Section 170(d)(1) — 5-year carryforward for excess contributions
 *   IRC: Section 170(f)(11) — Substantiation requirements for noncash donations
 *   Reg: §1.170A-13 — Recordkeeping and return requirements
 *   Form: Form 8283 (Sections A and B)
 *   Pub: Publication 526 — Charitable Contributions
 * @scope Per-item classification, AGI limits, carryforward FIFO
 * @limitations Does not handle private foundation reduced limits (20% AGI)
 */
export function calculateForm8283(
  cashDonations: number,
  nonCashDonations: NonCashDonation[],
  agi: number,
  carryforwards?: CharitableCarryforward[],
  taxYear: number = 2025,
): Form8283Result {
  // ── Step 1: Classify items into Section A vs Section B ──
  const sectionAItems: NonCashDonation[] = [];
  const sectionBItems: NonCashDonation[] = [];

  for (const item of nonCashDonations) {
    const fmv = Math.max(0, item.fairMarketValue);
    if (fmv <= 0) continue;

    if (fmv > FORM_8283.SECTION_B_THRESHOLD) {
      sectionBItems.push(item);
    } else {
      sectionAItems.push(item);
    }
  }

  // ── Step 2: Categorize non-cash by property type ──
  // Capital gain property → 30% AGI limit
  // Ordinary income property → 50% AGI limit
  let nonCashCapitalGainFMV = 0;
  let nonCashOrdinaryFMV = 0;

  for (const item of nonCashDonations) {
    const fmv = Math.max(0, item.fairMarketValue);
    if (fmv <= 0) continue;

    if (item.isCapitalGainProperty) {
      nonCashCapitalGainFMV += fmv;
    } else {
      nonCashOrdinaryFMV += fmv;
    }
  }

  nonCashCapitalGainFMV = round2(nonCashCapitalGainFMV);
  nonCashOrdinaryFMV = round2(nonCashOrdinaryFMV);
  const totalNonCashFMV = round2(nonCashCapitalGainFMV + nonCashOrdinaryFMV);

  // ── Step 3: Apply AGI limits by category ──
  const overallLimit = round2(agi * CHARITABLE_AGI_LIMITS.OVERALL_LIMIT_RATE);
  const cashLimit = round2(agi * CHARITABLE_AGI_LIMITS.CASH_PUBLIC_RATE);
  const nonCashOrdinaryLimit = round2(agi * CHARITABLE_AGI_LIMITS.NON_CASH_ORDINARY_RATE);
  const nonCashCapGainLimit = round2(agi * CHARITABLE_AGI_LIMITS.NON_CASH_RATE);

  // Apply individual category limits
  const allowableCash = round2(Math.min(Math.max(0, cashDonations), cashLimit));
  const allowableNonCashOrdinary = round2(Math.min(nonCashOrdinaryFMV, nonCashOrdinaryLimit));
  const allowableNonCashCapGain = round2(Math.min(nonCashCapitalGainFMV, nonCashCapGainLimit));

  // Total before overall limit
  const subtotalBeforeOverall = round2(allowableCash + allowableNonCashOrdinary + allowableNonCashCapGain);

  // Apply overall 60% AGI limit
  let allowableCashFinal = allowableCash;
  let allowableNonCashFinal = round2(allowableNonCashOrdinary + allowableNonCashCapGain);

  if (subtotalBeforeOverall > overallLimit) {
    // Prorate: reduce proportionally to fit within overall limit
    const ratio = overallLimit / subtotalBeforeOverall;
    allowableCashFinal = round2(allowableCash * ratio);
    allowableNonCashFinal = round2((allowableNonCashOrdinary + allowableNonCashCapGain) * ratio);
  }

  // ── Step 4: Process carryforwards (FIFO — oldest first) ──
  let carryforwardUsed = 0;
  const currentYear = taxYear;

  if (carryforwards && carryforwards.length > 0) {
    // Sort by year ascending (oldest first) for FIFO
    const validCarryforwards = carryforwards
      .filter(cf => cf.amount > 0 && (currentYear - cf.year) <= FORM_8283.CARRYFORWARD_YEARS)
      .sort((a, b) => a.year - b.year);

    // Remaining room under overall limit
    let remainingRoom = round2(overallLimit - allowableCashFinal - allowableNonCashFinal);

    for (const cf of validCarryforwards) {
      if (remainingRoom <= 0) break;

      // Apply category-specific limits to carryforward too
      let cfLimit = remainingRoom;
      if (cf.category === 'non_cash_30') {
        cfLimit = Math.min(cfLimit, round2(nonCashCapGainLimit - allowableNonCashCapGain));
      } else if (cf.category === 'non_cash_50') {
        cfLimit = Math.min(cfLimit, round2(nonCashOrdinaryLimit - allowableNonCashOrdinary));
      } else {
        // cash carryforward
        cfLimit = Math.min(cfLimit, round2(cashLimit - allowableCashFinal));
      }

      const usable = round2(Math.min(cf.amount, Math.max(0, cfLimit)));
      if (usable > 0) {
        carryforwardUsed = round2(carryforwardUsed + usable);
        remainingRoom = round2(remainingRoom - usable);

        if (cf.category === 'cash') {
          allowableCashFinal = round2(allowableCashFinal + usable);
        } else {
          allowableNonCashFinal = round2(allowableNonCashFinal + usable);
        }
      }
    }
  }

  // ── Step 5: Calculate excess → new carryforward ──
  const totalDonated = round2(Math.max(0, cashDonations) + totalNonCashFMV);
  const totalAllowed = round2(allowableCashFinal + allowableNonCashFinal);
  const totalAllowedBeforeCarryforward = round2(totalAllowed - carryforwardUsed);
  const excessCarryforward = round2(Math.max(0, totalDonated - totalAllowedBeforeCarryforward));

  return {
    sectionAItems,
    sectionBItems,
    totalNonCashFMV,
    allowableNonCashDeduction: allowableNonCashFinal,
    allowableCashDeduction: allowableCashFinal,
    excessCarryforward,
    carryforwardUsed,
  };
}
