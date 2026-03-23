/**
 * Batch Routes — POST /api/batch/classify-merchants
 *
 * AI-powered merchant classification for the Deduction Finder.
 * BYOK only — user's own Anthropic API key, used once and discarded.
 *
 * Privacy model:
 *   - Only merchant names are sent (no amounts, dates, or account numbers)
 *   - Minimal profile flags for disambiguation (hasScheduleC, etc.)
 *   - API key used once and discarded (same BYOK pattern as chat)
 *
 * Tax advice boundary:
 *   The AI classifies what a merchant IS — never whether it's deductible.
 *   "Engine calculates, AI narrates, user decides."
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { rawAnthropicCompletionWithKey } from '../services/anthropicClient.js';
import { handleLLMError, handleRouteError } from '../services/errorSanitizer.js';
import { stripPII } from '../services/piiStripper.js';
import { config } from '../config.js';
import { checkRateLimit as sharedCheckRateLimit, getClientIp, sendRateLimitResponse } from '../services/rateLimiter.js';
import {
  MERCHANT_CLASSIFY_PROMPT,
  buildClassifyUserMessage,
  parseClassificationResponse,
} from '../services/merchantClassifyPrompt.js';

const router = Router();

// ─── Request Validation ─────────────────────────────

const MerchantClassifySchema = z.object({
  merchants: z.array(z.string().max(200)).min(1).max(500),
  context: z.object({
    hasScheduleC: z.boolean().default(false),
    hasHomeOffice: z.boolean().default(false),
    hasRentalIncome: z.boolean().default(false),
    deductionMethod: z.enum(['standard', 'itemized']).default('standard'),
  }),
  provider: z.literal('anthropic'),
  apiKey: z.string().min(1).max(200),
  model: z.string().min(1).max(100),
});

// ─── Merchant Sanitization ──────────────────────────

/** Strip potential PII from merchant description strings before sending to AI. */
function sanitizeMerchant(description: string): string {
  let cleaned = description;
  // Remove sequences of 4+ digits (card numbers, account references)
  cleaned = cleaned.replace(/\b\d{4,}\b/g, '');
  // Remove account/reference patterns
  cleaned = cleaned.replace(/\b(ACCT|ACCOUNT|REF|CARD|ENDING)\s*#?\s*\d*/gi, '');
  // Remove embedded dates
  cleaned = cleaned.replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, '');
  return cleaned.trim().replace(/\s{2,}/g, ' ');
}

// ─── Route ──────────────────────────────────────────

/**
 * POST /api/batch/classify-merchants
 *
 * Accepts an array of merchant names and returns business type classifications.
 * Requires a BYOK Anthropic API key.
 */
router.post('/classify-merchants', async (req: Request, res: Response) => {
  try {
    // 1. Rate limit
    const clientIp = getClientIp(req);
    if (!clientIp) {
      res.status(400).json({ error: { message: 'Unable to determine client IP.', code: 'INVALID_IP' } });
      return;
    }
    if (!sharedCheckRateLimit(clientIp, 'batch', config.batchRateLimitMax, config.rateLimitWindowMs)) {
      sendRateLimitResponse(res, 'Too many classification requests. Please wait a moment and try again.', Math.ceil(config.rateLimitWindowMs / 1000));
      return;
    }

    // 2. Validate request body
    const parseResult = MerchantClassifySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          message: 'Invalid request body.',
          code: 'VALIDATION_ERROR',
          detail: parseResult.error.issues.map((i) => i.message).join('; '),
        },
      });
      return;
    }

    const { merchants, context, apiKey, model } = parseResult.data;

    // 3. Validate API key format
    if (!apiKey.startsWith('sk-ant-')) {
      res.status(400).json({
        error: {
          message: 'Invalid Anthropic API key format. Keys start with "sk-ant-".',
          code: 'INVALID_API_KEY',
        },
      });
      return;
    }

    // 4. Sanitize merchant names (strip potential PII)
    const sanitizedMerchants = merchants.map(sanitizeMerchant).filter((m) => m.length > 0);
    if (sanitizedMerchants.length === 0) {
      res.status(400).json({
        error: { message: 'No valid merchant names after sanitization.', code: 'EMPTY_MERCHANTS' },
      });
      return;
    }

    // 5. Build the classification request
    const userMessage = buildClassifyUserMessage(sanitizedMerchants, context);
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: userMessage },
    ];

    // 6. Dispatch to Anthropic
    let raw: string;
    try {
      raw = await rawAnthropicCompletionWithKey(apiKey, model, messages, MERCHANT_CLASSIFY_PROMPT);
    } catch (err: any) {
      if (handleLLMError(err, res, 'batch-classify')) return;
      throw err;
    }

    // 7. Parse the classification response
    console.log(`[batch] Response length: ${raw.length}`);
    const classifications = parseClassificationResponse(raw);

    console.log(`[batch] Classified ${classifications.length}/${sanitizedMerchants.length} merchants`);

    // 8. Return results
    res.json({ data: { classifications } });
  } catch (err) {
    handleRouteError(err, res, 'batch-classify');
  }
});

