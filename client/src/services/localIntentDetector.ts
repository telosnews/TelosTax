/**
 * Local Intent Detector
 *
 * Catches simple, high-confidence user intents (like "delete the X W-2")
 * and builds ChatResponse actions directly — no LLM round-trip needed.
 *
 * This exists because LLMs reliably refuse to generate remove_item actions
 * due to safety priors around deletion, even when the system prompt explicitly
 * permits it. By handling deletion intent locally, we guarantee it works
 * across all models and providers.
 */

import type { ChatResponse } from '@telostax/engine';
import { useTaxReturnStore } from '../store/taxReturnStore';

// ─── Item Type Detection ─────────────────────────

interface ItemTypePattern {
  /** The itemType key used by the intent executor */
  itemType: string;
  /** Human-readable label */
  label: string;
  /** Regex patterns to match in user message (case-insensitive) */
  patterns: RegExp[];
  /** The TaxReturn field name for this item type */
  fieldName: string;
  /** The field on each item that holds the identifying name */
  nameField: string;
  /** The suggested step to navigate to */
  suggestedStep: string;
}

const ITEM_TYPES: ItemTypePattern[] = [
  { itemType: 'w2', label: 'W-2', patterns: [/w-?2/i], fieldName: 'w2Income', nameField: 'employerName', suggestedStep: 'w2_income' },
  { itemType: '1099nec', label: '1099-NEC', patterns: [/1099-?nec/i], fieldName: 'income1099NEC', nameField: 'payerName', suggestedStep: '1099nec_income' },
  { itemType: '1099k', label: '1099-K', patterns: [/1099-?k(?!\w)/i], fieldName: 'income1099K', nameField: 'platformName', suggestedStep: '1099k_income' },
  { itemType: '1099int', label: '1099-INT', patterns: [/1099-?int/i], fieldName: 'income1099INT', nameField: 'payerName', suggestedStep: '1099int_income' },
  { itemType: '1099div', label: '1099-DIV', patterns: [/1099-?div/i], fieldName: 'income1099DIV', nameField: 'payerName', suggestedStep: '1099div_income' },
  { itemType: '1099r', label: '1099-R', patterns: [/1099-?r(?!\w)/i], fieldName: 'income1099R', nameField: 'payerName', suggestedStep: '1099r_income' },
  { itemType: '1099g', label: '1099-G', patterns: [/1099-?g(?!\w)/i], fieldName: 'income1099G', nameField: 'payerName', suggestedStep: '1099g_income' },
  { itemType: '1099misc', label: '1099-MISC', patterns: [/1099-?misc/i], fieldName: 'income1099MISC', nameField: 'payerName', suggestedStep: '1099misc_income' },
  { itemType: '1099b', label: '1099-B', patterns: [/1099-?b(?!\w)/i], fieldName: 'income1099B', nameField: 'description', suggestedStep: '1099b_income' },
  { itemType: '1099da', label: '1099-DA', patterns: [/1099-?da/i], fieldName: 'income1099DA', nameField: 'description', suggestedStep: '1099da_income' },
  { itemType: '1099sa', label: '1099-SA', patterns: [/1099-?sa/i], fieldName: 'income1099SA', nameField: 'payerName', suggestedStep: '1099sa_income' },
  { itemType: '1099oid', label: '1099-OID', patterns: [/1099-?oid/i], fieldName: 'income1099OID', nameField: 'payerName', suggestedStep: '1099oid_income' },
  { itemType: '1099q', label: '1099-Q', patterns: [/1099-?q(?!\w)/i], fieldName: 'income1099Q', nameField: 'payerName', suggestedStep: '1099q_income' },
  { itemType: '1099c', label: '1099-C', patterns: [/1099-?c(?!\w)/i], fieldName: 'income1099C', nameField: 'payerName', suggestedStep: '1099c_income' },
  { itemType: 'w2g', label: 'W-2G', patterns: [/w-?2g/i], fieldName: 'incomeW2G', nameField: 'payerName', suggestedStep: 'w2g_income' },
  { itemType: 'k1', label: 'K-1', patterns: [/k-?1(?!\w)/i], fieldName: 'incomeK1', nameField: 'entityName', suggestedStep: 'k1_income' },
  { itemType: 'dependents', label: 'dependent', patterns: [/dependent/i], fieldName: 'dependents', nameField: 'firstName', suggestedStep: 'dependents' },
  { itemType: 'rental-properties', label: 'rental property', patterns: [/rental/i], fieldName: 'rentalProperties', nameField: 'propertyAddress', suggestedStep: 'rental_income' },
  { itemType: 'royalty-properties', label: 'royalty property', patterns: [/royalt/i], fieldName: 'royaltyProperties', nameField: 'description', suggestedStep: 'royalty_income' },
  { itemType: 'education-credits', label: 'education credit', patterns: [/education\s*credit/i], fieldName: 'educationCredits', nameField: 'institution', suggestedStep: 'education_credits' },
];

// ─── Deletion Intent Detection ───────────────────

const DELETE_VERBS = /^(?:delete|remove|drop|get rid of|take out|clear|erase)\b/i;

/**
 * Try to detect a deletion intent from the user's message.
 * Returns a synthetic ChatResponse if detected, or null to fall through to the LLM.
 */
export function detectLocalIntent(message: string): ChatResponse | null {
  const trimmed = message.trim();

  // Must start with a delete verb
  if (!DELETE_VERBS.test(trimmed)) return null;

  // Strip the verb prefix to get the target description
  const afterVerb = trimmed.replace(DELETE_VERBS, '').trim();
  // Strip leading "the", "my", "a"
  const target = afterVerb.replace(/^(?:the|my|a)\s+/i, '').trim();

  if (!target) return null;

  // Find which item type the user is referring to
  const matched = ITEM_TYPES.find((it) =>
    it.patterns.some((p) => p.test(target)),
  );
  if (!matched) return null;

  // Extract the name portion (everything that isn't the form type keyword)
  // e.g., "GD New York W-2" → "GD New York", "1099-NEC from Acme" → "Acme"
  let name = target;
  // Remove the form type pattern
  for (const p of matched.patterns) {
    name = name.replace(p, '');
  }
  // Remove common prepositions
  name = name.replace(/\b(?:from|for|at|entry|item|income|form)\b/gi, '');
  name = name.trim().replace(/\s+/g, ' ');

  // Check if we have items of this type
  const taxReturn = useTaxReturnStore.getState().taxReturn;
  if (!taxReturn) return null;

  const arr = (taxReturn as any)[matched.fieldName] as any[] | undefined;
  if (!arr || arr.length === 0) {
    return {
      message: `You don't have any ${matched.label} entries to remove.`,
      actions: [{ type: 'no_action' }],
      suggestedStep: matched.suggestedStep,
      followUpChips: [`Add a ${matched.label}`, 'What income do I have?'],
    };
  }

  // Build the match object
  const match: Record<string, unknown> = {};
  if (name) {
    match[matched.nameField] = name;
  }

  return {
    message: `I'll remove the ${matched.label}${name ? ` from ${name}` : ''}. Click Apply to confirm — you'll have a few seconds to undo if needed.`,
    actions: [{ type: 'remove_item', itemType: matched.itemType, match } as any],
    suggestedStep: matched.suggestedStep,
    followUpChips: ['Undo this deletion', `Add a new ${matched.label}`, 'Review my income'],
  };
}
