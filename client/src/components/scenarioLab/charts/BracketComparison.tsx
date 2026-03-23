/**
 * BracketComparison — overlaid bracket bars showing how a scenario
 * changes the taxpayer's position across tax brackets.
 *
 * Baseline brackets are solid, scenario brackets are 50% opacity overlay.
 * Reuses BRACKET_COLORS from BracketChart.tsx.
 * Pure HTML/CSS flex divs.
 */

import { calculateProgressiveTax } from '@telostax/engine';
import type { FilingStatus, BracketDetail } from '@telostax/engine';
import type { ScenarioColor } from '../types';

// Map tax rates to consistent colors — avoids index-shift when brackets are filtered
const RATE_COLOR_MAP = new Map<number, string>([
  [0.10, 'bg-emerald-500'],
  [0.12, 'bg-telos-blue-500'],
  [0.22, 'bg-blue-500'],
  [0.24, 'bg-indigo-500'],
  [0.32, 'bg-violet-500'],
  [0.35, 'bg-purple-500'],
  [0.37, 'bg-red-500'],
]);

function colorForRate(rate: number): string {
  return RATE_COLOR_MAP.get(rate) ?? 'bg-slate-500';
}

const SCENARIO_TEXT_COLORS: Record<ScenarioColor, string> = {
  orange: 'text-telos-orange-400',
  blue: 'text-telos-blue-400',
  violet: 'text-violet-400',
  emerald: 'text-emerald-400',
};

interface BracketComparisonProps {
  baseTaxableIncome: number;
  scenarioTaxableIncome: number;
  filingStatus: FilingStatus;
  scenarioFilingStatus?: FilingStatus;
  scenarioName?: string;
  scenarioColor?: ScenarioColor;
}

export default function BracketComparison({
  baseTaxableIncome, scenarioTaxableIncome,
  filingStatus, scenarioFilingStatus,
  scenarioName, scenarioColor,
}: BracketComparisonProps) {
  const baseFS = filingStatus;
  const scenFS = scenarioFilingStatus ?? filingStatus;
  const baseResult = calculateProgressiveTax(baseTaxableIncome, baseFS);
  const scenResult = calculateProgressiveTax(scenarioTaxableIncome, scenFS);

  const baseBrackets = baseResult.brackets.filter(b => b.taxAtRate > 0);
  const scenBrackets = scenResult.brackets.filter(b => b.taxAtRate > 0);

  if (baseBrackets.length === 0 && scenBrackets.length === 0) return null;

  // Use the maximum taxable income as reference for proportional widths
  const maxIncome = Math.max(baseTaxableIncome, scenarioTaxableIncome, 1);

  return (
    <div className="rounded-lg border border-slate-700/50 bg-surface-800 p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Bracket Comparison</h3>

      <div className="space-y-3">
        {/* Baseline bar */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-slate-400 w-16">Baseline</span>
            <span className="text-[10px] text-slate-500 font-mono">${baseTaxableIncome.toLocaleString()}</span>
          </div>
          <BracketBar brackets={baseBrackets} totalIncome={maxIncome} opacity="full" />
        </div>

        {/* Scenario bar */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] w-16 truncate ${SCENARIO_TEXT_COLORS[scenarioColor ?? 'orange']}`}>{scenarioName ?? 'Scenario'}</span>
            <span className="text-[10px] text-slate-500 font-mono">${scenarioTaxableIncome.toLocaleString()}</span>
          </div>
          <BracketBar brackets={scenBrackets} totalIncome={maxIncome} opacity="half" />
        </div>
      </div>

      {/* Bracket legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-slate-800">
        {(() => {
          const allRates = new Set([
            ...baseBrackets.map(b => b.rate),
            ...scenBrackets.map(b => b.rate),
          ]);
          return Array.from(allRates).sort((a, b) => a - b).map((rate) => {
            const baseB = baseBrackets.find(b => b.rate === rate);
            const scenB = scenBrackets.find(b => b.rate === rate);
            const diff = (scenB?.taxAtRate ?? 0) - (baseB?.taxAtRate ?? 0);
            return (
              <div key={rate} className="flex items-center gap-1.5 text-[10px]">
                <div className={`w-2.5 h-2.5 rounded-sm ${colorForRate(rate)}`} />
                <span className="text-slate-400">{(rate * 100).toFixed(0)}%</span>
                {Math.abs(diff) >= 1 && (
                  <span className={diff > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {diff > 0 ? '+' : ''}${Math.round(diff).toLocaleString()}
                  </span>
                )}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bracket Bar
// ---------------------------------------------------------------------------

function BracketBar({ brackets, totalIncome, opacity }: {
  brackets: BracketDetail[];
  totalIncome: number;
  opacity: 'full' | 'half';
}) {
  return (
    <div className="flex h-6 rounded overflow-hidden border border-slate-700/50 bg-surface-900">
      {brackets.map((b) => {
        const pct = totalIncome > 0 ? (b.taxableAtRate / totalIncome) * 100 : 0;
        return (
          <div
            key={b.rate}
            className={`${colorForRate(b.rate)} ${opacity === 'half' ? 'opacity-50' : ''} relative flex items-center justify-center transition-all duration-300`}
            style={{ width: `${Math.max(pct, 1.5)}%` }}
            title={`${(b.rate * 100).toFixed(0)}%: $${b.taxableAtRate.toLocaleString()} → $${b.taxAtRate.toLocaleString()} tax`}
          >
            {pct > 12 && (
              <span className="text-[9px] font-bold text-white/80 drop-shadow-sm">
                {(b.rate * 100).toFixed(0)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
