/**
 * NudgeCard — proactive AI suggestion card.
 *
 * Wraps CalloutCard styling with actions: Enable & Go, Ask AI, Dismiss.
 * Used by StepNudgesBanner to surface deterministically-gated suggestions.
 */

import { Sparkles, ChevronRight, X, CheckCircle } from 'lucide-react';
import type { ProactiveNudge } from '../../services/nudgeService';

interface NudgeCardProps {
  nudge: ProactiveNudge;
  onEnableAndGo: (nudge: ProactiveNudge) => void;
  onAskAI: (nudge: ProactiveNudge) => void;
  onDismiss: (id: string) => void;
}

const VARIANT_STYLES = {
  tip: 'bg-telos-orange-500/10 border-telos-orange-500/20',
  info: 'bg-telos-blue-600/10 border-telos-blue-600/30',
} as const;

export default function NudgeCard({ nudge, onEnableAndGo, onAskAI, onDismiss }: NudgeCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${VARIANT_STYLES[nudge.variant]} animate-in fade-in slide-in-from-top-2 duration-300`}>
      <div className="flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-telos-orange-400" />
        <div className="flex-1 min-w-0">
          {/* Title row with benefit badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">{nudge.title}</span>
            {nudge.estimatedBenefit != null && nudge.estimatedBenefit > 0 && (
              <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                ~${nudge.estimatedBenefit.toLocaleString()}
              </span>
            )}
            {nudge.priority === 'high' && (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">{nudge.description}</p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            {nudge.discoveryKey && nudge.stepId && (
              <button
                onClick={() => onEnableAndGo(nudge)}
                className="flex items-center gap-1 text-xs font-medium text-telos-blue-400 hover:text-telos-blue-300
                           bg-telos-blue-500/10 hover:bg-telos-blue-500/20 border border-telos-blue-500/30
                           px-2.5 py-1.5 rounded transition-colors"
              >
                Enable
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => onAskAI(nudge)}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full
                         border border-transparent hover:border-telos-orange-500/50
                         bg-surface-700 hover:bg-surface-600
                         transition-all duration-200"
            >
              <Sparkles size={11} className="text-telos-orange-400" />
              <span>Ask <span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">AI</span></span>
            </button>
          </div>
        </div>

        {/* Dismiss button */}
        {nudge.dismissible && (
          <button
            onClick={() => onDismiss(nudge.id)}
            className="shrink-0 p-1 text-slate-500 hover:text-slate-300 transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
