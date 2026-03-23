/**
 * Declarative Step Condition Types
 *
 * Inspired by IRS Direct File's condition-driven screen flow, where
 * screen visibility is controlled by evaluating declarative conditions
 * against the fact graph state (isTrue, isFalseAndComplete, etc.).
 *
 * These types replace opaque `(taxReturn) => boolean` functions with
 * serializable, inspectable condition descriptors. Benefits:
 *   - AI chat can explain why a step is visible/hidden
 *   - Conditions can be serialized to JSON for config files
 *   - Flow logic is auditable without reading code
 *   - `describeCondition()` produces human-readable English
 */

/**
 * A declarative condition that determines wizard step visibility.
 * Evaluated against a TaxReturn using `evaluateCondition()`.
 */
export type StepCondition =
  | FieldEqualsCondition
  | FieldExistsCondition
  | FieldTruthyCondition
  | ArrayNotEmptyCondition
  | ArrayLengthGtCondition
  | DiscoveryEqualsCondition
  | AgiLteCondition
  | AnyCondition
  | AllCondition
  | NotCondition;

/** True when a field at the given dot-path equals the specified value. */
export interface FieldEqualsCondition {
  type: 'field_equals';
  /** Dot-path into TaxReturn (e.g., "deductionMethod"). */
  field: string;
  /** The value to compare against. */
  value: unknown;
}

/** True when a field at the given dot-path is not null/undefined. */
export interface FieldExistsCondition {
  type: 'field_exists';
  field: string;
}

/** True when a field at the given dot-path is truthy. */
export interface FieldTruthyCondition {
  type: 'field_truthy';
  field: string;
}

/** True when an array field has at least one element. */
export interface ArrayNotEmptyCondition {
  type: 'array_not_empty';
  field: string;
}

/** True when an array field has more than `min` elements. */
export interface ArrayLengthGtCondition {
  type: 'array_length_gt';
  field: string;
  min: number;
}

/**
 * Shorthand for the most common condition pattern:
 *   taxReturn.incomeDiscovery[incomeType] === value
 */
export interface DiscoveryEqualsCondition {
  type: 'discovery_equals';
  incomeType: string;
  value: 'yes' | 'no' | 'later';
}

/**
 * True when the filer's AGI (from CalculationResult) is at or below the
 * filing-status-specific threshold. When no CalculationResult is available
 * (e.g., before first calculation), evaluates to true (step stays visible).
 *
 * Used for income-based eligibility gating (Saver's Credit, EV Credit, etc.).
 */
export interface AgiLteCondition {
  type: 'agi_lte';
  thresholds: {
    single: number;
    mfj: number;
    mfs: number;
    hoh: number;
    qss: number;
  };
}

/** True when ANY of the sub-conditions are true (logical OR). */
export interface AnyCondition {
  type: 'any';
  conditions: StepCondition[];
}

/** True when ALL of the sub-conditions are true (logical AND). */
export interface AllCondition {
  type: 'all';
  conditions: StepCondition[];
}

/** Negation — true when the inner condition is false. */
export interface NotCondition {
  type: 'not';
  condition: StepCondition;
}
