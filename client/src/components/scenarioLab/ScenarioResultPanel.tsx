import { useState } from 'react';
import { TrendingUp, TrendingDown, ArrowDown, ArrowUp, ChevronDown, ChevronRight } from 'lucide-react';
import type { CalculationResult, FilingStatus } from '@telostax/engine';
import type { DeltaMap, DeltaEntry, ScenarioColor } from './types';
import { formatCurrency, formatPercent } from '../../utils/format';
import DeltaWaterfall from './charts/DeltaWaterfall';
import BracketComparison from './charts/BracketComparison';

// ---------------------------------------------------------------------------
// Delta formatting
// ---------------------------------------------------------------------------

function formatDelta(entry: DeltaEntry, format: 'dollar' | 'percent' = 'dollar', higherIsBetter = false): {
  text: string;
  direction: 'better' | 'worse' | 'same';
} {
  if (Math.abs(entry.diff) < 1) return { text: 'No change', direction: 'same' };

  const isPositiveDiff = entry.diff > 0;
  const isBetter = higherIsBetter ? isPositiveDiff : !isPositiveDiff;

  if (format === 'percent') {
    // diff is in decimal (e.g. 0.02 = 2 percentage points change)
    const pctDiff = entry.diff * 100;
    const sign = pctDiff > 0 ? '+' : '';
    return {
      text: `${sign}${pctDiff.toFixed(1)}pp`,
      direction: isBetter ? 'better' : 'worse',
    };
  }

  const sign = entry.diff > 0 ? '+' : '-';
  return {
    text: `${sign}$${Math.abs(Math.round(entry.diff)).toLocaleString()}`,
    direction: isBetter ? 'better' : 'worse',
  };
}

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  entry: DeltaEntry;
  format?: 'dollar' | 'percent';
  higherIsBetter?: boolean;
}

