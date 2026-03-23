/**
 * Plausibility Warnings — WARN-level validations for implausible values.
 *
 * Inspired by IRS Direct File Fact Graph's distinction between ERROR
 * (blocks submission) and WARN (flags implausibility).
 *
 * These checks catch likely data-entry mistakes without blocking
 * calculation. They surface as yellow warnings in the wizard and
 * review summary.
 *
 * @authority General — thresholds based on IRS audit triggers and
 *   statistical norms from SOI (Statistics of Income) data.
 */

import type { TaxReturn } from '../types/index.js';
import { PLAUSIBILITY, FORM_4137 } from '../constants/tax2025.js';

// ─── Types ──────────────────────────────────────────

export interface PlausibilityWarning {
  /** Warning category for grouping. */
  category: 'income' | 'deduction' | 'credit' | 'general';
  /** Dot-path into TaxReturn (e.g., "w2Income[0].wages"). */
  field: string;
  /** Wizard step ID this warning maps to. */
  stepId: string;
  /** Human-readable warning message. */
  message: string;
  /** Always 'warn' — never blocks calculation. */
  severity: 'warn';
  /** The actual value that triggered the warning. */
  value: number;
  /** The threshold it exceeded. */
  threshold: number;
  /** Index within an array (for per-item warnings). */
  itemIndex?: number;
  /** Human-readable item label (e.g., employer name). */
  itemLabel?: string;
}

// ─── Core Check Function ────────────────────────────

/**
 * Check a TaxReturn for implausible (but not invalid) values.
 * Pure function — no side effects, deterministic output.
 *
 * @param taxReturn The tax return to check
 * @param agi Optional AGI for ratio-based checks (from CalculationResult)
 * @returns Array of plausibility warnings (may be empty)
 */
