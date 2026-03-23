/**
 * Archetype: Investor — 1099-B trades, 1099-DIV, K-1, possible AMT.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { generateW2, generateMultiple1099B, generate1099DIV, generate1099INT, generateK1 } from '../generators/income';
import { generateAMTData, applyCapitalLossCarryforward } from '../generators/deductions';
import { generateForeignTaxCredit } from '../generators/credits';
import { pickState } from '../generators/state';

export function buildInvestor(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = rng.weighted([[1, 4], [2, 4], [3, 2]]); // Single, MFJ, or MFS
  tr.state = pickState(rng);

  if (tr.filingStatus === 2 || tr.filingStatus === 3) {
    tr.spouseFirstName = rng.firstName();
    tr.spouseLastName = tr.lastName;
    tr.spouseSsn = rng.ssn();
    tr.spouseDateOfBirth = rng.dateOfBirth(30, 60);
    tr.spouseOccupation = 'Financial Analyst';
  }

  // Base W-2
  tr.w2Income = [generateW2(rng, { wagesMin: 80000, wagesMax: 200000, state: tr.state })];

  // 1099-B trades (3-20)
  const numTrades = rng.int(3, 20);
  tr.income1099B = generateMultiple1099B(rng, numTrades, { min: 1000, max: 80000 });

  // Dividends
  tr.income1099DIV = [generate1099DIV(rng, { min: 2000, max: 30000 })];
  if (rng.chance(0.3)) {
    tr.income1099DIV.push(generate1099DIV(rng, { min: 500, max: 10000 }));
  }

  // Interest
  tr.income1099INT = [generate1099INT(rng, { min: 500, max: 8000 })];

  // K-1 (partnership or trust)
  if (rng.chance(0.4)) {
    tr.incomeK1 = [generateK1(rng, { type: rng.pick(['partnership', 'trust'] as const) })];
  }

  // Capital loss carryforward
  applyCapitalLossCarryforward(rng, tr);

  // Possible AMT
  if (rng.chance(0.3)) {
    tr.amtData = generateAMTData(rng);
  }

  // Foreign tax credit from international dividends
  if (rng.chance(0.4)) {
    tr.foreignTaxCreditCategories = generateForeignTaxCredit(rng);
  }

  tr.deductionMethod = 'standard';
}
