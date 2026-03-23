/**
 * Fuzzer Calculation Engine Validation — Vitest
 *
 * Generates randomized TaxReturn objects from 13 archetypes and runs
 * calculateForm1040() on each, validating no NaN/undefined/negative values.
 *
 * This runs via Vitest (not Playwright) because the shared engine is TypeScript
 * and Vitest handles TS imports natively.
 *
 * Usage:
 *   npx vitest run src/__tests__/fuzzerCalcValidation
 *
 * Environment variables:
 *   FUZZER_COUNT     — number of scenarios (default: 50)
 *   FUZZER_SEED      — starting seed (default: 1)
 *   FUZZER_ARCHETYPE — force a specific archetype
 */

import { describe, it, expect } from 'vitest';
import { calculateForm1040 } from '@telostax/engine';
import { generateScenarios } from '../../e2e/scenario-fuzzer/generators';

const FUZZER_COUNT = parseInt(process.env.FUZZER_COUNT || '50', 10);
const FUZZER_SEED = parseInt(process.env.FUZZER_SEED || '1', 10);
const FUZZER_ARCHETYPE = process.env.FUZZER_ARCHETYPE || undefined;

/** Critical numeric fields that must never be NaN. */
const CRITICAL_FIELDS = [
  'agi', 'taxableIncome', 'incomeTax', 'totalTax', 'totalCredits',
  'taxAfterCredits', 'refundAmount', 'amountOwed', 'effectiveTaxRate',
  'totalWithholding', 'totalPayments',
] as const;

/** Fields that must be non-negative (AGI excluded — business losses can make it negative). */
const NON_NEGATIVE_FIELDS = [
  'taxableIncome', 'totalTax', 'totalCredits',
  'totalWithholding', 'totalPayments',
] as const;

const scenarios = generateScenarios(FUZZER_COUNT, FUZZER_SEED, FUZZER_ARCHETYPE);

describe('Fuzzer Calculation Engine Validation', () => {
  for (const scenario of scenarios) {
    it(`seed=${scenario.seed} archetype=${scenario.archetype}`, () => {
      const tr = {
        ...scenario.taxReturn,
        filingStatus: scenario.taxReturn.filingStatus || 1,
      };

      // Engine should not crash
      let result: Record<string, unknown>;
      try {
        result = calculateForm1040(tr as never) as unknown as Record<string, unknown>;
      } catch (err) {
        throw new Error(
          `Engine crashed for seed=${scenario.seed} archetype=${scenario.archetype}: ${err}`
        );
      }

      const form1040 = (result.form1040 || result) as Record<string, unknown>;
      const failures: string[] = [];

      // No NaN in critical fields
      for (const field of CRITICAL_FIELDS) {
        const value = form1040[field];
        if (typeof value === 'number' && isNaN(value)) {
          failures.push(`NaN in form1040.${field}`);
        }
      }

      // Key fields must not be undefined
      for (const field of ['agi', 'taxableIncome', 'totalTax'] as const) {
        if (form1040[field] === undefined) {
          failures.push(`Undefined in form1040.${field}`);
        }
      }

      // No negative values in non-negative fields
      for (const field of NON_NEGATIVE_FIELDS) {
        const value = form1040[field];
        if (typeof value === 'number' && value < 0) {
          failures.push(`Negative form1040.${field}: ${value}`);
        }
      }

      // Refund and amountOwed should be mutually exclusive
      const refund = form1040.refundAmount as number;
      const owed = form1040.amountOwed as number;
      if (typeof refund === 'number' && typeof owed === 'number' && refund > 0 && owed > 0) {
        failures.push(`Both refund ($${refund}) and amountOwed ($${owed}) are positive`);
      }

      // Effective tax rate sanity (0% - 100%)
      const rate = form1040.effectiveTaxRate as number;
      if (typeof rate === 'number' && !isNaN(rate) && (rate < 0 || rate > 100)) {
        failures.push(`Effective tax rate out of range: ${rate}%`);
      }

      if (failures.length > 0) {
        const report = [
          `Calc failures for seed=${scenario.seed} archetype=${scenario.archetype}:`,
          ...failures.map((f) => `  - ${f}`),
          `Reproduce: FUZZER_SEED=${scenario.seed} FUZZER_COUNT=1 npx vitest run src/__tests__/fuzzerCalcValidation`,
        ].join('\n');
        expect(failures, report).toHaveLength(0);
      }
    });
  }
});
