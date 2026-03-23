/**
 * Form 8582 — Passive Activity Loss Limitations
 *
 * Limits passive activity losses per IRC §469. Only passive losses in excess
 * of passive income are subject to the limitation. The $25,000 special
 * allowance (IRC §469(i)) lets active-participation rental RE losses offset
 * non-passive income, subject to AGI phase-out.
 *
 * Key rules implemented:
 *   - Part I: Categorize passive activities (rental w/ active participation vs other)
 *   - Part II: $25k special allowance with AGI phase-out ($100k–$150k)
 *   - MFS: $12.5k allowance ($50k–$75k phase-out), or $0 if lived together
 *   - Real estate professional: IRC §469(c)(7) — bypass PAL entirely
 *   - Disposition: IRC §469(g)(1) — full disposition releases all suspended losses
 *   - Limited partners: IRC §469(i)(6)(C) — excluded from $25k rental allowance
 *   - Prior-year unallowed losses carry forward indefinitely (per-property and per-K-1)
 *
 * @authority
 *   IRC: Section 469 — Passive activity losses and credits limited
 *   IRC: Section 469(i) — $25,000 offset for rental real estate activities
 *   IRC: Section 469(i)(4) — MFS special rules
 *   IRC: Section 469(c)(7) — Real estate professional exception
 *   IRC: Section 469(g)(1) — Dispositions of entire interest
 *   IRC: Section 469(i)(6)(C) — Limited partners excluded from active participation
 *   Form: 8582 (Form 1040) — Passive Activity Loss Limitations
 *   Pub: Publication 925 — Passive Activity and At-Risk Rules
 * @scope Passive activity loss limitation with per-activity tracking
 * @limitations No at-risk rules (Section 465), no material participation tests beyond REP
 */

import {
  FilingStatus,
  RentalProperty,
  IncomeK1,
  ScheduleEResult,
  Form8582Result,
  PassiveActivityDetail,
  TaxReturn,
} from '../types/index.js';
import { FORM_8582 } from '../constants/tax2025.js';
import { round2 } from './utils.js';

// ─── Main Entry Point ────────────────────────────────

/**
 * Calculate Form 8582 — Passive Activity Loss Limitations.
 *
 * Takes raw Schedule E results (before passive loss limitation) and applies
 * the IRC §469 limitation rules. Returns per-activity allowed/suspended
 * amounts plus the total allowed loss that flows back to Schedule E.
 */
