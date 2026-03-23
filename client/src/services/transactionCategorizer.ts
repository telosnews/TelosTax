/**
 * Transaction Categorizer — AI-powered transaction classification
 *
 * Hybrid pipeline:
 *   1. Deduplicate transactions by merchant name (aggregate totals)
 *   2. Send deduplicated merchants + user tax context to LLM
 *   3. Fan out merchant-level categories to individual transactions
 *   4. Cross-validate against pattern engine (Task 12)
 *
 * Privacy: exact dates stripped (month/year only), small amounts rounded,
 * PII-scanned via checkForPII before sending.
 */

import type { NormalizedTransaction, ReturnContext } from './deductionFinderTypes';
import type {
  MerchantAggregate,
  CategorizedTransaction,
  CategorySummary,
  CategorizationResult,
  TransactionCategory,
  TransactionSubCategory,
  ConfidenceLevel,
} from './transactionCategorizerTypes';
import { CATEGORY_META } from './transactionCategorizerTypes';
import { checkForPII } from './chatService';
import { sanitizeMerchant } from './merchantClassifier';
import { logOutboundRequest, buildPiiBlockSummary } from './privacyAuditLog';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/** Sub-category descriptions for the AI prompt, keyed by TransactionCategory. */
const CATEGORY_SUB_DESCRIPTIONS: Partial<Record<TransactionCategory, string>> = {
  business_expense: 'advertising, supplies, equipment, software_subscriptions, travel, meals, office_expense, contract_labor, legal_professional, rent_lease, repairs_maintenance, insurance_business, utilities_business, other_expense',
  home_office: 'internet, electric, gas_heating, water, rent_mortgage_pct, insurance_home, repairs_home, office_supplies, office_furniture',
  medical: 'prescriptions, doctor_visits, dental, vision, insurance_premiums, mental_health, hospital, lab_tests, medical_devices',
  charitable: 'cash_donation, noncash_donation',
  education: 'tuition, books_supplies, student_loan_payment',
  childcare: 'daycare, after_school, summer_camp, nanny',
  vehicle: 'fuel, maintenance_vehicle, parking, tolls, insurance_vehicle',
  retirement: 'ira_contribution, sep_ira, solo_401k',
  tax_payment: 'estimated_federal, estimated_state',
  salt: 'state_income_tax, property_tax',
  mortgage: 'mortgage_payment, refinance_payment, mortgage_insurance',
};

// ─── Merchant Deduplication ────────────────────────

/**
 * Aggregate transactions by cleaned merchant name.
 * This is the key optimization — 4,000 transactions may have only 300-500 unique merchants.
 */
export function deduplicateByMerchant(transactions: NormalizedTransaction[]): MerchantAggregate[] {
  const map = new Map<string, MerchantAggregate>();

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    const merchant = sanitizeMerchant(t.description);
    if (!merchant) continue;

    const existing = map.get(merchant);
    if (existing) {
      existing.totalAmount += Math.abs(t.amount);
      existing.transactionCount++;
      existing.transactionIndices.push(i);
    } else {
      map.set(merchant, {
        merchant,
        totalAmount: Math.abs(t.amount),
        transactionCount: 1,
        monthRange: '',  // computed below
        averageAmount: 0, // computed below
        transactionIndices: [i],
      });
    }
  }

  // Compute averages and month ranges
  for (const agg of map.values()) {
    agg.averageAmount = Math.round(agg.totalAmount / agg.transactionCount);

    // Compute month range from transaction dates
    const months = new Set<string>();
    for (const idx of agg.transactionIndices) {
      const date = transactions[idx].date;
      if (date && date.length >= 7) months.add(date.slice(0, 7)); // YYYY-MM
    }
    const sorted = [...months].sort();
    if (sorted.length <= 3) {
      agg.monthRange = sorted.map(m => formatMonth(m)).join(', ');
    } else {
      agg.monthRange = `${formatMonth(sorted[0])}–${formatMonth(sorted[sorted.length - 1])} (${sorted.length} months)`;
    }
  }

  return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount);
}

function formatMonth(yyyyMm: string): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = parseInt(yyyyMm.slice(5, 7), 10);
  return MONTHS[month - 1] || yyyyMm;
}

// ─── AI Categorization ─────────────────────────────

