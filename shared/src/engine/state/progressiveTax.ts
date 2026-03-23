/**
 * Progressive-Tax State Calculator Factory — Tax Year 2025
 *
 * Creates a generic calculator for states that use progressive (graduated)
 * tax brackets. Covers ~20 states through config alone, with escape-hatch
 * hooks for state-specific additions, subtractions, credits, and local taxes.
 *
 * The factory reuses the existing `applyBrackets()` utility for bracket
 * computation and follows the same StateCalculator interface as all other
 * state calculators.
 */

import {
  type TaxReturn, type CalculationResult, type StateCalculationResult,
  type StateReturnConfig, type StateTaxBracket, type CalculationTrace, FilingStatus,
} from '../../types/index.js';
import { STATE_FORM_REFS } from '../../constants/states/stateFormRefs.js';
import { TraceBuilder } from '../traceBuilder.js';
import { applyBrackets, getStateWithholding, getStateFilingKey, getStateName } from './index.js';
import type { StateCalculator } from './stateRegistry.js';

// ─── Config Interface ─────────────────────────────────────────────

/** Filing status keys used in bracket/deduction lookups. */
export type FilingKey = 'single' | 'married_joint' | 'married_separate' | 'head_of_household';

export interface ProgressiveTaxStateConfig {
  stateCode: string;

  /** Starting point for state income calculation. */
  startingPoint: 'federal_agi' | 'federal_taxable_income';

  /** Progressive brackets keyed by filing status. */
  brackets: Record<FilingKey, StateTaxBracket[]>;

  /** Standard deduction by filing status key. */
  standardDeduction: Record<FilingKey, number>;

  /**
   * Personal exemption per person (taxpayer + spouse if MFJ).
   * Use Record<FilingKey, number> for filing-status-specific amounts.
   */
  personalExemption: number | Record<FilingKey, number>;

  /** Dependent exemption per dependent. */
  dependentExemption: number;

  /** If true, Social Security benefits are subtracted (default: true for most states). */
  exemptSocialSecurity?: boolean;

  /** State EITC as fraction of federal EITC (e.g., 0.30 = 30%). */
  stateEITCRate?: number;

  /** Whether state EITC is refundable (default: true). */
  stateEITCRefundable?: boolean;

  /** Optional surtax (millionaire's tax, etc.). */
  surtax?: {
    threshold: number | Record<FilingKey, number>;
    rate: number;
  };

