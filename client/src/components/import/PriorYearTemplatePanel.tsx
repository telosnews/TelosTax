/**
 * PriorYearTemplatePanel — "Import as Template" UI
 *
 * Shows items extracted from a prior-year TaxReturn with checkboxes.
 * Users select which payer/employer templates to import into the current year.
 * All amounts are zeroed — only names and structural data are carried over.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft, CheckCircle2, Copy, ChevronDown, ChevronUp,
  Briefcase, AlertTriangle,
} from 'lucide-react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { batchAddIncomeItems, getReturn } from '../../api/client';
import { toast } from 'sonner';
import type {
  TemplateImportManifest,
  TemplateItem,
  BusinessTemplate,
} from '../../services/priorYearTemplateBuilder';
import { getTypeLabel } from '../../services/priorYearTemplateBuilder';

interface PriorYearTemplatePanelProps {
  manifest: TemplateImportManifest;
  onBack: () => void;
  onDone: () => void;
}

/** Map income type to the API batch type and store field */
const IMPORT_TYPE_MAP: Record<string, { apiType: string; field: string; discoveryKey: string }> = {
  'w2':       { apiType: 'w2',       field: 'w2Income',       discoveryKey: 'w2' },
  '1099int':  { apiType: '1099int',  field: 'income1099INT',  discoveryKey: '1099int' },
  '1099div':  { apiType: '1099div',  field: 'income1099DIV',  discoveryKey: '1099div' },
  '1099r':    { apiType: '1099r',    field: 'income1099R',    discoveryKey: '1099r' },
  '1099nec':  { apiType: '1099nec',  field: 'income1099NEC',  discoveryKey: '1099nec' },
  '1099misc': { apiType: '1099misc', field: 'income1099MISC', discoveryKey: '1099misc' },
  '1099g':    { apiType: '1099g',    field: 'income1099G',    discoveryKey: '1099g' },
  '1099k':    { apiType: '1099k',    field: 'income1099K',    discoveryKey: '1099k' },
  '1099sa':   { apiType: '1099sa',   field: 'income1099SA',   discoveryKey: '1099sa' },
  '1099q':    { apiType: '1099q',    field: 'income1099Q',    discoveryKey: '1099q' },
};

// Type display order
const TYPE_ORDER = ['w2', '1099int', '1099div', '1099r', '1099nec', '1099misc', '1099g', '1099k', '1099sa', '1099q'];

