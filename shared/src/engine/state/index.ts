/**
 * State Tax Engine — Entry point.
 *
 * Calculates state income tax for each state the taxpayer files in.
 * Uses the federal CalculationResult as the starting point, then applies
 * state-specific modifications (additions, subtractions, brackets, credits).
 *
 * For part-year and nonresident filers, income is allocated before passing
 * to individual state calculators. Resident states may receive a credit for
 * taxes paid to other states (two-pass approach: nonresident first, then resident).
 */

import {
  TaxReturn, CalculationResult, StateCalculationResult,
  StateReturnConfig, FilingStatus, StateTaxBracket, StateBracketDetail,
} from '../../types/index.js';
import { getStateCalculator, StateCalculator, NO_INCOME_TAX_STATES } from './stateRegistry.js';
import { allocateStateIncome, calculateOtherStateCredit } from './allocation.js';
import { round2 } from '../utils.js';

/**
 * Calculate state taxes for all states in the taxpayer's stateReturns array.
 *
 * Uses a two-pass approach:
 *   Pass 1: Calculate nonresident and part-year states (allocated income)
 *   Pass 2: Calculate resident states with credit for taxes paid to other states
 */
export function calculateStateTaxes(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
): StateCalculationResult[] {
  const configs = taxReturn.stateReturns || [];
  if (configs.length === 0) return [];

  // Sort: nonresident + part-year first, resident last (for other-state credit)
  const sorted = [...configs].sort((a, b) => {
    const order: Record<string, number> = { nonresident: 0, part_year: 1, resident: 2 };
    return (order[a.residencyType] || 0) - (order[b.residencyType] || 0);
  });

  const results: StateCalculationResult[] = [];
  const nonResidentResults: StateCalculationResult[] = [];

  for (const config of sorted) {
    const result = calculateOneState(taxReturn, federalResult, config, nonResidentResults);
    if (result) {
      results.push(result);
      if (config.residencyType !== 'resident') {
        nonResidentResults.push(result);
      }
    }
  }

  return results;
}

function calculateOneState(
  taxReturn: TaxReturn,
  federalResult: CalculationResult,
  config: StateReturnConfig,
  nonResidentResults: StateCalculationResult[],
): StateCalculationResult | null {
  // No income tax states — return zero result
  if (NO_INCOME_TAX_STATES.includes(config.stateCode)) {
    return {
      stateCode: config.stateCode,
      stateName: getStateName(config.stateCode),
      residencyType: config.residencyType,
      federalAGI: federalResult.form1040.agi,
      stateAdditions: 0,
      stateSubtractions: 0,
      stateAGI: 0,
      stateDeduction: 0,
      stateTaxableIncome: 0,
      stateExemptions: 0,
      stateIncomeTax: 0,
      stateCredits: 0,
      stateTaxAfterCredits: 0,
      localTax: 0,
      totalStateTax: 0,
      stateWithholding: getStateWithholding(taxReturn, config.stateCode),
      stateEstimatedPayments: 0,
      stateRefundOrOwed: getStateWithholding(taxReturn, config.stateCode),
      effectiveStateRate: 0,
    };
  }

  const calculator = getStateCalculator(config.stateCode);
  if (!calculator) {
    // Unsupported state — return null
    return null;
  }

  // ── Income allocation for part-year / nonresident filers ──
  const allocation = allocateStateIncome(taxReturn, federalResult, config);

  // For non-resident / part-year: create a modified federalResult with allocated AGI
  let effectiveFederalResult = federalResult;
  if (config.residencyType !== 'resident' && allocation.allocationRatio < 1.0) {
    effectiveFederalResult = createAllocatedFederalResult(federalResult, allocation);
    // Store original AGI for 540NR-style calculators (CA, NY)
    config = {
      ...config,
      stateSpecificData: {
        ...(config.stateSpecificData || {}),
        _originalFederalAGI: federalResult.form1040.agi,
        _allocationRatio: allocation.allocationRatio,
      },
    };
  }

  // Run the state calculator
  let result = calculator.calculate(taxReturn, effectiveFederalResult, config);

  // Store allocation info on the result
  result = {
    ...result,
    allocationRatio: allocation.allocationRatio,
    allocatedAGI: allocation.allocatedAGI,
  };

  // ── Credit for taxes paid to other states (resident returns only) ──
  if (config.residencyType === 'resident' && nonResidentResults.length > 0) {
    let totalOtherStateCredit = 0;
    const federalAGI = federalResult.form1040.agi;

    for (const nrResult of nonResidentResults) {
      const credit = calculateOtherStateCredit(
        result.totalStateTax,
        nrResult.totalStateTax,
        nrResult.allocatedAGI || nrResult.federalAGI,
        federalAGI,
      );
      totalOtherStateCredit = round2(totalOtherStateCredit + credit);
    }

    if (totalOtherStateCredit > 0) {
      const adjustedTotalTax = round2(Math.max(0, result.totalStateTax - totalOtherStateCredit));
      result = {
        ...result,
        stateCredits: round2(result.stateCredits + totalOtherStateCredit),
        stateTaxAfterCredits: round2(Math.max(0, result.stateTaxAfterCredits - totalOtherStateCredit)),
        totalStateTax: adjustedTotalTax,
        stateRefundOrOwed: round2(
          result.stateWithholding + result.stateEstimatedPayments - adjustedTotalTax,
        ),
        effectiveStateRate: federalAGI > 0
          ? Math.round((adjustedTotalTax / federalAGI) * 10000) / 10000
          : 0,
      };
    }
  }

  return result;
}

