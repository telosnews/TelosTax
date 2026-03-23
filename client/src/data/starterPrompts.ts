/**
 * Contextual Starter Prompts — suggested questions shown when the chat is empty.
 *
 * Prompts are resolved by: exact step/tool ID → section fallback → global default.
 * Keep prompts short (fits in narrow chat panel), actionable, and relevant to what
 * the user is currently looking at.
 */

/** Prompts for a given step or section. */
export interface StarterPromptSet {
  prompts: string[];
}

// ─── Step-Specific Prompts ──────────────────────────

const STEP_PROMPTS: Record<string, StarterPromptSet> = {
  // My Info
  filing_status: {
    prompts: [
      'What filing status should I choose?',
      'What qualifies me for Head of Household?',
      'How does filing status affect my taxes?',
    ],
  },
  dependents: {
    prompts: [
      'Who qualifies as a dependent?',
      'Can I claim my college-age child?',
      'What credits do dependents unlock?',
    ],
  },

  // Income
  income_overview: {
    prompts: [
      'Help me figure out what income to report',
      'What forms do I need to enter?',
      'What if I have income with no tax form?',
    ],
  },
  import_data: {
    prompts: [
      'What file types can I import?',
      'How does AI enhancement work?',
      'Can I import multiple forms at once?',
    ],
  },
  w2_income: {
    prompts: [
      'What do the W-2 box numbers mean?',
      'What are common Box 12 codes?',
      'I have multiple W-2s — is that normal?',
    ],
  },
  '1099nec_income': {
    prompts: [
      'Do I owe self-employment tax on 1099 income?',
      'What expenses can I deduct against this?',
      'What if my 1099-NEC amount seems wrong?',
    ],
  },
  '1099b_income': {
    prompts: [
      'What is the difference between short and long term?',
      'How do wash sales work?',
      'Can I offset gains with losses?',
    ],
  },
  '1099r_income': {
    prompts: [
      'Is my retirement distribution taxable?',
      'What do the distribution codes mean?',
      'How is a Roth conversion taxed?',
    ],
  },
  k1_income: {
    prompts: [
      'What boxes on my K-1 matter most?',
      'Is K-1 income self-employment income?',
      'What are guaranteed payments?',
    ],
  },
  home_sale: {
    prompts: [
      'Do I qualify for the home sale exclusion?',
      'What is the $250K / $500K rule?',
      'What counts toward my cost basis?',
    ],
  },
  income_summary: {
    prompts: [
      'Does my income total look correct?',
      'What adjustments reduce my AGI?',
      'Am I missing any income sources?',
    ],
  },

  // Self-Employment
  business_info: {
    prompts: [
      'What business code should I use?',
      'Cash vs. accrual accounting — which is right?',
      'What if I have multiple businesses?',
    ],
  },
  expense_categories: {
    prompts: [
      'What business expenses can I deduct?',
      'What counts as a business meal?',
      'How do I categorize this expense?',
    ],
  },
  home_office: {
    prompts: [
      'Simplified vs. actual — which method is better?',
      'What qualifies as a home office?',
      'Can I deduct rent for my home office?',
    ],
  },
  se_retirement: {
    prompts: [
      'SEP-IRA vs. Solo 401(k) — which saves more?',
      'What is the max I can contribute?',
      'Can I still make a contribution for 2025?',
    ],
  },

  // Deductions
  deductions_discovery: {
    prompts: [
      'Help me find deductions I might qualify for',
      'What deductions are available to me?',
      'Which deductions save the most money?',
    ],
  },
  deduction_method: {
    prompts: [
      'Should I itemize or take the standard deduction?',
      'What is the standard deduction for 2025?',
      'Can I itemize for state and take standard for federal?',
    ],
  },
  charitable_deduction: {
    prompts: [
      'What records do I need for donations?',
      'How do I value donated clothing or furniture?',
      'Is there a limit on charitable deductions?',
    ],
  },
  hsa_contributions: {
    prompts: [
      'What is the HSA contribution limit for 2025?',
      'Can I deduct employer HSA contributions?',
      'What happens if I over-contributed?',
    ],
  },

  // Credits
  credits_overview: {
    prompts: [
      'Help me find credits I might qualify for',
      'What is the difference between credits and deductions?',
      'Which credits are refundable?',
    ],
  },
  child_tax_credit: {
    prompts: [
      'How much is the Child Tax Credit for 2025?',
      'What is the Additional Child Tax Credit?',
      'Does the credit phase out at my income?',
    ],
  },
  education_credits: {
    prompts: [
      'American Opportunity vs. Lifetime Learning — which is better?',
      'Can I claim both a credit and a deduction?',
      'What are qualified education expenses?',
    ],
  },

  // State
  state_overview: {
    prompts: [
      'Which states do I need to file in?',
      'What if I moved states during the year?',
      'How do state taxes work with my federal return?',
    ],
  },

  // Review
  review_form_1040: {
    prompts: [
      'Walk me through my 1040',
      'Does anything look wrong on my return?',
      'What do these line numbers mean?',
    ],
  },
  tax_summary: {
    prompts: [
      'Why is my tax this amount?',
      'How can I reduce what I owe?',
      'What is my effective tax rate?',
    ],
  },

  // Finish
  refund_payment: {
    prompts: [
      'When will I get my refund?',
      'What payment options do I have?',
      'Should I adjust my withholding?',
    ],
  },
};

// ─── Tool View Prompts ──────────────────────────────