  /**
   * Escape-hatch hooks for state-specific logic that doesn't fit the
   * standard factory flow. Each hook receives the tax return, federal
   * result, and state config, and returns a numeric adjustment.
   */
  hooks?: {
    /** Additional income to add to federal AGI (state-specific additions). */
    additions?: (tr: TaxReturn, fed: CalculationResult, cfg: StateReturnConfig) => number;

    /** Additional amounts to subtract beyond SS exemption. */
    subtractions?: (tr: TaxReturn, fed: CalculationResult, cfg: StateReturnConfig) => number;

    /** Custom credit logic. Returns credits amount + optional overrides. */
    credits?: (tr: TaxReturn, fed: CalculationResult, prelim: {
      stateAGI: number; taxableIncome: number; baseTax: number;
    }, cfg: StateReturnConfig) => {
      credits: number;
      taxAfterCredits?: number;
      refundableExcess?: number;
    };

    /** Local/county tax computation. */
    localTax?: (tr: TaxReturn, fed: CalculationResult, prelim: {
      taxableIncome: number; taxAfterCredits: number;
    }, cfg: StateReturnConfig) => number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function countPersons(filingStatus: FilingStatus | undefined): number {
  if (
    filingStatus === FilingStatus.MarriedFilingJointly ||
    filingStatus === FilingStatus.QualifyingSurvivingSpouse
  ) {
    return 2;
  }
  return 1;
}

function getPersonalExemption(
  config: ProgressiveTaxStateConfig,
  filingKey: FilingKey,
  numPersons: number,
): number {
  if (typeof config.personalExemption === 'number') {
    return config.personalExemption * numPersons;
  }
  return (config.personalExemption[filingKey] || 0);
}

/**
 * Count exemptions (taxpayer + spouse + dependents) for per-exemption credit hooks.
 * Exported for use in state config hooks to avoid duplicating person-counting logic.
 */
export function countExemptions(tr: TaxReturn): number {
  const isMFJ = tr.filingStatus === FilingStatus.MarriedFilingJointly ||
    tr.filingStatus === FilingStatus.QualifyingSurvivingSpouse;
  const numPersons = isMFJ ? 2 : 1;
  return numPersons + (tr.dependents?.length || 0);
}

// ─── Factory ──────────────────────────────────────────────────────

/**
 * Create a StateCalculator for a progressive-tax state.
 *
 * @param config  The state's tax configuration (brackets, deductions, hooks, etc.)
 * @returns       A StateCalculator whose `.calculate()` method performs the
 *                full progressive-tax computation.
 */
export function createProgressiveTaxCalculator(config: ProgressiveTaxStateConfig): StateCalculator {
  return {
    calculate(
      taxReturn: TaxReturn,
      federalResult: CalculationResult,
      stateConfig: StateReturnConfig,
    ): StateCalculationResult {
      const f = federalResult.form1040;
      const filingKey = getStateFilingKey(taxReturn.filingStatus) as FilingKey;
      const filingStatus = taxReturn.filingStatus;
      const numDependents = taxReturn.dependents?.length || 0;
      const numPersons = countPersons(filingStatus);
      const tb = new TraceBuilder();
      const sName = getStateName(config.stateCode);
      const refs = STATE_FORM_REFS[config.stateCode];

      // ── Step 1: Starting Income ──────────────────
      const startingIncome = config.startingPoint === 'federal_taxable_income'
        ? f.taxableIncome
        : f.agi;

      // ── Step 2: Additions & Subtractions ─────────
      let additions = 0;
      if (config.hooks?.additions) {
        additions = config.hooks.additions(taxReturn, federalResult, stateConfig);
      }

      let subtractions = 0;

      // Social Security exemption (default: true unless startingPoint is federal_taxable_income)
      const exemptSS = config.exemptSocialSecurity !== false
        && config.startingPoint !== 'federal_taxable_income';
      if (exemptSS) {
        const ssaBenefits = federalResult.socialSecurity?.taxableBenefits || 0;
        if (ssaBenefits > 0) {
          subtractions += ssaBenefits;
        }
      }

      if (config.hooks?.subtractions) {
        subtractions += config.hooks.subtractions(taxReturn, federalResult, stateConfig);
      }

      // ── Step 3: State AGI ────────────────────────
      const stateAGI = tb.trace(
        'state.stateAGI', `${sName} Adjusted Gross Income`,
        Math.max(0, startingIncome + additions - subtractions), {
          authority: refs?.agiLine,
          formula: additions > 0 && subtractions > 0
            ? 'Starting Income + Additions − Subtractions'
            : subtractions > 0 ? 'Starting Income − Subtractions'
            : additions > 0 ? 'Starting Income + Additions' : 'Starting Income',
          inputs: [
            { lineId: config.startingPoint === 'federal_taxable_income' ? 'form1040.line15' : 'form1040.line11',
              label: config.startingPoint === 'federal_taxable_income' ? 'Federal Taxable Income' : 'Federal AGI',
              value: startingIncome },
            ...(additions > 0 ? [{ lineId: 'state.additions', label: 'Additions', value: additions }] : []),
            ...(subtractions > 0 ? [{ lineId: 'state.subtractions', label: 'Subtractions', value: subtractions }] : []),
          ],
        },
      );

      // ── Step 4: Deductions ───────────────────────
      const stateDeduction = config.standardDeduction[filingKey] || 0;

      // ── Step 5: Exemptions ───────────────────────
      const personalExemption = getPersonalExemption(config, filingKey, numPersons);
      const dependentExemptions = numDependents * config.dependentExemption;
      const totalExemptions = personalExemption + dependentExemptions;

      // ── Step 6: Taxable Income ───────────────────
      const taxableIncome = tb.trace(
        'state.taxableIncome', `${sName} Taxable Income`,
        Math.max(0, stateAGI - stateDeduction - totalExemptions), {
          authority: refs?.taxableIncomeLine,
          formula: 'State AGI − Deduction − Exemptions',
          inputs: [
            { lineId: 'state.stateAGI', label: 'State AGI', value: stateAGI },
            ...(stateDeduction > 0 ? [{ lineId: 'state.deduction', label: 'Standard Deduction', value: stateDeduction }] : []),
            ...(totalExemptions > 0 ? [{ lineId: 'state.exemptions', label: 'Exemptions', value: totalExemptions }] : []),
          ],
        },
      );

      // ── Step 7: Apply Brackets ───────────────────
      const brackets = config.brackets[filingKey] || config.brackets['single'];
      const { tax: baseTax, details: bracketDetails } = applyBrackets(taxableIncome, brackets);

      // ── Step 8: Surtax ───────────────────────────
      let surtax = 0;
      if (config.surtax) {
        const threshold = typeof config.surtax.threshold === 'number'
          ? config.surtax.threshold
          : (config.surtax.threshold[filingKey] || config.surtax.threshold['single'] || Infinity);
        if (taxableIncome > threshold) {
          surtax = Math.round((taxableIncome - threshold) * config.surtax.rate * 100) / 100;
        }
      }

      const taxBeforeCredits = baseTax + surtax;

      // ── Trace: Income Tax with bracket children ──
      const bracketTraceChildren: CalculationTrace[] = bracketDetails
        .filter(b => b.taxAtRate > 0)
        .map(b => ({
          lineId: `state.bracket.${(b.rate * 100).toFixed(1)}pct`,
          label: `${(b.rate * 100).toFixed(1)}% bracket`,
          value: b.taxAtRate,
          formula: `${b.taxableAtRate.toLocaleString()} × ${(b.rate * 100).toFixed(1)}%`,
          inputs: [{ lineId: 'state.bracket.taxableAtRate', label: `Income at ${(b.rate * 100).toFixed(1)}%`, value: b.taxableAtRate }],
        }));
      if (surtax > 0) {
        bracketTraceChildren.push({
          lineId: 'state.surtax', label: 'Surtax', value: surtax,
          formula: `Excess over threshold × ${(config.surtax!.rate * 100).toFixed(1)}%`,
          inputs: [],
        });
      }
      tb.trace('state.incomeTax', `${sName} Income Tax`, taxBeforeCredits, {
        authority: refs?.incomeTaxLine,
        formula: surtax > 0 ? 'Bracket Tax + Surtax' : `Progressive brackets (${config.stateCode})`,
        inputs: [{ lineId: 'state.taxableIncome', label: 'Taxable Income', value: taxableIncome }],
        children: bracketTraceChildren.length > 0 ? bracketTraceChildren : undefined,
      });

      // ── Step 9: Credits ──────────────────────────
      let stateCredits = 0;
      let taxAfterCredits = taxBeforeCredits;
      let refundableExcess = 0;

      // Hook-based credits
      if (config.hooks?.credits) {
        const creditResult = config.hooks.credits(
          taxReturn, federalResult,
          { stateAGI, taxableIncome, baseTax: taxBeforeCredits },
          stateConfig,
        );
        stateCredits += creditResult.credits;
        if (creditResult.taxAfterCredits !== undefined) {
          taxAfterCredits = creditResult.taxAfterCredits;
        } else {
          taxAfterCredits = Math.max(0, taxBeforeCredits - creditResult.credits);
        }
        if (creditResult.refundableExcess !== undefined) {
          refundableExcess = creditResult.refundableExcess;
        }
      }

      // State EITC (on top of any hook credits)
      let stateEITC = 0;
      if (config.stateEITCRate) {
        const federalEITC = federalResult.credits.eitcCredit || 0;
        if (federalEITC > 0) {
          stateEITC = Math.round(federalEITC * config.stateEITCRate);
          stateCredits += stateEITC;

          const isRefundable = config.stateEITCRefundable !== false;
          if (isRefundable) {
            // Refundable: apply against remaining tax, excess is refundable
            const usedAgainstTax = Math.min(taxAfterCredits, stateEITC);
            taxAfterCredits -= usedAgainstTax;
            refundableExcess += stateEITC - usedAgainstTax;
          } else {
            taxAfterCredits = Math.max(0, taxAfterCredits - stateEITC);
          }
        }
      }

      // If no hooks set taxAfterCredits and no EITC, apply credits directly
      if (!config.hooks?.credits && !config.stateEITCRate) {
        taxAfterCredits = Math.max(0, taxBeforeCredits - stateCredits);
      }

      // ── Step 10: Local Tax (hook) ────────────────
      let localTax = 0;
      if (config.hooks?.localTax) {
        localTax = config.hooks.localTax(
          taxReturn, federalResult,
          { taxableIncome, taxAfterCredits },
          stateConfig,
        );
      }

      // ── Step 11: Withholding & Payments ──────────
      const stateWithholding = getStateWithholding(taxReturn, config.stateCode);
      const estimatedPayments = 0;
      const totalPayments = stateWithholding + estimatedPayments;

      const totalStateTax = tb.trace(
        'state.totalTax', `${sName} Total Tax`,
        taxAfterCredits + localTax, {
          authority: refs?.totalTaxLine,
          formula: stateCredits > 0 && localTax > 0
            ? 'Income Tax − Credits + Local Tax'
            : stateCredits > 0 ? 'Income Tax − Credits'
            : localTax > 0 ? 'Income Tax + Local Tax' : 'Income Tax',
          inputs: [
            { lineId: 'state.incomeTax', label: 'Income Tax', value: taxBeforeCredits },
            ...(stateCredits > 0 ? [{ lineId: 'state.credits', label: 'Credits', value: stateCredits }] : []),
            ...(localTax > 0 ? [{ lineId: 'state.localTax', label: 'Local Tax', value: localTax }] : []),
          ],
        },
      );

      const refundOrOwedRaw = totalPayments - totalStateTax + refundableExcess;
      const refundOrOwed = tb.trace(
        'state.refundOrOwed',
        refundOrOwedRaw >= 0 ? `${sName} Refund` : `${sName} Amount Owed`,
        refundOrOwedRaw, {
          authority: refs?.refundLine,
          formula: 'Withholding − Total Tax' + (refundableExcess > 0 ? ' + Refundable Credits' : ''),
          inputs: [
            { lineId: 'state.totalTax', label: 'Total State Tax', value: totalStateTax },
            ...(stateWithholding > 0 ? [{ lineId: 'state.withholding', label: 'Withholding', value: stateWithholding }] : []),
            ...(refundableExcess > 0 ? [{ lineId: 'state.refundableExcess', label: 'Refundable Credits', value: refundableExcess }] : []),
          ],
        },
      );

      const effectiveRate = f.agi > 0
        ? Math.round((totalStateTax / f.agi) * 10000) / 10000
        : 0;

      return {
        stateCode: config.stateCode,
        stateName: getStateName(config.stateCode),
        residencyType: stateConfig.residencyType,
        federalAGI: f.agi,
        stateAdditions: additions,
        stateSubtractions: subtractions,
        stateAGI,
        stateDeduction,
        stateTaxableIncome: taxableIncome,
        stateExemptions: totalExemptions,
        stateIncomeTax: taxBeforeCredits,
        stateCredits,
        stateTaxAfterCredits: taxAfterCredits,
        localTax,
        totalStateTax,
        stateWithholding,
        stateEstimatedPayments: estimatedPayments,
        stateRefundOrOwed: refundOrOwed,
        effectiveStateRate: effectiveRate,
        bracketDetails,
        additionalLines: {
          ...(surtax > 0 ? { surtax } : {}),
          ...(stateEITC > 0 ? { stateEITC } : {}),
          ...(refundableExcess > 0 ? { refundableExcess } : {}),
        },
        traces: tb.build(),
      };
    },
  };
}
