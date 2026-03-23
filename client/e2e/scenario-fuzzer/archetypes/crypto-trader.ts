/**
 * Archetype: Crypto Trader — 1099-DA transactions, W-2, digital asset flag.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { generateW2, generate1099DA } from '../generators/income';
import { applyCapitalLossCarryforward } from '../generators/deductions';
import { pickState } from '../generators/state';

export function buildCryptoTrader(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = rng.pick([1, 2]); // Single or MFJ
  tr.state = pickState(rng);

  if (tr.filingStatus === 2) {
    tr.spouseFirstName = rng.firstName();
    tr.spouseLastName = tr.lastName;
    tr.spouseSsn = rng.ssn();
    tr.spouseDateOfBirth = rng.dateOfBirth(25, 45);
    tr.spouseOccupation = 'Developer';
  }

  // W-2 base income
  tr.w2Income = [generateW2(rng, { wagesMin: 50000, wagesMax: 150000, state: tr.state })];

  // 1099-DA crypto transactions (3-30)
  const numTxns = rng.int(3, 30);
  tr.income1099DA = Array.from({ length: numTxns }, () =>
    generate1099DA(rng, { min: 100, max: 20000 })
  );

  tr.digitalAssetActivity = true;
  applyCapitalLossCarryforward(rng, tr);
  tr.deductionMethod = 'standard';
}
