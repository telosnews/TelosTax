/**
 * Archetype: Simple W-2 — Single or HOH, one W-2, standard deduction.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { generateW2 } from '../generators/income';
import { pickState } from '../generators/state';

export function buildSimpleW2(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = rng.pick([1, 4]); // Single or HOH
  tr.state = pickState(rng);
  tr.w2Income = [generateW2(rng, { wagesMin: 25000, wagesMax: 120000, state: tr.state })];
  tr.deductionMethod = 'standard';

  if (tr.filingStatus === 4) {
    tr.paidOverHalfHouseholdCost = true;
  }
}
