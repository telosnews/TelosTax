/**
 * Connecticut State Tax Calculator — Tax Year 2025
 *
 * Implements the full CT-1040 Tax Calculation Schedule (TCS):
 *   Line 1: CT AGI
 *   Line 2: Personal exemption deduction (Table A, with phase-out)
 *   Line 3: CT Taxable Income = Line 1 - Line 2
 *   Line 4: Initial tax from brackets (Table B)
 *   Line 5: 2% rate phase-out add-back (Table C)
 *   Line 6: Benefit recapture (Table D)
 *   Line 7: Combined tax = Line 4 + Line 5 + Line 6
 *   Line 8: Personal tax credit decimal (Table E)
 *   Line 9: CT Income Tax = Line 7 × (1.00 - Line 8)
 *
 * Plus: CT EITC (40% of federal + $250/child, refundable)
 *
 * Source: CT DRS Form CT-1040 TCS, CGS §12-700/702/703/704e
 */

import {
  TaxReturn, CalculationResult, StateCalculationResult,
  StateReturnConfig, FilingStatus, CalculationTrace,
} from '../../types/index.js';
import {
  CT_BRACKETS, CT_PERSONAL_EXEMPTION, CT_EXEMPTION_PHASEOUT_START,
  CT_TABLE_C, CT_TABLE_D, CT_TABLE_E,
  CT_EITC_MATCH_RATE, CT_EITC_CHILD_BONUS,
  type CTTableCParams, type CTTableDParams, type CTTableETier,
} from '../../constants/states/ct.js';
import { TraceBuilder } from '../traceBuilder.js';
import { applyBrackets, getStateWithholding, getStateFilingKey, getStateName } from './index.js';

// ─── CT Additions / Subtractions ────────────────────────────────

function getAdditions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  return 0;
}

function getSubtractions(taxReturn: TaxReturn, federalResult: CalculationResult): number {
  let subtractions = 0;
  // CT fully exempts Social Security benefits
  const ssaBenefits = federalResult.socialSecurity?.taxableBenefits || 0;
  if (ssaBenefits > 0) {
    subtractions += ssaBenefits;
  }
  return subtractions;
}

// ─── TCS Line 2: Personal Exemption (Table A) ──────────────────

/**
 * Calculate the personal exemption deduction amount (with phase-out).
 * This is a DEDUCTION from CT AGI, not a credit.
 */
function calculateExemptionDeduction(ctAGI: number, filingKey: string): number {
  const baseExemption = CT_PERSONAL_EXEMPTION[filingKey] || 15000;
  const phaseoutStart = CT_EXEMPTION_PHASEOUT_START[filingKey] || 30000;

  if (ctAGI <= phaseoutStart) {
    return baseExemption;
  }

  // Reduce by $1,000 for every $1,000 of CT AGI over the threshold
  const excessAGI = ctAGI - phaseoutStart;
  const reduction = Math.floor(excessAGI / 1000) * 1000;
  return Math.max(0, baseExemption - reduction);
}

// ─── TCS Line 5: Table C — 2% Rate Phase-Out Add-Back ──────────

function calculateTableC(ctAGI: number, params: CTTableCParams): number {
  if (ctAGI <= params.startThreshold) return 0;

  const excess = ctAGI - params.startThreshold;
  const steps = Math.min(
    Math.ceil(excess / params.bandWidth),
    Math.round(params.maxAddBack / params.incrementPerBand),
  );

  return Math.min(steps * params.incrementPerBand, params.maxAddBack);
}

// ─── TCS Line 6: Table D — Benefit Recapture ───────────────────

