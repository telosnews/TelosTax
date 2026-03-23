/**
 * FreeEfilingPanel — Sub-hub showing free e-filing options with eligibility.
 *
 * Displays three IRS free filing programs:
 *   A. IRS Free File (AGI ≤ $89,000)
 *   B. Free Fillable Forms + Transfer Guide (always eligible)
 *   C. VITA / TCE (income or age based)
 *
 * Uses assessFilingOptions to show personalized eligibility badges.
 */
import { useMemo, useState } from 'react';
import type { TaxReturn, CalculationResult, FilingOptionsAssessment, EligibilityStatus } from '@telostax/engine';
import { assessFilingOptions, FILING_URLS } from '@telostax/engine';
import TransferGuidePanel from './TransferGuidePanel';
import {
  ArrowLeft,
  Monitor,
  ClipboardCopy,
  Users,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface FreeEfilingPanelProps {
  taxReturn: TaxReturn;
  result: CalculationResult;
  onBack: () => void;
}

type EfilingView = 'options' | 'transfer-guide';

export default function FreeEfilingPanel({ taxReturn, result, onBack }: FreeEfilingPanelProps) {
  const [view, setView] = useState<EfilingView>('options');
  const assessment = useMemo(
    () => assessFilingOptions(taxReturn, result),
    [taxReturn, result],
  );

  const agi = result.form1040.agi;

  if (view === 'transfer-guide') {
    return (
      <TransferGuidePanel
        taxReturn={taxReturn}
        result={result}
        onBack={() => setView('options')}
      />
    );
  }

  return (
    <div>
      {/* Back to hub */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-telos-blue-400 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Filing Options
      </button>

      <h2 className="text-xl font-bold text-white mb-1">Free Electronic Filing</h2>
      <p className="text-sm text-slate-400 mb-5">
        E-filing is faster, more accurate, and gets your refund sooner. Here are your free options.
      </p>

      <div className="space-y-3">
        {/* A. Free Fillable Forms + Transfer Guide */}
        <div className="card bg-surface-800 border-slate-700 hover:border-telos-blue-600/40 transition-colors">
          <div className="flex items-start gap-3">
            <span className="text-telos-blue-400 mt-0.5">
              <ClipboardCopy className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white">Free Fillable Forms</h3>
                <EligibilityBadge status={assessment.freeFileForms.status} />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Electronic versions of IRS paper forms. Use our Transfer Guide to copy your
                calculated values line-by-line.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setView('transfer-guide')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-telos-blue-600/20 text-telos-blue-400 hover:bg-telos-blue-600/30 text-xs font-medium transition-colors"
                >
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  Open Transfer Guide
                </button>
                <a
                  href={FILING_URLS.freeFileForms}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-700 text-slate-300 hover:bg-surface-600 text-xs font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Go to Free Fillable Forms
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* B. IRS Free File */}
        <OptionCard
          icon={<Monitor className="w-5 h-5" />}
          title="IRS Free File"
          eligibility={assessment.freeFile}
          contextLine={`Your AGI: $${agi.toLocaleString()} | Limit: $89,000`}
          description="IRS-partnered software guides you through your return at no cost."
          actionLabel="Browse Free File Options"
          actionUrl={FILING_URLS.freeFile}
        />

        {/* C. VITA / TCE */}
        <OptionCard
          icon={<Users className="w-5 h-5" />}
          title="VITA / TCE — Free In-Person Help"
          eligibility={assessment.vita.status !== 'not_eligible' ? assessment.vita : assessment.tce}
          contextLine={
            assessment.vita.status === 'eligible'
              ? `VITA: AGI $${agi.toLocaleString()} (limit $69,000)`
              : assessment.tce.status === 'eligible'
              ? 'TCE: Available for age 60+'
              : `Your AGI: $${agi.toLocaleString()} | VITA limit: $69,000`
          }
          description="IRS-trained volunteers prepare your return for free at local community sites."
          actionLabel="Find a VITA/TCE Site Near You"
          actionUrl={FILING_URLS.vitaLocator}
        />
      </div>
    </div>
  );
}

// ── OptionCard (generic e-filing option) ─────────

function OptionCard({
  icon,
  title,
  eligibility,
  contextLine,
  description,
  actionLabel,
  actionUrl,
}: {
  icon: React.ReactNode;
  title: string;
  eligibility: { status: EligibilityStatus; reason: string };
  contextLine: string;
  description: string;
  actionLabel: string;
  actionUrl: string;
}) {
  return (
    <div className="card bg-surface-800 border-slate-700">
      <div className="flex items-start gap-3">
        <span className="text-telos-blue-400 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <EligibilityBadge status={eligibility.status} />
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{contextLine}</p>
          <p className="text-xs text-slate-400 mt-1">{description}</p>
          <p className="text-xs text-slate-400 mt-1 italic">{eligibility.reason}</p>
          <a
            href={actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {actionLabel}
          </a>
        </div>
      </div>
    </div>
  );
}

// ── EligibilityBadge ─────────────────────────────

function EligibilityBadge({ status }: { status: EligibilityStatus }) {
  const config: Record<EligibilityStatus, { label: string; classes: string }> = {
    eligible: {
      label: 'Eligible',
      classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    },
    likely_eligible: {
      label: 'Likely Eligible',
      classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    },
    not_eligible: {
      label: 'Not Eligible',
      classes: 'bg-red-500/15 text-red-400 border-red-500/30',
    },
    unknown: {
      label: 'Info Needed',
      classes: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    },
  };

  const { label, classes } = config[status];
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${classes}`}>
      {label}
    </span>
  );
}
