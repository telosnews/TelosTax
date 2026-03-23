import { useReducer, useMemo, useRef, useState, useEffect } from 'react';
import { calculateForm1040, FilingStatus } from '@telostax/engine';
import type { TaxReturn, CalculationResult } from '@telostax/engine';
import { VARIABLE_DEFINITIONS } from './variableDefinitions';
import type {
  Scenario, ScenarioLabState, ScenarioLabAction, ScenarioColor,
  DeltaMap, DeltaEntry, UseScenarioLabReturn, ScenarioVariable,
} from './types';
import { SCENARIO_COLORS } from './types';

// ---------------------------------------------------------------------------
// Apply overrides to a TaxReturn
// ---------------------------------------------------------------------------

// Pre-indexed lookup for default variable definitions (O(1) instead of O(n) per key)
const VARIABLE_DEF_MAP = new Map(VARIABLE_DEFINITIONS.map(v => [v.key, v]));

export function applyOverrides(
  base: TaxReturn,
  overrides: Map<string, unknown>,
  variableDefs: ScenarioVariable[] = VARIABLE_DEFINITIONS,
): TaxReturn {
  // Use pre-indexed map for default defs, build ad-hoc map for custom defs
  const defMap = variableDefs === VARIABLE_DEFINITIONS
    ? VARIABLE_DEF_MAP
    : new Map(variableDefs.map(v => [v.key, v]));
  let tr = { ...base };
  for (const [key, value] of overrides) {
    const def = defMap.get(key);
    if (def) {
      tr = def.write(tr, value);
    }
  }
  return tr;
}

// ---------------------------------------------------------------------------
// Calculate with safe defaults
// ---------------------------------------------------------------------------

function safeCalculate(tr: TaxReturn): CalculationResult {
  return calculateForm1040({
    ...tr,
    filingStatus: tr.filingStatus || FilingStatus.Single,
  });
}

// ---------------------------------------------------------------------------
// Diff two CalculationResults
// ---------------------------------------------------------------------------

function makeDelta(base: number, scenario: number): DeltaEntry {
  const diff = scenario - base;
  const pctChange = base !== 0 ? diff / Math.abs(base) : 0;
  return { base, scenario, diff, pctChange };
}

