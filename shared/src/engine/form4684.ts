import { CasualtyLossInfo, CasualtyLossResult } from '../types/index.js';
import { round2 } from './utils.js';

/**
 * Calculate Form 4684 — Casualties and Thefts.
 *
 * Post-TCJA: personal-use property casualty losses are only deductible if
 * attributable to a federally declared disaster (IRC §165(h)(5)).
 *
 * Per-property loss = min(decrease in FMV, adjusted basis) - insurance.
 * Personal losses: subtract $100 per casualty event, then 10% of AGI.
 * Business/income-producing losses: direct deduction, no floors.
 *
 * @authority
 *   IRC §165(c)(3) — Losses of individuals from casualties
 *   IRC §165(h)(1) — $100 per-casualty floor
 *   IRC §165(h)(2) — 10% AGI floor for personal casualty losses
 *   IRC §165(h)(5) — TCJA limitation to federally declared disasters
 *   Form: Form 4684
 */
export function calculateForm4684(
  losses: CasualtyLossInfo[],
  agi: number,
): CasualtyLossResult {
  const perPropertyLosses: { id: string; lossPerProperty: number }[] = [];
  let totalPersonalBeforeFloors = 0;
  let totalBusinessLoss = 0;

  for (const loss of losses) {
    const decreaseInFMV = round2(Math.max(0, loss.fairMarketValueBefore - loss.fairMarketValueAfter));
    const lossAmount = round2(Math.min(decreaseInFMV, loss.costBasis));
    const netLoss = round2(Math.max(0, lossAmount - Math.max(0, loss.insuranceReimbursement)));

    perPropertyLosses.push({ id: loss.id, lossPerProperty: netLoss });

    if (loss.propertyType === 'personal') {
      // $100 per-casualty floor (IRC §165(h)(1))
      totalPersonalBeforeFloors = round2(totalPersonalBeforeFloors + Math.max(0, netLoss - 100));
    } else {
      totalBusinessLoss = round2(totalBusinessLoss + netLoss);
    }
  }

  // 10% AGI floor for personal casualty losses (IRC §165(h)(2))
  const agiFloorAmount = round2(agi * 0.10);
  const netDeductiblePersonalLoss = round2(Math.max(0, totalPersonalBeforeFloors - agiFloorAmount));

  const totalDeductibleLoss = round2(netDeductiblePersonalLoss + totalBusinessLoss);

  return {
    losses: perPropertyLosses,
    totalPersonalLoss: totalPersonalBeforeFloors,
    agiFloorAmount,
    netDeductiblePersonalLoss,
    totalBusinessLoss,
    totalDeductibleLoss,
  };
}
