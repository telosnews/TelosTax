/**
 * Self-employment generators — businesses, expenses, home office, vehicle, depreciation.
 */

import type { Rng } from './random';

const NAICS_CODES = [
  '541511', // Custom computer programming
  '541810', // Advertising agencies
  '541921', // Photography studios
  '541430', // Graphic design
  '611710', // Educational support
  '812990', // Personal services
  '561720', // Janitorial
  '541613', // Marketing consulting
  '711510', // Independent artists
  '561499', // Business support
] as const;

const EXPENSE_CATEGORIES = [
  { key: 'advertising', line: 8, min: 100, max: 5000 },
  { key: 'commissions_fees', line: 10, min: 200, max: 3000 },
  { key: 'contract_labor', line: 11, min: 500, max: 10000 },
  { key: 'insurance', line: 15, min: 300, max: 3000 },
  { key: 'interest', line: 16, min: 100, max: 2000 },
  { key: 'legal_professional', line: 17, min: 200, max: 5000 },
  { key: 'office_expense', line: 18, min: 100, max: 2000 },
  { key: 'rent_lease', line: 20, min: 500, max: 6000 },
  { key: 'supplies', line: 22, min: 100, max: 3000 },
  { key: 'taxes_licenses', line: 23, min: 50, max: 1000 },
  { key: 'travel', line: 24, min: 200, max: 5000 },
  { key: 'meals', line: 24, min: 100, max: 3000 },
  { key: 'utilities', line: 25, min: 100, max: 2000 },
  { key: 'other_expenses', line: 27, min: 100, max: 5000 },
] as const;

// ─── Business ────────────────────────────────────

export function generateBusiness(rng: Rng, id?: string): Record<string, unknown> {
  return {
    id: id ?? rng.uuid(),
    businessName: rng.businessName(),
    businessEin: rng.chance(0.4) ? rng.ein() : undefined,
    naicsCode: rng.pick(NAICS_CODES),
    accountingMethod: rng.pick(['cash', 'accrual'] as const),
    didStartThisYear: rng.chance(0.15),
    businessType: rng.pick(['sole_prop', 'single_member_llc'] as const),
  };
}

export function generateLegacyBusiness(rng: Rng): Record<string, unknown> {
  return {
    id: rng.uuid(),
    businessName: rng.businessName(),
    businessEin: rng.chance(0.4) ? rng.ein() : undefined,
    accountingMethod: 'cash',
    didStartThisYear: rng.chance(0.15),
  };
}

// ─── Expenses ────────────────────────────────────

export function generateExpenses(rng: Rng, businessId: string, count?: number): Record<string, unknown>[] {
  const numExpenses = count ?? rng.int(3, 8);
  const chosen = rng.pickN(EXPENSE_CATEGORIES, numExpenses);

  return chosen.map((cat) => ({
    id: rng.uuid(),
    businessId,
    categoryKey: cat.key,
    scheduleCLine: cat.line,
    description: cat.key.replace(/_/g, ' '),
    amount: rng.wholeDollars(cat.min, cat.max),
  }));
}

// ─── Home Office ─────────────────────────────────

export function generateHomeOffice(rng: Rng, opts?: { simplified?: boolean }): Record<string, unknown> {
  const simplified = opts?.simplified ?? rng.chance(0.5);

  if (simplified) {
    return {
      method: 'simplified',
      squareFeet: rng.int(100, 300),
      monthsUsed: rng.int(8, 12),
    };
  }

  const totalSqFt = rng.int(1000, 3500);
  const officeSqFt = rng.int(100, 400);

  return {
    method: 'actual',
    squareFeet: officeSqFt,
    totalHomeSqFt: totalSqFt,
    homeExpenses: {
      mortgageInterest: rng.wholeDollars(3000, 15000),
      rent: 0,
      realEstateTaxes: rng.wholeDollars(2000, 10000),
      insurance: rng.wholeDollars(800, 3000),
      utilities: rng.wholeDollars(1200, 5000),
      repairs: rng.chance(0.3) ? rng.wholeDollars(200, 3000) : 0,
      depreciation: rng.wholeDollars(2000, 8000),
      other: rng.chance(0.2) ? rng.wholeDollars(100, 1000) : 0,
    },
    monthsUsed: rng.int(8, 12),
    hoursUsed: rng.int(20, 40),
  };
}

