/**
 * Deduction Finder Store
 *
 * Persists scan state (transactions, files, AI results) across component
 * mount/unmount cycles. Without this, navigating away from the Deduction
 * Finder step loses all uploaded data and scan results.
 *
 * Security:
 *   - Categorization results are encrypted at rest using the vault passphrase (AES-256-GCM).
 *   - The encrypted blob is stored in localStorage['telostax:expense-scanner-enc'].
 *   - On vault lock, in-memory categorization data is cleared.
 *   - On vault unlock, the encrypted blob is decrypted and restored.
 *   - Raw transactions are NOT persisted (re-upload is fast).
 */

import { create } from 'zustand';
import type {
  DeductionFinderState,
  NormalizedTransaction,
  UploadedFileInfo,
} from '../services/deductionFinderTypes';
import type { MerchantClassification } from '../services/merchantClassifier';
import type { CategorizationResult, CategorizedTransaction } from '../services/transactionCategorizerTypes';
import { buildCategorySummaries } from '../services/transactionCategorizer';
import {
  encrypt as encryptStr,
  decrypt as decryptStr,
  getActiveKey,
} from '../services/crypto';

const ENC_STORAGE_KEY = 'telostax:expense-scanner-enc';
const OLD_STORAGE_KEY = 'telostax:expense-scanner';

/** Debounce timer for auto-save. */
let saveTimer: ReturnType<typeof setTimeout> | null = null;

interface DeductionFinderStoreState {
  // ── Legacy scan state (pattern engine) ──
  scanState: DeductionFinderState | null;
  allTransactions: NormalizedTransaction[];
  uploadedFiles: UploadedFileInfo[];
  aiClassifications: MerchantClassification[] | null;
  isProcessing: boolean;
  isClassifying: boolean;
  aiError: string | null;

  // ── New categorizer state ──
  categorizationResult: CategorizationResult | null;
  categorizationProgress: string | null;
  isCategorizing: boolean;

  // ── Smart Expense Scanner state ──
  enabledCategories: string[];
  scannerPhase: 'upload' | 'setup' | 'scanning' | 'results';

  // ── Legacy setters ──
  setScanState: (s: DeductionFinderState | null) => void;
  setAllTransactions: (t: NormalizedTransaction[]) => void;
  setUploadedFiles: (f: UploadedFileInfo[]) => void;
  setAiClassifications: (c: MerchantClassification[] | null) => void;
  setIsProcessing: (v: boolean) => void;
  setIsClassifying: (v: boolean) => void;
  setAiError: (e: string | null) => void;

  // ── New categorizer setters ──
  setCategorizationResult: (r: CategorizationResult | null) => void;
  setCategorizationProgress: (p: string | null) => void;
  setIsCategorizing: (v: boolean) => void;

  // ── Smart Expense Scanner setters ──
  setEnabledCategories: (cats: string[]) => void;
  setScannerPhase: (phase: 'upload' | 'setup' | 'scanning' | 'results') => void;

  /** Update a single categorized transaction (for user reclassification). */
  updateCategorizedTransaction: (index: number, patch: Partial<CategorizedTransaction>) => void;
  /** Approve all transactions in a category. */
  approveCategory: (category: string) => void;

  // ── Encryption lifecycle ──
  loadDecrypted: () => Promise<void>;
  clearDecryptedState: () => void;

  reset: () => void;
}

/** Save the persisted fields to encrypted localStorage (debounced). */
function scheduleSave(state: DeductionFinderStoreState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const cryptoKey = getActiveKey();
    if (!cryptoKey) return;

    const payload = {
      categorizationResult: state.categorizationResult,
      enabledCategories: state.enabledCategories,
      scannerPhase: state.categorizationResult ? state.scannerPhase : 'upload',
    };

    try {
      const encrypted = await encryptStr(JSON.stringify(payload), cryptoKey);
      localStorage.setItem(ENC_STORAGE_KEY, encrypted);
    } catch {
      console.warn('Failed to encrypt expense scanner state');
    }
  }, 500);
}

