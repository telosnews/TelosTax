import { useMemo } from 'react';
import { useTaxReturnStore } from '../store/taxReturnStore';
import { getActiveWarnings, ValidationWarning, WarningsByStep } from '../services/warningService';

/**
 * Hook that computes all active validation warnings for the current tax return.
 * Memoized — only recomputes when taxReturn or calculation changes.
 *
 * Passes the CalculationResult to getActiveWarnings() so that plausibility
 * checks (WARN-level, from the shared engine) can use AGI for ratio-based
 * thresholds (e.g., charitable > 50% of AGI).
 */
export function useWarnings(): WarningsByStep[] {
  const taxReturn = useTaxReturnStore((s) => s.taxReturn);
  const calculation = useTaxReturnStore((s) => s.calculation);

  return useMemo(() => {
    if (!taxReturn) return [];
    return getActiveWarnings(taxReturn, calculation);
  }, [taxReturn, calculation]);
}

/**
 * Hook that returns warnings indexed by step ID for O(1) lookups.
 * Used by StepSidebar to check if a step has warnings.
 */
/**
 * Hook that returns per-item warnings for a specific step, indexed by item position.
 * Used by step components to show warning badges on individual item cards.
 *
 * Returns an empty Map when the step has no per-item warnings.
 */
export function useItemWarnings(stepId: string): Map<number, ValidationWarning[]> {
  const warnings = useWarnings();

  return useMemo(() => {
    const map = new Map<number, ValidationWarning[]>();
    const stepWarnings = warnings.find((w) => w.stepId === stepId);
    if (!stepWarnings) return map;
    for (const w of stepWarnings.warnings) {
      if (w.itemIndex != null) {
        const existing = map.get(w.itemIndex) || [];
        existing.push(w);
        map.set(w.itemIndex, existing);
      }
    }
    return map;
  }, [warnings, stepId]);
}

export function useWarningsByStepId(): Map<string, WarningsByStep> {
  const warnings = useWarnings();

  return useMemo(() => {
    const map = new Map<string, WarningsByStep>();
    for (const w of warnings) {
      map.set(w.stepId, w);
    }
    return map;
  }, [warnings]);
}
