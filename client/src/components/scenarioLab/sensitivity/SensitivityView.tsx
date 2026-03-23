/**
 * SensitivityView — config bar + chart + table for sensitivity analysis.
 *
 * Select a variable, range, and output metric. See how the output changes
 * as the input varies across the range.
 *
 * Uses Syncfusion SplineArea chart with crosshair tracking + strip line marker.
 */

import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, SplineAreaSeries, Tooltip, Crosshair, StripLine,
  type ITooltipRenderEventArgs, type IAxisLabelRenderEventArgs,
} from '@syncfusion/ej2-react-charts';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { TaxReturn } from '@telostax/engine';
import { VARIABLE_DEFINITIONS } from '../variableDefinitions';
import type { ScenarioLabAction, SensitivityConfig } from '../types';
import { useSensitivityData } from './useSensitivityData';
import { formatCurrency, formatPercent } from '../../../utils/format';

const OUTPUT_METRICS = [
  { value: 'refundOrOwed', label: 'Refund / Owed' },
  { value: 'totalTax', label: 'Total Tax' },
  { value: 'taxableIncome', label: 'Taxable Income' },
  { value: 'effectiveTaxRate', label: 'Effective Rate' },
  { value: 'marginalTaxRate', label: 'Marginal Rate' },
];

interface SensitivityViewProps {
  taxReturn: TaxReturn;
  config: SensitivityConfig | null;
  dispatch: React.Dispatch<ScenarioLabAction>;
  overrides: Map<string, unknown>;
}

