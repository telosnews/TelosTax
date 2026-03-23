/**
 * Archetype: Dual-Income Family — MFJ, 2 W-2s, 1-4 kids, CTC.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { generateW2 } from '../generators/income';
import { generateQualifyingChildren } from '../generators/dependents';
import { applyChildTaxCredit } from '../generators/credits';
import { applyAdjustments } from '../generators/deductions';
import { pickState } from '../generators/state';

export function buildDualIncomeFamily(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = 2; // MFJ
  tr.spouseFirstName = rng.firstName();
  tr.spouseLastName = tr.lastName;
  tr.spouseSsn = rng.ssn();
  tr.spouseDateOfBirth = rng.dateOfBirth(25, 55);
  tr.spouseOccupation = 'Manager';

  const state = pickState(rng);
  tr.state = state;

  tr.w2Income = [
    generateW2(rng, { wagesMin: 40000, wagesMax: 130000, state }),
    generateW2(rng, { wagesMin: 30000, wagesMax: 100000, state }),
  ];

  const numKids = rng.int(1, 4);
  tr.dependents = generateQualifyingChildren(rng, numKids);
  applyChildTaxCredit(tr, numKids, 0);

  // Maybe dependent care
  if (rng.chance(0.4)) {
    tr.dependentCare = {
      totalExpenses: rng.wholeDollars(3000, 6000),
      qualifyingPersons: Math.min(numKids, 2),
    };
  }

  applyAdjustments(rng, tr, { hasStudentLoan: rng.chance(0.2) });
  tr.deductionMethod = 'standard';
}
