import { useCallback } from 'react';
import {
  AccumulationChartComponent,
  AccumulationSeriesCollectionDirective,
  AccumulationSeriesDirective,
  Inject,
  PieSeries,
  AccumulationTooltip,
  AccumulationDataLabel,
  type IAccPointRenderEventArgs,
  type IAccTooltipRenderEventArgs,
  type IAccTextRenderEventArgs,
  type IMouseEventArgs,
} from '@syncfusion/ej2-react-charts';

interface IncomeDonutProps {
  items: Array<{ label: string; value: number; stepId: string }>;
  onSliceClick?: (stepId: string) => void;
  height?: string;
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#14B8A6',
  '#EF4444', '#F97316', '#EC4899', '#06B6D4', '#84CC16',
];

const fmtCompact = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toLocaleString()}`;
};

const fmtDollars = (v: number): string => `$${v.toLocaleString()}`;

export default function IncomeDonut({ items: rawItems, onSliceClick, height = '640px' }: IncomeDonutProps) {
  if (rawItems.length === 0) return null;

  // Sort descending so large slices spread around the ring,
  // preventing all small-slice labels from stacking on one side
  const items = [...rawItems].sort((a, b) => b.value - a.value);
  const total = items.reduce((s, i) => s + i.value, 0);

  const pointRender = useCallback((args: IAccPointRenderEventArgs): void => {
    args.fill = COLORS[args.point.index % COLORS.length];
  }, []);

  const tooltipRender = useCallback((args: IAccTooltipRenderEventArgs): void => {
    const idx = args.point?.index;
    if (idx == null || !items[idx]) return;
    const item = items[idx];
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
    args.text = `<b>${item.label}</b><br/>${fmtDollars(item.value)}<br/>${pct}%`;
  }, [items, total]);

  const textRender = useCallback((args: IAccTextRenderEventArgs): void => {
    const idx = (args.point as any)?.index;
    if (idx == null || !items[idx]) { args.text = ''; return; }
    args.text = fmtCompact(items[idx].value);
  }, [items]);

  const chartMouseClick = useCallback((args: IMouseEventArgs): void => {
    const idx = (args.target ?? '').match(/_Series_0_Point_(\d+)/)?.[1];
    if (idx == null) return;
    const item = items[Number(idx)];
    if (item && onSliceClick) onSliceClick(item.stepId);
  }, [items, onSliceClick]);

  return (
    <div className="income-donut-clickable">
      <AccumulationChartComponent
        height={height}
          background="transparent"
          legendSettings={{ visible: false }}
          tooltip={{
            enable: true,
            fill: '#1E293B',
            border: { color: '#475569', width: 1 },
            textStyle: { color: '#E2E8F0', fontFamily: 'Inter Variable, sans-serif', size: '12px' },
          }}
          pointRender={pointRender}
          tooltipRender={tooltipRender}
          textRender={textRender}
          chartMouseClick={chartMouseClick}
          enableSmartLabels={true}
        >
          <Inject services={[PieSeries, AccumulationTooltip, AccumulationDataLabel]} />
          <AccumulationSeriesCollectionDirective>
            <AccumulationSeriesDirective
              dataSource={items}
              xName="label"
              yName="value"
              innerRadius="50%"
              radius="65%"
              dataLabel={{
                visible: true,
                position: 'Outside',
                connectorStyle: { length: '40px', color: '#475569', width: 1 },
                font: {
                  color: '#E2E8F0',
                  fontFamily: 'Inter Variable, sans-serif',
                  size: '11px',
                  fontWeight: '600',
                },
              }}
            />
          </AccumulationSeriesCollectionDirective>
        </AccumulationChartComponent>
    </div>
  );
}
