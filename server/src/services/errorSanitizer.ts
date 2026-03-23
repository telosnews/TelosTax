import type { Response } from 'express';

/**
 * Sanitize LLM error messages before returning to clients.
 *
 * LLM SDK errors can contain API keys, request IDs, internal endpoints,
 * and partial request payloads. We extract a safe, user-friendly message
 * from the raw error and log the full details server-side only.
 */

/** Patterns that indicate specific, actionable error conditions. */
const ERROR_CLASSIFIERS: Array<{
  pattern: RegExp;
  message: string;
  code: string;
  status: number;
}> = [
  {
    pattern: /usage limits|spending limit|budget|exceeded.*limit/i,
    message:
      'Your API key has reached its spending limit. Check your provider dashboard to adjust it.',
    code: 'LLM_SPENDING_LIMIT',
    status: 400,
  },
  {
    pattern: /context.*(length|window|too long|too large)|maximum.*token|token.*limit/i,
    message:
      'The message was too long for the selected model. Try a shorter message or a model with a larger context window.',
    code: 'LLM_CONTEXT_LENGTH',
    status: 400,
  },
  {
    pattern: /content.*policy|content.*filter|safety|blocked|moderation/i,
    message:
      'The request was blocked by the AI provider\'s content policy. Try rephrasing your message.',
    code: 'LLM_CONTENT_POLICY',
    status: 400,
  },
  {
    pattern: /model.*not.*found|model.*does not exist|unknown.*model|decommissioned/i,
    message:
      'The selected model was not found. It may not be available for your API key or may have been retired.',
    code: 'LLM_MODEL_NOT_FOUND',
    status: 400,
  },
  {
    pattern: /invalid.*api.?key|authentication|unauthorized|forbidden|incorrect.*key/i,
    message: 'Invalid API key. Please check your key and try again.',
    code: 'LLM_AUTH_ERROR',
    status: 401,
  },
  {
    pattern: /rate.?limit|too many requests|throttl/i,
    message:
      'The AI service is temporarily busy. Please try again in a moment.',
    code: 'LLM_RATE_LIMITED',
    status: 429,
  },
  {
    pattern: /timeout|timed?\s*out|deadline/i,
    message:
      'The AI provider took too long to respond. Please try again.',
    code: 'LLM_TIMEOUT',
    status: 504,
  },
  {
    pattern: /overloaded|capacity|unavailable|service.*error|internal.*error/i,
    message:
      'The AI provider is temporarily unavailable. Please try again in a moment.',
    code: 'LLM_UNAVAILABLE',
    status: 503,
  },
];

/**
 * Classify an LLM error into a safe, user-friendly message.
 * Returns the matched classifier, or a generic fallback.
 */
function classifyError(err: any): {
  message: string;
  code: string;
  status: number;
} {
  const rawMsg: string = err?.message || '';

  // First: check HTTP status codes from the SDK error object
  const httpStatus = err?.status || err?.statusCode;
  if (httpStatus === 429) {
    return {
      message: 'The AI service is temporarily busy. Please try again in a moment.',
      code: 'LLM_RATE_LIMITED',
      status: 429,
    };
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      message: 'Invalid API key. Please check your key and try again.',
      code: 'LLM_AUTH_ERROR',
      status: 401,
    };
  }

  // Second: classify by message content
  for (const classifier of ERROR_CLASSIFIERS) {
    if (classifier.pattern.test(rawMsg)) {
      return {
        message: classifier.message,
        code: classifier.code,
        status: classifier.status,
      };
    }
  }

  // Fallback: generic error with no internal details
  if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
    return {
      message: 'The AI provider could not process this request. Please try again or select a different model.',
      code: 'LLM_BAD_REQUEST',
      status: 400,
    };
  }
  if (httpStatus && httpStatus >= 500) {
    return {
      message: 'The AI provider encountered an internal error. Please try again in a moment.',
      code: 'LLM_PROVIDER_ERROR',
      status: 502,
    };
  }

  return {
    message: 'An unexpected error occurred while communicating with the AI provider.',
    code: 'LLM_UNKNOWN_ERROR',
    status: 502,
  };
}

/** Scrub potential API keys and secrets from error messages before logging. */
function scrubSecrets(text: string): string {
  // Anthropic API keys: sk-ant-api03-...
  let scrubbed = text.replace(/sk-ant-[A-Za-z0-9_-]{10,}/g, '[REDACTED_API_KEY]');
  // Generic Bearer tokens
  scrubbed = scrubbed.replace(/Bearer\s+[A-Za-z0-9_.-]{20,}/gi, 'Bearer [REDACTED]');
  // Truncate to prevent excessively long error dumps
  if (scrubbed.length > 500) {
    scrubbed = scrubbed.slice(0, 500) + '... [truncated]';
  }
  return scrubbed;
}

/**
 * Handle an LLM error: log scrubbed details server-side, return safe message to client.
 * Returns true if the error was handled (response sent), false otherwise.
 */
export function handleLLMError(
  err: any,
  res: Response,
  context: string = 'LLM',
): boolean {
  const rawMsg = err instanceof Error ? err.message : String(err);

  // Log scrubbed error details server-side only — never log raw API keys
  console.error(`[${context}] Provider error:`, scrubSecrets(rawMsg));

  const classified = classifyError(err);
  res.status(classified.status).json({
    error: {
      message: classified.message,
      code: classified.code,
    },
  });
  return true;
}

/**
 * Return a safe, generic error for unhandled exceptions in route catch blocks.
 * Never includes raw error details in the response.
 */
export function handleRouteError(
  err: unknown,
  res: Response,
  context: string,
): void {
  const rawMsg = err instanceof Error ? err.message : String(err);
  console.error(`[${context}] Unhandled error:`, scrubSecrets(rawMsg));

  res.status(500).json({
    error: {
      message: 'An error occurred while processing your request. Please try again.',
      code: `${context.toUpperCase()}_ERROR`,
    },
  });
}
