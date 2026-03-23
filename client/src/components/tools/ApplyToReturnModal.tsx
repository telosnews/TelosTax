/**
 * Apply to Return Modal — preview and confirm before writing categorized
 * expenses to the tax return.
 *
 * Shows a diff of what will change (current → new value) for each field,
 * which discovery keys will be enabled, and a confirm/cancel button.
 */

import { useMemo } from 'react';
import { X, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { buildApplyPreview, type ApplyPreview, type FieldUpdate } from '../../services/categorizationApplier';
import type { CategorizedTransaction } from '../../services/transactionCategorizerTypes';

interface Props {
  transactions: CategorizedTransaction[];
  onConfirm: (preview: ApplyPreview) => void;
  onCancel: () => void;
}

export default function ApplyToReturnModal({ transactions, onConfirm, onCancel }: Props) {
  const taxReturn = useTaxReturnStore((s) => s.taxReturn);

  const preview = useMemo(() => {
    if (!taxReturn) return null;
    return buildApplyPreview(transactions, taxReturn);
  }, [transactions, taxReturn]);

  if (!preview) return null;

  const autoApplyUpdates = preview.updates.filter(u => u.path); // Have a field mapping
  const manualUpdates = preview.updates.filter(u => !u.path);   // Need manual entry

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg mx-4 rounded-xl bg-surface-800 border border-slate-700 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-600">
          <h2 className="text-base font-semibold text-slate-200">Apply to your return</h2>
          <button
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-surface-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Preview content */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          {/* Auto-apply section */}
          {autoApplyUpdates.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                Will be applied automatically
              </h3>
              <div className="space-y-2">
                {autoApplyUpdates.map((u) => (
                  <FieldUpdateRow key={u.path} update={u} />
                ))}
              </div>
            </div>
          )}

          {/* Manual section */}
          {manualUpdates.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-2">
                Needs manual entry
              </h3>
              <p className="text-xs text-slate-400 mb-2">
                These categories don't have a direct field mapping yet. Navigate to the relevant wizard step to enter these amounts.
              </p>
              <div className="space-y-2">
                {manualUpdates.map((u) => (
                  <FieldUpdateRow key={u.label} update={u} />
                ))}
              </div>
            </div>
          )}

          {/* Discovery keys */}
          {preview.discoveryKeysToEnable.length > 0 && (
            <div className="rounded-lg border border-telos-blue-500/20 bg-telos-blue-500/5 p-3">
              <p className="text-xs text-telos-blue-300">
                This will also enable {preview.discoveryKeysToEnable.length} wizard{' '}
                {preview.discoveryKeysToEnable.length === 1 ? 'step' : 'steps'} that{' '}
                {preview.discoveryKeysToEnable.length === 1 ? 'wasn\'t' : 'weren\'t'} previously visible.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-surface-600">
          <div className="text-sm text-slate-400">
            Total: <span className="text-emerald-400 font-semibold">${preview.totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="text-sm px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(preview)}
              className="text-sm px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md transition-colors"
            >
              <CheckCircle2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Apply to return
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldUpdateRow({ update }: { update: FieldUpdate }) {
  const isManual = !update.path;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
      isManual ? 'border-amber-500/20 bg-amber-500/5' : 'border-slate-700 bg-surface-900/50'
    }`}>
      <div className="min-w-0">
        <div className="text-sm text-slate-300">{update.label}</div>
        <div className="text-[10px] text-slate-500">
          {update.formLine} · {update.transactionCount} transaction{update.transactionCount !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {update.currentValue > 0 && (
          <>
            <span className="text-xs text-slate-500">${update.currentValue.toLocaleString()}</span>
            <ArrowRight className="w-3 h-3 text-slate-600" />
          </>
        )}
        <span className={`text-sm font-medium ${isManual ? 'text-amber-400' : 'text-emerald-400'}`}>
          ${update.newValue.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
