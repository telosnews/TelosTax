/**
 * BYOK Transport — sends messages via the server proxy using the user's Anthropic API key.
 *
 * The user's API key is sent in the request body (not a header) to avoid
 * appearing in access logs. The server uses it for a one-shot API call
 * and immediately discards it.
 *
 * Privacy: The server acts as a CORS proxy. It runs PII scanning as
 * defense-in-depth, but the client should scan first.
 */

import type { ChatContext, ChatMessage, ChatResponse, AIProvider } from '@telostax/engine';
import { scanForPII } from '@telostax/engine';
import type { ChatTransport, ChatTransportStatus } from './types';
import { logOutboundRequest, consumePiiTypes, buildPiiBlockSummary } from '../privacyAuditLog';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';
const TIMEOUT_MS = 60_000;

export class BYOKTransport implements ChatTransport {
  readonly displayName = 'BYOK (Your API Key)';
  readonly mode = 'byok' as const;

  constructor(
    private provider: AIProvider,
    private apiKey: string,
    private model: string,
  ) {}

  async sendMessage(
    message: string,
    conversationHistory: ChatMessage[],
    context: ChatContext,
    signal?: AbortSignal,
  ): Promise<ChatResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    // If caller provides a signal (e.g. stop button), abort our controller when it fires
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const res = await fetch(`${API_BASE}/api/chat/byok`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationHistory,
          context,
          provider: this.provider,
          apiKey: this.apiKey,
          model: this.model,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        const detail = errorBody?.error?.detail;
        const base = errorBody?.error?.message || `Server error (${res.status})`;
        throw new Error(detail ? `${base} ${detail}` : base);
      }

      const json = await res.json();
      const response = json.data as ChatResponse;

      // Privacy audit log — record what was sent and received (async, non-blocking)
      logOutboundRequest({
        feature: 'chat',
        provider: this.provider,
        model: this.model,
        redactedMessage: message,
        piiBlocked: buildPiiBlockSummary(consumePiiTypes()),
        contextKeysSent: Object.keys(context).filter((k) => context[k as keyof ChatContext] != null),
        responseTruncated: scanForPII(response.message.slice(0, 200)).sanitized,
      }).catch(() => {});

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        // Re-throw as-is so callers can distinguish user-abort from errors
        throw err;
      }
      throw err;
    }
  }

  async checkStatus(): Promise<ChatTransportStatus> {
    if (!this.apiKey) {
      return {
        ready: false,
        model: null,
        error: 'No API key configured. Enter your Anthropic key in AI Settings.',
      };
    }

    // Basic format validation
    if (!this.apiKey.startsWith('sk-ant-')) {
      return {
        ready: false,
        model: null,
        error: 'Invalid Anthropic API key format. Keys start with "sk-ant-".',
      };
    }

    return {
      ready: true,
      model: this.model,
    };
  }
}
