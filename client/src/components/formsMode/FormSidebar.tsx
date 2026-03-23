/**
 * Forms Mode — Sidebar Navigation
 *
 * Lists all applicable IRS forms for the current return, grouped by category.
 * Highlights the active form and supports multi-instance forms (e.g., multiple Schedule Cs).
 *
 * Multi-select: store-backed Set<string> keyed "formId:instanceIndex".
 * When selections exist, print/download operate on the batch and the viewer
 * shows a merged read-only PDF; otherwise the active form is shown interactively.
 */
import { useMemo, useState, useCallback } from 'react';
import { FileText, ChevronRight, Download, Printer, Loader2, CheckSquare, Square, Search, X, Sparkles, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { useChatStore } from '../../store/chatStore';
import { ALL_TEMPLATES, fillIRSForm, generateSelectedFormsPDF } from '../../services/irsFormFiller';
import { searchForms, getFormCompleteness, buildFullReturnReviewPrompt } from '../../services/formsAIService';
import type { IRSFormTemplate } from '@telostax/engine';

/** Group labels for sidebar organization */
function getFormGroup(template: IRSFormTemplate): string {
  if (template.formId === 'f1040') return 'Your Return';
  if (template.formId.startsWith('f1040s')) return 'Schedules';
  return 'Additional Forms';
}

/** Build a selection key from formId + instanceIndex */
function selKey(formId: string, idx: number): string {
  return `${formId}:${idx}`;
}

export default function FormSidebar() {
  const {
    taxReturn, calculation,
    activeFormId, activeInstanceIndex, setActiveForm,
    selectedFormKeys, toggleFormSelection, selectAllForms, clearFormSelection,
  } = useTaxReturnStore();
  const { openWithPrompt } = useChatStore();
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeTemplate = useMemo(
    () => ALL_TEMPLATES.find(t => t.formId === activeFormId),
    [activeFormId],
  );

  const applicableTemplates = useMemo(() => {
    if (!taxReturn || !calculation) return [];
    return ALL_TEMPLATES.filter(t => t.condition(taxReturn, calculation));
  }, [taxReturn, calculation]);

  /** Search results — when query is active, only show matching forms */
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchForms(searchQuery, taxReturn, calculation);
  }, [searchQuery, taxReturn, calculation]);

  /** Map of "formId:instanceIndex" → FormCompleteness for badge rendering */
  const completenessMap = useMemo(() => {
    if (!taxReturn || !calculation) return new Map<string, ReturnType<typeof getFormCompleteness>>();
    const map = new Map<string, ReturnType<typeof getFormCompleteness>>();
    for (const t of applicableTemplates) {
      const count = t.instanceCount ? t.instanceCount(taxReturn, calculation) : 1;
      for (let i = 0; i < count; i++) {
        map.set(selKey(t.formId, i), getFormCompleteness(t, taxReturn, calculation, i));
      }
    }
    return map;
  }, [applicableTemplates, taxReturn, calculation]);

  /** All selectable keys (for Select All) */
  const allKeys = useMemo(() => {
    const keys: string[] = [];
    for (const t of applicableTemplates) {
      const count = (taxReturn && calculation && t.instanceCount)
        ? t.instanceCount(taxReturn, calculation)
        : 1;
      for (let i = 0; i < count; i++) keys.push(selKey(t.formId, i));
    }
    return keys;
  }, [applicableTemplates, taxReturn, calculation]);

  const allSelected = allKeys.length > 0 && allKeys.every(k => selectedFormKeys.has(k));

  const handleSelectAll = useCallback(() => {
    if (allSelected) clearFormSelection();
    else selectAllForms(allKeys);
  }, [allSelected, allKeys, selectAllForms, clearFormSelection]);

  /** Build selections array from the current Set for batch operations */
  const getSelections = useCallback(() => {
    return Array.from(selectedFormKeys).map(key => {
      const [formId, idx] = key.split(':');
      return { formId, instanceIndex: Number(idx) };
    });
  }, [selectedFormKeys]);

  /** Generate a filled, flattened PDF for the active form instance. */
  const generateSinglePdf = async () => {
    if (!activeTemplate || !taxReturn || !calculation) return null;
    const fields = activeTemplate.fieldsForInstance
      ? activeTemplate.fieldsForInstance(activeInstanceIndex, taxReturn, calculation)
      : activeTemplate.fields;
    return fillIRSForm({ ...activeTemplate, fields }, taxReturn, calculation);
  };

  const selCount = selectedFormKeys.size;

  const handleDownload = async () => {
    if (!taxReturn || !calculation) return;
    setDownloading(true);
    try {
      let pdfBytes: Uint8Array | null;
      let filename: string;

      if (selCount > 0) {
        pdfBytes = await generateSelectedFormsPDF(getSelections(), taxReturn, calculation);
        filename = 'TelosTax_Selected_Forms.pdf';
      } else {
        if (!activeTemplate) return;
        pdfBytes = await generateSinglePdf();
        const count = activeTemplate.instanceCount?.(taxReturn, calculation) ?? 1;
        const suffix = count > 1 ? `_${activeInstanceIndex + 1}` : '';
        filename = `${activeTemplate.displayName.replace(/\s+/g, '_')}${suffix}.pdf`;
      }

      if (!pdfBytes) return;
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`Downloaded ${filename}`);
    } catch (e) {
      console.error('[FormsMode] download error:', e);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    if (!taxReturn || !calculation) return;
    setPrinting(true);

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(
        '<html><head><title>Preparing print\u2026</title></head>' +
        '<body style="margin:0;background:#1e293b;color:#94a3b8;font-family:system-ui,sans-serif;' +
        'display:flex;justify-content:center;align-items:center;height:100vh">' +
        '<div style="text-align:center">' +
        '<div style="width:32px;height:32px;border:2px solid #60a5fa;border-top-color:transparent;' +
        'border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 12px"></div>' +
        '<p>Generating PDF\u2026</p></div>' +
        '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>' +
        '</body></html>',
      );
    }

    try {
      let pdfBytes: Uint8Array | null;
      let fallbackFilename: string;

      if (selCount > 0) {
        pdfBytes = await generateSelectedFormsPDF(getSelections(), taxReturn, calculation);
        fallbackFilename = 'TelosTax_Selected_Forms.pdf';
      } else {
        if (!activeTemplate) { win?.close(); return; }
        pdfBytes = await generateSinglePdf();
        const count = activeTemplate.instanceCount?.(taxReturn, calculation) ?? 1;
        const suffix = count > 1 ? `_${activeInstanceIndex + 1}` : '';
        fallbackFilename = `${activeTemplate.displayName.replace(/\s+/g, '_')}${suffix}.pdf`;
      }

      if (!pdfBytes) { win?.close(); return; }
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      if (win) {
        win.location.href = blobUrl;
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fallbackFilename;
        a.click();
        toast.info('Popup blocked — PDF downloaded instead. Open it to print.');
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
    } catch (e) {
      console.error('[FormsMode] print error:', e);
      toast.error('Failed to generate PDF for printing');
      win?.close();
    } finally {
      setPrinting(false);
    }
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, { template: IRSFormTemplate; instanceCount: number; searchReason?: string }[]>();
    const sourceTemplates = searchResults
      ? searchResults.map(r => ({ template: r.template, reason: r.reason }))
      : applicableTemplates.map(t => ({ template: t, reason: undefined }));
    for (const { template: t, reason } of sourceTemplates) {
      const group = searchResults ? 'Search Results' : getFormGroup(t);
      if (!groups.has(group)) groups.set(group, []);
      const count = (taxReturn && calculation && t.instanceCount)
        ? t.instanceCount(taxReturn, calculation)
        : 1;
      groups.get(group)!.push({ template: t, instanceCount: count, searchReason: reason });
    }
    return groups;
  }, [applicableTemplates, searchResults, taxReturn, calculation]);

  const groupOrder = searchResults ? ['Search Results'] : ['Your Return', 'Schedules', 'Additional Forms'];

  const printTitle = selCount > 0 ? `Print ${selCount} forms` : activeTemplate ? `Print ${activeTemplate.displayName}` : 'Print';
  const downloadTitle = selCount > 0 ? `Download ${selCount} forms` : activeTemplate ? `Download ${activeTemplate.displayName}` : 'Download';

  /** Render a compact completeness badge for a form item */
  const renderBadge = (formId: string, instanceIndex: number) => {
    const c = completenessMap.get(selKey(formId, instanceIndex));
    if (!c) return null;

    return (
      <span className="flex items-center gap-0.5 shrink-0 ml-auto">
        {c.hasIssues && (
          <span title="Has issues"><AlertTriangle className="w-3 h-3 text-yellow-400" /></span>
        )}
        {c.status === 'complete' && (
          <span title="Complete"><Check className="w-3 h-3 text-emerald-400" /></span>
        )}
        {c.status === 'partial' && (
          <span className="text-[10px] font-medium text-amber-400" title={`${c.filled}/${c.totalEditable} fields filled`}>
            {c.percent}%
          </span>
        )}
        {c.status === 'empty' && (
          <span className="text-[10px] text-slate-600" title="No fields filled">&mdash;</span>
        )}
      </span>
    );
  };

  return (
    <nav className="p-4" aria-label="Form navigation">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Forms</h2>
        {taxReturn && calculation && (
          <div className="flex items-center gap-1">
            {allKeys.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="text-[10px] text-slate-500 hover:text-telos-blue-400 transition-colors px-1"
              >
                {allSelected ? 'Clear' : 'Select All'}
              </button>
            )}
            <button
              onClick={handlePrint}
              disabled={printing || (selCount === 0 && !activeTemplate)}
              title={printTitle}
              className="p-1 rounded text-slate-400 hover:text-telos-blue-400 hover:bg-surface-700 transition-colors disabled:opacity-50"
            >
              {printing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Printer className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading || (selCount === 0 && !activeTemplate)}
              title={downloadTitle}
              className="p-1 rounded text-slate-400 hover:text-telos-blue-400 hover:bg-surface-700 transition-colors disabled:opacity-50"
            >
              {downloading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Search input */}
      <div className="relative mb-3">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search forms..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-7 pr-7 py-1.5 rounded-md bg-surface-700 border border-surface-600 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-telos-blue-500 focus:ring-1 focus:ring-telos-blue-500/30 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {groupOrder.map(groupName => {
        const items = grouped.get(groupName);
        if (!items?.length) return null;
        return (
          <div key={groupName} className="mb-4">
            <h3 className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5 px-2">
              {groupName}
            </h3>
            <ul className="space-y-0.5">
              {items.map(({ template, instanceCount, searchReason }) => {
                if (instanceCount <= 1) {
                  const key = selKey(template.formId, 0);
                  const isActive = template.formId === activeFormId && activeInstanceIndex === 0;
                  const isChecked = selectedFormKeys.has(key);
                  return (
                    <li key={template.formId}>
                      <div
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
                          isActive
                            ? 'bg-telos-blue-600/20 text-telos-blue-400 font-medium'
                            : isChecked
                              ? 'bg-telos-blue-600/10 text-slate-300'
                              : 'text-slate-300 hover:bg-surface-700 hover:text-white'
                        }`}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFormSelection(key); }}
                          className="shrink-0 text-slate-500 hover:text-telos-blue-400 transition-colors"
                          aria-label={`Select ${template.displayName}`}
                        >
                          {isChecked
                            ? <CheckSquare className="w-3.5 h-3.5 text-telos-blue-400" />
                            : <Square className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setActiveForm(template.formId, 0)}
                          className="flex items-center gap-2 min-w-0 flex-1"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{template.displayName}</span>
                          {renderBadge(template.formId, 0)}
                          {isActive && !searchResults && <ChevronRight className="w-3 h-3 shrink-0 text-telos-blue-400" />}
                        </button>
                      </div>
                      {searchReason && (
                        <p className="text-[10px] text-slate-500 px-8 -mt-0.5 mb-0.5 truncate">{searchReason}</p>
                      )}
                    </li>
                  );
                }

                // Multi-instance form
                return Array.from({ length: instanceCount }).map((_, idx) => {
                  const key = selKey(template.formId, idx);
                  const isActive = template.formId === activeFormId && idx === activeInstanceIndex;
                  const isChecked = selectedFormKeys.has(key);
                  return (
                    <li key={`${template.formId}-${idx}`}>
                      <div
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
                          isActive
                            ? 'bg-telos-blue-600/20 text-telos-blue-400 font-medium'
                            : isChecked
                              ? 'bg-telos-blue-600/10 text-slate-300'
                              : 'text-slate-300 hover:bg-surface-700 hover:text-white'
                        }`}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFormSelection(key); }}
                          className="shrink-0 text-slate-500 hover:text-telos-blue-400 transition-colors"
                          aria-label={`Select ${template.displayName} (${idx + 1})`}
                        >
                          {isChecked
                            ? <CheckSquare className="w-3.5 h-3.5 text-telos-blue-400" />
                            : <Square className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setActiveForm(template.formId, idx)}
                          className="flex items-center gap-2 min-w-0 flex-1"
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{template.displayName} ({idx + 1})</span>
                          {renderBadge(template.formId, idx)}
                          {isActive && !searchResults && <ChevronRight className="w-3 h-3 shrink-0 text-telos-blue-400" />}
                        </button>
                      </div>
                      {idx === 0 && searchReason && (
                        <p className="text-[10px] text-slate-500 px-8 -mt-0.5 mb-0.5 truncate">{searchReason}</p>
                      )}
                    </li>
                  );
                });
              })}
            </ul>
          </div>
        );
      })}

      {searchResults && searchResults.length === 0 && (
        <p className="text-sm text-slate-500 px-2">No forms match "{searchQuery}"</p>
      )}

      {!searchResults && applicableTemplates.length === 0 && (
        <p className="text-sm text-slate-500 px-2">No forms applicable yet. Fill in some data first.</p>
      )}

      {/* Review Entire Return button */}
      {taxReturn && calculation && !searchResults && applicableTemplates.length > 0 && (
        <div className="mt-4 pt-3 border-t border-surface-700">
          <button
            onClick={() => { const { message, context } = buildFullReturnReviewPrompt(taxReturn, calculation); openWithPrompt(message, context); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-telos-blue-400 bg-telos-blue-600/10 hover:bg-telos-blue-600/20 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Review Entire Return
          </button>
        </div>
      )}
    </nav>
  );
}
