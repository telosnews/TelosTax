/**
 * Deduction/Credit Suggestion Service
 *
 * Pure function that analyzes a TaxReturn + CalculationResult and returns
 * proactive suggestions for credits and deductions the user likely qualifies
 * for but hasn't opted into.
 *
 * Inverts the warning system pattern: instead of "something looks wrong,"
 * this asks "what benefits might you be missing?"
 *
 * HOW TO ADD A NEW SUGGESTION:
 * 1. Add a detection block in getSuggestions() below
 * 2. Check that the discovery key is NOT already 'yes' (user opted in)
 *    and NOT 'no' (user explicitly declined)
 * 3. Push to the `suggestions` array with the correct discoveryKey and stepId
 * 4. The SuggestionsBanner component renders it with an "Enable" action
 */

import type { TaxReturn, CalculationResult } from '@telostax/engine';
import { FilingStatus } from '@telostax/engine';
import { getAgeAtEndOfYear } from '../utils/dateValidation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaxSuggestion {
  id: string;                // unique identifier
  type: 'credit' | 'deduction';
  title: string;             // e.g., "Child Tax Credit"
  description: string;       // why we think they qualify
  discoveryKey: string;      // incomeDiscovery key to enable
  stepId: string;            // wizard step to navigate to
  estimatedBenefit?: number; // estimated dollar amount if calculable
  confidence: 'high' | 'medium';
}

// ---------------------------------------------------------------------------
// Core service
// ---------------------------------------------------------------------------

/**
 * Compute proactive suggestions for unclaimed credits and deductions.
 * Pure function — no side effects, deterministic output.
 */
