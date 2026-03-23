import { useCallback, useMemo } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, BarSeries, Category, Tooltip, DataLabel,
  type IPointRenderEventArgs, type ITooltipRenderEventArgs, type ITextRenderEventArgs,
} from '@syncfusion/ej2-react-charts';

interface DeadlineTimelineProps {
  deadlines: Array<{
    label: string;
    date: string;
    status: 'overdue' | 'due_soon' | 'upcoming' | 'completed';
    amount?: number;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  overdue: '#EF4444',
  due_soon: '#F59E0B',
  upcoming: '#3B82F6',
  completed: '#10B981',
};

const fmtDate = (iso: string): string => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const fmtDollars = (v: number): string => `$${v.toLocaleString()}`;

export default function DeadlineTimeline({ deadlines }: DeadlineTimelineProps) {
  if (deadlines.length === 0) return null;

  const sorted = useMemo(() =>
    [...deadlines].sort((a, b) => a.date.localeCompare(b.date)),
    [deadlines],
  );

  // Use amount as bar value if available, otherwise uniform height
  const data = useMemo(() =>
    sorted.map(d => ({
      x: d.label,
      y: d.amount && d.amount > 0 ? d.amount : 1,
      status: d.status,
      date: d.date,
      amount: d.amount,
    })),
    [sorted],
  );

  const pointRender = useCallback((args: IPointRenderEventArgs): void => {
    const item = data[args.point.index];
    if (item) args.fill = STATUS_COLORS[item.status] || '#64748B';
  }, [data]);

  const textRender = useCallback((args: ITextRenderEventArgs): void => {
    const item = data[(args.point as any)?.index];
    args.text = item ? fmtDate(item.date) : '';
  }, [data]);

  const tooltipRender = useCallback((args: ITooltipRenderEventArgs): void => {
    const idx = (args.point as any)?.index;
    if (idx == null || !data[idx]) { args.text = ''; return; }
    const item = data[idx];
    let text = `<b>${item.x}</b><br/>Due: ${fmtDate(item.date)}`;
    if (item.amount && item.amount > 0) text += `<br/>Amount: ${fmtDollars(item.amount)}`;
    args.text = text;
  }, [data]);

  const chartHeight = `${Math.max(120, data.length * 36 + 20)}px`;

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mb-3">
      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Deadline Timeline
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
    </div>
  );
}
