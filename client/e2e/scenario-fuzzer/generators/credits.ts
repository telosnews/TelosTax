/**
 * Credits generators — CTC, education, dependent care, energy, EV, adoption, PTC, etc.
 */

import type { Rng } from './random';
import type { FuzzerTaxReturn } from './base';

// ─── Child Tax Credit ────────────────────────────

export function applyChildTaxCredit(tr: FuzzerTaxReturn, qualifyingChildren: number, otherDependents: number): void {
  tr.childTaxCredit = {
    qualifyingChildren,
    otherDependents,
  };
}

// ─── Education Credits ───────────────────────────

export function generateEducationCredits(rng: Rng, count?: number): Record<string, unknown>[] {
  const n = count ?? rng.int(1, 2);
  return Array.from({ length: n }, () => {
    const creditType = rng.pick(['american_opportunity', 'lifetime_learning'] as const);
    const tuition = rng.wholeDollars(2000, 20000);

    return {
      id: rng.uuid(),
      studentName: `${rng.firstName()} ${rng.lastName()}`,
      institution: rng.pick([
        'State University', 'Community College', 'Tech Institute',
        'City College', 'National University', 'Valley College',
      ]),
      type: creditType,
      tuitionPaid: tuition,
      scholarships: rng.chance(0.3) ? rng.wholeDollars(500, tuition * 0.5) : 0,
    };
  });
}

// ─── Dependent Care ──────────────────────────────

export function generateDependentCare(rng: Rng, numDependents: number): Record<string, unknown> {
  return {
    totalExpenses: rng.wholeDollars(2000, numDependents > 1 ? 6000 : 3000),
    qualifyingPersons: Math.min(numDependents, 2),
    providers: [{
      name: rng.pick(['Sunshine Daycare', 'Little Stars Academy', 'ABC Learning Center', 'Happy Kids']),
      address: `${rng.int(100, 999)} ${rng.pick(['Main St', 'Oak Ave', 'Elm St'])}`,
      tin: rng.ein(),
      amountPaid: rng.wholeDollars(2000, 6000),
    }],
    fsaAmount: rng.chance(0.3) ? rng.wholeDollars(500, 5000) : 0,
  };
}

// ─── Saver's Credit ──────────────────────────────

export function generateSaversCredit(rng: Rng): Record<string, unknown> {
  return {
    totalContributions: rng.wholeDollars(500, 4000),
  };
}

// ─── Clean Energy (Form 5695 Part I) ─────────────

export function generateCleanEnergy(rng: Rng): Record<string, unknown> {
  return {
    solarElectric: rng.chance(0.6) ? rng.wholeDollars(5000, 30000) : 0,
    solarWaterHeating: rng.chance(0.2) ? rng.wholeDollars(2000, 8000) : 0,
    smallWindEnergy: rng.chance(0.1) ? rng.wholeDollars(5000, 20000) : 0,
    geothermalHeatPump: rng.chance(0.15) ? rng.wholeDollars(5000, 25000) : 0,
    batteryStorage: rng.chance(0.2) ? rng.wholeDollars(3000, 15000) : 0,
    fuelCell: 0,
    fuelCellKW: 0,
  };
}

// ─── EV Credit (Form 8936) ──────────────────────

export function generateEVCredit(rng: Rng): Record<string, unknown> {
  const isNew = rng.chance(0.7);
  return {
    vehicleDescription: rng.pick([
      '2025 Tesla Model 3', '2025 Chevrolet Bolt', '2025 Ford Mustang Mach-E',
      '2025 Rivian R1T', '2025 Hyundai Ioniq 6', '2024 Nissan Leaf',
    ]),
    vehicleMSRP: rng.wholeDollars(25000, 80000),
    purchasePrice: rng.wholeDollars(20000, 75000),
    isNewVehicle: isNew,
    finalAssemblyUS: rng.chance(0.8),
    meetsBatteryComponentReq: rng.chance(0.7),
    meetsMineralReq: rng.chance(0.7),
    vin: `1HGBH41JXMN${rng.int(100000, 999999)}`,
    datePlacedInService: rng.dateInYear(2025),
  };
}

// ─── Energy Efficiency (Form 5695 Part II) ───────

export function generateEnergyEfficiency(rng: Rng): Record<string, unknown> {
  return {
    heatPump: rng.chance(0.4) ? rng.wholeDollars(3000, 10000) : 0,
    centralAC: rng.chance(0.2) ? rng.wholeDollars(2000, 6000) : 0,
    waterHeater: rng.chance(0.3) ? rng.wholeDollars(1000, 4000) : 0,
    furnaceBoiler: rng.chance(0.2) ? rng.wholeDollars(2000, 8000) : 0,
    insulation: rng.chance(0.3) ? rng.wholeDollars(500, 3000) : 0,
    windows: rng.chance(0.3) ? rng.wholeDollars(1000, 5000) : 0,
    doors: rng.chance(0.2) ? rng.wholeDollars(300, 2000) : 0,
    electricalPanel: rng.chance(0.15) ? rng.wholeDollars(1000, 4000) : 0,
    homeEnergyAudit: rng.chance(0.1) ? rng.wholeDollars(150, 500) : 0,
  };
}

// ─── Adoption Credit ─────────────────────────────

