/**
 * Chat API Service — refactored to use ChatTransport abstraction.
 *
 * This is now a thin orchestration layer:
 *   1. Reads the active AI mode from the settings store
 *   2. Runs client-side PII scanning (primary gate)
 *   3. Delegates to the appropriate ChatTransport
 *
 * The old direct fetch calls are replaced by transport.sendMessage().
 */

import type { ChatContext, ChatMessage, ChatResponse, ChatStatus } from '@telostax/engine';
import { scanForPII } from '@telostax/engine';
import { useAISettingsStore } from '../store/aiSettingsStore';
import { getTransport } from './chat/transportFactory';
import type { ChatTransportStatus } from './chat/types';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

// ─── PII Scan Result ──────────────────────────────

export interface PIICheckResult {
  /** Whether PII was detected. */
  hasPII: boolean;
  /** Sanitized version of the message. */
  sanitized: string;
  /** Human-readable warnings to show the user. */
  warnings: string[];
  /** Types of PII detected. */
  detectedTypes: string[];
}

/**
 * Scan a message for PII before sending.
 * This is the primary gate — called before any transport.
 */
export function checkForPII(message: string): PIICheckResult {
  const result = scanForPII(message);
  return {
    hasPII: result.hasPII,
    sanitized: result.sanitized,
    warnings: result.warnings,
    detectedTypes: result.detectedTypes,
  };
}

/**
 * Check whether the chat feature is available.
 *
 * With the two-tier AI system (Private / BYOK), the chat feature
 * is ALWAYS available — there's always a mode the user can use. The button
 * should always show. Transport readiness (model loaded, key configured)
 * is a separate concern handled when the user tries to send a message.
 */
export async function checkChatStatus(): Promise<ChatStatus> {
  const settings = useAISettingsStore.getState();

  return {
    enabled: true, // Always enabled — the settings panel handles mode configuration
    model: null,
    mode: settings.mode,
    provider: settings.mode === 'byok' ? settings.byokProvider : undefined,
  };
}

/**
 * Get the transport status (richer than ChatStatus — includes progress, errors).
 */
export async function getTransportStatus(): Promise<ChatTransportStatus> {
  const settings = useAISettingsStore.getState();
  const transport = getTransport(settings);
  if (!transport) {
    return { ready: false, model: 'private', error: 'AI chat is not available in Private Mode. Switch to BYOK to enable AI features.' };
  }
  return transport.checkStatus();
}

/**
 * Send a chat message via the active transport.
 * Caller should run checkForPII() first and handle PII warnings.
 * Throws in Private mode (no transport available).
 */
export async function sendChatMessage(
  message: string,
  conversationHistory: ChatMessage[],
  context: ChatContext,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const settings = useAISettingsStore.getState();
  const transport = getTransport(settings);
  if (!transport) {
    throw new Error('AI chat is not available in Private Mode. Switch to BYOK to enable AI-powered features.');
  }
  return transport.sendMessage(message, conversationHistory, context, signal);
}
