import { useMemo } from 'react';
import { useTaxReturnStore } from '../store/taxReturnStore';
import { calculateForm1040, FilingStatus } from '@telostax/engine';
import { calculateTaxCalendar, type TaxCalendar } from '../services/taxCalendarService';

/**
 * Hook that computes tax calendar deadlines for the current tax return.
 * Computes a fresh calculation if the store doesn't have one yet,
 * so quarterly payment amounts are always available.
 * Memoized — only recomputes when taxReturn or calculation changes.
 */
export function useTaxCalendar(): TaxCalendar | null {
  const taxReturn = useTaxReturnStore((s) => s.taxReturn);
  const storeCalc = useTaxReturnStore((s) => s.calculation);

  return useMemo(() => {
    if (!taxReturn) return null;

    // Use store calculation if available, otherwise compute fresh
    const calculation = storeCalc ?? (() => {
      try {
        return calculateForm1040({
          ...taxReturn,
          filingStatus: taxReturn.filingStatus || FilingStatus.Single,
        });
      } catch {
        return undefined;
      }
    })();

    return calculateTaxCalendar(taxReturn, calculation ?? undefined);
  }, [taxReturn, storeCalc]);
}
