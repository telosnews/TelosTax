/**
 * State return generators — realistic state return configurations.
 */

import type { Rng } from './random';

const INCOME_TAX_STATES = [
  'AL', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'UT', 'VT',
  'VA', 'WV', 'WI',
] as const;

const NO_INCOME_TAX_STATES = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'] as const;

/** Generate a single state return config. */
export function generateStateReturn(rng: Rng, opts?: {
  stateCode?: string;
  residency?: 'resident' | 'nonresident' | 'part_year';
  totalIncome?: number;
}): Record<string, unknown> {
  const stateCode = opts?.stateCode ?? rng.pick(INCOME_TAX_STATES);
  const residency = opts?.residency ?? 'resident';

  const stateReturn: Record<string, unknown> = {
    stateCode,
    residencyType: residency,
  };

  if (residency === 'part_year') {
    stateReturn.daysLived = rng.int(90, 270);
  }

  if (residency === 'nonresident' && opts?.totalIncome) {
    stateReturn.stateSourceIncome = Math.round(opts.totalIncome * rng.float(0.3, 0.8));
  }

  return stateReturn;
}

/** Generate 1-3 state returns with realistic combos. */
export function generateStateReturns(rng: Rng, opts?: {
  count?: number;
  homeState?: string;
  totalIncome?: number;
}): Record<string, unknown>[] {
  const count = opts?.count ?? rng.int(1, 2);
  const homeState = opts?.homeState ?? rng.pick(INCOME_TAX_STATES);
  const states: Record<string, unknown>[] = [];

  // Home/resident state
  states.push(generateStateReturn(rng, {
    stateCode: homeState,
    residency: 'resident',
  }));

  // Additional nonresident states
  if (count >= 2) {
    const otherStates = INCOME_TAX_STATES.filter((s) => s !== homeState);
    const extra = rng.pickN(otherStates, count - 1);
    for (const state of extra) {
      states.push(generateStateReturn(rng, {
        stateCode: state,
        residency: 'nonresident',
        totalIncome: opts?.totalIncome,
      }));
    }
  }

  return states;
}

/** Pick a random income-tax state for W-2 state field. */
export function pickState(rng: Rng): string {
  return rng.pick(INCOME_TAX_STATES);
}

/** Pick a random state (including no-income-tax states). */
export function pickAnyState(rng: Rng): string {
  return rng.pick([...INCOME_TAX_STATES, ...NO_INCOME_TAX_STATES]);
}
