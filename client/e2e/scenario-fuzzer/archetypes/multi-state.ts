/**
 * Archetype: Multi-State — 2-3 state returns, W-2 multi-state withholding.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { generateW2 } from '../generators/income';
import { generateStateReturns } from '../generators/state';
import { applyAdjustments } from '../generators/deductions';

const MULTI_STATE_COMBOS = [
  { home: 'NJ', work: 'NY' },
  { home: 'CT', work: 'NY' },
  { home: 'VA', work: 'DC' },
  { home: 'MD', work: 'DC' },
  { home: 'IN', work: 'IL' },
  { home: 'NH', work: 'MA' },
  { home: 'PA', work: 'NJ' },
  { home: 'CA', work: 'OR' },
] as const;

export function buildMultiState(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = rng.pick([1, 2, 4]);
  const combo = rng.pick(MULTI_STATE_COMBOS);
  tr.state = combo.home;

  if (tr.filingStatus === 2) {
    tr.spouseFirstName = rng.firstName();
    tr.spouseLastName = tr.lastName;
    tr.spouseSsn = rng.ssn();
    tr.spouseDateOfBirth = rng.dateOfBirth(28, 55);
    tr.spouseOccupation = 'Teacher';
  }

  // W-2 with work state
  const wages = rng.wholeDollars(50000, 150000);
  const w2 = generateW2(rng, { wagesMin: wages, wagesMax: wages, state: combo.work });
  tr.w2Income = [w2];

  // Maybe second W-2 in home state
  if (rng.chance(0.3)) {
    tr.w2Income.push(generateW2(rng, { wagesMin: 20000, wagesMax: 60000, state: combo.home }));
  }

  // State returns
  tr.stateReturns = generateStateReturns(rng, {
    count: rng.chance(0.3) ? 3 : 2,
    homeState: combo.home,
    totalIncome: wages,
  });

  applyAdjustments(rng, tr);
  tr.deductionMethod = 'standard';

  if (tr.filingStatus === 4) {
    tr.paidOverHalfHouseholdCost = true;
  }
}
