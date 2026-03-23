/**
 * Forms Mode — Syncfusion PDF Viewer Wrapper
 *
 * Uses deferred initialization via requestAnimationFrame to survive React
 * StrictMode's mount→unmount→remount cycle. Without this, the first mount's
 * WASM worker gets destroyed mid-init, corrupting the global WASM state.
 */
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PdfViewer, Toolbar, Magnification, Navigation, FormFields, FormDesigner, Print, TextSearch } from '@syncfusion/ej2-pdfviewer';
import type { FormFieldFocusOutEventArgs, FormFieldClickArgs } from '@syncfusion/ej2-pdfviewer';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import type { IRSFormTemplate } from '@telostax/engine';
import { classifyFields } from '@telostax/engine';
import type { ClassifiedField } from '@telostax/engine';
import { populateFormFields, updateComputedFields, enforceReadOnlyDOM, pdfLibToNormalizedKey, normalizeSyncfusionName } from '../../services/formsModeFiller';
import { ensureDiscoveryFlags } from '../../services/formsModeSync';
import { resolveSourcePathFromLineId } from '../../services/traceFormLinker';
import { buildFieldExplainPrompt, buildFormReviewPrompt, getFormCompleteness } from '../../services/formsAIService';
import { resolveFieldValue } from '../../services/formFieldResolver';
import { useChatStore } from '../../store/chatStore';
import { MessageSquare, ClipboardCheck, Wand2, X, ChevronDown, Sparkles } from 'lucide-react';

PdfViewer.Inject(Toolbar, Magnification, Navigation, FormFields, FormDesigner, Print, TextSearch);

const RESOURCE_URL = `${window.location.origin}/ej2-pdfviewer-lib`;

/** Clears the current field highlight, if any. Set by focusFieldOnPdf. */
let clearCurrentHighlight: (() => void) | null = null;

/**
 * Navigate to a PDF field and highlight it with an amber outline.
 * The highlight persists until clearCurrentHighlight() is called
 * (triggered by clicking elsewhere on the PDF or selecting another field).
 */
function focusFieldOnPdf(
  viewer: PdfViewer,
  cf: ClassifiedField,
): void {
  // Clear any existing highlight first
  if (clearCurrentHighlight) {
    clearCurrentHighlight();
    clearCurrentHighlight = null;
  }

  // Try formFieldCollections first, then retrieveFormFields() as fallback
  let formFields = viewer.formFieldCollections;
  if (!formFields?.length) {
    try { formFields = viewer.retrieveFormFields(); } catch { /* noop */ }
  }
  if (!formFields?.length) return;

  const normalizedKey = pdfLibToNormalizedKey(cf.mapping.pdfFieldName);
  const pdfField = formFields.find(
    (ff) => normalizeSyncfusionName((ff as never as Record<string, string>).name) === normalizedKey,
  );
  if (!pdfField) return;

  const fieldId = (pdfField as never as Record<string, string>).id;

  // Navigate to the field's page (pageIndex is 0-based, goToPage is 1-based)
  const pageIndex = ((pdfField as never as Record<string, number>).pageIndex ?? 0);
  try {
    viewer.navigation.goToPage(pageIndex + 1);
  } catch { /* viewer may not support goToPage in all states */ }

  // Apply highlight via direct DOM styling after page navigation settles
  setTimeout(() => {
    if (!fieldId) return;
    const el =
      document.getElementById(fieldId + '_content_html_element') ||
      document.getElementById(fieldId + '_input_element') ||
      document.getElementById(fieldId);
    if (!el) return;

    const wrapper = el.closest('[style*="position"]') as HTMLElement || el.parentElement as HTMLElement || el;

    const prev = {
      outline: wrapper.style.outline,
      boxShadow: wrapper.style.boxShadow,
      transition: wrapper.style.transition,
    };

    wrapper.style.transition = 'outline 0.15s, box-shadow 0.15s';
    wrapper.style.outline = '3px solid #F59E0B';
    wrapper.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.5)';

    // Store cleanup function — called when user clicks elsewhere or selects another field
    clearCurrentHighlight = () => {
      wrapper.style.outline = prev.outline;
      wrapper.style.boxShadow = prev.boxShadow;
      setTimeout(() => { wrapper.style.transition = prev.transition; }, 200);
    };
  }, 300);
}

