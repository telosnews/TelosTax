import { FilingStatus, Schedule1AInfo, Schedule1AResult } from '../types/index.js';
import { SCHEDULE_1A } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Schedule 1-A — Additional Deductions (One Big Beautiful Bill Act).
 *
 * Four below-the-line deductions that reduce taxable income (not AGI):
 *   1. No Tax on Tips (qualified tips, $25k cap, MAGI phase-out)
 *   2. No Tax on Overtime (FLSA premium portion, $12.5k/$25k cap, MAGI phase-out)
 *   3. No Tax on Car Loan Interest (US-assembled new vehicle, $10k cap, MAGI phase-out)
 *   4. Enhanced Senior Deduction ($6k per person 65+, MAGI phase-out)
 *
 * MFS filers are ineligible for tips, overtime, and senior deductions.
 * Car loan interest is available to all filing statuses.
 *
 * MAGI for Schedule 1-A = AGI (Form 1040 line 11b) + FEIE exclusions.
 *
 * Flows to Form 1040 line 13b.
 *
 * @authority
 *   OBBBA: Sections 101-104 — No Tax on Tips, Overtime, Car Loan Interest, Senior Deduction
 *   Form: Schedule 1-A
 * @scope OBBBA deductions (tips, overtime, car loan interest, senior)
 * @limitations None
 */
export function calculateSchedule1A(
  info: Schedule1AInfo,
  magi: number,
  filingStatus: FilingStatus,
  taxpayerAge65OrOlder: boolean,
  spouseAge65OrOlder: boolean = false,
): Schedule1AResult {
  const isMFS = filingStatus === FilingStatus.MarriedFilingSeparately;
  const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly ||
    filingStatus === FilingStatus.QualifyingSurvivingSpouse;

  // ─── 1. No Tax on Tips ───────────────────────────
  let tipsDeduction = 0;
  let tipsPhaseOutReduction = 0;
  if (!isMFS && (info.qualifiedTips || 0) > 0) {
    const cappedTips = Math.min(info.qualifiedTips!, SCHEDULE_1A.TIPS_CAP);
    const threshold = isMFJ ? SCHEDULE_1A.TIPS_PHASE_OUT_MFJ : SCHEDULE_1A.TIPS_PHASE_OUT_SINGLE;
    tipsPhaseOutReduction = calculateFloorPhaseOut(magi, threshold, SCHEDULE_1A.TIPS_PHASE_OUT_RATE, SCHEDULE_1A.TIPS_PHASE_OUT_STEP);
    tipsDeduction = round2(Math.max(0, cappedTips - tipsPhaseOutReduction));
  }

  // ─── 2. No Tax on Overtime ──────────────────────
  let overtimeDeduction = 0;
  let overtimePhaseOutReduction = 0;
  if (!isMFS && (info.qualifiedOvertimePay || 0) > 0 && info.isFLSANonExempt) {
    const cap = isMFJ ? SCHEDULE_1A.OVERTIME_CAP_MFJ : SCHEDULE_1A.OVERTIME_CAP_SINGLE;
    const cappedOvertime = Math.min(info.qualifiedOvertimePay!, cap);
    const threshold = isMFJ ? SCHEDULE_1A.OVERTIME_PHASE_OUT_MFJ : SCHEDULE_1A.OVERTIME_PHASE_OUT_SINGLE;
    overtimePhaseOutReduction = calculateFloorPhaseOut(magi, threshold, SCHEDULE_1A.OVERTIME_PHASE_OUT_RATE, SCHEDULE_1A.OVERTIME_PHASE_OUT_STEP);
    overtimeDeduction = round2(Math.max(0, cappedOvertime - overtimePhaseOutReduction));
  }

  // ─── 3. No Tax on Car Loan Interest ─────────────
  let carLoanInterestDeduction = 0;
  let carLoanPhaseOutReduction = 0;
  if ((info.carLoanInterestPaid || 0) > 0 && info.vehicleAssembledInUS && info.isNewVehicle) {
    const cappedInterest = Math.min(info.carLoanInterestPaid!, SCHEDULE_1A.CAR_LOAN_CAP);
    const threshold = isMFJ ? SCHEDULE_1A.CAR_LOAN_PHASE_OUT_MFJ : SCHEDULE_1A.CAR_LOAN_PHASE_OUT_SINGLE;
    carLoanPhaseOutReduction = calculateCeilPhaseOut(magi, threshold, SCHEDULE_1A.CAR_LOAN_PHASE_OUT_RATE, SCHEDULE_1A.CAR_LOAN_PHASE_OUT_STEP);
    carLoanInterestDeduction = round2(Math.max(0, cappedInterest - carLoanPhaseOutReduction));
  }

  // ─── 4. Enhanced Senior Deduction ──────────────
  let seniorDeduction = 0;
  let seniorPhaseOutReduction = 0;
  if (!isMFS) {
    let seniorCount = 0;
    if (taxpayerAge65OrOlder) seniorCount++;
    if (isMFJ && spouseAge65OrOlder) seniorCount++;

    if (seniorCount > 0) {
      const baseSenior = seniorCount * SCHEDULE_1A.SENIOR_AMOUNT;
      const threshold = isMFJ ? SCHEDULE_1A.SENIOR_PHASE_OUT_MFJ : SCHEDULE_1A.SENIOR_PHASE_OUT_SINGLE;
      if (magi > threshold) {
        seniorPhaseOutReduction = round2((magi - threshold) * SCHEDULE_1A.SENIOR_PHASE_OUT_RATE);
      }
      seniorDeduction = round2(Math.max(0, baseSenior - seniorPhaseOutReduction));
    }
  }

  const totalDeduction = round2(tipsDeduction + overtimeDeduction + carLoanInterestDeduction + seniorDeduction);

  return {
    tipsDeduction,
    overtimeDeduction,
    carLoanInterestDeduction,
    seniorDeduction,
    totalDeduction,
    tipsPhaseOutReduction: round2(tipsPhaseOutReduction),
    overtimePhaseOutReduction: round2(overtimePhaseOutReduction),
    carLoanPhaseOutReduction: round2(carLoanPhaseOutReduction),
    seniorPhaseOutReduction: round2(seniorPhaseOutReduction),
  };
}

/**
 * Phase-out using floor function (tips and overtime).
 * Reduction = floor(excess / step) * rate
 */
function calculateFloorPhaseOut(magi: number, threshold: number, rate: number, step: number): number {
  if (magi <= threshold) return 0;
  const excess = magi - threshold;
  const steps = Math.floor(excess / step);
  return round2(steps * rate);
}

/**
 * Phase-out using ceiling function (car loan interest).
 * Reduction = ceil(excess / step) * rate
 */
function calculateCeilPhaseOut(magi: number, threshold: number, rate: number, step: number): number {
  if (magi <= threshold) return 0;
  const excess = magi - threshold;
  const steps = Math.ceil(excess / step);
  return round2(steps * rate);
}
