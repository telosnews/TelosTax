import { useMemo } from 'react';
import { useTaxReturnStore } from '../store/taxReturnStore';
import { buildDocumentInventory, DocumentInventory } from '../services/documentInventoryService';

/**
 * Hook that computes the document inventory for the current tax return.
 * Memoized — only recomputes when taxReturn changes.
 *
 * Unlike useAuditRisk, this does NOT require `calculation` — it only
 * needs the raw taxReturn data to assess completeness.
 */
export function useDocumentInventory(): DocumentInventory | null {
  const taxReturn = useTaxReturnStore((s) => s.taxReturn);

  return useMemo(() => {
    if (!taxReturn) return null;
    return buildDocumentInventory(taxReturn);
  }, [taxReturn]);
}