export const useDeductionFinderStore = create<DeductionFinderStoreState>()(
  (set, get) => ({
  scanState: null,
  allTransactions: [],
  uploadedFiles: [],
  aiClassifications: null,
  isProcessing: false,
  isClassifying: false,
  aiError: null,
  categorizationResult: null,
  categorizationProgress: null,
  isCategorizing: false,
  enabledCategories: [],
  scannerPhase: 'upload' as const,

  setScanState: (s) => set({ scanState: s }),
  setAllTransactions: (t) => set({ allTransactions: t }),
  setUploadedFiles: (f) => set({ uploadedFiles: f }),
  setAiClassifications: (c) => set({ aiClassifications: c }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  setIsClassifying: (v) => set({ isClassifying: v }),
  setAiError: (e) => set({ aiError: e }),
  setCategorizationResult: (r) => {
    set({ categorizationResult: r });
    scheduleSave(get());
  },
  setCategorizationProgress: (p) => set({ categorizationProgress: p }),
  setIsCategorizing: (v) => set({ isCategorizing: v }),
  setEnabledCategories: (cats) => {
    set({ enabledCategories: cats });
    scheduleSave(get());
  },
  setScannerPhase: (phase) => {
    set({ scannerPhase: phase });
    scheduleSave(get());
  },

  updateCategorizedTransaction: (index, patch) => {
    const result = get().categorizationResult;
    if (!result) return;
    const updated = result.transactions.map((t) =>
      t.transactionIndex === index ? { ...t, ...patch, source: 'user' as const } : t,
    );
    set({
      categorizationResult: {
        ...result,
        transactions: updated,
        summaries: buildCategorySummaries(updated),
      },
    });
    scheduleSave(get());
  },

  approveCategory: (category) => {
    const result = get().categorizationResult;
    if (!result) return;
    const updated = result.transactions.map((t) =>
      t.category === category ? { ...t, approved: true } : t,
    );
    const updatedSummaries = result.summaries.map((s) =>
      s.category === category ? { ...s, approved: true } : s,
    );
    set({
      categorizationResult: {
        ...result,
        transactions: updated,
        summaries: updatedSummaries,
      },
    });
    scheduleSave(get());
  },

  // ── Encryption lifecycle ──
  loadDecrypted: async () => {
    const cryptoKey = getActiveKey();
    if (!cryptoKey) return;

    // Migration: if old plaintext storage exists, encrypt it
    const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldRaw) {
      try {
        const oldData = JSON.parse(oldRaw);
        // Extract the persisted subset (Zustand persist wraps in { state, version })
        const state = oldData?.state || oldData;
        if (state.categorizationResult) {
          const payload = {
            categorizationResult: state.categorizationResult,
            enabledCategories: state.enabledCategories || [],
            scannerPhase: state.scannerPhase || 'upload',
          };
          const encrypted = await encryptStr(JSON.stringify(payload), cryptoKey);
          localStorage.setItem(ENC_STORAGE_KEY, encrypted);
          set({
            categorizationResult: payload.categorizationResult,
            enabledCategories: payload.enabledCategories,
            scannerPhase: payload.scannerPhase as any,
          });
        }
        localStorage.removeItem(OLD_STORAGE_KEY);
        return;
      } catch {
        // Old data corrupted, continue to try encrypted
        localStorage.removeItem(OLD_STORAGE_KEY);
      }
    }

    // Load from encrypted storage
    const blob = localStorage.getItem(ENC_STORAGE_KEY);
    if (!blob) return;
    try {
      const json = await decryptStr(blob, cryptoKey);
      const data = JSON.parse(json);
      set({
        categorizationResult: data.categorizationResult || null,
        enabledCategories: data.enabledCategories || [],
        scannerPhase: data.scannerPhase || 'upload',
      });
    } catch {
      console.warn('Failed to decrypt expense scanner state');
    }
  },

  clearDecryptedState: () => {
    if (saveTimer) clearTimeout(saveTimer);
    set({
      categorizationResult: null,
      categorizationProgress: null,
      enabledCategories: [],
      scannerPhase: 'upload',
    });
  },

  reset: () => {
    if (saveTimer) clearTimeout(saveTimer);
    localStorage.removeItem(ENC_STORAGE_KEY);
    set({
      scanState: null,
      allTransactions: [],
      uploadedFiles: [],
      aiClassifications: null,
      isProcessing: false,
      isClassifying: false,
      aiError: null,
      categorizationResult: null,
      categorizationProgress: null,
      isCategorizing: false,
      enabledCategories: [],
      scannerPhase: 'upload' as const,
    });
  },
  }),
);
