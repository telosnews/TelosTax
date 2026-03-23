import { useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import {
  calculateForm1040, getStateName, StateCalculationResult,
  type CalculationTrace,
} from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import TraceDisclosure from '../common/TraceDisclosure';
import { MapPin, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

export default function StateReviewStep() {
  const { taxReturn } = useTaxReturnStore();
  if (!taxReturn) return null;

  const calcResult = useMemo(() => {
    try {
      return calculateForm1040(taxReturn);
    } catch {
      return null;
    }
  }, [taxReturn]);

  const stateResults = calcResult?.stateResults || [];

  if (stateResults.length === 0) {
    return (
      <div>
        <SectionIntro
          icon={<MapPin className="w-8 h-8" />}
          title="State Tax Summary"
          description="No state tax calculations to show."
        />
        <StepNavigation />
      </div>
    );
  }

  // Combined totals
  const totalStateTax = stateResults.reduce((s, r) => s + r.totalStateTax, 0);
  const totalWithholding = stateResults.reduce((s, r) => s + r.stateWithholding, 0);
  const totalRefundOrOwed = totalWithholding - totalStateTax;

  return (
    <div>
      <SectionIntro
        icon={<MapPin className="w-8 h-8" />}
        title="State Tax Summary"
        description="Here's a breakdown of your state tax obligations."
      />

      {/* Combined hero */}
      {stateResults.length > 1 && (
        <div className={`rounded-xl border mt-6 text-center py-6 px-6 ${totalRefundOrOwed >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
          <p className="text-slate-400 text-sm mb-1">
            Combined State {totalRefundOrOwed >= 0 ? 'Refund' : 'Tax Owed'}
          </p>
          <p className={`text-4xl font-bold ${totalRefundOrOwed >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            ${Math.abs(totalRefundOrOwed).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {stateResults.length} state{stateResults.length > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Per-state cards */}
      {stateResults.map((sr) => (
        <StateResultCard key={sr.stateCode} result={sr} />
      ))}

      <StepNavigation />
    </div>
  );
}

function StateResultCard({ result: sr }: { result: StateCalculationResult }) {
  const isRefund = sr.stateRefundOrOwed >= 0;
  const findTrace = (id: string) => sr.traces?.find((t: CalculationTrace) => t.lineId === id);

  return (
    <div className="card mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-telos-blue-600/20 flex items-center justify-center text-telos-blue-400 font-bold text-sm">
            {sr.stateCode}
          </div>
          <div>
            <h3 className="font-medium text-slate-200">{sr.stateName}</h3>
            <p className="text-xs text-slate-400 capitalize">{sr.residencyType === 'resident' ? 'Full-year resident' : sr.residencyType === 'part_year' ? 'Part-year resident' : 'Nonresident'}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isRefund ? '+' : ''}${sr.stateRefundOrOwed.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400">
            {isRefund ? 'Refund' : 'Owed'}
          </p>
        </div>
      </div>

      {/* Computation breakdown */}
      <div className="space-y-0 text-sm border-t border-slate-700 pt-3">
        <Row label="Federal AGI" value={sr.federalAGI} />
        {sr.stateAdditions > 0 && <Row label="State additions" value={sr.stateAdditions} plus />}
        {sr.stateSubtractions > 0 && <Row label="State subtractions" value={-sr.stateSubtractions} />}
        <Row label="State AGI" value={sr.stateAGI} bold trace={findTrace('state.stateAGI')} />
        {sr.stateDeduction > 0 && <Row label="Deduction" value={-sr.stateDeduction} />}
        {sr.stateExemptions > 0 && <Row label="Exemptions" value={-sr.stateExemptions} />}
        <Row label="State taxable income" value={sr.stateTaxableIncome} bold trace={findTrace('state.taxableIncome')} />

        <div className="border-t border-slate-700/50 my-2" />

        <Row label="State income tax" value={sr.stateIncomeTax} trace={findTrace('state.incomeTax')} />
        {sr.stateCredits > 0 && <Row label="State credits" value={-sr.stateCredits} green />}
        {sr.localTax > 0 && <Row label="Local tax" value={sr.localTax} />}
        <Row label="Total state tax" value={sr.totalStateTax} bold trace={findTrace('state.totalTax')} />

        {sr.stateWithholding > 0 && (
          <>
            <div className="border-t border-slate-700/50 my-2" />
            <Row label="State withholding" value={-sr.stateWithholding} green />
          </>
        )}

        <div className="border-t border-slate-700/50 my-2" />
        <div className="flex items-center justify-between py-1">
          <span className={`font-semibold ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isRefund ? 'Refund' : 'Amount owed'}
          </span>
          <span className={`font-bold ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
            ${Math.abs(sr.stateRefundOrOwed).toLocaleString()}
          </span>
        </div>
        {findTrace('state.refundOrOwed') && (
          <TraceDisclosure trace={findTrace('state.refundOrOwed')!} />
        )}
      </div>

      {/* Bracket details */}
      {sr.bracketDetails && sr.bracketDetails.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">Tax Brackets</span>
          </div>
          <div className="space-y-1">
            {sr.bracketDetails.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-12 text-right text-slate-400">{(b.rate * 100).toFixed(1)}%</span>
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-telos-blue-500/60 rounded-full"
                    style={{
                      width: `${Math.min(100, (b.taxableAtRate / sr.stateTaxableIncome) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-20 text-right text-slate-400">${b.taxAtRate.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Effective rate */}
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
        {sr.effectiveStateRate > 0 ? (
          <>
            <TrendingUp className="w-3 h-3" />
            Effective state rate: {(sr.effectiveStateRate * 100).toFixed(2)}%
          </>
        ) : (
          <>
            <TrendingDown className="w-3 h-3" />
            No state tax due
          </>
        )}
      </div>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────

function Row({
  label,
  value,
  bold,
  green,
  plus,
  trace,
}: {
  label: string;
  value: number;
  bold?: boolean;
  green?: boolean;
  plus?: boolean;
  trace?: CalculationTrace;
}) {
  const formatted = value < 0
    ? `-$${Math.abs(value).toLocaleString()}`
    : plus
      ? `+$${value.toLocaleString()}`
      : `$${value.toLocaleString()}`;

  return (
    <div>
      <div className="flex items-center justify-between py-0.5">
        <span className={bold ? 'text-slate-200 font-medium' : 'text-slate-400'}>{label}</span>
        <span className={`font-mono text-xs ${green ? 'text-emerald-400' : bold ? 'text-white font-medium' : 'text-slate-300'}`}>
          {formatted}
        </span>
      </div>
      {trace && <TraceDisclosure trace={trace} />}
    </div>
  );
}
