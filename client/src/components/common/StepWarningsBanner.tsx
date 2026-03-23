import { AlertTriangle } from 'lucide-react';
import { useWarnings } from '../../hooks/useWarnings';

interface StepWarningsBannerProps {
  stepId: string;
}

/**
 * Displays an amber warning banner at the top of a step when that step has
 * active validation warnings. Used on single-form steps (Expenses, Vehicle,
 * Home Office, etc.) where there are no individual item cards to badge.
 *
 * Renders nothing when the step has no warnings.
 */
export default function StepWarningsBanner({ stepId }: StepWarningsBannerProps) {
  const allWarnings = useWarnings();
  const stepWarnings = allWarnings.find((w) => w.stepId === stepId);

  if (!stepWarnings || stepWarnings.warnings.length === 0) return null;

  return (
    <div className="rounded-lg border p-4 mb-6 bg-amber-500/10 border-amber-500/30">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
        <div className="flex-1 min-w-0">
          {stepWarnings.warnings.length === 1 ? (
            <p className="text-sm text-amber-200">{stepWarnings.warnings[0].message}</p>
          ) : (
            <ul className="space-y-1.5">
              {stepWarnings.warnings.map((w, i) => (
                <li key={i} className="text-sm text-amber-200">{w.message}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
