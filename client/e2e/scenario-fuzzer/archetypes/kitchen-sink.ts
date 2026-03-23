/**
 * Archetype: Kitchen Sink — every income/credit/deduction type enabled.
 * The ultimate stress test for the wizard.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import {
  generateW2, generate1099NEC, generate1099K, generate1099INT, generate1099DIV,
  generate1099R, generate1099G, generate1099MISC, generate1099B, generate1099DA,
  generateSSA1099, generateK1, generateW2G, generateRentalProperty,
  generate1099SA, generate1099C, generate1099Q,
} from '../generators/income';
import { generateBusiness, generateLegacyBusiness, generateExpenses, generateHomeOffice, generateVehicle, generateSEDeductions, generateDepreciationAssets, generateCOGS } from '../generators/self-employment';
import { generateQualifyingChildren } from '../generators/dependents';
import { generateItemizedDeductions, generateAMTData, applyAdjustments, generateSchedule1A, generateInvestmentInterest, generateForm8606, applyCapitalLossCarryforward } from '../generators/deductions';
import { applyCredits } from '../generators/credits';
import { generateStateReturns } from '../generators/state';

export function buildKitchenSink(rng: Rng, tr: FuzzerTaxReturn): void {
  tr.filingStatus = 2; // MFJ
  tr.spouseFirstName = rng.firstName();
  tr.spouseLastName = tr.lastName;
  tr.spouseSsn = rng.ssn();
  tr.spouseDateOfBirth = rng.dateOfBirth(30, 55);
  tr.spouseOccupation = 'Manager';
  tr.state = rng.pick(['CA', 'NY', 'NJ', 'TX', 'IL'] as const);

  // W-2
  tr.w2Income = [
    generateW2(rng, { wagesMin: 80000, wagesMax: 150000, state: tr.state }),
  ];

  // 1099-NEC + business
  const bizId = rng.uuid();
  tr.businesses = [generateBusiness(rng, bizId)];
  tr.business = generateLegacyBusiness(rng);
  tr.income1099NEC = [generate1099NEC(rng, { min: 15000, max: 60000, businessId: bizId })];
  tr.expenses = generateExpenses(rng, bizId);
  tr.homeOffice = generateHomeOffice(rng);
  tr.vehicle = generateVehicle(rng);
  tr.depreciationAssets = generateDepreciationAssets(rng, rng.int(1, 3));
  tr.costOfGoodsSold = generateCOGS(rng);
  tr.selfEmploymentDeductions = generateSEDeductions(rng);

  // 1099-K
  tr.income1099K = [generate1099K(rng, { min: 5000, max: 20000, businessId: bizId })];

  // 1099-INT
  tr.income1099INT = [generate1099INT(rng)];

  // 1099-DIV
  tr.income1099DIV = [generate1099DIV(rng)];

  // 1099-R
  tr.income1099R = [generate1099R(rng, { min: 5000, max: 30000 })];

  // 1099-G
  tr.income1099G = [generate1099G(rng)];

  // 1099-MISC
  tr.income1099MISC = [generate1099MISC(rng)];

  // 1099-B
  tr.income1099B = Array.from({ length: rng.int(3, 8) }, () => generate1099B(rng));

  // 1099-DA
  tr.income1099DA = Array.from({ length: rng.int(2, 5) }, () => generate1099DA(rng));
  tr.digitalAssetActivity = true;

  // SSA-1099
  tr.incomeSSA1099 = generateSSA1099(rng, { min: 10000, max: 25000 });

  // K-1
  tr.incomeK1 = [generateK1(rng)];

  // W-2G
  tr.incomeW2G = [generateW2G(rng)];
  tr.gamblingLosses = rng.wholeDollars(500, 3000);

  // Rental
  tr.rentalProperties = [generateRentalProperty(rng)];

  // 1099-SA
  tr.income1099SA = [generate1099SA(rng)];

  // 1099-C
  tr.income1099C = [generate1099C(rng)];

  // 1099-Q
  tr.income1099Q = [generate1099Q(rng)];

  // Other income
  tr.otherIncome = rng.wholeDollars(100, 2000);

  // Dependents
  const numKids = rng.int(1, 3);
  tr.dependents = generateQualifyingChildren(rng, numKids);

  // Deductions
  tr.deductionMethod = 'itemized';
  tr.itemizedDeductions = generateItemizedDeductions(rng, { highIncome: true });
  tr.amtData = generateAMTData(rng);
  tr.schedule1A = generateSchedule1A(rng);
  tr.investmentInterest = generateInvestmentInterest(rng);
  tr.form8606 = generateForm8606(rng);
  applyCapitalLossCarryforward(rng, tr);

  applyAdjustments(rng, tr, {
    hasStudentLoan: true,
    hasIRA: true,
    hasHSA: true,
    hasEducator: true,
    hasEstimatedPayments: true,
  });

  // Credits — enable everything
  applyCredits(rng, tr, {
    childTaxCredit: true,
    educationCredits: true,
    dependentCare: true,
    saversCredit: true,
    cleanEnergy: true,
    evCredit: true,
    energyEfficiency: true,
    adoptionCredit: rng.chance(0.3),
    premiumTaxCredit: rng.chance(0.3),
    elderlyDisabled: false,
    foreignTaxCredit: true,
    evRefueling: rng.chance(0.3),
  });

  // State returns (2 states)
  tr.stateReturns = generateStateReturns(rng, {
    count: 2,
    homeState: tr.state,
    totalIncome: 200000,
  });

  // Form 8582
  tr.form8582Data = {
    priorYearUnallowedLoss: rng.wholeDollars(0, 5000),
    isRealEstateProfessional: false,
  };
}
