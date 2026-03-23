/**
 * Transaction Categorizer View — AI-powered transaction classification dashboard.
 *
 * Shown inside the ExpenseScannerToolView when AI categorization results are available.
 * Provides:
 *   - Summary cards per category (total amount, transaction count)
 *   - Expandable category groups with individual transactions
 *   - Checkbox multi-select with batch reclassify toolbar
 *   - Shift+click range selection
 *   - Individual reclassify dropdown per row
 *   - Drill-down into sub-categories for business expenses
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronRight, Sparkles, Check,
  FileText, Table2,
  Briefcase, Home, Heart, Gift, GraduationCap, Baby, Car, PiggyBank,
  Landmark, Building2, TrendingUp, Building, ShieldPlus, BookOpen,
  Stethoscope, HelpCircle, User,
} from 'lucide-react';
import type {
  CategorizationResult,
  CategorizedTransaction,
  CategorySummary,
  TransactionCategory,
} from '../../services/transactionCategorizerTypes';
import { CATEGORY_META } from '../../services/transactionCategorizerTypes';
import CategoryDetailGrid from './CategoryDetailGrid';

/** Map CATEGORY_META icon names to Lucide components. */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Briefcase, Home, Heart, Gift, GraduationCap, Baby, Car, PiggyBank,
  Landmark, Building2, TrendingUp, Building, ShieldPlus, BookOpen,
  Stethoscope, HelpCircle, User,
};

interface Props {
  result: CategorizationResult;
  onApproveCategory: (category: string) => void;
  onUpdateTransaction: (index: number, patch: Partial<CategorizedTransaction>) => void;
  onApplyToReturn: () => void;
}

/** Categories that support Level 3 sub-categorization drill-down. */
const DRILLDOWN_CATEGORIES = new Set<TransactionCategory>([
  'business_expense', 'home_office', 'vehicle', 'charitable', 'salt', 'tax_payment',
]);

// ─── Main View ─────────────────────────────────────

