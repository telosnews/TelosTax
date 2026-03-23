import { toast } from 'sonner';
import { TaxReturn } from '@telostax/engine';
import { getReturn, writeReturn } from '../api/client';
import { useTaxReturnStore } from '../store/taxReturnStore';

interface DeleteItemOptions {
  returnId: string;
  /** Top-level TaxReturn field name (e.g., 'w2Income', 'itemizedDeductions') */
  fieldName: string;
  /** For nested arrays: key within the parent object (e.g., 'nonCashDonations') */
  nestedArrayKey?: string;
  /** The item being deleted (must have .id) */
  item: Record<string, unknown> & { id: string };
  /** Human-readable label for the toast (e.g., "W-2 from Acme Corp") */
  label: string;
  /** Cleanup callback — runs after delete (e.g., cancelForm if editing this item) */
  onCleanup?: () => void;
}

export function deleteItemWithUndo(opts: DeleteItemOptions): void {
  const { returnId, fieldName, nestedArrayKey, item, label, onCleanup } = opts;
  const snapshot = { ...item };

  // ── Delete ──
  const tr = getReturn(returnId);
  let updated: TaxReturn;

  if (nestedArrayKey) {
    const parent = (tr as any)[fieldName] || {};
    const arr = (parent[nestedArrayKey] ?? []) as any[];
    updated = {
      ...tr,
      [fieldName]: { ...parent, [nestedArrayKey]: arr.filter((i: any) => i.id !== item.id) },
      updatedAt: new Date().toISOString(),
    };
  } else {
    const arr = ((tr as any)[fieldName] ?? []) as any[];
    updated = {
      ...tr,
      [fieldName]: arr.filter((i: any) => i.id !== item.id),
      updatedAt: new Date().toISOString(),
    };
  }

  writeReturn(updated);
  useTaxReturnStore.getState().setReturn(getReturn(returnId));
  onCleanup?.();

  // ── Toast with Undo ──
  toast(`Deleted ${label}`, {
    action: {
      label: 'Undo',
      onClick: () => {
        const freshTr = getReturn(returnId);
        let restored: TaxReturn;

        if (nestedArrayKey) {
          const parent = (freshTr as any)[fieldName] || {};
          const arr = (parent[nestedArrayKey] ?? []) as any[];
          restored = {
            ...freshTr,
            [fieldName]: { ...parent, [nestedArrayKey]: [...arr, snapshot] },
            updatedAt: new Date().toISOString(),
          };
        } else {
          const arr = ((freshTr as any)[fieldName] ?? []) as any[];
          restored = {
            ...freshTr,
            [fieldName]: [...arr, snapshot],
            updatedAt: new Date().toISOString(),
          };
        }

        writeReturn(restored);
        useTaxReturnStore.getState().setReturn(getReturn(returnId));
        toast.success(`Restored ${label}`);
      },
    },
    duration: 6000,
  });
}
