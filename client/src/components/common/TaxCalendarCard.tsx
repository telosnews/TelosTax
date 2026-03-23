import { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, ExternalLink, Download } from 'lucide-react';
import { useTaxCalendar } from '../../hooks/useTaxCalendar';
import { formatDeadlineDate, type DeadlineStatus, type TaxDeadline } from '../../services/taxCalendarService';
import { downloadICS } from '../../services/icsExport';
import DeadlineCalendar from '../charts/DeadlineCalendar';

// ─── Color mapping per status ──────────────────────

const STATUS_STYLES: Record<DeadlineStatus, {
  dot: string;
  text: string;
  label: string;
}> = {
  overdue: { dot: 'bg-red-400', text: 'text-red-400', label: 'Overdue' },
  due_soon: { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Due Soon' },
  upcoming: { dot: 'bg-slate-400', text: 'text-slate-400', label: 'Upcoming' },
  completed: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Completed' },
};

// Group order for display
const STATUS_ORDER: DeadlineStatus[] = ['overdue', 'due_soon', 'upcoming', 'completed'];

// ─── Component ─────────────────────────────────────

export default function TaxCalendarCard({ alwaysOpen = false }: { alwaysOpen?: boolean }) {
  const calendar = useTaxCalendar();
  const [isOpen, setIsOpen] = useState(alwaysOpen);

  if (!calendar || calendar.deadlines.length === 0) return null;

  const { deadlines, nextDeadline } = calendar;

  // Count urgent items
  const urgentCount = deadlines.filter(d => d.status === 'overdue' || d.status === 'due_soon').length;

  // Group deadlines by status
  const grouped = STATUS_ORDER
    .map(status => ({
      status,
      label: STATUS_STYLES[status].label,
      items: deadlines.filter(d => d.status === status),
    }))
    .filter(g => g.items.length > 0);

  // Card color based on most urgent status
  const hasOverdue = deadlines.some(d => d.status === 'overdue');
  const hasDueSoon = deadlines.some(d => d.status === 'due_soon');
  const cardColor = hasOverdue
    ? 'bg-red-500/10 border-red-500/30'
    : hasDueSoon
      ? 'bg-amber-500/10 border-amber-500/30'
      : 'bg-telos-blue-600/10 border-telos-blue-600/30';

  const iconColor = hasOverdue
    ? 'text-red-400'
    : hasDueSoon
      ? 'text-amber-400'
      : 'text-telos-blue-400';

  return (
    <div className={`card mt-4 ${cardColor}`}>
      {/* Header — collapsible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Calendar className={`w-5 h-5 ${iconColor} shrink-0`} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-200">Tax Calendar & Deadlines</h3>
              {urgentCount > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  hasOverdue
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {urgentCount} {hasOverdue ? 'overdue' : 'due soon'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {nextDeadline
                ? `Next: ${nextDeadline.label} — ${formatDeadlineDate(nextDeadline.date)}`
                : 'No upcoming deadlines'
              }
            </p>
          </div>
        </div>
        {isOpen
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />
        }
      </button>

      {/* Expandable detail */}
      {isOpen && (
        <div className="mt-4 border-t border-slate-700/50 pt-4">
          {/* Calendar view */}
          <DeadlineCalendar
            deadlines={deadlines.filter(d => d.applicable).map(d => ({
              label: d.label,
              date: d.date,
              status: d.status,
              amount: d.amount,
            }))}
          />

          {/* Status legend */}
          <div className="flex flex-wrap gap-4 mb-4 px-1">
            {(['overdue', 'due_soon', 'upcoming', 'completed'] as const)
              .filter(s => deadlines.some(d => d.status === s))
              .map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm ${STATUS_STYLES[s].dot}`} />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">{STATUS_STYLES[s].label}</span>
                </div>
              ))
            }
          </div>

          {/* Deadline list */}
          <div className="space-y-4">
            {grouped.map(group => (
              <div key={group.status}>
                <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${STATUS_STYLES[group.status].text}`}>
                  {group.label}
                </h4>
                <div className="space-y-2">
                  {group.items.map(deadline => (
                    <DeadlineRow key={deadline.id} deadline={deadline} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer: export + IRS links */}
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-slate-700/30">
            <button
              onClick={() => downloadICS(deadlines)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-telos-blue-400 hover:text-telos-blue-300 transition-colors bg-telos-blue-500/10 hover:bg-telos-blue-500/20 px-3 py-1.5 rounded-lg border border-telos-blue-500/30"
            >
              <Download className="w-3.5 h-3.5" />
              Add to Calendar
            </button>
            <a
              href="https://www.irs.gov/payments/direct-pay"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              IRS Direct Pay
            </a>
            <a
              href="https://www.eftps.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              EFTPS
            </a>
            <a
              href="https://www.irs.gov/forms-pubs/about-form-4868"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Form 4868 (Extension)
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Deadline row ──────────────────────────────────

function DeadlineRow({ deadline }: { deadline: TaxDeadline }) {
  const styles = STATUS_STYLES[deadline.status];

  return (
    <div className="flex items-start gap-3 rounded-lg bg-surface-800/50 border border-slate-700/40 p-3">
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${styles.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium ${deadline.status === 'overdue' ? 'text-red-300' : deadline.status === 'completed' ? 'text-emerald-300 line-through' : 'text-slate-200'}`}>
            {deadline.label}
          </p>
          <span className={`text-xs shrink-0 ${styles.text}`}>
            {formatDeadlineDate(deadline.date)}
          </span>
        </div>
        {deadline.amount != null && deadline.amount > 0 && (
          <p className="text-sm font-semibold text-white mt-0.5">
            ${deadline.amount.toLocaleString()}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-0.5">{deadline.notes}</p>
      </div>
    </div>
  );
}
