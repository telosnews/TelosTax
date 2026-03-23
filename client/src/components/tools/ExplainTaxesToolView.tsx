/**
 * Explain My Taxes — standalone tool view.
 *
 * Reuses the same visualization components as ExplainTaxesStep but
 * without StepNavigation, so it can be accessed from the sidebar
 * at any point without changing the user's wizard position.
 */

import { useState, useMemo, useCallback } from 'react';
import { calculateForm1040, FilingStatus } from '@telostax/engine';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { resolveFormFromLineId } from '../../services/traceFormLinker';
import SectionIntro from '../common/SectionIntro';
import TaxFlowSwitcher from '../explain/TaxFlowSwitcher';
import BracketChart from '../explain/BracketChart';
import EffectiveTaxRateCard from '../explain/EffectiveTaxRateCard';
import TaxInsights from '../explain/TaxInsights';
import TraceTree from '../explain/TraceTree';
import ToolViewWrapper from './ToolViewWrapper';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';

export default function ExplainTaxesToolView() {
  const { taxReturn } = useTaxReturnStore();
  const [showTraces, setShowTraces] = useState(false);

  const handleNavigateToForm = useCallback((lineId: string) => {
    const formId = resolveFormFromLineId(lineId);
    if (formId) {
      useTaxReturnStore.getState().navigateToFormLine(formId, lineId);
    }
  }, []);

  const result = useMemo(() => {
    if (!taxReturn) return null;
    return calculateForm1040(
      { ...taxReturn, filingStatus: taxReturn.filingStatus || FilingStatus.Single },
      { enabled: true },
    );
  }, [taxReturn]);

  if (!taxReturn || !result) return null;

  const f = result.form1040;
  const isRefund = f.refundAmount > 0;

  return (
    <ToolViewWrapper>
      <SectionIntro
        icon={<Calculator className="w-8 h-8" />}
        title="Explain My Taxes"
        description="An interactive breakdown of exactly how your 2025 federal tax was calculated — every number, every formula, every IRS citation."
      />

      {/* Hero result */}
      <div className={`rounded-xl border mt-6 text-center py-6 px-6 ${isRefund ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
        <p className="text-slate-400 text-sm mb-1">{isRefund ? 'Estimated Refund' : 'Estimated Tax Owed'}</p>
        <p className={`text-4xl font-bold ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
          ${(isRefund ? f.refundAmount : f.amountOwed).toLocaleString()}
        </p>
      </div>

      {/* Insights */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-telos-blue-500/20 text-telos-blue-400 text-xs font-bold flex items-center justify-center">1</span>
          Key Insights
        </h3>
        <TaxInsights form1040={f} calculation={result} />
      </div>

      {/* Tax Flow */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-telos-blue-500/20 text-telos-blue-400 text-xs font-bold flex items-center justify-center">2</span>
          How Your Tax Flows
        </h3>
        <TaxFlowSwitcher form1040={f} calculation={result} />
      </div>

      {/* Bracket Breakdown */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-telos-blue-500/20 text-telos-blue-400 text-xs font-bold flex items-center justify-center">3</span>
          Tax Bracket Breakdown
        </h3>
        <div className="card">
          <BracketChart
            taxableIncome={f.taxableIncome}
            filingStatus={taxReturn.filingStatus || FilingStatus.Single}
            incomeTax={f.incomeTax}
          />
        </div>
      </div>

      {/* Effective Tax Rate */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-telos-blue-500/20 text-telos-blue-400 text-xs font-bold flex items-center justify-center">4</span>
          Your Tax Rate
        </h3>
        <EffectiveTaxRateCard form1040={f} />
      </div>

      {/* Trace Explorer */}
      <div className="mt-8">
        <button
          onClick={() => setShowTraces(!showTraces)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3 hover:text-telos-blue-300 transition-colors"
        >
          <span className="w-6 h-6 rounded-full bg-telos-blue-500/20 text-telos-blue-400 text-xs font-bold flex items-center justify-center">5</span>
          Calculation Audit Trail
          {showTraces ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showTraces && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              Every number on your return traces back to a specific IRS form line, IRC section, and formula.
              Expand any row to see exactly how it was computed.
            </p>
            <div className="rounded-xl border p-6 bg-surface-900/50 border-slate-700">
              <TraceTree traces={result.traces || []} onNavigateToForm={handleNavigateToForm} />
            </div>
          </>
        )}
      </div>

      <p className="text-[10px] text-slate-600 text-center mt-6 mb-2">
        This is an estimate based on the data you've entered. Actual tax liability may differ.
      </p>
    </ToolViewWrapper>
  );
}
