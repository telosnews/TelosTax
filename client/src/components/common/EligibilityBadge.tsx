import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';

type EligibilityStatus = 'eligible' | 'ineligible' | 'need_info';

interface EligibilityBadgeProps {
  status: EligibilityStatus;
  label?: string;
  amount?: number;
  detail?: string;
}

const CONFIG: Record<EligibilityStatus, { icon: typeof CheckCircle; color: string; bg: string; defaultLabel: string }> = {
  eligible: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    defaultLabel: 'Likely eligible',
  },
  ineligible: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    defaultLabel: 'Not eligible',
  },
  need_info: {
    icon: HelpCircle,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/20',
    defaultLabel: 'Need more info',
  },
};

export default function EligibilityBadge({ status, label, amount, detail }: EligibilityBadgeProps) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-lg border px-3 py-2 mt-3 ${cfg.bg}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 shrink-0 ${cfg.color}`} />
        <span className={`text-sm font-medium ${cfg.color}`}>
          {label || cfg.defaultLabel}
        </span>
        {amount !== undefined && amount > 0 && (
          <span className={`text-sm font-bold ${cfg.color} ml-auto tabular-nums`}>
            ${amount.toLocaleString()}
          </span>
        )}
      </div>
      {detail && (
        <p className="text-xs text-slate-400 mt-1 ml-6">{detail}</p>
      )}
    </div>
  );
}