export default function TransactionCategorizerView({
  result,
  onApproveCategory,
  onUpdateTransaction,
  onApplyToReturn,
}: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [drillDownCategory, setDrillDownCategory] = useState<TransactionCategory | null>(null);

  // ─── Selection state ──────────────────────────────
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Flat ordered list of visible transaction indices for shift+click
  const orderedIndicesRef = useRef<number[]>([]);

  // Build ordered indices from expanded category (only those visible)
  const expandedTxns = useMemo(() => {
    if (!expandedCategory) return [];
    return result.transactions.filter(t => t.category === expandedCategory);
  }, [expandedCategory, result.transactions]);

  // Update ref on every render
  orderedIndicesRef.current = expandedTxns.map(t => t.transactionIndex);

  const lastClickedRef = useRef<number | null>(null);

  const handleRowClick = useCallback((index: number, shiftKey: boolean) => {
    const ordered = orderedIndicesRef.current;

    if (shiftKey && lastClickedRef.current !== null) {
      const startPos = ordered.indexOf(lastClickedRef.current);
      const endPos = ordered.indexOf(index);
      if (startPos !== -1 && endPos !== -1) {
        const [lo, hi] = startPos < endPos ? [startPos, endPos] : [endPos, startPos];
        setSelectedIndices((prev) => {
          const next = new Set(prev);
          for (let i = lo; i <= hi; i++) next.add(ordered[i]);
          return next;
        });
      }
    } else {
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    }
    lastClickedRef.current = index;
  }, []);

  const selectAllInCategory = useCallback((categoryTxns: CategorizedTransaction[]) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      for (const t of categoryTxns) next.add(t.transactionIndex);
      return next;
    });
  }, []);

  const clearCategorySelection = useCallback((categoryTxns: CategorizedTransaction[]) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      for (const t of categoryTxns) next.delete(t.transactionIndex);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const nonPersonal = result.transactions.filter(t => t.category !== 'personal' && t.category !== 'unclear');
    setSelectedIndices(new Set(nonPersonal.map(t => t.transactionIndex)));
  }, [result.transactions]);

  const clearSelection = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  // Clear selection when collapsing a category
  const handleToggleCategory = useCallback((category: string) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
      lastClickedRef.current = null;
    }
  }, [expandedCategory]);

  // Batch reclassify — move selected transactions to a new category
  const handleBatchReclassify = useCallback((newCategory: TransactionCategory) => {
    for (const idx of selectedIndices) {
      onUpdateTransaction(idx, {
        category: newCategory,
        originalCategory: result.transactions.find(t => t.transactionIndex === idx)?.category,
        confidence: 'high',
        source: 'user',
      });
    }
    setSelectedIndices(new Set());
  }, [selectedIndices, onUpdateTransaction, result.transactions]);

  // Split summaries into tax-relevant and personal
  const taxSummaries = result.summaries.filter(s => s.category !== 'personal' && s.category !== 'unclear');
  const personalSummary = result.summaries.find(s => s.category === 'personal');

  const approvedCount = taxSummaries.filter(s => s.approved).length;
  const totalCategories = taxSummaries.length;
  const approvedAmount = taxSummaries
    .filter(s => s.approved)
    .reduce((sum, s) => sum + s.totalAmount, 0);

  // ─── Drill-down view (Level 3 sub-categorization) ───
  if (drillDownCategory) {
    const drillTxns = result.transactions.filter(
      t => t.category === drillDownCategory,
    );
    return (
      <CategoryDetailGrid
        category={drillDownCategory}
        transactions={drillTxns}
        onUpdateTransaction={onUpdateTransaction}
        onBack={() => setDrillDownCategory(null)}
        onApproveAll={() => onApproveCategory(drillDownCategory)}
        onApplyToReturn={onApplyToReturn}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero summary */}
      <div className="rounded-xl border border-slate-700 bg-surface-800 p-5">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-5 h-5 text-telos-orange-400" />
          <h3 className="text-base font-semibold text-slate-200"><span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">AI</span> Transaction Analysis</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-bold text-emerald-400">
              ${result.estimatedDeductibleTotal.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400">Potential deductions</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-200">
              {result.totalProcessed - result.personalCount}
            </div>
            <div className="text-xs text-slate-400">Tax-relevant transactions</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-200">{totalCategories}</div>
            <div className="text-xs text-slate-400">Categories found</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${approvedCount === totalCategories ? 'text-emerald-400' : 'text-slate-200'}`}>
              {approvedCount}/{totalCategories}
            </div>
            <div className="text-xs text-slate-400">Approved</div>
          </div>
        </div>
      </div>

      {/* Batch action bar — visible when items are selected */}
      {selectedIndices.size > 0 && (
        <div className="sticky top-0 z-10 rounded-lg border border-telos-blue-500/30 bg-telos-blue-500/10
                        backdrop-blur-sm px-4 py-2.5 flex items-center gap-3 shadow-lg">
          <span className="text-xs font-medium text-telos-blue-300">
            {selectedIndices.size} selected
          </span>
          <div className="h-4 w-px bg-slate-600" />

          {/* Batch reclassify dropdown */}
          <div className="relative">
            <select
              className="bg-surface-700 border border-slate-600 rounded-md text-xs text-slate-300
                         pl-2.5 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-telos-blue-500
                         cursor-pointer hover:border-slate-500 transition-colors appearance-none"
              value=""
              onChange={(e) => {
                if (e.target.value) handleBatchReclassify(e.target.value as TransactionCategory);
              }}
            >
              <option value="" disabled>Move to category...</option>
              {Object.entries(CATEGORY_META)
                .filter(([key]) => key !== 'unclear')
                .map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
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
      )}

      {/* Tax-relevant category list */}
      <div className="space-y-2">
        {taxSummaries.map((summary) => {
          const categoryTxns = result.transactions.filter(
            t => t.category === summary.category,
          );
          return (
            <CategoryCard
              key={summary.category}
              summary={summary}
              isExpanded={expandedCategory === summary.category}
              onToggle={() => handleToggleCategory(summary.category)}
              onApprove={() => onApproveCategory(summary.category)}
              onDrillDown={
                DRILLDOWN_CATEGORIES.has(summary.category)
                  ? () => setDrillDownCategory(summary.category)
                  : undefined
              }
              transactions={categoryTxns}
              selectedIndices={selectedIndices}
              onRowClick={handleRowClick}
              onSelectAll={() => selectAllInCategory(categoryTxns)}
              onClearSelection={() => clearCategorySelection(categoryTxns)}
              onUpdateTransaction={onUpdateTransaction}
            />
          );
        })}
      </div>

      {/* Personal transactions — same card style as tax-relevant categories */}
      {personalSummary && personalSummary.transactionCount > 0 && (() => {
        const personalTxns = result.transactions.filter(t => t.category === 'personal');
        return (
          <CategoryCard
            summary={personalSummary}
            isExpanded={expandedCategory === 'personal'}
            onToggle={() => handleToggleCategory('personal')}
            onApprove={() => {}}
            transactions={personalTxns}
            selectedIndices={selectedIndices}
            onRowClick={handleRowClick}
            onSelectAll={() => selectAllInCategory(personalTxns)}
            onClearSelection={() => clearCategorySelection(personalTxns)}
            onUpdateTransaction={onUpdateTransaction}
          />
        );
      })()}

      {/* Apply to return button */}
      {approvedCount > 0 && (
        <div className="sticky bottom-0 pt-3 pb-2 bg-gradient-to-t from-surface-900 via-surface-900">
          <button
            onClick={onApplyToReturn}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                       bg-emerald-600 hover:bg-emerald-500 text-white font-semibold
                       shadow-lg shadow-emerald-600/20 transition-all"
          >
            <FileText className="w-4 h-4" />
            Apply {approvedCount} categories (${Math.round(approvedAmount).toLocaleString()}) to my return
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Summary Card ──────────────────────────────────

function CategoryCard({
  summary,
  isExpanded,
  onToggle,
  onApprove,
  onDrillDown,
  transactions,
  selectedIndices,
  onRowClick,
  onSelectAll,
  onClearSelection,
  onUpdateTransaction,
}: {
  summary: CategorySummary;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onDrillDown?: () => void;
  transactions: CategorizedTransaction[];
  selectedIndices: Set<number>;
  onRowClick: (index: number, shiftKey: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onUpdateTransaction: (index: number, patch: Partial<CategorizedTransaction>) => void;
}) {
  const meta = CATEGORY_META[summary.category];

  return (
    <div className={`rounded-lg border ${summary.approved ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700 bg-surface-800'} transition-colors`}>
      {/* Header — clickable to expand */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-700/50 transition-colors rounded-t-lg"
      >
        {isExpanded
          ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
        }
        {(() => {
          const Icon = ICON_MAP[meta.icon];
          return Icon ? <Icon className={`w-4 h-4 shrink-0 ${meta.color}`} /> : null;
        })()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${meta.color}`}>{summary.label}</span>
            {summary.approved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-400">{summary.transactionCount} transactions</span>
            <span className="text-xs text-slate-500">
              {summary.category === 'personal'
                ? 'Not reported on tax forms'
                : summary.targetForm}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm font-semibold ${summary.category === 'personal' ? 'text-slate-400' : 'text-emerald-400'}`}>
            ${Math.round(summary.totalAmount).toLocaleString()}
          </div>
        </div>
      </button>

      {/* Action buttons (when not expanded) */}
      {!isExpanded && (
        <div className="px-4 pb-3 flex items-center gap-2">
          {!summary.approved && summary.category !== 'personal' && (
            <button
              onClick={(e) => { e.stopPropagation(); onApprove(); }}
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300
                         bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30
                         px-3 py-1.5 rounded transition-colors"
            >
              Approve all {summary.transactionCount} transactions
            </button>
          )}
          {onDrillDown && (
            <button
              onClick={(e) => { e.stopPropagation(); onDrillDown(); }}
              className="text-xs font-medium text-telos-blue-400 hover:text-telos-blue-300
                         bg-telos-blue-500/10 hover:bg-telos-blue-500/20 border border-telos-blue-500/30
                         px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
            >
              <Table2 className="w-3 h-3" />
              Review sub-categories
            </button>
          )}
        </div>
      )}

      {/* Expanded transaction list */}
      {isExpanded && (
        <div className="border-t border-slate-700/50">
          {/* Select/Clear for this category */}
          <div className="flex items-center justify-end gap-3 px-4 py-1.5 bg-surface-900/40 border-b border-slate-700/30">
            <button
              onClick={onSelectAll}
              className="text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
            >
              Select all
            </button>
            <button
              onClick={onClearSelection}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {transactions.map((ct) => (
              <TransactionRow
                key={ct.transactionIndex}
                ct={ct}
                isSelected={selectedIndices.has(ct.transactionIndex)}
                onRowClick={onRowClick}
                onUpdate={(patch) => onUpdateTransaction(ct.transactionIndex, patch)}
              />
            ))}
          </div>
          {!summary.approved && summary.category !== 'personal' && (
            <div className="px-4 py-3 border-t border-slate-700/50 bg-surface-900/50">
              <button
                onClick={onApprove}
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300
                           bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30
                           px-3 py-1.5 rounded transition-colors"
              >
                Approve all {summary.transactionCount}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Transaction Row ───────────────────────────────

function TransactionRow({
  ct,
  isSelected,
  onRowClick,
  onUpdate,
}: {
  ct: CategorizedTransaction;
  isSelected: boolean;
  onRowClick: (index: number, shiftKey: boolean) => void;
  onUpdate: (patch: Partial<CategorizedTransaction>) => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 text-xs border-b border-slate-700/30 last:border-0
                   cursor-pointer select-none transition-colors ${
        isSelected ? 'bg-telos-blue-500/10' : ct.approved ? 'bg-emerald-500/5' : 'hover:bg-surface-700/30'
      }`}
      onClick={(e) => onRowClick(ct.transactionIndex, e.shiftKey)}
    >
      {/* Checkbox */}
      <div className="shrink-0">
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

      {/* Merchant */}
      <div className="flex-1 min-w-0">
        <div className="text-slate-300 truncate">{ct.transaction.description}</div>
      </div>

      {/* Date */}
      <span className="text-slate-500 shrink-0 w-14 text-center font-mono">
        {ct.transaction.date.slice(5)}
      </span>

      {/* Amount */}
      <span className="text-white shrink-0 w-20 text-right font-mono">
        ${Math.abs(ct.transaction.amount).toFixed(0)}
      </span>

      {/* Reclassify dropdown */}
      <div className="shrink-0 w-40" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <select
            className="w-full bg-transparent border border-slate-700/50 rounded-md text-[11px] text-slate-400
                       pl-2 pr-6 py-1 focus:outline-none focus:ring-1 focus:ring-telos-blue-500
                       cursor-pointer hover:border-slate-500 hover:text-slate-300
                       transition-colors appearance-none"
            value={ct.category}
            onChange={(e) => {
              onUpdate({
                category: e.target.value as TransactionCategory,
                originalCategory: ct.originalCategory || ct.category,
                confidence: 'high',
                source: 'user',
              });
            }}
          >
            {Object.entries(CATEGORY_META)
              .filter(([key]) => key !== 'unclear')
              .map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
