import { useCallback } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, BarSeries, Category, Tooltip, DataLabel,
  type ITooltipRenderEventArgs, type ITextRenderEventArgs,
} from '@syncfusion/ej2-react-charts';

interface CreditsBarChartProps {
  credits: Array<{ label: string; value: number }>;
}

const fmtDollars = (v: number): string => `$${v.toLocaleString()}`;

export default function CreditsBarChart({ credits }: CreditsBarChartProps) {
  if (credits.length === 0) return null;

  const textRender = useCallback((args: ITextRenderEventArgs): void => {
    const item = credits[(args.point as any)?.index];
    args.text = item ? fmtDollars(item.value) : '';
  }, [credits]);

  const tooltipRender = useCallback((args: ITooltipRenderEventArgs): void => {
    const idx = (args.point as any)?.index;
    if (idx == null || !credits[idx]) { args.text = ''; return; }
    const item = credits[idx];
    args.text = `<b>${item.label}</b><br/>${fmtDollars(item.value)}`;
  }, [credits]);

  const chartHeight = `${Math.max(120, credits.length * 40 + 20)}px`;

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mb-3">
      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Credits Applied
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
            dataSource={credits}
            xName="label"
            yName="value"
            type="Bar"
            fill="#8B5CF6"
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
