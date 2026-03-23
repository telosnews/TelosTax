/**
 * Alabama State Tax Calculator --- Tax Year 2025
 *
 * Calculates:
 *   1. AL income tax (3 progressive brackets, same for all filing statuses)
 *   2. Standard deduction and personal/dependent exemptions
 *   3. Federal income tax deduction (UNIQUE to Alabama)
 *
 * Starting point: Federal AGI -> AL modifications -> AL brackets
 *
 * Key Alabama differences from most states:
 *   - FEDERAL TAX DEDUCTION: Alabama allows taxpayers to deduct federal
 *     income tax actually paid (after credits) from their Alabama taxable
 *     income. This is Alabama's most distinctive feature and creates a
 *     circular dependency that is resolved by using the federal return's
 *     final totalTax as the deduction amount.
 *   - Social Security benefits are fully exempt
 *   - Same bracket schedule for all filing statuses (2% / 4% / 5%)
 *   - No state EITC
 */

import {
  TaxReturn, CalculationResult, StateCalculationResult,
  StateReturnConfig, FilingStatus, CalculationTrace,
} from '../../types/index.js';
import {
  AL_BRACKETS, AL_STANDARD_DEDUCTION,
  AL_PERSONAL_EXEMPTION, AL_DEPENDENT_EXEMPTION_TIERS, AL_DEPENDENT_EXEMPTION_FLOOR,
  type ALStandardDeductionParams,
} from '../../constants/states/al.js';
import { STATE_FORM_REFS } from '../../constants/states/stateFormRefs.js';
import { TraceBuilder } from '../traceBuilder.js';
import { applyBrackets, getStateWithholding, getStateFilingKey, getStateName } from './index.js';

// --- AL Additions / Subtractions --------------------------------------------

/**
 * AL additions to federal AGI (items AL taxes but federal doesn't).
 */
function getAdditions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let additions = 0;

  // Interest income from other states' municipal bonds
  // (not implemented --- would require bond-level detail)

  return additions;
}

/**
 * AL subtractions from federal AGI (items federal taxes but AL doesn't).
 */
function getSubtractions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let subtractions = 0;

  // Alabama fully exempts Social Security benefits
  const ssaBenefits = federalResult.socialSecurity?.taxableBenefits || 0;
  if (ssaBenefits > 0) {
    subtractions += ssaBenefits;
  }

  return subtractions;
}

// --- AL Standard Deduction Phase-Down ----------------------------------------

/**
 * Calculate Alabama's standard deduction with income-based phase-down.
 *
 * The deduction decreases in stepped increments (per $500 of AGI, or $250
 * for MFS) once AGI exceeds the phaseout threshold, down to a floor.
 *
 * Source: Alabama Form 40 Instructions p.9 (2025 standard deduction table)
 */
function calculateALStandardDeduction(
  alAGI: number,
  params: ALStandardDeductionParams,
): number {
  if (alAGI < params.phaseoutStart) {
    return params.base;
  }

  const excess = alAGI - params.phaseoutStart;
  const steps = Math.floor(excess / params.stepSize) + 1;
  const reduction = steps * params.reductionPerStep;

  return Math.max(params.floor, params.base - reduction);
}

// --- Federal Tax Deduction --------------------------------------------------

/**
 * Alabama's unique federal income tax deduction.
 *
 * Alabama allows taxpayers to deduct the amount of federal income tax
 * actually paid (after credits) from their state taxable income. This
 * effectively makes Alabama tax a tax on income net of federal tax.
 *
 * The deduction uses:
 *   1. config.stateSpecificData.federalTaxPaid --- if explicitly provided
 *      (useful for overrides, estimates, or prior-year amounts)
 *   2. federalResult.form1040.totalTax --- the computed federal total tax
 *      from the current return (after all credits)
 *
 * Note: In practice, Alabama uses federal tax "actually paid" which may
 * differ from the computed liability (e.g., if prior year balance was
 * paid in current year). The simplified approach here uses the computed
 * federal total tax as a reasonable proxy.
 */
