/**
 * ReturnContextSummary — shows what we know about the user's tax situation.
 *
 * Renders context facts as colored chips/tags. When context is sparse,
 * shows a message encouraging the user to provide more info.
 */

import type { ReturnContext } from '../../services/deductionFinderTypes';
import { FilingStatus } from '@telostax/engine';
import { Info } from 'lucide-react';

interface Props {
  context: ReturnContext;
  /** 0–1 score of how much context is available. */
  richness: number;
}

function Chip({ children, color = 'bg-surface-600 text-slate-300' }: { children: string; color?: string }) {
  return (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${color}`}>
      {children}
    </span>
  );
}

const FILING_STATUS_LABELS: Record<number, string> = {
  [FilingStatus.Single]: 'Single',
  [FilingStatus.MarriedFilingJointly]: 'Married Filing Jointly',
  [FilingStatus.MarriedFilingSeparately]: 'Married Filing Separately',
  [FilingStatus.HeadOfHousehold]: 'Head of Household',
  [FilingStatus.QualifyingSurvivingSpouse]: 'Qualifying Surviving Spouse',
};

export default function ReturnContextSummary({ context, richness }: Props) {
  const chips: { label: string; color: string }[] = [];

  if (context.filingStatus != null) {
    chips.push({ label: FILING_STATUS_LABELS[context.filingStatus] || 'Filing status set', color: 'bg-telos-blue-500/20 text-telos-blue-300' });
  }
  if (context.agi > 0) {
    const rounded = context.agi >= 100000
      ? `$${Math.round(context.agi / 1000)}K`
      : `$${Math.round(context.agi).toLocaleString()}`;
    chips.push({ label: `AGI ~${rounded}`, color: 'bg-emerald-500/20 text-emerald-300' });
  }
  if (context.hasScheduleC) {
    chips.push({ label: 'Self-employed', color: 'bg-blue-500/20 text-blue-300' });
  }
  if (context.hasHomeOffice) {
    chips.push({ label: 'Home office', color: 'bg-violet-500/20 text-violet-300' });
  }
  if (context.dependentCount > 0) {
    chips.push({ label: `${context.dependentCount} dependent${context.dependentCount > 1 ? 's' : ''}`, color: 'bg-pink-500/20 text-pink-300' });
  }
  if (context.minorDependentCount > 0) {
    chips.push({ label: `${context.minorDependentCount} under 13`, color: 'bg-pink-500/20 text-pink-300' });
  }
  if (context.deductionMethod === 'itemized') {
    chips.push({ label: 'Itemizing', color: 'bg-amber-500/20 text-amber-300' });
  }
  if (context.hasHSA) chips.push({ label: 'HSA', color: 'bg-lime-500/20 text-lime-300' });
  if (context.hasMortgageInterest) chips.push({ label: 'Mortgage', color: 'bg-orange-500/20 text-orange-300' });
  if (context.hasStudentLoanInterest) chips.push({ label: 'Student loans', color: 'bg-yellow-500/20 text-yellow-300' });
  if (context.hasSEHealthInsurance) chips.push({ label: 'SE health ins.', color: 'bg-rose-500/20 text-rose-300' });

  const isSparse = richness < 0.3;

  return (
    <div className="rounded-lg border p-4 bg-telos-blue-600/10 border-telos-blue-600/30">
      <div className="flex items-start gap-2.5">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-telos-blue-300" />
        <div className="flex-1">
          <div className="text-sm font-medium text-telos-blue-300 mb-2">
            What we know about your return
          </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Chip key={c.label} color={c.color}>{c.label}</Chip>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          No tax information entered yet.
        </p>
      )}

      {isSparse && (
        <p className="text-xs text-slate-400 mt-3 leading-relaxed">
          {chips.length === 0
            ? "We don't have any info about your tax situation yet — that's fine! Answer the questions below so we can scan your transactions smarter."
            : "We have some info, but the more you tell us, the more accurate the scan will be. Check the questions below to help us out."}
        </p>
      )}

      {!isSparse && (
        <p className="text-xs text-slate-500 mt-2">
          Based on your return, we've pre-selected the most relevant categories below.
        </p>
      )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compute a 0–1 "richness" score for the return context.
 * Used to determine whether to show quick-select bundles.
 */
export function computeContextRichness(context: ReturnContext): number {
  let score = 0;
  const checks = [
    context.filingStatus != null,
    context.agi > 0,
    context.hasScheduleC,
    context.hasHomeOffice,
    context.dependentCount > 0,
    context.deductionMethod === 'itemized',
    context.hasCharitableDeductions,
    context.hasMedicalExpenses,
    context.hasHSA,
    context.hasStudentLoanInterest,
    context.hasMortgageInterest,
    context.hasSALT,
    context.hasSEHealthInsurance,
  ];
  for (const check of checks) {
    if (check) score++;
  }
  return score / checks.length;
}
