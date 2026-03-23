import { useCallback } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, BarSeries, Category, Tooltip, DataLabel,
  type ITooltipRenderEventArgs, type ITextRenderEventArgs,
} from '@syncfusion/ej2-react-charts';

interface EstimatedPaymentsChartProps {
  quarters: [number, number, number, number];
  quarterlyDetail?: Array<{ requiredInstallment: number; paymentMade: number }>;
}

const QUARTER_LABELS = ['Q1 (Apr 15)', 'Q2 (Jun 16)', 'Q3 (Sep 15)', 'Q4 (Jan 15)'];

const fmtDollars = (v: number): string => `$${v.toLocaleString()}`;

export default function EstimatedPaymentsChart({ quarters, quarterlyDetail }: EstimatedPaymentsChartProps) {
  const allZero = quarters.every(q => q === 0) && !quarterlyDetail;
  if (allZero) return null;

  const paidData = QUARTER_LABELS.map((label, i) => ({ x: label, y: quarters[i] || 0 }));
  const requiredData = quarterlyDetail
    ? QUARTER_LABELS.map((label, i) => ({ x: label, y: quarterlyDetail[i]?.requiredInstallment || 0 }))
    : null;

  const textRender = useCallback((args: ITextRenderEventArgs): void => {
    const val = (args.point as any)?.y;
    args.text = val > 0 ? fmtDollars(val) : '';
  }, []);

  const tooltipRender = useCallback((args: ITooltipRenderEventArgs): void => {
    const idx = (args.point as any)?.index;
    if (idx == null) { args.text = ''; return; }
    const paid = quarters[idx] || 0;
    const required = quarterlyDetail?.[idx]?.requiredInstallment;
    let text = `<b>${QUARTER_LABELS[idx]}</b><br/>Paid: ${fmtDollars(paid)}`;
    if (required != null) text += `<br/>Required: ${fmtDollars(required)}`;
    args.text = text;
  }, [quarters, quarterlyDetail]);

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mb-3">
      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Quarterly Payments
      </h4>
      <ChartComponent
        height="220px"
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
          {requiredData && (
            <SeriesDirective
              dataSource={requiredData}
              xName="x"
              yName="y"
              name="Required"
              type="Bar"
              fill="rgba(239, 68, 68, 0.3)"
              border={{ color: '#EF4444', width: 1 }}
              columnWidth={0.35}
              columnSpacing={0.05}
              cornerRadius={{ topLeft: 3, topRight: 3, bottomLeft: 3, bottomRight: 3 }}
            />
          )}
          <SeriesDirective
            dataSource={paidData}
            xName="x"
            yName="y"
            name="Paid"
            type="Bar"
            fill="#3B82F6"
            columnWidth={0.35}
            columnSpacing={0.05}
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
