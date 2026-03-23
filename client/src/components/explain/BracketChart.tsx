/**
 * BracketChart — visual bar chart showing how taxable income fills each bracket.
 *
 * Uses Syncfusion's ChartComponent with stacked bar series to show:
 * - How much income falls in each bracket (proportional bar widths)
 * - The tax rate for each bracket (series labels + tooltips)
 * - The tax amount per bracket (tooltip detail)
 * - Interactive hover tooltips with full breakdown
 */

import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, StackingBarSeries, Category, Tooltip, DataLabel, Legend,
  type ITooltipRenderEventArgs,
} from '@syncfusion/ej2-react-charts';
import { calculateProgressiveTax } from '@telostax/engine';
import type { FilingStatus } from '@telostax/engine';

interface BracketChartProps {
  taxableIncome: number;
  filingStatus: FilingStatus;
  incomeTax: number;
}

const BRACKET_COLORS = [
  '#10B981', // emerald-500  — 10%
  '#1D6FAD', // telos-blue-500 — 12%
  '#3B82F6', // blue-500    — 22%
  '#6366F1', // indigo-500  — 24%
  '#8B5CF6', // violet-500  — 32%
  '#A855F7', // purple-500  — 35%
  '#EF4444', // red-500     — 37%
];

export default function BracketChart({ taxableIncome, filingStatus, incomeTax }: BracketChartProps) {
  if (taxableIncome <= 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-slate-400">
          Your deductions exceed your income, so no income tax applies to any bracket.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Taxable income: $0
        </p>
      </div>
    );
  }

  const result = calculateProgressiveTax(taxableIncome, filingStatus);
  const activeBrackets = result.brackets.filter((b) => b.taxAtRate > 0);

  if (activeBrackets.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-slate-400">No income tax was calculated for this bracket configuration.</p>
      </div>
    );
  }

  const tooltipRender = (args: ITooltipRenderEventArgs): void => {
    const point = args.point as any;
    if (point) {
      const idx = args.series ? (args.series as any).index : 0;
      const bracket = activeBrackets[idx];
      if (bracket) {
        args.text = `<b>${(bracket.rate * 100).toFixed(0)}% bracket</b><br/>` +
          `Income: $${bracket.taxableAtRate.toLocaleString()}<br/>` +
          `Tax: $${bracket.taxAtRate.toLocaleString()}`;
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Syncfusion Stacked Bar */}
      <ChartComponent
        height="80px"
        background="transparent"
        chartArea={{ border: { width: 0 } }}
        tooltip={{ enable: true, format: '${point.tooltip}' }}
        tooltipRender={tooltipRender}
        primaryXAxis={{
          valueType: 'Category',
          visible: false,
        }}
        primaryYAxis={{
          visible: false,
          maximum: taxableIncome,
        }}
        legendSettings={{ visible: false }}
      >
        <Inject services={[StackingBarSeries, Category, Tooltip, DataLabel, Legend]} />
        <SeriesCollectionDirective>
          {activeBrackets.map((b, i) => (
            <SeriesDirective
              key={b.rate}
              dataSource={[{ x: 'Income', y: b.taxableAtRate }]}
              xName="x"
              yName="y"
              type="StackingBar"
              fill={BRACKET_COLORS[i] || '#64748B'}
              columnWidth={0.8}
              cornerRadius={{ topRight: i === activeBrackets.length - 1 ? 6 : 0, bottomRight: i === activeBrackets.length - 1 ? 6 : 0, topLeft: i === 0 ? 6 : 0, bottomLeft: i === 0 ? 6 : 0 }}
              name={`${(b.rate * 100).toFixed(0)}%`}
            />
          ))}
        </SeriesCollectionDirective>
      </ChartComponent>

      <div className="flex justify-between text-[10px] text-slate-400 -mt-2">
        <span>$0</span>
        <span>${taxableIncome.toLocaleString()}</span>
      </div>

      {/* Per-bracket breakdown table */}
      <div className="space-y-1.5">
        {activeBrackets.map((detail, i) => {
          const pctOfIncome = taxableIncome > 0 ? (detail.taxableAtRate / taxableIncome) * 100 : 0;

          return (
            <div key={detail.rate} className="grid grid-cols-[60px_1fr_80px_80px] gap-2 items-center text-xs">
              {/* Rate badge */}
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BRACKET_COLORS[i] || '#64748B' }} />
                <span className="font-semibold" style={{ color: BRACKET_COLORS[i] || '#94A3B8' }}>
                  {(detail.rate * 100).toFixed(0)}%
                </span>
              </div>

              {/* Fill bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-surface-900 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full opacity-60"
                    style={{ width: `${Math.max(pctOfIncome, 2)}%`, backgroundColor: BRACKET_COLORS[i] || '#64748B' }}
                  />
                </div>
                <span className="text-slate-400 text-[10px] w-8 text-right">
                  {pctOfIncome.toFixed(0)}%
                </span>
              </div>

              {/* Income in bracket */}
              <span className="text-right text-slate-400 font-mono">
                ${detail.taxableAtRate.toLocaleString()}
              </span>

              {/* Tax from bracket */}
              <span className="text-right text-slate-300 font-mono font-medium">
                ${detail.taxAtRate.toLocaleString()}
              </span>
            </div>
          );
        })}

        {/* Header labels */}
        <div className="grid grid-cols-[60px_1fr_80px_80px] gap-2 items-center text-[10px] text-slate-600 border-t border-slate-800 pt-1.5 mt-2">
          <span>Rate</span>
          <span>Share of income</span>
          <span className="text-right">Income</span>
          <span className="text-right">Tax</span>
        </div>
      </div>
    </div>
  );
}
