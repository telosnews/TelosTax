import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { getExpenseCategories, addIncomeItem, deleteIncomeItem } from '../../api/client';
import CurrencyInput from '../common/CurrencyInput';
import StepNavigation from '../layout/StepNavigation';
import SectionIntro from '../common/SectionIntro';
import { Receipt, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import ExpenseChartSwitcher from '../charts/ExpenseChartSwitcher';
import { HELP_CONTENT } from '../../data/helpContent';
import CalloutCard from '../common/CalloutCard';
import StepWarningsBanner from '../common/StepWarningsBanner';

interface Category {
  schedule_c_line: number;
  category_key: string;
  display_name: string;
  description: string;
  examples: string;
}

const DEBOUNCE_MS = 800;

/** Meals deduction rates by category — all other categories are 100% (rate = 1). */
const MEALS_DEDUCTION_RATE: Record<string, number> = {
  meals: 0.5,
  meals_dot: 0.8,
  // meals_full is 1.0 (100%), no entry needed
};

/** Returns the deductible amount for a category, applying the meals limitation. */
function deductibleAmount(categoryKey: string, rawAmount: number): number {
  const rate = MEALS_DEDUCTION_RATE[categoryKey] ?? 1;
  return Math.round(rawAmount * rate * 100) / 100;
}

export default function ExpenseCategoriesStep() {
  const { taxReturn, returnId, updateField } = useTaxReturnStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  if (!taxReturn || !returnId) return null;

  const businesses = taxReturn.businesses?.length > 0
    ? taxReturn.businesses
    : (taxReturn.business ? [taxReturn.business] : []);
  const hasMultipleBusinesses = businesses.length > 1;

  const [selectedBusinessId, setSelectedBusinessId] = useState<string>(() =>
    businesses.length > 0 ? businesses[0].id : '',
  );

  // Derive filtered amounts from expenses for the selected business
  const deriveAmounts = useCallback((bizId: string) => {
    const init: Record<string, number> = {};
    for (const exp of taxReturn.expenses) {
      // When multi-business, only show expenses for the selected business
      if (hasMultipleBusinesses && exp.businessId !== bizId) continue;
      const key = exp.category || String(exp.scheduleCLine);
      init[key] = (init[key] || 0) + exp.amount;
    }
    // Backward compat: migrate legacy categories
    if (init['travel_meals'] && !init['travel']) {
      init['travel'] = init['travel_meals'];
      delete init['travel_meals'];
    }
    // Legacy 'interest' → default to 'interest_other' (16b)
    if (init['interest'] && !init['interest_other']) {
      init['interest_other'] = init['interest'];
      delete init['interest'];
    }
    // Legacy 'rent_lease' → default to 'rent_property' (20b)
    if (init['rent_lease'] && !init['rent_property']) {
      init['rent_property'] = init['rent_lease'];
      delete init['rent_lease'];
    }
    return init;
  }, [taxReturn.expenses, hasMultipleBusinesses]);

  useEffect(() => {
    setCategories(getExpenseCategories());
    setAmounts(deriveAmounts(selectedBusinessId));

    // Cleanup all debounce timers on unmount
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Re-derive amounts when switching business tabs
  useEffect(() => {
    setAmounts(deriveAmounts(selectedBusinessId));
  }, [selectedBusinessId, deriveAmounts]);

  const toggle = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  };

  // Persist the expense to the server (debounced).
  // Reads CURRENT expenses from the store to avoid stale closure bugs.
  const persistExpense = useCallback(async (line: number, category: string, value: number) => {
    // Read the latest expenses from the store to avoid stale closure
    const currentExpenses = useTaxReturnStore.getState().taxReturn?.expenses || [];

    // Remove old expenses for this category, scoped to the selected business
    const oldExpenses = currentExpenses.filter((e) => {
      const catMatch = e.category === category ||
        (category === 'travel' && e.category === 'travel_meals' && e.scheduleCLine === 24);
      if (!catMatch) return false;
      // When multi-business, only delete expenses for the selected business
      if (hasMultipleBusinesses) return e.businessId === selectedBusinessId;
      return true;
    });
    for (const exp of oldExpenses) {
      await deleteIncomeItem(returnId, 'expenses', exp.id);
    }

    // Add new expense if value > 0
    // Re-read to get the most up-to-date state after deletions
    const latestExpenses = useTaxReturnStore.getState().taxReturn?.expenses || [];
    let newExpenses = latestExpenses.filter((e) => {
      const catMatch = e.category === category ||
        (category === 'travel' && e.category === 'travel_meals' && e.scheduleCLine === 24);
      if (!catMatch) return true; // keep non-matching expenses
      if (hasMultipleBusinesses) return e.businessId !== selectedBusinessId;
      return false; // remove all matching (single business)
    });
    if (value > 0) {
      const payload: Record<string, unknown> = {
        scheduleCLine: line,
        category,
        amount: value,
      };
      // Attach businessId for multi-business, or auto-assign for single business
      if (hasMultipleBusinesses) {
        payload.businessId = selectedBusinessId;
      } else if (businesses.length === 1) {
        payload.businessId = businesses[0].id;
      }
      const result = await addIncomeItem(returnId, 'expenses', payload);
      newExpenses = [...newExpenses, { id: result.id, scheduleCLine: line, category, amount: value, businessId: (payload.businessId as string) || undefined }];
    }
    updateField('expenses', newExpenses);
  }, [returnId, updateField, hasMultipleBusinesses, selectedBusinessId, businesses]);

  const setAmount = (line: number, category: string, value: number) => {
    // Update local state immediately for responsive UI
    setAmounts((prev) => ({ ...prev, [category]: value }));

    // Debounce the API call. Key includes businessId to prevent cross-business collisions
    // when the user switches businesses quickly while editing the same category.
    const timerKey = `${category}::${selectedBusinessId}`;
    if (debounceTimers.current[timerKey]) {
      clearTimeout(debounceTimers.current[timerKey]);
    }
    debounceTimers.current[timerKey] = setTimeout(() => {
      persistExpense(line, category, value);
    }, DEBOUNCE_MS);
  };

  // Total uses deductible amounts (applies meals percentage limits)
  const totalExpenses = useMemo(() => {
    return categories.reduce((sum, cat) => {
      const raw = amounts[cat.category_key] || 0;
      return sum + deductibleAmount(cat.category_key, raw);
    }, 0);
  }, [categories, amounts]);

  // Build chart items using deductible amounts — stepId holds the category_key so we can expand it on click
  const chartItems = useMemo(() => {
    return categories
      .filter(cat => (amounts[cat.category_key] || 0) > 0)
      .map(cat => ({
        label: cat.display_name,
        value: deductibleAmount(cat.category_key, amounts[cat.category_key] || 0),
        stepId: cat.category_key,
      }))
      .sort((a, b) => b.value - a.value);
  }, [categories, amounts]);

  const handleChartClick = useCallback((categoryKey: string) => {
    setExpanded(prev => new Set(prev).add(categoryKey));
    // Scroll the category into view
    const el = document.getElementById(`expense-cat-${categoryKey}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Line label: show sub-line designators for split lines
  const lineLabel = (cat: Category) => {
    if (cat.schedule_c_line === 16 && cat.category_key === 'interest_mortgage') return '16a';
    if (cat.schedule_c_line === 16 && cat.category_key === 'interest_other') return '16b';
    if (cat.schedule_c_line === 20 && cat.category_key === 'rent_equipment') return '20a';
    if (cat.schedule_c_line === 20 && cat.category_key === 'rent_property') return '20b';
    if (cat.schedule_c_line === 24 && cat.category_key === 'travel') return '24a';
    if (cat.schedule_c_line === 24 && (cat.category_key === 'meals' || cat.category_key === 'meals_dot' || cat.category_key === 'meals_full')) return '24b';
    return String(cat.schedule_c_line);
  };

  return (
    <div>
      <StepWarningsBanner stepId="expense_categories" />

      <SectionIntro icon={<Receipt className="w-8 h-8" />} title="Business Expenses" description="Enter your deductible business expenses by category." />

      <div className="space-y-3 mt-4 mb-6">
        {HELP_CONTENT['expense_categories']?.callouts?.map((c, i) => (
          <CalloutCard key={i} variant={c.type} title={c.title} irsUrl={c.irsUrl}>{c.body}</CalloutCard>
        ))}
      </div>

      {/* Business selector for multi-business users */}
      {hasMultipleBusinesses && (
        <div className="mb-4">
          <label className="text-sm text-slate-400 mb-1 block">Showing expenses for:</label>
          <select
            className="input-field"
            value={selectedBusinessId}
            onChange={(e) => setSelectedBusinessId(e.target.value)}
          >
            {businesses.map((biz) => (
              <option key={biz.id} value={biz.id}>
                {biz.businessName || 'Unnamed Business'}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-2 mb-4 card bg-surface-700/50">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">
            Total Deductible Expenses
            {hasMultipleBusinesses && (
              <span className="text-xs ml-1">
                ({businesses.find(b => b.id === selectedBusinessId)?.businessName || 'Selected'})
              </span>
            )}
          </span>
          <span className="text-lg font-semibold text-white">${totalExpenses.toLocaleString()}</span>
        </div>
      </div>

      <ExpenseChartSwitcher items={chartItems} onBarClick={handleChartClick} />

      <div className="space-y-2">
        {categories.map((cat) => {
          const key = cat.category_key;
          const isOpen = expanded.has(key);
          const rawAmount = amounts[key] || 0;
          const deductible = deductibleAmount(key, rawAmount);
          const mealsRate = MEALS_DEDUCTION_RATE[key]; // undefined for non-meals

          return (
            <div key={key} id={`expense-cat-${key}`} className="card py-3">
              <button onClick={() => toggle(key)} className="w-full flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <div className="text-left">
                    <span className="font-medium text-slate-200">{cat.display_name}</span>
                    <span className="text-xs text-slate-400 ml-2">Line {lineLabel(cat)}</span>
                  </div>
                </div>
                {rawAmount > 0 && (
                  <span className="text-white font-medium">
                    ${deductible.toLocaleString()}
                    {mealsRate != null && <span className="text-xs text-slate-400 font-normal ml-1">of ${rawAmount.toLocaleString()}</span>}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="mt-3 ml-7">
                  <p className="text-sm text-slate-400 mb-2">{cat.description}</p>
                  <p className="text-xs text-slate-400 mb-3">Examples: {cat.examples}</p>
                  <CurrencyInput
                    value={rawAmount}
                    onChange={(v) => setAmount(cat.schedule_c_line, cat.category_key, v)}
                  />
                  {mealsRate != null && rawAmount > 0 && (
                    <p className="text-xs text-emerald-400 mt-1.5">
                      Deductible amount: ${deductible.toLocaleString()} ({Math.round(mealsRate * 100)}% of ${rawAmount.toLocaleString()} entered)
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <a href="https://www.irs.gov/forms-pubs/about-schedule-c" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-4 text-xs text-telos-blue-400 hover:text-telos-blue-300 transition-colors">
        <ExternalLink className="w-3 h-3" />
        Learn more on IRS.gov
      </a>

      <StepNavigation />
    </div>
  );
}
