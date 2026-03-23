import { useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import type { CalculationTrace } from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import WarningsSummaryCard from '../common/WarningsSummaryCard';
import YoYComparisonCard from '../common/YoYComparisonCard';
import AuditRiskCard from '../common/AuditRiskCard';
import TaxCalendarCard from '../common/TaxCalendarCard';
import TraceDisclosure from '../common/TraceDisclosure';
import { ClipboardCheck, MapPin } from 'lucide-react';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';

export default function TaxSummaryStep() {
  const { taxReturn } = useTaxReturnStore();
  const calculation = useTaxReturnStore((s) => s.calculation);

  const taxableStates = useMemo(
    () => calculation?.stateResults?.filter(sr => sr.totalStateTax > 0 || sr.localTax > 0) || [],
    [calculation?.stateResults],
  );

  if (!taxReturn || !calculation) return null;

  const result = calculation;
  const f = result.form1040;
  const isRefund = f.refundAmount > 0;
  const help = HELP_CONTENT['tax_summary'];

  const findTrace = (id: string) => result.traces?.find((t: CalculationTrace) => t.lineId === id);

  const totalStateTax = taxableStates.reduce((s, sr) => s + sr.totalStateTax, 0);

  return (
    <div>
      <SectionIntro icon={<ClipboardCheck className="w-8 h-8" />} title="Tax Summary" description="Here's the big picture of your 2025 tax return." />

      <WarningsSummaryCard />
      <div className="space-y-3 mt-4 mb-6">
        {help?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Hero number */}
      <div className={`rounded-xl border mt-6 text-center py-8 px-6 ${isRefund ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
        <p className="text-slate-400 text-sm mb-1">{isRefund ? 'Estimated Refund' : 'Estimated Tax Owed'}</p>
        <p className={`text-5xl font-bold ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
          ${(isRefund ? f.refundAmount : f.amountOwed).toLocaleString()}
        </p>
        {findTrace('form1040.line37') && (
          <div className="flex justify-center mt-3">
            <TraceDisclosure trace={findTrace('form1040.line37')!} />
          </div>
        )}
      </div>

      {/* State refund/owed pills */}
      {taxableStates.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {taxableStates.map(sr => {
            const stateRefund = sr.stateRefundOrOwed >= 0;
            return (
              <div
                key={sr.stateCode}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border ${
                  stateRefund
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}
              >
                <MapPin className="w-3 h-3" />
                <span className="font-medium">{sr.stateCode}</span>
                <span>{stateRefund ? '+' : '-'}${Math.abs(sr.stateRefundOrOwed).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <div className="card text-center">
          <p className="text-slate-400 text-xs uppercase">Total Income</p>
          <p className="text-xl font-semibold text-white">${f.totalIncome.toLocaleString()}</p>
        </div>
        <div className="card text-center">
          <p className="text-slate-400 text-xs uppercase">Taxable Income</p>
          <p className="text-xl font-semibold text-white">${f.taxableIncome.toLocaleString()}</p>
        </div>
        <div className="card text-center">
          <p className="text-slate-400 text-xs uppercase">Effective Rate</p>
          <p className="text-xl font-semibold text-white">{(f.effectiveTaxRate * 100).toFixed(1)}%</p>
        </div>
        <div className="card text-center">
          <p className="text-slate-400 text-xs uppercase">Marginal Rate</p>
          <p className="text-xl font-semibold text-white">{(f.marginalTaxRate * 100).toFixed(0)}%</p>
        </div>
        {taxableStates.length > 0 && (
          <div className="card text-center">
            <p className="text-slate-400 text-xs uppercase">State Tax</p>
            <p className="text-xl font-semibold text-white">${totalStateTax.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Breakdown */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-3">Tax Breakdown</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Federal Income Tax</span><span>${f.incomeTax.toLocaleString()}</span></div>
          {f.seTax > 0 && <div className="flex justify-between"><span className="text-slate-400">Self-Employment Tax</span><span>${f.seTax.toLocaleString()}</span></div>}
          {f.amtAmount > 0 && <div className="flex justify-between"><span className="text-slate-400">Alternative Minimum Tax</span><span className="text-white">${f.amtAmount.toLocaleString()}</span></div>}
          {f.niitTax > 0 && <div className="flex justify-between"><span className="text-slate-400">Net Investment Income Tax</span><span>${f.niitTax.toLocaleString()}</span></div>}
          {f.additionalMedicareTaxW2 > 0 && <div className="flex justify-between"><span className="text-slate-400">Additional Medicare Tax</span><span>${f.additionalMedicareTaxW2.toLocaleString()}</span></div>}
          {f.earlyDistributionPenalty > 0 && <div className="flex justify-between"><span className="text-slate-400">Early Distribution Penalty</span><span>${f.earlyDistributionPenalty.toLocaleString()}</span></div>}
          {f.totalCredits > 0 && <div className="flex justify-between"><span className="text-slate-400">Tax Credits</span><span className="text-white">-${f.totalCredits.toLocaleString()}</span></div>}
          <div className="flex justify-between border-t border-slate-700 pt-2"><span className="text-white font-medium">Tax After Credits</span><span className="font-semibold">${f.taxAfterCredits.toLocaleString()}</span></div>
          {f.totalWithholding > 0 && <div className="flex justify-between"><span className="text-slate-400">Total Withholding</span><span>-${f.totalWithholding.toLocaleString()}</span></div>}
        </div>
      </div>

      {/* State Tax Breakdown */}
      {taxableStates.length > 0 && (
        <div className="card mt-4">
          <h3 className="font-medium text-slate-200 mb-3">State Taxes</h3>
          <div className="space-y-4">
            {taxableStates.map(sr => {
              const stateRefund = sr.stateRefundOrOwed >= 0;
              return (
                <div key={sr.stateCode} className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded bg-telos-blue-600/20 flex items-center justify-center text-telos-blue-400 font-bold text-xs">
                      {sr.stateCode}
                    </div>
                    <span className="font-medium text-slate-200">{sr.stateName}</span>
                    <span className="text-xs text-slate-400 capitalize">
                      {sr.residencyType === 'resident' ? 'Resident' : sr.residencyType === 'part_year' ? 'Part-year' : 'Nonresident'}
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-slate-400">State Taxable Income</span><span>${sr.stateTaxableIncome.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">State Income Tax</span><span>${sr.stateIncomeTax.toLocaleString()}</span></div>
                  {sr.stateCredits > 0 && <div className="flex justify-between"><span className="text-slate-400">State Credits</span><span className="text-white">-${sr.stateCredits.toLocaleString()}</span></div>}
                  {sr.localTax > 0 && <div className="flex justify-between"><span className="text-slate-400">Local Tax</span><span>${sr.localTax.toLocaleString()}</span></div>}
                  <div className="flex justify-between border-t border-slate-700 pt-2"><span className="text-white font-medium">Total State Tax</span><span className="font-semibold text-amber-400">${sr.totalStateTax.toLocaleString()}</span></div>
                  {sr.stateWithholding > 0 && <div className="flex justify-between"><span className="text-slate-400">State Withholding</span><span>-${sr.stateWithholding.toLocaleString()}</span></div>}
                  <div className="flex justify-between">
                    <span className={`font-medium ${stateRefund ? 'text-emerald-400' : 'text-amber-400'}`}>{stateRefund ? 'Refund' : 'Owed'}</span>
                    <span className={`font-semibold ${stateRefund ? 'text-emerald-400' : 'text-amber-400'}`}>${Math.abs(sr.stateRefundOrOwed).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-slate-400">Effective rate: {(sr.effectiveStateRate * 100).toFixed(2)}%</div>
                  {taxableStates.indexOf(sr) < taxableStates.length - 1 && <div className="border-t border-slate-700/50 mt-2" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Savings highlights */}
      {(f.qbiDeduction > 0 || f.seDeduction > 0 || f.deductionAmount > 0) && (
        <div className="rounded-xl border p-6 mt-4 bg-telos-orange-500/5 border-telos-orange-500/20">
          <h3 className="font-medium text-telos-orange-300 mb-3">Tax Savings</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">{f.deductionUsed === 'standard' ? 'Standard' : 'Itemized'} Deduction</span><span className="text-white">-${f.deductionAmount.toLocaleString()}</span></div>
            {f.qbiDeduction > 0 && <div className="flex justify-between"><span className="text-slate-400">QBI Deduction (20% of business income)</span><span className="text-white">-${f.qbiDeduction.toLocaleString()}</span></div>}
            {f.seDeduction > 0 && <div className="flex justify-between"><span className="text-slate-400">SE Tax Deduction (employer half)</span><span className="text-white">-${f.seDeduction.toLocaleString()}</span></div>}
            {f.capitalLossDeduction > 0 && <div className="flex justify-between"><span className="text-slate-400">Capital Loss Deduction</span><span className="text-white">-${f.capitalLossDeduction.toLocaleString()}</span></div>}
          </div>
        </div>
      )}

      {/* Audit Risk Assessment */}
      <AuditRiskCard />

      {/* Year-over-Year Comparison */}
      <YoYComparisonCard priorYear={taxReturn.priorYearSummary} current={f} />

      {/* Tax Calendar & Deadlines */}
      <TaxCalendarCard />

      <StepNavigation continueLabel="Continue to Export" />
    </div>
  );
}
