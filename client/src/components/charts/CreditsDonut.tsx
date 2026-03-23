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

interface CreditsDonutProps {
  items: Array<{ label: string; value: number; stepId: string; refundable: boolean }>;
  onSliceClick?: (stepId: string) => void;
  height?: string;
}

// Nonrefundable use warm palette, refundable use cool/green palette
const NR_COLORS = ['#FB923C', '#F59E0B', '#FBBF24', '#D97706', '#F97316'];
const R_COLORS = ['#34D399', '#10B981', '#06B6D4', '#14B8A6', '#22D3EE'];

const fmtCompact = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toLocaleString()}`;
};

const fmtDollars = (v: number): string => `$${v.toLocaleString()}`;

export default function CreditsDonut({ items: rawItems, onSliceClick, height }: CreditsDonutProps) {
  if (rawItems.length === 0) return null;

  // Sort: nonrefundable first (warm colors), then refundable (cool colors)
  const items = [...rawItems].sort((a, b) => {
    if (a.refundable !== b.refundable) return a.refundable ? 1 : -1;
    return b.value - a.value;
  });
  const total = items.reduce((s, i) => s + i.value, 0);

  // Track color index per category
  let nrIdx = 0;
  let rIdx = 0;
  const colorMap = items.map(item => {
    if (item.refundable) return R_COLORS[rIdx++ % R_COLORS.length];
    return NR_COLORS[nrIdx++ % NR_COLORS.length];
  });

  const pointRender = useCallback((args: IAccPointRenderEventArgs): void => {
    args.fill = colorMap[args.point.index] || '#64748B';
  }, [colorMap]);

  const tooltipRender = useCallback((args: IAccTooltipRenderEventArgs): void => {
    const idx = args.point?.index;
    if (idx == null || !items[idx]) return;
    const item = items[idx];
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
    const type = item.refundable ? 'Refundable' : 'Nonrefundable';
    args.text = `${item.label} — ${type}\n${fmtDollars(item.value)} (${pct}%)`;
  }, [items, total]);

  const textRender = useCallback((args: IAccTextRenderEventArgs): void => {
    const idx = (args.point as any)?.index;
    if (idx == null || !items[idx]) { args.text = ''; return; }
    args.text = fmtCompact(items[idx].value);
  }, [items]);

  const chartMouseClick = useCallback((args: IMouseEventArgs): void => {
    if (!onSliceClick) return;
    const idx = (args.target ?? '').match(/_Series_0_Point_(\d+)/)?.[1];
    if (idx == null) return;
    const item = items[Number(idx)];
    if (item) onSliceClick(item.stepId);
  }, [items, onSliceClick]);

  // Dynamic height based on item count
  const chartHeight = height || `${Math.max(280, items.length * 40 + 120)}px`;

  return (
    <div>
      <AccumulationChartComponent
        height={chartHeight}
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
            innerRadius="45%"
            radius="70%"
            dataLabel={{
              visible: true,
              position: 'Outside',
              connectorStyle: { length: '30px', color: '#475569', width: 1 },
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

export { NR_COLORS, R_COLORS };
