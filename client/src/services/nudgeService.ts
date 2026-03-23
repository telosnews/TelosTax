/**
 * Proactive Nudge Service
 *
 * Transforms deterministic suggestions and warnings into prioritized,
 * contextual nudges. The suggestion engine (getSuggestions) serves as the
 * eligibility gate — no nudge can surface without passing deterministic checks.
 *
 * Design constraint (from GPT-5.2): "LLM generates suggestions that must pass
 * deterministic eligibility checks before being shown." The LLM only enriches
 * descriptions; it never decides whether to show a nudge.
 */

import type { TaxReturn, CalculationResult } from '@telostax/engine';
import { getSuggestions, type TaxSuggestion } from './suggestionService';

// ─── Types ─────────────────────────────────────────

export interface ProactiveNudge {
  id: string;
  source: 'suggestion' | 'milestone';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedBenefit?: number;
  stepId?: string;
  discoveryKey?: string;
  chatPrompt: string;
  dismissible: boolean;
  variant: 'tip' | 'info';
}

/** Map suggestion stepIds to the wizard sections where they're most relevant. */
const STEP_SECTION_MAP: Record<string, string> = {
  child_tax_credit: 'credits',
  dependent_care: 'credits',
  elderly_disabled: 'credits',
  savers_credit: 'credits',
  education_credits: 'credits',
  foreign_tax_credit: 'credits',
  deduction_method: 'deductions',
  salt_deduction: 'deductions',
  hsa_contributions: 'deductions',
  student_loan_ded: 'deductions',
  estimated_payments: 'financial',
  form5329: 'income',
  state_overview: 'state',
  schedule1a: 'income',
};

/** Section ordering for step relevance scoring. */
const SECTION_ORDER = ['my_info', 'income', 'self_employment', 'deductions', 'credits', 'state', 'financial', 'review'];

// ─── Core Service ──────────────────────────────────

/**
 * Compute proactive nudges from the current tax return state.
 * Pure function — deterministic, no side effects.
 *
 * @param currentStepId - Current wizard step (for context relevance)
 * @param currentSection - Current wizard section (for priority boosting)
 */
export function computeNudges(
  taxReturn: TaxReturn,
  calculation: CalculationResult | null | undefined,
  currentStepId: string,
  currentSection: string,
  dismissedIds: string[] = [],
): ProactiveNudge[] {
  const suggestions = getSuggestions(taxReturn, calculation);
  const dismissed = new Set(dismissedIds);

  const nudges: ProactiveNudge[] = [];

  for (const s of suggestions) {
    if (dismissed.has(s.id)) continue;

    const priority = scorePriority(s, currentSection);
    const chatPrompt = buildChatPrompt(s);

    nudges.push({
      id: s.id,
      source: 'suggestion',
      priority,
      title: s.title,
      description: s.description,
      estimatedBenefit: s.estimatedBenefit,
      stepId: s.stepId,
      discoveryKey: s.discoveryKey,
      chatPrompt,
      dismissible: true,
      variant: s.estimatedBenefit && s.estimatedBenefit > 500 ? 'tip' : 'info',
    });
  }

  // Add milestone nudges
  const milestones = detectMilestones(taxReturn, calculation, currentSection);
  for (const m of milestones) {
    if (dismissed.has(m.id)) continue;
    nudges.push(m);
  }

  // Sort: high priority first, then by estimated benefit descending
  nudges.sort((a, b) => {
    const pOrder = { high: 0, medium: 1, low: 2 };
    const pDiff = pOrder[a.priority] - pOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return (b.estimatedBenefit ?? 0) - (a.estimatedBenefit ?? 0);
  });

  return nudges;
}

/**
 * Get only nudges relevant to the current step context.
 * Limits to maxVisible to prevent nudge fatigue.
 */
export function getNudgesForStep(
  nudges: ProactiveNudge[],
  currentSection: string,
  maxVisible: number = 2,
): ProactiveNudge[] {
  // Prioritize nudges relevant to the current section
  const relevant = nudges.filter(n => {
    if (n.source === 'milestone') return true;
    const nudgeSection = n.stepId ? STEP_SECTION_MAP[n.stepId] : undefined;
    return nudgeSection === currentSection || n.priority === 'high';
  });

  // If we have relevant nudges, show those; otherwise show top global nudges
  const pool = relevant.length > 0 ? relevant : nudges;
  return pool.slice(0, maxVisible);
}

