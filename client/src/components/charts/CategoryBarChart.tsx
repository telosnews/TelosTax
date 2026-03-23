import { useCallback } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, BarSeries, Category, Tooltip, DataLabel,
  type IPointRenderEventArgs, type ITooltipRenderEventArgs, type ITextRenderEventArgs,
  type IMouseEventArgs,
} from '@syncfusion/ej2-react-charts';

interface CategoryBarChartProps {
  items: Array<{ label: string; value: number; stepId: string }>;
  onBarClick?: (stepId: string) => void;
  colors?: string[];
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#14B8A6',
  '#EF4444', '#F97316', '#EC4899', '#06B6D4', '#84CC16',
];

const fmtDollars = (v: number): string => `$${v.toLocaleString()}`;

export default function CategoryBarChart({ items: rawItems, onBarClick, colors }: CategoryBarChartProps) {
  if (rawItems.length === 0) return null;

  const items = [...rawItems].sort((a, b) => b.value - a.value);
  const data = items.map((item) => ({ x: item.label, y: item.value, stepId: item.stepId }));
  const total = items.reduce((s, i) => s + i.value, 0);

  const pointRender = useCallback((args: IPointRenderEventArgs): void => {
    args.fill = colors?.[args.point.index] || COLORS[args.point.index % COLORS.length];
  }, [colors]);

  const textRender = useCallback((args: ITextRenderEventArgs): void => {
    const item = data[(args.point as any)?.index];
    args.text = item ? fmtDollars(item.y) : '';
  }, [data]);

  const tooltipRender = useCallback((args: ITooltipRenderEventArgs): void => {
    const idx = (args.point as any)?.index;
    if (idx == null || !data[idx]) { args.text = ''; return; }
    const item = data[idx];
    const pct = total > 0 ? ((item.y / total) * 100).toFixed(1) : '0';
    args.text = `<b>${item.x}</b><br/>${fmtDollars(item.y)} (${pct}%)`;
  }, [data, total]);

  const chartMouseClick = useCallback((args: IMouseEventArgs): void => {
    if (!onBarClick) return;
    const idx = (args.target ?? '').match(/_Series_0_Point_(\d+)/)?.[1];
    if (idx == null) return;
    const item = data[Number(idx)];
    if (item?.stepId) onBarClick(item.stepId);
  }, [data, onBarClick]);

  const chartHeight = `${Math.max(120, data.length * 40 + 20)}px`;

  return (
    <ChartComponent
      height={chartHeight}
      background="transparent"
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
      style={{ cursor: onBarClick ? 'pointer' : 'default' }}
    >
      <Inject services={[BarSeries, Category, Tooltip, DataLabel]} />
      <SeriesCollectionDirective>
        <SeriesDirective
          dataSource={data}
          xName="x"
          yName="y"
          type="Bar"
          columnWidth={0.5}
          cornerRadius={{ topLeft: 3, topRight: 3, bottomLeft: 3, bottomRight: 3 }}
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
  );
}
