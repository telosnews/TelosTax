/**
 * Base TaxReturn factory — mirrors createReturn() from client/src/api/client.ts.
 * Provides a valid empty TaxReturn that generators overlay with randomized data.
 */

import type { Rng } from './random';

/** Minimal TaxReturn shape for the fuzzer (matches shared/src/types/index.ts). */
export interface FuzzerTaxReturn {
  id: string;
  schemaVersion: number;
  taxYear: number;
  status: string;
  currentStep: number;
  currentSection: string;
  filingStatus?: number;
  firstName?: string;
  lastName?: string;
  ssn?: string;
  dateOfBirth?: string;
  occupation?: string;
  isLegallyBlind?: boolean;
  canBeClaimedAsDependent?: boolean;
  spouseFirstName?: string;
  spouseLastName?: string;
  spouseSsn?: string;
  spouseDateOfBirth?: string;
  spouseOccupation?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  dependents: Record<string, unknown>[];
  w2Income: Record<string, unknown>[];
  income1099NEC: Record<string, unknown>[];
  income1099K: Record<string, unknown>[];
  income1099INT: Record<string, unknown>[];
  income1099DIV: Record<string, unknown>[];
  income1099R: Record<string, unknown>[];
  income1099G: Record<string, unknown>[];
  income1099MISC: Record<string, unknown>[];
  income1099B: Record<string, unknown>[];
  income1099DA: Record<string, unknown>[];
  income1099C: Record<string, unknown>[];
  income1099Q: Record<string, unknown>[];
  income1099SA: Record<string, unknown>[];
  incomeW2G: Record<string, unknown>[];
  incomeSSA1099?: Record<string, unknown>;
  incomeK1: Record<string, unknown>[];
  rentalProperties: Record<string, unknown>[];
  businesses: Record<string, unknown>[];
  business?: Record<string, unknown>;
  expenses: Record<string, unknown>[];
  homeOffice?: Record<string, unknown>;
  vehicle?: Record<string, unknown>;
  depreciationAssets?: Record<string, unknown>[];
  costOfGoodsSold?: Record<string, unknown>;
  selfEmploymentDeductions?: Record<string, unknown>;
  otherIncome: number;
  deductionMethod: string;
  itemizedDeductions?: Record<string, unknown>;
  educationCredits: Record<string, unknown>[];
  childTaxCredit?: Record<string, unknown>;
  dependentCare?: Record<string, unknown>;
  saversCredit?: Record<string, unknown>;
  cleanEnergy?: Record<string, unknown>;
  evCredit?: Record<string, unknown>;
  energyEfficiency?: Record<string, unknown>;
  evRefuelingCredit?: Record<string, unknown>;
  adoptionCredit?: Record<string, unknown>;
  premiumTaxCredit?: Record<string, unknown>;
  scheduleR?: Record<string, unknown>;
  foreignTaxCreditCategories?: Record<string, unknown>[];
  hsaDeduction?: number;
  hsaContribution?: Record<string, unknown>;
  studentLoanInterest?: number;
  iraContribution?: number;
  coveredByEmployerPlan?: boolean;
  educatorExpenses?: number;
  estimatedPaymentsMade?: number;
  estimatedQuarterlyPayments?: number[];
  capitalLossCarryforward?: number;
  capitalLossCarryforwardST?: number;
  capitalLossCarryforwardLT?: number;
  qbiInfo?: Record<string, unknown>;
  form8606?: Record<string, unknown>;
  amtData?: Record<string, unknown>;
  form8582Data?: Record<string, unknown>;
  schedule1A?: Record<string, unknown>;
  form982?: Record<string, unknown>;
  investmentInterest?: Record<string, unknown>;
  homeSale?: Record<string, unknown>;
  foreignEarnedIncome?: Record<string, unknown>;
  householdEmployees?: Record<string, unknown>;
  form4797Properties?: Record<string, unknown>[];
  scheduleF?: Record<string, unknown>;
  form4137?: Record<string, unknown>;
  kiddieTax?: Record<string, unknown>;
  alimony?: Record<string, unknown>;
  alimonyReceived?: Record<string, unknown>;
  excessContributions?: Record<string, unknown>;
  nolCarryforward?: number;
  stateReturns?: Record<string, unknown>[];
  incomeDiscovery: Record<string, string>;
  digitalAssetActivity?: boolean;
  gamblingLosses?: number;
  directDeposit?: Record<string, unknown>;
  scheduleBPartIII?: Record<string, unknown>;
  paidOverHalfHouseholdCost?: boolean;
  returnsAndAllowances?: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

/** Create a base empty TaxReturn with all required fields. */
export function baseTaxReturn(rng: Rng): FuzzerTaxReturn {
  const now = new Date().toISOString();
  const id = rng.uuid();
  const addr = rng.address();

  return {
    id,
    schemaVersion: 10,
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'my_info',
    firstName: rng.firstName(),
    lastName: rng.lastName(),
    ssn: rng.ssn(),
    dateOfBirth: rng.dateOfBirth(25, 70),
    occupation: 'Software Engineer',
    address: addr.street,
    city: addr.city,
    state: 'CA',
    zip: addr.zip,
    dependents: [],
    w2Income: [],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    income1099SA: [],
    incomeW2G: [],
    incomeK1: [],
    rentalProperties: [],
    businesses: [],
    expenses: [],
    otherIncome: 0,
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: now,
    updatedAt: now,
  };
}