const TOOL_PROMPTS: Record<string, StarterPromptSet> = {
  explain_taxes: {
    prompts: [
      'Why is my tax this amount?',
      'Explain my effective vs. marginal rate',
      'Walk me through how my tax was calculated',
    ],
  },
  tax_scenario_lab: {
    prompts: [
      'Compare my scenarios',
      'What if I contributed more to retirement?',
      'Which scenario saves me the most?',
    ],
  },
  audit_risk: {
    prompts: [
      'What is driving my audit risk score?',
      'How can I reduce my audit risk?',
      'Which risk factors should I address first?',
    ],
  },
  yoy_comparison: {
    prompts: [
      'Why are my taxes different from last year?',
      'What changed the most year over year?',
      'Is the increase in my tax normal?',
    ],
  },
  tax_calendar: {
    prompts: [
      'When is my next tax deadline?',
      'Do I need to make estimated payments?',
      'Should I file an extension?',
    ],
  },
  expense_scanner: {
    prompts: [
      'Help me review and classify these expenses',
      'Which sub-categories should my business expenses be in?',
      'What Schedule C lines do these expenses map to?',
    ],
  },
  document_inventory: {
    prompts: [
      'What forms am I still missing?',
      'Is my return complete?',
      'What should I do before filing?',
    ],
  },
  file_extension: {
    prompts: [
      'Should I file an extension?',
      'Does an extension give me more time to pay?',
      'What is the extended deadline?',
    ],
  },
};

// ─── Section Fallback Prompts ───────────────────────

const SECTION_PROMPTS: Record<string, StarterPromptSet> = {
  my_info: {
    prompts: [
      'What filing status should I choose?',
      'How does filing status affect my taxes?',
      'Who qualifies as a dependent?',
    ],
  },
  income: {
    prompts: [
      'What income do I need to report?',
      'Help me enter my income forms',
      'What if I have income with no tax form?',
    ],
  },
  self_employment: {
    prompts: [
      'What business expenses can I deduct?',
      'How does self-employment tax work?',
      'Do I need to make estimated payments?',
    ],
  },
  deductions: {
    prompts: [
      'What deductions am I eligible for?',
      'Should I itemize or take the standard deduction?',
      'How does the SALT cap work in 2025?',
    ],
  },
  credits: {
    prompts: [
      'What tax credits might I qualify for?',
      'What is the difference between credits and deductions?',
      'Which credits are refundable?',
    ],
  },
  state: {
    prompts: [
      'How do state taxes work with federal?',
      'Which states do I need to file in?',
    ],
  },
  review: {
    prompts: [
      'Is my return complete?',
      'Walk me through my tax breakdown',
      'Are there any issues I should fix?',
    ],
  },
  finish: {
    prompts: [
      'How do I file my return?',
      'When will I get my refund?',
      'Should I file electronically or by mail?',
    ],
  },
};

// ─── Default Prompts ────────────────────────────────

const DEFAULT_PROMPTS: StarterPromptSet = {
  prompts: [
    'What credits am I eligible for?',
    'How can I reduce my taxes?',
    'Walk me through entering my income',
  ],
};

// ─── Resolver ───────────────────────────────────────

/**
 * Nudge-derived prompt (from the proactive nudge system).
 * When active nudges exist, their chat prompts are shown first
 * so the user can ask about unclaimed benefits with one click.
 */
export interface NudgePrompt {
  prompt: string;
  /** Benefit amount for display, e.g. "$4,400" */
  benefitLabel?: string;
}

/**
 * Resolve starter prompts for the current step/tool.
 * Priority: nudge prompts (if any) → tool ID → step ID → section → global default.
 *
 * When nudges are active, up to 2 nudge-derived prompts are prepended,
 * replacing the least-relevant static prompts to keep the total at 3.
 */
export function getStarterPrompts(stepId: string, section: string, nudgePrompts?: NudgePrompt[]): string[] {
  // Resolve the base static prompts
  let base: string[];
  if (TOOL_PROMPTS[stepId]) base = TOOL_PROMPTS[stepId].prompts;
  else if (STEP_PROMPTS[stepId]) base = STEP_PROMPTS[stepId].prompts;
  else if (SECTION_PROMPTS[section]) base = SECTION_PROMPTS[section].prompts;
  else base = DEFAULT_PROMPTS.prompts;

  // Prepend nudge-derived prompts (max 2), trimming static prompts to keep total at 3
  if (nudgePrompts && nudgePrompts.length > 0) {
    const nudgeTexts = nudgePrompts.slice(0, 2).map((n) => n.prompt);
    const remaining = base.slice(0, 3 - nudgeTexts.length);
    return [...nudgeTexts, ...remaining];
  }

  return base;
}

/**
 * Get the single best "Guide Me" prompt for the current step.
 * Used by the floating Telos AI button.
 *
 * If a step has a custom prompt, use it. Otherwise, generate a
 * context-aware prompt using the step label so the AI always gets
 * a specific question rather than a generic section fallback.
 */
export function getGuidePrompt(stepId: string, section: string, stepLabel?: string): string {
  // Prefer step-specific or tool-specific prompts
  if (TOOL_PROMPTS[stepId]) return TOOL_PROMPTS[stepId].prompts[0];
  if (STEP_PROMPTS[stepId]) return STEP_PROMPTS[stepId].prompts[0];

  // Generate a context-aware prompt from the step label
  if (stepLabel) {
    return `Guide me through the ${stepLabel} step. What goes here, what should I know, and what are common mistakes?`;
  }

  // Section fallback
  if (SECTION_PROMPTS[section]) return SECTION_PROMPTS[section].prompts[0];
  return DEFAULT_PROMPTS.prompts[0];
}
