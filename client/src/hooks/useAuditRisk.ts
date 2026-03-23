import { useMemo } from 'react';
import { useTaxReturnStore } from '../store/taxReturnStore';
import { assessAuditRisk, AuditRiskAssessment } from '../services/auditRiskService';

/**
 * Hook that computes the audit risk assessment for the current tax return.
 * Memoized — only recomputes when taxReturn or calculation changes.
 */
export function useAuditRisk(): AuditRiskAssessment | null {
  const taxReturn = useTaxReturnStore((s) => s.taxReturn);
  const calculation = useTaxReturnStore((s) => s.calculation);

  return useMemo(() => {
    if (!taxReturn || !calculation) return null;
    return assessAuditRisk(taxReturn, calculation);
  }, [taxReturn, calculation]);
}
