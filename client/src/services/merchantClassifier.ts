/**
 * Merchant Classifier — AI-powered merchant classification for Deduction Finder
 *
 * Three responsibilities:
 *   A. API client: sends merchant names to /api/batch/classify-merchants
 *   B. Sanitizer: strips potential PII from merchant descriptions
 *   C. Deterministic mapping: businessType → InsightCategory (tax advice boundary)
 *   D. AI insight generator: builds DeductionInsight[] from classifications
 *
 * Tax advice boundary: The AI only classifies what a merchant IS.
 * The BUSINESS_TYPE_MAP is deterministic code that maps types to potential
 * tax categories. All descriptions use review language ("may be relevant IF...").
 * The user decides what's business vs. personal.
 */

import type { ReturnContext, DeductionInsight, InsightCategory, NormalizedTransaction, MatchReason } from './deductionFinderTypes';

// ─── Types ──────────────────────────────────────────

export interface MerchantClassification {
  merchant: string;
  businessType: string;
}

// ─── A. API Client ──────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ClassifyOptions {
  provider: string;
  apiKey: string;
  model: string;
}

/**
 * Send merchant names to the batch classification endpoint.
 * Batches in chunks of 75 to keep each LLM call under the timeout.
 *
 * @param onProgress - optional callback reporting (completed, total) merchants
 */
export async function classifyMerchantsWithAI(
  merchants: string[],
  context: ReturnContext,
  options: ClassifyOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<MerchantClassification[]> {
  const BATCH_SIZE = 75;
  const TIMEOUT_MS = 120_000; // 2 minutes per batch
  const allClassifications: MerchantClassification[] = [];

  for (let i = 0; i < merchants.length; i += BATCH_SIZE) {
    const batch = merchants.slice(i, i + BATCH_SIZE);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}/api/batch/classify-merchants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          merchants: batch,
          context: {
            hasScheduleC: context.hasScheduleC,
            hasHomeOffice: context.hasHomeOffice,
            hasRentalIncome: false,
            deductionMethod: context.deductionMethod,
          },
          provider: options.provider,
          apiKey: options.apiKey,
          model: options.model,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        const msg = (errorBody as any)?.error?.message || `Classification failed (${res.status})`;
        throw new Error(msg);
      }

      const body = await res.json();
      const classifications: MerchantClassification[] = body?.data?.classifications ?? [];
      allClassifications.push(...classifications);

      onProgress?.(Math.min(i + BATCH_SIZE, merchants.length), merchants.length);
    } finally {
      clearTimeout(timeout);
    }
  }

  return allClassifications;
}

// ─── B. Merchant Name Sanitizer ─────────────────────

/** Strip potential PII from merchant description before sending to AI. */
export function sanitizeMerchant(description: string): string {
  let cleaned = description.toUpperCase().trim();
  // Remove sequences of 4+ digits (card numbers, account references)
  cleaned = cleaned.replace(/\b\d{4,}\b/g, '');
  // Remove account/reference patterns
  cleaned = cleaned.replace(/\b(ACCT|ACCOUNT|REF|CARD|ENDING)\s*#?\s*\d*/gi, '');
  // Remove embedded dates
  cleaned = cleaned.replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, '');
  // Collapse whitespace
  return cleaned.trim().replace(/\s{2,}/g, ' ');
}

// ─── C. Deterministic Business Type → Category Map ──

/**
 * Maps AI-returned businessType keywords to potential tax categories.
 *
 * CRITICAL: This is the tax advice boundary. The AI classifies what a
 * merchant IS; this map decides potential tax relevance using deterministic
 * gates and review language. The USER makes the final decision.
 */

