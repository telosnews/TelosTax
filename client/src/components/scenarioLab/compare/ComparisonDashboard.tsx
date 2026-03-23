/**
 * ComparisonDashboard — full-width compare view showing all scenarios side by side.
 *
 * - Column headers with colored scenario labels and override summaries
 * - MetricComparisonRows: each metric as a full-width row with per-scenario values
 * - Side-by-side waterfalls
 * - Bracket overlay
 * - Drill-down table
 */

import { Trophy, ArrowDown, ArrowUp, Lock } from 'lucide-react';
import type { CalculationResult, FilingStatus } from '@telostax/engine';
import type { Scenario, DeltaMap, DeltaEntry } from '../types';
import { formatCurrency, formatPercent } from '../../../utils/format';
import DeltaWaterfall from '../charts/DeltaWaterfall';
import BracketComparison from '../charts/BracketComparison';
import DrillDownTable from './DrillDownTable';

const COLOR_BG: Record<string, string> = {
  orange: 'bg-telos-orange-500/10 border-telos-orange-500/30',
  blue: 'bg-telos-blue-500/10 border-telos-blue-500/30',
  violet: 'bg-violet-500/10 border-violet-500/30',
  emerald: 'bg-emerald-500/10 border-emerald-500/30',
};

const COLOR_TEXT: Record<string, string> = {
  orange: 'text-telos-orange-400',
  blue: 'text-telos-blue-400',
  violet: 'text-violet-400',
  emerald: 'text-emerald-400',
};

const COLOR_DOT: Record<string, string> = {
  orange: 'bg-telos-orange-500',
  blue: 'bg-telos-blue-500',
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
};

interface ComparisonDashboardProps {
  scenarios: Scenario[];
  baseResult: CalculationResult;
  scenarioResults: Map<string, CalculationResult>;
  deltas: Map<string, DeltaMap>;
  baseFilingStatus: FilingStatus;
}

