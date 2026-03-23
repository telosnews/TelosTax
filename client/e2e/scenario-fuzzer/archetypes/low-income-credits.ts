/**
 * Archetype: Low-Income Credits — EITC + CTC + AOTC + dependent care + PTC.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { generateW2 } from '../generators/income';
import { generateQualifyingChildren } from '../generators/dependents';
import { applyChildTaxCredit, generateEducationCredits, generateDependentCare, generatePremiumTaxCredit } from '../generators/credits';
import { pickState } from '../generators/state';

export function buildLowIncomeCredits(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = rng.weighted([[1, 2], [4, 4], [2, 2]]); // HOH most common
  tr.state = pickState(rng);

  if (tr.filingStatus === 2) {
    tr.spouseFirstName = rng.firstName();
    tr.spouseLastName = tr.lastName;
    tr.spouseSsn = rng.ssn();
    tr.spouseDateOfBirth = rng.dateOfBirth(22, 45);
    tr.spouseOccupation = 'Cashier';
  }

  // Low income W-2
  const wages = tr.filingStatus === 2
    ? rng.wholeDollars(20000, 45000)
    : rng.wholeDollars(12000, 30000);
  tr.w2Income = [generateW2(rng, { wagesMin: wages, wagesMax: wages, state: tr.state })];

  // 1-3 kids
  const numKids = rng.int(1, 3);
  tr.dependents = generateQualifyingChildren(rng, numKids);
  applyChildTaxCredit(tr, numKids, 0);

  // Education credit (AOTC for a dependent or self)
  if (rng.chance(0.4)) {
    tr.educationCredits = generateEducationCredits(rng, 1);
  }

  // Dependent care
  if (rng.chance(0.5)) {
    tr.dependentCare = generateDependentCare(rng, numKids);
  }

  // Premium tax credit (marketplace insurance)
  if (rng.chance(0.4)) {
    tr.premiumTaxCredit = generatePremiumTaxCredit(rng, 1 + numKids);
  }

  tr.deductionMethod = 'standard';

  if (tr.filingStatus === 4) {
    tr.paidOverHalfHouseholdCost = true;
  }
}
