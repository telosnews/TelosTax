import { FilingStatus, HomeSaleInfo, HomeSaleResult } from '../types/index.js';
import { HOME_SALE_EXCLUSION } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Sale of Home Exclusion (Section 121).
 *
 * Taxpayers who sell their primary residence may exclude up to $250,000
 * ($500,000 MFJ) of gain if they meet the ownership and use tests:
 *   - Owned the home for at least 24 months in the last 5 years
 *   - Used as primary residence for at least 24 months in the last 5 years
 *   - Haven't used the Section 121 exclusion within the past 2 years
 *
 * Any taxable gain after exclusion flows to Schedule D as a long-term capital gain.
 * Losses on personal residence sales are not deductible.
 *
 * @authority
 *   IRC: Section 121 — exclusion of gain from sale of principal residence
 *   Pub: Publication 523 — Selling Your Home
 * @scope Sale of home exclusion ($250k/$500k) with ownership/residence tests
 * @limitations No partial exclusion for reduced maximum
 */
export function calculateHomeSaleExclusion(
  info: HomeSaleInfo,
  filingStatus: FilingStatus,
): HomeSaleResult {
  const sellingExpenses = Math.max(0, info.sellingExpenses || 0);
  const netProceeds = round2(info.salePrice - sellingExpenses);
  const gainOrLoss = round2(netProceeds - info.costBasis);

  // If there's a loss, it's not deductible for personal residence
  if (gainOrLoss <= 0) {
    return {
      gainOrLoss,
      exclusionAmount: 0,
      taxableGain: 0,
      qualifiesForExclusion: false,
      maxExclusion: 0,
    };
  }

  // Determine max exclusion based on filing status
  const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly ||
    filingStatus === FilingStatus.QualifyingSurvivingSpouse;
  const maxExclusion = isMFJ ? HOME_SALE_EXCLUSION.MFJ_MAX : HOME_SALE_EXCLUSION.SINGLE_MAX;

  // Check eligibility for exclusion
  const meetsOwnership = info.ownedMonths >= HOME_SALE_EXCLUSION.OWNERSHIP_MONTHS_REQUIRED;
  const meetsResidence = info.usedAsResidenceMonths >= HOME_SALE_EXCLUSION.RESIDENCE_MONTHS_REQUIRED;
  const noPriorExclusion = !info.priorExclusionUsedWithin2Years;
  const qualifiesForExclusion = meetsOwnership && meetsResidence && noPriorExclusion;

  if (!qualifiesForExclusion) {
    return {
      gainOrLoss,
      exclusionAmount: 0,
      taxableGain: gainOrLoss,
      qualifiesForExclusion: false,
      maxExclusion,
    };
  }

  const exclusionAmount = round2(Math.min(gainOrLoss, maxExclusion));
  const taxableGain = round2(Math.max(0, gainOrLoss - exclusionAmount));

  return {
    gainOrLoss,
    exclusionAmount,
    taxableGain,
    qualifiesForExclusion: true,
    maxExclusion,
  };
}
