/**
 * Archetype: Retiree — SSA-1099 + 1099-R + dividends/interest.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { generateSSA1099, generate1099R, generate1099INT, generate1099DIV } from '../generators/income';
import { pickState } from '../generators/state';

export function buildRetiree(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = rng.weighted([[1, 3], [2, 3], [5, 1]]); // Single, MFJ, or QSS
  tr.dateOfBirth = rng.dateOfBirth(62, 85);
  tr.state = pickState(rng);

  if (tr.filingStatus === 2 || tr.filingStatus === 5) {
    tr.spouseFirstName = rng.firstName();
    tr.spouseLastName = tr.lastName;
    tr.spouseSsn = rng.ssn();
    tr.spouseDateOfBirth = rng.dateOfBirth(60, 83);
    tr.spouseOccupation = 'Retired';
  }

  tr.occupation = 'Retired';

  // Social Security
  tr.incomeSSA1099 = generateSSA1099(rng, { min: 12000, max: 42000 });

  // Pension / IRA distributions
  tr.income1099R = [generate1099R(rng, { min: 10000, max: 60000 })];
  if (rng.chance(0.3)) {
    tr.income1099R.push(generate1099R(rng, { min: 5000, max: 30000 }));
  }

  // Interest income
  if (rng.chance(0.7)) {
    tr.income1099INT = [generate1099INT(rng, { min: 200, max: 5000 })];
  }

  // Dividends
  if (rng.chance(0.6)) {
    tr.income1099DIV = [generate1099DIV(rng, { min: 500, max: 10000 })];
  }

  tr.deductionMethod = 'standard';
}
