/**
 * Archetype: High-Income Itemizer — W-2 $200k-$600k, SALT cap, mortgage, AMT territory.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { generateW2 } from '../generators/income';
import { generateItemizedDeductions, generateAMTData, applyAdjustments } from '../generators/deductions';
import { pickState } from '../generators/state';

export function buildHighIncomeItemizer(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = rng.weighted([[1, 4], [2, 4], [3, 2]]); // Single, MFJ, or MFS
  const state = rng.pick(['CA', 'NY', 'NJ', 'CT', 'MA', 'IL', 'MD'] as const);
  tr.state = state;

  if (tr.filingStatus === 2 || tr.filingStatus === 3) {
    tr.spouseFirstName = rng.firstName();
    tr.spouseLastName = tr.lastName;
    tr.spouseSsn = rng.ssn();
    tr.spouseDateOfBirth = rng.dateOfBirth(30, 55);
    tr.spouseOccupation = 'Executive';

    if (tr.filingStatus === 3) {
      // MFS: typically one W-2
      tr.w2Income = [generateW2(rng, { wagesMin: 200000, wagesMax: 400000, state })];
    } else {
      tr.w2Income = [
        generateW2(rng, { wagesMin: 150000, wagesMax: 350000, state }),
        generateW2(rng, { wagesMin: 100000, wagesMax: 250000, state }),
      ];
    }
  } else {
    tr.w2Income = [generateW2(rng, { wagesMin: 200000, wagesMax: 600000, state })];
  }

  tr.deductionMethod = 'itemized';
  tr.itemizedDeductions = generateItemizedDeductions(rng, { highIncome: true });

  // AMT likely
  if (rng.chance(0.5)) {
    tr.amtData = generateAMTData(rng);
  }

  applyAdjustments(rng, tr, {
    hasHSA: rng.chance(0.3),
    hasIRA: false, // income too high for deduction
  });
}
