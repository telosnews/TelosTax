import { FilingStatus, SocialSecurityResult } from '../types/index.js';
import { SOCIAL_SECURITY } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate taxable portion of Social Security benefits.
 *
 * Uses the IRS "provisional income" method:
 *   Provisional income = AGI (excluding SS) + tax-exempt interest + 50% of SS benefits
 *
 * Tax-exempt interest (municipal bond interest, 1099-INT Box 8) is NOT included in AGI
 * but IS included in provisional income for Social Security taxability purposes.
 *
 * Thresholds (Single/HoH/QSS):
 *   ≤ $25,000: 0% taxable
 *   $25,001 - $34,000: up to 50% taxable
 *   > $34,000: up to 85% taxable
 *
 * Thresholds (MFJ):
 *   ≤ $32,000: 0% taxable
 *   $32,001 - $44,000: up to 50% taxable
 *   > $44,000: up to 85% taxable
 *
 * MFS: Always 85% taxable (base amount = $0), UNLESS the taxpayer lived apart
 *   from their spouse for the entire taxable year — in which case, Single thresholds apply.
 *
 * @authority
 *   IRC: Section 86 — Social Security and tier 1 railroad retirement benefits
 *   IRC: Section 86(c)(1)(C)(ii) — MFS "lived apart" exception (uses Single thresholds)
 *   Pub: Publication 915 — Social Security and Equivalent Railroad Retirement Benefits
 *   Form: Social Security Benefits Worksheet (Form 1040 instructions)
 * @scope Taxable Social Security benefits (50%/85% tiers), including MFS "lived apart" exception
 */
export function calculateTaxableSocialSecurity(
  totalBenefits: number,
  otherIncome: number,
  filingStatus: FilingStatus,
  taxExemptInterest: number = 0,
  livedApartFromSpouse: boolean = false,
): SocialSecurityResult {
  if (totalBenefits <= 0) {
    return { totalBenefits: 0, taxableBenefits: 0, taxablePercentage: 0, provisionalIncome: 0 };
  }

  // Provisional income = other income + tax-exempt interest + 50% of SS benefits
  const halfBenefits = totalBenefits * 0.5;
  const provisionalIncome = round2(otherIncome + taxExemptInterest + halfBenefits);

  const { baseAmount, adjustedBase } = getThresholds(filingStatus, livedApartFromSpouse);

  let taxableBenefits: number;
  let taxablePercentage: number;

  if (provisionalIncome <= baseAmount) {
    // Below base: 0% taxable
    taxableBenefits = 0;
    taxablePercentage = 0;
  } else if (provisionalIncome <= adjustedBase) {
    // Between base and adjusted base: up to 50% taxable
    // Taxable = lesser of:
    //   (a) 50% of benefits
    //   (b) 50% of (provisional income - base amount)
    const a = halfBenefits;
    const b = (provisionalIncome - baseAmount) * 0.5;
    taxableBenefits = round2(Math.min(a, b));
    taxablePercentage = 0.50;
  } else {
    // Above adjusted base: up to 85% taxable
    // Taxable = lesser of:
    //   (a) 85% of benefits
    //   (b) 85% of (provisional income - adjusted base) + lesser of:
    //       (i) $4,500 ($6,000 MFJ) — i.e. 50% of (adjusted base - base amount)
    //       (ii) amount from the 50% bracket
    const a = totalBenefits * 0.85;
    const amountIn50Bracket = (adjustedBase - baseAmount) * 0.5;
    const fiftyPercentAmount = Math.min(halfBenefits, amountIn50Bracket);
    const b = (provisionalIncome - adjustedBase) * 0.85 + fiftyPercentAmount;
    taxableBenefits = round2(Math.min(a, b));
    taxablePercentage = 0.85;
  }

  return {
    totalBenefits,
    taxableBenefits,
    taxablePercentage,
    provisionalIncome,
  };
}

function getThresholds(filingStatus: FilingStatus, livedApartFromSpouse: boolean = false): { baseAmount: number; adjustedBase: number } {
  switch (filingStatus) {
    case FilingStatus.MarriedFilingSeparately:
      // IRC §86(c)(1)(C)(ii): MFS filers who lived apart from their spouse for the entire
      // taxable year use Single filing thresholds instead of the $0 MFS base amount.
      if (livedApartFromSpouse) {
        return { baseAmount: SOCIAL_SECURITY.SINGLE_BASE_AMOUNT, adjustedBase: SOCIAL_SECURITY.SINGLE_ADJUSTED_BASE };
      }
      return { baseAmount: SOCIAL_SECURITY.MFS_BASE_AMOUNT, adjustedBase: SOCIAL_SECURITY.MFS_BASE_AMOUNT };
    case FilingStatus.MarriedFilingJointly:
      return { baseAmount: SOCIAL_SECURITY.MFJ_BASE_AMOUNT, adjustedBase: SOCIAL_SECURITY.MFJ_ADJUSTED_BASE };
    case FilingStatus.QualifyingSurvivingSpouse:
      // IRC §86(c)(1)(A)(ii) and Pub 915: QSS uses MFJ thresholds for SS benefit taxation
      return { baseAmount: SOCIAL_SECURITY.MFJ_BASE_AMOUNT, adjustedBase: SOCIAL_SECURITY.MFJ_ADJUSTED_BASE };
    default:
      // Single, HoH use single thresholds.
      return { baseAmount: SOCIAL_SECURITY.SINGLE_BASE_AMOUNT, adjustedBase: SOCIAL_SECURITY.SINGLE_ADJUSTED_BASE };
  }
}
