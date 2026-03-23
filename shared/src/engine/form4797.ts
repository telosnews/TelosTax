import { Form4797Property, Form4797PropertyResult, Form4797Result } from '../types/index.js';
import { round2 } from './utils.js';

/**
 * Calculate Form 4797 — Sales of Business Property.
 *
 * Handles the three main depreciation recapture provisions:
 *   1. Section 1245 — Personal property (equipment, vehicles, furniture).
 *      All depreciation is recaptured as ordinary income up to the gain amount.
 *   2. Section 1250 — Real property (buildings, improvements).
 *      Only "excess" depreciation (above straight-line) is recaptured as ordinary income.
 *      The straight-line depreciation portion is "unrecaptured §1250 gain" taxed at 25%.
 *   3. Section 1231 — After recapture, remaining gain/loss is netted across all properties.
 *      Net gain → treated as long-term capital gain (flows to Schedule D).
 *      Net loss → treated as ordinary loss (deductible against ordinary income).
 *
 * @authority
 *   IRC: Section 1231 — Property used in trade or business gain/loss netting
 *   IRC: Section 1245 — Gain from disposition of depreciable personal property
 *   IRC: Section 1250 — Gain from disposition of depreciable real property
 *   IRC: Section 1(h)(1)(E) — 25% rate on unrecaptured Section 1250 gain
 *   Form: Form 4797 — Sales of Business Property
 * @scope Section 1231/1245/1250 depreciation recapture for sold business property
 * @limitations
 *   Does not model Section 1231 lookback (5-year ordinary loss recapture rule)
 *   Does not model installment sale method (§453)
 *   Does not model like-kind exchanges (§1031) interaction
 *   Does not model casualty/theft gains (Part III special rules)
 */
export function calculateForm4797(
  properties: Form4797Property[],
): Form4797Result {
  if (!properties || properties.length === 0) {
    return {
      totalOrdinaryIncome: 0,
      netSection1231GainOrLoss: 0,
      section1231IsGain: false,
      unrecapturedSection1250Gain: 0,
      totalGain: 0,
      totalLoss: 0,
      propertyResults: [],
    };
  }

  const propertyResults: Form4797PropertyResult[] = [];
  let totalOrdinaryIncome = 0;
  let totalSection1231Gain = 0;
  let totalSection1231Loss = 0;
  let totalUnrecaptured1250 = 0;
  let totalGain = 0;
  let totalLoss = 0;

  for (const property of properties) {
    const result = calculatePropertyRecapture(property);
    propertyResults.push(result);

    totalOrdinaryIncome = round2(totalOrdinaryIncome + result.section1245OrdinaryIncome + result.section1250OrdinaryIncome);
    totalUnrecaptured1250 = round2(totalUnrecaptured1250 + result.unrecapturedSection1250Gain);
    totalGain = round2(totalGain + result.gain);
    totalLoss = round2(totalLoss + result.loss);

    if (result.section1231GainOrLoss >= 0) {
      totalSection1231Gain = round2(totalSection1231Gain + result.section1231GainOrLoss);
    } else {
      totalSection1231Loss = round2(totalSection1231Loss + result.section1231GainOrLoss);
    }
  }

  const netSection1231GainOrLoss = round2(totalSection1231Gain + totalSection1231Loss);

  return {
    totalOrdinaryIncome,
    netSection1231GainOrLoss,
    section1231IsGain: netSection1231GainOrLoss > 0,
    unrecapturedSection1250Gain: totalUnrecaptured1250,
    totalGain,
    totalLoss,
    propertyResults,
  };
}

/**
 * Calculate recapture for a single property.
 *
 * Logic flow for a property with gain:
 *   adjustedBasis = costBasis - depreciationAllowed
 *   gain = salesPrice - adjustedBasis
 *
 *   If §1245 property:
 *     ordinary income = min(gain, depreciationAllowed) — full recapture
 *     remaining gain → §1231 netting
 *
 *   If §1250 property:
 *     excessDepreciation = depreciationAllowed - straightLineDepreciation
 *     ordinary income = min(gain, excessDepreciation) — only excess recaptured
 *     unrecaptured1250 = min(gain - ordinary, straightLineDepreciation) — 25% rate
 *     remaining gain → §1231 netting
 *
 *   If neither §1245 nor §1250 specified:
 *     All gain/loss → §1231 netting (no recapture)
 *
 *   If loss:
 *     No recapture; entire loss → §1231 netting
 */
function calculatePropertyRecapture(property: Form4797Property): Form4797PropertyResult {
  const adjustedBasis = round2(property.costBasis - property.depreciationAllowed);
  const gainOrLoss = round2(property.salesPrice - adjustedBasis);

  const baseResult: Form4797PropertyResult = {
    propertyId: property.id,
    description: property.description,
    gain: 0,
    loss: 0,
    adjustedBasis,
    section1245OrdinaryIncome: 0,
    section1250OrdinaryIncome: 0,
    unrecapturedSection1250Gain: 0,
    section1231GainOrLoss: 0,
  };

  // Loss → no recapture, all goes to §1231 netting
  if (gainOrLoss <= 0) {
    baseResult.loss = round2(Math.abs(gainOrLoss));
    baseResult.section1231GainOrLoss = gainOrLoss;
    return baseResult;
  }

  // Gain
  baseResult.gain = gainOrLoss;

  if (property.isSection1245) {
    // §1245: Full depreciation recapture as ordinary income (up to gain)
    // IRC §1245(a)(1): The lesser of (A) depreciation allowed, or (B) the gain
    const section1245Ordinary = round2(Math.min(gainOrLoss, property.depreciationAllowed));
    baseResult.section1245OrdinaryIncome = section1245Ordinary;
    // Any gain above depreciation → §1231 netting
    baseResult.section1231GainOrLoss = round2(gainOrLoss - section1245Ordinary);

  } else if (property.isSection1250) {
    // §1250: Only "excess" depreciation recaptured as ordinary income
    // IRC §1250(a): Recapture = lesser of (gain) or (excess depreciation)
    const straightLine = property.straightLineDepreciation || 0;
    const excessDepreciation = round2(Math.max(0, property.depreciationAllowed - straightLine));

    // Ordinary income: excess depreciation recapture (only if using accelerated depreciation)
    const section1250Ordinary = round2(Math.min(gainOrLoss, excessDepreciation));
    baseResult.section1250OrdinaryIncome = section1250Ordinary;

    const remainingGain = round2(gainOrLoss - section1250Ordinary);

    // Unrecaptured §1250 gain: straight-line depreciation portion → 25% rate
    // IRC §1(h)(1)(E): capped at straight-line depreciation and remaining gain
    const unrecaptured = round2(Math.min(remainingGain, straightLine));
    baseResult.unrecapturedSection1250Gain = unrecaptured;

    // Full remaining gain → §1231 netting (IRS Form 4797 Part I).
    // The unrecaptured §1250 is a RATE CLASSIFICATION (25% max per IRC §1(h)(1)(E)),
    // not a deduction from §1231. It's a subset of this §1231 gain that the
    // preferential rate computation carves out for the 25% bracket.
    baseResult.section1231GainOrLoss = remainingGain;

  } else {
    // No recapture designation → all gain goes to §1231 netting
    baseResult.section1231GainOrLoss = gainOrLoss;
  }

  return baseResult;
}
