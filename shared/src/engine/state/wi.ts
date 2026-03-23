/**
 * Wisconsin State Tax Calculator — Tax Year 2025
 *
 * Calculates:
 *   1. WI income tax (4 progressive brackets)
 *   2. Sliding-scale standard deduction (phases out for high earners)
 *   3. Personal and dependent exemptions ($700 each)
 *   4. WI EITC (percentage of federal EITC by number of children)
 *
 * Starting point: Federal AGI -> WI modifications -> WI brackets
 *
 * Key WI differences from federal:
 *   - Non-linear sliding-scale standard deduction that phases to $0
 *   - Social Security benefits are fully exempt
 *   - WI EITC varies by number of qualifying children (4% / 11% / 34%)
 *   - No state EITC for childless filers
 */

import {
  TaxReturn, CalculationResult, StateCalculationResult,
  StateReturnConfig, FilingStatus, CalculationTrace,
} from '../../types/index.js';
import {
  WI_BRACKETS, WI_STANDARD_DEDUCTION, WI_PERSONAL_EXEMPTION,
  WI_DEPENDENT_EXEMPTION, WI_EITC_RATES,
  type WIStandardDeductionParams,
} from '../../constants/states/wi.js';
import { STATE_FORM_REFS } from '../../constants/states/stateFormRefs.js';
import { TraceBuilder } from '../traceBuilder.js';
import { applyBrackets, getStateWithholding, getStateFilingKey, getStateName } from './index.js';

// ─── WI Additions / Subtractions ────────────────────────────────

/**
 * WI additions to federal AGI (items WI taxes but federal doesn't).
 */
function getAdditions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let additions = 0;

  // Interest income from other states' municipal bonds
  // (not implemented — would require bond-level detail)

  // Capital gains excluded on federal return but taxable in WI
  // (not implemented — would require gain-level detail)

  return additions;
}

/**
 * WI subtractions from federal AGI (items federal taxes but WI doesn't).
 */
function getSubtractions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let subtractions = 0;

  // WI fully exempts Social Security benefits
  const ssaBenefits = federalResult.socialSecurity?.taxableBenefits || 0;
  if (ssaBenefits > 0) {
    subtractions += ssaBenefits;
  }

  // WI partially exempts certain retirement income (not implemented)
  // WI allows subtraction for certain capital gains on assets held 1+ years
  // (not implemented — Schedule WD)

  return subtractions;
}

// ─── WI Sliding-Scale Standard Deduction ────────────────────────

/**
 * Calculate Wisconsin's sliding-scale standard deduction.
 *
 * TY2025 (WI Act 15): continuous linear reduction per dollar of income
 * over the phaseout threshold. HoH has a two-stage phaseout with a
 * steeper rate below $57,210 that drops to a lower rate above.
 *
 * Formula:
 *   reduction = reductionRate * max(0, income - phaseoutStart)
 *   deduction = max(0, baseAmount - reduction)
 *
 * Source: WI DOR 2025 Form 1 instructions pp.35-37
 */
function calculateWIStandardDeduction(
  wiAGI: number,
  params: WIStandardDeductionParams,
): number {
  if (wiAGI <= params.phaseoutStart) {
    return params.baseAmount;
  }

  let reduction: number;

  if (params.stage2 && wiAGI > params.stage2.phaseoutStart) {
    // Two-stage phaseout: stage 1 up to stage2.phaseoutStart, then stage 2 rate
    const stage1Excess = params.stage2.phaseoutStart - params.phaseoutStart;
    const stage1Reduction = stage1Excess * params.reductionRate;
    const stage2Excess = wiAGI - params.stage2.phaseoutStart;
    const stage2Reduction = stage2Excess * params.stage2.reductionRate;
    reduction = stage1Reduction + stage2Reduction;
  } else {
    const excessIncome = wiAGI - params.phaseoutStart;
    reduction = excessIncome * params.reductionRate;
  }

  return Math.max(0, Math.round((params.baseAmount - reduction) * 100) / 100);
}

// ─── WI EITC ────────────────────────────────────────────────────

/**
 * Calculate Wisconsin Earned Income Tax Credit.
 *
 * WI EITC is a percentage of the federal EITC, varying by number of
 * qualifying children:
 *   - 0 children: no WI EITC
 *   - 1 child: 4% of federal EITC
 *   - 2 children: 11% of federal EITC
 *   - 3+ children: 34% of federal EITC
 *
 * The credit is fully refundable.
 */
