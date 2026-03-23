import { useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { calculateForm1040 } from '@telostax/engine';
import type { Form8582Result, PassiveActivityDetail } from '@telostax/engine';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import CalloutCard from '../common/CalloutCard';
import StepWarningsBanner from '../common/StepWarningsBanner';
import { Scale, CheckCircle, AlertTriangle, Info, ArrowRightCircle } from 'lucide-react';

export default function Form8582Step() {
  const { taxReturn } = useTaxReturnStore();
  if (!taxReturn) return null;

  const result = useMemo(() => {
    try {
      return calculateForm1040(taxReturn);
    } catch {
      return null;
    }
  }, [taxReturn]);

  const form8582 = result?.form8582;

  // No calculation yet
  if (!form8582) {
    return (
      <div>
        <SectionIntro
          icon={<Scale className="w-8 h-8" />}
          title="Passive Loss Limitation (Form 8582)"
          description="Review how passive activity loss rules affect your rental and partnership income."
        />
        <div className="card mt-6 text-center py-8">
          <Info className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            Enter your income and rental data first. The passive loss computation
            will appear here automatically.
          </p>
        </div>
        <StepNavigation />
      </div>
    );
  }

  const hasLimitation = form8582.totalSuspendedLoss > 0;
  const hasDispositions = form8582.dispositionReleasedLosses > 0;
  const noLossActivities = form8582.combinedNetIncome >= 0;

  return (
    <div>
      <StepWarningsBanner stepId="form8582_review" />

      <SectionIntro
        icon={<Scale className="w-8 h-8" />}
        title="Passive Loss Limitation (Form 8582)"
        description="Full passive activity loss computation under IRC §469."
      />

      <CalloutCard variant="info" title="About Passive Activity Losses" irsUrl="https://www.irs.gov/forms-pubs/about-form-8582">
        Under IRC §469, losses from passive activities (like rental properties) generally
        cannot offset wages, interest, or other non-passive income. Active-participation
        rental real estate has a special $25,000 allowance that phases out between $100,000
        and $150,000 AGI. Suspended losses carry forward until you have passive income or
        dispose of the activity.
      </CalloutCard>

      {/* Hero Card */}
      {hasLimitation ? (
        <div className="rounded-xl border mt-6 text-center py-6 px-6 bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-slate-400 text-sm mb-1">Passive Losses Suspended</p>
          <p className="text-4xl font-bold text-amber-400">
            ${form8582.totalSuspendedLoss.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Carries forward to future tax years
          </p>
          {form8582.allowedPassiveLoss > 0 && (
            <p className="text-sm text-emerald-400 mt-2">
              ${form8582.allowedPassiveLoss.toLocaleString()} allowed this year via special allowance
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border mt-6 text-center py-6 px-6 bg-emerald-500/10 border-emerald-500/30">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-slate-400 text-sm mb-1">
            {noLossActivities ? 'No Passive Losses' : 'All Passive Losses Allowed'}
          </p>
          <p className="text-2xl font-bold text-emerald-400">
            {noLossActivities ? 'No limitation needed' : `$${form8582.allowedPassiveLoss.toLocaleString()} deductible`}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {noLossActivities
              ? 'Your passive income exceeds passive losses'
              : 'Within the $25,000 special allowance'}
          </p>
        </div>
      )}

      {/* Part I — Passive Activity Summary */}
      <div className="card mt-4">
        <h3 className="font-medium text-slate-200 mb-1 text-sm uppercase tracking-wide">
          Part I — Net Passive Income / Loss
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Categorizing passive activities per Form 8582 Part I.
        </p>
        <div className="space-y-0 text-sm">
          {form8582.netRentalActiveIncome !== 0 && (
            <Row label="Line 1: Rental RE with active participation" value={form8582.netRentalActiveIncome} />
          )}
          {form8582.netOtherPassiveIncome !== 0 && (
            <Row label="Line 2: All other passive activities" value={form8582.netOtherPassiveIncome} />
          )}
          <div className="border-t border-slate-700/50 my-2" />
          <Row label="Line 3a: Total passive income" value={form8582.totalPassiveIncome} />
          <Row label="Line 3b: Total passive loss" value={form8582.totalPassiveLoss} />
          <div className="border-t border-slate-700/50 my-2" />
          <Row label="Line 4: Combined net" value={form8582.combinedNetIncome} bold />
        </div>
      </div>

      {/* Part II — Special Allowance (only if there's a loss) */}
      {form8582.combinedNetIncome < 0 && (
        <div className="card mt-4">
          <h3 className="font-medium text-slate-200 mb-1 text-sm uppercase tracking-wide">
            Part II — Special Allowance
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Active-participation rental RE can offset up to $25,000 of non-passive income.
          </p>
          <div className="space-y-0 text-sm">
            <Row label="Special allowance (after AGI phase-out)" value={form8582.specialAllowance} />
            <Row label="Allowed passive loss this year" value={form8582.allowedPassiveLoss} bold />
          </div>
        </div>
      )}

      {/* Disposition Released Losses */}
      {hasDispositions && (
        <div className="rounded-xl border mt-4 p-4 bg-emerald-500/10 border-emerald-500/30">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-medium text-emerald-400 text-sm">
              Disposition — Suspended Losses Released
            </h3>
          </div>
          <p className="text-sm text-slate-300">
            You disposed of one or more passive activities this year. Per IRC §469(g)(1),
            all suspended losses from those activities are released and fully deductible.
          </p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">
            ${form8582.dispositionReleasedLosses.toLocaleString()} released
          </p>
        </div>
      )}

      {/* Per-Activity Detail Table */}
      {form8582.activities.length > 0 && (
        <div className="card mt-4">
          <h3 className="font-medium text-slate-200 mb-1 text-sm uppercase tracking-wide">
            Per-Activity Detail
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Worksheets 1 & 2 equivalent — how losses are allocated across activities.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700">
                  <th className="text-left py-2 pr-2">Activity</th>
                  <th className="text-right py-2 px-2">Current Year</th>
                  <th className="text-right py-2 px-2">Prior Year</th>
                  <th className="text-right py-2 px-2">Allowed</th>
                  <th className="text-right py-2 pl-2">Suspended</th>
                </tr>
              </thead>
              <tbody>
                {form8582.activities.map((act) => (
                  <ActivityRow key={act.id} activity={act} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Carryforward Card */}
      {form8582.totalSuspendedLoss > 0 && (
        <div className="rounded-xl border mt-4 p-4 bg-amber-500/10 border-amber-500/30">
          <h3 className="font-medium text-amber-400 text-sm mb-1">
            Carryforward to Next Year
          </h3>
          <p className="text-sm text-slate-400 mb-2">
            These suspended losses will be available on next year's Form 8582.
            Keep this amount for your records.
          </p>
          <p className="text-2xl font-bold text-amber-400">
            ${form8582.totalSuspendedLoss.toLocaleString()}
          </p>
        </div>
      )}

      {/* Warnings */}
      {form8582.warnings.length > 0 && (
        <div className="card mt-4">
          <h3 className="font-medium text-amber-400 text-sm mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Notes
          </h3>
          <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
            {form8582.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <StepNavigation />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  const formatted = value < 0
    ? `-$${Math.abs(value).toLocaleString()}`
    : `$${value.toLocaleString()}`;

  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={bold ? 'text-slate-200 font-medium' : 'text-slate-400'}>{label}</span>
      <span className={`font-mono text-xs ${bold ? 'text-white font-medium' : value < 0 ? 'text-red-400' : 'text-slate-300'}`}>
        {formatted}
      </span>
    </div>
  );
}

function ActivityRow({ activity: act }: { activity: PassiveActivityDetail }) {
  const fmt = (v: number) => v < 0 ? `-$${Math.abs(v).toLocaleString()}` : `$${v.toLocaleString()}`;
  return (
    <tr className="border-b border-slate-800 last:border-0">
      <td className="py-1.5 pr-2 text-slate-300">
        <div className="flex items-center gap-1.5">
          <span>{act.name}</span>
          {act.disposedDuringYear && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              Disposed
            </span>
          )}
          {act.type === 'rental' && act.activeParticipation && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-telos-blue-500/20 text-telos-blue-400">
              Active
            </span>
          )}
        </div>
      </td>
      <td className={`py-1.5 px-2 text-right font-mono ${act.currentYearNetIncome < 0 ? 'text-red-400' : 'text-slate-300'}`}>
        {fmt(act.currentYearNetIncome)}
      </td>
      <td className={`py-1.5 px-2 text-right font-mono ${act.priorYearUnallowed > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
        {act.priorYearUnallowed > 0 ? fmt(-act.priorYearUnallowed) : '—'}
      </td>
      <td className="py-1.5 px-2 text-right font-mono text-emerald-400">
        {act.allowedLoss < 0 ? fmt(act.allowedLoss) : '—'}
      </td>
      <td className={`py-1.5 pl-2 text-right font-mono ${act.suspendedLoss > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
        {act.suspendedLoss > 0 ? fmt(act.suspendedLoss) : '—'}
      </td>
    </tr>
  );
}
