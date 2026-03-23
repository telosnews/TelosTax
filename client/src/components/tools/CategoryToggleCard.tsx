/**
 * CategoryToggleCard — a single toggleable expense category row.
 *
 * Shows the category icon (in its CATEGORY_META color), label, description,
 * target form, and an on/off toggle switch. When auto-detected from the
 * return context, shows an "Auto-detected" badge.
 */

import {
  Briefcase, Home, Heart, Gift, GraduationCap, Baby, Car, PiggyBank,
  Landmark, Building2, TrendingUp, Building, ShieldPlus, BookOpen,
  Stethoscope, HelpCircle, User,
} from 'lucide-react';
import type { TransactionCategory, CategoryMeta } from '../../services/transactionCategorizerTypes';

/** Map CATEGORY_META icon string names to Lucide components. */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Briefcase, Home, Heart, Gift, GraduationCap, Baby, Car, PiggyBank,
  Landmark, Building2, TrendingUp, Building, ShieldPlus, BookOpen,
  Stethoscope, HelpCircle, User,
};

interface Props {
  category: TransactionCategory;
  meta: CategoryMeta;
  enabled: boolean;
  autoDetected: boolean;
  onChange: (enabled: boolean) => void;
}

export default function CategoryToggleCard({ category, meta, enabled, autoDetected, onChange }: Props) {
  const IconComponent = ICON_MAP[meta.icon] || HelpCircle;

  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
        enabled
          ? 'border-slate-600 bg-surface-700/50'
          : 'border-slate-700/50 bg-transparent hover:bg-surface-800/50'
      }`}
    >
      {/* Toggle switch */}
      <div className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
        enabled ? 'bg-telos-blue-500' : 'bg-slate-600'
      }`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </div>

      {/* Icon */}
      <IconComponent className={`w-4 h-4 shrink-0 ${enabled ? meta.color : 'text-slate-500'} transition-colors`} />

      {/* Category info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${enabled ? meta.color : 'text-slate-400'} transition-colors`}>
            {meta.label}
          </span>
          {autoDetected && enabled && (
            <span className="text-[9px] font-medium text-emerald-400/70 bg-emerald-400/10 px-1.5 py-0.5 rounded">
              Auto-detected
            </span>
          )}
        </div>
        {meta.targetForm && (
          <span className="text-[11px] text-slate-500">{meta.targetForm}</span>
        )}
      </div>
    </button>
  );
}