/**
 * Create a modified CalculationResult with allocated AGI for nonresident/part-year filers.
 * The state calculator will see the allocated AGI instead of the full federal AGI.
 */
function createAllocatedFederalResult(
  federalResult: CalculationResult,
  allocation: { allocatedAGI: number; allocationRatio: number; sourceWages: number },
): CalculationResult {
  const ratio = allocation.allocationRatio;
  const f = federalResult.form1040;

  return {
    ...federalResult,
    form1040: {
      ...f,
      agi: allocation.allocatedAGI,
      // Also scale taxable income proportionally
      taxableIncome: round2(f.taxableIncome * ratio),
      // Scale wages to state-source wages
      totalWages: allocation.sourceWages || round2(f.totalWages * ratio),
    },
  };
}

/**
 * Apply progressive tax brackets.
 */
export function applyBrackets(taxableIncome: number, brackets: StateTaxBracket[]): { tax: number; details: StateBracketDetail[] } {
  let remaining = Math.max(0, taxableIncome);
  let totalTax = 0;
  const details: StateBracketDetail[] = [];

  for (const bracket of brackets) {
    const bracketWidth = bracket.max - bracket.min;
    const taxableAtRate = Math.min(remaining, bracketWidth);
    if (taxableAtRate <= 0) break;

    const taxAtRate = Math.round(taxableAtRate * bracket.rate * 100) / 100;
    totalTax += taxAtRate;
    remaining -= taxableAtRate;

    details.push({
      rate: bracket.rate,
      taxableAtRate,
      taxAtRate,
    });
  }

  return { tax: Math.round(totalTax * 100) / 100, details };
}

/**
 * Sum state withholding from all income forms for a given state:
 * W-2 Box 17, W-2G Box 15, 1099-MISC Box 16, 1099-NEC Box 7,
 * 1099-R Box 14, 1099-G Box 11, 1099-INT Box 17, 1099-DIV Box 16.
 */
export function getStateWithholding(taxReturn: TaxReturn, stateCode: string): number {
  const upper = stateCode.toUpperCase();
  const sumByState = (items: { stateCode?: string; stateTaxWithheld?: number }[] | undefined) =>
    (items || [])
      .filter((i) => i.stateCode?.toUpperCase() === upper)
      .reduce((sum, i) => sum + (i.stateTaxWithheld || 0), 0);

  const w2 = (taxReturn.w2Income || [])
    .filter((w) => w.state?.toUpperCase() === upper)
    .reduce((sum, w) => sum + (w.stateTaxWithheld || 0), 0);

  return w2
    + sumByState(taxReturn.incomeW2G)
    + sumByState(taxReturn.income1099MISC)
    + sumByState(taxReturn.income1099NEC)
    + sumByState(taxReturn.income1099R)
    + sumByState(taxReturn.income1099G)
    + sumByState(taxReturn.income1099INT)
    + sumByState(taxReturn.income1099DIV);
}

/**
 * Get the filing status key used for state bracket/deduction lookups.
 * Most states use similar categories to federal, but map to simplified keys.
 */
export function getStateFilingKey(filingStatus: FilingStatus | undefined): string {
  switch (filingStatus) {
    case FilingStatus.MarriedFilingJointly:
    case FilingStatus.QualifyingSurvivingSpouse:
      return 'married_joint';
    case FilingStatus.MarriedFilingSeparately:
      return 'married_separate';
    case FilingStatus.HeadOfHousehold:
      return 'head_of_household';
    case FilingStatus.Single:
    default:
      return 'single';
  }
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

export function getStateName(code: string): string {
  return STATE_NAMES[code.toUpperCase()] || code;
}

export function getAllStates(): { code: string; name: string; hasIncomeTax: boolean }[] {
  return Object.entries(STATE_NAMES).map(([code, name]) => ({
    code,
    name,
    hasIncomeTax: !NO_INCOME_TAX_STATES.includes(code),
  }));
}