export default function PriorYearTemplatePanel({
  manifest,
  onBack,
  onDone,
}: PriorYearTemplatePanelProps) {
  const { taxReturn, updateField } = useTaxReturnStore();
  const returnId = taxReturn?.id;

  // Local selection state (independent from manifest defaults)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(() => {
    const set = new Set<number>();
    manifest.items.forEach((_, i) => set.add(i));
    return set;
  });
  const [selectedBiz, setSelectedBiz] = useState<Set<number>>(() => {
    const set = new Set<number>();
    manifest.businesses.forEach((_, i) => set.add(i));
    return set;
  });
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(() => {
    // Expand all types by default
    return new Set(Object.keys(manifest.byType));
  });

  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const totalSelected = selectedItems.size + selectedBiz.size;

  // Precomputed index map: O(1) lookup instead of O(n) indexOf per item
  const itemIndexMap = useMemo(() => {
    const map = new Map<TemplateItem, number>();
    manifest.items.forEach((item, i) => map.set(item, i));
    return map;
  }, [manifest.items]);

  // ─── Toggle helpers ──────────────────────────────

  const toggleItem = useCallback((idx: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleBiz = useCallback((idx: number) => {
    setSelectedBiz(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleTypeGroup = useCallback((type: string) => {
    const groupItems = manifest.byType[type] || [];
    const groupIndices = groupItems.map(item => itemIndexMap.get(item) ?? -1);
    const allSelected = groupIndices.every(i => selectedItems.has(i));

    setSelectedItems(prev => {
      const next = new Set(prev);
      for (const i of groupIndices) {
        if (allSelected) next.delete(i);
        else next.add(i);
      }
      return next;
    });
  }, [manifest, selectedItems]);

  const toggleExpand = useCallback((type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedItems(new Set(manifest.items.map((_, i) => i)));
    setSelectedBiz(new Set(manifest.businesses.map((_, i) => i)));
  }, [manifest]);

  const selectNone = useCallback(() => {
    setSelectedItems(new Set());
    setSelectedBiz(new Set());
  }, []);

  // ─── Import handler ──────────────────────────────

  const handleImport = useCallback(() => {
    if (!returnId || !taxReturn || totalSelected === 0) return;
    setImporting(true);

    requestAnimationFrame(() => {
      try {
        let count = 0;
        const discoveryUpdates: Record<string, string> = {};

        // Group selected items by type for batch import
        const byType: Record<string, Record<string, unknown>[]> = {};
        for (const idx of selectedItems) {
          const item = manifest.items[idx];
          if (!item) continue;
          if (!byType[item.type]) byType[item.type] = [];
          byType[item.type].push(item.templateData);
        }

        for (const [type, items] of Object.entries(byType)) {
          const mapping = IMPORT_TYPE_MAP[type];
          if (!mapping) continue;

          const { count: added } = batchAddIncomeItems(returnId, mapping.apiType, items);
          count += added;
          discoveryUpdates[mapping.discoveryKey] = 'yes';
        }

        // Import selected businesses (accumulate all, write once to avoid stale closure)
        if (selectedBiz.size > 0) {
          const currentBusinesses = [...(taxReturn.businesses || [])];
          for (const idx of selectedBiz) {
            const biz = manifest.businesses[idx];
            if (!biz) continue;

            currentBusinesses.push({
              ...biz.templateData,
              id: crypto.randomUUID?.() || `biz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            } as never);
            count++;
          }
          updateField('businesses', currentBusinesses);
        }

        // Update income discovery
        if (Object.keys(discoveryUpdates).length > 0) {
          const discovery = { ...taxReturn.incomeDiscovery, ...discoveryUpdates };
          updateField('incomeDiscovery', discovery);
        }

        // Sync in-memory store with localStorage
        const freshReturn = getReturn(returnId);
        for (const [type] of Object.entries(byType)) {
          const mapping = IMPORT_TYPE_MAP[type];
          if (!mapping) continue;
          updateField(mapping.field, (freshReturn as unknown as Record<string, unknown>)[mapping.field] || []);
        }

        setImportedCount(count);
        setDone(true);
        toast.success(`${count} template${count !== 1 ? 's' : ''} imported — fill in this year's amounts`);
      } catch (err) {
        toast.error('Template import failed');
        console.error('Template import error:', err);
        setImporting(false);
      }
    });
  }, [returnId, taxReturn, totalSelected, selectedItems, selectedBiz, manifest, updateField]);

  // ─── Sorted types for display ────────────────────

  const sortedTypes = useMemo(() => {
    return TYPE_ORDER.filter(t => manifest.byType[t]?.length > 0);
  }, [manifest]);

  // ─── Done state ──────────────────────────────────

  if (done) {
    return (
      <div className="text-center py-6">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-slate-200 mb-1">Templates Imported</h3>
        <p className="text-sm text-slate-400 mb-4">
          {importedCount} item{importedCount !== 1 ? 's' : ''} created with $0 amounts from your {manifest.sourceYear} return.
          <br />
          Fill in this year&apos;s amounts on the income pages.
        </p>
        <button
          onClick={onDone}
          className="btn-primary"
        >
          Done
        </button>
      </div>
    );
  }

  // ─── Main panel ──────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="font-medium text-slate-200">Import as Template</h3>
          <p className="text-xs text-slate-400">
            Pre-fill this year with payer names from your {manifest.sourceYear} return (all amounts set to $0)
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-telos-blue-600/10 border border-telos-blue-600/20">
        <Copy className="w-4 h-4 text-telos-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300">
          Templates copy payer/employer names with zeroed amounts.
          You&apos;ll update the amounts when you reach each income page.
        </p>
      </div>

      {/* Select all / none */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">
          {totalSelected} of {manifest.totalCount + manifest.businesses.length} selected
        </span>
        <div className="flex gap-2">
          <button onClick={selectAll} className="text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
            Select All
          </button>
          <span className="text-slate-600">|</span>
          <button onClick={selectNone} className="text-xs text-slate-400 hover:text-white transition-colors">
            None
          </button>
        </div>
      </div>

      {/* Income items grouped by type */}
      {sortedTypes.map(type => {
        const group = manifest.byType[type];
        const expanded = expandedTypes.has(type);
        const groupIndices = group.map(item => itemIndexMap.get(item) ?? -1);
        const selectedCount = groupIndices.filter(i => selectedItems.has(i)).length;
        const allSelected = selectedCount === group.length;

        return (
          <div key={type} className="card bg-surface-800 border-slate-700 p-0 overflow-hidden">
            {/* Type group header */}
            <button
              onClick={() => toggleExpand(type)}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => { e.stopPropagation(); toggleTypeGroup(type); }}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border-slate-600 bg-surface-700 text-telos-blue-500 focus:ring-telos-blue-500 focus:ring-offset-0"
                />
                <span className="text-sm font-mono px-2 py-0.5 rounded bg-telos-blue-600/15 text-telos-blue-400 border border-telos-blue-600/20">
                  {getTypeLabel(type)}
                </span>
                <span className="text-sm text-slate-400">
                  {group.length} item{group.length !== 1 ? 's' : ''}
                </span>
                {selectedCount > 0 && selectedCount < group.length && (
                  <span className="text-xs text-slate-500">({selectedCount} selected)</span>
                )}
              </div>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Individual items */}
            {expanded && (
              <div className="border-t border-slate-700/50">
                {group.map((item, gi) => {
                  const idx = itemIndexMap.get(item) ?? -1;
                  const checked = selectedItems.has(idx);
                  return (
                    <label
                      key={gi}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700/20 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(idx)}
                        className="rounded border-slate-600 bg-surface-700 text-telos-blue-500 focus:ring-telos-blue-500 focus:ring-offset-0"
                      />
                      <span className={`text-sm ${checked ? 'text-slate-200' : 'text-slate-500'}`}>
                        {item.payerName}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Schedule C Businesses */}
      {manifest.businesses.length > 0 && (
        <div className="card bg-surface-800 border-slate-700 p-0 overflow-hidden">
          <div className="flex items-center gap-2 p-3">
            <Briefcase className="w-4 h-4 text-telos-blue-400" />
            <span className="text-sm font-medium text-slate-200">Schedule C Businesses</span>
            <span className="text-sm text-slate-400">
              {manifest.businesses.length} business{manifest.businesses.length !== 1 ? 'es' : ''}
            </span>
          </div>
          <div className="border-t border-slate-700/50">
            {manifest.businesses.map((biz, i) => {
              const checked = selectedBiz.has(i);
              return (
                <label
                  key={i}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700/20 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBiz(i)}
                    className="rounded border-slate-600 bg-surface-700 text-telos-blue-500 focus:ring-telos-blue-500 focus:ring-offset-0"
                  />
                  <span className={`text-sm ${checked ? 'text-slate-200' : 'text-slate-500'}`}>
                    {biz.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {manifest.totalCount === 0 && manifest.businesses.length === 0 && (
        <div className="text-center py-6">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            No recurring income items found in the {manifest.sourceYear} return.
          </p>
        </div>
      )}

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={importing || totalSelected === 0}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {importing ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Importing...
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Import {totalSelected} Template{totalSelected !== 1 ? 's' : ''}
          </>
        )}
      </button>
    </div>
  );
}