export default function ComparisonDashboard({
  scenarios, baseResult, scenarioResults, deltas, baseFilingStatus,
}: ComparisonDashboardProps) {
  if (scenarios.length === 0) return null;

  // Helper: read baseline metric directly from baseResult (not from scenario deltas)
  const bf = baseResult.form1040;
  const baseStateTax = baseResult.stateResults?.reduce((s, sr) => s + sr.totalStateTax, 0) ?? 0;
  const baseRefundNet = bf.refundAmount > 0 ? bf.refundAmount : -bf.amountOwed;
  const baseMetrics: Record<string, number> = {
    refundOrOwed: baseRefundNet,
    taxableIncome: bf.taxableIncome,
    totalTax: bf.totalTax,
    effectiveTaxRate: bf.effectiveTaxRate,
    totalCredits: bf.totalCredits,
    stateTax: baseStateTax,
  };

  // Check if any scenario or baseline has state tax
  const hasStateTax = scenarios.some(s => {
    const d = deltas.get(s.id);
    return d && (d.stateTax?.base > 0 || d.stateTax?.scenario > 0);
  });

  const metrics: { key: string; label: string; format: 'dollar' | 'percent'; better: 'higher' | 'lower' }[] = [
    { key: 'refundOrOwed', label: 'Refund / Owed', format: 'dollar', better: 'higher' },
    { key: 'taxableIncome', label: 'Taxable Income', format: 'dollar', better: 'lower' },
    { key: 'totalTax', label: 'Total Tax', format: 'dollar', better: 'lower' },
    { key: 'effectiveTaxRate', label: 'Effective Rate', format: 'percent', better: 'lower' },
    { key: 'totalCredits', label: 'Total Credits', format: 'dollar', better: 'higher' },
    ...(hasStateTax ? [{ key: 'stateTax', label: 'State Tax', format: 'dollar' as const, better: 'lower' as const }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Scenario column headers (baseline + scenarios) */}
      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${scenarios.length + 1}, 1fr)` }}>
        {/* Baseline column */}
        {(() => {
          const baseNet = baseResult.form1040.refundAmount > 0
            ? baseResult.form1040.refundAmount
            : -baseResult.form1040.amountOwed;
          const isRefund = baseNet > 0;
          return (
            <div className="rounded-lg border p-4 bg-slate-500/5 border-slate-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-semibold text-slate-300">Baseline</span>
              </div>
              <p className="text-[10px] text-slate-500">Current return</p>
              <p className={`text-lg font-bold mt-1 ${isRefund ? 'text-emerald-400' : baseNet < 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                {formatCurrency(baseNet)}
              </p>
            </div>
          );
        })()}
        {scenarios.map(s => {
          const delta = deltas.get(s.id);
          const net = delta?.refundOrOwed.diff ?? 0;
          return (
            <div key={s.id} className={`rounded-lg border p-4 ${COLOR_BG[s.color] ?? COLOR_BG.orange}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[s.color] ?? COLOR_DOT.orange}`} />
                <span className={`text-sm font-semibold ${COLOR_TEXT[s.color] ?? COLOR_TEXT.orange}`}>{s.name}</span>
              </div>
              <p className="text-[10px] text-slate-500">{s.overrides.size} override{s.overrides.size !== 1 ? 's' : ''}</p>
              <p className={`text-lg font-bold mt-1 ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                {net > 0 ? '+' : ''}{formatCurrency(net)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Metric comparison rows */}
      <div className="rounded-lg border border-slate-700/50 bg-surface-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Key Metrics</h3>
        </div>

        <div className="divide-y divide-slate-800/50">
          {metrics.map(m => {
            // Find the "best" scenario for this metric
            let bestId: string | null = null;
            let bestVal = -Infinity;
            for (const s of scenarios) {
              const d = deltas.get(s.id);
              if (!d) continue;
              const entry = d[m.key] as DeltaEntry | undefined;
              if (!entry) continue;
              const score = m.better === 'higher' ? entry.scenario : -entry.scenario;
              if (score > bestVal) { bestVal = score; bestId = s.id; }
            }

            return (
              <div key={m.key} className="px-4 py-3">
                <div className="mb-2">
                  <span className="text-xs text-slate-400">{m.label}</span>
                </div>

                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${scenarios.length + 1}, 1fr)` }}>
                  {/* Baseline value — full bar treatment matching scenarios */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="h-4 bg-surface-900 rounded overflow-hidden">
                        <div className="h-full rounded bg-slate-500 opacity-40" style={{ width: '100%' }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 min-w-[80px] justify-end">
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        {m.format === 'percent' ? formatPercent(baseMetrics[m.key] ?? 0) : formatCurrency(baseMetrics[m.key] ?? 0)}
                      </span>
                    </div>
                  </div>
                  {scenarios.map(s => {
                    const entry = deltas.get(s.id)?.[m.key] as DeltaEntry | undefined;
                    if (!entry) return <div key={s.id} />;
                    const diff = entry.diff;
                    const isBest = s.id === bestId && scenarios.length > 1 && Math.abs(diff) >= 1;

                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        <div className="flex-1">
                          {/* Bar */}
                          <div className="h-4 bg-surface-900 rounded overflow-hidden">
                            <div
                              className={`h-full rounded transition-all duration-300 ${COLOR_DOT[s.color]?.replace('bg-', 'bg-') ?? 'bg-slate-500'} opacity-60`}
                              style={{ width: `${entry.base !== 0 ? Math.min(Math.abs(entry.scenario / entry.base) * 100, 100) : (entry.scenario === 0 ? 0 : 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 min-w-[80px] justify-end">
                          <span className="text-[11px] font-mono tabular-nums text-white">
                            {m.format === 'percent' ? formatPercent(entry.scenario) : formatCurrency(entry.scenario)}
                          </span>
                          {isBest && <Trophy className="w-3 h-3 text-yellow-400" />}
                        </div>
                        {Math.abs(diff) >= 1 && (
                          <span className={`text-[10px] tabular-nums ${
                            (m.better === 'higher' ? diff > 0 : diff < 0) ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {diff > 0 ? <ArrowUp className="w-2.5 h-2.5 inline" /> : <ArrowDown className="w-2.5 h-2.5 inline" />}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side-by-side waterfalls */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Impact Waterfalls</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(scenarios.length, 2)}, 1fr)` }}>
          {scenarios.map(s => {
            const delta = deltas.get(s.id);
            if (!delta) return null;
            return (
              <div key={s.id}>
                <p className={`text-[11px] font-medium mb-2 ${COLOR_TEXT[s.color] ?? COLOR_TEXT.orange}`}>{s.name}</p>
                <DeltaWaterfall delta={delta} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bracket overlay — all scenarios vs baseline */}
      {scenarios.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Bracket Comparison</h3>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(scenarios.length, 2)}, 1fr)` }}>
            {scenarios.map(s => {
              const result = scenarioResults.get(s.id);
              if (!result) return null;
              const scenFS = s.overrides.has('filing_status')
                ? Number(s.overrides.get('filing_status')) as FilingStatus
                : undefined;
              return (
                <div key={s.id}>
                  <p className={`text-[11px] font-medium mb-2 ${COLOR_TEXT[s.color] ?? COLOR_TEXT.orange}`}>{s.name}</p>
                  <BracketComparison
                    baseTaxableIncome={baseResult.form1040.taxableIncome}
                    scenarioTaxableIncome={result.form1040.taxableIncome}
                    filingStatus={baseFilingStatus}
                    scenarioFilingStatus={scenFS}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drill-down table */}
      <DrillDownTable
        scenarios={scenarios}
        baseResult={baseResult}
        scenarioResults={scenarioResults}
      />
    </div>
  );
}
