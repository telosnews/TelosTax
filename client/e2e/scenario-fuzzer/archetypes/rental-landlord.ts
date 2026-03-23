/**
 * Archetype: Rental Landlord — 1-3 rental properties, passive loss (Form 8582).
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { generateW2, generateRentalProperty } from '../generators/income';
import { applyAdjustments } from '../generators/deductions';
import { pickState } from '../generators/state';

export function buildRentalLandlord(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = rng.pick([1, 2]); // Single or MFJ
  tr.state = pickState(rng);

  if (tr.filingStatus === 2) {
    tr.spouseFirstName = rng.firstName();
    tr.spouseLastName = tr.lastName;
    tr.spouseSsn = rng.ssn();
    tr.spouseDateOfBirth = rng.dateOfBirth(30, 60);
    tr.spouseOccupation = 'Real Estate Agent';
  }

  // Base W-2 income
  tr.w2Income = [generateW2(rng, { wagesMin: 50000, wagesMax: 150000, state: tr.state })];

  // 1-3 rental properties
  const numRentals = rng.int(1, 3);
  tr.rentalProperties = Array.from({ length: numRentals }, () => generateRentalProperty(rng));

  // Form 8582 data
  if (rng.chance(0.5)) {
    tr.form8582Data = {
      priorYearUnallowedLoss: rng.wholeDollars(1000, 15000),
      isRealEstateProfessional: rng.chance(0.1),
    };
  }

  applyAdjustments(rng, tr);
  tr.deductionMethod = rng.chance(0.4) ? 'itemized' : 'standard';

  if (tr.deductionMethod === 'itemized') {
    tr.itemizedDeductions = {
      medicalExpenses: 0,
      stateLocalIncomeTax: rng.wholeDollars(3000, 10000),
      realEstateTax: rng.wholeDollars(3000, 12000),
      personalPropertyTax: 0,
      mortgageInterest: rng.wholeDollars(5000, 20000),
      mortgageInsurancePremiums: 0,
      charitableCash: rng.wholeDollars(500, 5000),
      charitableNonCash: 0,
      casualtyLoss: 0,
      otherDeductions: 0,
    };
  }
}