export function calculateForm8582(
  scheduleEResult: ScheduleEResult,
  properties: RentalProperty[],
  k1s: IncomeK1[],
  magi: number,
  filingStatus: FilingStatus,
  livedApartFromSpouse: boolean,
  form8582Data?: TaxReturn['form8582Data'],
  misc1099Rents: number = 0,
): Form8582Result {
  const warnings: string[] = [];

  // Collect all passive activities with their current-year net income
  const activities = collectPassiveActivities(
    scheduleEResult, properties, k1s, form8582Data?.priorYearUnallowedLoss || 0,
    misc1099Rents,
  );

  // If no passive activities, return zero result
  if (activities.length === 0) {
    return createZeroResult();
  }

  // ── Real estate professional: IRC §469(c)(7) ──
  // Rental activities are treated as non-passive → no limitation.
  // K-1 passive ordinary business income is NOT rental and remains subject to PAL.
  if (form8582Data?.realEstateProfessional) {
    warnings.push('Real estate professional election: all rental losses treated as non-passive.');

    const isRentalAct = (a: PassiveActivityDetail) =>
      a.type === 'rental' || (a.type === 'k1_passive' && a.id.endsWith('_rental'));

    // Mark rental activities as fully allowed (non-passive per REP)
    for (const act of activities) {
      if (isRentalAct(act) && act.overallGainOrLoss < 0) {
        act.allowedLoss = act.overallGainOrLoss;
        act.suspendedLoss = 0;
      }
    }

    // Non-rental passive activities still subject to PAL
    const nonRentalPassive = activities.filter(a => !isRentalAct(a));
    let nrIncome = 0;
    let nrLoss = 0;
    for (const act of nonRentalPassive) {
      if (act.overallGainOrLoss >= 0) nrIncome = round2(nrIncome + act.overallGainOrLoss);
      else nrLoss = round2(nrLoss + act.overallGainOrLoss);
    }
    const nrNet = round2(nrIncome + nrLoss);

    if (nrNet >= 0 || nonRentalPassive.length === 0) {
      // No non-rental passive net loss — all non-rental losses covered by income
      for (const act of nonRentalPassive) {
        if (act.overallGainOrLoss < 0) {
          act.allowedLoss = act.overallGainOrLoss;
          act.suspendedLoss = 0;
        }
      }
    } else {
      // Non-rental passive has net loss — allocate (no special allowance; that's rental only)
      const nonDisposedNR = nonRentalPassive.filter(a => !a.disposedDuringYear);
      allocateAllowedLoss(nonDisposedNR, nrIncome, 0);
    }

    const totalAllowed = activities.reduce((s, a) => round2(s + Math.min(0, a.allowedLoss)), 0);
    const totalSuspended = activities.reduce((s, a) => round2(s + a.suspendedLoss), 0);

    return {
      netRentalActiveIncome: 0, // Rental is non-passive under REP
      netOtherPassiveIncome: round2(nrNet),
      totalPassiveIncome: round2(nrIncome),
      totalPassiveLoss: round2(nrLoss),
      combinedNetIncome: round2(nrNet),
      specialAllowance: 0,
      allowedPassiveLoss: 0,
      dispositionReleasedLosses: 0,
      activities,
      totalSuspendedLoss: round2(totalSuspended),
      totalAllowedLoss: round2(totalAllowed),
      warnings,
    };
  }

  // ── Handle dispositions first: IRC §469(g)(1) ──
  // Full disposition releases ALL suspended losses for that activity
  let dispositionReleasedLosses = 0;
  for (const act of activities) {
    if (act.disposedDuringYear) {
      // All suspended + current-year loss is released on disposition
      const suspended = Math.abs(Math.min(0, act.overallGainOrLoss));
      dispositionReleasedLosses = round2(dispositionReleasedLosses + suspended);
      // Mark the full loss as allowed (will be adjusted below)
      act.allowedLoss = round2(Math.min(0, act.overallGainOrLoss));
      act.suspendedLoss = 0;
    }
  }

  // ── Part I: Categorize remaining (non-disposed) passive activities ──
  const nonDisposed = activities.filter(a => !a.disposedDuringYear);

  // Line 1: Rental activities with active participation
  let rentalActiveIncome = 0;
  let rentalActiveLoss = 0;
  // Line 2: All other passive activities
  let otherPassiveIncome = 0;
  let otherPassiveLoss = 0;

  for (const act of nonDisposed) {
    if (act.type === 'rental' && act.activeParticipation) {
      if (act.overallGainOrLoss >= 0) {
        rentalActiveIncome = round2(rentalActiveIncome + act.overallGainOrLoss);
      } else {
        rentalActiveLoss = round2(rentalActiveLoss + act.overallGainOrLoss);
      }
    } else {
      // Other passive: K-1 passive, or rentals without active participation
      if (act.overallGainOrLoss >= 0) {
        otherPassiveIncome = round2(otherPassiveIncome + act.overallGainOrLoss);
      } else {
        otherPassiveLoss = round2(otherPassiveLoss + act.overallGainOrLoss);
      }
    }
  }

  const netRentalActive = round2(rentalActiveIncome + rentalActiveLoss);
  const netOtherPassive = round2(otherPassiveIncome + otherPassiveLoss);

  const totalPassiveIncome = round2(rentalActiveIncome + otherPassiveIncome);
  const totalPassiveLoss = round2(rentalActiveLoss + otherPassiveLoss);
  const combinedNet = round2(totalPassiveIncome + totalPassiveLoss);

  // ── Line 4: If net is ≥ 0, no limitation needed ──
  if (combinedNet >= 0) {
    // All losses are allowed (offset by passive income)
    for (const act of nonDisposed) {
      if (act.overallGainOrLoss < 0) {
        act.allowedLoss = act.overallGainOrLoss;
        act.suspendedLoss = 0;
      }
    }
    return buildResult(
      netRentalActive, netOtherPassive, totalPassiveIncome, totalPassiveLoss,
      combinedNet, 0, 0, dispositionReleasedLosses, activities, warnings,
    );
  }

  // ── Part II: Special Allowance — IRC §469(i) ──
  const totalLoss = Math.abs(combinedNet); // positive number
  const rentalActiveLossAbs = Math.abs(rentalActiveLoss);

  const specialAllowance = calculateSpecialAllowance(
    magi, filingStatus, livedApartFromSpouse,
  );

  // Special allowance only applies to rental RE with active participation losses
  // that aren't offset by passive income
  const rentalActiveLossAfterIncome = Math.max(0, rentalActiveLossAbs - rentalActiveIncome);
  // Cap at totalLoss so special allowance can't exceed the net passive loss
  const specialAllowanceUsed = round2(Math.min(specialAllowance, rentalActiveLossAfterIncome, totalLoss));

  // Total allowed: special allowance + any passive income that offsets losses
  const allowedBySpecial = specialAllowanceUsed;
  const allowedByIncome = totalPassiveIncome; // Passive income always offsets passive loss
  const totalAllowedLoss = round2(Math.min(totalLoss, allowedBySpecial + allowedByIncome));

  // ── Allocate allowed loss to activities (pro rata) ──
  allocateAllowedLoss(nonDisposed, totalAllowedLoss, specialAllowanceUsed);

  // Calculate the net effect: allowed loss is negative, flowing to Schedule E
  const totalAllowedNegative = -round2(totalAllowedLoss);
  const totalSuspended = round2(totalLoss - totalAllowedLoss);

  if (totalSuspended > 0) {
    warnings.push(
      `$${totalSuspended.toLocaleString()} in passive losses suspended — carries forward to next year.`,
    );
  }

  return buildResult(
    netRentalActive, netOtherPassive, totalPassiveIncome, totalPassiveLoss,
    combinedNet, specialAllowance, totalAllowedLoss, dispositionReleasedLosses,
    activities, warnings,
  );
}