function calculateTableD(ctAGI: number, params: CTTableDParams): number {
  // Phase 1
  if (ctAGI <= params.phase1.startThreshold) return 0;

  let recapture: number;

  if (ctAGI <= params.phase1.plateauEnd) {
    const excess = ctAGI - params.phase1.startThreshold;
    const steps = Math.ceil(excess / params.phase1.bandWidth);
    recapture = Math.min(steps * params.phase1.incrementPerBand, params.phase1.plateau);
  } else {
    // Phase 2
    recapture = params.phase1.plateau;
    if (ctAGI > params.phase2.startThreshold) {
      const excess2 = ctAGI - params.phase2.startThreshold;
      const steps2 = Math.ceil(excess2 / params.phase2.bandWidth);
      const phase2Add = Math.min(
        steps2 * params.phase2.incrementPerBand,
        params.phase2.max - params.phase1.plateau,
      );
      recapture += phase2Add;
    }
  }

  return Math.min(recapture, params.phase2.max);
}

// ─── TCS Line 8: Table E — Personal Tax Credit Decimal ─────────

function getTableEDecimal(ctAGI: number, tiers: CTTableETier[]): number {
  for (const tier of tiers) {
    if (ctAGI <= tier.maxAGI) {
      return tier.decimal;
    }
  }
  return 0; // AGI exceeds all tiers — no credit
}

// ─── CT EITC ────────────────────────────────────────────────────

function calculateCTEITC(federalEITC: number, qualifyingChildren: number): number {
  if (federalEITC <= 0 && qualifyingChildren <= 0) return 0;
  const matchCredit = federalEITC > 0 ? Math.round(federalEITC * CT_EITC_MATCH_RATE) : 0;
  const childBonus = qualifyingChildren * CT_EITC_CHILD_BONUS;
  return matchCredit + childBonus;
}

// ─── Main Calculator ────────────────────────────────────────────

