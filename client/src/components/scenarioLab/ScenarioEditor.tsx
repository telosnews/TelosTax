import { useMemo, useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Search, RotateCcw, Check, ExternalLink } from 'lucide-react';
import type { TaxReturn } from '@telostax/engine';
import { VARIABLE_DEFINITIONS, getVariablesByCategory } from './variableDefinitions';
import type { Scenario, ScenarioLabAction, ScenarioVariable, VariableCategory } from './types';
import { CATEGORY_LABELS } from './types';
import RangeSlider from './RangeSlider';
import { formatCurrency, formatPercent } from '../../utils/format';
import { useTaxReturnStore, flushAutoSave, WIZARD_STEPS } from '../../store/taxReturnStore';

// ---------------------------------------------------------------------------
// Variable Control
// ---------------------------------------------------------------------------

interface VariableControlProps {
  variable: ScenarioVariable;
  taxReturn: TaxReturn;
  scenario: Scenario;
  dispatch: React.Dispatch<ScenarioLabAction>;
}

function VariableControl({ variable, taxReturn, scenario, dispatch }: VariableControlProps) {
  const originalValue = variable.read(taxReturn);
  const hasOverride = scenario.overrides.has(variable.key);
  const currentValue = hasOverride ? scenario.overrides.get(variable.key) : originalValue;
  const [applied, setApplied] = useState(false);

  const handleChange = useCallback((value: unknown) => {
    dispatch({ type: 'SET_OVERRIDE', scenarioId: scenario.id, key: variable.key, value });
  }, [dispatch, scenario.id, variable.key]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'CLEAR_OVERRIDE', scenarioId: scenario.id, key: variable.key });
  }, [dispatch, scenario.id, variable.key]);

  const handleApply = useCallback(() => {
    const store = useTaxReturnStore.getState();
    const storeTR = store.taxReturn;
    if (!storeTR) return;
    const newTR = variable.write(storeTR, currentValue);
    store.setReturn({ ...newTR, updatedAt: new Date().toISOString() });
    flushAutoSave();
    setApplied(true);
    setTimeout(() => {
      setApplied(false);
      dispatch({ type: 'CLEAR_OVERRIDE', scenarioId: scenario.id, key: variable.key });
    }, 1500);
  }, [variable, currentValue, dispatch, scenario.id]);

  const handleNavigate = useCallback(() => {
    if (variable.targetStepId) {
      const store = useTaxReturnStore.getState();
      const visible = store.getVisibleSteps();
      if (visible.some(s => s.id === variable.targetStepId)) {
        store.goToStep(variable.targetStepId);
      } else {
        // Fallback if step is hidden (e.g., discovery flag not set)
        const stepDef = WIZARD_STEPS.find(s => s.id === variable.targetStepId);
        if (stepDef) {
          const fallback = visible.find(s => s.section === stepDef.section && (s.id.includes('overview') || s.id.includes('discovery')))
                        || visible.find(s => s.section === stepDef.section);
          if (fallback) store.goToStep(fallback.id);
        }
      }
    }
  }, [variable.targetStepId]);

  const resolveMax = typeof variable.max === 'function' ? variable.max(taxReturn) : (variable.max ?? 100);

  const formatValue = (v: unknown) => {
    if (variable.format === 'currency') return formatCurrency(v as number);
    if (variable.format === 'percent') return formatPercent(v as number);
    return String(v);
  };

  return (
    <div className={`py-3 px-3 rounded-lg transition-colors ${hasOverride ? 'border-l-2 border-l-telos-orange-500 bg-telos-orange-500/5' : ''}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-start gap-2">
          {variable.icon && <variable.icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
          <div>
            <p className="text-sm font-medium text-slate-200">{variable.label}</p>
            <p className="text-[11px] text-slate-500">{variable.description}</p>
          </div>
        </div>
        {hasOverride && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">was {formatValue(originalValue)}</span>
            {variable.applyMode === 'direct' && (
              <button
                onClick={handleApply}
                disabled={applied}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  applied
                    ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                }`}
                title="Apply this value to your real return"
              >
                <Check className="w-3 h-3" />
                {applied ? 'Applied!' : 'Apply'}
              </button>
            )}
            {variable.applyMode === 'navigate' && (
              <button
                onClick={handleNavigate}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-telos-blue-500/10 text-telos-blue-400 hover:bg-telos-blue-500/20 transition-colors"
                title="Edit this value in your return"
              >
                <ExternalLink className="w-3 h-3" />
                Edit in Return
              </button>
            )}
            <button
              onClick={handleReset}
              className="p-1 text-slate-500 hover:text-telos-orange-400 transition-colors rounded"
              title="Reset to original"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {variable.inputType === 'slider' && (
        <RangeSlider
          value={currentValue as number}
          min={variable.min ?? 0}
          max={resolveMax}
          step={variable.step ?? 1}
          format={variable.format}
          onChange={handleChange}
          label={variable.label}
        />
      )}

      {variable.inputType === 'select' && variable.options && (
        <select
          value={String(currentValue)}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full bg-surface-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-telos-orange-500 focus:ring-1 focus:ring-telos-orange-500/30"
        >
          {variable.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {variable.inputType === 'toggle' && (
        <button
          onClick={() => handleChange(!(currentValue as boolean))}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            currentValue ? 'bg-telos-orange-500/20 text-telos-orange-400' : 'bg-surface-800 text-slate-400'
          }`}
        >
          {currentValue ? 'Enabled' : 'Disabled'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Accordion
// ---------------------------------------------------------------------------

interface CategoryAccordionProps {
  category: VariableCategory;
  variables: ScenarioVariable[];
  taxReturn: TaxReturn;
  scenario: Scenario;
  dispatch: React.Dispatch<ScenarioLabAction>;
  isExpanded: boolean;
}

function CategoryAccordion({ category, variables, taxReturn, scenario, dispatch, isExpanded }: CategoryAccordionProps) {
  const overrideCount = variables.filter(v => scenario.overrides.has(v.key)).length;

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => dispatch({ type: 'TOGGLE_CATEGORY', category })}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-800 hover:bg-surface-700 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className="text-sm font-medium text-slate-200">{CATEGORY_LABELS[category]}</span>
          <span className="text-[10px] text-slate-500">{variables.length}</span>
        </div>
        {overrideCount > 0 && (
          <span className="text-[10px] bg-telos-orange-500/20 text-telos-orange-400 px-1.5 py-0.5 rounded">
            {overrideCount} changed
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="divide-y divide-slate-800/50">
          {variables.map(v => (
            <VariableControl
              key={v.key}
              variable={v}
              taxReturn={taxReturn}
              scenario={scenario}
              dispatch={dispatch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario Editor
// ---------------------------------------------------------------------------

interface ScenarioEditorProps {
  taxReturn: TaxReturn;
  scenario: Scenario;
  dispatch: React.Dispatch<ScenarioLabAction>;
  expandedCategories: Set<string>;
  searchQuery: string;
}

export default function ScenarioEditor({ taxReturn, scenario, dispatch, expandedCategories, searchQuery }: ScenarioEditorProps) {
  // Filter variables by relevance and search query
  const filteredVars = useMemo(() => {
    let vars = VARIABLE_DEFINITIONS.filter(v => !v.isRelevant || v.isRelevant(taxReturn));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      vars = vars.filter(v =>
        v.label.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.key.toLowerCase().includes(q),
      );
    }
    return vars;
  }, [taxReturn, searchQuery]);

  const grouped = useMemo(() => getVariablesByCategory(filteredVars), [filteredVars]);

  // Category order
  const categoryOrder: VariableCategory[] = [
    'personal', 'income_wage', 'income_investment', 'income_se',
    'retirement', 'deductions', 'credits',
  ];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search variables..."
          value={searchQuery}
          onChange={(e) => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
          className="w-full pl-9 pr-3 py-2 bg-surface-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-telos-blue-500 focus:ring-1 focus:ring-telos-blue-500/30"
        />
      </div>

      {/* Reset all */}
      {scenario.overrides.size > 0 && (
        <button
          onClick={() => dispatch({ type: 'CLEAR_ALL_OVERRIDES', scenarioId: scenario.id })}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-telos-orange-400 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset all {scenario.overrides.size} overrides
        </button>
      )}

      {/* Category accordions */}
      <div className="space-y-2">
        {categoryOrder.map(cat => {
          const vars = grouped.get(cat);
          if (!vars || vars.length === 0) return null;
          const hasOverrides = vars.some(v => scenario.overrides.has(v.key));
          return (
            <CategoryAccordion
              key={cat}
              category={cat}
              variables={vars}
              taxReturn={taxReturn}
              scenario={scenario}
              dispatch={dispatch}
              isExpanded={expandedCategories.has(cat)}
            />
          );
        })}
      </div>

      {filteredVars.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-4">
          No variables match your search.
        </p>
      )}
    </div>
  );
}
