import { useCallback, useMemo } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, WaterfallSeries, Category, Tooltip, DataLabel,
  type IPointRenderEventArgs, type ITooltipRenderEventArgs, type ITextRenderEventArgs,
  type IMouseEventArgs,
} from '@syncfusion/ej2-react-charts';

interface WaterfallStep {
  x: string;
  y: number;
  intermediateSum?: boolean;
  sum?: boolean;
  stepId?: string;
  colorKey: string;
}

interface DeductionsFlowWaterfallProps {
  totalIncome: number;
  totalAdjustments: number;
  agi: number;
  deductionAmount: number;
  deductionLabel: string;
  qbiDeduction: number;
  taxableIncome: number;
  onBarClick?: (stepId: string) => void;
}

const COLORS: Record<string, string> = {
  income: '#3B82F6',
  adjustment: '#F59E0B',
  agi: '#94A3B8',
  deduction: '#14B8A6',
  qbi: '#06B6D4',
  taxableIncome: '#94A3B8',
};

const fmtDollars = (v: number): string => `$${Math.abs(v).toLocaleString()}`;

export default function DeductionsFlowWaterfall({
  totalIncome, totalAdjustments, agi, deductionAmount, deductionLabel,
  qbiDeduction, taxableIncome, onBarClick,
}: DeductionsFlowWaterfallProps) {
  if (totalIncome <= 0) return null;

  const { steps, intermediateSumIndexes, sumIndexes } = useMemo(() => {
    const raw: WaterfallStep[] = [];

    raw.push({ x: 'Total Income', y: totalIncome, colorKey: 'income', stepId: 'income_overview' });

    if (totalAdjustments > 0) {
      raw.push({ x: 'Adjustments', y: -totalAdjustments, colorKey: 'adjustment', stepId: 'deductions_summary' });
      raw.push({ x: 'AGI', y: 0, intermediateSum: true, colorKey: 'agi', stepId: 'deductions_summary' });
    }

    raw.push({ x: deductionLabel, y: -deductionAmount, colorKey: 'deduction', stepId: 'deduction_method' });

    if (qbiDeduction > 0) {
      raw.push({ x: 'QBI Deduction', y: -qbiDeduction, colorKey: 'qbi', stepId: 'qbi_detail' });
    }

    raw.push({ x: 'Taxable Income', y: 0, sum: true, colorKey: 'taxableIncome', stepId: 'deductions_summary' });

    const intermediateSumIndexes = raw.reduce<number[]>((acc, s, i) => s.intermediateSum ? [...acc, i] : acc, []);
    const sumIndexes = raw.reduce<number[]>((acc, s, i) => s.sum ? [...acc, i] : acc, []);
    return { steps: raw, intermediateSumIndexes, sumIndexes };
  }, [totalIncome, totalAdjustments, agi, deductionAmount, deductionLabel, qbiDeduction, taxableIncome]);

  const pointRender = useCallback((args: IPointRenderEventArgs): void => {
    const step = steps[args.point.index];
    if (step) args.fill = COLORS[step.colorKey] || '#64748B';
  }, [steps]);

  const textRender = useCallback((args: ITextRenderEventArgs): void => {
    const step = steps[(args.point as any)?.index];
    if (!step) { args.text = ''; return; }
    const val = parseFloat(args.text?.replace(/[$,]/g, '') || '0');
    args.text = fmtDollars(val);
  }, [steps]);

  const tooltipRender = useCallback((args: ITooltipRenderEventArgs): void => {
    const idx = (args.point as any)?.index;
    if (idx == null || !steps[idx]) { args.text = ''; return; }
    const step = steps[idx];
    const pointY = (args.point as any)?.y;
    const isSumBar = step.intermediateSum || step.sum;
    const absVal = Math.round(Math.abs(isSumBar ? (pointY || 0) : step.y));
    const prefix = step.y < 0 && !isSumBar ? '−' : '';
    args.text = `<b>${step.x}</b><br/>${prefix}$${absVal.toLocaleString()}`;
  }, [steps]);

  const chartMouseClick = useCallback((args: IMouseEventArgs): void => {
    if (!onBarClick) return;
    const idx = (args.target ?? '').match(/_Series_0_Point_(\d+)/)?.[1];
    if (idx == null) return;
    const step = steps[Number(idx)];
    if (step?.stepId) onBarClick(step.stepId);
  }, [steps, onBarClick]);

  const chartHeight = `${Math.max(200, steps.length * 48 + 20)}px`;

  return (
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
      style={{ cursor: onBarClick ? 'pointer' : 'default' }}
    >
      <Inject services={[WaterfallSeries, Category, Tooltip, DataLabel]} />
      <SeriesCollectionDirective>
        <SeriesDirective
          dataSource={steps}
          xName="x"
          yName="y"
          type="Waterfall"
          intermediateSumIndexes={intermediateSumIndexes}
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
  );
}
