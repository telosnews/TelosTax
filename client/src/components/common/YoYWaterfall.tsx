/**
 * YoYWaterfall — "Why did my refund change?" bridge chart.
 *
 * Syncfusion WaterfallSeries showing an additive decomposition from the
 * prior-year result to the current-year result:
 *
 *   Prior Result → Tax Changed → Credits Changed → Payments Changed → Current Result
 *
 * Steps are exactly additive: priorNet + taxΔ + creditsΔ + paymentsΔ = currentNet.
 * The payments step is computed as a residual to guarantee balance.
 */

import { useCallback } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Inject, WaterfallSeries, Category, Tooltip, DataLabel,
  type IPointRenderEventArgs, type ITextRenderEventArgs,
  type ITooltipRenderEventArgs,
} from '@syncfusion/ej2-react-charts';
import type { PriorYearSummary, Form1040Result } from '@telostax/engine';

interface YoYWaterfallProps {
  priorYear: PriorYearSummary;
  current: Form1040Result;
}

interface WaterfallStep {
  x: string;
  y: number;
  sum?: boolean;
  colorKey: 'prior' | 'current' | 'positive' | 'negative';
  description: string;
}

function fmtDollars(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString()}`;
}

export default function YoYWaterfall({ priorYear, current }: YoYWaterfallProps) {
  // Signed net result: positive = refund, negative = owed
  const priorNet = priorYear.refundAmount > 0 ? priorYear.refundAmount : -priorYear.amountOwed;
  const currentNet = current.refundAmount > 0 ? current.refundAmount : -current.amountOwed;
  const netDelta = currentNet - priorNet;

  // Skip chart if nothing changed
  if (Math.abs(netDelta) < 1) return null;

  // Additive decomposition: taxΔ + creditsΔ + paymentsΔ = netDelta
  const taxStep = -(current.totalTax - priorYear.totalTax);       // more tax = negative
  const creditsStep = current.totalCredits - priorYear.totalCredits; // more credits = positive
  const paymentsStep = netDelta - taxStep - creditsStep;           // residual ensures balance

  // Build waterfall steps, skipping near-zero intermediate steps
  const steps: WaterfallStep[] = [];

  // Starting point
  const priorLabel = priorNet >= 0 ? `${priorYear.taxYear} Refund` : `${priorYear.taxYear} Owed`;
  steps.push({
    x: priorLabel,
    y: priorNet,
    colorKey: priorNet >= 0 ? 'positive' : 'negative',
    description: priorNet >= 0
      ? `You received a ${fmtDollars(priorNet)} refund in ${priorYear.taxYear}`
      : `You owed ${fmtDollars(priorNet)} in ${priorYear.taxYear}`,
  });

  // Intermediate steps (skip near-zero)
  if (Math.abs(taxStep) >= 1) {
    steps.push({
      x: 'Tax Liability',
      y: taxStep,
      colorKey: taxStep >= 0 ? 'positive' : 'negative',
      description: taxStep >= 0
        ? `Your total tax decreased by ${fmtDollars(taxStep)}`
        : `Your total tax increased by ${fmtDollars(taxStep)}`,
    });
  }

  if (Math.abs(creditsStep) >= 1) {
    steps.push({
      x: 'Tax Credits',
      y: creditsStep,
      colorKey: creditsStep >= 0 ? 'positive' : 'negative',
      description: creditsStep >= 0
        ? `You claimed ${fmtDollars(creditsStep)} more in credits`
        : `You claimed ${fmtDollars(creditsStep)} less in credits`,
    });
  }

  if (Math.abs(paymentsStep) >= 1) {
    steps.push({
      x: 'Payments & Withholding',
      y: paymentsStep,
      colorKey: paymentsStep >= 0 ? 'positive' : 'negative',
      description: paymentsStep >= 0
        ? `Your payments increased by ${fmtDollars(paymentsStep)}`
        : `Your payments decreased by ${fmtDollars(paymentsStep)}`,
    });
  }

  // If no intermediate steps survived, skip chart entirely
  if (steps.length <= 1) return null;

  // Ending point
  const currentLabel = currentNet >= 0 ? '2025 Refund' : '2025 Owed';
  steps.push({
    x: currentLabel,
    y: 0,
    sum: true,
    colorKey: currentNet >= 0 ? 'positive' : 'negative',
    description: currentNet >= 0
      ? `Your 2025 refund is ${fmtDollars(currentNet)}`
      : `You owe ${fmtDollars(currentNet)} for 2025`,
  });

  const sumIndexes = steps.reduce<number[]>((acc, s, i) => s.sum ? [...acc, i] : acc, []);

  const COLORS = {
    prior: '#94A3B8',
    current: '#94A3B8',
    positive: '#10B981',
    negative: '#F59E0B',
  };

  const pointRender = useCallback((args: IPointRenderEventArgs): void => {
    const step = steps[args.point.index];
    if (!step) return;
    // Sum bars: contextual color (green for refund, amber for owed)
    if (step.sum || args.point.index === 0) {
      args.fill = step.colorKey === 'positive' ? '#10B981' : '#F59E0B';
    } else {
      args.fill = COLORS[step.colorKey] || '#64748B';
    }
  }, [steps]);

  const textRender = useCallback((args: ITextRenderEventArgs): void => {
    const step = steps[(args.point as any)?.index];
    if (!step) { args.text = ''; return; }
    const val = parseFloat(args.text?.replace(/[$,]/g, '') || '0');
    if (step.sum || (args.point as any)?.index === 0) {
      args.text = fmtDollars(val);
    } else {
      args.text = `${val >= 0 ? '+' : '−'}${fmtDollars(val)}`;
    }
  }, [steps]);

  const tooltipRender = useCallback((args: ITooltipRenderEventArgs): void => {
    const idx = (args.point as any)?.index;
    if (idx == null || !steps[idx]) { args.text = ''; return; }
    const step = steps[idx];
    args.text = `<b>${step.x}</b><br/>${step.description}`;
  }, [steps]);

  const chartHeight = `${Math.max(160, steps.length * 48 + 20)}px`;

  return (
    <div className="rounded-lg bg-slate-800/30 p-3 mb-3">
      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Why did your result change?
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
          labelStyle: {
            color: '#CBD5E1',
            fontFamily: 'Inter Variable, sans-serif',
            size: '12px',
            fontWeight: '500',
          },
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
        <Inject services={[WaterfallSeries, Category, Tooltip, DataLabel]} />
        <SeriesCollectionDirective>
          <SeriesDirective
            dataSource={steps}
            xName="x"
            yName="y"
            type="Waterfall"
            sumIndexes={sumIndexes}
            columnWidth={0.55}
            cornerRadius={{ topLeft: 3, topRight: 3, bottomLeft: 3, bottomRight: 3 }}
            connector={{ color: '#475569', width: 1, dashArray: '4,3' }}
            marker={{
              dataLabel: {
                visible: true,
                position: 'Outer',
                font: {
                  color: '#E2E8F0',
                  fontFamily: 'Inter Variable, sans-serif',
                  size: '12px',
                  fontWeight: '600',
                },
              },
            }}
          />
        </SeriesCollectionDirective>
      </ChartComponent>
    </div>
  );
}
