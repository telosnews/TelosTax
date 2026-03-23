/**
 * EffectiveTaxRateCard — compares effective vs marginal tax rate.
 *
 * Shows a visual gauge and plain-English explanation of the difference
 * between the marginal bracket rate and the actual effective rate.
 */

import type { Form1040Result } from '@telostax/engine';

interface EffectiveTaxRateCardProps {
  form1040: Form1040Result;
}

export default function EffectiveTaxRateCard({ form1040: f }: EffectiveTaxRateCardProps) {
  const effectivePct = f.effectiveTaxRate * 100;
  const marginalPct = f.marginalTaxRate * 100;
  const keepRate = 100 - effectivePct;

  // Total federal tax burden (income tax + SE + NIIT + AMT + Additional Medicare)
  const totalFederalTax = f.taxAfterCredits;

  return (
    <div className="space-y-4">
      {/* Rate comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Effective rate */}
        <div className="bg-surface-900 rounded-lg p-4 text-center border border-slate-700">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Effective Rate</p>
          <p className="text-3xl font-bold text-telos-blue-400">{effectivePct.toFixed(1)}%</p>
          <p className="text-[10px] text-slate-400 mt-1">What you actually pay</p>
        </div>

        {/* Marginal rate */}
        <div className="bg-surface-900 rounded-lg p-4 text-center border border-slate-700">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Marginal Rate</p>
          <p className="text-3xl font-bold text-slate-300">{marginalPct.toFixed(0)}%</p>
          <p className="text-[10px] text-slate-400 mt-1">Your top bracket</p>
        </div>
      </div>

      {/* Visual gauge */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>0%</span>
          <span>Effective: {effectivePct.toFixed(1)}%</span>
          <span>Marginal: {marginalPct.toFixed(0)}%</span>
        </div>
        <div className="h-3 bg-surface-900 rounded-full overflow-hidden border border-slate-700 relative">
          {/* Marginal rate marker */}
          <div
            className="absolute top-0 h-full border-r-2 border-slate-400 border-dashed"
            style={{ left: `${Math.min(marginalPct / 40 * 100, 100)}%` }}
          />
          {/* Effective rate fill */}
          <div
            className="h-full rounded-full bg-gradient-to-r from-telos-blue-500 to-telos-blue-400 transition-all duration-700"
            style={{ width: `${Math.min(effectivePct / 40 * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Plain English */}
      <div className="bg-telos-blue-600/10 border border-telos-blue-600/20 rounded-lg p-3">
        <p className="text-sm text-telos-blue-200 leading-relaxed">
          You're in the <strong>{marginalPct.toFixed(0)}% tax bracket</strong>, but your effective
          federal tax rate is only <strong>{effectivePct.toFixed(1)}%</strong>.
          {effectivePct > 0 && (
            <> That means you keep about <strong>{keepRate.toFixed(0)} cents</strong> of every dollar earned.</>
          )}
        </p>
        {f.totalIncome > 0 && totalFederalTax > 0 && (
          <p className="text-xs text-slate-400 mt-2">
            On ${f.totalIncome.toLocaleString()} of total income, your federal tax is ${totalFederalTax.toLocaleString()}.
          </p>
        )}
      </div>
    </div>
  );
}