export function getSuggestions(
  taxReturn: TaxReturn,
  calculation?: CalculationResult | null,
): TaxSuggestion[] {
  const suggestions: TaxSuggestion[] = [];
  const discovery = taxReturn.incomeDiscovery as Record<string, string>;
  const deps = taxReturn.dependents || [];
  const fs = taxReturn.filingStatus;
  const isMFJ = fs === FilingStatus.MarriedFilingJointly || fs === FilingStatus.QualifyingSurvivingSpouse;
  const agi = calculation?.form1040?.agi;

  // Helper: only suggest if user hasn't already answered yes or explicitly said no
  const isUnclaimed = (key: string): boolean =>
    discovery[key] !== 'yes' && discovery[key] !== 'no';

  // ── CTC: qualifying children present but credit not selected ───────────
  if (isUnclaimed('child_credit') && deps.length > 0) {
    let qualifyingChildren = 0;
    let otherDeps = 0;
    for (const dep of deps) {
      const age = getAgeAtEndOfYear(dep.dateOfBirth, taxReturn.taxYear);
      if (age !== undefined && age < 17 && dep.monthsLivedWithYou >= 7) {
        qualifyingChildren++;
      } else {
        otherDeps++;
      }
    }
    if (qualifyingChildren > 0) {
      const estimated = qualifyingChildren * 2200 + otherDeps * 500;
      suggestions.push({
        id: 'ctc',
        type: 'credit',
        title: 'Child Tax Credit',
        description: `You have ${qualifyingChildren} qualifying ${qualifyingChildren === 1 ? 'child' : 'children'} under 17. You may be eligible for up to $${estimated.toLocaleString()}.`,
        discoveryKey: 'child_credit',
        stepId: 'child_tax_credit',
        estimatedBenefit: estimated,
        confidence: 'high',
      });
    } else if (otherDeps > 0) {
      suggestions.push({
        id: 'odc',
        type: 'credit',
        title: 'Other Dependent Credit',
        description: `You have ${otherDeps} ${otherDeps === 1 ? 'dependent' : 'dependents'} who may qualify for the $500 Other Dependent Credit.`,
        discoveryKey: 'child_credit',
        stepId: 'child_tax_credit',
        estimatedBenefit: otherDeps * 500,
        confidence: 'high',
      });
    }
  }

  // ── Dependent Care: young children + earned income ─────────────────────
  if (isUnclaimed('dependent_care') && deps.length > 0) {
    const hasYoungChildren = deps.some(dep => {
      const age = getAgeAtEndOfYear(dep.dateOfBirth, taxReturn.taxYear);
      return (age !== undefined && age < 13) || dep.isDisabled;
    });
    const hasEarnedIncome = (taxReturn.w2Income || []).length > 0 ||
      (taxReturn.income1099NEC || []).length > 0 ||
      (taxReturn.income1099K || []).length > 0;

    if (hasYoungChildren && hasEarnedIncome) {
      suggestions.push({
        id: 'dependent_care',
        type: 'credit',
        title: 'Child & Dependent Care Credit',
        description: 'You have dependents under 13 and earned income. If you paid for childcare so you could work, you may qualify for up to $2,100.',
        discoveryKey: 'dependent_care',
        stepId: 'dependent_care',
        confidence: 'medium',
      });
    }
  }

  // ── Elderly/Disabled: filer age 65+ from DOB ──────────────────────────
  if (isUnclaimed('elderly_disabled')) {
    const filerAge = getAgeAtEndOfYear(taxReturn.dateOfBirth, taxReturn.taxYear);
    const spouseAge = taxReturn.spouseDateOfBirth
      ? getAgeAtEndOfYear(taxReturn.spouseDateOfBirth, taxReturn.taxYear)
      : undefined;
    if ((filerAge !== undefined && filerAge >= 65) || (spouseAge !== undefined && spouseAge >= 65)) {
      suggestions.push({
        id: 'elderly_disabled',
        type: 'credit',
        title: 'Credit for the Elderly or Disabled',
        description: `${filerAge !== undefined && filerAge >= 65 ? 'You are' : 'Your spouse is'} 65 or older. You may qualify for a tax credit of up to $1,125 (Schedule R).`,
        discoveryKey: 'elderly_disabled',
        stepId: 'elderly_disabled',
        confidence: 'high',
      });
    }
  }

  // ── Saver's Credit: has IRA contribution + AGI below threshold ─────────
  if (isUnclaimed('savers_credit') && (taxReturn.iraContribution || 0) > 0 && agi != null) {
    const saversZero = isMFJ ? 73000 : (fs === FilingStatus.HeadOfHousehold ? 54750 : 36500);
    if (agi <= saversZero) {
      // Estimate: 10% rate at minimum (could be 20% or 50% depending on AGI)
      const rate = isMFJ
        ? (agi <= 47500 ? 0.50 : agi <= 51500 ? 0.20 : 0.10)
        : (fs === FilingStatus.HeadOfHousehold
          ? (agi <= 35625 ? 0.50 : agi <= 38625 ? 0.20 : 0.10)
          : (agi <= 23750 ? 0.50 : agi <= 25750 ? 0.20 : 0.10));
      const limit = isMFJ ? 4000 : 2000;
      const eligible = Math.min(taxReturn.iraContribution || 0, limit);
      const estimated = Math.round(eligible * rate);
      suggestions.push({
        id: 'savers_credit',
        type: 'credit',
        title: "Saver's Credit",
        description: `You contributed to a retirement account and your AGI ($${agi.toLocaleString()}) qualifies for a ${(rate * 100).toFixed(0)}% credit.`,
        discoveryKey: 'savers_credit',
        stepId: 'savers_credit',
        estimatedBenefit: estimated,
        confidence: 'high',
      });
    }
  }

  // ── Education Credits: college-age dependents ──────────────────────────
  if (isUnclaimed('education_credit') && deps.length > 0 && fs !== FilingStatus.MarriedFilingSeparately) {
    const collegeAge = deps.filter(dep => {
      const age = getAgeAtEndOfYear(dep.dateOfBirth, taxReturn.taxYear);
      return age !== undefined && age >= 17 && age <= 24;
    });
    if (collegeAge.length > 0) {
      suggestions.push({
        id: 'education_credit',
        type: 'credit',
        title: 'Education Credits',
        description: `You have ${collegeAge.length} ${collegeAge.length === 1 ? 'dependent' : 'dependents'} of college age (17-24). If you paid tuition, the AOTC provides up to $2,500 per student.`,
        discoveryKey: 'education_credit',
        stepId: 'education_credits',
        confidence: 'medium',
      });
    }
  }

  // ── Estimated Payments: SE tax owed but no payments selected ───────────
  if (isUnclaimed('ded_estimated_payments')) {
    const seTax = calculation?.scheduleSE?.totalSETax ?? 0;
    if (seTax > 0) {
      suggestions.push({
        id: 'estimated_payments',
        type: 'deduction',
        title: 'Estimated Tax Payments',
        description: `You owe $${seTax.toLocaleString()} in self-employment tax. If you made quarterly estimated payments, enter them to reduce your balance due.`,
        discoveryKey: 'ded_estimated_payments',
        stepId: 'estimated_payments',
        confidence: 'high',
      });
    }
  }

  // ── HSA: self-employed with no HSA deduction ──────────────────────────
  if (isUnclaimed('ded_hsa')) {
    const hasSelfEmployment = (taxReturn.income1099NEC || []).length > 0 ||
      (taxReturn.income1099K || []).length > 0;
    // Only suggest if SE and no HSA entered — many SE filers have HDHPs
    if (hasSelfEmployment && (taxReturn.hsaDeduction || 0) === 0) {
      suggestions.push({
        id: 'hsa',
        type: 'deduction',
        title: 'HSA Deduction',
        description: 'As a self-employed filer, if you have a high-deductible health plan, HSA contributions are tax-deductible (up to $4,300 individual / $8,550 family).',
        discoveryKey: 'ded_hsa',
        stepId: 'hsa_contributions',
        confidence: 'medium',
      });
    }
  }

  // ── Student Loan Interest: younger filer, no deduction claimed ─────────
  if (isUnclaimed('ded_student_loan') && (taxReturn.studentLoanInterest || 0) === 0) {
    const filerAge = getAgeAtEndOfYear(taxReturn.dateOfBirth, taxReturn.taxYear);
    const hasEarnedIncome = (taxReturn.w2Income || []).length > 0;
    // Suggest for working adults 22-45 (typical student loan repayment age)
    if (filerAge !== undefined && filerAge >= 22 && filerAge <= 45 && hasEarnedIncome && agi != null) {
      const phaseOutEnd = isMFJ ? 200000 : 100000;
      if (agi < phaseOutEnd) {
        suggestions.push({
          id: 'student_loan',
          type: 'deduction',
          title: 'Student Loan Interest',
          description: 'If you paid interest on student loans, you can deduct up to $2,500 — even without itemizing.',
          discoveryKey: 'ded_student_loan',
          stepId: 'student_loan_ded',
          confidence: 'medium',
        });
      }
    }
  }

  // ── W-2 Box 12 Code W: HSA employer contribution ──────────────────────
  // If any W-2 has code W in Box 12, the employer contributed to an HSA.
  // The user should enable the HSA section to report their own contributions.
  if (isUnclaimed('ded_hsa') && (taxReturn.hsaDeduction || 0) === 0) {
    const hasBox12W = (taxReturn.w2Income || []).some((w2: any) =>
      (w2.box12 || []).some((entry: any) => entry.code === 'W' && entry.amount > 0)
    );
    if (hasBox12W) {
      suggestions.push({
        id: 'hsa_box12w',
        type: 'deduction',
        title: 'HSA Contributions',
        description: 'Your W-2 shows employer HSA contributions (Box 12 code W). If you also made personal HSA contributions, enter them to claim the deduction.',
        discoveryKey: 'ded_hsa',
        stepId: 'hsa_contributions',
        confidence: 'high',
      });
    }
  }

  // ── Foreign Tax Credit: 1099-DIV with foreign tax paid ─────────────────
  if (isUnclaimed('foreign_tax_credit')) {
    const divForeignTax = (taxReturn.income1099DIV || []).reduce(
      (sum: number, d: any) => sum + (d.foreignTaxPaid || 0), 0
    );
    const k1ForeignTax = (taxReturn.incomeK1 || []).reduce(
      (sum: number, k: any) => sum + (k.box15ForeignTaxPaid || 0), 0
    );
    const totalForeignTax = divForeignTax + k1ForeignTax;
    if (totalForeignTax > 0) {
      suggestions.push({
        id: 'foreign_tax_credit',
        type: 'credit',
        title: 'Foreign Tax Credit',
        description: `You paid $${totalForeignTax.toLocaleString()} in foreign taxes. You can claim a credit to avoid double taxation.`,
        discoveryKey: 'foreign_tax_credit',
        stepId: 'foreign_tax_credit',
        estimatedBenefit: totalForeignTax,
        confidence: 'high',
      });
    }
  }

  // ── Itemized vs Standard: itemized would be higher ─────────────────────
  if (taxReturn.deductionMethod === 'standard' && calculation?.scheduleA) {
    const standardDed = calculation.form1040?.standardDeduction ?? 0;
    const itemizedTotal = calculation.scheduleA.totalItemized ?? 0;
    if (itemizedTotal > standardDed && standardDed > 0) {
      const savings = itemizedTotal - standardDed;
      suggestions.push({
        id: 'switch_to_itemized',
        type: 'deduction',
        title: 'Consider Itemizing',
        description: `Your itemized deductions ($${itemizedTotal.toLocaleString()}) exceed the standard deduction ($${standardDed.toLocaleString()}) by $${savings.toLocaleString()}. Switching could lower your tax.`,
        discoveryKey: 'ded_mortgage', // uses an existing key as trigger
        stepId: 'deduction_method',
        estimatedBenefit: savings,
        confidence: 'high',
      });
    }
  }

  // ── Mortgage entered, no SALT ──────────────────────────────────────────
  if (isUnclaimed('ded_property_tax') && discovery['ded_mortgage'] === 'yes') {
    const hasMortgage = (taxReturn.itemizedDeductions?.mortgageInterest || 0) > 0;
    if (hasMortgage) {
      suggestions.push({
        id: 'salt_with_mortgage',
        type: 'deduction',
        title: 'State & Local Taxes (SALT)',
        description: 'You have mortgage interest entered. Most homeowners also pay property tax, which is deductible as a SALT deduction (up to $40,000).',
        discoveryKey: 'ded_property_tax',
        stepId: 'salt_deduction',
        confidence: 'medium',
      });
    }
  }

  // ── W-2s from multiple states → multi-state filing ─────────────────────
  if ((taxReturn.stateReturns || []).length === 0) {
    const w2States = new Set<string>();
    for (const w2 of (taxReturn.w2Income || []) as any[]) {
      if (w2.state) w2States.add(w2.state);
    }
    if (w2States.size > 1) {
      suggestions.push({
        id: 'multi_state',
        type: 'deduction',
        title: 'Multi-State Filing',
        description: `Your W-2s show income from ${w2States.size} states (${[...w2States].join(', ')}). You may need to file state returns to claim refunds on taxes withheld.`,
        discoveryKey: 'ded_property_tax', // no specific discovery key — links to state overview
        stepId: 'state_overview',
        confidence: 'medium',
      });
    }
  }

  // ── 1099-R early distribution: Form 5329 exception ─────────────────────
  if (isUnclaimed('form5329')) {
    const hasEarlyDistribution = (taxReturn.income1099R || []).some(
      (r: any) => r.distributionCode === '1'
    );
    if (hasEarlyDistribution) {
      suggestions.push({
        id: 'form5329_early',
        type: 'deduction',
        title: 'Early Distribution Exception',
        description: 'You have a 1099-R with distribution code 1 (early distribution). If you qualify for an exception (disability, first home, etc.), you can avoid the 10% penalty.',
        discoveryKey: 'form5329',
        stepId: 'form5329',
        confidence: 'medium',
      });
    }
  }

  // ── Tips/Overtime income → OBBBA Schedule 1A ───────────────────────────
  if (isUnclaimed('schedule1a')) {
    // Check W-2 allocated tips (Box 8) or social security tips (Box 7) as signal
    const hasTips = (taxReturn.w2Income || []).some(
      (w2: any) => (w2.socialSecurityTips || 0) > 0 || (w2.allocatedTips || 0) > 0
    );
    const hasOvertimeSignal = (taxReturn.schedule1A?.qualifiedOvertimePay || 0) > 0;
    const hasTipSignal = (taxReturn.schedule1A?.qualifiedTips || 0) > 0;
    if (hasTips && !hasTipSignal) {
      suggestions.push({
        id: 'obbba_tips',
        type: 'deduction',
        title: 'No Tax on Tips (OBBBA)',
        description: 'Your W-2 shows tip income. Under the 2025 One Big Beautiful Bill Act, qualified tips may be tax-free (up to $25,000).',
        discoveryKey: 'schedule1a',
        stepId: 'schedule1a',
        confidence: 'high',
      });
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get suggestions filtered by type. */
export function getCreditSuggestions(suggestions: TaxSuggestion[]): TaxSuggestion[] {
  return suggestions.filter(s => s.type === 'credit');
}

/** Get suggestions filtered by type. */
export function getDeductionSuggestions(suggestions: TaxSuggestion[]): TaxSuggestion[] {
  return suggestions.filter(s => s.type === 'deduction');
}
