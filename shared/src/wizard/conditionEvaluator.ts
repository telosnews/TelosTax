/**
 * Declarative Condition Evaluator
 *
 * Evaluates StepCondition descriptors against a TaxReturn object.
 * Also provides `describeCondition()` for human-readable English
 * descriptions (used by AI chat and audit logs).
 *
 * Pure functions, zero dependencies beyond types.
 */

import type { TaxReturn, CalculationResult } from '../types/index.js';
import { FilingStatus } from '../types/index.js';
import type { StepCondition } from './conditionTypes.js';

// ─── Evaluator ──────────────────────────────────────

/**
 * Evaluate a declarative step condition against a TaxReturn.
 * Returns true if the step should be visible, false if hidden.
 *
 * When a CalculationResult is provided, AGI-based conditions (agi_lte)
 * can be evaluated. Without it, those conditions default to true.
 */
export function evaluateCondition(
  condition: StepCondition,
  taxReturn: TaxReturn,
  calculation?: CalculationResult | null,
): boolean {
  switch (condition.type) {
    case 'field_equals':
      return getNestedValue(taxReturn, condition.field) === condition.value;

    case 'field_exists':
      return getNestedValue(taxReturn, condition.field) != null;

    case 'field_truthy':
      return !!getNestedValue(taxReturn, condition.field);

    case 'array_not_empty': {
      const arr = getNestedValue(taxReturn, condition.field);
      return Array.isArray(arr) && arr.length > 0;
    }

    case 'array_length_gt': {
      const arr = getNestedValue(taxReturn, condition.field);
      return Array.isArray(arr) && arr.length > condition.min;
    }

    case 'discovery_equals':
      return (taxReturn.incomeDiscovery as Record<string, string>)?.[condition.incomeType] === condition.value;

    case 'agi_lte': {
      const agi = calculation?.form1040?.agi;
      if (agi == null) return true; // No calculation yet — keep step visible
      const fs = taxReturn.filingStatus;
      const threshold =
        fs === FilingStatus.MarriedFilingJointly ? condition.thresholds.mfj :
        fs === FilingStatus.MarriedFilingSeparately ? condition.thresholds.mfs :
        fs === FilingStatus.HeadOfHousehold ? condition.thresholds.hoh :
        fs === FilingStatus.QualifyingSurvivingSpouse ? condition.thresholds.qss :
        condition.thresholds.single;
      return agi <= threshold;
    }

    case 'any':
      return condition.conditions.some((c) => evaluateCondition(c, taxReturn, calculation));

    case 'all':
      return condition.conditions.every((c) => evaluateCondition(c, taxReturn, calculation));

    case 'not':
      return !evaluateCondition(condition.condition, taxReturn, calculation);
  }
}

// ─── Describer ──────────────────────────────────────

/**
 * Describe a condition in human-readable English.
 * Used by the AI chat to explain why a step is visible/hidden,
 * and for flow audit documentation.
 */
export function describeCondition(condition: StepCondition): string {
  switch (condition.type) {
    case 'field_equals':
      return `"${condition.field}" equals ${JSON.stringify(condition.value)}`;

    case 'field_exists':
      return `"${condition.field}" is provided`;

    case 'field_truthy':
      return `"${condition.field}" is set`;

    case 'array_not_empty':
      return `"${condition.field}" has at least one entry`;

    case 'array_length_gt':
      return `"${condition.field}" has more than ${condition.min} entries`;

    case 'discovery_equals':
      return `income type "${condition.incomeType}" is marked as "${condition.value}"`;

    case 'agi_lte':
      return `AGI is at or below $${condition.thresholds.single.toLocaleString()} (single) / $${condition.thresholds.mfj.toLocaleString()} (MFJ)`;

    case 'any':
      return `any of: (${condition.conditions.map(describeCondition).join(' OR ')})`;

    case 'all':
      return `all of: (${condition.conditions.map(describeCondition).join(' AND ')})`;

    case 'not':
      return `NOT (${describeCondition(condition.condition)})`;
  }
}

// ─── Helpers ────────────────────────────────────────

/**
 * Safely access a nested value by dot-path (e.g., "homeOffice.method").
 * Returns undefined if any segment in the path is null/undefined.
 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current == null) return undefined;
    return (current as Record<string, unknown>)[key];
  }, obj);
}
