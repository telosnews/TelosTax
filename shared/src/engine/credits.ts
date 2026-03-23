import { FilingStatus, ChildTaxCreditInfo, EducationCreditInfo, EducationCreditStudentDetail, CreditsResult, Dependent } from '../types/index.js';
import { CHILD_TAX_CREDIT, EDUCATION_CREDITS, ACTC } from '../constants/tax2025.js';
import { round2, parseDateString } from './utils.js';

/**
 * Calculate all tax credits: Child Tax Credit, Other Dependent Credit, Education Credits.
 *
 * Credits are split into non-refundable (reduce tax to $0) and refundable (can create refund):
 *   Non-refundable: CTC, ODC, education credit (non-refundable portion)
 *   Refundable: ACTC, AOTC 40% refundable, EITC (added in form1040.ts)
 *
 * If dependents array is provided, qualifying children and other dependents are
 * derived from actual dependent data (age, residency) rather than trusting manual counts.
 *
 * earnedIncome and incomeTaxLiability are needed for ACTC calculation.
 *
 * @authority
 *   IRC: Section 24 — child tax credit / other dependent credit
 *   IRC: Section 25A — American Opportunity and Lifetime Learning credits
 *   IRC: Section 24(d) — additional child tax credit (refundable)
 *   Rev. Proc: 2024-40, Sections 3.23-3.27 — credit thresholds and phase-outs
 *   Form: Schedule 8812, Form 8863
 * @scope CTC, ODC, ACTC, AOTC, LLC with phase-outs
 * @limitations None
 */
export function calculateCredits(
  filingStatus: FilingStatus,
  agi: number,
  childTaxCredit?: ChildTaxCreditInfo,
  educationCredits?: EducationCreditInfo[],
  dependents?: Dependent[],
  taxYear: number = 2025,
  earnedIncome: number = 0,
  incomeTaxLiability: number = 0,
  aotcRefundableExcluded: boolean = false,
): CreditsResult {
  // Derive CTC counts from dependents if available, otherwise fall back to manual counts
  const ctcInfo = deriveCTCInfo(childTaxCredit, dependents, taxYear);
  const ctcResult = calculateChildTaxCredit(filingStatus, agi, ctcInfo);
  const eduResult = calculateEducationCreditsDetailed(filingStatus, agi, educationCredits || []);

  // Form 8863 Line 7: If filer is under 24, didn't provide half own support,
  // and has a living parent (and isn't MFJ), refundable AOTC is disallowed.
  // The refundable portion moves to nonrefundable instead.
  let nonRefundableEdu = eduResult.nonRefundable;
  let aotcRefundableCredit = eduResult.refundable;
  if (aotcRefundableExcluded && aotcRefundableCredit > 0) {
    nonRefundableEdu = round2(nonRefundableEdu + aotcRefundableCredit);
    aotcRefundableCredit = 0;
  }

  // Non-refundable credits (reduce income tax to $0 floor)
  const nonRefundableCTC = ctcResult.childCredit;
  const nonRefundableODC = ctcResult.otherDependentCredit;
  const totalNonRefundable = round2(nonRefundableCTC + nonRefundableODC + nonRefundableEdu);

  // ACTC: refundable portion of CTC
  // = min(excess CTC, $1700/child, 15% * (earned income - $2500))
  const qualifyingChildren = ctcInfo?.qualifyingChildren || 0;
  const actcCredit = calculateACTC(
    nonRefundableCTC,
    qualifyingChildren,
    earnedIncome,
    incomeTaxLiability,
    totalNonRefundable,
  );

  // Refundable credits (can go below $0 / create refund)
  const totalRefundable = round2(actcCredit + aotcRefundableCredit); // EITC added in form1040.ts

  return {
    childTaxCredit: nonRefundableCTC,
    otherDependentCredit: nonRefundableODC,
    actcCredit,
    educationCredit: nonRefundableEdu,
    aotcRefundableCredit,
    dependentCareCredit: 0,      // Calculated in form1040.ts and added there
    saversCredit: 0,              // Calculated in form1040.ts and added there
    cleanEnergyCredit: 0,         // Calculated in form1040.ts and added there
    evCredit: 0,                  // Calculated in form1040.ts and added there
    energyEfficiencyCredit: 0,    // Calculated in form1040.ts and added there
    foreignTaxCredit: 0,          // Calculated in form1040.ts and added there
    excessSSTaxCredit: 0,         // Calculated in form1040.ts and added there
    adoptionCredit: 0,            // Calculated in form1040.ts and added there
    evRefuelingCredit: 0,         // Calculated in form1040.ts and added there
    elderlyDisabledCredit: 0,     // Calculated in form1040.ts and added there
    scholarshipCredit: 0,         // Calculated in form1040Sections.ts and added there
    priorYearMinTaxCredit: 0,       // Calculated in form1040Sections.ts and added there
    k1OtherCredits: 0,            // Calculated in form1040Sections.ts and added there
    premiumTaxCredit: 0,          // Calculated in form1040.ts and added there
    eitcCredit: 0,                // Calculated separately in form1040.ts and added there
    educationCreditDetails: eduResult.details.length > 0 ? eduResult.details : undefined,
    totalNonRefundable,
    totalRefundable,
    totalCredits: round2(totalNonRefundable + totalRefundable),
  };
}