// ─── Special Allowance Calculation ────────────────────

/**
 * Calculate the $25,000 special allowance for rental RE with active participation.
 * Handles MFS special rules per IRC §469(i)(4).
 */
export function calculateSpecialAllowance(
  magi: number,
  filingStatus: FilingStatus,
  livedApartFromSpouse: boolean,
): number {
  // MFS who lived together all year → $0 allowance
  if (filingStatus === FilingStatus.MarriedFilingSeparately && !livedApartFromSpouse) {
    return 0;
  }

  // MFS who lived apart → $12,500 with $50k–$75k phase-out
  if (filingStatus === FilingStatus.MarriedFilingSeparately && livedApartFromSpouse) {
    if (magi <= FORM_8582.PHASE_OUT_START_MFS) {
      return FORM_8582.SPECIAL_ALLOWANCE_MFS;
    }
    const excess = magi - FORM_8582.PHASE_OUT_START_MFS;
    const reduction = excess * 0.5;
    return Math.max(0, round2(FORM_8582.SPECIAL_ALLOWANCE_MFS - reduction));
  }

  // All other statuses → $25,000 with $100k–$150k phase-out
  if (magi <= FORM_8582.PHASE_OUT_START) {
    return FORM_8582.SPECIAL_ALLOWANCE;
  }
  const excess = magi - FORM_8582.PHASE_OUT_START;
  const reduction = excess * 0.5;
  return Math.max(0, round2(FORM_8582.SPECIAL_ALLOWANCE - reduction));
}

// ─── Activity Collection ──────────────────────────────

/**
 * Build the list of passive activities from rental properties and K-1 entries.
 * Allocates prior-year unallowed losses proportionally to activities with losses.
 */
