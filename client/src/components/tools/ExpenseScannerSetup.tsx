/**
 * ExpenseScannerSetup — pre-categorization context screen.
 *
 * Shows what the AI knows about the user's tax situation, lets them
 * select which expense categories to scan for, and provides quick-select
 * bundles for users with sparse return data.
 */

import { useState, useMemo, useEffect } from 'react';
import { Sparkles, Info } from 'lucide-react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { buildReturnContext } from '../../services/deductionFinderContext';
import type { ReturnContext } from '../../services/deductionFinderTypes';
import type { TransactionCategory } from '../../services/transactionCategorizerTypes';
import { CATEGORY_META } from '../../services/transactionCategorizerTypes';
import ReturnContextSummary, { computeContextRichness } from './ReturnContextSummary';
import CategoryToggleCard from './CategoryToggleCard';

interface Props {
  transactionCount: number;
  onStartScan: (enabledCategories: TransactionCategory[], contextHints: Record<string, boolean>) => void;
}

// ─── Category Groups ───────────────────────────────

interface CategoryGroup {
  title: string;
  categories: TransactionCategory[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    title: 'Business & Self-Employment',
    categories: ['business_expense', 'home_office', 'vehicle', 'health_insurance_se'],
  },
  {
    title: 'Itemized Deductions',
    categories: ['medical', 'charitable', 'salt', 'investment'],
  },
  {
    title: 'Adjustments & Credits',
    categories: ['retirement', 'education', 'childcare', 'student_loan', 'hsa'],
  },
  {
    title: 'Property & Taxes',
    categories: ['mortgage', 'tax_payment', 'rental_property'],
  },
];

// ─── Quick-Select Bundles ──────────────────────────

interface QuickBundle {
  question: string;
  key: string;
  categories: TransactionCategory[];
}

const QUICK_BUNDLES: QuickBundle[] = [
  { question: 'Were you self-employed or freelancing in 2025?', key: 'isSelfEmployed', categories: ['business_expense', 'vehicle', 'health_insurance_se'] },
  { question: 'Did you work from home in 2025?', key: 'worksFromHome', categories: ['home_office'] },
  { question: 'Did you have children under 13 in 2025?', key: 'hasKids', categories: ['childcare'] },
  { question: 'Did you have medical or dental expenses in 2025?', key: 'hasMedical', categories: ['medical', 'hsa'] },
  { question: 'Did you make charitable donations in 2025?', key: 'hasCharitable', categories: ['charitable'] },
  { question: 'Were you a student or paying student loans in 2025?', key: 'isStudent', categories: ['education', 'student_loan'] },
  { question: 'Did you have investment accounts in 2025?', key: 'hasInvestments', categories: ['investment'] },
  { question: 'Did you own rental property in 2025?', key: 'hasRentalProperty', categories: ['rental_property'] },
];

// ─── Auto-Enable Logic ─────────────────────────────

function computeAutoEnabled(context: ReturnContext): Set<TransactionCategory> {
  const auto = new Set<TransactionCategory>();

  // Always on — universally relevant
  auto.add('tax_payment');
  auto.add('retirement');
  auto.add('salt');

  if (context.hasScheduleC) {
    auto.add('business_expense');
    auto.add('vehicle');
  }
  if (context.hasHomeOffice) auto.add('home_office');
  if (context.hasSEHealthInsurance) auto.add('health_insurance_se');
  if (context.minorDependentCount > 0) auto.add('childcare');
  if (context.deductionMethod === 'itemized') {
    auto.add('medical');
    auto.add('charitable');
    auto.add('salt');
    auto.add('investment');
  }
  if (context.hasCharitableDeductions) auto.add('charitable');
  if (context.hasMedicalExpenses) auto.add('medical');
  if (context.hasHSA) auto.add('hsa');
  if (context.hasStudentLoanInterest) auto.add('student_loan');
  if (context.hasSALT) auto.add('salt');
  if (context.hasMortgageInterest) auto.add('mortgage');

  return auto;
}

// ─── Main Component ────────────────────────────────

