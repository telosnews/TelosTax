/**
 * DeltaWaterfall — diverging bar chart showing how each tax category
 * contributes to the net scenario impact.
 *
 * income Δ → adjustment Δ → deduction Δ → tax Δ → credit Δ → net impact
 *
 * Uses Syncfusion BarSeries for tooltips, data labels, and consistent
 * styling with the main TaxFlowDiagram waterfall.
 */

import { useCallback } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, BarSeries, Category, Tooltip, DataLabel, StripLine,
  type IPointRenderEventArgs, type ITextRenderEventArgs,
  type ITooltipRenderEventArgs,
} from '@syncfusion/ej2-react-charts';
import type { DeltaMap } from '../types';
import { formatCurrency } from '../../../utils/format';

interface DeltaWaterfallProps {
  delta: DeltaMap;
}

interface DeltaStep {
  x: string;
  y: number;
  description: string;
  isNet: boolean;
}

export default function DeltaWaterfall({ delta }: DeltaWaterfallProps) {
  const rawSteps: DeltaStep[] = [
    { x: 'Income', y: delta.totalIncome.diff, description: 'Change in total income', isNet: false },
    { x: 'Adjustments', y: -delta.totalAdjustments.diff, description: 'Above-the-line deductions', isNet: false },
    { x: 'Deductions', y: -delta.deductionAmount.diff, description: 'Standard or itemized', isNet: false },
    { x: 'Tax', y: delta.incomeTax.diff, description: 'Income tax change', isNet: false },
    { x: 'Credits', y: -delta.totalCredits.diff, description: 'Tax credits applied', isNet: false },
  ];

  // Filter out zero steps, then add net impact
  const activeSteps = rawSteps.filter(s => Math.abs(s.y) >= 1);
  if (activeSteps.length === 0) return null;

  const netImpact = delta.refundOrOwed.diff;
  activeSteps.push({
    x: 'Net Impact',
    y: netImpact,
    description: netImpact > 0 ? 'Refund increase' : netImpact < 0 ? 'More owed' : 'No change',
    isNet: true,
  });

  // Per-point coloring: individual steps use amber(+)/emerald(-),
  // Net Impact inverts (emerald = more refund, amber = more owed)
  const pointRender = useCallback((args: IPointRenderEventArgs): void => {
    const step = activeSteps[args.point.index];
    if (!step) return;
    if (step.isNet) {
      args.fill = step.y >= 0 ? '#10B981' : '#F59E0B';
    } else {
      args.fill = step.y > 0 ? '#F59E0B99' : '#10B98199'; // 60% opacity
    }
  }, [activeSteps]);

  // Data labels as compact currency
  const textRender = useCallback((args: ITextRenderEventArgs): void => {
    const step = activeSteps[(args.point as any)?.index];
    if (!step) { args.text = ''; return; }
    const val = step.y;
    args.text = `${val > 0 ? '+' : ''}${formatCurrency(val)}`;
  }, [activeSteps]);

  // Rich tooltips
  const tooltipRender = useCallback((args: ITooltipRenderEventArgs): void => {
    const idx = (args.point as any)?.index;
    if (idx == null || !activeSteps[idx]) { args.text = ''; return; }
    const step = activeSteps[idx];
    args.text = `<b>${step.x}</b><br/>${step.description}<br/>${step.y > 0 ? '+' : ''}${formatCurrency(step.y)}`;
  }, [activeSteps]);

  const chartHeight = `${Math.max(140, activeSteps.length * 36 + 40)}px`;

  return (
    <div className="rounded-lg border border-slate-700/50 bg-surface-800 p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Impact Waterfall</h3>
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
        pointRender={pointRender}
        textRender={textRender}
        tooltipRender={tooltipRender}
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
          stripLines: [{
            start: 0,
            size: 1,
            sizeType: 'Pixel',
            color: '#475569',
            visible: true,
          }],
        }}
        legendSettings={{ visible: false }}
      >
        <Inject services={[BarSeries, Category, Tooltip, DataLabel, StripLine]} />
        <SeriesCollectionDirective>
          <SeriesDirective
            dataSource={activeSteps}
            xName="x"
            yName="y"
            type="Bar"
            columnWidth={0.55}
            cornerRadius={{ topLeft: 3, topRight: 3, bottomLeft: 3, bottomRight: 3 }}
            marker={{
              dataLabel: {
                visible: true,
                position: 'Outer',
                font: {
                  color: '#CBD5E1',
                  fontFamily: 'Inter Variable, sans-serif',
                  size: '11px',
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