/** Compact currency for axis labels: $100K, $1.2M, $500 */
function formatCompact(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

export default function SensitivityView({ taxReturn, config, dispatch, overrides }: SensitivityViewProps) {
  // Local state for config bar before applying
  const sliderVars = VARIABLE_DEFINITIONS.filter(
    v => v.inputType === 'slider' && v.format === 'currency' && (!v.isRelevant || v.isRelevant(taxReturn)),
  );

  const [selectedVar, setSelectedVar] = useState(config?.variableKey ?? sliderVars[0]?.key ?? '');
  const [outputMetric, setOutputMetric] = useState(config?.outputMetric ?? 'refundOrOwed');
  const [showTable, setShowTable] = useState(false);
  const steps = 50;

  // Sync local state when external config changes (e.g., preset restore, deep-link)
  useEffect(() => {
    if (!config) return;
    setSelectedVar(config.variableKey);
    setOutputMetric(config.outputMetric);
  }, [config]);

  const varDef = VARIABLE_DEFINITIONS.find(v => v.key === selectedVar);
  const resolveMax = varDef ? (typeof varDef.max === 'function' ? varDef.max(taxReturn) : (varDef.max ?? 100)) : 100;

  const activeConfig: SensitivityConfig | null = useMemo(() => {
    if (!selectedVar || !varDef) return null;
    return {
      variableKey: selectedVar,
      outputMetric,
      min: varDef.min ?? 0,
      max: resolveMax,
      steps,
    };
  }, [selectedVar, outputMetric, steps, varDef, resolveMax]);

  const { data, isComputing, progress, currentValue, currentOutput } = useSensitivityData(
    taxReturn, activeConfig, overrides,
  );

  const isRateMetric = outputMetric === 'effectiveTaxRate' || outputMetric === 'marginalTaxRate';
  const formatOutput = (v: number) => isRateMetric ? formatPercent(v) : formatCurrency(v);
  const metricLabel = OUTPUT_METRICS.find(m => m.value === outputMetric)?.label ?? 'Output';

  // ---------------------------------------------------------------------------
  // Syncfusion chart event handlers
  // ---------------------------------------------------------------------------

  const tooltipRender = useCallback((args: ITooltipRenderEventArgs): void => {
    const pt = args.point as any;
    if (!pt) return;
    const xVal = pt.x as number;
    const yVal = pt.y as number;
    const xFmt = formatCurrency(xVal);
    const yFmt = isRateMetric ? formatPercent(yVal) : formatCurrency(yVal);
    args.text = `<b>${varDef?.label ?? 'Input'}: ${xFmt}</b><br/>${metricLabel}: ${yFmt}`;
  }, [varDef, metricLabel, isRateMetric]);

  const axisLabelRender = useCallback((args: IAxisLabelRenderEventArgs): void => {
    const val = (args as any).value as number;
    if (val == null || Number.isNaN(val)) return;
    if (args.axis.name === 'primaryXAxis') {
      args.text = formatCompact(val);
    } else if (args.axis.name === 'primaryYAxis') {
      args.text = isRateMetric ? formatPercent(val) : formatCompact(val);
    }
  }, [isRateMetric]);

  return (
    <div className="space-y-6">
      {/* Config bar */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-700/50 bg-surface-800 p-4">
        <p className="w-full text-xs text-slate-400 mb-1">
          See how changing <strong className="text-white">{varDef?.label ?? 'a variable'}</strong> affects your{' '}
          <strong className="text-white">{metricLabel}</strong>.
        </p>

        <div className="flex-1 min-w-[160px]">
          <label className="text-[10px] text-slate-400 uppercase tracking-wide block mb-1">Change this variable</label>
          <select
            value={selectedVar}
            onChange={(e) => setSelectedVar(e.target.value)}
            className="w-full bg-surface-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-telos-orange-500"
          >
            {sliderVars.map(v => (
              <option key={v.key} value={v.key}>{v.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[160px]">
          <label className="text-[10px] text-slate-400 uppercase tracking-wide block mb-1">See effect on</label>
          <select
            value={outputMetric}
            onChange={(e) => setOutputMetric(e.target.value)}
            className="w-full bg-surface-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-telos-orange-500"
          >
            {OUTPUT_METRICS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress bar */}
      {isComputing && (
        <div className="h-1 bg-surface-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-telos-orange-500 transition-all duration-150"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* Syncfusion Spline Area Chart */}
      {data.length > 1 && activeConfig && (
        <div className="rounded-lg border border-slate-700/50 bg-surface-800 p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            {varDef?.label ?? 'Variable'} vs {metricLabel}
          </h3>
          <ChartComponent
            height="280px"
            background="transparent"
            chartArea={{ border: { width: 0 } }}
            tooltip={{
              enable: true,
              fill: '#1E293B',
              border: { color: '#475569', width: 1 },
              textStyle: { color: '#E2E8F0', fontFamily: 'Inter Variable, sans-serif', size: '12px' },
            }}
            crosshair={{
              enable: true,
              lineType: 'Vertical',
              line: { color: '#475569', width: 1 },
            }}
            tooltipRender={tooltipRender}
            axisLabelRender={axisLabelRender}
            primaryXAxis={{
              valueType: 'Double',
              minimum: activeConfig.min,
              maximum: activeConfig.max,
              labelStyle: { color: '#94A3B8', fontFamily: 'Inter Variable, sans-serif', size: '11px' },
              majorGridLines: { width: 0 },
              lineStyle: { color: '#334155', width: 1 },
              majorTickLines: { width: 0 },
              stripLines: [{
                start: currentValue,
                size: 2,
                sizeType: 'Pixel',
                color: 'rgba(59, 130, 246, 0.5)',
                text: `Current: ${formatCurrency(currentValue)}`,
                textStyle: { color: '#60A5FA', size: '10px' },
                verticalAlignment: 'Start',
                visible: true,
              }],
            }}
            primaryYAxis={{
              labelStyle: { color: '#94A3B8', fontFamily: 'Inter Variable, sans-serif', size: '11px' },
              majorGridLines: { color: '#1E293B', width: 0.5 },
              lineStyle: { width: 0 },
              majorTickLines: { width: 0 },
            }}
            legendSettings={{ visible: false }}
          >
            <Inject services={[SplineAreaSeries, Tooltip, Crosshair, StripLine]} />
            <SeriesCollectionDirective>
              <SeriesDirective
                dataSource={data}
                xName="input"
                yName="output"
                type="SplineArea"
                fill="#F97316"
                opacity={0.15}
                border={{ width: 2, color: '#F97316' }}
                marker={{ visible: false }}
              />
            </SeriesCollectionDirective>
          </ChartComponent>
          <div className="flex justify-between items-center text-[10px] mt-1">
            <span className="text-slate-500">{formatCurrency(activeConfig.min)}</span>
            <span className="text-telos-blue-400 font-medium">
              At current ({formatCurrency(currentValue)}): {formatOutput(currentOutput)}
            </span>
            <span className="text-slate-500">{formatCurrency(activeConfig.max)}</span>
          </div>
        </div>
      )}

      {/* Collapsible data table */}
      {data.length > 0 && (
        <>
          <button
            onClick={() => setShowTable(!showTable)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800 border border-slate-700/50 text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            {showTable ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Data Table ({data.length} points)
          </button>
          {showTable && (
            <div className="rounded-lg border border-slate-700/50 bg-surface-800 overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-800">
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left px-4 py-2 text-slate-400 font-medium">{varDef?.label ?? 'Input'}</th>
                    <th className="text-right px-4 py-2 text-slate-400 font-medium">{metricLabel}</th>
                    <th className="text-right px-4 py-2 text-slate-400 font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {data.map((pt, i) => {
                    const isCurrentRow = Math.abs(pt.input - currentValue) < (activeConfig ? (activeConfig.max - activeConfig.min) / activeConfig.steps / 2 : 1);
                    return (
                      <tr key={i} className={isCurrentRow ? 'bg-telos-blue-500/10' : ''}>
                        <td className="px-4 py-1.5 text-slate-300 font-mono tabular-nums">
                          {varDef?.format === 'currency' ? formatCurrency(pt.input) : pt.input.toLocaleString()}
                        </td>
                        <td className="px-4 py-1.5 text-right text-white font-mono tabular-nums">
                          {formatOutput(pt.output)}
                        </td>
                        <td className={`px-4 py-1.5 text-right font-mono tabular-nums ${
                          pt.delta > 0 ? 'text-emerald-400' : pt.delta < 0 ? 'text-amber-400' : 'text-slate-500'
                        }`}>
                          {pt.delta > 0 ? '+' : ''}{formatOutput(pt.delta)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
