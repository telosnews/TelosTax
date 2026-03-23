import { describe, it, expect } from 'vitest';
import { calculateSolo401kLimits, calculateSEPIRALimits } from '../src/engine/solo401k.js';

describe('calculateSolo401kLimits', () => {
  // ─── Basic Calculations ──────────────────────────────

  it('calculates adjusted net SE income correctly', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 100000,
      seDeductibleHalf: 7065,
    });
    expect(result.adjustedNetSEIncome).toBe(92935);
  });

  it('calculates max employer contribution at 20% effective rate', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 100000,
      seDeductibleHalf: 7065,
    });
    // 20% of 92935 = 18587
    expect(result.maxEmployerContribution).toBe(18587);
  });

  it('defaults max employee deferral to $23,500 (no catch-up)', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
    });
    expect(result.maxEmployeeDeferral).toBe(23500);
  });

  // ─── Employee Deferral Limits ────────────────────────

  it('caps employee deferral at $23,500', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      employeeDeferral: 30000,
    });
    expect(result.appliedEmployeeDeferral).toBe(23500);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('caps employee deferral to adjusted net SE income when income is low', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 20000,
      seDeductibleHalf: 1413,
      employeeDeferral: 23500,
    });
    // Adjusted net SE income = 20000 - 1413 = 18587
    // Deferral limited to $18,587 (less than $23,500 limit)
    expect(result.appliedEmployeeDeferral).toBe(18587);
  });

  // ─── Employer Contribution Limits ────────────────────

  it('caps employer contribution at 20% of adjusted net SE income', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 50000,
      seDeductibleHalf: 3533,
      employerContribution: 20000,
    });
    // Adjusted net = 50000 - 3533 = 46467
    // Max employer = 46467 * 0.20 = 9293.40
    expect(result.appliedEmployerContribution).toBe(9293.4);
    expect(result.maxEmployerContribution).toBe(9293.4);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('allows employer contribution within limits', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      employerContribution: 30000,
    });
    // Adjusted net = 200000 - 14130 = 185870
    // Max employer = 185870 * 0.20 = 37174
    expect(result.appliedEmployerContribution).toBe(30000);
    expect(result.maxEmployerContribution).toBe(37174);
  });

  // ─── Catch-Up Contributions ──────────────────────────

  it('adds $7,500 catch-up for age 50+', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      age: 55,
    });
    expect(result.catchUpEligible).toBe(true);
    expect(result.superCatchUpEligible).toBe(false);
    expect(result.catchUpAmount).toBe(7500);
    expect(result.maxEmployeeDeferral).toBe(23500 + 7500); // 31000
  });

  it('adds $11,250 super catch-up for ages 60-63 (SECURE 2.0)', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      age: 62,
    });
    expect(result.catchUpEligible).toBe(true);
    expect(result.superCatchUpEligible).toBe(true);
    expect(result.catchUpAmount).toBe(11250);
    expect(result.maxEmployeeDeferral).toBe(23500 + 11250); // 34750
  });

  it('reverts to regular catch-up at age 64 (not super catch-up)', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      age: 64,
    });
    expect(result.superCatchUpEligible).toBe(false);
    expect(result.catchUpEligible).toBe(true);
    expect(result.catchUpAmount).toBe(7500);
  });

  it('no catch-up for age under 50', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      age: 45,
    });
    expect(result.catchUpEligible).toBe(false);
    expect(result.catchUpAmount).toBe(0);
    expect(result.maxEmployeeDeferral).toBe(23500);
  });

  it('no catch-up when age is undefined', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
    });
    expect(result.catchUpEligible).toBe(false);
    expect(result.catchUpAmount).toBe(0);
  });

  // ─── W-2 Salary Deferral Coordination ────────────────

  it('reduces employee deferral limit by W-2 salary deferrals', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      w2SalaryDeferrals: 10000,
      employeeDeferral: 20000,
    });
    // Remaining deferral = 23500 - 10000 = 13500
    expect(result.maxEmployeeDeferral).toBe(13500);
    expect(result.appliedEmployeeDeferral).toBe(13500);
    expect(result.warnings.length).toBeGreaterThan(0); // Warning about capping
  });

  it('W-2 deferrals at or above limit leave only catch-up', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      w2SalaryDeferrals: 23500,
      age: 55,
      employeeDeferral: 10000,
    });
    // Base deferral limit exhausted by W-2 deferrals
    // Only catch-up ($7,500) is available
    expect(result.maxEmployeeDeferral).toBe(7500);
    expect(result.appliedEmployeeDeferral).toBe(7500);
    expect(result.warnings.some(w => w.includes('exceed the'))).toBe(true);
  });

  it('W-2 deferrals above limit with no catch-up leaves zero', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      w2SalaryDeferrals: 25000,
      age: 40,
    });
    expect(result.maxEmployeeDeferral).toBe(0);
  });

  // ─── Annual Addition Limit ($70,000) ─────────────────

  it('enforces $70,000 annual addition limit', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 400000,
      seDeductibleHalf: 14130,
      employeeDeferral: 23500,
      employerContribution: 50000,
    });
    // Employee base: 23500, Employer: 50000, total = 73500 > 70000
    // Should reduce employer to make total 70000
    expect(result.appliedEmployeeDeferral).toBe(23500);
    expect(result.appliedEmployerContribution).toBe(46500); // 70000 - 23500 = 46500
    expect(result.totalContribution).toBe(70000);
    expect(result.warnings.some(w => w.includes('annual addition limit'))).toBe(true);
  });

  it('catch-up is NOT counted toward $70,000 limit', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 400000,
      seDeductibleHalf: 14130,
      employeeDeferral: 31000,  // 23500 base + 7500 catch-up
      employerContribution: 46500,
      age: 55,
    });
    // Base deferral: 23500 (counted toward 415(c))
    // Catch-up: 7500 (NOT counted toward 415(c))
    // Employer: 46500
    // 415(c) check: 23500 + 46500 = 70000 ≤ 70000 — OK!
    // Total: 23500 + 7500 + 46500 = 77500
    expect(result.appliedEmployeeDeferral).toBe(31000);
    expect(result.appliedEmployerContribution).toBe(46500);
    expect(result.totalContribution).toBe(77500);
  });

  // ─── Zero and Edge Cases ─────────────────────────────

  it('returns zeros when SE income is zero', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 0,
      seDeductibleHalf: 0,
      employeeDeferral: 23500,
      employerContribution: 10000,
    });
    expect(result.adjustedNetSEIncome).toBe(0);
    expect(result.maxEmployerContribution).toBe(0);
    expect(result.appliedEmployeeDeferral).toBe(0);
    expect(result.appliedEmployerContribution).toBe(0);
    expect(result.totalContribution).toBe(0);
    expect(result.warnings.some(w => w.includes('$0 or negative'))).toBe(true);
  });

  it('handles negative SE income', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: -5000,
      seDeductibleHalf: 0,
    });
    expect(result.adjustedNetSEIncome).toBe(0);
    expect(result.maxEmployerContribution).toBe(0);
    expect(result.totalContribution).toBe(0);
  });

  it('handles very low SE income (deferral limited to income)', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 5000,
      seDeductibleHalf: 353,
      employeeDeferral: 23500,
      employerContribution: 5000,
    });
    // Adjusted net = 5000 - 353 = 4647
    // Max employer = 4647 * 0.20 = 929.40
    // But §415(c)(1)(B): 100% of compensation = $4,647
    // Employee deferral alone ($4,647) already hits the 100% comp limit
    // Employer contribution reduced to $0
    expect(result.adjustedNetSEIncome).toBe(4647);
    expect(result.appliedEmployeeDeferral).toBe(4647); // Limited to adjusted net income
    expect(result.appliedEmployerContribution).toBe(0); // §415(c) 100% comp limit
    expect(result.totalContribution).toBe(4647);
  });

  it('handles no user input (zero contributions)', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 100000,
      seDeductibleHalf: 7065,
    });
    expect(result.appliedEmployeeDeferral).toBe(0);
    expect(result.appliedEmployerContribution).toBe(0);
    expect(result.totalContribution).toBe(0);
    expect(result.warnings.length).toBe(0);
  });

  // ─── Compensation Cap ────────────────────────────────

  it('caps employer contribution at compensation limit ($350,000)', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 500000,
      seDeductibleHalf: 14130,
      employerContribution: 100000,
    });
    // Adjusted net = 500000 - 14130 = 485870
    // But capped at $350,000 for employer calculation
    // Max employer = 350000 * 0.20 = 70000
    // Also limited by annual addition limit
    expect(result.maxEmployerContribution).toBe(70000);
  });

  // ─── W-2 Catch-Up Coordination (§414(v)(3)) ────────

  it('W-2 deferrals that partially consume catch-up leave remainder', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      w2SalaryDeferrals: 26000,  // $23,500 base + $2,500 catch-up used
      age: 55,
      employeeDeferral: 10000,
    });
    // Remaining catch-up = $7,500 - $2,500 = $5,000
    expect(result.maxEmployeeDeferral).toBe(5000);
    expect(result.appliedEmployeeDeferral).toBe(5000);
  });

  it('W-2 deferrals that fully consume base + catch-up leave zero', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      w2SalaryDeferrals: 31000,  // $23,500 base + $7,500 catch-up
      age: 55,
      employeeDeferral: 5000,
    });
    expect(result.maxEmployeeDeferral).toBe(0);
    expect(result.appliedEmployeeDeferral).toBe(0);
  });

  it('W-2 deferrals exceeding catch-up still leave zero (not negative)', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      w2SalaryDeferrals: 35000,  // exceeds $23,500 + $7,500
      age: 55,
    });
    expect(result.maxEmployeeDeferral).toBe(0);
  });

  it('super catch-up (60-63) properly coordinates with W-2 overflow', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      w2SalaryDeferrals: 28000,  // $23,500 base + $4,500 catch-up used
      age: 62,
      employeeDeferral: 10000,
    });
    // Super catch-up = $11,250
    // W-2 used $4,500 of catch-up, remaining = $11,250 - $4,500 = $6,750
    expect(result.maxEmployeeDeferral).toBe(6750);
    expect(result.appliedEmployeeDeferral).toBe(6750);
  });

  // ─── 100% of Compensation §415(c)(1)(B) ────────────

  it('caps total at 100% of compensation when income < $70,000', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 25000,
      seDeductibleHalf: 1766,
      employeeDeferral: 23234,  // max of adjusted income
      employerContribution: 5000,
    });
    // Adjusted net = 25000 - 1766 = 23234
    // 100% of comp = $23,234 < $70,000
    // Employee deferral: 23234, Employer: 23234 * 0.20 = 4646.80
    // Combined without catch-up: 23234 + 4646.80 = 27880.80 > 23234
    // Should reduce to $23,234
    expect(result.totalContribution).toBeLessThanOrEqual(23234);
    expect(result.warnings.some(w => w.includes('100%'))).toBe(true);
  });

  it('maxTotalContribution reflects compensation cap for low income', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 30000,
      seDeductibleHalf: 2120,
    });
    // Adjusted net = 30000 - 2120 = 27880
    // maxTotalContribution should be min(70000, 27880) + 0 catch-up = 27880
    expect(result.maxTotalContribution).toBe(27880);
  });

  it('100% comp cap does not affect high earners', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 400000,
      seDeductibleHalf: 14130,
      employeeDeferral: 23500,
      employerContribution: 50000,
    });
    // Adjusted net = $385,870 > $70,000 → comp cap doesn't bind
    // Max employer = min(350000, 385870) * 0.20 = 70000
    // Combined: 23500 + 46500 = 70000 (employer reduced from 50000 to 46500 by §415(c) $70k limit)
    // No "100% of compensation" warning — only the standard §415(c) $70k limit
    expect(result.totalContribution).toBe(70000);
    expect(result.warnings.every(w => !w.includes('100%'))).toBe(true);
  });

  // ─── SIMPLE IRA Deferral Coordination ──────────────

  it('SIMPLE IRA deferrals reduce §402(g) limit alongside W-2', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      w2SalaryDeferrals: 10000,
      simpleIraDeferrals: 8000,
      employeeDeferral: 10000,
    });
    // Total prior deferrals: 10000 + 8000 = 18000
    // Remaining base: 23500 - 18000 = 5500
    expect(result.maxEmployeeDeferral).toBe(5500);
    expect(result.appliedEmployeeDeferral).toBe(5500);
  });

  it('SIMPLE IRA alone reduces §402(g) limit', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      simpleIraDeferrals: 16500,  // SIMPLE max
      employeeDeferral: 10000,
    });
    // Remaining base: 23500 - 16500 = 7000
    expect(result.maxEmployeeDeferral).toBe(7000);
    expect(result.appliedEmployeeDeferral).toBe(7000);
  });

  // ─── SEP-IRA Cross-Plan §415(c) ───────────────────

  it('SEP-IRA contributions reduce available §415(c) room', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 400000,
      seDeductibleHalf: 14130,
      employeeDeferral: 23500,
      employerContribution: 50000,
      sepIraContributions: 20000,
    });
    // §415(c) room = 70000 - 20000 SEP = 50000
    // Employee 23500 + Employer should cap at 50000
    expect(result.appliedEmployeeDeferral).toBe(23500);
    expect(result.appliedEmployerContribution).toBe(26500); // 50000 - 23500
    expect(result.totalContribution).toBe(50000);
  });

  // ─── Roth Deferral Tracking ────────────────────────

  it('tracks Roth deferral and computes deductible amount', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      employeeDeferral: 23500,
      rothDeferral: 10000,
      employerContribution: 20000,
    });
    expect(result.appliedRothDeferral).toBe(10000);
    // Deductible = total (23500 + 20000) - Roth (10000) = 33500
    expect(result.deductibleContribution).toBe(33500);
  });

  it('caps Roth deferral to applied employee deferral', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      employeeDeferral: 10000,
      rothDeferral: 15000,  // more than employee deferral
      employerContribution: 5000,
    });
    expect(result.appliedRothDeferral).toBe(10000); // capped to applied deferral
    expect(result.deductibleContribution).toBe(5000); // only employer is deductible
  });

  it('all-Roth deferral means only employer contribution is deductible', () => {
    const result = calculateSolo401kLimits({
      scheduleCNetProfit: 200000,
      seDeductibleHalf: 14130,
      employeeDeferral: 23500,
      rothDeferral: 23500,  // 100% Roth
      employerContribution: 37174,
    });
    expect(result.appliedRothDeferral).toBe(23500);
    expect(result.deductibleContribution).toBe(37174); // only employer contribution
  });
});

