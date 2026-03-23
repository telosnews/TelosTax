import { useCallback, useMemo } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, StackingBarSeries, Category, Tooltip, DataLabel,
  type ITooltipRenderEventArgs, type ITextRenderEventArgs,
} from '@syncfusion/ej2-react-charts';

interface CreditsStackedBarProps {
  nonRefundable: number;
  refundable: number;
}

const fmtDollars = (v: number): string => `$${v.toLocaleString()}`;

export default function CreditsStackedBar({ nonRefundable, refundable }: CreditsStackedBarProps) {
  const total = nonRefundable + refundable;
  if (total <= 0) return null;

  const data = useMemo(() => [
    { x: 'Credits', nonRefundable, refundable },
  ], [nonRefundable, refundable]);

  const textRender = useCallback((args: ITextRenderEventArgs): void => {
    const val = Number(args.text);
    if (!val || val === 0) { args.text = ''; return; }
    args.text = fmtDollars(val);
  }, []);

  const tooltipRender = useCallback((args: ITooltipRenderEventArgs): void => {
    const seriesName = (args.series as any)?.name;
    const val = (args.point as any)?.y;
    if (val == null) { args.text = ''; return; }
    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
    args.text = `<b>${seriesName}</b><br/>${fmtDollars(val)} (${pct}% of total)`;
  }, [total]);

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mt-4 mb-3">
      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Credit Breakdown
      </h4>
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-telos-orange-400" />
          <span className="text-[10px] text-slate-400">Nonrefundable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
          <span className="text-[10px] text-slate-400">Refundable</span>
        </div>
      </div>
      <ChartComponent
        height="80px"
        background="transparent"
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
          visible: false,
          majorGridLines: { width: 0 },
          majorTickLines: { width: 0 },
        }}
        primaryYAxis={{
          visible: false,
          majorGridLines: { width: 0 },
        }}
        legendSettings={{ visible: false }}
      >
        <Inject services={[StackingBarSeries, Category, Tooltip, DataLabel]} />
        <SeriesCollectionDirective>
          <SeriesDirective
            dataSource={data}
            xName="x"
            yName="nonRefundable"
            name="Nonrefundable"
            type="StackingBar"
            fill="#FB923C"
            columnWidth={0.7}
            cornerRadius={{ topLeft: 4, bottomLeft: 4 }}
            marker={{
              dataLabel: {
                visible: nonRefundable > 0,
                position: 'Middle',
                font: { color: '#1E293B', fontFamily: 'Inter Variable, sans-serif', size: '12px', fontWeight: '700' },
              },
            }}
          />
          <SeriesDirective
            dataSource={data}
            xName="x"
            yName="refundable"
            name="Refundable"
            type="StackingBar"
            fill="#34D399"
            columnWidth={0.7}
            cornerRadius={{ topRight: 4, bottomRight: 4 }}
            marker={{
              dataLabel: {
                visible: refundable > 0,
                position: 'Middle',
                font: { color: '#1E293B', fontFamily: 'Inter Variable, sans-serif', size: '12px', fontWeight: '700' },
              },
            }}
          />
        </SeriesCollectionDirective>
      </ChartComponent>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>Total: {fmtDollars(total)}</span>
        {refundable > 0 && nonRefundable > 0 && (
          <span>{Math.round((refundable / total) * 100)}% refundable</span>
        )}
      </div>
    </div>
  );
}
