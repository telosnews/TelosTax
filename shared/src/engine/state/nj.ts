/**
 * New Jersey State Income Tax Calculator — Tax Year 2025
 *
 * Calculates:
 *   1. NJ income tax (progressive brackets, varies by filing status)
 *   2. Personal exemptions (taxpayer, spouse, dependents)
 *   3. Property tax deduction or credit
 *   4. Retirement income exclusion (for qualifying residents)
 *
 * Starting point: Federal AGI → NJ modifications → NJ brackets
 *
 * Key NJ differences from federal:
 *   - No standard deduction — uses personal exemptions only
 *   - Does not tax Social Security benefits
 *   - Retirement income exclusion for lower-income residents
 *   - Property tax deduction up to $15,000 (or $50 credit)
 */

import {
  TaxReturn, CalculationResult, StateCalculationResult,
  StateReturnConfig, FilingStatus, CalculationTrace,
} from '../../types/index.js';
import {
  NJ_BRACKETS, NJ_PERSONAL_EXEMPTION, NJ_DEPENDENT_EXEMPTION,
  NJ_PROPERTY_TAX_DEDUCTION_MAX, NJ_PROPERTY_TAX_CREDIT,
  NJ_RETIREMENT_EXCLUSION_THRESHOLD, NJ_RETIREMENT_EXCLUSION_MAX,
} from '../../constants/states/nj.js';
import { STATE_FORM_REFS } from '../../constants/states/stateFormRefs.js';
import { TraceBuilder } from '../traceBuilder.js';
import { applyBrackets, getStateWithholding, getStateFilingKey, getStateName } from './index.js';

// ─── NJ Additions / Subtractions ────────────────────────────────

/**
 * NJ additions to federal AGI (items NJ taxes but federal doesn't).
 */
function getAdditions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let additions = 0;

  // NJ does not allow most federal above-the-line deductions.
  // For simplicity, we start from federal AGI and make targeted adjustments.
  // Full implementation would add back items like:
  //   - Moving expenses deduction (NJ doesn't allow)
  //   - Domestic production activities deduction

  return additions;
}

/**
 * NJ subtractions from federal AGI (items federal taxes but NJ doesn't).
 */
function getSubtractions(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  filingKey: string,
): number {
  let subtractions = 0;

  // NJ doesn't tax Social Security benefits
  const ssaBenefits = federalResult.socialSecurity?.taxableBenefits || 0;
  if (ssaBenefits > 0) {
    subtractions += ssaBenefits;
  }

  // NJ retirement income exclusion for qualifying residents
  // Applies to pensions, annuities, and certain retirement distributions
  // for residents with NJ gross income under the threshold
  const njGrossEstimate = federalResult.form1040.agi;
  const incomeThreshold = NJ_RETIREMENT_EXCLUSION_THRESHOLD[filingKey] || 100000;
  const exclusionMax = NJ_RETIREMENT_EXCLUSION_MAX[filingKey] || 75000;

  if (njGrossEstimate <= incomeThreshold) {
    const pensionIncome = (taxReturn.income1099R || []).reduce(
      (sum, r) => sum + (r.taxableAmount || 0), 0
    );
    if (pensionIncome > 0) {
      subtractions += Math.min(pensionIncome, exclusionMax);
    }
  }

  return subtractions;
}

// ─── NJ Property Tax Deduction/Credit ───────────────────────────

/**
 * Calculate the NJ property tax benefit.
 * Homeowners can deduct up to $15,000 in property taxes, OR
 * take a $50 property tax credit — whichever is more beneficial.
 * Returns { deduction, credit } where one will be 0.
 */
