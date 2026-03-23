/**
 * Maryland State Income Tax Calculator — Tax Year 2025
 *
 * Calculates:
 *   1. MD income tax (10 progressive brackets, filing-status-specific)
 *   2. Standard deduction (flat amounts per HB 352, effective TY2025)
 *   3. Personal exemptions ($3,200 per person, with AGI phaseout)
 *   4. County piggyback tax (24 counties + Baltimore City)
 *   5. MD EITC (45% of federal EITC, refundable)
 *
 * Starting point: Federal AGI → MD modifications → MD brackets + county tax
 *
 * Key MD differences from federal:
 *   - Social Security benefits are fully exempt
 *   - Flat standard deduction (HB 352 replaced 15%-of-AGI formula for TY2025)
 *   - Brackets differ for Single/MFS vs MFJ/HoH (HB 352)
 *   - County "piggyback" tax on top of state tax (applied to taxable income)
 *   - Personal exemption phases out at higher income levels
 */

import {
  TaxReturn, CalculationResult, StateCalculationResult,
  StateReturnConfig, FilingStatus, CalculationTrace,
} from '../../types/index.js';
import {
  MD_BRACKETS, MD_STANDARD_DEDUCTION,
  MD_PERSONAL_EXEMPTION, MD_EXEMPTION_PHASEOUT_START,
  MD_COUNTY_RATES, MD_DEFAULT_COUNTY_RATE,
  MD_EITC_REFUNDABLE_RATE,
} from '../../constants/states/md.js';
import { STATE_FORM_REFS } from '../../constants/states/stateFormRefs.js';
import { TraceBuilder } from '../traceBuilder.js';
import { applyBrackets, getStateWithholding, getStateFilingKey, getStateName } from './index.js';

// ─── MD Additions / Subtractions ────────────────────────────────

/**
 * MD additions to federal AGI (items MD taxes but federal doesn't).
 */
function getAdditions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let additions = 0;

  // Interest income from other states' municipal bonds
  // (not implemented — would require bond-level detail)

  // Certain federal deductions not recognized by MD
  // (not implemented — simplified model starts from federal AGI)

  return additions;
}

/**
 * MD subtractions from federal AGI (items federal taxes but MD doesn't).
 */
function getSubtractions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let subtractions = 0;

  // MD fully exempts Social Security benefits
  const ssaBenefits = federalResult.socialSecurity?.taxableBenefits || 0;
  if (ssaBenefits > 0) {
    subtractions += ssaBenefits;
  }

  // MD also provides subtraction for military retirement income,
  // 529 plan contributions, and certain pension income for retirees
  // (not implemented — would require specific income tracking)

  return subtractions;
}

// ─── MD Standard Deduction ──────────────────────────────────────

/**
 * MD standard deduction: flat amount per filing status (HB 352, effective TY2025).
 * Replaces prior 15%-of-AGI with min/max formula.
 */
function calculateStandardDeduction(_mdAGI: number, filingKey: string): number {
  return MD_STANDARD_DEDUCTION[filingKey] || MD_STANDARD_DEDUCTION['single'];
}

// ─── MD Personal Exemption ──────────────────────────────────────

/**
 * MD personal exemption: $3,200 per exemption (taxpayer + spouse + dependents).
 * Phases out for AGI over the filing-status threshold.
 *
 * The phaseout schedule reduces the exemption amount at higher income levels.
 * Simplified phaseout: reduce by $800 per $25,000 of AGI over the threshold,
 * reaching $0 at very high income.
 */
function calculatePersonalExemptions(
  taxReturn: TaxReturn,
  mdAGI: number,
  filingKey: string,
): { count: number; amount: number } {
  // Count exemptions: taxpayer (always 1)
  let count = 1;

  // Spouse exemption if MFJ or QSS
  if (
    taxReturn.filingStatus === FilingStatus.MarriedFilingJointly ||
    taxReturn.filingStatus === FilingStatus.QualifyingSurvivingSpouse
  ) {
    count += 1;
  }

  // Dependent exemptions
  const numDependents = taxReturn.dependents?.length || 0;
  count += numDependents;

  // Calculate exemption amount with phaseout
  const phaseoutStart = MD_EXEMPTION_PHASEOUT_START[filingKey] || 100000;
  let exemptionPerPerson = MD_PERSONAL_EXEMPTION;

  if (mdAGI > phaseoutStart) {
    // Reduce exemption by $800 for each $25,000 (or fraction) over the threshold
    const excess = mdAGI - phaseoutStart;
    const reductionSteps = Math.ceil(excess / 25000);
    exemptionPerPerson = Math.max(0, MD_PERSONAL_EXEMPTION - reductionSteps * 800);
  }

  return {
    count,
    amount: count * exemptionPerPerson,
  };
}