export function checkPlausibility(
  taxReturn: TaxReturn,
  agi?: number,
): PlausibilityWarning[] {
  const warnings: PlausibilityWarning[] = [];
  const effectiveAGI = agi ?? 0;

  // ── Income: W-2 wages ─────────────────────────────
  (taxReturn.w2Income || []).forEach((w2, idx) => {
    if (w2.wages > PLAUSIBILITY.W2_WAGES_HIGH) {
      warnings.push({
        category: 'income',
        field: `w2Income[${idx}].wages`,
        stepId: 'w2_income',
        message: `W-2 wages of $${w2.wages.toLocaleString()} exceed $${PLAUSIBILITY.W2_WAGES_HIGH.toLocaleString()}. Please verify this is the correct amount.`,
        severity: 'warn',
        value: w2.wages,
        threshold: PLAUSIBILITY.W2_WAGES_HIGH,
        itemIndex: idx,
        itemLabel: w2.employerName || `W-2 #${idx + 1}`,
      });
    }
  });

  // ── W-2 Cross-field: FICA consistency ─────────────
  (taxReturn.w2Income || []).forEach((w2, idx) => {
    const label = w2.employerName || `W-2 #${idx + 1}`;

    // Box 3 (SS wages) should not exceed the Social Security wage base
    if (w2.socialSecurityWages && w2.socialSecurityWages > FORM_4137.SS_WAGE_BASE) {
      warnings.push({
        category: 'income',
        field: `w2Income[${idx}].socialSecurityWages`,
        stepId: 'w2_income',
        message: `Box 3 Social Security wages ($${w2.socialSecurityWages.toLocaleString()}) exceed the ${taxReturn.taxYear || 2025} wage base ($${FORM_4137.SS_WAGE_BASE.toLocaleString()}). Please verify — employers should not withhold SS tax above this limit.`,
        severity: 'warn',
        value: w2.socialSecurityWages,
        threshold: FORM_4137.SS_WAGE_BASE,
        itemIndex: idx,
        itemLabel: label,
      });
    }

    // Box 4 (SS tax) should not exceed Box 3 × 6.2%
    if (w2.socialSecurityTax && w2.socialSecurityWages) {
      const maxSSTax = w2.socialSecurityWages * FORM_4137.SS_RATE;
      if (w2.socialSecurityTax > maxSSTax + 1) { // +$1 tolerance for rounding
        warnings.push({
          category: 'income',
          field: `w2Income[${idx}].socialSecurityTax`,
          stepId: 'w2_income',
          message: `Box 4 SS tax ($${w2.socialSecurityTax.toLocaleString()}) exceeds 6.2% of Box 3 SS wages ($${maxSSTax.toFixed(2)}). This may indicate a data entry error.`,
          severity: 'warn',
          value: w2.socialSecurityTax,
          threshold: maxSSTax,
          itemIndex: idx,
          itemLabel: label,
        });
      }
    }

    // Box 6 (Medicare tax) should not exceed Box 5 × 1.45% (+ Additional Medicare Tax of 0.9% on wages over $200K)
    if (w2.medicareTax && w2.medicareWages) {
      // Allow for both regular 1.45% and Additional Medicare Tax 0.9% on wages above $200K
      const regularMedicare = w2.medicareWages * FORM_4137.MEDICARE_RATE;
      const additionalMedicare = Math.max(0, w2.medicareWages - 200000) * 0.009;
      const maxMedicareTax = regularMedicare + additionalMedicare;
      if (w2.medicareTax > maxMedicareTax + 1) { // +$1 tolerance for rounding
        warnings.push({
          category: 'income',
          field: `w2Income[${idx}].medicareTax`,
          stepId: 'w2_income',
          message: `Box 6 Medicare tax ($${w2.medicareTax.toLocaleString()}) exceeds expected maximum for Box 5 Medicare wages ($${maxMedicareTax.toFixed(2)}). This may indicate a data entry error.`,
          severity: 'warn',
          value: w2.medicareTax,
          threshold: maxMedicareTax,
          itemIndex: idx,
          itemLabel: label,
        });
      }
    }

    // Box 1 (wages) > Box 5 (Medicare wages) is unusual — usually Box 5 ≥ Box 1
    // (pre-tax deductions reduce Box 1 but not Box 5)
    if (w2.medicareWages && w2.wages > w2.medicareWages + 1) {
      warnings.push({
        category: 'income',
        field: `w2Income[${idx}].wages`,
        stepId: 'w2_income',
        message: `Box 1 wages ($${w2.wages.toLocaleString()}) exceed Box 5 Medicare wages ($${w2.medicareWages.toLocaleString()}). Typically Medicare wages are ≥ taxable wages. Please verify both amounts.`,
        severity: 'warn',
        value: w2.wages,
        threshold: w2.medicareWages,
        itemIndex: idx,
        itemLabel: label,
      });
    }
  });

  // ── Income: Self-employment ───────────────────────
  (taxReturn.income1099NEC || []).forEach((nec, idx) => {
    if (nec.amount > PLAUSIBILITY.SELF_EMPLOYMENT_INCOME_HIGH) {
      warnings.push({
        category: 'income',
        field: `income1099NEC[${idx}].amount`,
        stepId: '1099nec_income',
        message: `1099-NEC amount of $${nec.amount.toLocaleString()} exceeds $${PLAUSIBILITY.SELF_EMPLOYMENT_INCOME_HIGH.toLocaleString()}. Please verify this is correct.`,
        severity: 'warn',
        value: nec.amount,
        threshold: PLAUSIBILITY.SELF_EMPLOYMENT_INCOME_HIGH,
        itemIndex: idx,
        itemLabel: nec.payerName || `1099-NEC #${idx + 1}`,
      });
    }
  });

  // ── Income: Interest ──────────────────────────────
  (taxReturn.income1099INT || []).forEach((int1099, idx) => {
    if (int1099.amount > PLAUSIBILITY.INTEREST_INCOME_HIGH) {
      warnings.push({
        category: 'income',
        field: `income1099INT[${idx}].amount`,
        stepId: '1099int_income',
        message: `Interest income of $${int1099.amount.toLocaleString()} from a single source exceeds $${PLAUSIBILITY.INTEREST_INCOME_HIGH.toLocaleString()}. Please verify.`,
        severity: 'warn',
        value: int1099.amount,
        threshold: PLAUSIBILITY.INTEREST_INCOME_HIGH,
        itemIndex: idx,
        itemLabel: int1099.payerName || `1099-INT #${idx + 1}`,
      });
    }
  });

  // ── Income: Dividends ─────────────────────────────
  (taxReturn.income1099DIV || []).forEach((div, idx) => {
    if (div.ordinaryDividends > PLAUSIBILITY.DIVIDEND_INCOME_HIGH) {
      warnings.push({
        category: 'income',
        field: `income1099DIV[${idx}].ordinaryDividends`,
        stepId: '1099div_income',
        message: `Ordinary dividends of $${div.ordinaryDividends.toLocaleString()} from a single source exceed $${PLAUSIBILITY.DIVIDEND_INCOME_HIGH.toLocaleString()}. Please verify.`,
        severity: 'warn',
        value: div.ordinaryDividends,
        threshold: PLAUSIBILITY.DIVIDEND_INCOME_HIGH,
        itemIndex: idx,
        itemLabel: div.payerName || `1099-DIV #${idx + 1}`,
      });
    }
  });

  // ── Income: Retirement distributions ──────────────
  (taxReturn.income1099R || []).forEach((r, idx) => {
    if (r.grossDistribution > PLAUSIBILITY.RETIREMENT_DISTRIBUTION_HIGH) {
      warnings.push({
        category: 'income',
        field: `income1099R[${idx}].grossDistribution`,
        stepId: '1099r_income',
        message: `Retirement distribution of $${r.grossDistribution.toLocaleString()} exceeds $${PLAUSIBILITY.RETIREMENT_DISTRIBUTION_HIGH.toLocaleString()}. Please verify this is the correct amount.`,
        severity: 'warn',
        value: r.grossDistribution,
        threshold: PLAUSIBILITY.RETIREMENT_DISTRIBUTION_HIGH,
        itemIndex: idx,
        itemLabel: r.payerName || `1099-R #${idx + 1}`,
      });
    }
  });

  // ── Deductions: Charitable (AGI-dependent) ────────
  if (effectiveAGI > 0 && taxReturn.itemizedDeductions) {
    const totalCharity =
      (taxReturn.itemizedDeductions.charitableCash || 0) +
      (taxReturn.itemizedDeductions.charitableNonCash || 0);
    const charitableThreshold = effectiveAGI * PLAUSIBILITY.CHARITABLE_CASH_AGI_RATE;

    if (totalCharity > charitableThreshold) {
      warnings.push({
        category: 'deduction',
        field: 'itemizedDeductions.charitableCash',
        stepId: 'itemized_deductions',
        message: `Total charitable donations ($${totalCharity.toLocaleString()}) exceed ${(PLAUSIBILITY.CHARITABLE_CASH_AGI_RATE * 100).toFixed(0)}% of your AGI ($${effectiveAGI.toLocaleString()}). The IRS may scrutinize unusually high charitable deductions — please verify.`,
        severity: 'warn',
        value: totalCharity,
        threshold: charitableThreshold,
      });
    }
  }

  // ── Deductions: Medical expenses (AGI-dependent) ──
  if (effectiveAGI > 0 && taxReturn.itemizedDeductions) {
    const medical = taxReturn.itemizedDeductions.medicalExpenses || 0;
    const medicalThreshold = effectiveAGI * PLAUSIBILITY.MEDICAL_AGI_RATE;

    if (medical > medicalThreshold) {
      warnings.push({
        category: 'deduction',
        field: 'itemizedDeductions.medicalExpenses',
        stepId: 'itemized_deductions',
        message: `Medical expenses ($${medical.toLocaleString()}) exceed ${(PLAUSIBILITY.MEDICAL_AGI_RATE * 100).toFixed(0)}% of your AGI ($${effectiveAGI.toLocaleString()}). This is an unusually high ratio — please verify all amounts are correct.`,
        severity: 'warn',
        value: medical,
        threshold: medicalThreshold,
      });
    }
  }

  // ── Deductions: SALT entered ──────────────────────
  if (taxReturn.itemizedDeductions) {
    const totalSALT =
      (taxReturn.itemizedDeductions.stateLocalIncomeTax || 0) +
      (taxReturn.itemizedDeductions.realEstateTax || 0) +
      (taxReturn.itemizedDeductions.personalPropertyTax || 0);

    if (totalSALT > PLAUSIBILITY.SALT_ENTERED_HIGH) {
      warnings.push({
        category: 'deduction',
        field: 'itemizedDeductions.stateLocalIncomeTax',
        stepId: 'itemized_deductions',
        message: `Total state/local taxes entered ($${totalSALT.toLocaleString()}) exceed $${PLAUSIBILITY.SALT_ENTERED_HIGH.toLocaleString()}. Note: the SALT deduction is capped at $40,000 ($20,000 MFS) for 2025, phasing down for MAGI above $500,000. Verify your entries are correct.`,
        severity: 'warn',
        value: totalSALT,
        threshold: PLAUSIBILITY.SALT_ENTERED_HIGH,
      });
    }
  }

  // ── Home Office: area percentage ──────────────────
  const ho = taxReturn.homeOffice;
  if (ho && ho.squareFeet && ho.totalHomeSquareFeet && ho.totalHomeSquareFeet > 0) {
    const areaPct = ho.squareFeet / ho.totalHomeSquareFeet;
    if (areaPct > PLAUSIBILITY.HOME_OFFICE_AREA_PCT) {
      warnings.push({
        category: 'deduction',
        field: 'homeOffice.squareFeet',
        stepId: 'home_office',
        message: `Home office area (${ho.squareFeet} sq ft) is ${(areaPct * 100).toFixed(0)}% of total home area (${ho.totalHomeSquareFeet} sq ft). Office areas exceeding 50% of the home are unusual and may trigger IRS scrutiny.`,
        severity: 'warn',
        value: areaPct,
        threshold: PLAUSIBILITY.HOME_OFFICE_AREA_PCT,
      });
    }
  }

  // ── Vehicle: business miles ───────────────────────
  const veh = taxReturn.vehicle;
  if (veh) {
    if ((veh.businessMiles || 0) > PLAUSIBILITY.VEHICLE_BUSINESS_MILES_HIGH) {
      warnings.push({
        category: 'deduction',
        field: 'vehicle.businessMiles',
        stepId: 'vehicle_expenses',
        message: `Business miles (${(veh.businessMiles || 0).toLocaleString()}) exceed ${PLAUSIBILITY.VEHICLE_BUSINESS_MILES_HIGH.toLocaleString()}. The IRS scrutinizes unusually high mileage claims — ensure you have a contemporaneous mileage log.`,
        severity: 'warn',
        value: veh.businessMiles || 0,
        threshold: PLAUSIBILITY.VEHICLE_BUSINESS_MILES_HIGH,
      });
    }
  }

  return warnings;
}
