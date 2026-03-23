import { ScholarshipCreditInfo, ScholarshipCreditResult } from '../types/index.js';
import { SCHOLARSHIP_CREDIT } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate the Scholarship Granting Organization Credit (IRC §25F).
 *
 * A nonrefundable credit of up to $1,700 for contributions to qualified
 * Scholarship Granting Organizations (SGOs) that fund K-12 scholarships.
 *
 * The credit is reduced dollar-for-dollar by any state tax credit received
 * for the same contribution.
 *
 * @authority
 *   IRC: Section 25F — Credit for qualified SGO contributions
 *   OBBBA: Section 70202 — Scholarship Granting Organization Credit
 *   Notice: 2025-70 — Interim guidance on §25F
 * @scope Nonrefundable credit, Schedule 3
 * @limitations No AGI phase-out; credit simply capped at $1,700
 */
export function calculateScholarshipCredit(
  info: ScholarshipCreditInfo,
): ScholarshipCreditResult {
  const zero: ScholarshipCreditResult = { eligibleContribution: 0, credit: 0 };

  if (info.contributionAmount <= 0) return zero;

  // Reduce contribution by any state tax credit received for the same donation
  const stateOffset = Math.max(0, info.stateTaxCreditReceived || 0);
  const eligibleContribution = round2(Math.max(0, info.contributionAmount - stateOffset));

  if (eligibleContribution <= 0) return zero;

  const credit = round2(Math.min(eligibleContribution, SCHOLARSHIP_CREDIT.MAX_CREDIT));

  return {
    eligibleContribution,
    credit,
  };
}