function collectPassiveActivities(
  scheduleEResult: ScheduleEResult,
  properties: RentalProperty[],
  k1s: IncomeK1[],
  priorYearUnallowed: number,
  misc1099Rents: number = 0,
): PassiveActivityDetail[] {
  const activities: PassiveActivityDetail[] = [];

  // Rental properties — use PropertyResult for net income if available
  const propResults = scheduleEResult.propertyResults || [];
  for (const prop of properties) {
    const result = propResults.find(r => r.id === prop.id);

    // Skip excluded (<15 days) and personal-use properties (loss already disallowed by Sched E)
    if (result?.isExcluded || result?.isPersonalUse) continue;

    const netIncome = result ? result.netIncome : ((prop.rentalIncome || 0) - getPropertyExpensesQuick(prop));
    // Disposition gain/loss flows through Form 4797 / Schedule D, NOT through Form 8582.
    // Form 8582 only tracks the operational rental income/loss for PAL purposes.
    const currentYear = round2(netIncome);

    // Per-property prior-year unallowed loss (if specified on the property itself)
    const propPriorYear = prop.priorYearUnallowedLoss || 0;

    activities.push({
      id: prop.id,
      name: prop.address || 'Rental Property',
      type: 'rental',
      currentYearNetIncome: currentYear,
      priorYearUnallowed: propPriorYear,
      overallGainOrLoss: round2(currentYear - propPriorYear),
      allowedLoss: 0,
      suspendedLoss: 0,
      disposedDuringYear: !!prop.disposedDuringYear,
      activeParticipation: prop.activeParticipation !== false, // default true
    });
  }

  // K-1 passive activities
  for (const k1 of k1s) {
    // K-1 Box 2 (rental income) is always passive
    // K-1 Box 1 (ordinary) is passive only if flagged
    const rentalIncome = k1.rentalIncome || 0;
    const ordinaryIncome = k1.ordinaryBusinessIncome || 0;
    const k1DispoGain = k1.disposedDuringYear ? (k1.dispositionGainLoss || 0) : 0;
    const k1PriorYear = k1.priorYearUnallowedLoss || 0;

    // Include if has passive rental income or is flagged as passive
    if (rentalIncome !== 0 || k1PriorYear > 0 || (k1.disposedDuringYear && k1DispoGain !== 0 && rentalIncome === 0 && !k1.isPassiveActivity)) {
      const currentYear = round2(rentalIncome + (rentalIncome !== 0 ? k1DispoGain : 0));
      activities.push({
        id: `${k1.id}_rental`,
        name: `${k1.entityName} (rental)`,
        type: 'k1_passive',
        currentYearNetIncome: currentYear,
        priorYearUnallowed: k1PriorYear,
        overallGainOrLoss: round2(currentYear - k1PriorYear),
        allowedLoss: 0,
        suspendedLoss: 0,
        disposedDuringYear: !!k1.disposedDuringYear,
        // IRC §469(i)(6)(C): Limited partners are excluded from the $25K rental
        // loss allowance — they cannot be treated as "actively participating"
        // regardless of actual involvement in management decisions.
        activeParticipation: false, // K-1 rentals: no active participation
      });
    }

    if (k1.isPassiveActivity && ordinaryIncome !== 0) {
      // Only add disposition gain here if it wasn't already counted in the rental activity above
      const dispoGainForPassive = (rentalIncome !== 0) ? 0 : k1DispoGain;
      const currentYear = round2(ordinaryIncome + dispoGainForPassive);
      activities.push({
        id: `${k1.id}_passive`,
        name: `${k1.entityName} (passive)`,
        type: 'k1_passive',
        currentYearNetIncome: currentYear,
        priorYearUnallowed: 0,
        overallGainOrLoss: currentYear,
        allowedLoss: 0,
        suspendedLoss: 0,
        disposedDuringYear: !!k1.disposedDuringYear,
        activeParticipation: false,
      });
    }
  }

  // 1099-MISC Box 1 rents — supplemental passive rental income without per-property tracking
  if (misc1099Rents !== 0) {
    activities.push({
      id: 'misc1099_rents',
      name: '1099-MISC Rents',
      type: 'rental',
      currentYearNetIncome: round2(misc1099Rents),
      priorYearUnallowed: 0,
      overallGainOrLoss: round2(misc1099Rents),
      allowedLoss: 0,
      suspendedLoss: 0,
      disposedDuringYear: false,
      activeParticipation: false, // No active participation for 1099-MISC rents
    });
  }

  // Allocate prior-year unallowed losses proportionally to activities with losses.
  // Subtract any per-property amounts already assigned above from the global pool.
  const alreadyAllocatedPrior = activities.reduce((sum, a) => sum + a.priorYearUnallowed, 0);
  const remainingPriorYear = round2(Math.max(0, priorYearUnallowed - alreadyAllocatedPrior));
  if (remainingPriorYear > 0 && activities.length > 0) {
    allocatePriorYearLosses(activities, remainingPriorYear);
  }

  return activities;
}

