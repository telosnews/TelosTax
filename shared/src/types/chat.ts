/**
 * Chat Types — shared between server and client.
 *
 * Defines the action schema, request/response shapes, and context
 * structure for the AI chat assistant feature.
 */

// ─── Action Types ──────────────────────────────────

export type ChatAction =
  | { type: 'add_income'; incomeType: string; fields: Record<string, unknown> }
  | { type: 'set_filing_status'; status: string }
  | { type: 'add_dependent'; fields: Record<string, unknown> }
  | { type: 'set_deduction_method'; method: 'standard' | 'itemized' }
  | { type: 'update_itemized'; fields: Record<string, number> }
  | { type: 'set_income_discovery'; incomeType: string; value: 'yes' | 'no' }
  | { type: 'update_field'; field: string; value: unknown }
  | { type: 'navigate'; stepId: string }
  | { type: 'add_business_expense'; category: string; amount: number; description?: string }
  | { type: 'remove_item'; itemType: string; match: Record<string, unknown> }
  | { type: 'update_home_office'; fields: Record<string, unknown> }
  | { type: 'update_vehicle'; fields: Record<string, unknown> }
  | { type: 'update_business'; fields: Record<string, unknown> }
  | { type: 'update_se_retirement'; fields: Record<string, unknown> }
  | { type: 'no_action' };

// ─── Context (PII-safe metadata sent to LLM) ──────

export interface ChatContext {
  /** Current wizard step ID (e.g., "w2_income"). */
  currentStep: string;
  /** Current wizard section (e.g., "income"). */
  currentSection: string;
  /** Filing status as string (e.g., "single"), NOT the enum value. */
  filingStatus?: string;
  /** Income discovery flags. */
  incomeDiscovery: Record<string, string>;
  /** Deduction method if already chosen. */
  deductionMethod?: string;
  /** Number of dependents (count only, no names). */
  dependentCount: number;
  /** Count of income items by type (e.g., { w2: 2, '1099nec': 1 }). */
  incomeTypeCounts: Record<string, number>;
  /** Compact text summary of calculation traces (values, formulas, authorities).
   *  Used by the LLM to answer "why is my tax $X?" questions with grounded data.
   *  No PII — only aggregate dollar amounts and form line references. */
  traceContext?: string;
  /** Text summary of visible/hidden wizard steps with declarative condition descriptions.
   *  Used by the LLM to explain why a step is visible or hidden. */
  flowContext?: string;
  /** Text summary of active deduction/credit suggestions the user hasn't acted on.
   *  Lets the AI proactively mention missed benefits during conversation. */
  suggestionsContext?: string;
  /** Text summary of active validation warnings (cross-field conflicts, inconsistencies).
   *  Lets the AI reference specific issues like filing status mismatches or CTC count errors. */
  warningsContext?: string;
  /** Text summary of Deduction Finder scan results (bank/credit card statement analysis).
   *  Includes insight categories, confidence, transaction counts, and aggregate amounts.
   *  No raw merchant names or transaction descriptions (privacy). */
  deductionFinderContext?: string;
  /** Text summary of active Tax Scenario Lab scenarios and their what-if impact.
   *  Includes scenario names, override counts, and key delta metrics (refund, AGI, etc.).
   *  No PII — only aggregate dollar amounts and percentage changes. */
  scenarioLabContext?: string;
  /** Text summary of field values on the current wizard step.
   *  Lets the AI see what the user has entered (e.g., "Solo 401k deferral: ~$31,000").
   *  No PII — only dollar amounts (privacy-rounded), counts, and enums. */
  stepFieldsContext?: string;
  /** Text summary of audit risk assessment results.
   *  Includes risk score, level, triggered factors, explanations, and mitigation tips.
   *  Always present when there are triggered risk factors, regardless of current step. */
  auditRiskContext?: string;
  /** Text summary of upcoming tax deadlines (filing, payments, contributions).
   *  Personalized based on the user's return data (e.g., estimated payments if SE). */
  taxCalendarContext?: string;
  /** Text summary of document/form completeness — what's entered, pending, incomplete.
   *  Lets the AI answer "what's missing?" or "is my return complete?" */
  documentInventoryContext?: string;
  /** Text summary of prior year vs. current year comparison (if prior year data loaded).
   *  Shows key metric changes (income, AGI, tax, refund) year over year. */
  yearOverYearContext?: string;
  /** Text summary of extracted data from an attached document (PDF/image).
   *  Includes form type, field values, confidence level, and warnings.
   *  Used by the LLM to propose add_income actions from document imports. */
  documentExtractionContext?: string;
  /** Detailed form field data for AI review/explain actions in Forms Mode.
   *  Injected by openWithPrompt when triggered from the PDF viewer.
   *  Contains field values, auto-detected issues, and form structure. */
  formsReviewContext?: string;
}

// ─── Request / Response ────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  /** The user's message. */
  message: string;
  /** Recent conversation history (max 10 messages). */
  conversationHistory: ChatMessage[];
  /** PII-safe wizard context. */
  context: ChatContext;
}

export interface ChatResponse {
  /** Natural language response to display. */
  message: string;
  /** Structured actions to execute (may be empty). */
  actions: ChatAction[];
  /** Optional wizard step to navigate to. */
  suggestedStep: string | null;
  /** 2-3 contextual follow-up questions the user might ask next. */
  followUpChips?: string[];
}

// ─── Chat Status ───────────────────────────────────

export interface ChatStatus {
  /** Whether the chat feature is enabled (has valid API key). */
  enabled: boolean;
  /** The LLM model being used, or null if disabled. */
  model: string | null;
  /** The active AI mode, if applicable. */
  mode?: 'private' | 'byok';
  /** The cloud provider being used, if applicable. */
  provider?: 'anthropic';
}
