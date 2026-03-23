import type { LucideIcon } from 'lucide-react';
import type { TaxReturn, CalculationResult } from '@telostax/engine';

// ---------------------------------------------------------------------------
// Scenario Variable Definition
// ---------------------------------------------------------------------------

export interface ScenarioVariable {
  key: string;
  label: string;
  description: string;
  category: VariableCategory;
  inputType: 'slider' | 'select' | 'toggle';
  read: (tr: TaxReturn) => number | string | boolean;
  write: (tr: TaxReturn, value: unknown) => TaxReturn;
  format?: 'currency' | 'percent' | 'number';
  min?: number;
  max?: number | ((tr: TaxReturn) => number);
  step?: number;
  options?: { value: string; label: string }[];
  isRelevant?: (tr: TaxReturn) => boolean;
  /** Whether this variable can be applied directly to the real tax return.
   *  'direct' = safe scalar write, 'navigate' = must go to wizard step. */
  applyMode?: 'direct' | 'navigate';
  /** Wizard step ID to navigate to (for 'navigate' mode) or to link as reference (for 'direct' mode). */
  targetStepId?: string;
  /** Icon matching the corresponding wizard step. */
  icon?: LucideIcon;
}

export type VariableCategory =
  | 'personal'
  | 'income_wage'
  | 'income_investment'
  | 'income_se'
  | 'retirement'
  | 'deductions'
  | 'credits';

export const CATEGORY_LABELS: Record<VariableCategory, string> = {
  personal: 'Personal',
  income_wage: 'Wage Income',
  income_investment: 'Investment Income',
  income_se: 'Self-Employment',
  retirement: 'Retirement & Savings',
  deductions: 'Deductions',
  credits: 'Credits',
};

// ---------------------------------------------------------------------------
// Scenario State
// ---------------------------------------------------------------------------

export const SCENARIO_COLORS = ['blue', 'violet', 'emerald', 'orange'] as const;
export type ScenarioColor = (typeof SCENARIO_COLORS)[number];

export interface Scenario {
  id: string;
  name: string;
  color: ScenarioColor;
  overrides: Map<string, unknown>;
}

export type ViewMode = 'editor' | 'compare' | 'sensitivity';

export interface SensitivityConfig {
  variableKey: string;
  outputMetric: string;
  min: number;
  max: number;
  steps: number;
}

export interface ScenarioLabState {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  viewMode: ViewMode;
  sensitivityConfig: SensitivityConfig | null;
  expandedCategories: Set<string>;
  searchQuery: string;
}

// ---------------------------------------------------------------------------
// Delta / Comparison
// ---------------------------------------------------------------------------

export interface DeltaEntry {
  base: number;
  scenario: number;
  diff: number;
  pctChange: number;
}

export type DeltaMap = Record<string, DeltaEntry>;

// ---------------------------------------------------------------------------
// Reducer Actions
// ---------------------------------------------------------------------------

export type ScenarioLabAction =
  | { type: 'ADD_SCENARIO' }
  | { type: 'REMOVE_SCENARIO'; id: string }
  | { type: 'RENAME_SCENARIO'; id: string; name: string }
  | { type: 'SET_ACTIVE_SCENARIO'; id: string | null }
  | { type: 'SET_OVERRIDE'; scenarioId: string; key: string; value: unknown }
  | { type: 'CLEAR_OVERRIDE'; scenarioId: string; key: string }
  | { type: 'CLEAR_ALL_OVERRIDES'; scenarioId: string }
  | { type: 'APPLY_PRESET'; scenarioId: string; overrides: Map<string, unknown> }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'SET_SENSITIVITY_CONFIG'; config: SensitivityConfig | null }
  | { type: 'TOGGLE_CATEGORY'; category: string }
  | { type: 'SET_SEARCH'; query: string };

// ---------------------------------------------------------------------------
// Hook Return Type
// ---------------------------------------------------------------------------

export interface UseScenarioLabReturn {
  state: ScenarioLabState;
  dispatch: React.Dispatch<ScenarioLabAction>;
  baseResult: CalculationResult;
  scenarioResults: Map<string, CalculationResult>;
  deltas: Map<string, DeltaMap>;
}

// ---------------------------------------------------------------------------
// Quick Presets
// ---------------------------------------------------------------------------

export interface QuickPreset {
  id: string;
  label: string;
  description: string;
  getOverrides: (tr: TaxReturn) => Map<string, unknown>;
}
