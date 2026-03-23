/**
 * Archetype: Self-Employed Single — 1099-NEC, Schedule C, home office, vehicle.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { generate1099NEC } from '../generators/income';
import { generateBusiness, generateLegacyBusiness, generateExpenses, generateHomeOffice, generateVehicle, generateSEDeductions } from '../generators/self-employment';
import { applyAdjustments } from '../generators/deductions';
import { pickState } from '../generators/state';

export function buildSelfEmployedSingle(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = rng.pick([1, 4]); // Single or HOH
  tr.state = pickState(rng);

  const bizId = rng.uuid();
  tr.businesses = [generateBusiness(rng, bizId)];
  tr.business = generateLegacyBusiness(rng);

  tr.income1099NEC = [
    generate1099NEC(rng, { min: 20000, max: 100000, businessId: bizId }),
  ];

  // Maybe additional 1099-NEC
  if (rng.chance(0.3)) {
    tr.income1099NEC.push(generate1099NEC(rng, { min: 5000, max: 30000, businessId: bizId }));
  }

  tr.expenses = generateExpenses(rng, bizId);
  tr.homeOffice = generateHomeOffice(rng);
  tr.vehicle = generateVehicle(rng);
  tr.selfEmploymentDeductions = generateSEDeductions(rng);

  applyAdjustments(rng, tr, { hasHSA: rng.chance(0.3) });
  tr.deductionMethod = 'standard';

  if (tr.filingStatus === 4) {
    tr.paidOverHalfHouseholdCost = true;
  }
}
