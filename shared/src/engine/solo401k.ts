import { SOLO_401K, SEP_IRA } from '../constants/tax2025.js';
import { Solo401kInput, Solo401kResult, SEPIRAInput, SEPIRAResult } from '../types/index.js';
import { round2 } from './utils.js';

/**
 * Calculate Solo 401(k) contribution limits and applied amounts.
 *
 * @authority
 *   IRC §402(g) — Elective deferral limit ($23,500 for 2025)
 *   IRC §414(v)(2)(B) — Catch-up contributions (age 50+, $7,500)
 *   IRC §414(v)(2)(E) — Super catch-up (ages 60-63, $11,250, SECURE 2.0)
 *   IRC §415(c) — Annual additions limit ($70,000 for 2025)
 *   IRC §401(d)(1) — SE individuals treated as employee+employer
 *   IRS Publication 560 — Rate table for self-employed
 *
 * @scope Self-employed individuals (sole proprietors, single-member LLCs).
 * @limitations Does not handle:
 *   - Multiple businesses each with Solo 401(k) plans
 *   - Controlled group / common ownership aggregation (IRC §414(b)-(c))
 */
export function calculateSolo401kLimits(input: Solo401kInput): Solo401kResult {
  const warnings: string[] = [];

  // ─── Step 1: Adjusted Net SE Income ───────────────────
  // For self-employed: net profit (Schedule C) minus deductible half of SE tax
  // This is the "compensation" used for employer contribution calculations
  const adjustedNetSEIncome = round2(Math.max(0, input.scheduleCNetProfit - input.seDeductibleHalf));

  // ─── Step 2: Maximum Employee Deferral ────────────────
  // Base limit: $23,500 for 2025
  // Reduced by any W-2 401(k)/403(b) salary deferrals (all §402(g) plans share one limit)
  const w2Deferrals = input.w2SalaryDeferrals || 0;
  const baseDeferralLimit = SOLO_401K.EMPLOYEE_DEFERRAL_LIMIT;

  // Catch-up contribution eligibility
  let catchUpAmount = 0;
  let catchUpEligible = false;
  let superCatchUpEligible = false;

  if (input.age !== undefined) {
    if (input.age >= 60 && input.age <= 63) {
      // SECURE 2.0 super catch-up: ages 60-63 get $11,250 instead of $7,500
      superCatchUpEligible = true;
      catchUpEligible = true;
      catchUpAmount = SOLO_401K.SUPER_CATCH_UP_60_63;
    } else if (input.age >= 50) {
      catchUpEligible = true;
      catchUpAmount = SOLO_401K.CATCH_UP_50_PLUS;
    }
  }

  // Maximum employee deferral = remaining base + remaining catch-up
  // W-2 salary deferrals AND self-employed SIMPLE IRA deferrals reduce the §402(g) limit.
  // Any deferrals exceeding the base limit are treated as catch-up contributions
  // already used (§414(v)(3) — catch-up is a per-person limit across all plans).
  const simpleIraDeferrals = input.simpleIraDeferrals || 0;
  const totalPriorDeferrals = w2Deferrals + simpleIraDeferrals;
  const usedBaseDeferral = Math.min(totalPriorDeferrals, baseDeferralLimit);
  const usedCatchUp = Math.min(Math.max(0, totalPriorDeferrals - baseDeferralLimit), catchUpAmount);
  const remainingDeferralLimit = round2(Math.max(0, baseDeferralLimit - usedBaseDeferral));
  const remainingCatchUp = round2(Math.max(0, catchUpAmount - usedCatchUp));
  const maxEmployeeDeferral = round2(remainingDeferralLimit + remainingCatchUp);

  const deferralSources: string[] = [];
  if (w2Deferrals > 0) deferralSources.push(`W-2 deferrals ($${w2Deferrals.toLocaleString()})`);
  if (simpleIraDeferrals > 0) deferralSources.push(`SIMPLE IRA deferrals ($${simpleIraDeferrals.toLocaleString()})`);
  const deferralSourceDesc = deferralSources.join(' and ');

  if (totalPriorDeferrals > 0 && totalPriorDeferrals >= baseDeferralLimit + catchUpAmount) {
    warnings.push(
      `Your ${deferralSourceDesc} already meet or exceed the ` +
      `$${baseDeferralLimit.toLocaleString()} elective deferral limit` +
      (catchUpAmount > 0 ? ` plus $${catchUpAmount.toLocaleString()} catch-up` : '') +
      `. No additional employee deferrals are available for your Solo 401(k).`
    );
  } else if (totalPriorDeferrals > 0 && totalPriorDeferrals >= baseDeferralLimit) {
    warnings.push(
      `Your ${deferralSourceDesc} exceed the ` +
      `$${baseDeferralLimit.toLocaleString()} base deferral limit. ` +
      `Remaining catch-up available for Solo 401(k): $${remainingCatchUp.toLocaleString()}.`
    );
  } else if (totalPriorDeferrals > 0) {
    warnings.push(
      `${deferralSourceDesc} reduce your remaining Solo 401(k) ` +
      `employee deferral limit to $${remainingDeferralLimit.toLocaleString()}` +
      (catchUpAmount > 0 ? ` (plus $${catchUpAmount.toLocaleString()} catch-up).` : '.')
    );
  }

  // ─── Step 3: Maximum Employer Contribution ────────────
  // Self-employed use 20% effective rate (25% / 1.25), per IRS Pub 560 rate table
  // This accounts for the circular calculation where the contribution itself reduces compensation
  // Cap at compensation limit ($350k for 2025)
  const cappedIncome = Math.min(adjustedNetSEIncome, SOLO_401K.COMPENSATION_CAP);
  const maxEmployerContribution = round2(cappedIncome * SOLO_401K.SE_EFFECTIVE_RATE);

  if (adjustedNetSEIncome <= 0) {
    warnings.push(
      'Your adjusted net self-employment income is $0 or negative. No Solo 401(k) contributions are allowed.'
    );
  }

  // ─── Step 4: Annual Addition Limit ────────────────────
  // IRC §415(c): Total of employee deferral + employer contribution cannot exceed $70,000
  // Catch-up contributions are NOT counted toward the §415(c) limit
  const annualAdditionLimit = SOLO_401K.ANNUAL_ADDITION_LIMIT;
  const maxTotalContribution = round2(Math.min(annualAdditionLimit, adjustedNetSEIncome) + catchUpAmount);

  // ─── Step 5: Apply User's Desired Amounts ─────────────
  // Cap employee deferral at the calculated maximum
  let appliedEmployeeDeferral = round2(Math.min(
    Math.max(0, input.employeeDeferral || 0),
    maxEmployeeDeferral,
  ));

  // Employee deferral also can't exceed adjusted net SE income
  appliedEmployeeDeferral = round2(Math.min(appliedEmployeeDeferral, Math.max(0, adjustedNetSEIncome)));

  if ((input.employeeDeferral || 0) > maxEmployeeDeferral) {
    warnings.push(
      `Employee deferral capped from $${(input.employeeDeferral || 0).toLocaleString()} ` +
      `to $${maxEmployeeDeferral.toLocaleString()} (§402(g) limit` +
      (w2Deferrals > 0 ? ', reduced by W-2 deferrals' : '') + ').'
    );
  }

  // Cap employer contribution at the calculated maximum
  let appliedEmployerContribution = round2(Math.min(
    Math.max(0, input.employerContribution || 0),
    maxEmployerContribution,
  ));

  if ((input.employerContribution || 0) > maxEmployerContribution) {
    warnings.push(
      `Employer contribution capped from $${(input.employerContribution || 0).toLocaleString()} ` +
      `to $${maxEmployerContribution.toLocaleString()} ` +
      `(20% of adjusted net SE income of $${adjustedNetSEIncome.toLocaleString()}).`
    );
  }

  // ─── Step 6: Enforce Annual Addition Limit ────────────
  // IRC §415(c)(1): Annual additions ≤ lesser of $70,000 or 100% of compensation
  // For the §415(c) test, separate catch-up from the base deferral
  // (catch-up contributions are NOT counted toward the §415(c) limit)
  const baseDeferralPortion = round2(Math.min(appliedEmployeeDeferral, remainingDeferralLimit));
  const catchUpPortion = round2(appliedEmployeeDeferral - baseDeferralPortion);
  const combinedWithoutCatchUp = round2(baseDeferralPortion + appliedEmployerContribution);

  // §415(c)(1)(B): 100% of compensation — for self-employed, compensation = adjusted net SE income
  // If SEP-IRA contributions exist for the same business, they reduce the available §415(c) room
  const sepContributions = input.sepIraContributions || 0;
  const effectiveAnnualLimit = round2(Math.max(0, Math.min(annualAdditionLimit, adjustedNetSEIncome) - sepContributions));

  if (sepContributions > 0 && combinedWithoutCatchUp > effectiveAnnualLimit) {
    warnings.push(
      `SEP-IRA contributions of $${sepContributions.toLocaleString()} from the same business ` +
      `reduce your available §415(c) room for Solo 401(k) to $${effectiveAnnualLimit.toLocaleString()}.`
    );
  }

  if (combinedWithoutCatchUp > effectiveAnnualLimit) {
    // Need to reduce — reduce employer first, then employee base
    const excess = round2(combinedWithoutCatchUp - effectiveAnnualLimit);
    const employerReduction = round2(Math.min(excess, appliedEmployerContribution));
    appliedEmployerContribution = round2(appliedEmployerContribution - employerReduction);
    const remainingExcess = round2(excess - employerReduction);
    if (remainingExcess > 0) {
      appliedEmployeeDeferral = round2(Math.max(0, appliedEmployeeDeferral - remainingExcess));
    }

    if (adjustedNetSEIncome < annualAdditionLimit) {
      warnings.push(
        `Total contributions (excluding catch-up) reduced to $${effectiveAnnualLimit.toLocaleString()} ` +
        `— limited by 100% of your adjusted net SE income (IRC §415(c)(1)(B)).`
      );
    } else {
      warnings.push(
        `Total contributions (excluding catch-up) reduced to stay within the ` +
        `$${annualAdditionLimit.toLocaleString()} annual addition limit (IRC §415(c)).`
      );
    }
  }

  const totalContribution = round2(appliedEmployeeDeferral + appliedEmployerContribution);

  // Roth deferral: portion of applied employee deferral designated as Roth (capped to applied deferral)
  const appliedRothDeferral = round2(Math.min(Math.max(0, input.rothDeferral || 0), appliedEmployeeDeferral));
  // Deductible amount: total contribution minus Roth deferral (Roth is after-tax, not deductible)
  const deductibleContribution = round2(totalContribution - appliedRothDeferral);
  // Form 5500-EZ is required when plan assets exceed $250,000 at end of year
  const form5500EZRequired = false; // Determined by caller based on plan balance data

  return {
    adjustedNetSEIncome,
    maxEmployeeDeferral,
    maxEmployerContribution,
    maxTotalContribution,
    appliedEmployeeDeferral,
    appliedEmployerContribution,
    appliedRothDeferral,
    deductibleContribution,
    totalContribution,
    catchUpEligible,
    superCatchUpEligible,
    catchUpAmount,
    form5500EZRequired,
    warnings,
  };
}