function getFederalTaxDeduction(
  federalResult: CalculationResult,
  config: StateReturnConfig,
): number {
  // Check for explicit override in state-specific data
  const stateData = config.stateSpecificData || {};
  if (typeof stateData.federalTaxPaid === 'number') {
    return Math.max(0, stateData.federalTaxPaid as number);
  }

  // Default: use the computed federal total tax from the return
  return Math.max(0, federalResult.form1040.totalTax || 0);
}

// --- Main Calculator --------------------------------------------------------

export function calculateAlabama(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
): StateCalculationResult {
  const f = federalResult.form1040;
  const filingKey = getStateFilingKey(taxReturn.filingStatus);
  const federalAGI = f.agi;
  const tb = new TraceBuilder();
  const refs = STATE_FORM_REFS['AL'];

  // -- Step 1: AL AGI -------------------------
  const additions = getAdditions(taxReturn, federalResult);
  const subtractions = getSubtractions(taxReturn, federalResult);
  const alAGI = tb.trace(
    'state.stateAGI', 'Alabama Adjusted Gross Income',
    Math.max(0, federalAGI + additions - subtractions), {
      authority: refs?.agiLine,
      formula: subtractions > 0 ? 'Federal AGI − Subtractions' : 'Federal AGI',
      inputs: [
        { lineId: 'form1040.line11', label: 'Federal AGI', value: federalAGI },
        ...(subtractions > 0 ? [{ lineId: 'state.subtractions', label: 'AL Subtractions (SS exemption)', value: subtractions }] : []),
      ],
    },
  );

  // -- Step 2: Standard Deduction (with phase-down) --
  const stdDedParams = AL_STANDARD_DEDUCTION[filingKey] || AL_STANDARD_DEDUCTION['single'];
  const standardDeduction = calculateALStandardDeduction(alAGI, stdDedParams);

  // Alabama itemized deductions: if the taxpayer itemizes on their federal
  // return, they may also itemize on AL. Simplified here to use the greater
  // of the AL standard deduction or federal itemized total.
  let alItemized = 0;
  if (taxReturn.deductionMethod === 'itemized' && federalResult.scheduleA) {
    const sa = federalResult.scheduleA;
    alItemized = sa.totalItemized;
  }

  const deduction = Math.max(standardDeduction, alItemized);

  // -- Step 3: Personal & Dependent Exemptions -
  const personalExemption = AL_PERSONAL_EXEMPTION[filingKey] || 1500;
  const numDependents = taxReturn.dependents?.length || 0;
  // Dependent exemption phases down: $1,000 (≤$50K), $500 ($50K-$100K), $300 (>$100K)
  let perDependent = AL_DEPENDENT_EXEMPTION_FLOOR;
  for (const tier of AL_DEPENDENT_EXEMPTION_TIERS) {
    if (alAGI <= tier.maxAGI) {
      perDependent = tier.amount;
      break;
    }
  }
  const dependentExemption = numDependents * perDependent;
  const exemptions = personalExemption + dependentExemption;

  // -- Step 4: Federal Tax Deduction -----------
  // UNIQUE TO ALABAMA: Deduct federal income tax paid from state taxable income.
  // This is the defining feature of Alabama's tax system.
  const federalTaxDeduction = getFederalTaxDeduction(federalResult, config);

  // -- Step 5: Taxable Income ------------------
  // AL taxable income = AL AGI - deduction - exemptions - federal tax paid
  const taxableIncome = tb.trace(
    'state.taxableIncome', 'Alabama Taxable Income',
    Math.max(0, alAGI - deduction - exemptions - federalTaxDeduction), {
      authority: refs?.taxableIncomeLine,
      formula: 'AL AGI − Deduction − Exemptions − Federal Tax Deduction',
      inputs: [
        { lineId: 'state.stateAGI', label: 'AL AGI', value: alAGI },
        ...(deduction > 0 ? [{ lineId: 'state.deduction', label: 'Deduction', value: deduction }] : []),
        ...(exemptions > 0 ? [{ lineId: 'state.exemptions', label: 'Exemptions', value: exemptions }] : []),
        ...(federalTaxDeduction > 0 ? [{ lineId: 'state.fedTaxDed', label: 'Federal Tax Deduction', value: federalTaxDeduction }] : []),
      ],
    },
  );

  // -- Step 6: AL Income Tax (brackets) --------
  const brackets = AL_BRACKETS[filingKey] || AL_BRACKETS['single'];
  const { tax: alTax, details: bracketDetails } = applyBrackets(taxableIncome, brackets);

  // -- Trace: Income Tax with bracket children --
  const bracketTraceChildren: CalculationTrace[] = bracketDetails
    .filter(b => b.taxAtRate > 0)
    .map(b => ({
      lineId: `state.bracket.${(b.rate * 100).toFixed(1)}pct`,
      label: `${(b.rate * 100).toFixed(1)}% bracket`,
      value: b.taxAtRate,
      formula: `${b.taxableAtRate.toLocaleString()} × ${(b.rate * 100).toFixed(1)}%`,
      inputs: [{ lineId: 'state.bracket.taxableAtRate', label: `Income at ${(b.rate * 100).toFixed(1)}%`, value: b.taxableAtRate }],
    }));
  tb.trace('state.incomeTax', 'Alabama Income Tax', alTax, {
    authority: refs?.incomeTaxLine,
    formula: `Progressive brackets (AL)`,
    inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
    children: bracketTraceChildren.length > 0 ? bracketTraceChildren : undefined,
  });

  // -- Step 7: Credits -------------------------
  // Alabama has no state EITC or other major refundable credits in this
  // simplified implementation. Nonrefundable credits could be added here.
  const totalCredits = 0;
  const alAfterCredits = Math.max(0, alTax - totalCredits);

  // -- Step 8: Total & Payments ----------------
  const localTax = 0; // Alabama has no local income tax at the state return level
  const totalStateTax = tb.trace(
    'state.totalTax', 'Alabama Total Tax',
    alAfterCredits + localTax, {
      authority: refs?.totalTaxLine,
      formula: 'Income Tax',
      inputs: [
        { lineId: 'state.incomeTax', label: 'Income Tax', value: alTax },
      ],
    },
  );

  const stateWithholding = getStateWithholding(taxReturn, 'AL');
  const estimatedPayments = 0; // Could be extended later
  const totalPayments = stateWithholding + estimatedPayments;

  const refundOrOwedRaw = totalPayments - totalStateTax;
  const refundOrOwed = tb.trace(
    'state.refundOrOwed',
    refundOrOwedRaw >= 0 ? 'Alabama Refund' : 'Alabama Amount Owed',
    refundOrOwedRaw, {
      authority: refs?.refundLine,
      formula: 'Withholding − Total Tax',
      inputs: [
        { lineId: 'state.totalTax', label: 'Total State Tax', value: totalStateTax },
        ...(stateWithholding > 0 ? [{ lineId: 'state.withholding', label: 'Withholding', value: stateWithholding }] : []),
      ],
    },
  );

  const effectiveRate = federalAGI > 0
    ? Math.round((totalStateTax / federalAGI) * 10000) / 10000
    : 0;

  return {
    stateCode: 'AL',
    stateName: getStateName('AL'),
    residencyType: config.residencyType,
    federalAGI,
    stateAdditions: additions,
    stateSubtractions: subtractions,
    stateAGI: alAGI,
    stateDeduction: deduction,
    stateTaxableIncome: taxableIncome,
    stateExemptions: exemptions,
    stateIncomeTax: alAfterCredits,
    stateCredits: totalCredits,
    stateTaxAfterCredits: alAfterCredits,
    localTax,
    totalStateTax,
    stateWithholding,
    stateEstimatedPayments: estimatedPayments,
    stateRefundOrOwed: refundOrOwed,
    effectiveStateRate: effectiveRate,
    bracketDetails,
    additionalLines: {
      alTaxBeforeCredits: alTax,
      personalExemption,
      dependentExemption,
      federalTaxDeduction,
    },
    traces: tb.build(),
  };
}