export function calculateConnecticut(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
): StateCalculationResult {
  const f = federalResult.form1040;
  const filingKey = getStateFilingKey(taxReturn.filingStatus);
  const federalAGI = f.agi;
  const tb = new TraceBuilder();

  // ── TCS Line 1: CT AGI ────────────────────────
  const additions = getAdditions(taxReturn, federalResult);
  const subtractions = getSubtractions(taxReturn, federalResult);
  const ctAGI = tb.trace(
    'state.stateAGI', 'Connecticut Adjusted Gross Income',
    Math.max(0, federalAGI + additions - subtractions), {
      formula: subtractions > 0 ? 'Federal AGI − Subtractions' : 'Federal AGI',
      inputs: [
        { lineId: 'form1040.line11', label: 'Federal AGI', value: federalAGI },
        ...(subtractions > 0 ? [{ lineId: 'state.subtractions', label: 'CT Subtractions (SS exemption)', value: subtractions }] : []),
      ],
    },
  );

  // ── TCS Line 2: Personal Exemption (Table A) ──
  const exemptionDeduction = calculateExemptionDeduction(ctAGI, filingKey);

  // ── TCS Line 3: CT Taxable Income ─────────────
  const taxableIncome = tb.trace(
    'state.taxableIncome', 'Connecticut Taxable Income',
    Math.max(0, ctAGI - exemptionDeduction), {
      formula: 'CT AGI − Personal Exemption (Table A)',
      inputs: [
        { lineId: 'state.stateAGI', label: 'CT AGI', value: ctAGI },
        ...(exemptionDeduction > 0 ? [{ lineId: 'state.deduction', label: 'Personal Exemption (Table A)', value: exemptionDeduction }] : []),
      ],
    },
  );

  // ── TCS Line 4: Initial Tax (Table B brackets) ─
  const brackets = CT_BRACKETS[filingKey] || CT_BRACKETS['single'];
  const { tax: initialTax, details: bracketDetails } = applyBrackets(taxableIncome, brackets);

  // ── TCS Line 5: Table C — 2% Rate Phase-Out ───
  const tableCParams = CT_TABLE_C[filingKey] || CT_TABLE_C['single'];
  const tableCAddBack = calculateTableC(ctAGI, tableCParams);

  // ── TCS Line 6: Table D — Benefit Recapture ───
  const tableDParams = CT_TABLE_D[filingKey] || CT_TABLE_D['single'];
  const tableDRecapture = calculateTableD(ctAGI, tableDParams);

  // ── TCS Line 7: Combined Tax ──────────────────
  const combinedTax = initialTax + tableCAddBack + tableDRecapture;

  // ── TCS Line 8-9: Table E — Personal Tax Credit
  const tableETiers = CT_TABLE_E[filingKey] || CT_TABLE_E['single'];
  const tableEDecimal = getTableEDecimal(ctAGI, tableETiers);
  const personalTaxCredit = Math.round(combinedTax * tableEDecimal * 100) / 100;
  const ctIncomeTax = Math.round((combinedTax - personalTaxCredit) * 100) / 100;

  // ── Trace: Income Tax with TCS breakdown ──────
  const incomeTaxChildren: CalculationTrace[] = [];

  // Bracket children (TCS Line 4)
  const bracketTraceChildren: CalculationTrace[] = bracketDetails
    .filter(b => b.taxAtRate > 0)
    .map(b => ({
      lineId: `state.bracket.${(b.rate * 100).toFixed(1)}pct`,
      label: `${(b.rate * 100).toFixed(1)}% bracket`,
      value: b.taxAtRate,
      formula: `${b.taxableAtRate.toLocaleString()} × ${(b.rate * 100).toFixed(1)}%`,
      inputs: [{ lineId: 'state.bracket.taxableAtRate', label: `Income at ${(b.rate * 100).toFixed(1)}%`, value: b.taxableAtRate }],
    }));
  if (bracketTraceChildren.length > 0) {
    incomeTaxChildren.push({
      lineId: 'state.tcs.initialTax', label: 'TCS Line 4: Initial Tax (Table B)',
      value: initialTax,
      formula: 'Progressive brackets',
      inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
      children: bracketTraceChildren,
    });
  }
  if (tableCAddBack > 0) {
    incomeTaxChildren.push({
      lineId: 'state.tcs.tableC', label: 'TCS Line 5: 2% Rate Phase-Out (Table C)',
      value: tableCAddBack,
      formula: 'Add-back for high earners',
      inputs: [{ lineId: 'state.stateAGI', label: 'CT AGI', value: ctAGI }],
    });
  }
  if (tableDRecapture > 0) {
    incomeTaxChildren.push({
      lineId: 'state.tcs.tableD', label: 'TCS Line 6: Benefit Recapture (Table D)',
      value: tableDRecapture,
      formula: 'Recapture for high earners',
      inputs: [{ lineId: 'state.stateAGI', label: 'CT AGI', value: ctAGI }],
    });
  }
  if (personalTaxCredit > 0) {
    incomeTaxChildren.push({
      lineId: 'state.tcs.tableE', label: `TCS Line 8-9: Personal Tax Credit (Table E, ${(tableEDecimal * 100).toFixed(0)}%)`,
      value: -personalTaxCredit,
      formula: `Combined Tax × ${(tableEDecimal * 100).toFixed(0)}%`,
      inputs: [{ lineId: 'state.tcs.combinedTax', label: 'Combined Tax', value: combinedTax }],
    });
  }

  tb.trace('state.incomeTax', 'Connecticut Income Tax', ctIncomeTax, {
    formula: 'TCS: (Initial Tax + Table C + Table D) × (1 − Table E)',
    inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
    children: incomeTaxChildren.length > 0 ? incomeTaxChildren : undefined,
  });

  const taxBeforeCredits = ctIncomeTax;

  // ── CT EITC (refundable) ──────────────────────
  const federalEITC = federalResult.credits.eitcCredit || 0;
  const childRelationships = ['child', 'stepchild', 'fosterchild', 'foster child', 'grandchild'];
  const qualifyingChildren = (taxReturn.dependents || []).filter(
    (d) => childRelationships.includes(d.relationship?.toLowerCase() || ''),
  ).length || (taxReturn.dependents?.length || 0);
  const ctEITC = calculateCTEITC(federalEITC, qualifyingChildren);

  // CT EITC is refundable; personal tax credit already applied above
  const nonrefundableCredits = 0;
  const refundableCredits = ctEITC;

  const creditChildren: CalculationTrace[] = [];
  if (ctEITC > 0) {
    creditChildren.push({
      lineId: 'state.credits.ctEITC', label: 'CT EITC (40% of federal + $250/child)', value: ctEITC,
      formula: `${federalEITC > 0 ? federalEITC.toLocaleString() + ' × 40%' : ''}${federalEITC > 0 && qualifyingChildren > 0 ? ' + ' : ''}${qualifyingChildren > 0 ? qualifyingChildren + ' × $250' : ''}`,
      inputs: [
        ...(federalEITC > 0 ? [{ lineId: 'federal.eitc', label: 'Federal EITC', value: federalEITC }] : []),
        ...(qualifyingChildren > 0 ? [{ lineId: 'state.qualifyingChildren', label: 'Qualifying Children', value: qualifyingChildren }] : []),
      ],
    });
  }
  const totalCredits = tb.trace(
    'state.credits', 'Connecticut Credits',
    personalTaxCredit + refundableCredits, {
      formula: ctEITC > 0 ? 'Personal Tax Credit (Table E) + CT EITC' : 'Personal Tax Credit (Table E)',
      inputs: [
        ...(personalTaxCredit > 0 ? [{ lineId: 'state.tcs.tableE', label: 'Personal Tax Credit', value: personalTaxCredit }] : []),
        ...(ctEITC > 0 ? [{ lineId: 'state.credits.ctEITC', label: 'CT EITC', value: ctEITC }] : []),
      ],
      children: creditChildren.length > 0 ? creditChildren : undefined,
    },
  );

  // Apply refundable credits
  const taxAfterNonrefundable = taxBeforeCredits;
  const refundableUsedAgainstTax = Math.min(taxAfterNonrefundable, refundableCredits);
  const refundableExcess = refundableCredits - refundableUsedAgainstTax;

  // ── Total & Payments ──────────────────────────
  const localTax = 0;
  const totalStateTax = tb.trace(
    'state.totalTax', 'Connecticut Total Tax',
    Math.max(0, taxAfterNonrefundable - refundableUsedAgainstTax), {
      formula: totalCredits > 0 ? 'Income Tax − Refundable Credits' : 'Income Tax',
      inputs: [
        { lineId: 'state.incomeTax', label: 'Income Tax', value: ctIncomeTax },
        ...(ctEITC > 0 ? [{ lineId: 'state.credits.ctEITC', label: 'CT EITC', value: ctEITC }] : []),
      ],
    },
  );

  const stateWithholding = getStateWithholding(taxReturn, 'CT');
  const estimatedPayments = 0;
  const totalPayments = stateWithholding + estimatedPayments;
  const refundOrOwedRaw = totalPayments - totalStateTax + refundableExcess;
  const refundOrOwed = tb.trace(
    'state.refundOrOwed',
    refundOrOwedRaw >= 0 ? 'Connecticut Refund' : 'Connecticut Amount Owed',
    refundOrOwedRaw, {
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
    stateCode: 'CT',
    stateName: getStateName('CT'),
    residencyType: config.residencyType,
    federalAGI,
    stateAdditions: additions,
    stateSubtractions: subtractions,
    stateAGI: ctAGI,
    stateDeduction: exemptionDeduction,
    stateTaxableIncome: taxableIncome,
    stateExemptions: 0, // Exemption applied as deduction, not separate
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
      initialTax,
      tableCAddBack,
      tableDRecapture,
      combinedTax,
      tableEDecimal,
      personalTaxCredit,
      ctIncomeTax,
      ctEITC,
    },
    traces: tb.build(),
  };
}
