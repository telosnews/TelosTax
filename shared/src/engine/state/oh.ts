/**
 * Ohio State Income Tax Calculator — Tax Year 2025
 *
 * Calculates:
 *   1. OH income tax (3 effective brackets: 0%, 2.75%, 3.5%)
 *   2. AGI-phased personal exemptions (phase-out $40K–$80K)
 *   3. Social Security exemption (fully exempt)
 *
 * Starting point: Federal AGI → OH modifications → OH brackets
 *
 * Key Ohio differences from federal:
 *   - No standard deduction
 *   - Personal exemption phases out linearly based on Ohio AGI ($40K–$80K)
 *   - Social Security benefits fully exempt
 *   - Same brackets for all filing statuses
 *   - Municipal/local income tax handled separately (Phase 3F)
 */

import {
  TaxReturn, CalculationResult, StateCalculationResult,
  StateReturnConfig, FilingStatus, CalculationTrace,
} from '../../types/index.js';
import {
  OH_BRACKETS, OH_PERSONAL_EXEMPTION_AMOUNT,
  OH_EXEMPTION_PHASEOUT_START, OH_EXEMPTION_PHASEOUT_END,
} from '../../constants/states/oh.js';
import { STATE_FORM_REFS } from '../../constants/states/stateFormRefs.js';
import { TraceBuilder } from '../traceBuilder.js';
import { applyBrackets, getStateWithholding, getStateFilingKey, getStateName } from './index.js';

// ─── OH Additions / Subtractions ────────────────────────────────

/**
 * OH additions to federal AGI (items OH taxes but federal doesn't).
 */
function getAdditions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let additions = 0;

  // Interest income from other states' municipal bonds
  // (not implemented — would require bond-level detail)

  // Non-Ohio 529 plan deductions taken on federal return
  // (not implemented — would require 529 detail)

  return additions;
}

/**
 * OH subtractions from federal AGI (items federal taxes but OH doesn't).
 */
function getSubtractions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let subtractions = 0;

  // Ohio fully exempts Social Security benefits
  const ssaBenefits = federalResult.socialSecurity?.taxableBenefits || 0;
  if (ssaBenefits > 0) {
    subtractions += ssaBenefits;
  }

  // Ohio allows a subtraction for military pay (not implemented)
  // Ohio allows a subtraction for federal interest income (not implemented)
  // Ohio allows a retirement income credit via separate schedule (not implemented)

  return subtractions;
}

// ─── OH Personal Exemption ──────────────────────────────────────

/**
 * Calculate Ohio personal exemption amount per exemption.
 *
 * Ohio Rev. Code §5747.025:
 *   - Ohio AGI ≤ $40,000: full exemption ($2,400)
 *   - Ohio AGI $40,001–$80,000: linear phase-out
 *   - Ohio AGI > $80,000: $0 exemption
 *
 * Returns the per-person exemption amount (not total).
 */
function calculateExemptionPerPerson(ohioAGI: number): number {
  if (ohioAGI <= OH_EXEMPTION_PHASEOUT_START) {
    return OH_PERSONAL_EXEMPTION_AMOUNT;
  }
  if (ohioAGI > OH_EXEMPTION_PHASEOUT_END) {
    return 0;
  }

  // Linear phase-out between $40K and $80K
  const phaseoutRange = OH_EXEMPTION_PHASEOUT_END - OH_EXEMPTION_PHASEOUT_START;
  const agiOverThreshold = ohioAGI - OH_EXEMPTION_PHASEOUT_START;
  const reductionRatio = agiOverThreshold / phaseoutRange;
  const exemption = OH_PERSONAL_EXEMPTION_AMOUNT * (1 - reductionRatio);

  return Math.round(exemption * 100) / 100;
}

// ─── Main Calculator ────────────────────────────────────────────

