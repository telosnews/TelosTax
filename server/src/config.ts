/**
 * Server configuration — reads from environment variables.
 * Loaded via `import 'dotenv/config'` in index.ts.
 */

export const config = {
  /** Maximum number of conversation history messages to forward to the LLM. */
  maxConversationHistory: 10,

  /** Maximum user message length (characters). */
  maxMessageLength: 4000,

  /** Rate limit: max requests per window per IP (BYOK mode — user pays). */
  byokRateLimitMax: 30,

  /** Rate limit: max batch classification requests per window per IP. */
  batchRateLimitMax: 10,

  /** Rate limit: max field extraction requests per window per IP. */
  extractRateLimitMax: 20,

  /** Rate limit window in milliseconds (1 minute). */
  rateLimitWindowMs: 60_000,

  /** Stripe Payment Links for tip jar (pre-configured in Stripe Dashboard). */
  tipLinkSmall: process.env.STRIPE_TIP_LINK_SMALL || '',
  tipLinkMedium: process.env.STRIPE_TIP_LINK_MEDIUM || '',
  tipLinkLarge: process.env.STRIPE_TIP_LINK_LARGE || '',
};
