/**
 * Hawaii State Tax Calculator — Tax Year 2025
 *
 * Calculates:
 *   1. HI income tax (12 progressive brackets — most in the US, top rate 11%)
 *   2. Personal exemptions ($1,144 per person)
 *   3. Food/excise tax credit ($110 per exemption, refundable)
 *   4. Hawaii EITC (20% of federal EITC, refundable)
 *
 * Starting point: Federal AGI → HI modifications → HI brackets
 *
 * Key Hawaii differences from federal:
 *   - 12 brackets (most of any state), filing-status-specific
 *   - Social Security benefits fully exempt
 *   - Refundable food/excise tax credit for all residents
 *   - State EITC: 20% of federal EITC (refundable)
 */

import {
  TaxReturn, CalculationResult, StateCalculationResult,
  StateReturnConfig, FilingStatus, CalculationTrace,
} from '../../types/index.js';
import {
  HI_BRACKETS, HI_STANDARD_DEDUCTION,
  HI_PERSONAL_EXEMPTION, HI_DEPENDENT_EXEMPTION,
  HI_FOOD_CREDIT_SINGLE, HI_FOOD_CREDIT_OTHER,
  HI_EITC_MATCH_RATE,
  type HIFoodCreditTier,
} from '../../constants/states/hi.js';
import { STATE_FORM_REFS } from '../../constants/states/stateFormRefs.js';
import { TraceBuilder } from '../traceBuilder.js';
import { applyBrackets, getStateWithholding, getStateFilingKey, getStateName } from './index.js';

// ─── HI Additions / Subtractions ────────────────────────────────

/**
 * HI additions to federal AGI (items HI taxes but federal doesn't).
 */
function getAdditions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let additions = 0;

  // Interest income from other states' municipal bonds
  // (not implemented — would require bond-level detail)

  // Non-HI state/local tax refunds (if deducted in prior year)
  // (not implemented — would require prior year detail)

  return additions;
}

/**
 * HI subtractions from federal AGI (items federal taxes but HI doesn't).
 */
function getSubtractions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let subtractions = 0;

  // Hawaii fully exempts Social Security benefits (HRS §235-7(a)(3))
  const ssaBenefits = federalResult.socialSecurity?.taxableBenefits || 0;
  if (ssaBenefits > 0) {
    subtractions += ssaBenefits;
  }

  // Hawaii exempts employer contributions to pension plans
  // (not implemented — would require pension detail)

  // Hawaii exempts military reserve pay (limited)
  // (not implemented — would require military income detail)

  return subtractions;
}

// ─── HI Credits ─────────────────────────────────────────────────

/**
 * Food/Excise Tax Credit — HRS §235-55.85, HB 2404
 *
 * A refundable credit per qualified exemption, phased down by federal AGI.
 * Single filers phase out at $40K; all others at $60K.
 * Designed to offset the regressive impact of Hawaii's general excise tax.
 *
 * Source: 2025 Form N-311 instructions
 */
function calculateFoodExciseCredit(
  exemptionCount: number,
  federalAGI: number,
  tiers: HIFoodCreditTier[],
): number {
  for (const tier of tiers) {
    if (federalAGI < tier.maxAGI) {
      return exemptionCount * tier.credit;
    }
  }
  return 0; // AGI exceeds all tiers — not eligible
}

/**
 * Hawaii EITC — HRS §235-110.91
 *
 * Hawaii's earned income tax credit is 20% of the federal EITC.
 * Fully refundable — excess credit is paid as a refund.
 */
function calculateHawaiiEITC(federalEITC: number): number {
  if (federalEITC <= 0) return 0;
  return Math.round(federalEITC * HI_EITC_MATCH_RATE);
}

// ─── Main Calculator ────────────────────────────────────────────

