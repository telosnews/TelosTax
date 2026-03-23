/**
 * Document Inventory Panel — shows all entered forms organized by type
 * with completeness indicators, entry details, and navigation.
 *
 * Structure:
 *   OverallProgressHeader   – Completeness bar with stats
 *   PendingAlert            – Amber card for discovered-but-not-entered
 *   IncomeFormGroupCard[]   – Expandable card per form type
 *     FormEntryRow[]        – Per-entry with status + Edit button
 *   NonIncomeSectionCard[]  – Personal info, filing, dependents, deductions, credits
 */

import { useState } from 'react';
import {
  ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle, Clock,
  Building2, Briefcase, CircleDollarSign, Landmark, TrendingUp, PiggyBank,
  FileSpreadsheet, BarChart3, Coins, ShieldCheck, Home, HeartPulse, Wallet,
  PenLine, User, FileText, Users, Receipt, Award,
} from 'lucide-react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { useDocumentInventory } from '../../hooks/useDocumentInventory';
import type {
  CompletenessStatus,
  FormTypeGroup,
  FormEntry,
  NonIncomeSection,
} from '../../services/documentInventoryService';

// ─── Constants ─────────────────────────────────────

const FORM_TYPE_ICONS: Record<string, React.ReactNode> = {
  w2: <Building2 className="w-4 h-4" />,
  '1099nec': <Briefcase className="w-4 h-4" />,
  '1099k': <CircleDollarSign className="w-4 h-4" />,
  '1099int': <Landmark className="w-4 h-4" />,
  '1099div': <TrendingUp className="w-4 h-4" />,
  '1099r': <PiggyBank className="w-4 h-4" />,
  '1099g': <Landmark className="w-4 h-4" />,
  '1099misc': <FileSpreadsheet className="w-4 h-4" />,
  '1099b': <BarChart3 className="w-4 h-4" />,
  '1099da': <Coins className="w-4 h-4" />,
  ssa1099: <ShieldCheck className="w-4 h-4" />,
  k1: <FileSpreadsheet className="w-4 h-4" />,
  '1099sa': <HeartPulse className="w-4 h-4" />,
  w2g: <Wallet className="w-4 h-4" />,
  '1099c': <FileText className="w-4 h-4" />,
  '1099q': <FileText className="w-4 h-4" />,
  rental: <Home className="w-4 h-4" />,
  other: <Wallet className="w-4 h-4" />,
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  personal_info: <User className="w-4 h-4" />,
  filing_status: <FileText className="w-4 h-4" />,
  dependents: <Users className="w-4 h-4" />,
  deductions: <Receipt className="w-4 h-4" />,
  credits: <Award className="w-4 h-4" />,
};

const STATUS_COLORS: Record<CompletenessStatus, {
  icon: React.ReactNode;
  text: string;
  badgeBg: string;
  badgeText: string;
}> = {
  complete: {
    icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    text: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
  },
  partial: {
    icon: <Clock className="w-4 h-4 text-amber-400" />,
    text: 'text-amber-400',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
  },
  missing_required: {
    icon: <XCircle className="w-4 h-4 text-red-400" />,
    text: 'text-red-400',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-300',
  },
  not_entered: {
    icon: <AlertTriangle className="w-4 h-4 text-slate-400" />,
    text: 'text-slate-400',
    badgeBg: 'bg-slate-500/20',
    badgeText: 'text-slate-400',
  },
};

// ─── Main Panel ────────────────────────────────────

