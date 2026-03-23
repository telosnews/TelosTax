/**
 * Extract Routes — POST /api/extract/fields
 *
 * AI-enhanced field extraction for scanned tax documents.
 * BYOK only — user's own Anthropic API key, used once and discarded.
 *
 * Privacy model:
 *   - Client runs scanForPII() before sending (primary gate)
 *   - Server runs stripPII() again (defense-in-depth)
 *   - Only sanitized OCR text is sent to the LLM
 *   - API key used once and discarded (same BYOK pattern as batch)
 *
 * Tax advice boundary:
 *   The AI extracts field values — it NEVER provides tax advice.
 *   "Engine calculates, AI narrates, user decides."
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { handleLLMError, handleRouteError } from '../services/errorSanitizer.js';
import { rawAnthropicCompletionWithKey } from '../services/anthropicClient.js';
import { config } from '../config.js';
import { stripPII } from '../services/piiStripper.js';
import { checkRateLimit as sharedCheckRateLimit, getClientIp, sendRateLimitResponse } from '../services/rateLimiter.js';
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserMessage,
  parseExtractionResponse,
} from '../services/ocrExtractPrompt.js';

const router = Router();

// ─── Request Validation ─────────────────────────────

const FieldExtractionSchema = z.object({
  ocrText: z.string().min(10).max(20_000),
  formTypeHint: z.string().max(20).nullable(),
  provider: z.literal('anthropic'),
  apiKey: z.string().min(1).max(200),
  model: z.string().min(1).max(100),
});

// ─── Route ──────────────────────────────────────────

/**
 * POST /api/extract/fields
 *
 * Accepts sanitized OCR text and returns AI-extracted field values
 * with per-field confidence scores.
 */
router.post('/fields', async (req: Request, res: Response) => {
  try {
    // 1. Rate limit
    const clientIp = getClientIp(req);
    if (!clientIp) {
      res.status(400).json({ error: { message: 'Unable to determine client IP.', code: 'INVALID_IP' } });
      return;
    }
    if (!sharedCheckRateLimit(clientIp, 'extract', config.extractRateLimitMax, config.rateLimitWindowMs)) {
      sendRateLimitResponse(res, 'Too many extraction requests. Please wait a moment and try again.', Math.ceil(config.rateLimitWindowMs / 1000));
      return;
    }

    // 2. Validate request body
    const parseResult = FieldExtractionSchema.safeParse(req.body);
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

    const { ocrText, formTypeHint, apiKey, model } = parseResult.data;

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

    // 4. Strip PII (defense-in-depth — client already ran scanForPII)
    const piiResult = stripPII(ocrText);
    const sanitizedText = piiResult.sanitized;

    if (piiResult.strippedCount > 0) {
      console.log(`[extract] Stripped ${piiResult.strippedCount} PII items (${piiResult.strippedTypes.join(', ')})`);
    }

    // 5. Build the extraction request
    const userMessage = buildExtractionUserMessage(sanitizedText, formTypeHint);
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: userMessage },
    ];

    // 6. Dispatch to Anthropic
    let raw: string;
    try {
      raw = await rawAnthropicCompletionWithKey(apiKey, model, messages, EXTRACTION_SYSTEM_PROMPT);
    } catch (err: any) {
      if (handleLLMError(err, res, 'extract')) return;
      throw err;
    }

    // 7. Parse the extraction response
    console.log(`[extract] Response length: ${raw.length}`);
    const result = parseExtractionResponse(raw);

    const fieldCount = Object.keys(result.fields).length;
    console.log(`[extract] Extracted ${fieldCount} fields, formType: ${result.formType} (${result.formTypeConfidence})`);

    // 8. Return results
    res.json({ data: result });
  } catch (err) {
    handleRouteError(err, res, 'extract');
  }
});

export default router;