// ─── Vehicle ─────────────────────────────────────

export function generateVehicle(rng: Rng, opts?: { method?: 'standard' | 'actual' }): Record<string, unknown> {
  const method = opts?.method ?? rng.pick(['standard', 'actual'] as const);
  const businessMiles = rng.int(3000, 25000);
  const commutingMiles = rng.int(0, 5000);
  const otherMiles = rng.int(2000, 10000);

  const vehicle: Record<string, unknown> = {
    vehicleMethod: method,
    businessMiles,
    commutingMiles,
    otherMiles,
    totalMiles: businessMiles + commutingMiles + otherMiles,
    dateInService: rng.dateInYear(rng.int(2019, 2025)),
    availableForPersonalUse: rng.chance(0.7),
  };

  if (method === 'actual') {
    vehicle.actualExpenses = {
      gas: rng.wholeDollars(2000, 6000),
      oil: rng.wholeDollars(100, 500),
      repairs: rng.wholeDollars(200, 3000),
      insurance: rng.wholeDollars(800, 2500),
      registration: rng.wholeDollars(50, 500),
      depreciation: rng.wholeDollars(2000, 8000),
      leasePayments: 0,
      other: rng.chance(0.2) ? rng.wholeDollars(100, 500) : 0,
    };
  }

  return vehicle;
}

// ─── Depreciation Assets ─────────────────────────

export function generateDepreciationAssets(rng: Rng, count: number): Record<string, unknown>[] {
  const ASSET_TYPES = [
    { name: 'MacBook Pro', cost: [1500, 3500], class: 5 },
    { name: 'Desk & Chair', cost: [500, 2000], class: 7 },
    { name: 'Camera Equipment', cost: [1000, 5000], class: 5 },
    { name: 'Office Furniture', cost: [1000, 5000], class: 7 },
    { name: 'Printer', cost: [300, 1200], class: 5 },
    { name: 'Software License', cost: [500, 3000], class: 3 },
    { name: 'Phone System', cost: [300, 1500], class: 5 },
  ] as const;

  return Array.from({ length: count }, () => {
    const asset = rng.pick(ASSET_TYPES);
    const cost = rng.wholeDollars(asset.cost[0], asset.cost[1]);
    return {
      id: rng.uuid(),
      description: asset.name,
      dateInService: rng.dateInYear(rng.int(2022, 2025)),
      cost,
      propertyClass: asset.class,
      convention: 'half-year',
      method: rng.pick(['MACRS', 'section179'] as const),
      section179Amount: rng.chance(0.3) ? cost : 0,
      businessUsePercentage: rng.int(80, 100),
    };
  });
}

// ─── Cost of Goods Sold ──────────────────────────

export function generateCOGS(rng: Rng): Record<string, unknown> {
  const beginInventory = rng.wholeDollars(1000, 10000);
  const purchases = rng.wholeDollars(5000, 30000);
  const endInventory = rng.wholeDollars(1000, 10000);

  return {
    inventoryAtBeginning: beginInventory,
    purchases,
    costOfLabor: rng.chance(0.3) ? rng.wholeDollars(1000, 10000) : 0,
    materials: rng.chance(0.3) ? rng.wholeDollars(500, 5000) : 0,
    otherCosts: rng.chance(0.2) ? rng.wholeDollars(200, 2000) : 0,
    inventoryAtEnd: endInventory,
    valuationMethod: rng.pick(['cost', 'lower_of_cost_or_market'] as const),
  };
}

// ─── Self-Employment Deductions ──────────────────

export function generateSEDeductions(rng: Rng, opts?: {
  hasHealthInsurance?: boolean;
}): Record<string, unknown> {
  return {
    healthInsurancePremiums: opts?.hasHealthInsurance !== false ? rng.wholeDollars(3000, 15000) : 0,
    sepIraContributions: rng.chance(0.3) ? rng.wholeDollars(2000, 20000) : 0,
    solo401kContributions: rng.chance(0.2) ? rng.wholeDollars(5000, 23500) : 0,
  };
}