/**
 * Allocate prior-year unallowed losses to activities proportionally
 * based on their current-year losses. If no activities have losses,
 * spread evenly.
 */
function allocatePriorYearLosses(
  activities: PassiveActivityDetail[],
  totalPriorUnallowed: number,
): void {
  const lossActivities = activities.filter(a => a.currentYearNetIncome < 0);

  if (lossActivities.length === 0) {
    // Spread evenly if no current-year losses
    const perActivity = round2(totalPriorUnallowed / activities.length);
    let remaining = totalPriorUnallowed;
    for (let i = 0; i < activities.length; i++) {
      const alloc = i === activities.length - 1 ? remaining : perActivity;
      activities[i].priorYearUnallowed = round2(alloc);
      activities[i].overallGainOrLoss = round2(activities[i].currentYearNetIncome - alloc);
      remaining = round2(remaining - alloc);
    }
    return;
  }

  // Allocate proportionally to loss amounts
  const totalCurrentLoss = lossActivities.reduce(
    (sum, a) => sum + Math.abs(a.currentYearNetIncome), 0,
  );

  let remaining = totalPriorUnallowed;
  for (let i = 0; i < lossActivities.length; i++) {
    const fraction = Math.abs(lossActivities[i].currentYearNetIncome) / totalCurrentLoss;
    const alloc = i === lossActivities.length - 1
      ? remaining  // last one gets remainder to avoid rounding drift
      : round2(totalPriorUnallowed * fraction);
    lossActivities[i].priorYearUnallowed = round2(alloc);
    lossActivities[i].overallGainOrLoss = round2(
      lossActivities[i].currentYearNetIncome - alloc,
    );
    remaining = round2(remaining - alloc);
  }
}

// ─── Loss Allocation ──────────────────────────────────

/**
 * Allocate allowed loss to individual activities pro rata.
 * Special allowance first goes to rental activities with active participation,
 * then remaining allowed loss (from passive income offset) goes to all.
 */
function allocateAllowedLoss(
  activities: PassiveActivityDetail[],
  totalAllowed: number,
  specialAllowanceUsed: number,
): void {
  if (totalAllowed === 0) {
    // Nothing allowed — all losses suspended
    for (const act of activities) {
      if (act.overallGainOrLoss < 0) {
        act.allowedLoss = 0;
        act.suspendedLoss = round2(Math.abs(act.overallGainOrLoss));
      }
    }
    return;
  }

  const lossActivities = activities.filter(a => a.overallGainOrLoss < 0);
  if (lossActivities.length === 0) return;

  // Step 1: Allocate special allowance to active-participation rental losses
  const rentalActiveLosses = lossActivities.filter(
    a => a.type === 'rental' && a.activeParticipation,
  );
  let specialRemaining = specialAllowanceUsed;

  if (rentalActiveLosses.length > 0 && specialRemaining > 0) {
    const totalRentalActiveLoss = rentalActiveLosses.reduce(
      (sum, a) => sum + Math.abs(a.overallGainOrLoss), 0,
    );

    for (let i = 0; i < rentalActiveLosses.length; i++) {
      const act = rentalActiveLosses[i];
      const lossAbs = Math.abs(act.overallGainOrLoss);
      const fraction = lossAbs / totalRentalActiveLoss;
      const alloc = i === rentalActiveLosses.length - 1
        ? Math.min(specialRemaining, lossAbs)
        : round2(Math.min(specialAllowanceUsed * fraction, lossAbs));

      act.allowedLoss = round2(-alloc);
      specialRemaining = round2(specialRemaining - alloc);
    }
  }

  // Step 2: Remaining allowed loss (from passive income offset) goes to all loss activities
  const allowedFromIncome = Math.max(0, round2(totalAllowed - specialAllowanceUsed));
  if (allowedFromIncome > 0) {
    // Activities that still have unallocated losses
    const remaining = lossActivities.filter(
      a => Math.abs(a.overallGainOrLoss) > Math.abs(a.allowedLoss),
    );
    const totalRemainingLoss = remaining.reduce(
      (sum, a) => sum + (Math.abs(a.overallGainOrLoss) - Math.abs(a.allowedLoss)), 0,
    );

    if (totalRemainingLoss > 0) {
      let incomeRemaining = allowedFromIncome;
      for (let i = 0; i < remaining.length; i++) {
        const act = remaining[i];
        const unallocated = Math.abs(act.overallGainOrLoss) - Math.abs(act.allowedLoss);
        const fraction = unallocated / totalRemainingLoss;
        const alloc = i === remaining.length - 1
          ? Math.min(incomeRemaining, unallocated)
          : round2(Math.min(allowedFromIncome * fraction, unallocated));

        act.allowedLoss = round2(act.allowedLoss - alloc);
        incomeRemaining = round2(incomeRemaining - alloc);
      }
    }
  }

  // Step 3: Set suspended loss = total loss - allowed
  for (const act of lossActivities) {
    const totalLoss = Math.abs(act.overallGainOrLoss);
    const allowed = Math.abs(act.allowedLoss);
    act.suspendedLoss = round2(totalLoss - allowed);
  }
}

