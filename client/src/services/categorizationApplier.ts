/**
 * Categorization Applier — maps approved transaction categories to tax return fields.
 *
 * Takes approved CategorizedTransactions and generates field updates
 * that can be applied to the TaxReturn via updateField/updateDeepField.
 *
 * Does NOT auto-apply — returns a preview of what will change so the user
 * can confirm before committing.
 */

import type { TaxReturn } from '@telostax/engine';
import type { CategorizedTransaction, TransactionCategory, TransactionSubCategory } from './transactionCategorizerTypes';
import { CATEGORY_META, BUSINESS_SUB_CATEGORY_META } from './transactionCategorizerTypes';

// ─── Types ─────────────────────────────────────────

export interface FieldUpdate {
  /** Human-readable label for the preview UI. */
  label: string;
  /** Dot-path into TaxReturn (e.g., 'itemizedDeductions.charitableCash'). */
  path: string;
  /** Current value in the return (for diff display). */
  currentValue: number;
  /** New value to apply. */
  newValue: number;
  /** Whether this adds to the existing value vs. replaces it. */
  mode: 'add' | 'replace';
  /** Source category. */
  category: TransactionCategory;
  /** Target form/line. */
  formLine: string;
  /** Number of transactions contributing to this value. */
  transactionCount: number;
}

export interface ApplyPreview {
  updates: FieldUpdate[];
  /** Discovery keys that need to be enabled for the wizard steps to appear. */
  discoveryKeysToEnable: string[];
  /** Total dollar amount across all updates. */
  totalAmount: number;
}

// ─── Category → Field Mapping ──────────────────────

interface CategoryFieldMapping {
  /** Dot-path into TaxReturn. */
  path: string;
  /** Human-readable label. */
  label: string;
  /** Form/line reference. */
  formLine: string;
  /** Discovery key to enable (if any). */
  discoveryKey?: string;
  /** Whether to add to existing value or replace. */
  mode: 'add' | 'replace';
}

const CATEGORY_FIELD_MAP: Partial<Record<TransactionCategory, CategoryFieldMapping>> = {
  medical: {
    path: 'itemizedDeductions.medicalExpenses',
    label: 'Medical & Dental Expenses',
    formLine: 'Schedule A, Line 1',
    discoveryKey: 'ded_medical',
    mode: 'add',
  },
  charitable: {
    path: 'itemizedDeductions.charitableCash',
    label: 'Charitable Cash Donations',
    formLine: 'Schedule A, Line 12',
    discoveryKey: 'ded_charitable',
    mode: 'add',
  },
  salt: {
    path: 'itemizedDeductions.stateLocalIncomeTax',
    label: 'State & Local Taxes (SALT)',
    formLine: 'Schedule A, Line 5a',
    discoveryKey: 'ded_property_tax',
    mode: 'add',
  },
  student_loan: {
    path: 'studentLoanInterest',
    label: 'Student Loan Interest',
    formLine: 'Schedule 1, Line 21',
    discoveryKey: 'ded_student_loan',
    mode: 'replace',
  },
  hsa: {
    path: 'hsaDeduction',
    label: 'HSA Contributions',
    formLine: 'Schedule 1, Line 13',
    discoveryKey: 'ded_hsa',
    mode: 'replace',
  },
  retirement: {
    path: 'iraContribution',
    label: 'IRA Contributions',
    formLine: 'Schedule 1, Line 20',
    mode: 'replace',
  },
  mortgage: {
    path: 'itemizedDeductions.mortgageInterest',
    label: 'Mortgage Interest',
    formLine: 'Schedule A, Line 8a',
    discoveryKey: 'ded_mortgage',
    mode: 'add',
  },
  // business_expense: handled specially via sub-category → Schedule C line mapping below
};

// ─── Sub-Category → Schedule C Line Mapping ─────────