export function calculateOhio(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
): StateCalculationResult {
  const f = federalResult.form1040;
  const filingKey = getStateFilingKey(taxReturn.filingStatus);
  const federalAGI = f.agi;
  const tb = new TraceBuilder();
  const refs = STATE_FORM_REFS['OH'];

  // ── Step 1: OH AGI ───────────────────────────
  const additions = getAdditions(taxReturn, federalResult);
  const subtractions = getSubtractions(taxReturn, federalResult);
  const ohAGI = tb.trace(
    'state.stateAGI', 'Ohio Adjusted Gross Income',
    Math.max(0, federalAGI + additions - subtractions), {
      authority: refs?.agiLine,
      formula: subtractions > 0 ? 'Federal AGI − Subtractions' : 'Federal AGI',
      inputs: [
        { lineId: 'form1040.line11', label: 'Federal AGI', value: federalAGI },
        ...(subtractions > 0 ? [{ lineId: 'state.subtractions', label: 'OH Subtractions (SS exemption)', value: subtractions }] : []),
      ],
    },
  );

  // ── Step 2: Personal Exemptions ───────────────
  // Ohio has NO standard deduction. Instead it uses AGI-phased personal exemptions.
  // Count exemptions: 1 for taxpayer, 1 for spouse (if MFJ/QSS), 1 per dependent
  let exemptionCount = 1;

  if (
    taxReturn.filingStatus === FilingStatus.MarriedFilingJointly ||
    taxReturn.filingStatus === FilingStatus.QualifyingSurvivingSpouse
  ) {
    exemptionCount += 1;
  }

  const numDependents = taxReturn.dependents?.length || 0;
  exemptionCount += numDependents;

  const perPersonExemption = calculateExemptionPerPerson(ohAGI);
  const totalExemptions = Math.round(exemptionCount * perPersonExemption * 100) / 100;

  // ── Step 3: Taxable Income ───────────────────
  // No standard deduction — only personal exemptions reduce income
  const deduction = 0; // Ohio has no standard deduction
  const taxableIncome = tb.trace(
    'state.taxableIncome', 'Ohio Taxable Income',
    Math.max(0, ohAGI - totalExemptions), {
      authority: refs?.taxableIncomeLine,
      formula: 'OH AGI − Personal Exemptions',
      inputs: [
        { lineId: 'state.stateAGI', label: 'OH AGI', value: ohAGI },
        ...(totalExemptions > 0 ? [{ lineId: 'state.exemptions', label: 'Personal Exemptions (phased)', value: totalExemptions }] : []),
      ],
    },
  );

  // ── Step 4: OH Income Tax (brackets) ─────────
  const brackets = OH_BRACKETS[filingKey] || OH_BRACKETS['single'];
  const { tax: ohTax, details: bracketDetails } = applyBrackets(taxableIncome, brackets);

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
  tb.trace('state.incomeTax', 'Ohio Income Tax', ohTax, {
    authority: refs?.incomeTaxLine,
    formula: `Progressive brackets (OH)`,
    inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
    children: bracketTraceChildren.length > 0 ? bracketTraceChildren : undefined,
  });

  // ── Step 5: Credits ──────────────────────────
  // Ohio credits: joint filing credit, child/dependent care credit, etc.
  // (not implemented — simplified for now)
  const totalCredits = 0;
  const ohAfterCredits = Math.max(0, ohTax - totalCredits);

  // ── Step 6: Local Tax ─────────────────────────
  // Ohio municipal income taxes are handled separately (Phase 3F).
  // Placeholder for localTax in additionalLines.
  const localTax = 0;

  // ── Step 7: Total & Payments ─────────────────
  const totalStateTax = tb.trace(
    'state.totalTax', 'Ohio Total Tax',
    ohAfterCredits + localTax, {
      authority: refs?.totalTaxLine,
      formula: 'Income Tax',
      inputs: [
        { lineId: 'state.incomeTax', label: 'Income Tax', value: ohTax },
      ],
    },
  );

  const stateWithholding = getStateWithholding(taxReturn, 'OH');
  const estimatedPayments = 0; // Could be extended later
  const totalPayments = stateWithholding + estimatedPayments;

  const refundOrOwedRaw = totalPayments - totalStateTax;
  const refundOrOwed = tb.trace(
    'state.refundOrOwed',
    refundOrOwedRaw >= 0 ? 'Ohio Refund' : 'Ohio Amount Owed',
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
    stateCode: 'OH',
    stateName: getStateName('OH'),
    residencyType: config.residencyType,
    federalAGI,
    stateAdditions: additions,
    stateSubtractions: subtractions,
    stateAGI: ohAGI,
    stateDeduction: deduction,
    stateTaxableIncome: taxableIncome,
    stateExemptions: totalExemptions,
    stateIncomeTax: ohAfterCredits,
    stateCredits: totalCredits,
    stateTaxAfterCredits: ohAfterCredits,
    localTax,
    totalStateTax,
    stateWithholding,
    stateEstimatedPayments: estimatedPayments,
    stateRefundOrOwed: refundOrOwed,
    effectiveStateRate: effectiveRate,
    bracketDetails,
    additionalLines: {
      ohTaxBeforeCredits: ohTax,
      personalExemptions: totalExemptions,
      perPersonExemption,
      exemptionCount,
      localTax,
    },
    traces: tb.build(),
  };
}
