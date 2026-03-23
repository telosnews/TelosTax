/**
 * Tax Scenario Lab — standalone tool view.
 *
 * Create up to 4 named scenarios, adjust any major tax variable via sliders
 * and inputs, compare side by side with rich visualizations.
 * All state is local — nothing is saved to the tax return store.
 */

import { FlaskConical, Columns2, SlidersHorizontal, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { FilingStatus } from '@telostax/engine';
import { formatCurrency, formatPercent } from '../../utils/format';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import ToolViewWrapper from '../tools/ToolViewWrapper';
import ScenarioTabBar from './ScenarioTabBar';
import ScenarioEditor from './ScenarioEditor';
import ScenarioResultPanel from './ScenarioResultPanel';
import ComparisonDashboard from './compare/ComparisonDashboard';
import SensitivityView from './sensitivity/SensitivityView';
import { useScenarioLab } from './useScenarioLab';
import type { ViewMode } from './types';

// Stable empty map to avoid new reference on every render
const EMPTY_OVERRIDES = new Map<string, unknown>();

// ---------------------------------------------------------------------------
// View Mode Switcher
// ---------------------------------------------------------------------------

const VIEW_MODES: { id: ViewMode; label: string; icon: typeof SlidersHorizontal; disabled?: boolean }[] = [
  { id: 'editor', label: 'Editor', icon: SlidersHorizontal },
  { id: 'compare', label: 'Compare', icon: Columns2 },
  { id: 'sensitivity', label: 'What-If Chart', icon: Activity },
];

interface ViewModeSwitcherProps {
  current: ViewMode;
  onChange: (mode: ViewMode) => void;
  canCompare: boolean;
}

function ViewModeSwitcher({ current, onChange, canCompare }: ViewModeSwitcherProps) {
  return (
    <div className="flex items-center bg-surface-800 rounded-lg border border-slate-700/50 p-0.5">
      {VIEW_MODES.map(m => {
        const Icon = m.icon;
        const isDisabled = m.disabled || (m.id === 'compare' && !canCompare);
        return (
          <button
            key={m.id}
            onClick={() => !isDisabled && onChange(m.id)}
            disabled={isDisabled}
            title={isDisabled && m.id === 'compare' ? 'Create a scenario to compare' : m.label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              current === m.id
                ? 'bg-surface-700 text-white'
                : isDisabled
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-10 max-w-lg mx-auto">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-telos-orange-500/10 text-telos-orange-400 mb-4">
        <FlaskConical className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-3">Tax Scenario Lab</h1>
      <p className="text-lg text-slate-400 mb-6">
        See how changes to your income, deductions, or filing status would affect your refund — without touching your actual return.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-10 text-left">
        {[
          { step: '1', title: 'Adjust variables', desc: 'Change income, deductions, credits' },
          { step: '2', title: 'See impact instantly', desc: 'Real-time refund/owed changes' },
          { step: '3', title: 'Compare scenarios', desc: 'Side-by-side up to 4 options' },
        ].map(s => (
          <div key={s.step} className="rounded-lg bg-surface-800 border border-slate-700/50 p-4">
            <div className="text-telos-orange-400 text-sm font-bold mb-1.5">Step {s.step}</div>
            <p className="text-base font-medium text-white">{s.title}</p>
            <p className="text-sm text-slate-500 mt-0.5">{s.desc}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onAdd}
        className="px-6 py-3 bg-telos-orange-500 hover:bg-telos-orange-600 text-white rounded-lg text-base font-medium transition-colors"
      >
        Create Your First Scenario
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Baseline Info (when baseline tab is selected)
// ---------------------------------------------------------------------------

function BaselineInfo({ baseResult }: { baseResult: import('@telostax/engine').CalculationResult }) {
  const f = baseResult.form1040;
  const isRefund = f.refundAmount > 0;

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-5 text-center ${
        isRefund ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'
      }`}>
        <p className="text-xs text-slate-400 mb-1">{isRefund ? 'Your Current Refund' : 'You Currently Owe'}</p>
        <p className={`text-3xl font-bold ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
          ${(isRefund ? f.refundAmount : f.amountOwed).toLocaleString()}
        </p>
        <p className="text-xs text-slate-400 mt-1">This is your baseline — create a scenario to compare</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          { label: 'Total Income', value: `$${f.totalIncome.toLocaleString()}` },
          { label: 'Taxable Income', value: `$${f.taxableIncome.toLocaleString()}` },
          { label: 'Total Tax', value: `$${f.totalTax.toLocaleString()}` },
          { label: 'Effective Rate', value: formatPercent(f.effectiveTaxRate) },
          { label: 'Credits', value: `$${f.totalCredits.toLocaleString()}` },
          { label: 'Withholding', value: `$${f.totalWithholding.toLocaleString()}` },
        ].map(m => (
          <div key={m.label} className="rounded-lg bg-surface-800 border border-slate-700/50 p-3 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{m.label}</p>
            <p className="text-sm font-semibold text-white mt-1">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ScenarioLabToolView() {
  const { taxReturn } = useTaxReturnStore();
  if (!taxReturn) return null;
  return <ScenarioLabInner taxReturn={taxReturn} />;
}

function ScenarioLabInner({ taxReturn }: { taxReturn: import('@telostax/engine').TaxReturn }) {
  const { state, dispatch, baseResult, scenarioResults, deltas } = useScenarioLab(taxReturn);
  const activeScenario = state.scenarios.find(s => s.id === state.activeScenarioId) ?? null;
  const activeResult = state.activeScenarioId ? scenarioResults.get(state.activeScenarioId) : null;
  const activeDelta = state.activeScenarioId ? deltas.get(state.activeScenarioId) : null;

  return (
    <ToolViewWrapper>
      {/* Content */}
      {state.scenarios.length === 0 ? (
        <EmptyState onAdd={() => dispatch({ type: 'ADD_SCENARIO' })} />
      ) : (
        <>
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <ScenarioTabBar
              scenarios={state.scenarios}
              activeScenarioId={state.activeScenarioId}
              dispatch={dispatch}
            />
            <ViewModeSwitcher
              current={state.viewMode}
              onChange={(mode) => dispatch({ type: 'SET_VIEW_MODE', mode })}
              canCompare={state.scenarios.length >= 1}
            />
          </div>

          {state.viewMode === 'editor' ? (
        <div className={`grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 ${activeScenario && activeDelta ? 'pb-20 lg:pb-0' : ''}`}>
          {/* Left: Editor or Baseline info */}
          <div>
            {activeScenario ? (
              <ScenarioEditor
                taxReturn={taxReturn}
                scenario={activeScenario}
                dispatch={dispatch}
                expandedCategories={state.expandedCategories}
                searchQuery={state.searchQuery}
              />
            ) : (
              <div className="rounded-lg border border-slate-700/50 bg-surface-800 p-6 text-center">
                <p className="text-sm text-slate-400">
                  Select a scenario tab to edit variables, or view your baseline results.
                </p>
              </div>
            )}
          </div>

          {/* Right: Results (hidden on mobile — see sticky bar below) */}
          <div className="hidden lg:block sticky top-6 self-start max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-thin">
            {activeScenario && activeResult && activeDelta ? (
              <ScenarioResultPanel
                baseResult={baseResult}
                scenarioResult={activeResult}
                delta={activeDelta}
                baseFilingStatus={taxReturn.filingStatus || FilingStatus.Single}
                scenarioFilingStatus={
                  activeScenario.overrides.has('filing_status')
                    ? Number(activeScenario.overrides.get('filing_status')) as FilingStatus
                    : undefined
                }
                scenarioName={activeScenario.name}
                scenarioColor={activeScenario.color}
              />
            ) : (
              <BaselineInfo baseResult={baseResult} />
            )}
          </div>

          {/* Mobile: sticky bottom bar with hero delta */}
          {activeScenario && activeDelta && (() => {
            const net = activeDelta.refundOrOwed.diff;
            const isBetter = net > 0;
            const isWorse = net < 0;
            const noChange = Math.abs(net) < 1;
            return (
              <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-surface-900/95 backdrop-blur border-t border-slate-700/50 px-4 py-3">
                <div className="flex items-center justify-between max-w-lg mx-auto">
                  <div className="flex items-center gap-2">
                    {isBetter && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                    {isWorse && <TrendingDown className="w-4 h-4 text-amber-400" />}
                    <span className={`text-lg font-bold ${
                      isBetter ? 'text-emerald-400' : isWorse ? 'text-amber-400' : 'text-slate-300'
                    }`}>
                      {noChange ? 'No change' : `${net > 0 ? '+' : '-'}$${Math.abs(Math.round(net)).toLocaleString()}`}
                    </span>
                    <span className="text-xs text-slate-500">
                      {isBetter ? 'more back' : isWorse ? 'more owed' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span>Tax: {formatCurrency(activeDelta.totalTax.scenario)}</span>
                    <span>Rate: {formatPercent(activeDelta.effectiveTaxRate.scenario)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
          ) : state.viewMode === 'compare' ? (
            <ComparisonDashboard
              scenarios={state.scenarios}
              baseResult={baseResult}
              scenarioResults={scenarioResults}
              deltas={deltas}
              baseFilingStatus={taxReturn.filingStatus || FilingStatus.Single}
            />
          ) : state.viewMode === 'sensitivity' ? (
            <SensitivityView
              taxReturn={taxReturn}
              config={state.sensitivityConfig}
              dispatch={dispatch}
              overrides={activeScenario?.overrides ?? EMPTY_OVERRIDES}
            />
          ) : null}
        </>
      )}
    </ToolViewWrapper>
  );
}