interface CategorizeOptions {
  provider: string;
  apiKey: string;
  model: string;
}

interface AIMerchantCategory {
  merchant: string;
  category: TransactionCategory;
  subCategory: TransactionSubCategory;
  confidence: ConfidenceLevel;
  formLine: string;
  reasoning: string;
}

/**
 * Send deduplicated merchants to the LLM for categorization.
 * Returns a map of merchant name → category assignment.
 *
 * @param enabledCategories - Only classify into these categories (from setup screen)
 * @param contextHints - User-provided context hints (from quick-select bundles)
 */
export async function categorizeWithAI(
  merchants: MerchantAggregate[],
  context: ReturnContext,
  options: CategorizeOptions,
  onProgress?: (completed: number, total: number) => void,
  enabledCategories?: TransactionCategory[],
  contextHints?: Record<string, boolean>,
): Promise<Map<string, AIMerchantCategory>> {
  const BATCH_SIZE = 100;
  const TIMEOUT_MS = 180_000; // 3 minutes per batch
  const result = new Map<string, AIMerchantCategory>();

  for (let i = 0; i < merchants.length; i += BATCH_SIZE) {
    const batch = merchants.slice(i, i + BATCH_SIZE);

    // Build the merchant list for the prompt (privacy: no exact dates, round small amounts)
    const merchantList = batch.map(m => {
      const amt = m.totalAmount < 10 ? '< $10' : `$${Math.round(m.totalAmount).toLocaleString()}`;
      return `- ${m.merchant} | ${amt} total | ${m.transactionCount} transactions | ${m.monthRange}`;
    }).join('\n');

    // PII scan the merchant list
    const piiCheck = checkForPII(merchantList);
    const cleanedList = piiCheck.hasPII ? piiCheck.sanitized : merchantList;

    const prompt = buildCategorizationPrompt(cleanedList, context, enabledCategories, contextHints);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}/api/batch/categorize-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt,
          provider: options.provider,
          apiKey: options.apiKey,
          model: options.model,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error((errorBody as any)?.error?.message || `Categorization failed (${res.status})`);
      }

      const body = await res.json();
      const categories: AIMerchantCategory[] = body?.data?.categories ?? [];

      // Privacy audit log — record what was sent (async, non-blocking)
      logOutboundRequest({
        feature: 'expense-scanner',
        provider: options.provider,
        model: options.model,
        redactedMessage: `[Batch ${Math.floor(i / BATCH_SIZE) + 1}] ${batch.length} merchants`,
        piiBlocked: piiCheck.hasPII ? buildPiiBlockSummary(piiCheck.detectedTypes) : [],
        contextKeysSent: ['merchants', 'taxContext', 'enabledCategories'],
        responseTruncated: `${categories.length} classifications returned`,
      }).catch(() => {});

      for (const cat of categories) {
        result.set(sanitizeMerchant(cat.merchant), cat);
      }

      onProgress?.(Math.min(i + BATCH_SIZE, merchants.length), merchants.length);
    } finally {
      clearTimeout(timeout);
    }
  }

  return result;
}

// ─── Prompt Builder ────────────────────────────────