interface BusinessTypeMapping {
  /** Keywords to match in the AI's businessType string (lowercase) */
  keywords: string[];
  /** Target insight category */
  category: InsightCategory;
  /**
   * Relevance check: returns true if user's profile makes this category likely relevant.
   * Unlike hard gates, failing this check does NOT suppress the insight — it lowers
   * confidence to 'low' instead. This supports discovery: the user may not have set up
   * Schedule C yet, but AI can still surface potential business expenses.
   */
  isRelevant: (ctx: ReturnContext) => boolean;
  /** Insight card title */
  title: string;
  /** Insight card description — MUST use review language */
  description: string;
  /** Statutory max or benefit note */
  statutoryMax: string;
  /** Wizard step to navigate to */
  actionStepId: string;
  /** Scoring weights */
  impactScore: number;
  easeScore: number;
}

const BUSINESS_TYPE_MAPPINGS: BusinessTypeMapping[] = [
  // ── Business Software / SaaS ──
  {
    keywords: ['software', 'saas', 'cloud computing', 'cloud service', 'cloud storage', 'web hosting', 'domain'],
    category: 'business_software',
    isRelevant: (ctx) => ctx.hasScheduleC,
    title: 'Software & Cloud Services',
    description: 'These transactions appear to be software or cloud services. If used for your business, they may be relevant to your Schedule C business expenses.',
    statutoryMax: 'ordinary and necessary business expense',
    actionStepId: 'expense_categories',
    impactScore: 0.6,
    easeScore: 0.8,
  },
  // ── Business Travel ──
  {
    keywords: ['airline', 'hotel', 'car rental', 'travel agency', 'lodging', 'flight'],
    category: 'business_travel',
    isRelevant: (ctx) => ctx.hasScheduleC,
    title: 'Travel',
    description: 'These transactions appear to be travel charges. If related to business travel, they may be relevant to your Schedule C travel expenses.',
    statutoryMax: 'ordinary and necessary business expense',
    actionStepId: 'expense_categories',
    impactScore: 0.6,
    easeScore: 0.7,
  },
  // ── Business Meals ──
  {
    keywords: ['restaurant', 'dining', 'catering', 'food delivery'],
    category: 'business_meals',
    isRelevant: (ctx) => ctx.hasScheduleC,
    title: 'Meals',
    description: 'These transactions appear to be dining or food service charges. If business meals with clients or while traveling for business, they may be partially relevant to Schedule C (50% limit).',
    statutoryMax: '50% of business meal costs',
    actionStepId: 'expense_categories',
    impactScore: 0.4,
    easeScore: 0.6,
  },
  // ── Office Supplies ──
  {
    keywords: ['office supply', 'stationery', 'office product', 'printer', 'ink', 'toner'],
    category: 'home_office_supplies',
    isRelevant: (ctx) => ctx.hasScheduleC || ctx.hasHomeOffice,
    title: 'Office Supplies',
    description: 'These transactions appear to be office supply purchases. If for your business or home office, they may be relevant to your business expenses.',
    statutoryMax: 'ordinary and necessary business expense',
    actionStepId: 'expense_categories',
    impactScore: 0.5,
    easeScore: 0.8,
  },
  // ── Business Telecom ──
  {
    keywords: ['telecom', 'phone service', 'internet service', 'mobile carrier', 'wireless'],
    category: 'business_telecom',
    isRelevant: (ctx) => ctx.hasScheduleC,
    title: 'Phone & Internet',
    description: 'These transactions appear to be telecom services. If you use these for your business, the business-use portion may be relevant to your Schedule C expenses.',
    statutoryMax: 'business-use percentage',
    actionStepId: 'expense_categories',
    impactScore: 0.4,
    easeScore: 0.7,
  },
  // ── Advertising / Marketing ──
  {
    keywords: ['advertising', 'marketing', 'social media ads', 'google ads', 'meta ads', 'facebook ads'],
    category: 'advertising_marketing',
    isRelevant: (ctx) => ctx.hasScheduleC,
    title: 'Advertising & Marketing',
    description: 'These transactions appear to be advertising or marketing services. If for your business, they may be relevant to your Schedule C advertising expenses.',
    statutoryMax: 'ordinary and necessary business expense',
    actionStepId: 'expense_categories',
    impactScore: 0.6,
    easeScore: 0.8,
  },
  // ── Coworking / Office Space ──
  {
    keywords: ['coworking', 'office space', 'shared office', 'workspace rental'],
    category: 'coworking_office_rent',
    isRelevant: (ctx) => ctx.hasScheduleC,
    title: 'Workspace Rental',
    description: 'These transactions appear to be workspace or office rental charges. If for your business, they may be relevant to your Schedule C rent expense.',
    statutoryMax: 'ordinary and necessary business expense',
    actionStepId: 'expense_categories',
    impactScore: 0.6,
    easeScore: 0.8,
  },
  // ── Tax / Accounting ──
  {
    keywords: ['accounting', 'tax service', 'tax preparation', 'bookkeeping', 'cpa', 'payroll service'],
    category: 'tax_prep',
    isRelevant: (ctx) => ctx.hasScheduleC,
    title: 'Tax & Accounting Services',
    description: 'These transactions appear to be tax or accounting services. If for your business, they may be relevant to your Schedule C professional fees.',
    statutoryMax: 'ordinary and necessary business expense',
    actionStepId: 'expense_categories',
    impactScore: 0.5,
    easeScore: 0.9,
  },
  // ── Professional Development / Education ──
  {
    keywords: ['continuing education', 'online course', 'training', 'conference', 'seminar', 'certification', 'professional development'],
    category: 'continuing_education',
    isRelevant: (ctx) => ctx.hasScheduleC,
    title: 'Professional Development',
    description: 'These transactions appear to be education or training expenses. If related to maintaining or improving skills for your current business, they may be relevant to your Schedule C expenses.',
    statutoryMax: 'ordinary and necessary business expense',
    actionStepId: 'expense_categories',
    impactScore: 0.5,
    easeScore: 0.7,
  },
  // ── Professional Dues ──
  {
    keywords: ['professional association', 'membership dues', 'trade association', 'union dues'],
    category: 'professional_dues',
    isRelevant: (ctx) => ctx.hasScheduleC,
    title: 'Professional Memberships',
    description: 'These transactions appear to be professional association or membership dues. If for your business profession, they may be relevant to your Schedule C expenses.',
    statutoryMax: 'ordinary and necessary business expense',
    actionStepId: 'expense_categories',
    impactScore: 0.4,
    easeScore: 0.9,
  },
  // ── Business Insurance ──
  {
    keywords: ['business insurance', 'liability insurance', 'professional insurance', 'e&o insurance'],
    category: 'business_insurance',
    isRelevant: (ctx) => ctx.hasScheduleC,
    title: 'Business Insurance',
    description: 'These transactions appear to be business insurance premiums. If for your business, they may be relevant to your Schedule C insurance expense.',
    statutoryMax: 'ordinary and necessary business expense',
    actionStepId: 'expense_categories',
    impactScore: 0.5,
    easeScore: 0.9,
  },
  // ── Medical / Pharmacy (non-business) ──
  {
    keywords: ['pharmacy', 'medical', 'hospital', 'doctor', 'dental', 'vision', 'optometrist', 'urgent care', 'laboratory', 'physical therapy'],
    category: 'medical',
    isRelevant: (ctx) => ctx.deductionMethod === 'itemized' || ctx.itemizingDelta > -2000,
    title: 'Medical Expenses',
    description: 'These transactions appear to be medical or pharmacy charges. If for medical care, they may be relevant to your itemized medical expense deduction (amounts exceeding 7.5% of AGI).',
    statutoryMax: 'amount exceeding 7.5% of AGI',
    actionStepId: 'medical_expenses',
    impactScore: 0.5,
    easeScore: 0.6,
  },
  // ── Therapy / Mental Health ──
  {
    keywords: ['therapy', 'counseling', 'mental health', 'psychologist', 'psychiatrist', 'behavioral health'],
    category: 'therapy_mental_health',
    isRelevant: (ctx) => ctx.deductionMethod === 'itemized' || ctx.itemizingDelta > -2000,
    title: 'Therapy & Mental Health',
    description: 'These transactions appear to be therapy or mental health services. If for medical care, they may be relevant to your itemized medical expense deduction.',
    statutoryMax: 'amount exceeding 7.5% of AGI',
    actionStepId: 'medical_expenses',
    impactScore: 0.5,
    easeScore: 0.6,
  },
  // ── Charitable / Nonprofit ──
  {
    keywords: ['charity', 'nonprofit', 'donation', 'foundation', 'united way', 'red cross', 'salvation army', 'goodwill'],
    category: 'charitable',
    isRelevant: (ctx) => ctx.deductionMethod === 'itemized' || ctx.itemizingDelta > -2000,
    title: 'Charitable Contributions',
    description: 'These transactions appear to be charitable organizations. If these are donations to qualified 501(c)(3) organizations, they may be relevant to your itemized charitable deduction.',
    statutoryMax: 'up to 60% of AGI (cash donations)',
    actionStepId: 'charitable_deductions',
    impactScore: 0.6,
    easeScore: 0.7,
  },
  // ── Childcare ──
  {
    keywords: ['daycare', 'childcare', 'preschool', 'after school', 'nanny service', 'babysitter'],
    category: 'childcare',
    isRelevant: (ctx) => ctx.minorDependentCount > 0,
    title: 'Child & Dependent Care',
    description: 'These transactions appear to be childcare or dependent care expenses. If paid so you (and your spouse) could work, they may be relevant to the Child and Dependent Care Credit.',
    statutoryMax: 'up to $3,000 (one) or $6,000 (two+) in qualifying expenses',
    actionStepId: 'dependent_care',
    impactScore: 0.7,
    easeScore: 0.7,
  },
  // ── Energy Efficiency / Home Improvement ──
  {
    keywords: ['solar', 'solar panel', 'heat pump', 'insulation', 'energy audit', 'ev charger', 'battery storage'],
    category: 'energy_efficiency',
    isRelevant: () => true,
    title: 'Energy Efficiency',
    description: 'These transactions appear to be energy efficiency purchases. If for qualifying home improvements (heat pump, insulation, solar, etc.), they may be relevant to energy tax credits.',
    statutoryMax: 'up to $3,200/year (efficiency) or 30% (solar/clean energy)',
    actionStepId: 'energy_efficiency',
    impactScore: 0.7,
    easeScore: 0.6,
  },
  // ── Rideshare / Delivery (potential business use) ──
  {
    keywords: ['rideshare', 'uber', 'lyft', 'taxi', 'car service'],
    category: 'business_travel',
    isRelevant: (ctx) => ctx.hasScheduleC,
    title: 'Transportation',
    description: 'These transactions appear to be rideshare or transportation charges. If for business travel, they may be relevant to your Schedule C transportation expenses.',
    statutoryMax: 'ordinary and necessary business expense',
    actionStepId: 'expense_categories',
    impactScore: 0.4,
    easeScore: 0.7,
  },
  // ── Payment Processing ──
  {
    keywords: ['payment processing', 'stripe', 'square', 'paypal fee', 'merchant services'],
    category: 'payment_processing_fees',
    isRelevant: (ctx) => ctx.hasScheduleC,
    title: 'Payment Processing Fees',
    description: 'These transactions appear to be payment processing fees. If for your business, they may be relevant to your Schedule C commission or fees expense.',
    statutoryMax: 'ordinary and necessary business expense',
    actionStepId: 'expense_categories',
    impactScore: 0.5,
    easeScore: 0.9,
  },
];

