/**
 * State Calculator Registry — Maps state codes to calculation modules.
 *
 * All 50 states + DC are registered here. States fall into four categories:
 *   1. No-income-tax states (9) — return zero result
 *   2. Flat-tax states (13) — via createFlatTaxCalculator()
 *   3. Progressive-tax states (20) — via createProgressiveTaxCalculator()
 *   4. Custom calculators (9) — CA, NY, NJ, OH, WI, CT, MD, AL, HI
 */

import {
  TaxReturn, CalculationResult, StateCalculationResult, StateReturnConfig,
} from '../../types/index.js';

// Custom state calculators
import { calculateNewYork } from './ny.js';
import { calculateCalifornia } from './ca.js';
import { calculateNewJersey } from './nj.js';
import { calculateOhio } from './oh.js';
import { calculateWisconsin } from './wi.js';
import { calculateConnecticut } from './ct.js';
import { calculateMaryland } from './md.js';
import { calculateAlabama } from './al.js';
import { calculateHawaii } from './hi.js';

// Factories
import { createFlatTaxCalculator } from './flatTax.js';
import { createProgressiveTaxCalculator } from './progressiveTax.js';

// Progressive state configs
import {
  VA_CONFIG, MN_CONFIG, OR_CONFIG, MO_CONFIG, SC_CONFIG,
  MS_CONFIG, KS_CONFIG, OK_CONFIG, AR_CONFIG, ID_CONFIG,
  ND_CONFIG, RI_CONFIG, WV_CONFIG, ME_CONFIG, NM_CONFIG,
  MT_CONFIG, NE_CONFIG, VT_CONFIG, DE_CONFIG, DC_CONFIG,
} from '../../constants/states/progressiveTax.js';

/** Interface that all state calculators implement. */
export interface StateCalculator {
  calculate(
    taxReturn: TaxReturn,
    federalResult: CalculationResult,
    config: StateReturnConfig,
  ): StateCalculationResult;
}

/** States with no income tax — immediate zero result. */
export const NO_INCOME_TAX_STATES = [
  'AK', // Alaska
  'FL', // Florida
  'NV', // Nevada
  'NH', // New Hampshire (Interest & Dividends tax fully repealed effective 1/1/2025)
  'SD', // South Dakota
  'TN', // Tennessee (Hall tax fully repealed 2021)
  'TX', // Texas
  'WA', // Washington (no income tax; capital gains excise tax is separate)
  'WY', // Wyoming
];

/** Flat-tax states — single rate with simple deductions. */
export const FLAT_TAX_STATES = [
  'AZ', // 2.5%
  'CO', // 4.4%
  'GA', // 5.19% (HB 111, retroactive TY2025)
  'IA', // 3.8%
  'IL', // 4.95%
  'IN', // 3.0%
  'KY', // 4.0%
  'LA', // 3.0% (Act 11 reform TY2025)
  'MA', // 5.0%
  'MI', // 4.25%
  'NC', // 4.25%
  'PA', // 3.07%
  'UT', // 4.5%
];

/** Progressive-tax states — graduated brackets via factory. */
export const PROGRESSIVE_TAX_STATES = [
  'AR', 'DC', 'DE', 'ID', 'KS', 'ME', 'MN', 'MO', 'MS', 'MT',
  'ND', 'NE', 'NM', 'OK', 'OR', 'RI', 'SC', 'VA', 'VT', 'WV',
];

/** Registry of implemented state calculators. */
const CALCULATORS: Record<string, StateCalculator> = {
  // Custom calculators (complex state-specific rules)
  CA: { calculate: calculateCalifornia },
  NY: { calculate: calculateNewYork },
  NJ: { calculate: calculateNewJersey },
  OH: { calculate: calculateOhio },
  WI: { calculate: calculateWisconsin },
  CT: { calculate: calculateConnecticut },
  MD: { calculate: calculateMaryland },
  AL: { calculate: calculateAlabama },
  HI: { calculate: calculateHawaii },

  // Flat-tax states
  PA: createFlatTaxCalculator('PA'),
  IL: createFlatTaxCalculator('IL'),
  MA: createFlatTaxCalculator('MA'),
  NC: createFlatTaxCalculator('NC'),
  MI: createFlatTaxCalculator('MI'),
  IN: createFlatTaxCalculator('IN'),
  CO: createFlatTaxCalculator('CO'),
  KY: createFlatTaxCalculator('KY'),
  UT: createFlatTaxCalculator('UT'),
  GA: createFlatTaxCalculator('GA'),
  AZ: createFlatTaxCalculator('AZ'),
  LA: createFlatTaxCalculator('LA'),
  IA: createFlatTaxCalculator('IA'),

  // Progressive-tax states
  VA: createProgressiveTaxCalculator(VA_CONFIG),
  MN: createProgressiveTaxCalculator(MN_CONFIG),
  OR: createProgressiveTaxCalculator(OR_CONFIG),
  MO: createProgressiveTaxCalculator(MO_CONFIG),
  SC: createProgressiveTaxCalculator(SC_CONFIG),
  MS: createProgressiveTaxCalculator(MS_CONFIG),
  KS: createProgressiveTaxCalculator(KS_CONFIG),
  OK: createProgressiveTaxCalculator(OK_CONFIG),
  AR: createProgressiveTaxCalculator(AR_CONFIG),
  ID: createProgressiveTaxCalculator(ID_CONFIG),
  ND: createProgressiveTaxCalculator(ND_CONFIG),
  RI: createProgressiveTaxCalculator(RI_CONFIG),
  WV: createProgressiveTaxCalculator(WV_CONFIG),
  ME: createProgressiveTaxCalculator(ME_CONFIG),
  NM: createProgressiveTaxCalculator(NM_CONFIG),
  MT: createProgressiveTaxCalculator(MT_CONFIG),
  NE: createProgressiveTaxCalculator(NE_CONFIG),
  VT: createProgressiveTaxCalculator(VT_CONFIG),
  DE: createProgressiveTaxCalculator(DE_CONFIG),
  DC: createProgressiveTaxCalculator(DC_CONFIG),
};

/**
 * Get the calculator for a state. Returns null if the state isn't implemented yet.
 */
export function getStateCalculator(stateCode: string): StateCalculator | null {
  return CALCULATORS[stateCode.toUpperCase()] || null;
}

/**
 * Check if a state's tax calculation is supported.
 */
export function isStateSupported(stateCode: string): boolean {
  const code = stateCode.toUpperCase();
  return NO_INCOME_TAX_STATES.includes(code) || code in CALCULATORS;
}

/**
 * Get all supported state codes.
 */
export function getSupportedStates(): string[] {
  return [...NO_INCOME_TAX_STATES, ...Object.keys(CALCULATORS)];
}