function buildCategorizationPrompt(
  merchantList: string,
  context: ReturnContext,
  enabledCategories?: TransactionCategory[],
  contextHints?: Record<string, boolean>,
): string {
  const contextLines: string[] = [];

  // From return data
  if (context.hasScheduleC) contextLines.push('- Self-employed (has Schedule C business)');
  if (context.hasHomeOffice) contextLines.push('- Has a home office');
  if (context.hasSEHealthInsurance) contextLines.push('- Pays for self-employed health insurance');
  if (context.hasMortgageInterest) contextLines.push('- Has a mortgage');
  if (context.dependentCount > 0) contextLines.push(`- ${context.dependentCount} dependents`);
  if (context.minorDependentCount > 0) contextLines.push(`- ${context.minorDependentCount} dependents under 13 (childcare eligible)`);
  if (context.deductionMethod === 'itemized') contextLines.push('- Itemizing deductions');
  if (context.hasCharitableDeductions) contextLines.push('- Already has some charitable deductions entered');
  if (context.hasMedicalExpenses) contextLines.push('- Already has some medical expenses entered');
  if (context.hasHSA) contextLines.push('- Has an HSA');
  if (context.hasStudentLoanInterest) contextLines.push('- Paying student loan interest');

  // From user-provided context hints (sparse-return users)
  if (contextHints) {
    if (contextHints.isSelfEmployed && !context.hasScheduleC) {
      contextLines.push('- User confirms they are self-employed (Schedule C not yet entered)');
    }
    if (contextHints.isHomeowner && !context.hasMortgageInterest) {
      contextLines.push('- User confirms they own a home');
    }
    if (contextHints.hasKids && context.minorDependentCount === 0) {
      contextLines.push('- User confirms they have children (dependents not yet entered)');
    }
    if (contextHints.isStudent) {
      contextLines.push('- User confirms they are a student or paying student loans');
    }
    if (contextHints.hasRentalProperty) {
      contextLines.push('- User confirms they own rental property');
    }
  }

  const contextBlock = contextLines.length > 0
    ? `\nTax situation:\n${contextLines.join('\n')}\n`
    : '\nTax situation: No details provided — classify based on merchant names only.\n';

  // Build category list — only include enabled categories if specified
  const activeCategories = enabledCategories && enabledCategories.length > 0
    ? enabledCategories
    : Object.keys(CATEGORY_META).filter(k => k !== 'personal' && k !== 'unclear') as TransactionCategory[];

  const categoryRestriction = enabledCategories && enabledCategories.length > 0
    ? '\nIMPORTANT: ONLY classify into the categories listed below. The user has specifically selected these as relevant to their situation. If a transaction does not fit any listed category, classify it as "personal".\n'
    : '';

  // Build dynamic category descriptions from active list
  const categoryDescriptions = activeCategories.map(cat => {
    const meta = CATEGORY_META[cat];
    const subCats = CATEGORY_SUB_DESCRIPTIONS[cat] || 'general';
    return `- ${cat}: ${meta.targetForm} — ${meta.description} (sub-categories: ${subCats})`;
  }).join('\n');

  return `You are a tax categorization assistant. Categorize each merchant by its tax relevance for a 2025 US federal return.
${contextBlock}${categoryRestriction}
Categories (use exactly these values):
${categoryDescriptions}
- personal: Not tax-relevant (groceries, restaurants, entertainment, personal shopping, subscriptions that are clearly personal, transfers between own accounts, ATM withdrawals, credit card payments, rent, personal utilities not related to home office)
- unclear: ONLY use when the merchant name is an unrecognizable alphanumeric code, a generic reference number, or truly impossible to categorize. Do NOT use "unclear" as a safe default.

IMPORTANT CLASSIFICATION GUIDELINES:
1. BE ASSERTIVE. The user has explicitly selected the categories above as relevant to their situation. If a merchant COULD reasonably fit one of the selected categories, classify it there at "medium" confidence — do NOT default to "unclear" or "personal" just because you're unsure.
2. When in doubt between a tax-relevant category and "personal", choose the tax-relevant category at "low" confidence. The user will review and can reclassify. It's better to surface a potential deduction for review than to hide it as "personal."
3. Use "personal" confidently for things that are clearly not tax-relevant: grocery stores, restaurants (unless business meals for self-employed), streaming services, personal clothing, etc.
4. Use "unclear" ONLY for merchants with no recognizable name — random alphanumeric codes, generic "POS PURCHASE" with no merchant info, or "PENDING" transactions.
5. For self-employed users: be generous with business_expense classification. Software subscriptions, internet service, phone bills, office supplies, coworking spaces, professional memberships, and similar items are likely business expenses.

TAX EVENT DETECTION:
In addition to categorizing expenses, watch for these incoming transactions and classify them as "unclear" with detailed reasoning:
- 529 plan distributions (Vanguard 529, Fidelity 529, CollegeInvest, my529, ScholarShare, CollegeAdvantage, NY 529, etc.): Flag as "This appears to be a 529 plan distribution. If used for qualified education expenses (tuition, room & board, books, supplies), it is tax-free. The earnings portion of non-qualified withdrawals is taxable + 10% penalty. Report on Form 1099-Q."
- Retirement plan distributions (Vanguard, Fidelity, Schwab, T. Rowe Price, TIAA, etc. that appear to be withdrawals, not contributions): Flag as "This may be a retirement distribution (IRA, 401k, 403b). If the account holder is under 59½, the 10% early withdrawal penalty may apply unless an exception applies (Form 5329). Report on Form 1099-R."
- Large incoming ACH transfers from brokerage/investment firms that could be capital gains distributions or fund liquidations

For each merchant, return:
- category (from list above)
- subCategory (from sub-categories above, or "general")
- confidence: "high" (clearly this category), "medium" (likely but ambiguous), "low" (uncertain)
- formLine: which IRS form/line (e.g., "Schedule C, Line 27a")
- reasoning: one sentence explaining why (for "unclear" items, provide actionable detail about what the user should check)

Respond with ONLY a JSON array, no code fences:
[{"merchant":"...","category":"...","subCategory":"...","confidence":"...","formLine":"...","reasoning":"..."}]

Merchants to categorize:
${merchantList}`;
}