function calculateWIEITC(
  federalEITC: number,
  qualifyingChildren: number,
): number {
  if (federalEITC <= 0 || qualifyingChildren <= 0) {
    return 0;
  }

  // Cap at 3 for rate lookup (3+ children all use the same 34% rate)
  const childKey = Math.min(qualifyingChildren, 3);
  const rate = WI_EITC_RATES[childKey] || 0;

  return Math.round(federalEITC * rate);
}

// ─── Main Calculator ────────────────────────────────────────────

export function calculateWisconsin(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
): StateCalculationResult {
  const f = federalResult.form1040;
  const filingKey = getStateFilingKey(taxReturn.filingStatus);
  const federalAGI = f.agi;
  const tb = new TraceBuilder();
  const refs = STATE_FORM_REFS['WI'];

  // ── Step 1: WI AGI ───────────────────────────
  const additions = getAdditions(taxReturn, federalResult);
  const subtractions = getSubtractions(taxReturn, federalResult);
  const wiAGI = tb.trace(
    'state.stateAGI', 'Wisconsin Adjusted Gross Income',
    Math.max(0, federalAGI + additions - subtractions), {
      authority: refs?.agiLine,
      formula: subtractions > 0 ? 'Federal AGI − Subtractions' : 'Federal AGI',
      inputs: [
        { lineId: 'form1040.line11', label: 'Federal AGI', value: federalAGI },
        ...(subtractions > 0 ? [{ lineId: 'state.subtractions', label: 'WI Subtractions (SS exemption)', value: subtractions }] : []),
      ],
    },
  );

  // ── Step 2: Sliding-Scale Standard Deduction ──
  const deductionParams = WI_STANDARD_DEDUCTION[filingKey] || WI_STANDARD_DEDUCTION['single'];
  const standardDeduction = calculateWIStandardDeduction(wiAGI, deductionParams);

  // WI itemized deductions — simplified, uses federal itemized as starting point
  let wiItemized = 0;
  if (taxReturn.deductionMethod === 'itemized' && federalResult.scheduleA) {
    const sa = federalResult.scheduleA;
    // WI has its own itemized deduction rules (Schedule 1).
    // Simplified: use federal itemized total as starting point.
    wiItemized = sa.totalItemized;
  }

  const deduction = Math.max(standardDeduction, wiItemized);

  // ── Step 3: Personal & Dependent Exemptions ───
  let exemptionCount = 1; // Taxpayer

  if (
    taxReturn.filingStatus === FilingStatus.MarriedFilingJointly ||
    taxReturn.filingStatus === FilingStatus.QualifyingSurvivingSpouse
  ) {
    exemptionCount += 1; // Spouse
  }

  const numDependents = taxReturn.dependents?.length || 0;
  const personalExemptions = exemptionCount * WI_PERSONAL_EXEMPTION;
  const dependentExemptions = numDependents * WI_DEPENDENT_EXEMPTION;
  const totalExemptions = personalExemptions + dependentExemptions;

  // ── Step 4: Taxable Income ───────────────────
  const taxableIncome = tb.trace(
    'state.taxableIncome', 'Wisconsin Taxable Income',
    Math.max(0, wiAGI - deduction - totalExemptions), {
      authority: refs?.taxableIncomeLine,
      formula: 'WI AGI − Deduction − Exemptions',
      inputs: [
        { lineId: 'state.stateAGI', label: 'WI AGI', value: wiAGI },
        ...(deduction > 0 ? [{ lineId: 'state.deduction', label: 'Deduction', value: deduction }] : []),
        ...(totalExemptions > 0 ? [{ lineId: 'state.exemptions', label: 'Exemptions', value: totalExemptions }] : []),
      ],
    },
  );

  // ── Step 5: WI Income Tax (brackets) ─────────
  const brackets = WI_BRACKETS[filingKey] || WI_BRACKETS['single'];
  const { tax: wiTax, details: bracketDetails } = applyBrackets(taxableIncome, brackets);

  const taxBeforeCredits = wiTax;

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
  tb.trace('state.incomeTax', 'Wisconsin Income Tax', wiTax, {
    authority: refs?.incomeTaxLine,
    formula: `Progressive brackets (WI)`,
    inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
    children: bracketTraceChildren.length > 0 ? bracketTraceChildren : undefined,
  });

  // ── Step 6: WI Credits ───────────────────────
  // WI EITC — refundable, based on federal EITC and number of qualifying children
  const federalEITC = federalResult.credits.eitcCredit || 0;

  // Count qualifying children from dependents
  // Use relationship field to identify children; fall back to total dependents
  // if no relationship data is available (conservative assumption).
  const childRelationships = ['child', 'stepchild', 'fosterChild', 'foster child', 'grandchild'];
  const childCount = (taxReturn.dependents || []).filter(
    (d) => childRelationships.includes(d.relationship?.toLowerCase() || ''),
  ).length;
  const qualifyingChildren = childCount > 0 ? childCount : numDependents;

  const wiEITC = calculateWIEITC(federalEITC, qualifyingChildren);

  // Nonrefundable credits: none implemented beyond base tax calculation
  const nonrefundableCredits = 0;
  const refundableCredits = wiEITC;

  const wiEITCRate = qualifyingChildren > 0 ? (WI_EITC_RATES[Math.min(qualifyingChildren, 3)] || 0) : 0;
  const creditChildren: CalculationTrace[] = [];
  if (wiEITC > 0) {
    creditChildren.push({
      lineId: 'state.credits.wiEITC', label: `WI EITC (${(wiEITCRate * 100).toFixed(0)}% of federal)`, value: wiEITC,
      formula: `${federalEITC.toLocaleString()} × ${(wiEITCRate * 100).toFixed(0)}%`,
      inputs: [{ lineId: 'federal.eitc', label: 'Federal EITC', value: federalEITC }],
    });
  }
  const totalCredits = tb.trace(
    'state.credits', 'Wisconsin Credits',
    nonrefundableCredits + refundableCredits, {
      formula: wiEITC > 0 ? 'WI EITC (refundable)' : 'No credits',
      inputs: [
        ...(wiEITC > 0 ? [{ lineId: 'state.credits.wiEITC', label: 'WI EITC', value: wiEITC }] : []),
      ],
      children: creditChildren.length > 0 ? creditChildren : undefined,
    },
  );

  // Apply nonrefundable credits first (cannot reduce below zero)
  const taxAfterNonrefundable = Math.max(0, taxBeforeCredits - nonrefundableCredits);

  // WI EITC is refundable — reduces tax and excess generates a refund
  const refundableUsedAgainstTax = Math.min(taxAfterNonrefundable, refundableCredits);
  const refundableExcess = refundableCredits - refundableUsedAgainstTax;

  // ── Step 7: Total & Payments ─────────────────
  // WI has no separate local income tax
  const localTax = 0;
  const totalStateTax = tb.trace(
    'state.totalTax', 'Wisconsin Total Tax',
    Math.max(0, taxAfterNonrefundable - refundableUsedAgainstTax), {
      authority: refs?.totalTaxLine,
      formula: totalCredits > 0 ? 'Income Tax − Credits' : 'Income Tax',
      inputs: [
        { lineId: 'state.incomeTax', label: 'Income Tax', value: wiTax },
        ...(totalCredits > 0 ? [{ lineId: 'state.credits', label: 'Credits', value: totalCredits }] : []),
      ],
    },
  );

  const stateWithholding = getStateWithholding(taxReturn, 'WI');
  const estimatedPayments = 0; // Could be extended later
  const totalPayments = stateWithholding + estimatedPayments;
  const refundOrOwedRaw = totalPayments - totalStateTax + refundableExcess;
  const refundOrOwed = tb.trace(
    'state.refundOrOwed',
    refundOrOwedRaw >= 0 ? 'Wisconsin Refund' : 'Wisconsin Amount Owed',
    refundOrOwedRaw, {
      authority: refs?.refundLine,
      formula: refundableExcess > 0
        ? 'Withholding − Total Tax + Refundable EITC Excess'
        : 'Withholding − Total Tax',
      inputs: [
        { lineId: 'state.totalTax', label: 'Total State Tax', value: totalStateTax },
        ...(stateWithholding > 0 ? [{ lineId: 'state.withholding', label: 'Withholding', value: stateWithholding }] : []),
        ...(refundableExcess > 0 ? [{ lineId: 'state.refundableExcess', label: 'Refundable EITC Excess', value: refundableExcess }] : []),
      ],
    },
  );

  const effectiveRate = federalAGI > 0
    ? Math.round((totalStateTax / federalAGI) * 10000) / 10000
    : 0;

  return {
    stateCode: 'WI',
    stateName: getStateName('WI'),
    residencyType: config.residencyType,
    federalAGI,
    stateAdditions: additions,
    stateSubtractions: subtractions,
    stateAGI: wiAGI,
    stateDeduction: deduction,
    stateTaxableIncome: taxableIncome,
    stateExemptions: totalExemptions,
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
      standardDeductionBeforeItemized: standardDeduction,
      personalExemptions,
      dependentExemptions,
      wiTaxBeforeCredits: wiTax,
      wiEITC,
      wiEITCRate,
      qualifyingChildren,
    },
    traces: tb.build(),
  };
}