/**
 * Find a PDF field matching the given trace lineId and scroll/highlight it.
 * Uses the lineId→sourcePath mapping to locate the correct form field.
 */
function focusFieldByLineId(
  viewer: PdfViewer,
  lineId: string,
  classifiedFields: ClassifiedField[],
): void {
  const targetSourcePath = resolveSourcePathFromLineId(lineId);
  if (!targetSourcePath) return;

  const targetCf = classifiedFields.find(cf => cf.mapping.sourcePath === targetSourcePath);
  if (!targetCf) return;

  focusFieldOnPdf(viewer, targetCf);
}

interface PdfFormViewerProps {
  template: IRSFormTemplate;
  instanceIndex: number;
}

export default function PdfFormViewer({ template, instanceIndex }: PdfFormViewerProps) {
  const viewerRef = useRef<PdfViewer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { taxReturn, calculation, updateDeepField, updateField } = useTaxReturnStore();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const pdfUrl = `${window.location.origin}/irs-forms/${template.pdfFileName}`;

  const fields = useMemo(() => {
    if (!taxReturn || !calculation) return template.fields;
    if (template.fieldsForInstance) {
      return template.fieldsForInstance(instanceIndex, taxReturn, calculation);
    }
    return template.fields;
  }, [template, instanceIndex, taxReturn, calculation]);

  const classifiedFields = useMemo(() => classifyFields(fields), [fields]);

  // Key by normalized name so Syncfusion's reversed field names match our pdf-lib-style names.
  // pdfLibToNormalizedKey reverses segments + strips non-alphanumeric to match Syncfusion's format.
  const fieldMap = useMemo(() => {
    const map = new Map<string, ClassifiedField>();
    for (const cf of classifiedFields) {
      map.set(pdfLibToNormalizedKey(cf.mapping.pdfFieldName), cf);
    }
    return map;
  }, [classifiedFields]);

  // Deferred init: requestAnimationFrame ensures the callback only fires
  // AFTER StrictMode's first mount→unmount cycle completes. The cancelled
  // flag prevents viewer creation if cleanup runs before rAF fires.
  useEffect(() => {
    let cancelled = false;

    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el) return;

      const viewer = new PdfViewer({
        resourceUrl: RESOURCE_URL,
        documentPath: pdfUrl,
        enableFormFields: true,
        enableFormDesigner: true,
        enableAnnotation: false,
        toolbarSettings: {
          showTooltip: true,
          toolbarItems: ['PageNavigationTool', 'MagnificationTool', 'SearchOption', 'PrintTool', 'DownloadTool'] as never,
        },
        height: '100%',
        width: '100%',
        documentLoad: () => {
          setStatus('ready');
          const st = useTaxReturnStore.getState();
          if (st.taxReturn && st.calculation) {
            try {
              populateFormFields(viewer, template, st.taxReturn, st.calculation, classifiedFields);
            } catch (e) {
              console.error('[FormsMode] populate error:', e);
            }
            // Enforce read-only on computed fields after Syncfusion finishes rendering DOM
            setTimeout(() => {
              try { enforceReadOnlyDOM(viewer, classifiedFields); } catch { /* best-effort */ }
            }, 500);
          }
          // Focus the pending field if navigated from audit trail
          if (st.pendingFocusLineId) {
            focusFieldByLineId(viewer, st.pendingFocusLineId, classifiedFields);
            useTaxReturnStore.getState().clearPendingFocus();
          }
        },
        documentLoadFailed: () => {
          setStatus('error');
          setErrorMsg(`Failed to load ${template.displayName}. Check browser console.`);
        },
      });

      viewer.appendTo(el);
      viewerRef.current = viewer;
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch { /* ignore */ }
        viewerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bind form field edit handler
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.formFieldFocusOut = (args: FormFieldFocusOutEventArgs) => {
      if (!taxReturn || !args.fieldName || typeof args.fieldName !== 'string') return;
      const cf = fieldMap.get(normalizeSyncfusionName(args.fieldName));
      if (!cf || !cf.isEditable) return;

      const displayValue = args.value ?? '';

      if (cf.mapping.validate) {
        const err = cf.mapping.validate(displayValue, taxReturn);
        if (err) return;
      }

      let storageValue: unknown;
      if (cf.mapping.inverseTransform) {
        storageValue = cf.mapping.inverseTransform(displayValue, taxReturn);
        if (cf.mapping.formLabel?.startsWith('Line') && typeof storageValue === 'object' && storageValue !== null) {
          updateField('itemizedDeductions', storageValue);
          ensureDiscoveryFlags(template.formId, taxReturn, updateField);
          return;
        }
      } else if (cf.mapping.format === 'dollarNoCents' || cf.mapping.format === 'dollarCents' || cf.mapping.format === 'integer') {
        storageValue = Number(displayValue.replace(/[,$]/g, '')) || 0;
      } else if (cf.mapping.format === 'checkbox') {
        storageValue = displayValue === 'true';
      } else {
        storageValue = displayValue;
      }

      if (cf.writePath) {
        updateDeepField(cf.writePath, storageValue);
      }
      ensureDiscoveryFlags(template.formId, taxReturn, updateField);
    };
  }, [taxReturn, fieldMap, updateDeepField, updateField, template.formId]);

  // Reactive update of computed fields
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !taxReturn || !calculation) return;
    updateComputedFields(viewer, template, taxReturn, calculation, classifiedFields);
  }, [calculation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-enforce read-only DOM whenever Syncfusion re-renders form fields (zoom, page nav, etc.).
  // Uses MutationObserver to detect when Syncfusion rebuilds its DOM elements.
  useEffect(() => {
    const viewer = viewerRef.current;
    const container = containerRef.current;
    if (!viewer || !container || status !== 'ready') return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try { enforceReadOnlyDOM(viewer, classifiedFields); } catch { /* best-effort */ }
      }, 200);
    });

    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [status, classifiedFields]);

  // ─── AI Toolbar State ──────────────────────────────
  const { openWithPrompt, togglePanel, isOpen: chatOpen } = useChatStore();
  const [fieldSelectorOpen, setFieldSelectorOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const fieldSelectorRef = useRef<HTMLDivElement | null>(null);

  // ─── Clicked-field tooltip state ──────────────────
  const [clickedField, setClickedField] = useState<{ cf: ClassifiedField; x: number; y: number } | null>(null);
  const clickedFieldRef = useRef<HTMLDivElement | null>(null);

  // Bind formFieldClick — show "Explain with AI" tooltip on any field click.
  // Depends on `status` so this re-runs after the viewer finishes loading
  // (viewer is created inside requestAnimationFrame, so viewerRef.current is
  // null on the initial effect run).
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || status !== 'ready') return;
    viewer.formFieldClick = (args: FormFieldClickArgs) => {
      const fieldName = args.field?.name;
      console.log('[FormsMode] formFieldClick fired:', fieldName, args.field);
      if (!fieldName) return;
      const normalized = normalizeSyncfusionName(fieldName);
      const cf = fieldMap.get(normalized);
      console.log('[FormsMode] lookup:', normalized, '→', cf?.mapping.formLabel ?? 'NOT FOUND');
      if (!cf || !cf.mapping.formLabel) return;

      // Position tooltip near the clicked field using viewport coordinates (portaled to body)
      const container = containerRef.current;
      if (!container) return;

      const fieldEl =
        container.querySelector(`[id*="${fieldName}"]`) ||
        container.querySelector(`[name="${fieldName}"]`);

      if (fieldEl) {
        const rect = fieldEl.getBoundingClientRect();
        setClickedField({
          cf,
          x: Math.min(rect.right + 8, window.innerWidth - 300),
          y: rect.top,
        });
      } else {
        const containerRect = container.getBoundingClientRect();
        setClickedField({ cf, x: containerRect.left + 16, y: containerRect.top + 60 });
      }
    };
  }, [fieldMap, status]);

  // Dismiss tooltip on outside click
  useEffect(() => {
    if (!clickedField) return;
    const handler = (e: MouseEvent) => {
      if (clickedFieldRef.current && !clickedFieldRef.current.contains(e.target as Node)) {
        setClickedField(null);
      }
    };
    // Delay to avoid the same click that opened it from closing it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [clickedField]);

  // Close field selector when clicking outside
  useEffect(() => {
    if (!fieldSelectorOpen) return;
    const handler = (e: MouseEvent) => {
      if (fieldSelectorRef.current && !fieldSelectorRef.current.contains(e.target as Node)) {
        setFieldSelectorOpen(false);
        setFieldSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [fieldSelectorOpen]);

  // All labeled fields for the field selector — exclude PII fields
  const PII_PATTERNS = /\b(first name|last name|middle initial|address|city|town|state|zip|ssn|social security|identity protection pin|occupation|spouse.*name|phone|email|routing|account number)\b/i;
  const selectableFields = useMemo(() => {
    if (!taxReturn || !calculation) return [];
    return classifiedFields
      .filter(cf => cf.mapping.formLabel && !PII_PATTERNS.test(cf.mapping.formLabel))
      .map(cf => {
        const { displayValue, isChecked } = resolveFieldValue(cf.mapping, taxReturn, calculation);
        const value = cf.mapping.format === 'checkbox'
          ? (isChecked ? 'Checked' : '')
          : (displayValue || '');
        return {
          cf,
          label: cf.mapping.formLabel!,
          value,
          isEditable: cf.isEditable,
        };
      });
  }, [classifiedFields, taxReturn, calculation]);

  // Filtered fields based on search
  const filteredFields = useMemo(() => {
    if (!fieldSearch) return selectableFields;
    const q = fieldSearch.toLowerCase();
    return selectableFields.filter(f => f.label.toLowerCase().includes(q));
  }, [selectableFields, fieldSearch]);

  // Form completeness for "Fill Form" button visibility
  const completeness = useMemo(() => {
    if (!taxReturn || !calculation) return null;
    return getFormCompleteness(template, taxReturn, calculation, instanceIndex);
  }, [template, taxReturn, calculation, instanceIndex]);

  const handleAskAboutField = useCallback((cf: ClassifiedField) => {
    if (!taxReturn || !calculation) return;
    const { displayValue, isChecked } = resolveFieldValue(cf.mapping, taxReturn, calculation);
    const valueForPrompt = cf.mapping.format === 'checkbox'
      ? (isChecked ? 'Checked' : 'Unchecked')
      : (displayValue || undefined);
    const { message, context } = buildFieldExplainPrompt(template, cf, valueForPrompt);
    // Highlight the field on the PDF so the user can see which field was selected
    const viewer = viewerRef.current;
    if (viewer) focusFieldOnPdf(viewer, cf);
    setFieldSelectorOpen(false);
    setFieldSearch('');
    openWithPrompt(message, context);
  }, [template, taxReturn, calculation, openWithPrompt]);

  const handleReviewForm = useCallback(() => {
    if (!taxReturn || !calculation) return;
    const { message, context } = buildFormReviewPrompt(template, taxReturn, calculation, instanceIndex);
    openWithPrompt(message, context);
  }, [template, taxReturn, calculation, instanceIndex, openWithPrompt]);

  const handleFillForm = useCallback(() => {
    if (!taxReturn || !calculation || !completeness) return;
    const editableOnly = selectableFields.filter(f => f.isEditable);
    const emptyFields = editableOnly
      .filter(f => !f.value)
      .map(f => f.label);
    const filledFields = editableOnly
      .filter(f => f.value)
      .map(f => `${f.label}: ${f.value}`);

    const message = `Help me fill out **${template.displayName}** (${completeness.percent}% complete). Walk me through the empty fields.`;
    const context =
      `Form: ${template.displayName}\n` +
      `Completeness: ${completeness.filled}/${completeness.totalEditable} fields (${completeness.percent}%)\n\n` +
      (filledFields.length > 0
        ? `Already filled:\n${filledFields.map(f => `  ${f}`).join('\n')}\n\n`
        : '') +
      `Empty fields needing values:\n${emptyFields.map(f => `  ${f}`).join('\n')}`;
    openWithPrompt(message, context);
  }, [template, taxReturn, calculation, completeness, selectableFields, openWithPrompt]);

  const showFillButton = completeness != null && completeness.percent < 50;

  // Clear field highlight when clicking on the PDF background (not on a form field or the AI toolbar)
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Don't clear if clicking inside the AI toolbar area (z-30 overlay)
    const target = e.target as HTMLElement;
    if (target.closest('[class*="z-30"]') || target.closest('[class*="z-40"]')) return;
    if (clearCurrentHighlight) {
      clearCurrentHighlight();
      clearCurrentHighlight = null;
    }
  }, []);

  return (
    <div ref={containerRef} className="flex-1 min-w-0 min-h-0 relative" onClick={handleContainerClick}>
      {status === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-800 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-telos-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading {template.displayName}...</p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-800">
          <div className="text-center max-w-md px-6">
            <p className="text-red-400 font-medium mb-2">Failed to load form</p>
            <p className="text-sm text-slate-400">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* ─── Clicked-field "Ask TelosAI" tooltip (portaled to body for z-index) ──── */}
      {clickedField && createPortal(
        <div
          ref={clickedFieldRef}
          className="fixed z-[10000] animate-in fade-in slide-in-from-left-2 duration-150"
          style={{ left: clickedField.x, top: clickedField.y }}
        >
          <div className="bg-surface-700/95 backdrop-blur-md border border-surface-500 rounded-xl shadow-xl px-3 py-2.5 flex items-center gap-3">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-slate-300 truncate max-w-[200px]">
                {clickedField.cf.mapping.formLabel}
              </span>
              {(() => {
                if (!taxReturn || !calculation) return null;
                const { displayValue, isChecked } = resolveFieldValue(clickedField.cf.mapping, taxReturn, calculation);
                const val = clickedField.cf.mapping.format === 'checkbox'
                  ? (isChecked ? 'Checked' : 'Unchecked')
                  : displayValue;
                return val ? (
                  <span className="text-[10px] text-slate-500 truncate max-w-[200px]">{val}</span>
                ) : null;
              })()}
            </div>
            <button
              onClick={() => {
                handleAskAboutField(clickedField.cf);
                setClickedField(null);
              }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                         border border-transparent hover:border-telos-orange-500/50
                         bg-surface-600 hover:bg-surface-500
                         shadow-sm hover:shadow-md hover:shadow-black/20
                         transition-all duration-200"
            >
              <Sparkles size={12} className="text-telos-orange-400 ai-sparkle" />
              <span>Ask <span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">AI</span></span>
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* ─── AI Floating Toolbar — styled to match TelosAIButton ──── */}
      {status === 'ready' && taxReturn && calculation && (
        <div className="absolute bottom-6 right-6 z-30 flex flex-col items-end gap-2">
          {/* Field selector dropdown (renders above the toolbar) */}
          {fieldSelectorOpen && (
            <div
              ref={fieldSelectorRef}
              className="w-80 max-h-80 bg-surface-700/95 backdrop-blur-md border border-surface-500 rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-surface-500">
                <span className="text-xs font-medium text-slate-300">Select a field to ask about</span>
                <button
                  onClick={() => { setFieldSelectorOpen(false); setFieldSearch(''); }}
                  className="p-0.5 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="px-3 py-2 border-b border-surface-600">
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={fieldSearch}
                  onChange={e => setFieldSearch(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-500 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-telos-blue-400 transition-colors"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto flex-1 py-1">
                {filteredFields.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-slate-500 text-center">No matching fields</p>
                ) : (
                  filteredFields.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => handleAskAboutField(f.cf)}
                      className="w-full text-left px-3 py-2 hover:bg-surface-600 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-slate-200 group-hover:text-white truncate">{f.label}</span>
                        {!f.isEditable && (
                          <span className="shrink-0 text-[10px] text-slate-500 bg-surface-800 px-1.5 py-0.5 rounded">auto</span>
                        )}
                      </div>
                      {f.value ? (
                        <div className="text-xs text-slate-500 truncate mt-0.5">Current: {f.value}</div>
                      ) : (
                        <div className="text-xs text-amber-500/70 mt-0.5">Empty</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Toolbar pill — expands on hover to show action buttons */}
          <div className="group/toolbar flex items-center rounded-full
                          bg-surface-700 border border-slate-600/50
                          shadow-lg shadow-black/30
                          hover:shadow-xl hover:shadow-black/40
                          hover:border-telos-orange-500/40
                          transition-all duration-200 ease-out">
            {/* Action buttons — slide out on hover */}
            <div className="max-w-0 overflow-hidden whitespace-nowrap
                            opacity-0 group-hover/toolbar:max-w-[500px] group-hover/toolbar:opacity-100
                            transition-all duration-300 ease-out">
              <div className="flex items-center gap-1 pl-3">
                <button
                  onClick={() => { setFieldSelectorOpen(prev => !prev); setFieldSearch(''); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition-colors ${
                    fieldSelectorOpen
                      ? 'bg-telos-blue-500/20 text-telos-blue-300'
                      : 'text-slate-300 hover:bg-surface-600 hover:text-white'
                  }`}
                  title="Ask AI about a specific field"
                >
                  <span>Ask <span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">AI</span></span>
                  <ChevronDown size={14} className={`transition-transform ${fieldSelectorOpen ? 'rotate-180' : ''}`} />
                </button>

                <div className="w-px h-6 bg-slate-600/50" />

                <button
                  onClick={handleReviewForm}
                  className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold text-slate-300 hover:bg-surface-600 hover:text-white transition-colors"
                  title="AI review of this form"
                >
                  <ClipboardCheck size={16} />
                  <span>Review</span>
                </button>

                {showFillButton && (
                  <>
                    <div className="w-px h-6 bg-slate-600/50" />
                    <button
                      onClick={handleFillForm}
                      className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold text-amber-400 hover:bg-amber-500/15 hover:text-amber-300 transition-colors"
                      title={`Form is ${completeness!.percent}% complete — ask AI for help filling it`}
                    >
                      <Wand2 size={16} />
                      <span>Fill</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Sparkle icon — toggles chat panel */}
            <button
              onClick={togglePanel}
              className="flex items-center justify-center w-[60px] h-[60px] rounded-full
                         hover:bg-surface-600 transition-colors"
              aria-label={chatOpen ? 'Close AI chat' : 'Open AI chat'}
              title={chatOpen ? 'Close AI chat' : 'Open AI chat'}
            >
              <Sparkles className="w-7 h-7 text-telos-orange-400 ai-sparkle" />
            </button>
          </div>

          {/* Idle pulse animation */}
          <style>{`
            @keyframes aiSparkle {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.6; }
            }
            .ai-sparkle { animation: aiSparkle 3s ease-in-out infinite; }
            .group\\/toolbar:hover .ai-sparkle { animation: none; opacity: 1; }
          `}</style>
        </div>
      )}
    </div>
  );
}
