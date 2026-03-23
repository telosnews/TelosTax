/**
 * TaxInsights — auto-generated plain-English insights about the user's taxes.
 *
 * Analyzes the calculation result and produces a set of contextual,
 * non-obvious observations to help the user understand their situation.
 */

import type { Form1040Result, CalculationResult } from '@telostax/engine';
import { Lightbulb, TrendingDown, TrendingUp, Shield, AlertTriangle } from 'lucide-react';

interface TaxInsightsProps {
  form1040: Form1040Result;
  calculation: CalculationResult;
}

interface Insight {
  icon: 'savings' | 'info' | 'warning' | 'opportunity';
  text: string;
}

export default function TaxInsights({ form1040: f, calculation }: TaxInsightsProps) {
  const insights = generateInsights(f, calculation);

  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      {insights.map((insight, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-lg p-3 text-sm leading-relaxed ${getInsightStyle(insight.icon)}`}
        >
          <div className="shrink-0 mt-0.5">{getInsightIcon(insight.icon)}</div>
          <span>{insight.text}</span>
        </div>
      ))}
    </div>
  );
}

function generateInsights(f: Form1040Result, calc: CalculationResult): Insight[] {
  const insights: Insight[] = [];

  // Income source breakdown
  const incomeSources: { label: string; amount: number }[] = [
    { label: 'W-2 wages', amount: f.totalWages },
    { label: 'self-employment', amount: f.scheduleCNetProfit },
    { label: 'interest', amount: f.totalInterest },
    { label: 'dividends', amount: f.totalDividends },
    { label: 'capital gains', amount: f.scheduleDNetGain },
    { label: 'retirement distributions', amount: f.totalRetirementIncome },
    { label: 'Social Security', amount: f.taxableSocialSecurity },
    { label: 'rental income', amount: f.scheduleEIncome },
  ].filter((s) => s.amount > 0);

  if (incomeSources.length > 1) {
    const topSource = incomeSources.reduce((max, s) => s.amount > max.amount ? s : max);
    const pct = f.totalIncome > 0 ? (topSource.amount / f.totalIncome) * 100 : 0;
    if (pct > 50) {
      insights.push({
        icon: 'info',
        text: `Your biggest income source is ${topSource.label} at $${topSource.amount.toLocaleString()} (${pct.toFixed(0)}% of total income).`,
      });
    }
  }

  // Effective vs marginal rate gap
  const effectivePct = f.effectiveTaxRate * 100;
  const marginalPct = f.marginalTaxRate * 100;
  if (marginalPct - effectivePct > 5 && effectivePct > 0) {
    insights.push({
      icon: 'info',
      text: `Your effective rate (${effectivePct.toFixed(1)}%) is ${(marginalPct - effectivePct).toFixed(0)} percentage points below your ${marginalPct.toFixed(0)}% bracket. This is because only income above $${getBracketThreshold(marginalPct)} is taxed at the top rate.`,
    });
  }

  // Deduction savings
  if (f.deductionAmount > 0) {
    const taxSavings = Math.round(f.deductionAmount * f.marginalTaxRate);
    const deductionType = f.deductionUsed === 'standard' ? 'standard deduction' : 'itemized deductions';
    insights.push({
      icon: 'savings',
      text: `Your ${deductionType} of $${f.deductionAmount.toLocaleString()} saved you approximately $${taxSavings.toLocaleString()} in federal tax.`,
    });
  }

  // Credits (dollar-for-dollar)
  if (f.totalCredits > 0) {
    insights.push({
      icon: 'savings',
      text: `Tax credits reduced your bill by $${f.totalCredits.toLocaleString()} — credits are more valuable than deductions because they reduce tax dollar-for-dollar.`,
    });
  }

  // Self-employment tax
  if (f.seTax > 0) {
    const seEffectiveRate = f.scheduleCNetProfit > 0 ? (f.seTax / f.scheduleCNetProfit * 100) : 0;
    insights.push({
      icon: 'warning',
      text: `Self-employment tax adds $${f.seTax.toLocaleString()} (${seEffectiveRate.toFixed(1)}% of SE profit). This covers both the employer and employee shares of Social Security and Medicare.`,
    });
  }

  // QBI deduction
  if (f.qbiDeduction > 0) {
    insights.push({
      icon: 'savings',
      text: `The Qualified Business Income (QBI) deduction lets you deduct 20% of qualifying business income — saving you $${Math.round(f.qbiDeduction * f.marginalTaxRate).toLocaleString()} in tax.`,
    });
  }

  // Itemized vs standard
  if (f.deductionUsed === 'standard' && f.itemizedDeduction > 0) {
    const diff = f.standardDeduction - f.itemizedDeduction;
    if (diff > 0) {
      insights.push({
        icon: 'info',
        text: `You're using the standard deduction because it's $${diff.toLocaleString()} more than your itemized deductions would be.`,
      });
    }
  } else if (f.deductionUsed === 'itemized') {
    const diff = f.itemizedDeduction - f.standardDeduction;
    insights.push({
      icon: 'savings',
      text: `Itemizing saved you $${diff.toLocaleString()} more than the standard deduction would have.`,
    });
  }

  // Withholding accuracy
  if (f.totalWithholding > 0 && f.taxAfterCredits > 0) {
    const ratio = f.totalWithholding / f.taxAfterCredits;
    if (ratio > 1.15) {
      const overwithheld = Math.round(f.totalWithholding - f.taxAfterCredits);
      insights.push({
        icon: 'opportunity',
        text: `You overwithheld by $${overwithheld.toLocaleString()} this year. Consider adjusting your W-4 to keep more in each paycheck — you're essentially giving the IRS a 0% interest loan.`,
      });
    } else if (ratio < 0.85 && f.amountOwed > 1000) {
      insights.push({
        icon: 'warning',
        text: `You significantly underwithheld. Consider adjusting your W-4 or making estimated payments to avoid potential penalties next year.`,
      });
    }
  }

  // AMT warning
  if (f.amtAmount > 0) {
    insights.push({
      icon: 'warning',
      text: `The Alternative Minimum Tax (AMT) adds $${f.amtAmount.toLocaleString()} to your bill. AMT recalculates your tax using a broader income base with fewer deductions.`,
    });
  }

  // Capital loss carryforward
  if (calc.scheduleD && f.capitalLossDeduction > 0) {
    const totalLoss = Math.abs(calc.scheduleD.netGainOrLoss);
    if (totalLoss > 3000) {
      const carryforward = totalLoss - 3000;
      insights.push({
        icon: 'info',
        text: `You can only deduct $3,000 of capital losses per year. The remaining $${carryforward.toLocaleString()} carries forward to reduce future taxes.`,
      });
    }
  }

  return insights.slice(0, 6); // Cap at 6 insights to avoid overwhelming
}

function getBracketThreshold(rate: number): string {
  // Approximate thresholds for Single filer (most common)
  const thresholds: Record<number, string> = {
    12: '11,925', 22: '48,475', 24: '103,350', 32: '197,300', 35: '250,525', 37: '626,350',
  };
  return thresholds[rate] || '0';
}

function getInsightStyle(icon: Insight['icon']): string {
  switch (icon) {
    case 'savings': return 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-200';
    case 'info': return 'bg-telos-blue-600/10 border border-telos-blue-600/20 text-telos-blue-200';
    case 'warning': return 'bg-amber-500/10 border border-amber-500/20 text-amber-200';
    case 'opportunity': return 'bg-violet-500/10 border border-violet-500/20 text-violet-200';
  }
}

function getInsightIcon(icon: Insight['icon']) {
  switch (icon) {
    case 'savings': return <TrendingDown className="w-4 h-4 text-emerald-400" />;
    case 'info': return <Lightbulb className="w-4 h-4 text-telos-blue-400" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case 'opportunity': return <Shield className="w-4 h-4 text-violet-400" />;
  }
}
