/**
 * ExplainTaxesStep — full-page "Explain My Taxes" interactive experience.
 *
 * Assembles the tax flow diagram, bracket visualization, effective rate card,
 * auto-generated insights, and recursive trace explorer into a single
 * cohesive page that helps users understand exactly how their taxes were
 * calculated — and why.
 *
 * This is the key differentiator: no other tax software lets users see
 * the complete audit trail of how every number was derived, with
 * IRC citations, formulas, and plain-English explanations.
 */

import { useState, useMemo, useCallback } from 'react';
import { calculateForm1040, FilingStatus } from '@telostax/engine';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import TaxFlowSwitcher from '../explain/TaxFlowSwitcher';
import BracketChart from '../explain/BracketChart';
import EffectiveTaxRateCard from '../explain/EffectiveTaxRateCard';
import TaxInsights from '../explain/TaxInsights';
import TraceTree from '../explain/TraceTree';
import { resolveFormFromLineId } from '../../services/traceFormLinker';
import { Calculator, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

export default function ExplainTaxesStep() {
  const { taxReturn } = useTaxReturnStore();
  const [showTraces, setShowTraces] = useState(false);

  const handleNavigateToForm = useCallback((lineId: string) => {
    const formId = resolveFormFromLineId(lineId);
    if (formId) {
      useTaxReturnStore.getState().navigateToFormLine(formId, lineId);
    }
  }, []);

  // Always calculate with tracing enabled on this step
  const result = useMemo(() => {
    if (!taxReturn) return null;
    const returnWithDefaults = {
      ...taxReturn,
      filingStatus: taxReturn.filingStatus || FilingStatus.Single,
    };
    return calculateForm1040(returnWithDefaults, { enabled: true });
  }, [taxReturn]);

  if (!taxReturn || !result) return null;

  const f = result.form1040;
  const isRefund = f.refundAmount > 0;
  const taxableStates = result.stateResults?.filter(sr => sr.totalStateTax > 0 || sr.localTax > 0) || [];
  const hasStates = taxableStates.length > 0;

  return (
    <div>
      <SectionIntro
        icon={<Calculator className="w-8 h-8" />}
        title="Explain My Taxes"
        description={hasStates
          ? "An interactive breakdown of exactly how your 2025 federal and state taxes were calculated — every number, every formula, every citation."
          : "An interactive breakdown of exactly how your 2025 federal tax was calculated — every number, every formula, every IRS citation."
        }
      />

      {/* Hero result */}
      <div className={`rounded-xl border mt-6 text-center py-6 px-6 ${isRefund ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
        <p className="text-slate-400 text-sm mb-1">{isRefund ? 'Estimated Refund' : 'Estimated Tax Owed'}</p>
        <p className={`text-4xl font-bold ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
          ${(isRefund ? f.refundAmount : f.amountOwed).toLocaleString()}
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Read on to understand exactly how we got here.
        </p>
      </div>

      {/* Insights — plain English first */}
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
        <p className="text-xs text-slate-400 mb-3">
          Follow your income from top to bottom — each step shows how it's transformed into your final tax bill.
        </p>
        <TaxFlowSwitcher form1040={f} calculation={result} />
      </div>

      {/* Bracket Breakdown */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-telos-blue-500/20 text-telos-blue-400 text-xs font-bold flex items-center justify-center">3</span>
          Tax Bracket Breakdown
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Your income is taxed progressively — lower brackets are filled first, each at their own rate.
        </p>
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

      {/* State Taxes */}
      {hasStates && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-telos-blue-500/20 text-telos-blue-400 text-xs font-bold flex items-center justify-center">5</span>
            State Taxes
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            How your state tax was computed for each state, from federal AGI through to your final state refund or amount owed.
          </p>
          <div className="space-y-4">
            {taxableStates.map(sr => {
              const stateRefund = sr.stateRefundOrOwed > 0;
              const stateZero = sr.stateRefundOrOwed === 0;
              return (
                <details key={sr.stateCode} className="card group">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-telos-blue-600/20 flex items-center justify-center text-telos-blue-400 font-bold text-sm">
                        {sr.stateCode}
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">{sr.stateName}</p>
                        <p className="text-xs text-slate-400 capitalize">
                          {sr.residencyType === 'resident' ? 'Full-year resident' : sr.residencyType === 'part_year' ? 'Part-year' : 'Nonresident'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${stateZero ? 'text-slate-400' : stateRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {stateRefund ? '+' : ''}${sr.stateRefundOrOwed.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-400">{stateZero ? 'Even' : stateRefund ? 'Refund' : 'Owed'}</p>
                    </div>
                  </summary>

                  <div className="mt-4 space-y-2 text-sm border-t border-slate-700 pt-3">
                    {/* Tax flow */}
                    <div className="flex justify-between"><span className="text-slate-400">Federal AGI</span><span>${sr.federalAGI.toLocaleString()}</span></div>
                    {sr.stateAdditions > 0 && <div className="flex justify-between"><span className="text-slate-400">+ State additions</span><span>+${sr.stateAdditions.toLocaleString()}</span></div>}
                    {sr.stateSubtractions > 0 && <div className="flex justify-between"><span className="text-slate-400">− State subtractions</span><span>-${sr.stateSubtractions.toLocaleString()}</span></div>}
                    <div className="flex justify-between font-medium"><span className="text-slate-200">State AGI</span><span>${sr.stateAGI.toLocaleString()}</span></div>
                    {sr.stateDeduction > 0 && <div className="flex justify-between"><span className="text-slate-400">− Deduction</span><span>-${sr.stateDeduction.toLocaleString()}</span></div>}
                    {sr.stateExemptions > 0 && <div className="flex justify-between"><span className="text-slate-400">− Exemptions</span><span>-${sr.stateExemptions.toLocaleString()}</span></div>}
                    <div className="flex justify-between font-medium"><span className="text-slate-200">Taxable income</span><span>${sr.stateTaxableIncome.toLocaleString()}</span></div>

                    <div className="border-t border-slate-700/50 my-2" />

                    <div className="flex justify-between"><span className="text-slate-400">State income tax</span><span>${sr.stateIncomeTax.toLocaleString()}</span></div>
                    {sr.stateCredits > 0 && <div className="flex justify-between"><span className="text-telos-orange-400">− Credits</span><span className="text-telos-orange-400">-${sr.stateCredits.toLocaleString()}</span></div>}
                    {sr.localTax > 0 && <div className="flex justify-between"><span className="text-slate-400">+ Local tax</span><span>${sr.localTax.toLocaleString()}</span></div>}
                    <div className="flex justify-between font-medium border-t border-slate-700 pt-2"><span className="text-white">Total state tax</span><span>${sr.totalStateTax.toLocaleString()}</span></div>

                    {/* Bracket breakdown */}
                    {sr.bracketDetails && sr.bracketDetails.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs text-slate-400 font-medium">Tax Brackets</span>
                          <span className="text-xs text-slate-400 ml-auto">
                            Effective rate: {(sr.effectiveStateRate * 100).toFixed(2)}%
                          </span>
                        </div>
                        <div className="space-y-1">
                          {sr.bracketDetails.map((b, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="w-12 text-right text-slate-400">{(b.rate * 100).toFixed(1)}%</span>
                              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-telos-blue-500/60 rounded-full"
                                  style={{ width: `${Math.min(100, sr.stateTaxableIncome > 0 ? (b.taxableAtRate / sr.stateTaxableIncome) * 100 : 0)}%` }}
                                />
                              </div>
                              <span className="w-20 text-right text-slate-400">${b.taxAtRate.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* Trace Explorer */}
      <div className="mt-8">
        <button
          onClick={() => setShowTraces(!showTraces)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3 hover:text-telos-blue-300 transition-colors"
        >
          <span className="w-6 h-6 rounded-full bg-telos-blue-500/20 text-telos-blue-400 text-xs font-bold flex items-center justify-center">{hasStates ? 6 : 5}</span>
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

      {/* Disclaimer */}
      <p className="text-[10px] text-slate-600 text-center mt-6 mb-2">
        This is an estimate based on the data you've entered. Actual tax liability may differ.
        TelosTax is not a licensed tax advisor. Consult a CPA for professional tax advice.
      </p>

      <StepNavigation continueLabel="Continue to Export" />
    </div>
  );
}
