/**
 * Chat Routes — POST /api/chat/byok, GET /api/chat/status
 *
 * BYOK mode only — user provides their own Anthropic API key,
 * proxied through this server as a CORS relay.
 *
 * The POST endpoint strips PII as defense-in-depth (client should scan first),
 * then forwards to Anthropic.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { stripPII, stripConversationHistory, stripContext } from '../services/piiStripper.js';
import { anthropicCompletionWithKey } from '../services/anthropicClient.js';
import { config } from '../config.js';
import { SYSTEM_PROMPT } from '../services/systemPrompt.js';
import { handleLLMError, handleRouteError } from '../services/errorSanitizer.js';
import { initRateLimitTable, checkRateLimit as sharedCheckRateLimit, getClientIp, sendRateLimitResponse } from '../services/rateLimiter.js';
import type { ChatResponse } from '@telostax/engine';

const router = Router();

// Initialize rate limit table on module load
initRateLimitTable();

// ─── Request Validation ────────────────────────────

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  // User input is capped at maxMessageLength (4000), but assistant responses
  // in conversation history can be much longer — don't reject valid history.
  content: z.string().max(20_000),
});

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(config.maxMessageLength),
  conversationHistory: z.array(MessageSchema).max(config.maxConversationHistory).default([]),
  context: z.record(z.unknown()).default({}),
});

const BYOKRequestSchema = ChatRequestSchema.extend({
  provider: z.literal('anthropic'),
  apiKey: z.string().min(1).max(200),
  model: z.string().min(1).max(100),
});

// ─── Shared PII + Message Preparation ─────────────

function prepareMessages(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  context: Record<string, unknown>,
) {
  const { sanitized: sanitizedMessage } = stripPII(message);
  const sanitizedHistory = stripConversationHistory(conversationHistory);
  const sanitizedContext = stripContext(context);

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...sanitizedHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: sanitizedMessage },
  ];

  return { messages, sanitizedContext };
}

// ─── Routes ────────────────────────────────────────

/**
 * GET /api/chat/status
 * Returns whether the chat feature is available.
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    data: {
      enabled: false, // No server-side AI — BYOK only
      model: null,
      byokEnabled: true,
    },
  });
});

/**
 * POST /api/chat/byok
 * BYOK mode — uses the user's Anthropic API key. Key is used once and discarded.
 *
 * The user's API key is in the request body (not a header) to avoid
 * appearing in access logs. It is NEVER stored, logged, or cached.
 */
router.post('/byok', async (req: Request, res: Response) => {
  try {
    // 1. Rate limit (slightly higher for BYOK — user pays for their own tokens)
    const clientIp = getClientIp(req);
    if (!clientIp) {
      res.status(400).json({ error: { message: 'Unable to determine client IP.', code: 'INVALID_IP' } });
      return;
    }
    if (!sharedCheckRateLimit(clientIp, 'chat', config.byokRateLimitMax, config.rateLimitWindowMs)) {
      sendRateLimitResponse(res, 'Too many requests. Please wait a moment and try again.', Math.ceil(config.rateLimitWindowMs / 1000));
      return;
    }

    // 2. Validate request body
    const parseResult = BYOKRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      // Debug: log field sizes to diagnose validation failures (no sensitive data)
      const body = req.body || {};
      console.error('[BYOK validation failed]', {
        messageLength: typeof body.message === 'string' ? body.message.length : typeof body.message,
        historyLength: Array.isArray(body.conversationHistory) ? body.conversationHistory.length : 0,
        historyContentLengths: Array.isArray(body.conversationHistory)
          ? body.conversationHistory.map((m: any) => m?.content?.length ?? 0)
          : [],
        provider: body.provider,
        model: body.model,
        issues: parseResult.error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
      res.status(400).json({
        error: {
          message: 'Invalid request body.',
          code: 'VALIDATION_ERROR',
          detail: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        },
      });
      return;
    }

    const { message, conversationHistory, context, apiKey, model } =
      parseResult.data;

    // 3. Validate API key format (basic sanity check — never log the key)
    if (!apiKey.startsWith('sk-ant-')) {
      res.status(400).json({
        error: {
          message: 'Invalid Anthropic API key format. Keys start with "sk-ant-".',
          code: 'INVALID_API_KEY',
        },
      });
      return;
    }

    // 4. Prepare messages (PII strip as defense-in-depth)
    const { messages, sanitizedContext } = prepareMessages(
      message,
      conversationHistory as Array<{ role: string; content: string }>,
      context as Record<string, unknown>,
    );

    // 5. Call Anthropic with the user's key (one-shot, key never stored)
    let response: ChatResponse;
    try {
      response = await anthropicCompletionWithKey(
        apiKey,
        model,
        messages,
        sanitizedContext,
        SYSTEM_PROMPT,
      );
    } catch (err: any) {
      if (handleLLMError(err, res, 'byok-chat')) return;
      throw err;
    }

    // 6. Return response
    res.json({ data: response });
  } catch (err) {
    // IMPORTANT: Never log the request body (contains the user's API key)
    handleRouteError(err, res, 'byok-chat');
  }
});

export default router;