/**
 * ACTC (Additional Child Tax Credit) — refundable portion of CTC.
 *
 * When CTC exceeds income tax liability, the excess is refundable up to:
 *   min(excess CTC, $1,700 per qualifying child, 15% * (earned income - $2,500))
 */
function calculateACTC(
  ctcAmount: number,
  qualifyingChildren: number,
  earnedIncome: number,
  incomeTaxLiability: number,
  totalNonRefundable: number,
): number {
  if (qualifyingChildren <= 0 || ctcAmount <= 0) return 0;

  // Excess CTC = CTC that couldn't be used against tax
  const taxAfterOtherNonRefundable = Math.max(0, incomeTaxLiability - (totalNonRefundable - ctcAmount));
  const usableCTC = Math.min(ctcAmount, taxAfterOtherNonRefundable);
  const excessCTC = ctcAmount - usableCTC;

  if (excessCTC <= 0) return 0;

  // Max refundable amount per child
  const maxPerChild = CHILD_TAX_CREDIT.REFUNDABLE_MAX; // $1,700 for 2025
  const maxRefundable = qualifyingChildren * maxPerChild;

  // Earned income formula: 15% of earned income over $2,500
  const earnedIncomeFormula = Math.max(0, (earnedIncome - ACTC.EARNED_INCOME_THRESHOLD) * ACTC.EARNED_INCOME_RATE);

  return round2(Math.min(excessCTC, maxRefundable, earnedIncomeFormula));
}

/**
 * Derive CTC qualifying children and other dependents from actual dependent data.
 */
function deriveCTCInfo(
  manualInfo?: ChildTaxCreditInfo,
  dependents?: Dependent[],
  taxYear: number = 2025,
): ChildTaxCreditInfo | undefined {
  if (!dependents || dependents.length === 0) return manualInfo;

  let qualifyingChildren = 0;
  let otherDependents = 0;

  for (const dep of dependents) {
    const isUnder17 = isUnderAge(dep.dateOfBirth, 17, taxYear);
    const meetsResidency = dep.monthsLivedWithYou >= 7;

    if (isUnder17 && meetsResidency) {
      qualifyingChildren++;
    } else {
      otherDependents++;
    }
  }

  if (qualifyingChildren === 0 && otherDependents === 0) return manualInfo;
  return { qualifyingChildren, otherDependents };
}

function isUnderAge(dateOfBirth: string | undefined, age: number, taxYear: number): boolean {
  if (!dateOfBirth) return false;
  const dob = parseDateString(dateOfBirth);
  if (!dob) return false;
  const endOfTaxYear = new Date(taxYear, 11, 31);
  const ageDate = new Date(dob.year + age, dob.month, dob.day);
  return ageDate > endOfTaxYear;
}

function calculateChildTaxCredit(
  filingStatus: FilingStatus,
  agi: number,
  info?: ChildTaxCreditInfo,
): { childCredit: number; otherDependentCredit: number } {
  if (!info) return { childCredit: 0, otherDependentCredit: 0 };

  // Per IRS Schedule 8812: MFJ and QSS use $400,000 threshold; all others use $200,000
  const threshold = (filingStatus === FilingStatus.MarriedFilingJointly ||
    filingStatus === FilingStatus.QualifyingSurvivingSpouse)
    ? CHILD_TAX_CREDIT.PHASE_OUT_THRESHOLD_MFJ
    : CHILD_TAX_CREDIT.PHASE_OUT_THRESHOLD_SINGLE;

  const totalChildCredit = info.qualifyingChildren * CHILD_TAX_CREDIT.PER_CHILD;
  const totalOtherCredit = info.otherDependents * CHILD_TAX_CREDIT.PER_OTHER_DEPENDENT;
  const totalCredit = totalChildCredit + totalOtherCredit;

  if (agi > threshold) {
    const excess = agi - threshold;
    const reductionIncrements = Math.ceil(excess / 1000);
    const reduction = reductionIncrements * CHILD_TAX_CREDIT.PHASE_OUT_RATE;
    const remainingCredit = Math.max(0, totalCredit - reduction);

    if (totalCredit > 0) {
      const ratio = remainingCredit / totalCredit;
      return {
        childCredit: round2(totalChildCredit * ratio),
        otherDependentCredit: round2(totalOtherCredit * ratio),
      };
    }
    return { childCredit: 0, otherDependentCredit: 0 };
  }

  return {
    childCredit: round2(totalChildCredit),
    otherDependentCredit: round2(totalOtherCredit),
  };
}