// ─── Fan Out & Build Result ────────────────────────

/**
 * Fan out merchant-level AI categories to individual transactions.
 * Returns CategorizedTransaction[] with AI assignments (before cross-validation).
 */
export function fanOutCategories(
  transactions: NormalizedTransaction[],
  merchantAggregates: MerchantAggregate[],
  aiCategories: Map<string, AIMerchantCategory>,
): CategorizedTransaction[] {
  // Build merchant → aggregate lookup
  const merchantToAgg = new Map<string, MerchantAggregate>();
  for (const agg of merchantAggregates) {
    merchantToAgg.set(agg.merchant, agg);
  }

  return transactions.map((t, index) => {
    const merchant = sanitizeMerchant(t.description);
    const aiCat = aiCategories.get(merchant);

    if (aiCat) {
      return {
        transactionIndex: index,
        transaction: t,
        category: aiCat.category,
        subCategory: aiCat.subCategory,
        confidence: aiCat.confidence,
        source: 'ai' as const,
        formLine: aiCat.formLine,
        reasoning: aiCat.reasoning,
        approved: false,
        businessUsePercent: 100,
      };
    }

    // No AI category — mark as unclear
    return {
      transactionIndex: index,
      transaction: t,
      category: 'personal' as TransactionCategory,
      subCategory: 'general' as TransactionSubCategory,
      confidence: 'low' as ConfidenceLevel,
      source: 'ai' as const,
      reasoning: 'No classification returned by AI',
      approved: false,
      businessUsePercent: 100,
    };
  });
}

// ─── Summary Builder ───────────────────────────────

/**
 * Build category summaries from categorized transactions.
 */
export function buildCategorySummaries(transactions: CategorizedTransaction[]): CategorySummary[] {
  const map = new Map<TransactionCategory, CategorySummary>();

  for (const ct of transactions) {
    // Include all categories including personal (for review UI)

    const existing = map.get(ct.category);
    const amount = Math.abs(ct.transaction.amount) * (ct.businessUsePercent / 100);

    if (existing) {
      existing.totalAmount += amount;
      existing.transactionCount++;
      existing.confidenceCounts[ct.confidence]++;
    } else {
      const meta = CATEGORY_META[ct.category];
      map.set(ct.category, {
        category: ct.category,
        label: meta.label,
        totalAmount: amount,
        transactionCount: 1,
        confidenceCounts: {
          high: ct.confidence === 'high' ? 1 : 0,
          medium: ct.confidence === 'medium' ? 1 : 0,
          low: ct.confidence === 'low' ? 1 : 0,
        },
        targetForm: meta.targetForm,
        approved: false,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Build the full categorization result.
 */
export function buildCategorizationResult(transactions: CategorizedTransaction[]): CategorizationResult {
  const summaries = buildCategorySummaries(transactions);
  const personalCount = transactions.filter(t => t.category === 'personal').length;
  const reviewNeeded = transactions.filter(t => t.category === 'unclear' || t.confidence === 'low').length;
  const deductibleTotal = summaries
    .filter(s => s.category !== 'personal' && s.category !== 'unclear')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  return {
    transactions,
    summaries,
    totalProcessed: transactions.length,
    personalCount,
    reviewNeededCount: reviewNeeded,
    estimatedDeductibleTotal: Math.round(deductibleTotal),
  };
}