/**
 * Calculate SEP-IRA contribution limits.
 *
 * @authority
 *   IRC §408(k) — Simplified Employee Pension requirements
 *   IRC §404(h)(1)(C) — 25% of compensation limit
 *   IRC §402(h)(2) — Contribution cap ($70,000 for 2025)
 *   IRC §401(a)(17) — Compensation cap ($350,000 for 2025)
 *   IRS Publication 560 — Self-employed rate table (20% effective rate)
 *
 * @scope Self-employed individuals using SEP-IRA.
 * @limitations Does not handle employees of the self-employed person.
 */
export function calculateSEPIRALimits(input: SEPIRAInput): SEPIRAResult {
  const warnings: string[] = [];

  // Adjusted net SE income: net profit minus deductible half of SE tax
  const adjustedNetSEIncome = round2(Math.max(0, input.scheduleCNetProfit - input.seDeductibleHalf));

  // Cap compensation at $350,000
  const cappedIncome = Math.min(adjustedNetSEIncome, SEP_IRA.COMPENSATION_CAP);

  // Self-employed effective rate: 20% (25% / 1.25)
  const maxContribution = round2(Math.min(
    cappedIncome * SEP_IRA.SE_EFFECTIVE_RATE,
    SEP_IRA.MAX_CONTRIBUTION,
  ));

  // Apply user's desired contribution
  const desiredContribution = Math.max(0, input.desiredContribution || 0);
  const appliedContribution = round2(Math.min(desiredContribution, maxContribution));

  if (desiredContribution > maxContribution && desiredContribution > 0) {
    warnings.push(
      `SEP-IRA contribution capped from $${desiredContribution.toLocaleString()} ` +
      `to $${maxContribution.toLocaleString()} ` +
      `(20% of adjusted net SE income of $${adjustedNetSEIncome.toLocaleString()}, ` +
      `capped at $${SEP_IRA.MAX_CONTRIBUTION.toLocaleString()}).`
    );
  }

  if (adjustedNetSEIncome <= 0) {
    warnings.push('Your adjusted net self-employment income is $0 or negative. No SEP-IRA contributions are allowed.');
  }

  return {
    adjustedNetSEIncome,
    maxContribution,
    appliedContribution,
    warnings,
  };
}