/**
 * Education credits with AOTC split into refundable (40%) and non-refundable (60%).
 * LLC remains fully non-refundable.
 */
function calculateEducationCreditsDetailed(
  filingStatus: FilingStatus,
  agi: number,
  credits: EducationCreditInfo[],
): { nonRefundable: number; refundable: number; details: EducationCreditStudentDetail[] } {
  let totalNonRefundable = 0;
  let totalRefundable = 0;
  const details: EducationCreditStudentDetail[] = [];

  for (const credit of credits) {
    const qualifiedExpenses = Math.max(0, credit.tuitionPaid - (credit.scholarships || 0));

    if (credit.type === 'american_opportunity') {
      const totalAOTC = calculateAOTC(filingStatus, agi, qualifiedExpenses);
      // 40% is refundable, 60% is non-refundable
      const refundablePortion = round2(totalAOTC * EDUCATION_CREDITS.AOTC_REFUNDABLE_RATE);
      const nonRefundablePortion = round2(totalAOTC - refundablePortion);
      totalRefundable += refundablePortion;
      totalNonRefundable += nonRefundablePortion;
      details.push({
        studentName: credit.studentName,
        institution: credit.institution,
        creditType: 'american_opportunity',
        qualifiedExpenses,
        creditAmount: totalAOTC,
        aotcRefundable: refundablePortion,
        aotcNonRefundable: nonRefundablePortion,
      });
    } else if (credit.type === 'lifetime_learning') {
      const llcCredit = calculateLLC(filingStatus, agi, qualifiedExpenses);
      totalNonRefundable += llcCredit;
      details.push({
        studentName: credit.studentName,
        institution: credit.institution,
        creditType: 'lifetime_learning',
        qualifiedExpenses,
        creditAmount: llcCredit,
        aotcRefundable: 0,
        aotcNonRefundable: 0,
      });
    }
  }

  return { nonRefundable: round2(totalNonRefundable), refundable: round2(totalRefundable), details };
}

function calculateAOTC(filingStatus: FilingStatus, agi: number, expenses: number): number {
  const ec = EDUCATION_CREDITS;

  // IRC §25A(g)(6): MFS filers are ineligible for education credits
  if (filingStatus === FilingStatus.MarriedFilingSeparately) return 0;

  let credit = Math.min(expenses, ec.AOTC_FIRST_TIER);
  credit += Math.min(Math.max(0, expenses - ec.AOTC_FIRST_TIER), ec.AOTC_SECOND_TIER) * 0.25;
  credit = Math.min(credit, ec.AOTC_MAX);

  const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly ||
    filingStatus === FilingStatus.QualifyingSurvivingSpouse;
  const phaseOutStart = isMFJ ? ec.AOTC_PHASE_OUT_MFJ : ec.AOTC_PHASE_OUT_SINGLE;
  const phaseOutRange = isMFJ ? ec.AOTC_PHASE_OUT_RANGE_MFJ : ec.AOTC_PHASE_OUT_RANGE_SINGLE;

  if (agi > phaseOutStart) {
    const excess = Math.min(agi - phaseOutStart, phaseOutRange);
    const reduction = excess / phaseOutRange;
    credit = round2(credit * (1 - reduction));
  }

  return Math.max(0, credit);
}

function calculateLLC(filingStatus: FilingStatus, agi: number, expenses: number): number {
  const ec = EDUCATION_CREDITS;

  // IRC §25A(g)(6): MFS filers are ineligible for education credits
  if (filingStatus === FilingStatus.MarriedFilingSeparately) return 0;

  let credit = Math.min(expenses, 10000) * ec.LLC_RATE;
  credit = Math.min(credit, ec.LLC_MAX);

  const isMFJ = filingStatus === FilingStatus.MarriedFilingJointly ||
    filingStatus === FilingStatus.QualifyingSurvivingSpouse;
  const phaseOutStart = isMFJ ? ec.LLC_PHASE_OUT_MFJ : ec.LLC_PHASE_OUT_SINGLE;
  const phaseOutRange = isMFJ ? ec.LLC_PHASE_OUT_RANGE_MFJ : ec.LLC_PHASE_OUT_RANGE_SINGLE;

  if (agi > phaseOutStart) {
    const excess = Math.min(agi - phaseOutStart, phaseOutRange);
    const reduction = excess / phaseOutRange;
    credit = round2(credit * (1 - reduction));
  }

  return Math.max(0, credit);
}
