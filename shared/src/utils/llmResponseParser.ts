/**
 * LLM Response Parser — shared between server and client.
 *
 * Parses structured JSON from raw LLM output. Handles JSON with or without
 * markdown code fences, and falls back to treating the entire response as
 * a plain text message when no valid JSON is found.
 *
 * Used by:
 *   - Server: after calling OpenAI/Anthropic (paid/BYOK modes)
 *   - Client: after calling local WebLLM model (private mode)
 */

import { z } from 'zod';
import type { ChatAction, ChatResponse } from '../types/chat.js';

// ─── Zod Schemas for ChatAction Variants ─────────────

const AddIncomeSchema = z.object({
  type: z.literal('add_income'),
  incomeType: z.string(),
  fields: z.record(z.unknown()),
});

const SetFilingStatusSchema = z.object({
  type: z.literal('set_filing_status'),
  status: z.string(),
});

const AddDependentSchema = z.object({
  type: z.literal('add_dependent'),
  fields: z.record(z.unknown()),
});

const SetDeductionMethodSchema = z.object({
  type: z.literal('set_deduction_method'),
  method: z.enum(['standard', 'itemized']),
});

const UpdateItemizedSchema = z.object({
  type: z.literal('update_itemized'),
  fields: z.record(z.number()),
});

const SetIncomeDiscoverySchema = z.object({
  type: z.literal('set_income_discovery'),
  incomeType: z.string(),
  value: z.enum(['yes', 'no']),
});

const UpdateFieldSchema = z.object({
  type: z.literal('update_field'),
  field: z.string(),
  value: z.unknown(),
});

const NavigateSchema = z.object({
  type: z.literal('navigate'),
  stepId: z.string(),
});

const AddBusinessExpenseSchema = z.object({
  type: z.literal('add_business_expense'),
  category: z.string(),
  amount: z.number(),
  description: z.string().optional(),
});

const RemoveItemSchema = z.object({
  type: z.literal('remove_item'),
  itemType: z.string(),
  match: z.record(z.unknown()),
});

const UpdateHomeOfficeSchema = z.object({
  type: z.literal('update_home_office'),
  fields: z.record(z.unknown()),
});

const UpdateVehicleSchema = z.object({
  type: z.literal('update_vehicle'),
  fields: z.record(z.unknown()),
});

const UpdateBusinessSchema = z.object({
  type: z.literal('update_business'),
  fields: z.record(z.unknown()),
});

const UpdateSERetirementSchema = z.object({
  type: z.literal('update_se_retirement'),
  fields: z.record(z.unknown()),
});

const NoActionSchema = z.object({
  type: z.literal('no_action'),
});

const ChatActionSchema = z.discriminatedUnion('type', [
  AddIncomeSchema,
  SetFilingStatusSchema,
  AddDependentSchema,
  SetDeductionMethodSchema,
  UpdateItemizedSchema,
  SetIncomeDiscoverySchema,
  UpdateFieldSchema,
  NavigateSchema,
  AddBusinessExpenseSchema,
  RemoveItemSchema,
  UpdateHomeOfficeSchema,
  UpdateVehicleSchema,
  UpdateBusinessSchema,
  UpdateSERetirementSchema,
  NoActionSchema,
]);

/**
 * Validate an array of raw action objects, dropping any that don't match
 * the expected ChatAction schema.
 */
function validateActions(rawActions: unknown[]): ChatAction[] {
  const valid: ChatAction[] = [];
  for (const raw of rawActions) {
    const result = ChatActionSchema.safeParse(raw);
    if (result.success) {
      valid.push(result.data as ChatAction);
    }
    // Invalid actions are silently dropped
  }
  return valid;
}

/**
 * Parse raw LLM text output into a structured ChatResponse.
 * Handles JSON with or without markdown code fences.
 * Falls back to treating the entire response as a plain message.
 */
export function parseResponse(raw: string): ChatResponse {
  const jsonStr = extractJSON(raw);

  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);

      if (typeof parsed.message === 'string') {
        return {
          message: parsed.message,
          actions: Array.isArray(parsed.actions)
            ? validateActions(parsed.actions)
            : [],
          suggestedStep:
            typeof parsed.suggestedStep === 'string'
              ? parsed.suggestedStep
              : null,
          followUpChips: Array.isArray(parsed.followUpChips)
            ? (parsed.followUpChips as string[]).filter((c) => typeof c === 'string' && c.length > 0).slice(0, 3)
            : undefined,
        };
      }
    } catch {
      // JSON parse failed — try to salvage the message field via regex.
      // This handles truncated LLM responses where the JSON is cut off
      // but the "message" value is still readable.
      const salvaged = salvageMessage(jsonStr);
      if (salvaged) {
        return { message: salvaged, actions: [], suggestedStep: null };
      }
    }
  }

  // Fallback: treat entire response as a plain message.
  // Strip any leading JSON wrapper so raw {"message":"..." never leaks to the UI.
  const cleaned = stripJSONWrapper(raw.trim());
  return {
    message:
      cleaned ||
      'I had trouble processing that. Could you rephrase your question?',
    actions: [],
    suggestedStep: null,
  };
}

/**
 * Attempt to extract the "message" value from malformed/truncated JSON.
 * Uses regex to pull the first string value after a "message" key.
 * Handles both complete and truncated message values.
 */
function salvageMessage(jsonStr: string): string | null {
  // Try 1: Complete "message": "..." with closing quote
  const completeMatch = jsonStr.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (completeMatch && completeMatch[1].length > 0) {
    try {
      return JSON.parse(`"${completeMatch[1]}"`);
    } catch {
      return completeMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
  }

  // Try 2: Truncated "message": "... (no closing quote — response was cut off)
  const truncatedMatch = jsonStr.match(/"message"\s*:\s*"((?:[^"\\]|\\.)+)/);
  if (truncatedMatch && truncatedMatch[1].length > 10) {
    const raw = truncatedMatch[1];
    try {
      return JSON.parse(`"${raw}"`);
    } catch {
      return raw.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
  }

  return null;
}

/**
 * Strip JSON wrapper from a raw response so {"message":"text..."} displays
 * as just "text..." when the parser can't fully parse the JSON.
 */
function stripJSONWrapper(text: string): string {
  if (!text.startsWith('{')) return text;
  // Try salvaging first
  const salvaged = salvageMessage(text);
  if (salvaged) return salvaged;
  // Last resort: strip obvious JSON prefix
  return text;
}

/**
 * Extract JSON from a response that may contain markdown code fences
 * or other surrounding text.
 */
export function extractJSON(text: string): string | null {
  // Try 1: Raw text is valid JSON
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    return trimmed;
  }

  // Try 2: JSON inside ```json ... ``` code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try 3: Find the first { ... } block
  const braceStart = trimmed.indexOf('{');
  const braceEnd = trimmed.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    return trimmed.slice(braceStart, braceEnd + 1);
  }

  return null;
}
