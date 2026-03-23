import { useCallback, useMemo } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, WaterfallSeries, Category, Tooltip, DataLabel,
  type IPointRenderEventArgs, type ITooltipRenderEventArgs, type ITextRenderEventArgs,
  type IMouseEventArgs,
} from '@syncfusion/ej2-react-charts';

interface AdjustmentStep {
  x: string;
  y: number;
  isSum?: boolean;
  stepId?: string;
}

interface AdjustmentsWaterfallProps {
  totalIncome: number;
  adjustments: Array<{ label: string; amount: number; stepId: string }>;
  agi: number;
  onBarClick?: (stepId: string) => void;
}

const fmtDollars = (v: number): string => `$${Math.abs(v).toLocaleString()}`;

export default function AdjustmentsWaterfall({ totalIncome, adjustments, agi, onBarClick }: AdjustmentsWaterfallProps) {
  if (totalIncome <= 0 || adjustments.length === 0) return null;

  const { steps, sumIndexes } = useMemo(() => {
    const raw: AdjustmentStep[] = [
      { x: 'Total Income', y: totalIncome },
    ];

    for (const adj of adjustments) {
      if (adj.amount > 0) {
        raw.push({ x: adj.label, y: -adj.amount, stepId: adj.stepId });
      }
    }

    raw.push({ x: 'AGI', y: agi, isSum: true });

    return { steps: raw, sumIndexes: [raw.length - 1] };
  }, [totalIncome, adjustments, agi]);

  const pointRender = useCallback((args: IPointRenderEventArgs): void => {
    const step = steps[args.point.index];
    if (!step) return;
    if (step.isSum) {
      args.fill = '#10B981';
    } else if (args.point.index === 0) {
      args.fill = '#3B82F6';
    } else {
      args.fill = '#F59E0B';
    }
  }, [steps]);

  const textRender = useCallback((args: ITextRenderEventArgs): void => {
    const step = steps[(args.point as any)?.index];
    if (!step) { args.text = ''; return; }
    args.text = fmtDollars(step.y);
  }, [steps]);

  const tooltipRender = useCallback((args: ITooltipRenderEventArgs): void => {
    const idx = (args.point as any)?.index;
    if (idx == null || !steps[idx]) { args.text = ''; return; }
    const step = steps[idx];
    if (step.isSum) {
      const saved = totalIncome - agi;
      args.text = `${step.x}\n${fmtDollars(step.y)}\nReduced by ${fmtDollars(saved)}`;
    } else if (idx === 0) {
      args.text = `${step.x}\n${fmtDollars(step.y)}`;
    } else {
      args.text = `${step.x}\n-${fmtDollars(Math.abs(step.y))}`;
    }
  }, [steps, totalIncome, agi]);

  const chartMouseClick = useCallback((args: IMouseEventArgs): void => {
    if (!onBarClick) return;
    const idx = (args.target ?? '').match(/_Series_0_Point_(\d+)/)?.[1];
    if (idx == null) return;
    const step = steps[Number(idx)];
    if (step?.stepId) onBarClick(step.stepId);
  }, [steps, onBarClick]);

  const chartHeight = `${Math.max(160, steps.length * 48 + 20)}px`;

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mt-4 mb-3" style={{ cursor: onBarClick ? 'pointer' : 'default' }}>
      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Income → AGI Waterfall
      </h4>
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
        chartMouseClick={chartMouseClick}
        primaryXAxis={{
          valueType: 'Category',
          isInversed: true,
          labelStyle: { color: '#94A3B8', fontFamily: 'Inter Variable, sans-serif', size: '11px' },
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
        <Inject services={[WaterfallSeries, Category, Tooltip, DataLabel]} />
        <SeriesCollectionDirective>
          <SeriesDirective
            dataSource={steps}
            xName="x"
            yName="y"
            type="Waterfall"
            sumIndexes={sumIndexes}
            columnWidth={0.55}
            cornerRadius={{ topLeft: 3, topRight: 3, bottomLeft: 3, bottomRight: 3 }}
            connector={{ color: '#475569', width: 1, dashArray: '4,3' }}
            marker={{
              dataLabel: {
                visible: true,
                position: 'Outer',
                font: { color: '#E2E8F0', fontFamily: 'Inter Variable, sans-serif', size: '11px', fontWeight: '600' },
              },
            }}
          />
        </SeriesCollectionDirective>
      </ChartComponent>
    </div>
  );
}