interface ScheduleCLineMapping {
  /** Schedule C line number (8–27). */
  scheduleCLine: number;
  /** Category string for ExpenseEntry (matters for lines 16, 20, 24). */
  expenseCategory: string;
}

const SUB_CATEGORY_TO_SCHEDULE_C: Partial<Record<TransactionSubCategory, ScheduleCLineMapping>> = {
  advertising:            { scheduleCLine: 8,  expenseCategory: 'advertising' },
  car_and_truck:          { scheduleCLine: 9,  expenseCategory: 'car_and_truck' },
  commissions:            { scheduleCLine: 10, expenseCategory: 'commissions' },
  contract_labor:         { scheduleCLine: 11, expenseCategory: 'contract_labor' },
  depreciation:           { scheduleCLine: 13, expenseCategory: 'depreciation' },
  insurance_business:     { scheduleCLine: 15, expenseCategory: 'insurance' },
  interest_business:      { scheduleCLine: 16, expenseCategory: 'interest_other' },
  legal_professional:     { scheduleCLine: 17, expenseCategory: 'legal_professional' },
  office_expense:         { scheduleCLine: 18, expenseCategory: 'office_expense' },
  rent_lease:             { scheduleCLine: 20, expenseCategory: 'rent_property' },
  repairs_maintenance:    { scheduleCLine: 21, expenseCategory: 'repairs_maintenance' },
  supplies:               { scheduleCLine: 22, expenseCategory: 'supplies' },
  taxes_licenses:         { scheduleCLine: 23, expenseCategory: 'taxes_licenses' },
  travel:                 { scheduleCLine: 24, expenseCategory: 'travel' },
  meals:                  { scheduleCLine: 24, expenseCategory: 'meals' },
  utilities_business:     { scheduleCLine: 25, expenseCategory: 'utilities' },
  wages:                  { scheduleCLine: 26, expenseCategory: 'wages' },
  other_expense:          { scheduleCLine: 27, expenseCategory: 'other' },
  software_subscriptions: { scheduleCLine: 27, expenseCategory: 'other' },
  equipment:              { scheduleCLine: 13, expenseCategory: 'equipment' },
};

// ─── Preview Builder ───────────────────────────────

/**
 * Build a preview of what applying approved categories would change.
 * Does NOT modify the tax return — just computes the diff.
 */
