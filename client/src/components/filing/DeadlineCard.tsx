/**
 * DeadlineCard — Countdown timer to the filing deadline.
 *
 * Extracted from FilingInstructionsStep for reuse between
 * the Filing Options hub and the PaperMailingPanel.
 *
 * Extension-aware: when extensionFiled is true, counts down
 * to October 15 instead of April 15.
 */
import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, ShieldCheck } from 'lucide-react';

// April 15, 2026 at 11:59:59 PM local time
const APRIL_DEADLINE = new Date(2026, 3, 15, 23, 59, 59);
// October 15, 2026 at 11:59:59 PM local time
const OCTOBER_DEADLINE = new Date(2026, 9, 15, 23, 59, 59);

function getTimeRemaining(deadline: Date) {
  const now = Date.now();
  const diff = deadline.getTime() - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, expired: false };
}

interface DeadlineCardProps {
  deadline: string;
  extensionFiled?: boolean;
}

export default function DeadlineCard({ deadline, extensionFiled }: DeadlineCardProps) {
  const targetDate = extensionFiled ? OCTOBER_DEADLINE : APRIL_DEADLINE;
  const displayDeadline = extensionFiled ? 'October 15, 2026' : deadline;

  const [remaining, setRemaining] = useState(() => getTimeRemaining(targetDate));

  useEffect(() => {
    const id = setInterval(() => setRemaining(getTimeRemaining(targetDate)), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const isUrgent = remaining.days < 7 && !remaining.expired;

  const borderColor = remaining.expired
    ? 'bg-red-500/10 border-red-500/30'
    : extensionFiled
      ? 'bg-emerald-500/10 border-emerald-500/30'
      : 'bg-telos-blue-600/10 border-telos-blue-600/30';

  const iconColor = remaining.expired
    ? 'text-red-400'
    : extensionFiled
      ? 'text-emerald-400'
      : 'text-telos-blue-400';

  const titleColor = remaining.expired
    ? 'text-red-300'
    : extensionFiled
      ? 'text-emerald-300'
      : 'text-telos-blue-300';

  return (
    <div className={`rounded-xl border p-6 ${borderColor}`}>
      <div className="flex items-center gap-3">
        <Calendar className={`w-6 h-6 shrink-0 ${iconColor}`} />
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-base font-semibold ${titleColor}`}>Filing deadline: </span>
          <span className="text-base text-slate-200">{displayDeadline}</span>
          {extensionFiled && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3" />
              Extension filed
            </span>
          )}
        </div>
      </div>

      {/* Countdown */}
      <div className="mt-3 flex items-center gap-2">
        <Clock className={`w-4 h-4 shrink-0 ${remaining.expired ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-slate-400'}`} />
        {remaining.expired ? (
          <span className="text-sm font-medium text-red-400">The filing deadline has passed.</span>
        ) : (
          <div className="flex items-baseline gap-3">
            <CountdownUnit value={remaining.days} label="days" urgent={isUrgent} />
            <span className="text-slate-600">:</span>
            <CountdownUnit value={remaining.hours} label="hrs" urgent={isUrgent} />
            <span className="text-slate-600">:</span>
            <CountdownUnit value={remaining.minutes} label="min" urgent={isUrgent} />
            <span className="text-slate-600">:</span>
            <CountdownUnit value={remaining.seconds} label="sec" urgent={isUrgent} />
          </div>
        )}
      </div>
    </div>
  );
}

function CountdownUnit({ value, label, urgent }: { value: number; label: string; urgent: boolean }) {
  return (
    <span className="text-center">
      <span className={`text-lg font-bold tabular-nums ${urgent ? 'text-amber-400' : 'text-white'}`}>
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] text-slate-400 ml-0.5">{label}</span>
    </span>
  );
}