export function generateAdoptionCredit(rng: Rng): Record<string, unknown> {
  return {
    qualifiedExpenses: rng.wholeDollars(5000, 16810),
    numberOfChildren: rng.int(1, 2),
    isSpecialNeeds: rng.chance(0.2),
  };
}

// ─── Premium Tax Credit ──────────────────────────

export function generatePremiumTaxCredit(rng: Rng, familySize: number): Record<string, unknown> {
  const monthlyPremium = rng.wholeDollars(400, 1500);
  const monthlySLCSP = rng.wholeDollars(500, 1800);
  const monthlyAPTC = rng.wholeDollars(100, 800);
  const covMonths = rng.int(8, 12);

  // Engine expects 12-element arrays for monthly data (Form1095AInfo)
  const coverageMonths = Array.from({ length: 12 }, (_, i) => i < covMonths);
  const enrollmentPremiums = coverageMonths.map((cov) => cov ? monthlyPremium : 0);
  const slcspPremiums = coverageMonths.map((cov) => cov ? monthlySLCSP : 0);
  const advancePTC = coverageMonths.map((cov) => cov ? monthlyAPTC : 0);

  return {
    familySize,
    forms1095A: [{
      id: rng.uuid(),
      marketplace: rng.pick(['HealthCare.gov', 'Covered California', 'NY State of Health', 'Access Health CT']),
      enrollmentPremiums,
      slcspPremiums,
      advancePTC,
      coverageMonths,
    }],
  };
}

// ─── Schedule R (Elderly/Disabled Credit) ────────

export function generateScheduleR(rng: Rng, filingStatus: number): Record<string, unknown> {
  return {
    isAge65OrOlder: true,
    isSpouseAge65OrOlder: filingStatus === 2,
    isDisabled: rng.chance(0.2),
    isSpouseDisabled: filingStatus === 2 ? rng.chance(0.1) : false,
    nontaxableSocialSecurity: rng.wholeDollars(5000, 20000),
    nontaxablePensions: rng.chance(0.3) ? rng.wholeDollars(1000, 10000) : 0,
  };
}

// ─── Foreign Tax Credit ──────────────────────────

export function generateForeignTaxCredit(rng: Rng): Record<string, unknown>[] {
  return [{
    category: 'passive',
    foreignTaxesPaid: rng.wholeDollars(100, 2000),
    foreignSourceIncome: rng.wholeDollars(5000, 30000),
  }];
}

// ─── EV Refueling Credit ─────────────────────────

export function generateEVRefueling(rng: Rng): Record<string, unknown> {
  return {
    properties: [{
      id: rng.uuid(),
      cost: rng.wholeDollars(500, 3000),
      address: `${rng.int(100, 999)} ${rng.pick(['Main St', 'Oak Ave'])}`,
      isBusinessUse: false,
      dateInService: rng.dateInYear(2025),
    }],
  };
}

// ─── Apply Credits to TaxReturn ──────────────────

export function applyCredits(rng: Rng, tr: FuzzerTaxReturn, opts: {
  childTaxCredit?: boolean;
  educationCredits?: boolean;
  dependentCare?: boolean;
  saversCredit?: boolean;
  cleanEnergy?: boolean;
  evCredit?: boolean;
  energyEfficiency?: boolean;
  adoptionCredit?: boolean;
  premiumTaxCredit?: boolean;
  elderlyDisabled?: boolean;
  foreignTaxCredit?: boolean;
  evRefueling?: boolean;
}): void {
  const taxYear = (tr.taxYear as number) || 2025;
  const numKids = tr.dependents.filter((d) =>
    new Date(d.dateOfBirth as string).getFullYear() > taxYear - 17
  ).length;
  const numOtherDeps = tr.dependents.length - numKids;

  if (opts.childTaxCredit && (numKids > 0 || numOtherDeps > 0)) {
    applyChildTaxCredit(tr, numKids, numOtherDeps);
  }

  if (opts.educationCredits) {
    tr.educationCredits = generateEducationCredits(rng);
  }

  if (opts.dependentCare && numKids > 0) {
    tr.dependentCare = generateDependentCare(rng, numKids);
  }

  if (opts.saversCredit) {
    tr.saversCredit = generateSaversCredit(rng);
  }

  if (opts.cleanEnergy) {
    tr.cleanEnergy = generateCleanEnergy(rng);
  }

  if (opts.evCredit) {
    tr.evCredit = generateEVCredit(rng);
  }

  if (opts.energyEfficiency) {
    tr.energyEfficiency = generateEnergyEfficiency(rng);
  }

  if (opts.adoptionCredit) {
    tr.adoptionCredit = generateAdoptionCredit(rng);
  }

  if (opts.premiumTaxCredit) {
    tr.premiumTaxCredit = generatePremiumTaxCredit(rng, 1 + tr.dependents.length);
  }

  if (opts.elderlyDisabled) {
    tr.scheduleR = generateScheduleR(rng, tr.filingStatus ?? 1);
  }

  if (opts.foreignTaxCredit) {
    tr.foreignTaxCreditCategories = generateForeignTaxCredit(rng);
  }

  if (opts.evRefueling) {
    tr.evRefuelingCredit = generateEVRefueling(rng);
  }
}
