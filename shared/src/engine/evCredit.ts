import { FilingStatus, EVCreditInfo, EVCreditResult } from '../types/index.js';
import { EV_CREDIT } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Clean Vehicle Credit (Form 8936).
 *
 * New Clean Vehicle Credit (IRC §30D):
 *   - Up to $7,500 for new qualifying EVs/PHEVs
 *   - $3,750 for meeting critical mineral requirement
 *   - $3,750 for meeting battery component requirement
 *   - Vehicle must be assembled in North America
 *   - MSRP cap: $80,000 for vans/SUVs/pickups, $55,000 for others
 *   - Income limit: $300,000 MFJ, $225,000 HoH, $150,000 Single/MFS
 *
 * Previously Owned Clean Vehicle Credit (IRC §25E):
 *   - Up to $4,000 (or 30% of purchase price, whichever is less)
 *   - Vehicle price must be ≤ $25,000
 *   - Income limit: $150,000 MFJ, $112,500 HoH, $75,000 Single/MFS
 *
 * This is a non-refundable credit.
 *
 * @authority
 *   IRC: Section 30D — clean vehicle credit (new)
 *   IRC: Section 30D(f)(10) — income limitation uses lesser of current or prior year MAGI
 *   IRC: Section 25E — previously owned clean vehicle credit
 *   IRA: Sections 13401-13402 — clean vehicle credit modifications
 *   Form: Form 8936
 * @scope New and previously owned clean vehicle credits
 * @limitations None
 */
export function calculateEVCredit(
  info: EVCreditInfo,
  agi: number,
  filingStatus: FilingStatus,
  priorYearAgi?: number,
): EVCreditResult {
  const zero: EVCreditResult = { baseCredit: 0, credit: 0 };

  if (!info) return zero;

  // IRC §30D(f)(10) / §25E(b)(2): Income test uses the LESSER of current-year
  // or prior-year MAGI. If prior-year AGI is available, use the lower value.
  const effectiveAgi = (priorYearAgi !== undefined && priorYearAgi !== null)
    ? Math.min(agi, priorYearAgi)
    : agi;

  if (info.isNewVehicle) {
    return calculateNewVehicleCredit(info, effectiveAgi, filingStatus);
  } else {
    return calculateUsedVehicleCredit(info, effectiveAgi, filingStatus);
  }
}

function calculateNewVehicleCredit(
  info: EVCreditInfo,
  agi: number,
  filingStatus: FilingStatus,
): EVCreditResult {
  const zero: EVCreditResult = { baseCredit: 0, credit: 0 };

  // Must be assembled in North America
  if (!info.finalAssemblyUS) return zero;

  // MSRP cap check — vans, SUVs, and pickups get the higher $80,000 cap; others use $55,000
  const msrpCap = info.isVanSUVPickup ? EV_CREDIT.NEW_MSRP_CAP_VAN_SUV_TRUCK : EV_CREDIT.NEW_MSRP_CAP_OTHER;
  if (info.vehicleMSRP > msrpCap) return zero;

  // Income limit check
  const incomeLimit = getNewIncomeLimit(filingStatus);
  if (agi > incomeLimit) return zero;

  // Calculate credit components
  let credit = 0;
  if (info.meetsMineralReq) {
    credit += EV_CREDIT.NEW_CRITICAL_MINERAL;
  }
  if (info.meetsBatteryComponentReq) {
    credit += EV_CREDIT.NEW_BATTERY_COMPONENT;
  }

  const baseCredit = Math.min(credit, EV_CREDIT.NEW_VEHICLE_MAX);

  return {
    baseCredit: round2(baseCredit),
    credit: round2(baseCredit),
  };
}

function calculateUsedVehicleCredit(
  info: EVCreditInfo,
  agi: number,
  filingStatus: FilingStatus,
): EVCreditResult {
  const zero: EVCreditResult = { baseCredit: 0, credit: 0 };

  // Price cap check
  if (info.purchasePrice > EV_CREDIT.USED_PRICE_CAP) return zero;

  // Income limit check
  const incomeLimit = getUsedIncomeLimit(filingStatus);
  if (agi > incomeLimit) return zero;

  // Credit = lesser of $4,000 or 30% of purchase price
  const baseCredit = Math.min(
    EV_CREDIT.USED_VEHICLE_MAX,
    round2(info.purchasePrice * 0.30),
  );

  return {
    baseCredit: round2(baseCredit),
    credit: round2(baseCredit),
  };
}

function getNewIncomeLimit(filingStatus: FilingStatus): number {
  switch (filingStatus) {
    case FilingStatus.MarriedFilingJointly:
    case FilingStatus.QualifyingSurvivingSpouse:
      return EV_CREDIT.NEW_INCOME_LIMIT_MFJ;
    case FilingStatus.HeadOfHousehold:
      return EV_CREDIT.NEW_INCOME_LIMIT_HOH;
    default:
      return EV_CREDIT.NEW_INCOME_LIMIT_SINGLE;
  }
}

function getUsedIncomeLimit(filingStatus: FilingStatus): number {
  switch (filingStatus) {
    case FilingStatus.MarriedFilingJointly:
    case FilingStatus.QualifyingSurvivingSpouse:
      return EV_CREDIT.USED_INCOME_LIMIT_MFJ;
    case FilingStatus.HeadOfHousehold:
      return EV_CREDIT.USED_INCOME_LIMIT_HOH;
    default:
      return EV_CREDIT.USED_INCOME_LIMIT_SINGLE;
  }
}
