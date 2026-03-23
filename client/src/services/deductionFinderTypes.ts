/**
 * Deduction Finder — Type Definitions
 *
 * All types for the bank/credit card statement scanning feature.
 * Zero external dependencies.
 */

// ─── Transaction Types ──────────────────────────────

export interface NormalizedTransaction {
  date: string;          // YYYY-MM-DD
  description: string;   // Cleaned merchant description
  amount: number;        // Positive = debit/expense, negative = credit/refund
  originalRow: number;   // Row number in source CSV (for debugging)
  mccCode?: string;      // Merchant Category Code (e.g. '5912') — present when CSV includes MCC column
  sourceFile?: string;   // Which uploaded file this transaction came from (for multi-file support)
}

// ─── Return Context ─────────────────────────────────

export interface ReturnContext {
  filingStatus: number | null;
  dependentCount: number;
  minorDependentCount: number;   // Age < 13 (for childcare gating)
  childUnder17Count: number;     // Age < 17 (for CTC gating)
  deductionMethod: 'standard' | 'itemized';
  hasScheduleC: boolean;
  hasHomeOffice: boolean;
  hasHSA: boolean;
  hasStudentLoanInterest: boolean;
  hasMortgageInterest: boolean;
  hasCharitableDeductions: boolean;
  hasMedicalExpenses: boolean;
  hasSEHealthInsurance: boolean;
  hasGamblingWinnings: boolean;
  hasSALT: boolean;              // State/local or real estate taxes entered
  itemizingDelta: number;        // itemizedTotal - standardDeduction (negative = standard is better)
  agi: number;
  marginalRate: number;
}

// ─── Match Reason Types ─────────────────────────────

export interface MatchReason {
  kind: 'merchant_token' | 'evidence_token' | 'mcc_match' | 'mcc_boost' | 'fuzzy_match' | 'ai_classification';
  value: string;
  label?: string;
}

// ─── Recurrence Types ───────────────────────────────

export interface RecurrencePattern {
  monthsActive: number;          // Distinct calendar months with transactions
  averageIntervalDays: number;   // Mean days between consecutive transactions
  score: number;                 // 0-1 composite recurrence strength
}

// ─── Insight Types ──────────────────────────────────

export type InsightCategory =
  | 'student_loan'
  | 'childcare'
  | 'charitable'
  | 'mortgage'
  | 'hsa'
  | 'medical'
  | 'home_office_supplies'
  | 'se_health_insurance'
  | 'educator_expenses'
  | 'retirement_contributions'
  | 'tax_prep'
  | 'business_software'
  | 'business_travel'
  | 'business_telecom'
  | 'energy_efficiency'
  | 'therapy_mental_health'
  // Phase 4 — Tier A
  | 'advertising_marketing'
  | 'payment_processing_fees'
  | 'contract_labor'
  | 'vehicle_business'
  | 'professional_development'
  | 'coworking_office_rent'
  | 'business_insurance'
  // Phase 4 — Tier B
  | 'gambling_losses'
  | 'education_credits'
  | 'salt_property_tax'
  | 'business_meals'
  // Phase 4 — Tier C
  | 'military_moving'
  | 'professional_dues'
  | 'continuing_education';

export type ConfidenceTier = 'high' | 'medium' | 'low';

export interface DeductionInsight {
  id: string;                     // Stable: `${pattern.id}_${taxYear}`
  category: InsightCategory;
  confidence: ConfidenceTier;
  title: string;
  description: string;
  statutoryMax: string;           // e.g. "up to $2,500"
  actionStepId: string;           // Wizard step to navigate to
  signalCount: number;            // Number of matching transactions
  sampleDescriptions: string[];   // Up to 5 sample transaction descriptions (sorted by amount desc)
  compositeScore: number;         // 0-1 ranking score
  totalAmount: number;            // Sum of matched transaction amounts
  averageAmount: number;          // Mean matched amount
  recurrenceScore: number;        // 0-1 recurring charge strength (meaningful when recurrenceRelevant)
  matchReasons: MatchReason[];    // Why each rule fired (for UI display)
  existingDataNote?: string;      // Present when insight fires but user already has partial data entered
  source?: 'rule' | 'ai';        // Origin: rule engine (default) or AI classification
}

// ─── Declarative Gate Requirements ──────────────────

/** Extract boolean-valued keys from a type. */
type BooleanKeysOf<T> = {
  [K in keyof T]: T[K] extends boolean ? K : never;
}[keyof T];

/** Extract number-valued keys from a type. */
type NumericKeysOf<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

/** Flat requirements object for pattern gating. All conditions are AND-ed.
 *  JSON-serializable for community pattern packs. */
export interface PatternRequirements {
  /** Boolean context fields that must be true */
  requireTrue?: BooleanKeysOf<ReturnContext>[];
  /** Boolean context fields that must be false (suppress if already claimed) */
  requireFalse?: BooleanKeysOf<ReturnContext>[];
  /** Numeric context fields that must be > 0 */
  requirePositive?: NumericKeysOf<ReturnContext>[];
  /** Require itemizing deductions (ctx.deductionMethod === 'itemized') */
  requireItemizing?: boolean;
  /** Minimum AGI threshold */
  minAGI?: number;
  /** Maximum AGI threshold */
  maxAGI?: number;
  /** Context fields indicating existing data for additive categories.
   *  Used for informational annotation — NOT for suppression.
   *  When any of these are true, the insight fires with an existingDataNote. */
  existingDataKeys?: BooleanKeysOf<ReturnContext>[];
}

// ─── Pattern Types ──────────────────────────────────

export interface MerchantPattern {
  id: string;                     // Stable identifier (e.g. 'home_office', 'medical')
  category: InsightCategory;
  merchants: string[];            // Substring matches (uppercased)
  confidence: ConfidenceTier;
  evidenceTokens?: string[];      // Require at least one of these tokens (e.g. 'RX', 'PHARM')
  negativeTokens?: string[];      // If any appear in description, suppress the match
  /** Per-pattern matching mode for merchant tokens:
   *  'substring' (default) — uses .includes(), works for long unambiguous strings.
   *  'word_boundary' — uses regex word boundaries, for short/collision-prone tokens. */
  matchMode?: 'substring' | 'word_boundary';
  /** Whether recurrence detection is relevant for this pattern.
   *  true = subscriptions, memberships, recurring services (recurrence boosts score).
   *  false/omit = one-off deductions like solar installs, hospital visits. */
  recurrenceRelevant?: boolean;
  /** MCC codes that confirm this pattern (e.g. ['5912'] for pharmacies → medical).
   *  When a transaction's MCC matches, it boosts confidence scoring. */
  mccCodes?: string[];
  /** Declarative requirements object or function escape hatch for custom logic. */
  gate: PatternRequirements | ((ctx: ReturnContext) => boolean);
  title: string;
  description: string;
  statutoryMax: string;
  actionStepId: string;
  impactScore: number;            // 0-1
  easeScore: number;              // 0-1
}

// ─── Component State ────────────────────────────────

export interface UploadedFileInfo {
  name: string;
  format: string;
  transactionCount: number;
  addedAt: string;
}

export interface DeductionFinderState {
  insights: DeductionInsight[];
  fileName: string;               // Last uploaded file name (backward compat)
  uploadedFiles: UploadedFileInfo[];
  detectedFormat: string;
  warnings: string[];
  scannedAt: string;              // ISO timestamp
  totalTransactionCount: number;
  crossFileDuplicateCount: number;
}

// ─── Parser Result ──────────────────────────────────

export interface ParseResult {
  transactions: NormalizedTransaction[];
  warnings: string[];
  detectedFormat: string;
}
