import { FilingStatus, DependentCareResult } from '../types/index.js';
import { DEPENDENT_CARE, DEPENDENT_CARE_EMPLOYER } from '../constants/tax2025.js';
import { round2 } from './utils.js';

/**
 * Calculate Child and Dependent Care Credit (Form 2441).
 *
 * The credit is a percentage (20-35%) of qualifying child/dependent care expenses,
 * subject to a dollar limit ($3,000 for one qualifying person, $6,000 for two+).
 *
 * The percentage starts at 35% for AGI ≤ $15,000 and decreases by 1% for each
 * $2,000 (or fraction thereof) of AGI over $15,000, down to a floor of 20%.
 *
 * MFS filers are generally ineligible unless they lived apart from their spouse
 * for the entire year (livedApartFromSpouseMFS = true).
 *
 * Part III: Employer-provided dependent care benefits (W-2 Box 10, IRC §129):
 *   - Up to $5,000 ($2,500 MFS) is excludable from income
 *   - Excess above the exclusion limit → taxable income (flows to Form 1040)
 *   - Employer benefits also reduce the expense limit for the credit
 *
 * Student/disabled spouse deemed earned income (IRC §21(d)(2)):
 *   - Full-time student or disabled spouse deemed to earn $250/month (one qualifying person)
 *     or $500/month (two+ qualifying persons) for each month they meet the criteria.
 *   - Simplified: 12 months × rate = $3,000 or $6,000 per year.
 *
 * This is a non-refundable credit (reduces tax to $0 floor).
 *
 * @authority
 *   IRC: Section 21 — expenses for household and dependent care services
 *   IRC: Section 21(d)(2) — deemed earned income for student/disabled spouse
 *   IRC: Section 129 — dependent care assistance programs (employer exclusion)
 *   Form: Form 2441
 * @scope Full Form 2441 with employer benefits reconciliation, student/disabled spouse, MFS lived-apart
 * @limitations Does not validate qualifying individual tests (age, dependency, incapacity)
 */

export function calculateDependentCareCredit(
  expenses: number,
  qualifyingPersons: number,
  agi: number,
  filingStatus: FilingStatus,
  earnedIncome: number,
  spouseEarnedIncome?: number,
  employerBenefits?: number,
  isStudentSpouse?: boolean,
  isDisabledSpouse?: boolean,
  livedApartFromSpouseMFS?: boolean,
): DependentCareResult {
  const zero: DependentCareResult = { qualifyingExpenses: 0, creditRate: 0, credit: 0 };

  // MFS is generally ineligible unless lived apart all year
  if (filingStatus === FilingStatus.MarriedFilingSeparately && !livedApartFromSpouseMFS) {
    return zero;
  }

  // Must have at least one qualifying person and some expenses
  if (qualifyingPersons <= 0 || expenses <= 0) return zero;

  // ─── Part III: Employer-Provided Benefits Reconciliation (IRC §129) ──
  // Employer benefits reduce the expense limit and any excess is taxable income
  let employerBenefitsExclusion: number | undefined;
  let employerBenefitsTaxable: number | undefined;
  const rawEmployerBenefits = Math.max(0, employerBenefits || 0);

  if (rawEmployerBenefits > 0) {
    // IRC §129(a)(2): Exclusion limit is $5,000 ($2,500 MFS)
    const exclusionLimit = filingStatus === FilingStatus.MarriedFilingSeparately
      ? DEPENDENT_CARE_EMPLOYER.MAX_EXCLUSION_MFS
      : DEPENDENT_CARE_EMPLOYER.MAX_EXCLUSION;
    employerBenefitsExclusion = round2(Math.min(rawEmployerBenefits, exclusionLimit));
    employerBenefitsTaxable = round2(Math.max(0, rawEmployerBenefits - exclusionLimit));
  }

  // ─── Student/Disabled Spouse Deemed Earned Income (IRC §21(d)(2)) ──
  // If the spouse is a full-time student or disabled, they are deemed to have earned income
  let deemedEarnedIncome: number | undefined;
  if (isStudentSpouse || isDisabledSpouse) {
    const monthlyDeemed = qualifyingPersons >= 2
      ? DEPENDENT_CARE_EMPLOYER.STUDENT_DISABLED_DEEMED_TWO   // $500/month
      : DEPENDENT_CARE_EMPLOYER.STUDENT_DISABLED_DEEMED_ONE;  // $250/month
    deemedEarnedIncome = round2(monthlyDeemed * 12);
  }

  // Expense limit: $3k for 1 qualifying person, $6k for 2+
  const expenseLimit = qualifyingPersons >= 2
    ? DEPENDENT_CARE.EXPENSE_LIMIT_TWO_PLUS
    : DEPENDENT_CARE.EXPENSE_LIMIT_ONE;

  // Form 2441 Lines 3-7:
  //   Line 5: min(expenses, dollar limit)
  //   Line 7: Line 5 - employer benefits (from Part III)
  // Employer benefits are subtracted AFTER the min of expenses and dollar limit.
  const line5 = round2(Math.min(expenses, expenseLimit));
  const afterEmployerBenefits = round2(Math.max(0, line5 - rawEmployerBenefits));

  // Qualifying expenses cannot exceed earned income (or spouse's if MFJ)
  // For MFJ, limited to the lower earner's income
  // Student/disabled spouse: use deemed earned income if higher
  let effectiveSpouseEarned = spouseEarnedIncome ?? earnedIncome;
  if (deemedEarnedIncome !== undefined) {
    // Use deemed income as the spouse's earned income for the lower-earner test
    effectiveSpouseEarned = deemedEarnedIncome;
  }

  let earnedIncomeLimit = earnedIncome;
  if (filingStatus === FilingStatus.MarriedFilingJointly ||
      filingStatus === FilingStatus.QualifyingSurvivingSpouse ||
      (filingStatus === FilingStatus.MarriedFilingSeparately && livedApartFromSpouseMFS)) {
    earnedIncomeLimit = Math.min(earnedIncome, effectiveSpouseEarned);
  }

  const qualifyingExpenses = round2(Math.min(afterEmployerBenefits, earnedIncomeLimit));

  if (qualifyingExpenses <= 0) {
    return {
      ...zero,
      employerBenefitsExclusion,
      employerBenefitsTaxable,
      deemedEarnedIncome,
    };
  }

  // Credit rate: 35% minus 1% for each $2k over $15k AGI, floor of 20%
  const creditRate = calculateCreditRate(agi);

  const credit = round2(qualifyingExpenses * creditRate);

  return {
    qualifyingExpenses,
    creditRate,
    credit,
    employerBenefitsExclusion,
    employerBenefitsTaxable,
    deemedEarnedIncome,
  };
}

/**
 * Determine the credit percentage based on AGI.
 * Starts at 35% for AGI ≤ $15,000.
 * Decreases by 1% for each $2,000 (or fraction) over $15,000.
 * Floor of 20% (reached at AGI of $43,000+).
 */
function calculateCreditRate(agi: number): number {
  if (agi <= DEPENDENT_CARE.RATE_PHASE_OUT_START) {
    return DEPENDENT_CARE.MAX_RATE;
  }

  const excess = agi - DEPENDENT_CARE.RATE_PHASE_OUT_START;
  const reductionSteps = Math.ceil(excess / DEPENDENT_CARE.RATE_STEP_SIZE);
  const rate = DEPENDENT_CARE.MAX_RATE - (reductionSteps * DEPENDENT_CARE.RATE_STEP);

  return Math.max(DEPENDENT_CARE.MIN_RATE, rate);
}