describe('calculateSEPIRALimits', () => {
  it('calculates max contribution at 20% effective rate', () => {
    const result = calculateSEPIRALimits({
      scheduleCNetProfit: 100000,
      seDeductibleHalf: 7065,
    });
    // Adjusted net = 100000 - 7065 = 92935
    // Max = 92935 * 0.20 = 18587
    expect(result.adjustedNetSEIncome).toBe(92935);
    expect(result.maxContribution).toBe(18587);
  });

  it('caps contribution at $70,000', () => {
    const result = calculateSEPIRALimits({
      scheduleCNetProfit: 500000,
      seDeductibleHalf: 14130,
      desiredContribution: 80000,
    });
    // Adjusted net = 485870
    // 20% of 350000 (comp cap) = 70000
    // Also capped at max $70,000
    expect(result.appliedContribution).toBe(70000);
    expect(result.maxContribution).toBe(70000);
  });

  it('caps at desired amount when within limits', () => {
    const result = calculateSEPIRALimits({
      scheduleCNetProfit: 100000,
      seDeductibleHalf: 7065,
      desiredContribution: 10000,
    });
    expect(result.appliedContribution).toBe(10000);
    expect(result.warnings.length).toBe(0);
  });

  it('shows warning when contribution is capped', () => {
    const result = calculateSEPIRALimits({
      scheduleCNetProfit: 50000,
      seDeductibleHalf: 3533,
      desiredContribution: 20000,
    });
    // Adjusted net = 46467
    // Max = 46467 * 0.20 = 9293.40
    expect(result.appliedContribution).toBe(9293.4);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns zero for zero SE income', () => {
    const result = calculateSEPIRALimits({
      scheduleCNetProfit: 0,
      seDeductibleHalf: 0,
      desiredContribution: 10000,
    });
    expect(result.maxContribution).toBe(0);
    expect(result.appliedContribution).toBe(0);
    expect(result.warnings.some(w => w.includes('$0 or negative'))).toBe(true);
  });

  it('respects compensation cap ($350,000)', () => {
    const result = calculateSEPIRALimits({
      scheduleCNetProfit: 500000,
      seDeductibleHalf: 14130,
    });
    // Adjusted net = 485870, capped at 350000
    // Max = 350000 * 0.20 = 70000
    // Also capped at $70,000 SEP max
    expect(result.maxContribution).toBe(70000);
  });
});
