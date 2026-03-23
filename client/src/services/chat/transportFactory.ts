/**
 * Transport Factory
 *
 * Creates and caches ChatTransport instances based on the user's AI settings.
 * The factory ensures only one transport instance exists per configuration,
 * disposing old instances when settings change.
 *
 * Private mode has no transport — AI chat is unavailable.
 * BYOK mode uses the Anthropic cloud transport.
 */

import type { AISettings } from '@telostax/engine';
import type { ChatTransport } from './types';
import { BYOKTransport } from './BYOKTransport';
import { useAISettingsStore } from '../../store/aiSettingsStore';

let cachedTransport: ChatTransport | null = null;
let cachedKey = '';

/**
 * Build a cache key from the relevant settings fields.
 * When any of these change, the transport is recreated.
 */
function buildCacheKey(settings: AISettings): string {
  switch (settings.mode) {
    case 'private':
      return 'private';
    case 'byok': {
      const decryptedKey = useAISettingsStore.getState()._decryptedApiKey;
      return `byok:${settings.byokProvider}:${decryptedKey}:${settings.byokModel}`;
    }
  }
}

/**
 * Get or create the ChatTransport for the current AI settings.
 * Returns null for Private mode (no LLM available).
 */
export function getTransport(settings: AISettings): ChatTransport | null {
  if (settings.mode === 'private') {
    cachedTransport?.dispose?.();
    cachedTransport = null;
    cachedKey = 'private';
    return null;
  }

  const key = buildCacheKey(settings);

  if (cachedTransport && cachedKey === key) {
    return cachedTransport;
  }

  // Dispose old transport if it exists
  cachedTransport?.dispose?.();

  const decryptedKey = useAISettingsStore.getState()._decryptedApiKey;
  cachedTransport = new BYOKTransport(
    settings.byokProvider,
    decryptedKey,
    settings.byokModel,
  );

  cachedKey = key;
  return cachedTransport;
}

/**
 * Dispose the current transport and clear the cache.
 * Call when the user changes AI mode or signs out.
 */
export function disposeTransport(): void {
  cachedTransport?.dispose?.();
  cachedTransport = null;
  cachedKey = '';
}