// ─── Priority Scoring ──────────────────────────────

function scorePriority(
  s: TaxSuggestion,
  currentSection: string,
): ProactiveNudge['priority'] {
  const nudgeSection = s.stepId ? STEP_SECTION_MAP[s.stepId] : undefined;
  const isRelevantSection = nudgeSection === currentSection;

  // High: large benefit + high confidence + relevant to current section
  if (s.confidence === 'high' && s.estimatedBenefit && s.estimatedBenefit >= 500 && isRelevantSection) {
    return 'high';
  }

  // High: very large benefit regardless of section
  if (s.confidence === 'high' && s.estimatedBenefit && s.estimatedBenefit >= 2000) {
    return 'high';
  }

  // Medium: high confidence or relevant section
  if (s.confidence === 'high' || isRelevantSection) {
    return 'medium';
  }

  return 'low';
}

// ─── Chat Prompt Builder ───────────────────────────

function buildChatPrompt(s: TaxSuggestion): string {
  if (s.estimatedBenefit) {
    return `Tell me about the **${s.title}**. You mentioned I might save ~$${s.estimatedBenefit.toLocaleString()}. How does it work, do I qualify, and what do I need to do?`;
  }
  return `Tell me about the **${s.title}**. Do I qualify, and what would I need to enter?`;
}

// ─── Milestone Detection ───────────────────────────

function detectMilestones(
  taxReturn: TaxReturn,
  calculation: CalculationResult | null | undefined,
  currentSection: string,
): ProactiveNudge[] {
  const milestones: ProactiveNudge[] = [];

  // Milestone: all income entered, moving to deductions
  if (currentSection === 'deductions') {
    const hasIncome = (taxReturn.w2Income || []).length > 0 ||
      (taxReturn.income1099NEC || []).length > 0 ||
      (taxReturn.income1099DIV || []).length > 0;
    const agi = calculation?.form1040?.agi;

    if (hasIncome && agi && agi > 0) {
      milestones.push({
        id: 'milestone_deductions_start',
        source: 'milestone',
        priority: 'medium',
        title: 'Time to maximize your deductions',
        description: `Your income is entered (AGI: ~$${Math.round(agi / 1000) * 1000 > 0 ? (Math.round(agi / 1000) * 1000).toLocaleString() : agi.toLocaleString()}). Now let's find every deduction you're eligible for.`,
        chatPrompt: 'What deductions am I eligible for based on my income and situation?',
        dismissible: true,
        variant: 'info',
      });
    }
  }

  // Milestone: review section — final check
  if (currentSection === 'review' && calculation) {
    const refund = calculation.form1040?.refundAmount ?? 0;
    const owed = calculation.form1040?.amountOwed ?? 0;

    if (refund > 0) {
      milestones.push({
        id: 'milestone_review_refund',
        source: 'milestone',
        priority: 'medium',
        title: 'Your return looks ready',
        description: `You're getting a ~$${Math.round(refund / 100) * 100 > 0 ? (Math.round(refund / 100) * 100).toLocaleString() : refund.toLocaleString()} refund. Want me to check if there's anything you might have missed?`,
        chatPrompt: 'Review my complete return for errors, missing deductions, and optimization opportunities.',
        dismissible: true,
        variant: 'tip',
      });
    } else if (owed > 0) {
      milestones.push({
        id: 'milestone_review_owed',
        source: 'milestone',
        priority: 'high',
        title: 'Let\'s reduce what you owe',
        description: `You currently owe ~$${Math.round(owed / 100) * 100 > 0 ? (Math.round(owed / 100) * 100).toLocaleString() : owed.toLocaleString()}. I can check if there are credits or deductions that could lower this.`,
        chatPrompt: 'I owe money on my taxes. Are there any credits or deductions I might be missing that could reduce what I owe?',
        dismissible: true,
        variant: 'tip',
      });
    }
  }

  return milestones;
}
