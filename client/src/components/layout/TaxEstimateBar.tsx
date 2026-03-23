import { useTaxReturnStore } from '../../store/taxReturnStore';
import { DollarSign, TrendingDown, Calculator, PiggyBank, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface TaxEstimateBarProps {
  onExplainToggle?: () => void;
  explainOpen?: boolean;
}

export default function TaxEstimateBar({ onExplainToggle, explainOpen }: TaxEstimateBarProps) {
  const calculation = useTaxReturnStore((s) => s.calculation);

  if (!calculation) return null;

  const f = calculation.form1040;
  const isRefund = f.refundAmount > 0;

  return (
    <div className="bg-surface-800 border-b border-slate-700 px-4 py-2">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-6">
          {/* Primary: Owed or Refund */}
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">
              {isRefund ? 'Estimated Refund:' : 'Estimated Tax Owed:'}
            </span>
            <span className={`font-semibold text-base ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
              ${(isRefund ? f.refundAmount : f.amountOwed).toLocaleString()}
            </span>
          </div>

          {/* SE Tax */}
          {f.seTax > 0 && (
            <div className="hidden md:flex items-center gap-2">
              <Calculator className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">SE Tax:</span>
              <span className="text-slate-300">${f.seTax.toLocaleString()}</span>
            </div>
          )}

          {/* Effective Rate */}
          <div className="hidden lg:flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Effective Rate:</span>
            <span className="text-slate-300">{(f.effectiveTaxRate * 100).toFixed(1)}%</span>
          </div>

          {/* QBI Savings */}
          {f.qbiDeduction > 0 && (
            <div className="hidden xl:flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-telos-orange-500" />
              <span className="text-telos-orange-400">QBI Savings: -${f.qbiDeduction.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Quarterly */}
          {f.estimatedQuarterlyPayment > 0 && (
            <div className="hidden md:flex items-center gap-2 text-slate-400">
              <span>Quarterly Est:</span>
              <span className="text-slate-300">${f.estimatedQuarterlyPayment.toLocaleString()}</span>
            </div>
          )}

          {/* Explain toggle */}
          {onExplainToggle && (
            <button
              onClick={onExplainToggle}
              className="flex items-center gap-1.5 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Explain my taxes</span>
              {explainOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
