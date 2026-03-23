import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { useWarnings } from '../../hooks/useWarnings';
import { getTotalWarningCount } from '../../services/warningService';
import { useTaxReturnStore } from '../../store/taxReturnStore';

/**
 * Collapsible card that summarises all active validation warnings,
 * grouped by wizard step, with "Review" navigation links.
 *
 * Renders nothing when there are zero warnings.
 */
export default function WarningsSummaryCard() {
  const warnings = useWarnings();
  const { goToStep } = useTaxReturnStore();
  const [expanded, setExpanded] = useState(true);

  const totalCount = getTotalWarningCount(warnings);
  if (totalCount === 0) return null;

  return (
    <div className="rounded-xl border p-6 bg-amber-500/10 border-amber-500/30 mb-6">
      {/* Header — collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <h3 className="font-medium text-amber-300">Warnings to Review</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalCount} {totalCount === 1 ? 'warning' : 'warnings'} found across{' '}
              {warnings.length} {warnings.length === 1 ? 'step' : 'steps'}
            </p>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />
        }
      </button>

      {/* Expandable warning list */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-amber-500/20 pt-4">
          {warnings.map((stepWarnings) => (
            <div key={stepWarnings.stepId}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-slate-200">
                  {stepWarnings.stepLabel}
                  <span className="ml-2 text-xs text-slate-400">
                    ({stepWarnings.warnings.length})
                  </span>
                </h4>
                <button
                  onClick={() => goToStep(stepWarnings.stepId)}
                  className="flex items-center gap-1 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
                >
                  Review
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <ul className="space-y-1.5">
                {stepWarnings.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-amber-200/80 flex items-start gap-2">
                    <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                    <span>
                      {warning.itemLabel && (
                        <strong className="text-amber-100">{warning.itemLabel}: </strong>
                      )}
                      {warning.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