function MetricCard({ label, entry, format = 'dollar', higherIsBetter = false }: MetricCardProps) {
  const delta = formatDelta(entry, format, higherIsBetter);

  return (
    <div className="rounded-lg bg-surface-800 border border-slate-700/50 p-3 text-center">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-white mt-1">
        {format === 'percent'
          ? `${(entry.scenario * 100).toFixed(1)}%`
          : formatCurrency(entry.scenario)}
      </p>
      <p className={`text-[10px] mt-1 flex items-center justify-center gap-0.5 ${
        delta.direction === 'better' ? 'text-emerald-400'
        : delta.direction === 'worse' ? 'text-amber-400'
        : 'text-slate-500'
      }`}>
        {delta.direction === 'better' && <ArrowDown className="w-2.5 h-2.5" />}
        {delta.direction === 'worse' && <ArrowUp className="w-2.5 h-2.5" />}
        {delta.text}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result Panel
// ---------------------------------------------------------------------------

interface ScenarioResultPanelProps {
  baseResult: CalculationResult;
  scenarioResult: CalculationResult;
  delta: DeltaMap;
  baseFilingStatus?: FilingStatus;
  scenarioFilingStatus?: FilingStatus;
  scenarioName?: string;
  scenarioColor?: ScenarioColor;
}

export default function ScenarioResultPanel({ baseResult, scenarioResult, delta, baseFilingStatus, scenarioFilingStatus, scenarioName, scenarioColor }: ScenarioResultPanelProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showCharts, setShowCharts] = useState(false);

  const primaryDelta = delta.refundOrOwed;
  const isBetter = primaryDelta.diff > 0;
  const isWorse = primaryDelta.diff < 0;
  const noChange = Math.abs(primaryDelta.diff) < 1;

  return (
    <div className="space-y-4">
      {/* Hero delta card */}
      <div className={`rounded-lg border p-5 text-center transition-all duration-300 ${
        isBetter
          ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/20'
          : isWorse
            ? 'bg-amber-500/10 border-amber-500/30 shadow-lg shadow-amber-500/20'
            : 'bg-surface-800 border-slate-700/50'
      }`}>
        <p className="text-xs text-slate-400 mb-1">Impact on your return</p>
        <div className="flex items-center justify-center gap-2">
          {isBetter && <TrendingUp className="w-5 h-5 text-emerald-400" />}
          {isWorse && <TrendingDown className="w-5 h-5 text-amber-400" />}
          <p className={`text-3xl font-bold ${
            isBetter ? 'text-emerald-400'
            : isWorse ? 'text-amber-400'
            : 'text-slate-300'
          }`}>
            {noChange ? 'No change' : (
              <>
                {primaryDelta.diff > 0 ? '+' : '-'}${Math.abs(Math.round(primaryDelta.diff)).toLocaleString()}
              </>
            )}
          </p>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {isBetter ? 'More in your pocket' : isWorse ? 'Additional cost' : ''}
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="Taxable Income" entry={delta.taxableIncome} />
        <MetricCard label="Total Tax" entry={delta.totalTax} />
        <MetricCard label="Effective Rate" entry={delta.effectiveTaxRate} format="percent" />
      </div>

      {/* Collapsible: Full Breakdown */}
      <button
        onClick={() => setShowBreakdown(!showBreakdown)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800 border border-slate-700/50 text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        {showBreakdown ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Full Breakdown
      </button>
      {showBreakdown && (
        <div className="rounded-lg border border-slate-700/50 bg-surface-800 overflow-hidden">
          <div className="divide-y divide-slate-800/50">
            <BreakdownRow label="Total Income" entry={delta.totalIncome} />
            <BreakdownRow label="Adjustments" entry={delta.totalAdjustments} invertColor />
            <BreakdownRow label="AGI" entry={delta.agi} />
            <BreakdownRow label="Deductions" entry={delta.deductionAmount} invertColor />
            <BreakdownRow label="Taxable Income" entry={delta.taxableIncome} />
            <BreakdownRow label="Income Tax" entry={delta.incomeTax} />
            {delta.seTax && (delta.seTax.base > 0 || delta.seTax.scenario > 0) && (
              <BreakdownRow label="SE Tax" entry={delta.seTax} />
            )}
            <BreakdownRow label="Total Tax" entry={delta.totalTax} />
            {delta.stateTax && (delta.stateTax.base > 0 || delta.stateTax.scenario > 0) && (
              <BreakdownRow label="State Tax" entry={delta.stateTax} />
            )}
            <BreakdownRow label="Credits" entry={delta.totalCredits} invertColor />
            <BreakdownRow label="Withholding" entry={delta.totalWithholding} invertColor />
          </div>
        </div>
      )}

      {/* Collapsible: Visualizations */}
      <button
        onClick={() => setShowCharts(!showCharts)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800 border border-slate-700/50 text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        {showCharts ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Visualizations
      </button>
      {showCharts && (
        <>
          <DeltaWaterfall delta={delta} />
          {baseFilingStatus && (
            <BracketComparison
              baseTaxableIncome={baseResult.form1040.taxableIncome}
              scenarioTaxableIncome={scenarioResult.form1040.taxableIncome}
              filingStatus={baseFilingStatus}
              scenarioFilingStatus={scenarioFilingStatus}
              scenarioName={scenarioName}
              scenarioColor={scenarioColor}
            />
          )}
        </>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-slate-600 text-center">
        Estimates only. Actual tax impact may vary.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breakdown Row
// ---------------------------------------------------------------------------

interface BreakdownRowProps {
  label: string;
  entry: DeltaEntry;
  invertColor?: boolean; // Adjustments/deductions: higher is better
}

function BreakdownRow({ label, entry, invertColor }: BreakdownRowProps) {
  const diff = entry.diff;
  const hasDiff = Math.abs(diff) >= 1;
  const direction = invertColor
    ? (diff > 0 ? 'better' : diff < 0 ? 'worse' : 'same')
    : (diff < 0 ? 'better' : diff > 0 ? 'worse' : 'same');

  return (
    <div className="flex items-center justify-between px-4 py-2 text-xs">
      <span className="text-slate-400">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-slate-500 tabular-nums">{formatCurrency(entry.base)}</span>
        <span className="text-white tabular-nums font-medium">{formatCurrency(entry.scenario)}</span>
        {hasDiff && (
          <span className={`tabular-nums ${
            direction === 'better' ? 'text-emerald-400' : direction === 'worse' ? 'text-amber-400' : 'text-slate-500'
          }`}>
            {diff > 0 ? '+' : ''}{formatCurrency(diff)}
          </span>
        )}
      </div>
    </div>
  );
}
