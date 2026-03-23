/**
 * PII Stripping Service — Server-side defense-in-depth.
 *
 * The core PII scanning logic now lives in @telostax/engine (shared).
 * This module re-exports stripPII (via scanForPII) and adds server-specific
 * functions: stripContext (allowlist-based) and stripConversationHistory.
 */

import { scanForPII } from '@telostax/engine';

// ─── Types (re-export for backwards compatibility) ─

export interface StrippingResult {
  sanitized: string;
  strippedCount: number;
  strippedTypes: string[];
}

// ─── Core Functions ────────────────────────────────

/**
 * Strip PII from a text string.
 * Delegates to the shared scanForPII and adapts the result shape.
 */
export function stripPII(text: string): StrippingResult {
  const result = scanForPII(text);
  return {
    sanitized: result.sanitized,
    strippedCount: result.detectedCount,
    strippedTypes: result.detectedTypes,
  };
}

/**
 * Strip PII from the context object sent to the LLM.
 *
 * Uses a strict ALLOWLIST approach — only explicitly permitted keys pass through.
 * Any key not in the allowlist is silently dropped.
 */
const ALLOWED_CONTEXT_KEYS = new Set([
  // Wizard position
  'currentStep', 'currentSection',
  // Broad financial categories (not PII)
  'filingStatus', 'deductionMethod',
  // Aggregate counts (not individually identifying)
  'dependentCount', 'incomeTypeCounts',
  // Discovery flags (yes/no)
  'incomeDiscovery',
  // Pre-built safe summaries from chatContextBuilder
  'traceContext', 'flowContext', 'suggestionsContext', 'warningsContext', 'deductionFinderContext', 'scenarioLabContext',
  'stepFieldsContext', 'auditRiskContext', 'taxCalendarContext', 'documentInventoryContext', 'yearOverYearContext',
  // Numeric counts inside incomeTypeCounts
  'w2', '1099nec', '1099k', '1099int', '1099div', '1099r',
  '1099g', '1099misc', '1099b', '1099da', 'k1', '1099sa', 'rental',
]);

export function stripContext(context: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (!ALLOWED_CONTEXT_KEYS.has(key)) continue;
    if (Array.isArray(value)) {
      cleaned[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? stripContext(item as Record<string, unknown>)
          : item,
      );
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = stripContext(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Strip PII from an array of conversation history messages.
 */
export function stripConversationHistory(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  return messages.map((msg) => ({
    role: msg.role,
    content: stripPII(msg.content).sanitized,
  }));
}