export function buildApplyPreview(
  transactions: CategorizedTransaction[],
  taxReturn: TaxReturn,
): ApplyPreview {
  const updates: FieldUpdate[] = [];
  const discoveryKeys = new Set<string>();

  // Group approved transactions by category
  const categoryTotals = new Map<TransactionCategory, { total: number; count: number }>();
  for (const t of transactions) {
    if (!t.approved) continue;
    if (t.category === 'personal' || t.category === 'unclear') continue;

    const amount = Math.abs(t.transaction.amount) * (t.businessUsePercent / 100);
    const existing = categoryTotals.get(t.category);
    if (existing) {
      existing.total += amount;
      existing.count++;
    } else {
      categoryTotals.set(t.category, { total: amount, count: 1 });
    }
  }

  // Build field updates for categories we can map
  for (const [category, { total, count }] of categoryTotals) {
    if (category === 'business_expense') continue; // Handled via sub-category below
    const mapping = CATEGORY_FIELD_MAP[category];
    if (!mapping) continue;

    // Resolve current value
    const currentValue = resolvePath(taxReturn as unknown as Record<string, unknown>, mapping.path) ?? 0;
    const roundedTotal = Math.round(total);
    const newValue = mapping.mode === 'add'
      ? (typeof currentValue === 'number' ? currentValue : 0) + roundedTotal
      : roundedTotal;

    updates.push({
      label: mapping.label,
      path: mapping.path,
      currentValue: typeof currentValue === 'number' ? currentValue : 0,
      newValue,
      mode: mapping.mode,
      category,
      formLine: mapping.formLine,
      transactionCount: count,
    });

    if (mapping.discoveryKey) {
      discoveryKeys.add(mapping.discoveryKey);
    }
  }

  // ── Business expenses: distribute by sub-category to Schedule C lines ──
  const businessSubTotals = buildBusinessSubCategoryTotals(transactions);
  if (businessSubTotals.size > 0) {
    discoveryKeys.add('inc_self_employment');
    for (const [subCat, { total, count }] of businessSubTotals) {
      const lineMapping = SUB_CATEGORY_TO_SCHEDULE_C[subCat];
      const subMeta = BUSINESS_SUB_CATEGORY_META[subCat];
      const label = subMeta?.label ?? subCat;
      const formLine = subMeta
        ? `Schedule C, ${subMeta.formLine}`
        : 'Schedule C';

      // Apply deductibility rate (meals = 50%)
      const rate = subMeta?.deductibilityRate ?? 1.0;
      const deductibleTotal = Math.round(total * rate);

      updates.push({
        label: `Business: ${label}`,
        path: lineMapping ? `__scheduleC_expense__` : '',
        currentValue: 0,
        newValue: deductibleTotal,
        mode: 'add',
        category: 'business_expense',
        formLine,
        transactionCount: count,
      });
    }
  }

  // Add unmapped categories as informational notes
  for (const [category, { total, count }] of categoryTotals) {
    if (category === 'business_expense') continue; // Handled above
    if (CATEGORY_FIELD_MAP[category]) continue; // Already handled

    const meta = CATEGORY_META[category];
    if (!meta) continue;

    updates.push({
      label: `${meta.label} (manual entry needed)`,
      path: '',
      currentValue: 0,
      newValue: Math.round(total),
      mode: 'replace',
      category,
      formLine: meta.targetForm || 'See wizard step',
      transactionCount: count,
    });
  }

  const totalAmount = updates.reduce((sum, u) => sum + (u.newValue - u.currentValue), 0);

  return {
    updates: updates.sort((a, b) => (b.newValue - b.currentValue) - (a.newValue - a.currentValue)),
    discoveryKeysToEnable: [...discoveryKeys],
    totalAmount: Math.round(totalAmount),
  };
}

// ─── Helpers ───────────────────────────────────────

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Group approved business_expense transactions by sub-category and sum amounts.
 */
function buildBusinessSubCategoryTotals(
  transactions: CategorizedTransaction[],
): Map<TransactionSubCategory, { total: number; count: number }> {
  const map = new Map<TransactionSubCategory, { total: number; count: number }>();
  for (const t of transactions) {
    if (!t.approved) continue;
    if (t.category !== 'business_expense') continue;
    const amount = Math.abs(t.transaction.amount) * (t.businessUsePercent / 100);
    const existing = map.get(t.subCategory);
    if (existing) {
      existing.total += amount;
      existing.count++;
    } else {
      map.set(t.subCategory, { total: amount, count: 1 });
    }
  }
  return map;
}

/**
 * Build ExpenseEntry objects from approved business_expense transactions.
 * Used by the apply handler to create Schedule C expense entries.
 */
export function buildScheduleCExpenses(
  transactions: CategorizedTransaction[],
): Array<{ scheduleCLine: number; category: string; description: string; amount: number }> {
  const subTotals = buildBusinessSubCategoryTotals(transactions);
  const entries: Array<{ scheduleCLine: number; category: string; description: string; amount: number }> = [];

  for (const [subCat, { total }] of subTotals) {
    const lineMapping = SUB_CATEGORY_TO_SCHEDULE_C[subCat];
    if (!lineMapping) continue;

    const subMeta = BUSINESS_SUB_CATEGORY_META[subCat];
    const rate = subMeta?.deductibilityRate ?? 1.0;

    entries.push({
      scheduleCLine: lineMapping.scheduleCLine,
      category: lineMapping.expenseCategory,
      description: `Smart Expense Scanner: ${subMeta?.label ?? subCat}`,
      amount: Math.round(total * rate),
    });
  }

  return entries;
}