export function calculateHawaii(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
): StateCalculationResult {
  const f = federalResult.form1040;
  const filingKey = getStateFilingKey(taxReturn.filingStatus);
  const federalAGI = f.agi;
  const tb = new TraceBuilder();
  const refs = STATE_FORM_REFS['HI'];

  // ── Step 1: HI AGI ───────────────────────────
  const additions = getAdditions(taxReturn, federalResult);
  const subtractions = getSubtractions(taxReturn, federalResult);
  const hiAGI = tb.trace(
    'state.stateAGI', 'Hawaii Adjusted Gross Income',
    Math.max(0, federalAGI + additions - subtractions), {
      authority: refs?.agiLine,
      formula: subtractions > 0 ? 'Federal AGI − Subtractions' : 'Federal AGI',
      inputs: [
        { lineId: 'form1040.line11', label: 'Federal AGI', value: federalAGI },
        ...(subtractions > 0 ? [{ lineId: 'state.subtractions', label: 'HI Subtractions (SS exemption)', value: subtractions }] : []),
      ],
    },
  );

  // ── Step 2: Deductions ───────────────────────
  const standardDeduction = HI_STANDARD_DEDUCTION[filingKey] || 2200;

  // HI itemized deductions start from federal itemized amount
  // HI has its own itemized rules (e.g., no deduction for HI taxes paid)
  let hiItemized = 0;
  if (taxReturn.deductionMethod === 'itemized' && federalResult.scheduleA) {
    const sa = federalResult.scheduleA;
    // Simplified: use federal itemized total as starting point.
    // Full implementation would recalculate HI-specific itemized
    // deductions on Schedule A (Form N-11).
    hiItemized = sa.totalItemized;
  }

  const deduction = Math.max(standardDeduction, hiItemized);

  // ── Step 3: Personal Exemptions ───────────────
  // $1,144 per exemption: taxpayer, spouse (if MFJ/QSS), each dependent
  let exemptionCount = 1;

  if (
    taxReturn.filingStatus === FilingStatus.MarriedFilingJointly ||
    taxReturn.filingStatus === FilingStatus.QualifyingSurvivingSpouse
  ) {
    exemptionCount += 1;
  }

  const numDependents = taxReturn.dependents?.length || 0;
  exemptionCount += numDependents;

  const personalExemptions = exemptionCount * HI_PERSONAL_EXEMPTION;

  // ── Step 4: Taxable Income ───────────────────
  const taxableIncome = tb.trace(
    'state.taxableIncome', 'Hawaii Taxable Income',
    Math.max(0, hiAGI - deduction - personalExemptions), {
      authority: refs?.taxableIncomeLine,
      formula: 'HI AGI − Deduction − Exemptions',
      inputs: [
        { lineId: 'state.stateAGI', label: 'HI AGI', value: hiAGI },
        ...(deduction > 0 ? [{ lineId: 'state.deduction', label: 'Deduction', value: deduction }] : []),
        ...(personalExemptions > 0 ? [{ lineId: 'state.exemptions', label: 'Personal Exemptions', value: personalExemptions }] : []),
      ],
    },
  );

  // ── Step 5: HI Income Tax (12 brackets) ──────
  const brackets = HI_BRACKETS[filingKey] || HI_BRACKETS['single'];
  const { tax: hiTax, details: bracketDetails } = applyBrackets(taxableIncome, brackets);

  const taxBeforeCredits = hiTax;

  // ── Trace: Income Tax with bracket children ──
  const bracketTraceChildren: CalculationTrace[] = bracketDetails
    .filter(b => b.taxAtRate > 0)
    .map(b => ({
      lineId: `state.bracket.${(b.rate * 100).toFixed(2)}pct`,
      label: `${(b.rate * 100).toFixed(2)}% bracket`,
      value: b.taxAtRate,
      formula: `${b.taxableAtRate.toLocaleString()} × ${(b.rate * 100).toFixed(2)}%`,
      inputs: [{ lineId: 'state.bracket.taxableAtRate', label: `Income at ${(b.rate * 100).toFixed(2)}%`, value: b.taxableAtRate }],
    }));
  tb.trace('state.incomeTax', 'Hawaii Income Tax', hiTax, {
    authority: refs?.incomeTaxLine,
    formula: `Progressive brackets (HI)`,
    inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
    children: bracketTraceChildren.length > 0 ? bracketTraceChildren : undefined,
  });

  // ── Step 6: HI Credits ───────────────────────
  const federalEITC = federalResult.credits.eitcCredit || 0;
  const foodCreditTiers = filingKey === 'single' ? HI_FOOD_CREDIT_SINGLE : HI_FOOD_CREDIT_OTHER;
  const foodExciseCredit = calculateFoodExciseCredit(exemptionCount, federalAGI, foodCreditTiers);
  const hawaiiEITC = calculateHawaiiEITC(federalEITC);

  // Food/excise credit and HI EITC are both refundable
  const nonrefundableCredits = 0;
  const refundableCredits = foodExciseCredit + hawaiiEITC;

  const creditChildren: CalculationTrace[] = [];
  if (foodExciseCredit > 0) {
    creditChildren.push({
      lineId: 'state.credits.foodExcise', label: 'Food/Excise Tax Credit', value: foodExciseCredit,
      formula: `${exemptionCount} exemption(s) × per-person credit`,
      inputs: [{ lineId: 'state.exemptionCount', label: 'Exemption Count', value: exemptionCount }],
    });
  }
  if (hawaiiEITC > 0) {
    creditChildren.push({
      lineId: 'state.credits.hiEITC', label: 'HI EITC (20% of federal)', value: hawaiiEITC,
      formula: `${federalEITC.toLocaleString()} × 20%`,
      inputs: [{ lineId: 'federal.eitc', label: 'Federal EITC', value: federalEITC }],
    });
  }
  const totalCredits = tb.trace(
    'state.credits', 'Hawaii Credits',
    nonrefundableCredits + refundableCredits, {
      formula: creditChildren.length > 0
        ? creditChildren.map(c => c.label).join(' + ')
        : 'No credits',
      inputs: [
        ...(foodExciseCredit > 0 ? [{ lineId: 'state.credits.foodExcise', label: 'Food/Excise Credit', value: foodExciseCredit }] : []),
        ...(hawaiiEITC > 0 ? [{ lineId: 'state.credits.hiEITC', label: 'HI EITC', value: hawaiiEITC }] : []),
      ],
      children: creditChildren.length > 0 ? creditChildren : undefined,
    },
  );

  // Apply nonrefundable credits first (none in HI's case)
  const taxAfterNonrefundable = Math.max(0, taxBeforeCredits - nonrefundableCredits);
  // Refundable credits reduce tax and excess generates a refund
  const refundableUsedAgainstTax = Math.min(taxAfterNonrefundable, refundableCredits);
  const refundableExcess = refundableCredits - refundableUsedAgainstTax;

  // ── Step 7: Total & Payments ─────────────────
  // HI has no separate local income tax
  const localTax = 0;
  const totalStateTax = tb.trace(
    'state.totalTax', 'Hawaii Total Tax',
    Math.max(0, taxAfterNonrefundable - refundableUsedAgainstTax), {
      authority: refs?.totalTaxLine,
      formula: totalCredits > 0 ? 'Income Tax − Credits' : 'Income Tax',
      inputs: [
        { lineId: 'state.incomeTax', label: 'Income Tax', value: hiTax },
        ...(totalCredits > 0 ? [{ lineId: 'state.credits', label: 'Credits', value: totalCredits }] : []),
      ],
    },
  );

  const stateWithholding = getStateWithholding(taxReturn, 'HI');
  const estimatedPayments = 0; // Could be extended later
  const totalPayments = stateWithholding + estimatedPayments;
  const refundOrOwedRaw = totalPayments - totalStateTax + refundableExcess;
  const refundOrOwed = tb.trace(
    'state.refundOrOwed',
    refundOrOwedRaw >= 0 ? 'Hawaii Refund' : 'Hawaii Amount Owed',
    refundOrOwedRaw, {
      authority: refs?.refundLine,
      formula: refundableExcess > 0
        ? 'Withholding − Total Tax + Refundable Credit Excess'
        : 'Withholding − Total Tax',
      inputs: [
        { lineId: 'state.totalTax', label: 'Total State Tax', value: totalStateTax },
        ...(stateWithholding > 0 ? [{ lineId: 'state.withholding', label: 'Withholding', value: stateWithholding }] : []),
        ...(refundableExcess > 0 ? [{ lineId: 'state.refundableExcess', label: 'Refundable Credit Excess', value: refundableExcess }] : []),
      ],
    },
  );

  const effectiveRate = federalAGI > 0
    ? Math.round((totalStateTax / federalAGI) * 10000) / 10000
    : 0;

  return {
    stateCode: 'HI',
    stateName: getStateName('HI'),
    residencyType: config.residencyType,
    federalAGI,
    stateAdditions: additions,
    stateSubtractions: subtractions,
    stateAGI: hiAGI,
    stateDeduction: deduction,
    stateTaxableIncome: taxableIncome,
    stateExemptions: personalExemptions,
    stateIncomeTax: taxBeforeCredits,
    stateCredits: totalCredits,
    stateTaxAfterCredits: taxAfterNonrefundable,
    localTax,
    totalStateTax,
    stateWithholding,
    stateEstimatedPayments: estimatedPayments,
    stateRefundOrOwed: refundOrOwed,
    effectiveStateRate: effectiveRate,
    bracketDetails,
    additionalLines: {
      hiTaxBeforeCredits: hiTax,
      personalExemptions,
      exemptionCount,
      foodExciseCredit,
      hawaiiEITC,
      taxBeforeCredits,
    },
    traces: tb.build(),
  };
}