// ─── Transaction Categorization ─────────────────────

const CategorizeSchema = z.object({
  prompt: z.string().min(1).max(50000),
  provider: z.literal('anthropic'),
  apiKey: z.string().min(1).max(200),
  model: z.string().min(1).max(100),
});

/**
 * POST /api/batch/categorize-transactions
 *
 * Sends a pre-built categorization prompt to the LLM and returns the JSON array.
 * The prompt is built client-side with full tax context and deduplicated merchants.
 */
router.post('/categorize-transactions', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    if (!clientIp) {
      res.status(400).json({ error: { message: 'Unable to determine client IP.', code: 'INVALID_IP' } });
      return;
    }
    if (!sharedCheckRateLimit(clientIp, 'batch', config.batchRateLimitMax, config.rateLimitWindowMs)) {
      sendRateLimitResponse(res, 'Too many requests. Please wait a moment.', Math.ceil(config.rateLimitWindowMs / 1000));
      return;
    }

    const parseResult = CategorizeSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: { message: 'Invalid request.', code: 'VALIDATION_ERROR', detail: parseResult.error.issues.map(i => i.message).join('; ') },
      });
      return;
    }

    const { prompt: rawPrompt, apiKey, model } = parseResult.data;

    // Strip PII from the categorization prompt (defense-in-depth)
    const piiResult = stripPII(rawPrompt);
    const prompt = piiResult.sanitized;
    if (piiResult.strippedCount > 0) {
      console.log(`[batch/categorize] Stripped ${piiResult.strippedCount} PII items (${piiResult.strippedTypes.join(', ')})`);
    }

    // Validate API key format
    if (!apiKey.startsWith('sk-ant-')) {
      res.status(400).json({
        error: { message: 'Invalid Anthropic API key format. Keys start with "sk-ant-".', code: 'INVALID_API_KEY' },
      });
      return;
    }

    const systemPrompt = 'You are a tax transaction categorization assistant. Return ONLY a valid JSON array. No code fences, no explanation — just the JSON array.';
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: prompt },
    ];

    let raw: string;
    try {
      raw = await rawAnthropicCompletionWithKey(apiKey, model, messages, systemPrompt);
    } catch (err: any) {
      if (handleLLMError(err, res, 'batch-categorize')) return;
      throw err;
    }

    // Parse JSON array from response
    let categories: any[] = [];
    try {
      // Strip code fences if present
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      categories = JSON.parse(cleaned);
      if (!Array.isArray(categories)) categories = [];
    } catch {
      console.error('[batch/categorize] Failed to parse JSON response (length: %d)', raw.length);
      categories = [];
    }

    console.log(`[batch/categorize] Returned ${categories.length} categories`);
    res.json({ data: { categories } });
  } catch (err) {
    handleRouteError(err, res, 'batch-categorize');
  }
});

export default router;