function calculatePropertyTaxBenefit(
  taxReturn: TaxReturn,
  config: StateReturnConfig,
): { deduction: number; credit: number } {
  // Try to get property tax from itemized deductions or state-specific data
  let propertyTax = 0;

  // Check state-specific data first (user may have entered NJ property tax directly)
  const stateData = config.stateSpecificData || {};
  if (typeof stateData.propertyTaxPaid === 'number') {
    propertyTax = stateData.propertyTaxPaid as number;
  } else if (taxReturn.itemizedDeductions) {
    // Fall back to real estate tax from federal itemized deductions
    propertyTax = taxReturn.itemizedDeductions.realEstateTax || 0;
  }

  if (propertyTax > 0) {
    // Deduction is capped at $15,000
    const deduction = Math.min(propertyTax, NJ_PROPERTY_TAX_DEDUCTION_MAX);
    return { deduction, credit: 0 };
  }

  // If no property tax paid (renter or no data), they may qualify for the $50 credit
  // The $50 credit is for tenants/homeowners who don't benefit from the deduction
  return { deduction: 0, credit: NJ_PROPERTY_TAX_CREDIT };
}

// ─── Main Calculator ────────────────────────────────────────────

export function calculateNewJersey(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
): StateCalculationResult {
  const f = federalResult.form1040;
  const filingKey = getStateFilingKey(taxReturn.filingStatus);
  const federalAGI = f.agi;
  const tb = new TraceBuilder();
  const refs = STATE_FORM_REFS['NJ'];

  // ── Step 1: NJ AGI ───────────────────────────
  const additions = getAdditions(taxReturn, federalResult);
  const subtractions = getSubtractions(taxReturn, federalResult, filingKey);
  const njAGI = tb.trace(
    'state.stateAGI', 'New Jersey Adjusted Gross Income',
    Math.max(0, federalAGI + additions - subtractions), {
      authority: refs?.agiLine,
      formula: additions > 0 && subtractions > 0
        ? 'Federal AGI + Additions − Subtractions'
        : subtractions > 0 ? 'Federal AGI − Subtractions'
        : additions > 0 ? 'Federal AGI + Additions' : 'Federal AGI',
      inputs: [
        { lineId: 'form1040.line11', label: 'Federal AGI', value: federalAGI },
        ...(additions > 0 ? [{ lineId: 'state.additions', label: 'NJ Additions', value: additions }] : []),
        ...(subtractions > 0 ? [{ lineId: 'state.subtractions', label: 'NJ Subtractions (SS, retirement)', value: subtractions }] : []),
      ],
    },
  );

  // ── Step 2: Personal Exemptions ───────────────
  // NJ does NOT have a standard deduction. It uses personal exemptions.
  // $1,000 for taxpayer
  let personalExemptionCount = 1;

  // $1,000 for spouse if MFJ
  if (
    taxReturn.filingStatus === FilingStatus.MarriedFilingJointly ||
    taxReturn.filingStatus === FilingStatus.QualifyingSurvivingSpouse
  ) {
    personalExemptionCount += 1;
  }

  // $1,500 per dependent
  const numDependents = taxReturn.dependents?.length || 0;

  const exemptions = personalExemptionCount * NJ_PERSONAL_EXEMPTION +
    numDependents * NJ_DEPENDENT_EXEMPTION;

  // ── Step 3: Property Tax Deduction/Credit ─────
  const propTaxBenefit = calculatePropertyTaxBenefit(taxReturn, config);

  // ── Step 4: Total Deductions ──────────────────
  // NJ "deduction" is the sum of personal exemptions + property tax deduction
  const deduction = exemptions + propTaxBenefit.deduction;

  // ── Step 5: Taxable Income ───────────────────
  const taxableIncome = tb.trace(
    'state.taxableIncome', 'New Jersey Taxable Income',
    Math.max(0, njAGI - deduction), {
      authority: refs?.taxableIncomeLine,
      formula: 'NJ AGI − Exemptions − Property Tax Deduction',
      inputs: [
        { lineId: 'state.stateAGI', label: 'NJ AGI', value: njAGI },
        ...(exemptions > 0 ? [{ lineId: 'state.exemptions', label: 'Personal Exemptions', value: exemptions }] : []),
        ...(propTaxBenefit.deduction > 0 ? [{ lineId: 'state.propTaxDed', label: 'Property Tax Deduction', value: propTaxBenefit.deduction }] : []),
      ],
    },
  );

  // ── Step 6: NJ Income Tax ────────────────────
  const brackets = NJ_BRACKETS[filingKey] || NJ_BRACKETS['single'];
  const { tax: njTax, details: bracketDetails } = applyBrackets(taxableIncome, brackets);

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
  tb.trace('state.incomeTax', 'New Jersey Income Tax', njTax, {
    authority: refs?.incomeTaxLine,
    formula: `Progressive brackets (NJ)`,
    inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
    children: bracketTraceChildren.length > 0 ? bracketTraceChildren : undefined,
  });

  // ── Step 7: Credits ──────────────────────────
  // Property tax credit (only if deduction wasn't taken)
  const propertyTaxCredit = propTaxBenefit.credit;

  const creditChildren: CalculationTrace[] = [];
  if (propertyTaxCredit > 0) {
    creditChildren.push({
      lineId: 'state.credits.propTax', label: 'Property Tax Credit', value: propertyTaxCredit,
      formula: `$${NJ_PROPERTY_TAX_CREDIT} credit`,
      inputs: [],
    });
  }
  const totalCredits = tb.trace(
    'state.credits', 'New Jersey Credits',
    propertyTaxCredit, {
      formula: 'Property Tax Credit',
      inputs: [
        ...(propertyTaxCredit > 0 ? [{ lineId: 'state.credits.propTax', label: 'Property Tax Credit', value: propertyTaxCredit }] : []),
      ],
      children: creditChildren.length > 0 ? creditChildren : undefined,
    },
  );
  const njAfterCredits = Math.max(0, njTax - totalCredits);

  // ── Step 8: Total & Payments ─────────────────
  const totalStateTax = tb.trace(
    'state.totalTax', 'New Jersey Total Tax',
    njAfterCredits, {
      authority: refs?.totalTaxLine,
      formula: totalCredits > 0 ? 'Income Tax − Credits' : 'Income Tax',
      inputs: [
        { lineId: 'state.incomeTax', label: 'Income Tax', value: njTax },
        ...(totalCredits > 0 ? [{ lineId: 'state.credits', label: 'Credits', value: totalCredits }] : []),
      ],
    },
  );

  const stateWithholding = getStateWithholding(taxReturn, 'NJ');
  const estimatedPayments = 0; // Could be extended later
  const totalPayments = stateWithholding + estimatedPayments;

  const refundOrOwedRaw = totalPayments - totalStateTax;
  const refundOrOwed = tb.trace(
    'state.refundOrOwed',
    refundOrOwedRaw >= 0 ? 'New Jersey Refund' : 'New Jersey Amount Owed',
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
    stateCode: 'NJ',
    stateName: getStateName('NJ'),
    residencyType: config.residencyType,
    federalAGI,
    stateAdditions: additions,
    stateSubtractions: subtractions,
    stateAGI: njAGI,
    stateDeduction: deduction,
    stateTaxableIncome: taxableIncome,
    stateExemptions: exemptions,
    stateIncomeTax: njAfterCredits,
    stateCredits: totalCredits,
    stateTaxAfterCredits: njAfterCredits,
    localTax: 0,
    totalStateTax,
    stateWithholding,
    stateEstimatedPayments: estimatedPayments,
    stateRefundOrOwed: refundOrOwed,
    effectiveStateRate: effectiveRate,
    bracketDetails,
    additionalLines: {
      njTaxBeforeCredits: njTax,
      personalExemptions: exemptions,
      propertyTaxDeduction: propTaxBenefit.deduction,
      propertyTaxCredit,
    },
    traces: tb.build(),
  };
}
