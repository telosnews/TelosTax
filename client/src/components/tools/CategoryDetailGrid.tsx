/**
 * Category Detail Grid — Level 3 sub-categorization review.
 *
 * Pure React component. Shows transactions grouped by sub-category with:
 *   - Distinct section headings + clear total lines
 *   - Checkbox multi-select with batch reclassify toolbar
 *   - Per-row reclassify dropdown
 *   - AI-powered batch reclassify
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, CheckCircle2, ChevronDown, Check, FileText, Info } from 'lucide-react';
import type {
  CategorizedTransaction,
  TransactionCategory,
  TransactionSubCategory,
} from '../../services/transactionCategorizerTypes';
import {
  CATEGORY_META,
  SUB_CATEGORY_CONFIG,
} from '../../services/transactionCategorizerTypes';

// ─── Types ───────────────────────────────────────────

interface SubCategoryGroup {
  subCategory: TransactionSubCategory;
  label: string;
  formLine: string;
  deductibilityRate: number;
  transactions: CategorizedTransaction[];
  totalAmount: number;
}

interface Props {
  category: TransactionCategory;
  transactions: CategorizedTransaction[];
  onUpdateTransaction: (index: number, patch: Partial<CategorizedTransaction>) => void;
  onBack: () => void;
  onApproveAll: () => void;
  onApplyToReturn: () => void;
}

// ─── Component ───────────────────────────────────────

export default function CategoryDetailGrid({
  category,
  transactions,
  onUpdateTransaction,
  onBack,
  onApproveAll,
  onApplyToReturn,
}: Props) {
  const meta = CATEGORY_META[category];
  const config = SUB_CATEGORY_CONFIG[category];
  const subCatMeta = config?.meta ?? {};
  const subCatList = config?.subCategories ?? [];
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Group transactions by sub-category
  const groups = useMemo<SubCategoryGroup[]>(() => {
    const map = new Map<TransactionSubCategory, CategorizedTransaction[]>();
    for (const ct of transactions) {
      const existing = map.get(ct.subCategory);
      if (existing) existing.push(ct);
      else map.set(ct.subCategory, [ct]);
    }

    return Array.from(map.entries())
      .map(([subCat, txns]) => {
        const sm = subCatMeta[subCat];
        const totalAmount = txns.reduce((s, t) => s + Math.abs(t.transaction.amount), 0);
        return {
          subCategory: subCat,
          label: sm?.label ?? subCat,
          formLine: sm?.formLine ?? '',
          deductibilityRate: sm?.deductibilityRate ?? 1.0,
          transactions: txns,
          totalAmount,
        };
      })
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [transactions, subCatMeta]);

  const totalAmount = useMemo(
    () => groups.reduce((s, g) => s + g.totalAmount, 0),
    [groups],
  );
  const allApproved = transactions.every((t) => t.approved);

  // ─── Selection helpers ─────────────────────────────

  // Flat ordered list of transaction indices (follows group sort order) for shift+click ranges
  const orderedIndicesRef = useRef<number[]>([]);
  orderedIndicesRef.current = groups.flatMap((g) => g.transactions.map((t) => t.transactionIndex));
  const lastClickedRef = useRef<number | null>(null);

  /** Handle row click — supports shift+click for range selection. */
  const handleRowClick = useCallback((index: number, shiftKey: boolean) => {
    const ordered = orderedIndicesRef.current;

    if (shiftKey && lastClickedRef.current !== null) {
      // Range select: select everything between lastClicked and current
      const startPos = ordered.indexOf(lastClickedRef.current);
      const endPos = ordered.indexOf(index);
      if (startPos !== -1 && endPos !== -1) {
        const [lo, hi] = startPos < endPos ? [startPos, endPos] : [endPos, startPos];
        setSelectedIndices((prev) => {
          const next = new Set(prev);
          for (let i = lo; i <= hi; i++) {
            next.add(ordered[i]);
          }
          return next;
        });
      }
    } else {
      // Single toggle
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    }
    lastClickedRef.current = index;
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIndices(new Set(transactions.map((t) => t.transactionIndex)));
  }, [transactions]);

  const clearSelection = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const selectGroup = useCallback((group: SubCategoryGroup) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      for (const t of group.transactions) next.add(t.transactionIndex);
      return next;
    });
  }, []);

  const clearGroup = useCallback((group: SubCategoryGroup) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      for (const t of group.transactions) next.delete(t.transactionIndex);
      return next;
    });
  }, []);

  // ─── Batch reclassify ──────────────────────────────

  const handleBatchReclassify = useCallback((newSubCategory: TransactionSubCategory) => {
    const sm = subCatMeta[newSubCategory];
    for (const idx of selectedIndices) {
      onUpdateTransaction(idx, {
        subCategory: newSubCategory,
        formLine: sm ? `${meta.targetForm}, ${sm.formLine}` : undefined,
      });
    }
    setSelectedIndices(new Set());
  }, [selectedIndices, onUpdateTransaction, subCatMeta, meta.targetForm]);

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to categories
      </button>

      {/* Hero card */}
      <div className="rounded-xl border border-slate-700 bg-surface-800 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-lg font-semibold ${meta.color}`}>{meta.label}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {transactions.length} transactions &middot; {meta.targetForm}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">Total</div>
            <div className="text-xl font-bold text-white">
              ${Math.round(totalAmount).toLocaleString()}
            </div>
          </div>
        </div>

        {!allApproved ? (
          <button
            onClick={onApproveAll}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300
                       bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30
                       px-3 py-1.5 rounded transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approve all {transactions.length} transactions
          </button>
        ) : (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            All transactions approved
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="rounded-lg border border-slate-700/50 bg-surface-800/50 px-4 py-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-telos-blue-400 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-400 space-y-1">
          <p><span className="text-slate-300 font-medium">Click</span> any row to select it. <span className="text-slate-300 font-medium">Shift+click</span> to select a range.</p>
          <p>Use <span className="text-slate-300 font-medium">Move to...</span> to reclassify selected transactions in bulk, or change individual rows with the dropdown.</p>
        </div>
      </div>

      {/* Batch action bar — always visible */}
      <div className="sticky top-0 z-10 rounded-lg border border-slate-700 bg-surface-800
                      backdrop-blur-sm px-4 py-2.5 flex items-center gap-3 shadow-lg">
        <span className={`text-xs font-medium ${selectedIndices.size > 0 ? 'text-telos-blue-300' : 'text-slate-500'}`}>
          {selectedIndices.size > 0 ? `${selectedIndices.size} selected` : 'None selected'}
        </span>
        <div className="h-4 w-px bg-slate-600" />

        {/* Batch reclassify dropdown */}
        <div className="relative">
          <select
            className="bg-surface-700 border border-slate-600 rounded-md text-xs text-slate-300
                       pl-2.5 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-telos-blue-500
                       cursor-pointer hover:border-slate-500 transition-colors appearance-none
                       disabled:opacity-40 disabled:cursor-not-allowed"
            value=""
            disabled={selectedIndices.size === 0}
            onChange={(e) => {
              if (e.target.value) handleBatchReclassify(e.target.value as TransactionSubCategory);
            }}
          >
            <option value="" disabled>Move to...</option>
            {subCatList.map((sc) => {
              const scm = subCatMeta[sc];
              return <option key={sc} value={sc}>{scm?.label ?? sc}</option>;
            })}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
        </div>

        <div className="flex-1" />
        <button
          onClick={selectAll}
          className="text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
        >
          Select all
        </button>
        <button
          onClick={clearSelection}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Sub-category groups */}
      <div className="rounded-xl border border-slate-700 overflow-hidden">
        {/* Column header */}
        <div className="flex items-center px-4 py-3 bg-surface-900/80 border-b border-slate-700/50
                        text-xs text-slate-400 uppercase tracking-wide font-semibold">
          <div className="w-7 shrink-0" />
          <div className="flex-1 min-w-0">Description</div>
          <div className="w-14 text-center shrink-0">Date</div>
          <div className="w-20 text-right shrink-0">Amount</div>
          <div className="w-48 text-center shrink-0 pl-3">Sub-Category</div>
        </div>

        {groups.map((group, groupIdx) => (
          <SubCategorySection
            key={group.subCategory}
            group={group}
            isFirst={groupIdx === 0}
            targetForm={meta.targetForm}
            subCatMeta={subCatMeta}
            subCatList={subCatList}
            selectedIndices={selectedIndices}
            onRowClick={handleRowClick}
            onSelectGroup={selectGroup}
            onClearGroup={clearGroup}
            onUpdateTransaction={onUpdateTransaction}
          />
        ))}
      </div>

      {/* Apply to return */}
      {allApproved && (
        <div className="sticky bottom-0 pt-3 pb-2 bg-gradient-to-t from-surface-900 via-surface-900">
          <button
            onClick={onApplyToReturn}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                       bg-emerald-600 hover:bg-emerald-500 text-white font-semibold
                       shadow-lg shadow-emerald-600/20 transition-all"
          >
            <FileText className="w-4 h-4" />
            Apply ${Math.round(totalAmount).toLocaleString()} to my return
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Category Section ────────────────────────────

function SubCategorySection({
  group,
  isFirst,
  targetForm,
  subCatMeta,
  subCatList,
  selectedIndices,
  onRowClick,
  onSelectGroup,
  onClearGroup,
  onUpdateTransaction,
}: {
  group: SubCategoryGroup;
  isFirst: boolean;
  targetForm: string;
  subCatMeta: Partial<Record<TransactionSubCategory, import('../../services/transactionCategorizerTypes').SubCategoryMeta>>;
  subCatList: TransactionSubCategory[];
  selectedIndices: Set<number>;
  onRowClick: (index: number, shiftKey: boolean) => void;
  onSelectGroup: (group: SubCategoryGroup) => void;
  onClearGroup: (group: SubCategoryGroup) => void;
  onUpdateTransaction: (index: number, patch: Partial<CategorizedTransaction>) => void;
}) {
  const hasReducedRate = group.deductibilityRate < 1;

  return (
    <div>
      {/* ── Section heading ── */}
      <div
        className={`px-4 py-3 bg-surface-900/70 border-b border-slate-700/40 ${
          isFirst ? '' : 'border-t-2 border-t-slate-600/50'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h4 className="text-sm font-semibold text-slate-200">{group.label}</h4>
            {hasReducedRate && (
              <span className="text-[10px] text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded">
                {Math.round(group.deductibilityRate * 100)}% deductible
              </span>
            )}
            <span className="text-[10px] text-slate-500">
              {group.transactions.length} {group.transactions.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {group.formLine && (
              <span className="text-xs text-slate-500">{targetForm}, {group.formLine}</span>
            )}
            <button
              onClick={() => onSelectGroup(group)}
              className="text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              Select all
            </button>
            <button
              onClick={() => onClearGroup(group)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* ── Transaction rows ── */}
      {group.transactions.map((ct) => (
        <TransactionRow
          key={ct.transactionIndex}
          ct={ct}
          isSelected={selectedIndices.has(ct.transactionIndex)}
          targetForm={targetForm}
          subCatMeta={subCatMeta}
          subCatList={subCatList}
          onRowClick={onRowClick}
          onUpdateTransaction={onUpdateTransaction}
        />
      ))}

      {/* ── Total line ── */}
      <div className="flex items-center px-4 py-2.5 bg-surface-900/50 border-t border-slate-700/40">
        <div className="w-7 shrink-0" />
        <div className="flex-1 text-xs text-slate-400">
          <span className="font-medium">Total</span>
          <span className="text-slate-500 ml-1.5">
            &middot; {group.transactions.length} {group.transactions.length === 1 ? 'transaction' : 'transactions'}
          </span>
        </div>
        <div className="w-20 text-right shrink-0">
          <span className="text-sm font-semibold text-white">
            ${Math.round(group.totalAmount).toLocaleString()}
          </span>
        </div>
        <div className="w-48 shrink-0" />
      </div>
    </div>
  );
}

// ─── Transaction Row ─────────────────────────────────

function TransactionRow({
  ct,
  isSelected,
  targetForm,
  subCatMeta,
  subCatList,
  onRowClick,
  onUpdateTransaction,
}: {
  ct: CategorizedTransaction;
  isSelected: boolean;
  targetForm: string;
  subCatMeta: Partial<Record<TransactionSubCategory, import('../../services/transactionCategorizerTypes').SubCategoryMeta>>;
  subCatList: TransactionSubCategory[];
  onRowClick: (index: number, shiftKey: boolean) => void;
  onUpdateTransaction: (index: number, patch: Partial<CategorizedTransaction>) => void;
}) {
  const amount = Math.abs(ct.transaction.amount);
  const dateParts = ct.transaction.date.split('-');
  const shortDate = dateParts.length >= 3 ? `${dateParts[1]}/${dateParts[2]}` : ct.transaction.date;

  return (
    <div
      className={`flex items-center px-4 py-2 border-b border-slate-800/50 cursor-pointer select-none transition-colors ${
        isSelected ? 'bg-telos-blue-500/10' : 'hover:bg-surface-700/30'
      }`}
      onClick={(e) => onRowClick(ct.transactionIndex, e.shiftKey)}
    >
      {/* Checkbox */}
      <div className="w-7 shrink-0">
        <div
          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-telos-blue-500 border-telos-blue-500'
              : 'border-slate-600'
          }`}
        >
          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
        </div>
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <span className="text-xs text-slate-300 truncate block" title={ct.transaction.description}>
          {ct.transaction.description}
        </span>
      </div>

      {/* Date */}
      <div className="w-14 text-center shrink-0">
        <span className="text-xs text-slate-500 font-mono">{shortDate}</span>
      </div>

      {/* Amount */}
      <div className="w-20 text-right shrink-0">
        <span className="text-xs text-white font-mono">
          ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>

      {/* Reclassify dropdown */}
      <div className="w-48 shrink-0 pl-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <select
            className="w-full bg-transparent border border-slate-700/50 rounded-md text-[11px] text-slate-400
                       pl-2.5 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-telos-blue-500
                       focus:border-telos-blue-500 cursor-pointer hover:border-slate-500 hover:text-slate-300
                       transition-colors appearance-none"
            value={ct.subCategory}
            onChange={(e) => {
              const newSub = e.target.value as TransactionSubCategory;
              const sm = subCatMeta[newSub];
              onUpdateTransaction(ct.transactionIndex, {
                subCategory: newSub,
                formLine: sm ? `${targetForm}, ${sm.formLine}` : undefined,
              });
            }}
          >
            {subCatList.map((sc) => {
              const scm = subCatMeta[sc];
              return (
                <option key={sc} value={sc}>
                  {scm?.label ?? sc}
                </option>
              );
            })}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