export default function ExpenseScannerSetup({ transactionCount, onStartScan }: Props) {
  const { taxReturn, calculation } = useTaxReturnStore();

  const context = useMemo<ReturnContext>(
    () => taxReturn ? buildReturnContext(taxReturn, calculation) : {} as ReturnContext,
    [taxReturn, calculation],
  );

  const richness = useMemo(() => computeContextRichness(context), [context]);
  const autoEnabled = useMemo(() => computeAutoEnabled(context), [context]);
  const showBundles = richness < 0.3;

  // Category toggle state — initialized from auto-enable
  const [enabled, setEnabled] = useState<Set<TransactionCategory>>(autoEnabled);
  const [contextHints, setContextHints] = useState<Record<string, boolean>>({});

  // Re-compute auto-enabled when context changes
  useEffect(() => {
    const newAuto = computeAutoEnabled(context);
    setEnabled(prev => {
      const next = new Set(prev);
      for (const cat of newAuto) next.add(cat);
      return next;
    });
  }, [context]);

  const toggleCategory = (cat: TransactionCategory, on: boolean) => {
    setEnabled(prev => {
      const next = new Set(prev);
      if (on) next.add(cat);
      else next.delete(cat);
      return next;
    });
  };

  const toggleBundle = (bundle: QuickBundle, on: boolean | undefined) => {
    setContextHints(prev => {
      const next = { ...prev };
      if (on === undefined) delete next[bundle.key];
      else next[bundle.key] = on;
      return next;
    });
    if (on === true) {
      // Yes: enable the bundle's categories
      setEnabled(prev => {
        const next = new Set(prev);
        for (const cat of bundle.categories) next.add(cat);
        return next;
      });
    } else if (on === false) {
      // No: remove bundle's categories UNLESS they were auto-detected from return context
      setEnabled(prev => {
        const next = new Set(prev);
        for (const cat of bundle.categories) {
          if (!autoEnabled.has(cat)) next.delete(cat);
        }
        return next;
      });
    }
    // undefined (deselect): no change to categories
  };

  const enabledCount = enabled.size;
  const enabledArray = [...enabled] as TransactionCategory[];

  return (
    <div className="space-y-5">
      {/* Return context summary */}
      <ReturnContextSummary context={context} richness={richness} />

      {/* Quick-select bundles (for sparse context) — matches CalloutCard info style */}
      {showBundles && (
        <div className="rounded-lg border p-4 bg-telos-blue-600/10 border-telos-blue-600/30">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-telos-blue-300" />
            <div className="flex-1">
              <div className="text-sm font-medium text-telos-blue-300 mb-3">Tell us about yourself</div>
              <div className="space-y-3">
                {QUICK_BUNDLES.map((bundle) => (
                  <div key={bundle.key} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{bundle.question}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-4">
                      <button
                        onClick={() => toggleBundle(bundle, contextHints[bundle.key] === true ? undefined : true)}
                        className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                          contextHints[bundle.key] === true
                            ? 'bg-telos-blue-500 text-white'
                            : 'bg-surface-700 text-slate-400 hover:text-white hover:bg-surface-600'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => toggleBundle(bundle, contextHints[bundle.key] === false ? undefined : false)}
                        className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                          contextHints[bundle.key] === false
                            ? 'bg-telos-blue-500 text-white'
                            : 'bg-surface-700 text-slate-400 hover:text-white hover:bg-surface-600'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category toggle grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Categories to scan
          </h4>
          <span className="text-xs text-slate-500">
            {enabledCount} of {CATEGORY_GROUPS.reduce((sum, g) => sum + g.categories.length, 0)} enabled
          </span>
        </div>

        <div className="space-y-4">
          {CATEGORY_GROUPS.map((group) => (
            <div key={group.title}>
              <h5 className="text-sm font-semibold text-slate-300 mb-2 pl-1">{group.title}</h5>
              <div className="space-y-1">
                {group.categories.map((cat) => (
                  <CategoryToggleCard
                    key={cat}
                    category={cat}
                    meta={CATEGORY_META[cat]}
                    enabled={enabled.has(cat)}
                    autoDetected={autoEnabled.has(cat)}
                    onChange={(on) => toggleCategory(cat, on)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction count + scan button */}
      <div className="sticky bottom-0 pt-3 pb-2 bg-gradient-to-t from-surface-900 via-surface-900">
        <p className="text-xs text-slate-500 text-center mb-2">
          {transactionCount.toLocaleString()} transactions loaded
        </p>
        <button
          onClick={() => onStartScan(enabledArray, contextHints)}
          disabled={enabledCount === 0}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                     font-semibold shadow-lg transition-all ${
            enabledCount > 0
              ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/20'
              : 'bg-surface-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Scan {enabledCount} {enabledCount === 1 ? 'category' : 'categories'} with{' '}<span><span className="text-telos-orange-300">Telos</span><span className="text-telos-blue-300">AI</span></span>
        </button>
      </div>
    </div>
  );
}
