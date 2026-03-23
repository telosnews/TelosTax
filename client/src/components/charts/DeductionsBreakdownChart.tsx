import { useCallback } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, BarSeries, Category, Tooltip, DataLabel,
  type IPointRenderEventArgs, type ITooltipRenderEventArgs, type ITextRenderEventArgs,
  type IMouseEventArgs,
} from '@syncfusion/ej2-react-charts';

interface BarItem {
  label: string;
  amount: number;
  stepId: string;
}

interface DeductionsBreakdownProps {
  adjustments: BarItem[];
  deductions: BarItem[];
  isItemized: boolean;
  deductionAmount: number;
  deductionLabel?: string;
  onBarClick?: (stepId: string) => void;
}

const fmtDollars = (v: number): string => `$${v.toLocaleString()}`;

const COLORS: Record<string, string> = {
  deduction: '#14B8A6',
  adjustment: '#F59E0B',
};

export default function DeductionsBreakdownChart({ adjustments, deductions, isItemized, deductionAmount, deductionLabel, onBarClick }: DeductionsBreakdownProps) {
  if (deductionAmount === 0 && adjustments.length === 0) return null;

  const dedLabel = deductionLabel || 'Deductions';

  // When itemized, show individual deduction line items; otherwise show a single standard deduction bar
  const deductionBars = isItemized && deductions.length > 0
    ? deductions.map(d => ({ x: d.label, y: d.amount, type: 'deduction', stepId: d.stepId }))
    : (deductionAmount > 0 ? [{ x: dedLabel, y: deductionAmount, type: 'deduction', stepId: 'deduction_method' }] : []);

  const data = [
    ...deductionBars,
    ...adjustments.map(a => ({ x: a.label, y: a.amount, type: 'adjustment', stepId: a.stepId })),
  ];

  const pointRender = useCallback((args: IPointRenderEventArgs): void => {
    const item = data[args.point.index];
    if (item) args.fill = COLORS[item.type] || '#64748B';
  }, [data]);

  const textRender = useCallback((args: ITextRenderEventArgs): void => {
    const item = data[(args.point as any)?.index];
    args.text = item ? fmtDollars(item.y) : '';
  }, [data]);

  const tooltipRender = useCallback((args: ITooltipRenderEventArgs): void => {
    const idx = (args.point as any)?.index;
    if (idx == null || !data[idx]) { args.text = ''; return; }
    const item = data[idx];
    args.text = `<b>${item.x}</b><br/>${fmtDollars(item.y)}`;
  }, [data]);

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
      isTransposed={false}
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
