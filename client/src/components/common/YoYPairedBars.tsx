/**
 * YoYPairedBars — clustered horizontal bar chart comparing top metrics
 * between prior year and current year.
 *
 * Prior year bars are muted (30% opacity), current year bars are vivid.
 * Shows the 5 largest metrics by current-year value for a clear visual
 * comparison of where the biggest numbers are.
 */

import { useCallback, useMemo } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, BarSeries, Category, Tooltip, DataLabel,
  type ITooltipRenderEventArgs, type ITextRenderEventArgs,
} from '@syncfusion/ej2-react-charts';
import type { PriorYearSummary, Form1040Result } from '@telostax/engine';

interface YoYPairedBarsProps {
  priorYear: PriorYearSummary;
  current: Form1040Result;
}

interface MetricPair {
  label: string;
  prior: number;
  current: number;
}

function fmtCompact(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

export default function YoYPairedBars({ priorYear, current }: YoYPairedBarsProps) {
  const metrics = useMemo((): MetricPair[] => {
    const all: MetricPair[] = [
      { label: 'Total Income', prior: priorYear.totalIncome, current: current.totalIncome },
      { label: 'AGI', prior: priorYear.agi, current: current.agi },
      { label: 'Deductions', prior: priorYear.deductionAmount, current: current.deductionAmount },
      { label: 'Taxable Income', prior: priorYear.taxableIncome, current: current.taxableIncome },
      { label: 'Total Tax', prior: priorYear.totalTax, current: current.totalTax },
    ];

    // Filter out metrics where both values are near zero
    return all.filter(m => Math.abs(m.prior) >= 1 || Math.abs(m.current) >= 1);
  }, [priorYear, current]);

  const chartData = useMemo(() =>
    metrics.map(m => ({
      x: m.label,
      prior: m.prior,
      current: m.current,
    })),
  [metrics]);

  const tooltipRender = useCallback((args: ITooltipRenderEventArgs): void => {
    const pt = args.point as any;
    if (!pt) return;
    const seriesName = (args.series as any)?.name || '';
    const val = pt.y as number;
    args.text = `<b>${pt.x}</b><br/>${seriesName}: ${fmtCompact(val)}`;
  }, []);

  const textRender = useCallback((args: ITextRenderEventArgs): void => {
    const val = parseFloat(args.text?.replace(/[$,]/g, '') || '0');
    args.text = fmtCompact(val);
  }, []);

  if (chartData.length === 0) return null;

  const chartHeight = `${Math.max(140, chartData.length * 52 + 30)}px`;

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
          Side-by-Side Comparison
        </h4>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-telos-blue-500/30" />
            <span className="text-slate-500">{priorYear.taxYear}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-telos-blue-500" />
            <span className="text-slate-500">2025</span>
          </span>
        </div>
      </div>
      <ChartComponent
        height={chartHeight}
        background="transparent"
        isTransposed={true}
        chartArea={{ border: { width: 0 } }}
        tooltip={{
          enable: true,
          fill: '#1E293B',
          border: { color: '#475569', width: 1 },
          textStyle: { color: '#E2E8F0', fontFamily: 'Inter Variable, sans-serif', size: '12px' },
        }}
        tooltipRender={tooltipRender}
        textRender={textRender}
        primaryXAxis={{
          valueType: 'Category',
          isInversed: true,
          labelStyle: {
            color: '#94A3B8',
            fontFamily: 'Inter Variable, sans-serif',
            size: '11px',
          },
          majorGridLines: { width: 0 },
          majorTickLines: { width: 0 },
          lineStyle: { width: 0 },
        }}
        primaryYAxis={{
          visible: false,
          majorGridLines: { width: 0 },
        }}
        legendSettings={{ visible: false }}
      >
        <Inject services={[BarSeries, Category, Tooltip, DataLabel]} />
        <SeriesCollectionDirective>
          {/* Prior year — muted */}
          <SeriesDirective
            dataSource={chartData}
            xName="x"
            yName="prior"
            name={String(priorYear.taxYear)}
            type="Bar"
            fill="rgba(59, 130, 246, 0.25)"
            columnWidth={0.35}
            columnSpacing={0.05}
            cornerRadius={{ topLeft: 2, topRight: 2, bottomLeft: 2, bottomRight: 2 }}
            marker={{
              dataLabel: {
                visible: true,
                position: 'Outer',
                font: {
                  color: '#64748B',
                  fontFamily: 'Inter Variable, sans-serif',
                  size: '10px',
                  fontWeight: '400',
                },
              },
            }}
          />
          {/* Current year — vivid */}
          <SeriesDirective
            dataSource={chartData}
            xName="x"
            yName="current"
            name="2025"
            type="Bar"
            fill="#3B82F6"
            columnWidth={0.35}
            columnSpacing={0.05}
            cornerRadius={{ topLeft: 2, topRight: 2, bottomLeft: 2, bottomRight: 2 }}
            marker={{
              dataLabel: {
                visible: true,
                position: 'Outer',
                font: {
                  color: '#CBD5E1',
                  fontFamily: 'Inter Variable, sans-serif',
                  size: '10px',
                  fontWeight: '500',
                },
              },
            }}
          />
        </SeriesCollectionDirective>
      </ChartComponent>
    </div>
  );
}
