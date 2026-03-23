import { FilingStatus, ItemizedDeductions, ScheduleAResult, Form8283Result } from '../types/index.js';
import { SCHEDULE_A, CHARITABLE_AGI_LIMITS } from '../constants/tax2025.js';
import { calculateForm8283 } from './form8283.js';
import { round2 } from './utils.js';

/**
 * Calculate Schedule A (Itemized Deductions).
 * Applies AGI floors, SALT cap, mortgage interest limitation, charitable AGI limits,
 * and totals all categories.
 *
 * When per-item non-cash donation detail is provided (nonCashDonations array),
 * delegates charitable calculation to Form 8283 for proper Section A/B
 * classification, category-specific AGI limits, and carryforward processing.
 * Otherwise falls back to existing lump-sum charitable calculation.
 *
 * @authority
 *   IRC: Section 164(b)(6) — SALT deduction cap ($40k for 2025-2029, OBBBA)
 *   IRC: Section 163(h)(3) — qualified residence interest
 *   IRC: Section 170 — charitable contributions
 *   IRC: Section 170(f)(11) — Form 8283 substantiation requirements
 *   IRC: Section 213(a) — medical expenses (7.5% AGI floor)
 *   TCJA: Sections 11042-11043 — SALT cap and mortgage limit changes
 *   Form: Schedule A (Form 1040), Form 8283
 *   Pub: Publication 17, Chapter 21; Publication 526
 * @scope Itemized deductions with SALT cap, mortgage limit, charitable limits, Form 8283
 * @limitations No AMT preference items
 */
export function calculateScheduleA(
  deductions: ItemizedDeductions,
  agi: number,
  filingStatus: FilingStatus,
): ScheduleAResult {
  // Medical: only amount exceeding 7.5% of AGI
  const medicalFloor = round2(agi * SCHEDULE_A.MEDICAL_AGI_THRESHOLD);
  const medicalDeduction = round2(Math.max(0, deductions.medicalExpenses - medicalFloor));

  // SALT: state/local income tax + real estate tax + personal property tax, capped at $40k ($20k MFS)
  // OBBBA phases down the cap for MAGI above $500k ($250k MFS):
  //   Effective cap = max(floor, baseCap - 30% × (MAGI - threshold))
  const isMFS = filingStatus === FilingStatus.MarriedFilingSeparately;
  const baseSaltCap = isMFS ? SCHEDULE_A.SALT_CAP_MFS : SCHEDULE_A.SALT_CAP;
  const phaseDownThreshold = isMFS ? SCHEDULE_A.SALT_PHASE_DOWN_THRESHOLD_MFS : SCHEDULE_A.SALT_PHASE_DOWN_THRESHOLD;
  const saltCapFloor = isMFS ? SCHEDULE_A.SALT_CAP_FLOOR_MFS : SCHEDULE_A.SALT_CAP_FLOOR;

  let saltCap = baseSaltCap;
  if (agi > phaseDownThreshold) {
    const excess = agi - phaseDownThreshold;
    const reduction = round2(excess * SCHEDULE_A.SALT_PHASE_DOWN_RATE);
    saltCap = round2(Math.max(saltCapFloor, baseSaltCap - reduction));
  }

  // SALT income/sales tax component: use sales tax if elected under IRC §164(b)(5)(I)
  const saltTaxComponent = deductions.saltMethod === 'sales_tax'
    ? Math.max(0, deductions.salesTaxAmount || 0)
    : deductions.stateLocalIncomeTax;
  const totalSalt = saltTaxComponent + deductions.realEstateTax + deductions.personalPropertyTax;
  const saltDeduction = round2(Math.min(totalSalt, saltCap));

  // Interest: mortgage interest + mortgage insurance premiums
  // Mortgage interest deduction is limited based on acquisition debt:
  //   Post-TCJA (after 12/15/2017): $750,000 ($375,000 MFS)
  // If mortgageBalance is provided and exceeds the limit, prorate the interest.
  const mortgageLimit = filingStatus === FilingStatus.MarriedFilingSeparately
    ? SCHEDULE_A.MORTGAGE_LIMIT_MFS
    : SCHEDULE_A.MORTGAGE_LIMIT;

  let allowableMortgageInterest = deductions.mortgageInterest;
  if (deductions.mortgageBalance && deductions.mortgageBalance > mortgageLimit) {
    // Prorate: deductible = interest × (limit / balance)
    const ratio = mortgageLimit / deductions.mortgageBalance;
    allowableMortgageInterest = round2(deductions.mortgageInterest * ratio);
  }

  const interestDeduction = round2(allowableMortgageInterest + deductions.mortgageInsurancePremiums);

  // Charitable: compute using Form 8283 when per-item non-cash detail is provided,
  // otherwise fall back to lump-sum calculation.
  let charitableDeduction: number;
  let form8283Result: Form8283Result | undefined;

  if (deductions.nonCashDonations && deductions.nonCashDonations.length > 0) {
    // Per-item Form 8283 path: category-specific AGI limits + carryforward
    form8283Result = calculateForm8283(
      Math.max(0, deductions.charitableCash),
      deductions.nonCashDonations,
      agi,
      deductions.charitableCarryforward,
    );
    charitableDeduction = round2(form8283Result.allowableCashDeduction + form8283Result.allowableNonCashDeduction);
  } else {
    // Lump-sum fallback: existing behavior (backward compatible)
    const cashLimit = round2(agi * CHARITABLE_AGI_LIMITS.CASH_PUBLIC_RATE);
    const nonCashLimit = round2(agi * CHARITABLE_AGI_LIMITS.NON_CASH_RATE);
    const allowableCash = round2(Math.min(Math.max(0, deductions.charitableCash), cashLimit));
    const allowableNonCash = round2(Math.min(Math.max(0, deductions.charitableNonCash), nonCashLimit));
    charitableDeduction = round2(Math.min(allowableCash + allowableNonCash, cashLimit));
  }

  // Casualty loss: only federally-declared disaster losses deductible (since 2018 TCJA).
  // Each loss reduced by $100 floor, then total reduced by 10% of AGI.
  // If isFederallyDeclaredDisaster is false/missing, no casualty deduction is allowed.
  let casualtyDeduction = 0;
  if (deductions.casualtyLoss > 0) {
    const casualtyAfterFloor = Math.max(0, deductions.casualtyLoss - 100);
    casualtyDeduction = round2(Math.max(0, casualtyAfterFloor - agi * 0.10));
  }

  // Other: allowable casualty loss + other deductions
  const otherDeduction = round2(casualtyDeduction + deductions.otherDeductions);

  const totalItemized = round2(
    medicalDeduction + saltDeduction + interestDeduction + charitableDeduction + otherDeduction,
  );

  return {
    medicalDeduction,
    saltDeduction,
    interestDeduction,
    charitableDeduction,
    otherDeduction,
    totalItemized,
    form8283: form8283Result,
  };
}