export default function DocumentInventoryPanel() {
  const inventory = useDocumentInventory();

  if (!inventory) {
    return (
      <div className="card mt-4 text-center py-8">
        <p className="text-slate-400">No tax return loaded.</p>
      </div>
    );
  }

  const {
    incomeGroups,
    pendingGroups,
    nonIncomeSections,
    overallCompleteness,
    totalFormsEntered,
    totalFormsPending,
  } = inventory;

  return (
    <div className="space-y-4 mt-4">
      {/* Overall progress */}
      <OverallProgressHeader
        completeness={overallCompleteness}
        formsEntered={totalFormsEntered}
        formsPending={totalFormsPending}
      />

      {/* Pending discovery alert */}
      {pendingGroups.length > 0 && (
        <PendingAlert groups={pendingGroups} />
      )}

      {/* Income form groups */}
      {incomeGroups.length > 0 ? (
        <div className="card">
          <h3 className="font-medium text-slate-200 mb-3">Income Forms</h3>
          <div className="space-y-0 divide-y divide-slate-700/50">
            {incomeGroups.map((group) => (
              <IncomeFormGroupCard key={group.formType} group={group} />
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-6">
          <p className="text-slate-400 text-sm">No income forms entered yet.</p>
          <p className="text-xs text-slate-500 mt-1">
            Start by going to Income Overview and selecting which forms you received.
          </p>
        </div>
      )}

      {/* Non-income sections */}
      <div className="card">
        <h3 className="font-medium text-slate-200 mb-3">Other Sections</h3>
        <div className="space-y-0 divide-y divide-slate-700/50">
          {nonIncomeSections.map((section) => (
            <NonIncomeSectionRow key={section.id} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Overall Progress ──────────────────────────────

function OverallProgressHeader({
  completeness,
  formsEntered,
  formsPending,
}: {
  completeness: number;
  formsEntered: number;
  formsPending: number;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-slate-200">Overall Completeness</h3>
        <span className="text-2xl font-bold text-white tabular-nums">{completeness}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-slate-700/50 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            completeness === 100
              ? 'bg-emerald-500'
              : completeness >= 60
                ? 'bg-telos-blue-500'
                : 'bg-amber-500'
          }`}
          style={{ width: `${completeness}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mt-3">
        <div className="text-xs text-slate-400">
          <span className="font-medium text-slate-200">{formsEntered}</span> forms entered
        </div>
        {formsPending > 0 && (
          <div className="text-xs text-amber-400">
            <span className="font-medium">{formsPending}</span> pending
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pending Discovery Alert ───────────────────────

function PendingAlert({ groups }: { groups: FormTypeGroup[] }) {
  const goToStep = useTaxReturnStore((s) => s.goToStep);

  return (
    <div className="rounded-xl border p-4 bg-amber-500/5 border-amber-500/20">
      <h3 className="font-medium text-amber-300 mb-3 flex items-center gap-2">
        <PenLine className="w-4 h-4" />
        Still need data
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        You indicated you received these forms but haven&apos;t entered the data yet.
      </p>
      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group.formType} className="flex items-center gap-3">
            <div className="text-slate-400 shrink-0">
              {FORM_TYPE_ICONS[group.formType] || <FileText className="w-4 h-4" />}
            </div>
            <span className="text-sm text-slate-400 flex-1">{group.formLabel}</span>
            <button
              onClick={() => goToStep(group.stepId)}
              className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors shrink-0"
            >
              Enter
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Income Form Group (Expandable) ────────────────

function IncomeFormGroupCard({ group }: { group: FormTypeGroup }) {
  const [isOpen, setIsOpen] = useState(false);
  const goToStep = useTaxReturnStore((s) => s.goToStep);

  const icon = FORM_TYPE_ICONS[group.formType] || <FileText className="w-4 h-4" />;
  const statusInfo = STATUS_COLORS[group.groupStatus];
  const hasEntries = group.count > 0;

  return (
    <div className="py-2.5">
      {/* Collapsed header — uses <div role="button"> to avoid nesting <button> inside <button> */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => hasEntries && setIsOpen(!isOpen)}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && hasEntries) { e.preventDefault(); setIsOpen(!isOpen); } }}
        className={`w-full flex items-center gap-3 text-left ${hasEntries ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="text-telos-orange-400 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-200">{group.formLabel}</span>
            {hasEntries && (
              <span className="text-xs text-slate-400">
                {group.count} {group.count === 1 ? 'form' : 'forms'}
              </span>
            )}
          </div>
        </div>

        {/* Key total */}
        {hasEntries && group.keyTotal !== 0 && (
          <span className="text-sm font-medium text-white tabular-nums shrink-0">
            ${group.keyTotal.toLocaleString()}
          </span>
        )}

        {/* Status icon */}
        <div className="shrink-0">{statusInfo.icon}</div>

        {/* Expand chevron */}
        {hasEntries && (
          <div className="shrink-0">
            {isOpen
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />
            }
          </div>
        )}

        {/* Enter button for empty pending groups */}
        {!hasEntries && (
          <button
            onClick={(e) => { e.stopPropagation(); goToStep(group.stepId); }}
            className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors shrink-0"
          >
            Enter
          </button>
        )}
      </div>

      {/* Expanded entries */}
      {isOpen && hasEntries && (
        <div className="mt-2 ml-7 space-y-1.5">
          {group.entries.map((entry) => (
            <FormEntryRow key={entry.id} entry={entry} stepId={group.stepId} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Form Entry Row ────────────────────────────────

function FormEntryRow({ entry, stepId }: { entry: FormEntry; stepId: string }) {
  const goToStep = useTaxReturnStore((s) => s.goToStep);
  const statusInfo = STATUS_COLORS[entry.status];

  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-800/50 border border-slate-700/40 px-3 py-2">
      <div className="shrink-0">{statusInfo.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 truncate">{entry.label}</p>
        {entry.missingRequired.length > 0 && (
          <p className="text-xs text-red-400 mt-0.5">
            Missing: {entry.missingRequired.join(', ')}
          </p>
        )}
        <p className="text-xs text-slate-500 mt-0.5">
          {entry.filledFields}/{entry.totalFields} fields
        </p>
      </div>
      <button
        onClick={() => goToStep(stepId)}
        className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors shrink-0"
      >
        Edit
      </button>
    </div>
  );
}

// ─── Non-Income Section Row ────────────────────────

function NonIncomeSectionRow({ section }: { section: NonIncomeSection }) {
  const goToStep = useTaxReturnStore((s) => s.goToStep);
  const statusInfo = STATUS_COLORS[section.status];
  const icon = SECTION_ICONS[section.id] || <FileText className="w-4 h-4" />;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="text-telos-blue-400 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-200">{section.label}</span>
          <div className="shrink-0">{statusInfo.icon}</div>
        </div>
        {section.summary.length > 0 && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {section.summary.join(' · ')}
          </p>
        )}
        {section.issues.length > 0 && (
          <p className="text-xs text-red-400 mt-0.5 truncate">
            {section.issues[0]}
            {section.issues.length > 1 && ` (+${section.issues.length - 1} more)`}
          </p>
        )}
      </div>
      <button
        onClick={() => goToStep(section.stepId)}
        className="text-xs text-telos-blue-400 hover:text-telos-blue-300 px-2 py-1 rounded border border-telos-blue-500/30 hover:border-telos-blue-500/50 transition-colors shrink-0"
      >
        {section.status === 'complete' ? 'View' : 'Edit'}
      </button>
    </div>
  );
}