// ─── D. AI Insight Generator ────────────────────────

/**
 * Generate DeductionInsight[] from AI classifications + original transactions.
 *
 * Flow:
 * 1. Build a lookup: merchant name → businessType
 * 2. For each mapping in BUSINESS_TYPE_MAPPINGS, find matching transactions
 * 3. Check gate against ReturnContext
 * 4. Build insight with review language and source: 'ai'
 */
export function generateAIInsights(
  classifications: MerchantClassification[],
  transactions: NormalizedTransaction[],
  context: ReturnContext,
): DeductionInsight[] {
  // Build merchant → businessType lookup
  const merchantTypeMap = new Map<string, string>();
  for (const c of classifications) {
    merchantTypeMap.set(c.merchant.toUpperCase().trim(), c.businessType);
  }

  // For each mapping, collect matching transactions
  const insights: DeductionInsight[] = [];
  const usedCategories = new Set<InsightCategory>();

  for (const mapping of BUSINESS_TYPE_MAPPINGS) {
    if (usedCategories.has(mapping.category)) continue;

    // Find transactions whose merchant's businessType matches this mapping's keywords
    // Must sanitize descriptions to match the keys in merchantTypeMap (which came from sanitized names)
    const matchingTxns: NormalizedTransaction[] = [];
    for (const txn of transactions) {
      const desc = sanitizeMerchant(txn.description);
      const bizType = merchantTypeMap.get(desc);
      if (!bizType) continue;
      if (mapping.keywords.some((kw) => bizType.includes(kw))) {
        matchingTxns.push(txn);
      }
    }

    if (matchingTxns.length === 0) continue;
    usedCategories.add(mapping.category);

    // Relevance check: context match → medium confidence, no match → low
    // This is discovery mode — we show everything, just at lower confidence
    // when the user's profile doesn't match (e.g., no Schedule C yet)
    const relevant = mapping.isRelevant(context);
    const confidence: 'medium' | 'low' = relevant ? 'medium' : 'low';
    const confidenceScore = relevant ? 0.6 : 0.3;

    // Build the insight
    const totalAmount = matchingTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const sampleDescriptions = matchingTxns
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 100)
      .map((t) => t.description);

    const matchReasons: MatchReason[] = [{
      kind: 'ai_classification',
      value: mapping.keywords[0],
      label: `AI: ${mapping.keywords[0]}`,
    }];

    // Composite score: same formula as rule engine
    const compositeScore = Math.min(
      1,
      0.4 * confidenceScore + 0.4 * mapping.impactScore + 0.2 * mapping.easeScore +
      (matchingTxns.length >= 5 ? 0.05 : 0),
    );

    insights.push({
      id: `ai_${mapping.category}`,
      category: mapping.category,
      confidence,
      title: mapping.title,
      description: mapping.description,
      statutoryMax: mapping.statutoryMax,
      actionStepId: mapping.actionStepId,
      signalCount: matchingTxns.length,
      sampleDescriptions,
      compositeScore,
      totalAmount,
      averageAmount: totalAmount / matchingTxns.length,
      recurrenceScore: 0,
      matchReasons,
      source: 'ai',
    });
  }

  return insights.sort((a, b) => b.compositeScore - a.compositeScore);
}

// ─── Merge Helpers ──────────────────────────────────

/**
 * Merge rule-engine insights with AI insights.
 * Rule insights always win for the same category (higher precision).
 */
export function mergeInsights(
  ruleInsights: DeductionInsight[],
  aiInsights: DeductionInsight[],
): DeductionInsight[] {
  const ruleCategories = new Set(ruleInsights.map((i) => i.category));

  // Mark rule insights
  const marked = ruleInsights.map((i) => ({ ...i, source: 'rule' as const }));

  // Filter AI insights that don't duplicate rule categories
  const unique = aiInsights.filter((i) => !ruleCategories.has(i.category));

  return [...marked, ...unique].sort((a, b) => b.compositeScore - a.compositeScore);
}
