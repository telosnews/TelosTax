/**
 * Archetype: Gig Worker — multiple 1099-NEC/K, vehicle, home office, low-income.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { generate1099NEC, generate1099K } from '../generators/income';
import { generateBusiness, generateLegacyBusiness, generateExpenses, generateHomeOffice, generateVehicle, generateSEDeductions } from '../generators/self-employment';
import { applyAdjustments } from '../generators/deductions';
import { pickState } from '../generators/state';

export function buildGigWorker(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = rng.pick([1, 4]); // Single or HOH
  tr.state = pickState(rng);

  const bizId = rng.uuid();
  tr.businesses = [generateBusiness(rng, bizId)];
  tr.business = generateLegacyBusiness(rng);

  // Multiple 1099-NECs (gig platforms)
  const numNEC = rng.int(2, 5);
  tr.income1099NEC = Array.from({ length: numNEC }, () =>
    generate1099NEC(rng, { min: 2000, max: 25000, businessId: bizId })
  );

  // Maybe 1099-K
  if (rng.chance(0.5)) {
    tr.income1099K = [generate1099K(rng, { min: 5000, max: 40000, businessId: bizId })];
  }

  tr.expenses = generateExpenses(rng, bizId);
  tr.vehicle = generateVehicle(rng, { method: 'standard' });

  if (rng.chance(0.4)) {
    tr.homeOffice = generateHomeOffice(rng, { simplified: true });
  }

  tr.selfEmploymentDeductions = generateSEDeductions(rng, { hasHealthInsurance: rng.chance(0.3) });
  applyAdjustments(rng, tr);
  tr.deductionMethod = 'standard';

  if (tr.filingStatus === 4) {
    tr.paidOverHalfHouseholdCost = true;
  }
}
