/**
 * AI Settings Store — persisted Zustand store for AI mode preferences.
 *
 * Manages the user's AI mode selection (Private/BYOK), Anthropic API key,
 * model choice, and consent state.
 *
 * Security:
 *   - BYOK API keys are encrypted at rest using the vault passphrase (AES-256-GCM).
 *   - The encrypted blob is stored in localStorage['telostax:ai-key-enc'].
 *   - The decrypted key is held in memory only while the vault is unlocked.
 *   - On lock, the in-memory key is cleared.
 *   - Keys are NEVER sent to our server for storage — only passed in
 *     individual request bodies over HTTPS.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AIMode,
  AISettings,
} from '@telostax/engine';
import { DEFAULT_AI_SETTINGS } from '@telostax/engine';
import {
  encrypt as encryptStr,
  decrypt as decryptStr,
  getActiveKey,
} from '../services/crypto';

const ENC_KEY_STORAGE = 'telostax:ai-key-enc';

interface AISettingsState extends AISettings {
  // ── In-memory only (not persisted) ──
  _decryptedApiKey: string;

  // ── Actions ──────────────────────────────
  setMode: (mode: AIMode) => void;

  // BYOK
  setBYOKApiKey: (key: string) => void;
  setBYOKModel: (model: string) => void;
  clearBYOKKey: () => void;

  // Encryption lifecycle
  saveApiKeyEncrypted: (key: string) => Promise<void>;
  loadApiKey: () => Promise<void>;
  clearDecryptedKey: () => void;

  // Consent
  acceptCloudConsent: () => void;
  revokeCloudConsent: () => void;

  // Reset
  resetToDefaults: () => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set, get) => ({
      // ── Initial state from defaults ──
      ...DEFAULT_AI_SETTINGS,
      _decryptedApiKey: '',

      // ── Mode ──
      setMode: (mode) => set({ mode }),

      // ── BYOK ──
      setBYOKApiKey: (key) => {
        set({
          byokApiKey: '', // Clear plaintext from persisted state
          byokApiKeys: { anthropic: '' },
          _decryptedApiKey: key,
        });
        // Encrypt and save asynchronously
        get().saveApiKeyEncrypted(key);
      },
      setBYOKModel: (byokModel) => set({ byokModel }),
      clearBYOKKey: () => {
        set({
          byokApiKey: '',
          byokApiKeys: { anthropic: '' },
          _decryptedApiKey: '',
        });
        localStorage.removeItem(ENC_KEY_STORAGE);
      },

      // ── Encryption lifecycle ──
      saveApiKeyEncrypted: async (key: string) => {
        const cryptoKey = getActiveKey();
        if (!cryptoKey || !key) return;
        try {
          const encrypted = await encryptStr(key, cryptoKey);
          localStorage.setItem(ENC_KEY_STORAGE, encrypted);
        } catch {
          console.warn('Failed to encrypt API key');
        }
      },

      loadApiKey: async () => {
        const cryptoKey = getActiveKey();
        if (!cryptoKey) return;

        // 1. If encrypted blob already exists, decrypt and load
        const encBlob = localStorage.getItem(ENC_KEY_STORAGE);
        if (encBlob) {
          try {
            const decrypted = await decryptStr(encBlob, cryptoKey);
            set({ _decryptedApiKey: decrypted });
          } catch {
            console.warn('Failed to decrypt API key');
          }
          return;
        }

        // 2. Migration: find old plaintext key from any source
        let oldKey = '';

        // Check the migration stash (set by v4→v5 migration before partialize ran)
        const migrateKey = localStorage.getItem('telostax:ai-key-migrate');
        if (migrateKey) {
          oldKey = migrateKey;
        }

        // Check in-memory state (may still have it before first persist cycle)
        if (!oldKey) {
          const state = get();
          oldKey = state.byokApiKey || state.byokApiKeys?.anthropic || '';
        }

        // Check raw localStorage JSON (fallback)
        if (!oldKey) {
          try {
            const raw = localStorage.getItem('telostax:ai-settings');
            if (raw) {
              const parsed = JSON.parse(raw);
              const s = parsed?.state || parsed;
              oldKey = s?.byokApiKey || s?.byokApiKeys?.anthropic || '';
            }
          } catch { /* corrupted — skip */ }
        }

        if (oldKey) {
          try {
            const encrypted = await encryptStr(oldKey, cryptoKey);
            localStorage.setItem(ENC_KEY_STORAGE, encrypted);
            set({ byokApiKey: '', byokApiKeys: { anthropic: '' }, _decryptedApiKey: oldKey });
          } catch { /* encryption failed */ }
          // Clean up migration stash
          localStorage.removeItem('telostax:ai-key-migrate');
        }
      },

      clearDecryptedKey: () => {
        set({ _decryptedApiKey: '' });
      },

      // ── Consent ──
      acceptCloudConsent: () => set({ hasConsentedToCloudAI: true }),
      revokeCloudConsent: () => set({ hasConsentedToCloudAI: false }),

      // ── Reset ──
      resetToDefaults: () => {
        localStorage.removeItem(ENC_KEY_STORAGE);
        set({ ...DEFAULT_AI_SETTINGS, _decryptedApiKey: '' });
      },
    }),
    {
      name: 'telostax:ai-settings',
      version: 5,
      // Exclude _decryptedApiKey and byokApiKey from persistence
      partialize: (state) => {
        const { _decryptedApiKey, byokApiKey, byokApiKeys, ...rest } = state;
        return { ...rest, byokApiKey: '', byokApiKeys: { anthropic: '' } };
      },
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          const provider = persisted.byokProvider || 'anthropic';
          const key = persisted.byokApiKey || '';
          persisted.byokApiKeys = { anthropic: '', [provider]: key };
        }
        if (version < 3) {
          delete persisted.localModel;
        }
        if (version < 4) {
          persisted.mode = persisted.mode === 'paid' ? 'private' : persisted.mode;
          persisted.byokProvider = 'anthropic';
          persisted.byokApiKey = persisted.byokApiKeys?.anthropic || '';
          persisted.byokApiKeys = { anthropic: persisted.byokApiKeys?.anthropic || '' };
          persisted.byokModel = persisted.byokModel?.startsWith('claude-') ? persisted.byokModel : 'claude-haiku-4-5-20251001';
          delete persisted.paidProvider;
          delete persisted.paidSessionToken;
          delete persisted.paidSessionExpiry;
        }
        if (version < 5) {
          // v4 → v5: Stash the plaintext key in a separate localStorage key
          // before partialize strips it on the immediate re-persist.
          // loadApiKey() will pick this up and encrypt it on first unlock.
          const keyToMigrate = persisted.byokApiKey || persisted.byokApiKeys?.anthropic || '';
          if (keyToMigrate) {
            localStorage.setItem('telostax:ai-key-migrate', keyToMigrate);
          }
        }
        return persisted;
      },
    },
  ),
);