// ─── Helpers ──────────────────────────────────────────

/** Quick expense sum for properties without PropertyResult. */
function getPropertyExpensesQuick(prop: RentalProperty): number {
  return (
    (prop.advertising || 0) + (prop.auto || 0) + (prop.cleaning || 0) +
    (prop.commissions || 0) + (prop.insurance || 0) + (prop.legal || 0) +
    (prop.management || 0) + (prop.mortgageInterest || 0) + (prop.otherInterest || 0) +
    (prop.repairs || 0) + (prop.supplies || 0) + (prop.taxes || 0) +
    (prop.utilities || 0) + (prop.depreciation || 0) + (prop.otherExpenses || 0)
  );
}

function createZeroResult(): Form8582Result {
  return {
    netRentalActiveIncome: 0,
    netOtherPassiveIncome: 0,
    totalPassiveIncome: 0,
    totalPassiveLoss: 0,
    combinedNetIncome: 0,
    specialAllowance: 0,
    allowedPassiveLoss: 0,
    dispositionReleasedLosses: 0,
    activities: [],
    totalSuspendedLoss: 0,
    totalAllowedLoss: 0,
    warnings: [],
  };
}

function buildResult(
  netRentalActive: number,
  netOtherPassive: number,
  totalPassiveIncome: number,
  totalPassiveLoss: number,
  combinedNet: number,
  specialAllowance: number,
  allowedLoss: number,
  dispositionReleased: number,
  activities: PassiveActivityDetail[],
  warnings: string[],
): Form8582Result {
  const totalSuspended = activities.reduce((sum, a) => sum + a.suspendedLoss, 0);
  // Total allowed includes both disposition-released and normal allowed
  const disposedAllowed = activities
    .filter(a => a.disposedDuringYear && a.allowedLoss < 0)
    .reduce((sum, a) => sum + a.allowedLoss, 0);
  const normalAllowed = -round2(allowedLoss);
  const totalAllowed = round2(disposedAllowed + normalAllowed);

  return {
    netRentalActiveIncome: round2(netRentalActive),
    netOtherPassiveIncome: round2(netOtherPassive),
    totalPassiveIncome: round2(totalPassiveIncome),
    totalPassiveLoss: round2(totalPassiveLoss),
    combinedNetIncome: round2(combinedNet),
    specialAllowance: round2(specialAllowance),
    allowedPassiveLoss: round2(allowedLoss),
    dispositionReleasedLosses: round2(dispositionReleased),
    activities,
    totalSuspendedLoss: round2(totalSuspended),
    totalAllowedLoss: totalAllowed,
    warnings,
  };
}
