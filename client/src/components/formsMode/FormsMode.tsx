/**
 * Forms Mode — PDF Viewer
 *
 * Renders either:
 * - The active form's interactive PdfFormViewer (when 0–1 forms selected)
 * - A read-only MergedPdfViewer (when 2+ forms selected in the sidebar)
 *
 * The sidebar is rendered separately by WizardLayout in the shared sidebar column.
 */
import '../../styles/pdfviewer.css';
import { useMemo, useEffect, useState } from 'react';
import PdfFormViewer from './PdfFormViewer';
import MergedPdfViewer from './MergedPdfViewer';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { ALL_TEMPLATES, generateSelectedFormsPDF } from '../../services/irsFormFiller';
import { FORM_1040_TEMPLATE } from '@telostax/engine';
import type { IRSFormTemplate } from '@telostax/engine';

/** Auto-generated lookup: formId → template. Single source of truth from ALL_TEMPLATES. */
const TEMPLATE_MAP: Record<string, IRSFormTemplate> = Object.fromEntries(
  ALL_TEMPLATES.map(t => [t.formId, t]),
);

export default function FormsMode() {
  const { taxReturn, calculation, activeFormId, activeInstanceIndex, selectedFormKeys } = useTaxReturnStore();
  const [mergedBytes, setMergedBytes] = useState<Uint8Array | null>(null);
  const [mergeState, setMergeState] = useState<'idle' | 'merging' | 'done' | 'error'>('idle');

  const activeTemplate = useMemo(() => {
    return TEMPLATE_MAP[activeFormId] ?? FORM_1040_TEMPLATE;
  }, [activeFormId]);

  // Stable serialized key so the effect only fires when the actual selection changes
  const selectionKey = useMemo(() => {
    return Array.from(selectedFormKeys).sort().join(',');
  }, [selectedFormKeys]);

  const showMerged = selectedFormKeys.size > 1;

  // Generate merged PDF when multi-selection changes
  useEffect(() => {
    if (!showMerged || !taxReturn || !calculation) {
      setMergedBytes(null);
      setMergeState('idle');
      return;
    }

    let cancelled = false;
    setMergeState('merging');

    // Read fresh selection from store to avoid stale closure
    const keys = useTaxReturnStore.getState().selectedFormKeys;
    const selections = Array.from(keys).map(key => {
      const [formId, idx] = key.split(':');
      return { formId, instanceIndex: Number(idx) };
    });

    generateSelectedFormsPDF(selections, taxReturn, calculation)
      .then(bytes => {
        if (!cancelled) {
          setMergedBytes(bytes);
          setMergeState('done');
        }
      })
      .catch(err => {
        console.error('[FormsMode] merge error:', err);
        if (!cancelled) {
          setMergedBytes(null);
          setMergeState('error');
        }
      });

    return () => { cancelled = true; };
  }, [selectionKey, showMerged, taxReturn, calculation]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!taxReturn || !calculation) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <p>Load a tax return to view forms.</p>
      </div>
    );
  }

  // Multi-select: show merged read-only viewer
  if (showMerged) {
    if (mergeState === 'merging') {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-telos-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">
              Merging {selectedFormKeys.size} forms...
            </p>
          </div>
        </div>
      );
    }

    if (mergeState === 'error' || !mergedBytes) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md px-6">
            <p className="text-red-400 font-medium mb-2">Failed to merge selected forms</p>
            <p className="text-sm text-slate-400">Try deselecting some forms and re-selecting, or use Print/Download instead.</p>
          </div>
        </div>
      );
    }

    return <MergedPdfViewer key={selectionKey} pdfBytes={mergedBytes} />;
  }

  // Single form: interactive viewer
  return (
    <PdfFormViewer
      key={`${activeFormId}-${activeInstanceIndex}`}
      template={activeTemplate}
      instanceIndex={activeInstanceIndex}
    />
  );
}
