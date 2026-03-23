/**
 * Deductions generators — itemized deductions, adjustments, above-the-line deductions.
 */

import type { Rng } from './random';
import type { FuzzerTaxReturn } from './base';

// ─── Itemized Deductions ─────────────────────────

export function generateItemizedDeductions(rng: Rng, opts?: {
  highIncome?: boolean;
}): Record<string, unknown> {
  const highIncome = opts?.highIncome ?? false;

  return {
    medicalExpenses: rng.chance(0.4) ? rng.wholeDollars(1000, highIncome ? 20000 : 8000) : 0,
    stateLocalIncomeTax: rng.wholeDollars(2000, highIncome ? 30000 : 10000),
    realEstateTax: rng.wholeDollars(1000, highIncome ? 25000 : 8000),
    personalPropertyTax: rng.chance(0.3) ? rng.wholeDollars(100, 2000) : 0,
    mortgageInterest: rng.chance(0.7) ? rng.wholeDollars(3000, highIncome ? 30000 : 15000) : 0,
    mortgageInsurancePremiums: rng.chance(0.2) ? rng.wholeDollars(500, 3000) : 0,
    charitableCash: rng.wholeDollars(500, highIncome ? 30000 : 5000),
    charitableNonCash: rng.chance(0.4) ? rng.wholeDollars(200, highIncome ? 10000 : 3000) : 0,
    casualtyLoss: 0,
    otherDeductions: rng.chance(0.2) ? rng.wholeDollars(100, 2000) : 0,
  };
}

// ─── Adjustments (above-the-line) ────────────────

export function applyAdjustments(rng: Rng, tr: FuzzerTaxReturn, opts?: {
  hasStudentLoan?: boolean;
  hasIRA?: boolean;
  hasHSA?: boolean;
  hasEducator?: boolean;
  hasEstimatedPayments?: boolean;
}): void {
  if (opts?.hasStudentLoan ?? rng.chance(0.2)) {
    tr.studentLoanInterest = rng.wholeDollars(500, 2500);
  }

  if (opts?.hasIRA ?? rng.chance(0.15)) {
    tr.iraContribution = rng.wholeDollars(1000, 7000);
    tr.coveredByEmployerPlan = rng.chance(0.5);
  }

  if (opts?.hasHSA ?? rng.chance(0.15)) {
    tr.hsaDeduction = rng.wholeDollars(1000, 4300);
    tr.hsaContribution = {
      coverageType: rng.pick(['self', 'family'] as const),
      totalContributions: tr.hsaDeduction,
      employerContributions: rng.chance(0.3) ? rng.wholeDollars(500, 2000) : 0,
    };
  }

  if (opts?.hasEducator ?? rng.chance(0.1)) {
    tr.educatorExpenses = rng.wholeDollars(50, 300);
  }

  if (opts?.hasEstimatedPayments ?? rng.chance(0.1)) {
    const totalEst = rng.wholeDollars(2000, 20000);
    tr.estimatedPaymentsMade = totalEst;
    const q = Math.round(totalEst / 4);
    tr.estimatedQuarterlyPayments = [q, q, q, totalEst - 3 * q];
  }
}

// ─── AMT Data ────────────────────────────────────

export function generateAMTData(rng: Rng): Record<string, unknown> {
  return {
    isoExerciseSpread: rng.chance(0.5) ? rng.wholeDollars(10000, 100000) : 0,
    privateActivityBondInterest: rng.chance(0.3) ? rng.wholeDollars(5000, 30000) : 0,
    otherAMTAdjustments: rng.chance(0.2) ? rng.wholeDollars(1000, 20000) : 0,
  };
}

// ─── Schedule 1A (Tips/Overtime/Car Loan) ────────

export function generateSchedule1A(rng: Rng): Record<string, unknown> {
  return {
    unreportedTips: rng.chance(0.4) ? rng.wholeDollars(500, 5000) : 0,
    overtimePay: rng.chance(0.4) ? rng.wholeDollars(1000, 15000) : 0,
    autoLoanInterest: rng.chance(0.3) ? rng.wholeDollars(500, 4000) : 0,
    isSenior: rng.chance(0.1),
    seniorStandardDeductionBonus: 0,
  };
}

// ─── Investment Interest ─────────────────────────

export function generateInvestmentInterest(rng: Rng): Record<string, unknown> {
  return {
    investmentInterestExpense: rng.wholeDollars(1000, 10000),
    netInvestmentIncome: rng.wholeDollars(2000, 20000),
    priorYearDisallowed: rng.chance(0.2) ? rng.wholeDollars(500, 3000) : 0,
  };
}

// ─── Form 8606 (Roth Conversion) ─────────────────

export function generateForm8606(rng: Rng): Record<string, unknown> {
  return {
    nondeductibleContributions: rng.wholeDollars(1000, 7000),
    totalIRABasis: rng.wholeDollars(5000, 50000),
    totalIRAValue: rng.wholeDollars(10000, 200000),
    rothConversionAmount: rng.chance(0.5) ? rng.wholeDollars(5000, 50000) : 0,
  };
}

// ─── Capital Loss Carryforward ───────────────────

export function applyCapitalLossCarryforward(rng: Rng, tr: FuzzerTaxReturn): void {
  if (rng.chance(0.2)) {
    const total = rng.wholeDollars(1000, 50000);
    tr.capitalLossCarryforward = total;
    tr.capitalLossCarryforwardST = Math.round(total * rng.float(0.2, 0.8));
    tr.capitalLossCarryforwardLT = total - (tr.capitalLossCarryforwardST ?? 0);
  }
}