export function diffResults(base: CalculationResult, scenario: CalculationResult): DeltaMap {
  const bf = base.form1040;
  const sf = scenario.form1040;

  const sumStateTax = (r: CalculationResult) =>
    r.stateResults?.reduce((s, sr) => s + sr.totalStateTax, 0) ?? 0;

  const baseRefundNet = bf.refundAmount > 0 ? bf.refundAmount : -bf.amountOwed;
  const scenRefundNet = sf.refundAmount > 0 ? sf.refundAmount : -sf.amountOwed;

  return {
    refundOrOwed: makeDelta(baseRefundNet, scenRefundNet),
    totalIncome: makeDelta(bf.totalIncome, sf.totalIncome),
    totalAdjustments: makeDelta(bf.totalAdjustments, sf.totalAdjustments),
    agi: makeDelta(bf.agi, sf.agi),
    deductionAmount: makeDelta(bf.deductionAmount, sf.deductionAmount),
    taxableIncome: makeDelta(bf.taxableIncome, sf.taxableIncome),
    incomeTax: makeDelta(bf.incomeTax, sf.incomeTax),
    totalTax: makeDelta(bf.totalTax, sf.totalTax),
    totalCredits: makeDelta(bf.totalCredits, sf.totalCredits),
    effectiveTaxRate: makeDelta(bf.effectiveTaxRate, sf.effectiveTaxRate),
    marginalTaxRate: makeDelta(bf.marginalTaxRate, sf.marginalTaxRate),
    totalWithholding: makeDelta(bf.totalWithholding, sf.totalWithholding),
    stateTax: makeDelta(sumStateTax(base), sumStateTax(scenario)),
    seTax: makeDelta(bf.seTax ?? 0, sf.seTax ?? 0),
    refundAmount: makeDelta(bf.refundAmount, sf.refundAmount),
    amountOwed: makeDelta(bf.amountOwed, sf.amountOwed),
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function getNextColor(scenarios: Scenario[]): ScenarioColor {
  const used = new Set(scenarios.map(s => s.color));
  return SCENARIO_COLORS.find(c => !used.has(c)) ?? 'orange';
}

function reducer(state: ScenarioLabState, action: ScenarioLabAction): ScenarioLabState {
  switch (action.type) {
    case 'ADD_SCENARIO': {
      if (state.scenarios.length >= 4) return state;
      const id = `scenario-${crypto.randomUUID().slice(0, 8)}`;
      const color = getNextColor(state.scenarios);
      const scenario: Scenario = {
        id,
        name: `Scenario ${state.scenarios.length + 1}`,
        color,
        overrides: new Map(),
      };
      return {
        ...state,
        scenarios: [...state.scenarios, scenario],
        activeScenarioId: id,
      };
    }

    case 'REMOVE_SCENARIO': {
      const filtered = state.scenarios.filter(s => s.id !== action.id);
      return {
        ...state,
        scenarios: filtered,
        activeScenarioId: state.activeScenarioId === action.id
          ? (filtered[filtered.length - 1]?.id ?? null)
          : state.activeScenarioId,
      };
    }

    case 'RENAME_SCENARIO':
      return {
        ...state,
        scenarios: state.scenarios.map(s =>
          s.id === action.id ? { ...s, name: action.name } : s,
        ),
      };

    case 'SET_ACTIVE_SCENARIO':
      return { ...state, activeScenarioId: action.id };

    case 'SET_OVERRIDE': {
      return {
        ...state,
        scenarios: state.scenarios.map(s => {
          if (s.id !== action.scenarioId) return s;
          const overrides = new Map(s.overrides);
          overrides.set(action.key, action.value);
          return { ...s, overrides };
        }),
      };
    }

    case 'CLEAR_OVERRIDE': {
      return {
        ...state,
        scenarios: state.scenarios.map(s => {
          if (s.id !== action.scenarioId) return s;
          const overrides = new Map(s.overrides);
          overrides.delete(action.key);
          return { ...s, overrides };
        }),
      };
    }

    case 'CLEAR_ALL_OVERRIDES':
      return {
        ...state,
        scenarios: state.scenarios.map(s =>
          s.id === action.scenarioId ? { ...s, overrides: new Map() } : s,
        ),
      };

    case 'APPLY_PRESET':
      return {
        ...state,
        scenarios: state.scenarios.map(s => {
          if (s.id !== action.scenarioId) return s;
          const overrides = new Map(s.overrides);
          for (const [k, v] of action.overrides) overrides.set(k, v);
          return { ...s, overrides };
        }),
      };

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };

    case 'SET_SENSITIVITY_CONFIG':
      return { ...state, sensitivityConfig: action.config };

    case 'TOGGLE_CATEGORY': {
      const expanded = new Set(state.expandedCategories);
      if (expanded.has(action.category)) expanded.delete(action.category);
      else expanded.add(action.category);
      return { ...state, expandedCategories: expanded };
    }

    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const INITIAL_STATE: ScenarioLabState = {
  scenarios: [],
  activeScenarioId: null,
  viewMode: 'editor',
  sensitivityConfig: null,
  expandedCategories: new Set(['personal', 'income_wage', 'deductions']),
  searchQuery: '',
};

// Module-level cache so state survives unmount/remount (e.g. navigating away and back).
// Not persisted to localStorage — Maps don't serialize cleanly, and scenarios are exploratory.
// Keyed to tax return ID so switching returns invalidates stale scenarios.
let cachedState: ScenarioLabState | null = null;
let cachedTaxReturnId: string | null = null;
let cachedDeltas: Map<string, DeltaMap> | null = null;

/**
 * Read-only snapshot of the current scenario lab state for external consumers
 * (e.g., chat context builder). Returns null if no scenarios exist.
 */
export function getScenarioLabSnapshot(): {
  scenarios: Array<{ id: string; name: string; overrideCount: number }>;
  deltas: Map<string, DeltaMap>;
} | null {
  if (!cachedState || cachedState.scenarios.length === 0) return null;
  return {
    scenarios: cachedState.scenarios.map(s => ({
      id: s.id,
      name: s.name,
      overrideCount: s.overrides.size,
    })),
    deltas: cachedDeltas ?? new Map(),
  };
}

export function useScenarioLab(taxReturn: TaxReturn): UseScenarioLabReturn {
  // Invalidate cache when tax return identity changes
  if (taxReturn.id !== cachedTaxReturnId) {
    cachedState = null;
    cachedTaxReturnId = taxReturn.id;
  }

  const [state, dispatch] = useReducer(reducer, cachedState ?? INITIAL_STATE);

  // Sync module-level cache on every state change
  useEffect(() => { cachedState = state; }, [state]);

  // Debounced override values for calculation
  const [debouncedScenarios, setDebouncedScenarios] = useState(state.scenarios);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedScenarios(state.scenarios);
    }, 150);
    return () => clearTimeout(debounceRef.current);
  }, [state.scenarios]);

  // Base calculation (memoized on taxReturn)
  const baseResult = useMemo(() => safeCalculate(taxReturn), [taxReturn]);

  // Per-scenario calculations (individually memoized via a stable map approach)
  const scenarioResults = useMemo(() => {
    const results = new Map<string, CalculationResult>();
    for (const scenario of debouncedScenarios) {
      if (scenario.overrides.size === 0) {
        results.set(scenario.id, baseResult);
        continue;
      }
      try {
        const modified = applyOverrides(taxReturn, scenario.overrides);
        results.set(scenario.id, safeCalculate(modified));
      } catch {
        results.set(scenario.id, baseResult);
      }
    }
    return results;
  }, [taxReturn, debouncedScenarios, baseResult]);

  // Per-scenario deltas
  const deltas = useMemo(() => {
    const deltaMap = new Map<string, DeltaMap>();
    for (const [id, result] of scenarioResults) {
      deltaMap.set(id, diffResults(baseResult, result));
    }
    return deltaMap;
  }, [baseResult, scenarioResults]);

  // Cache deltas for external consumers (chat context builder)
  useEffect(() => { cachedDeltas = deltas; }, [deltas]);

  return { state, dispatch, baseResult, scenarioResults, deltas };
}