// ─── MD County Tax ──────────────────────────────────────────────

/**
 * Look up county tax rate from config.stateSpecificData.countyCode.
 * Falls back to the state-wide average (3.07%) if not provided.
 */
function getCountyRate(config: StateReturnConfig): { code: string; rate: number } {
  const stateData = config.stateSpecificData || {};
  const countyCode = (stateData.countyCode as string || '').toUpperCase().trim();

  if (countyCode && MD_COUNTY_RATES[countyCode] !== undefined) {
    return { code: countyCode, rate: MD_COUNTY_RATES[countyCode] };
  }

  return { code: 'DEFAULT', rate: MD_DEFAULT_COUNTY_RATE };
}

// ─── MD EITC ────────────────────────────────────────────────────

/**
 * Maryland EITC — 45% of federal EITC (refundable portion).
 *
 * MD also has a 100% nonrefundable component, but for simplicity
 * we model the 45% refundable component which provides the primary
 * benefit for most qualifying filers.
 */
function calculateMDEITC(federalEITC: number): number {
  if (federalEITC <= 0) return 0;
  return Math.round(federalEITC * MD_EITC_REFUNDABLE_RATE);
}

// ─── Main Calculator ────────────────────────────────────────────

export function calculateMaryland(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
): StateCalculationResult {
  const f = federalResult.form1040;
  const filingKey = getStateFilingKey(taxReturn.filingStatus);
  const federalAGI = f.agi;
  const tb = new TraceBuilder();
  const refs = STATE_FORM_REFS['MD'];

  // ── Step 1: MD AGI ───────────────────────────
  const additions = getAdditions(taxReturn, federalResult);
  const subtractions = getSubtractions(taxReturn, federalResult);
  const mdAGI = tb.trace(
    'state.stateAGI', 'Maryland Adjusted Gross Income',
    Math.max(0, federalAGI + additions - subtractions), {
      authority: refs?.agiLine,
      formula: subtractions > 0 ? 'Federal AGI − Subtractions' : 'Federal AGI',
      inputs: [
        { lineId: 'form1040.line11', label: 'Federal AGI', value: federalAGI },
        ...(subtractions > 0 ? [{ lineId: 'state.subtractions', label: 'MD Subtractions (SS exemption)', value: subtractions }] : []),
      ],
    },
  );

  // ── Step 2: Standard Deduction ────────────────
  const standardDeduction = calculateStandardDeduction(mdAGI, filingKey);

  // MD itemized deductions: start from federal itemized if chosen
  let mdItemized = 0;
  if (taxReturn.deductionMethod === 'itemized' && federalResult.scheduleA) {
    const sa = federalResult.scheduleA;
    // Simplified: use federal itemized total as starting point.
    // Full implementation would recalculate MD-specific itemized
    // deductions (MD allows full SALT deduction, etc.)
    mdItemized = sa.totalItemized;
  }

  const deduction = Math.max(standardDeduction, mdItemized);

  // ── Step 3: Personal Exemptions ───────────────
  const exemptionResult = calculatePersonalExemptions(taxReturn, mdAGI, filingKey);
  const exemptions = exemptionResult.amount;

  // ── Step 4: Taxable Income ───────────────────
  const taxableIncome = tb.trace(
    'state.taxableIncome', 'Maryland Taxable Income',
    Math.max(0, mdAGI - deduction - exemptions), {
      authority: refs?.taxableIncomeLine,
      formula: 'MD AGI − Deduction − Exemptions',
      inputs: [
        { lineId: 'state.stateAGI', label: 'MD AGI', value: mdAGI },
        ...(deduction > 0 ? [{ lineId: 'state.deduction', label: 'Deduction', value: deduction }] : []),
        ...(exemptions > 0 ? [{ lineId: 'state.exemptions', label: 'Personal Exemptions', value: exemptions }] : []),
      ],
    },
  );

  // ── Step 5: MD State Income Tax (brackets) ────
  // HB 352: brackets differ for Single/MFS vs MFJ/HoH
  const mdBrackets = MD_BRACKETS[filingKey] || MD_BRACKETS['single'];
  const { tax: mdTax, details: bracketDetails } = applyBrackets(taxableIncome, mdBrackets);

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
  tb.trace('state.incomeTax', 'Maryland Income Tax', mdTax, {
    authority: refs?.incomeTaxLine,
    formula: `Progressive brackets (MD)`,
    inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
    children: bracketTraceChildren.length > 0 ? bracketTraceChildren : undefined,
  });

  // ── Step 6: MD Credits ───────────────────────
  const federalEITC = federalResult.credits.eitcCredit || 0;
  const mdEITC = calculateMDEITC(federalEITC);

  // EITC is refundable — applied after all nonrefundable credits
  const nonrefundableCredits = 0;
  const refundableCredits = mdEITC;

  const creditChildren: CalculationTrace[] = [];
  if (mdEITC > 0) {
    creditChildren.push({
      lineId: 'state.credits.mdEITC', label: 'MD EITC (45% of federal)', value: mdEITC,
      formula: `${federalEITC.toLocaleString()} × 45%`,
      inputs: [{ lineId: 'federal.eitc', label: 'Federal EITC', value: federalEITC }],
    });
  }
  const totalCredits = tb.trace(
    'state.credits', 'Maryland Credits',
    nonrefundableCredits + refundableCredits, {
      formula: mdEITC > 0 ? 'MD EITC (refundable)' : 'No credits',
      inputs: [
        ...(mdEITC > 0 ? [{ lineId: 'state.credits.mdEITC', label: 'MD EITC', value: mdEITC }] : []),
      ],
      children: creditChildren.length > 0 ? creditChildren : undefined,
    },
  );

  // Apply nonrefundable credits first
  const taxAfterNonrefundable = Math.max(0, mdTax - nonrefundableCredits);
  // Refundable EITC — reduces tax and excess generates a refund
  const refundableUsedAgainstTax = Math.min(taxAfterNonrefundable, refundableCredits);
  const refundableExcess = refundableCredits - refundableUsedAgainstTax;
  const mdAfterCredits = Math.max(0, taxAfterNonrefundable - refundableUsedAgainstTax);

  // ── Step 7: County Piggyback Tax ──────────────
  const county = getCountyRate(config);
  const countyTax = Math.round(taxableIncome * county.rate * 100) / 100;

  tb.trace('state.localTax', 'County Piggyback Tax', countyTax, {
    formula: `Taxable Income × ${(county.rate * 100).toFixed(2)}% (${county.code})`,
    inputs: [
      { lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome },
      { lineId: 'state.countyRate', label: `County Rate (${county.code})`, value: county.rate },
    ],
  });

  // ── Step 8: Total & Payments ─────────────────
  const localTax = countyTax;
  const totalStateTax = tb.trace(
    'state.totalTax', 'Maryland Total Tax',
    mdAfterCredits + localTax, {
      authority: refs?.totalTaxLine,
      formula: totalCredits > 0
        ? 'Income Tax − Credits + County Tax'
        : 'Income Tax + County Tax',
      inputs: [
        { lineId: 'state.incomeTax', label: 'Income Tax', value: mdTax },
        ...(totalCredits > 0 ? [{ lineId: 'state.credits', label: 'Credits', value: totalCredits }] : []),
        { lineId: 'state.localTax', label: 'County Tax', value: countyTax },
      ],
    },
  );

  const stateWithholding = getStateWithholding(taxReturn, 'MD');
  const estimatedPayments = 0; // Could be extended later
  const totalPayments = stateWithholding + estimatedPayments;
  const refundOrOwedRaw = totalPayments - totalStateTax + refundableExcess;
  const refundOrOwed = tb.trace(
    'state.refundOrOwed',
    refundOrOwedRaw >= 0 ? 'Maryland Refund' : 'Maryland Amount Owed',
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
    stateCode: 'MD',
    stateName: getStateName('MD'),
    residencyType: config.residencyType,
    federalAGI,
    stateAdditions: additions,
    stateSubtractions: subtractions,
    stateAGI: mdAGI,
    stateDeduction: deduction,
    stateTaxableIncome: taxableIncome,
    stateExemptions: exemptions,
    stateIncomeTax: mdTax,
    stateCredits: totalCredits,
    stateTaxAfterCredits: mdAfterCredits,
    localTax,
    totalStateTax,
    stateWithholding,
    stateEstimatedPayments: estimatedPayments,
    stateRefundOrOwed: refundOrOwed,
    effectiveStateRate: effectiveRate,
    bracketDetails,
    additionalLines: {
      mdTaxBeforeCredits: mdTax,
      personalExemptions: exemptions,
      personalExemptionCount: exemptionResult.count,
      personalExemptionPerPerson: exemptions > 0 ? exemptions / exemptionResult.count : 0,
      standardDeduction,
      countyTax,
      countyRate: county.rate,
      mdEITC,
    },
    traces: tb.build(),
  };
}
