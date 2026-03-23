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
}

interface SEWaterfallProps {
  grossReceipts: number;
  returnsAndAllowances: number;
  otherBusinessIncome: number;
  cogs: number;
  expenses: number;
  homeOffice: number;
  vehicle: number;
  depreciation: number;
  netProfit: number;
  seHealthInsurance: number;
  seRetirement: number;
  seTaxDeductibleHalf: number;
  onBarClick?: (stepId: string) => void;
}

const fmtDollars = (v: number): string => `$${Math.abs(v).toLocaleString()}`;

export default function SEWaterfall({
  grossReceipts, returnsAndAllowances, otherBusinessIncome,
  cogs, expenses, homeOffice, vehicle, depreciation,
  netProfit, seHealthInsurance, seRetirement, seTaxDeductibleHalf,
  onBarClick,
}: SEWaterfallProps) {
  if (grossReceipts === 0) return null;

  const { steps, intermediateSumIndexes, sumIndexes } = useMemo(() => {
    const raw: WaterfallStep[] = [
      { x: 'Gross Receipts', y: grossReceipts, stepId: 'income_summary' },
    ];
    const sub = (label: string, val: number, stepId: string) => {
      if (Math.abs(val) >= 1) { raw.push({ x: label, y: -val, stepId }); }
    };
    const add = (label: string, val: number, stepId: string) => {
      if (Math.abs(val) >= 1) { raw.push({ x: label, y: val, stepId }); }
    };
    sub('Returns & Allowances', returnsAndAllowances, 'business_info');
    sub('COGS', cogs, 'cost_of_goods_sold');
    add('Other Business Income', otherBusinessIncome, 'business_info');
    sub('Expenses', expenses, 'expense_categories');
    sub('Home Office', homeOffice, 'home_office');
    sub('Vehicle', vehicle, 'vehicle_expenses');
    sub('Depreciation', depreciation, 'depreciation_assets');

    // Net profit — intermediate checkpoint (sum of Schedule C section)
    raw.push({ x: 'Net Profit', y: 0, intermediateSum: true, stepId: 'se_summary' });

    // SE deductions (below net profit — these reduce AGI, not Schedule C)
    sub('SE Health Insurance', seHealthInsurance, 'se_health_insurance');
    sub('SE Retirement', seRetirement, 'se_retirement');
    sub('SE Tax Deduction', seTaxDeductibleHalf, 'se_retirement');

    const hasSEDeductions = seHealthInsurance > 0 || seRetirement > 0 || seTaxDeductibleHalf > 0;
    if (hasSEDeductions) {
      raw.push({ x: 'Taxable SE Income', y: 0, sum: true, stepId: 'se_summary' });
    }

    const intermediateSumIndexes = raw.reduce<number[]>((acc, s, i) => s.intermediateSum ? [...acc, i] : acc, []);
    const sumIndexes = raw.reduce<number[]>((acc, s, i) => s.sum ? [...acc, i] : acc, []);
    return { steps: raw, intermediateSumIndexes, sumIndexes };
  }, [grossReceipts, returnsAndAllowances, otherBusinessIncome, cogs, expenses, homeOffice, vehicle, depreciation, netProfit, seHealthInsurance, seRetirement, seTaxDeductibleHalf]);

  const pointRender = useCallback((args: IPointRenderEventArgs): void => {
    const step = steps[args.point.index];
    if (!step) return;
    const isSumBar = step.intermediateSum || step.sum;
    if (isSumBar) {
      // Sum bars use the Syncfusion-computed running total (available as point.y)
      const pointY = (args.point as any)?.y ?? 0;
      args.fill = pointY >= 0 ? '#10B981' : '#EF4444';
    } else if (args.point.index === 0) {
      args.fill = '#3B82F6';
    } else {
      args.fill = '#F59E0B';
    }
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
    const isSumBar = step.intermediateSum || step.sum;
    const pointY = (args.point as any)?.y;
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

  const chartHeight = `${Math.max(160, steps.length * 48 + 20)}px`;

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
