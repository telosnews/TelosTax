/**
 * Full Form 1040 calculation — the main orchestrator.
 *
 * This is a thin orchestrator that delegates to section sub-orchestrators
 * in form1040Sections.ts. Each section reads from and writes to a shared
 * Form1040Context accumulator, keeping the data flow explicit.
 *
 * @authority
 *   IRC: Section 1 — tax imposed (rate tables)
 *   IRC: Section 63 — taxable income defined
 *   IRC: Section 62 — adjusted gross income defined
 *   Form: Form 1040
 * @scope Main orchestrator — assembles all schedules, computes total tax, payments, refund/owed
 * @limitations Does not include AMT Foreign Tax Credit or AMT NOL
 */

import { FilingStatus, TaxReturn, CalculationResult } from '../types/index.js';
import { HoHValidationResult, DeceasedSpouseValidationResult } from '../types/index.js';
import { validateHeadOfHousehold } from './filingStatusValidation.js';
import { validateDeceasedSpouse } from './deceasedSpouse.js';
import { calculateStateTaxes } from './state/index.js';
import { createTraceBuilder } from './traceBuilder.js';
import type { TraceOptions } from '../types/index.js';
import {
  createForm1040Context,
  calculateIncomeSection,
  calculateSelfEmploymentSection,
  calculateCapitalAssetsSection,
  calculatePreliminaryIncomeSection,
  calculateAdjustmentsSection,
  calculateDeductionsSection,
  calculateIncomeTaxSection,
  calculateAdditionalTaxesSection,
  calculateCreditsSection,
  calculateLiabilitySection,
  assembleForm1040Result,
} from './form1040Sections.js';

// Re-export Form1040Context for external use
export type { Form1040Context } from './form1040Sections.js';

/**
 * Full Form 1040 calculation.
 * Takes a complete TaxReturn and produces the final calculation result.
 *
 * @param taxReturn The complete tax return data
 * @param traceOptions Optional — when { enabled: true }, generates a structured
 *   CalculationTrace tree explaining how each value was computed. Inspired by
 *   IRS Direct File Fact Graph's Expression.explain() capability.
 */
export function calculateForm1040(taxReturn: TaxReturn, traceOptions?: TraceOptions): CalculationResult {
  const filingStatus = taxReturn.filingStatus || FilingStatus.Single;
  const tb = createTraceBuilder(traceOptions?.enabled ?? false);

  // Create the shared context accumulator
  const ctx = createForm1040Context(taxReturn, filingStatus, tb, traceOptions);

  // ─── Filing Status Validation ──────────────────────
  ctx.hohValidation = filingStatus === FilingStatus.HeadOfHousehold
    ? validateHeadOfHousehold(taxReturn)
    : undefined;

  ctx.deceasedSpouseValidation = taxReturn.spouseDateOfDeath
    ? validateDeceasedSpouse(taxReturn)
    : undefined;

  // ─── Section 1: Income ─────────────────────────────
  calculateIncomeSection(ctx);

  // ─── Section 2: Self-Employment ────────────────────
  calculateSelfEmploymentSection(ctx);

  // ─── Section 3: Capital Assets ─────────────────────
  calculateCapitalAssetsSection(ctx);

  // ─── Section 4: Preliminary Income & Social Security
  calculatePreliminaryIncomeSection(ctx);

  // ─── Section 5: Adjustments → AGI ──────────────────
  calculateAdjustmentsSection(ctx);

  // ─── Section 6: Deductions → Taxable Income ────────
  calculateDeductionsSection(ctx);

  // ─── Section 7: Income Tax Computation ─────────────
  calculateIncomeTaxSection(ctx);

  // ─── Section 8: Additional Taxes ───────────────────
  calculateAdditionalTaxesSection(ctx);

  // ─── Section 9: Credits ────────────────────────────
  calculateCreditsSection(ctx);

  // ─── Section 10: Liability & Balance ───────────────
  calculateLiabilitySection(ctx);

  // ─── Assemble Output ───────────────────────────────
  const federalResult = assembleForm1040Result(ctx);

  // ─── State Tax Calculation ─────────────────────────
  if (taxReturn.stateReturns && taxReturn.stateReturns.length > 0) {
    federalResult.stateResults = calculateStateTaxes(taxReturn, federalResult);
  }

  return federalResult;
}
