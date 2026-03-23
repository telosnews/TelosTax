import { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, CheckCircle, Lightbulb } from 'lucide-react';
import { useAuditRisk } from '../../hooks/useAuditRisk';
import type { RiskLevel, RiskCategory, RiskFactor } from '../../services/auditRiskService';
import AuditRiskGauge from '../charts/AuditRiskGauge';

// ─── Color mapping per risk level ──────────────────────

const LEVEL_COLORS: Record<RiskLevel, {
  card: string;
  badge: string;
  badgeText: string;
  icon: string;
}> = {
  low: {
    card: 'bg-emerald-500/10 border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300',
    badgeText: 'Low',
    icon: 'text-emerald-400',
  },
  moderate: {
    card: 'bg-telos-blue-600/10 border-telos-blue-600/30',
    badge: 'bg-telos-blue-600/20 text-telos-blue-300',
    badgeText: 'Moderate',
    icon: 'text-telos-blue-400',
  },
  elevated: {
    card: 'bg-amber-500/10 border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300',
    badgeText: 'Elevated',
    icon: 'text-amber-400',
  },
  high: {
    card: 'bg-red-500/10 border-red-500/30',
    badge: 'bg-red-500/20 text-red-300',
    badgeText: 'High',
    icon: 'text-red-400',
  },
};

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  income: 'Income Factors',
  deduction: 'Deduction Factors',
  credit: 'Credit Factors',
  structural: 'Return Characteristics',
};

const CATEGORY_ORDER: RiskCategory[] = ['income', 'deduction', 'credit', 'structural'];

// ─── Component ─────────────────────────────────────────

export default function AuditRiskCard({ alwaysOpen = false }: { alwaysOpen?: boolean }) {
  const assessment = useAuditRisk();
  const [isOpen, setIsOpen] = useState(alwaysOpen);

  if (!assessment) return null;

  const { level, triggeredFactors, summary } = assessment;
  const colors = LEVEL_COLORS[level];

  // Group triggered factors by category
  const grouped = CATEGORY_ORDER
    .map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      factors: triggeredFactors.filter((f) => f.category === cat),
    }))
    .filter((g) => g.factors.length > 0);

  return (
    <div className={`rounded-xl border p-6 mt-4 ${colors.card}`}>
      {/* Header — collapsible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Shield className={`w-5 h-5 ${colors.icon} shrink-0`} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-200">Audit Risk Assessment</h3>
              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${colors.badge}`}>
                {colors.badgeText}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {triggeredFactors.length === 0
                ? 'No risk factors identified'
                : `${triggeredFactors.length} factor${triggeredFactors.length !== 1 ? 's' : ''} identified`
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
          {/* Summary */}
          <p className="text-sm text-slate-300 mb-4">{summary}</p>

          {/* Gauge visualization */}
          {triggeredFactors.length > 0 && (
            <AuditRiskGauge score={assessment.score} maxScore={assessment.maxPossibleScore} level={level} />
          )}

          {/* Low risk with no factors — success state */}
          {triggeredFactors.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
              <p className="text-sm">No significant risk factors identified. Standard recordkeeping is sufficient.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map((group) => (
                <div key={group.category}>
                  <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2 tracking-wide">
                    {group.label}
                  </h4>
                  <div className="space-y-3">
                    {group.factors.map((factor) => (
                      <FactorDetail key={factor.id} factor={factor} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-slate-400 mt-4">
            This assessment is informational only and does not constitute tax advice. Actual IRS audit selection
            uses proprietary Discriminant Information Function (DIF) scoring not publicly available.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Factor detail row ─────────────────────────────────

function FactorDetail({ factor }: { factor: RiskFactor }) {
  return (
    <div className="rounded-lg bg-surface-800/50 border border-slate-700/40 p-3">
      <p className="text-sm font-medium text-slate-200">{factor.label}</p>
      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{factor.explanation}</p>
      <div className="flex items-start gap-1.5 mt-2">
        <Lightbulb className="w-3.5 h-3.5 text-telos-orange-400 shrink-0 mt-0.5" />
        <p className="text-xs text-telos-orange-300/80">{factor.mitigation}</p>
      </div>
    </div>
  );
}
