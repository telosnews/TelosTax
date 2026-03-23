/**
 * Archetype: Self-Employed Couple — MFJ, mixed W-2 + 1099-NEC, multi-business.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { generateW2, generate1099NEC } from '../generators/income';
import { generateBusiness, generateLegacyBusiness, generateExpenses, generateHomeOffice, generateVehicle, generateSEDeductions } from '../generators/self-employment';
import { generateQualifyingChildren } from '../generators/dependents';
import { applyChildTaxCredit } from '../generators/credits';
import { applyAdjustments } from '../generators/deductions';
import { pickState } from '../generators/state';

export function buildSelfEmployedCouple(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = 2; // MFJ
  tr.spouseFirstName = rng.firstName();
  tr.spouseLastName = tr.lastName;
  tr.spouseSsn = rng.ssn();
  tr.spouseDateOfBirth = rng.dateOfBirth(28, 55);
  tr.spouseOccupation = 'Consultant';

  const state = pickState(rng);
  tr.state = state;

  // Spouse has W-2
  tr.w2Income = [generateW2(rng, { wagesMin: 40000, wagesMax: 100000, state })];

  // Taxpayer has 1-2 businesses
  const biz1Id = rng.uuid();
  tr.businesses = [generateBusiness(rng, biz1Id)];
  tr.business = generateLegacyBusiness(rng);

  tr.income1099NEC = [
    generate1099NEC(rng, { min: 30000, max: 120000, businessId: biz1Id }),
  ];

  if (rng.chance(0.4)) {
    const biz2Id = rng.uuid();
    tr.businesses.push(generateBusiness(rng, biz2Id));
    tr.income1099NEC.push(generate1099NEC(rng, { min: 10000, max: 50000, businessId: biz2Id }));
    tr.expenses = [...generateExpenses(rng, biz1Id), ...generateExpenses(rng, biz2Id)];
  } else {
    tr.expenses = generateExpenses(rng, biz1Id);
  }

  tr.homeOffice = generateHomeOffice(rng);
  tr.vehicle = generateVehicle(rng);
  tr.selfEmploymentDeductions = generateSEDeductions(rng);

  // Kids
  if (rng.chance(0.5)) {
    const numKids = rng.int(1, 3);
    tr.dependents = generateQualifyingChildren(rng, numKids);
    applyChildTaxCredit(tr, numKids, 0);
  }

  applyAdjustments(rng, tr, { hasHSA: rng.chance(0.3) });
  tr.deductionMethod = 'standard';
}
