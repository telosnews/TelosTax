/**
 * Chat Store — Zustand store for the AI chat assistant.
 *
 * Manages chat messages, panel visibility, disclaimer state,
 * and the orchestration of sending messages → PII scanning →
 * building context → calling the active transport → displaying results.
 *
 * Chat history is encrypted and persisted per-return in localStorage
 * using the same AES-256-GCM key as the tax return data. Full history
 * is preserved for future conversation export as PDF tax records.
 */

import { create } from 'zustand';
import type { ChatAction, ChatResponse } from '@telostax/engine';
import {
  sendChatMessage,
  checkChatStatus,
  checkForPII,
} from '../services/chatService';
import { stashPiiTypes } from '../services/privacyAuditLog';
import { buildChatContext } from '../services/chatContextBuilder';
import { detectLocalIntent } from '../services/localIntentDetector';
import {
  buildActionsFromExtraction,
  buildExtractionContextText,
} from '../services/documentToActions';
import {
  saveChatHistory,
  loadChatHistory,
  deleteChatHistory,
  toPersisted,
} from '../services/chatPersistence';
import { useTaxReturnStore, WIZARD_STEPS } from './taxReturnStore';
import { useAISettingsStore } from './aiSettingsStore';
import { isImageFile } from '../hooks/useDocumentImport';

// ─── Types ────────────────────────────────────────

/** Metadata for a document attached to a chat message. */
export interface ChatAttachment {
  /** Original file name (e.g., "W2-Acme.pdf"). */
  fileName: string;
  /** Whether this is a PDF or an image file. */
  fileType: 'pdf' | 'image';
  /** Extraction processing status. */
  status: 'extracting' | 'ocr-processing' | 'done' | 'error';
  /** Detected form type (after extraction). */
  formType?: string;
  /** Error message if extraction failed. */
  errorMessage?: string;
  /** OCR progress percentage (0–100). */
  ocrProgress?: number;
  /** OCR stage label. */
  ocrStage?: string;
}

export interface ChatMessageUI {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** Proposed actions from LLM (assistant messages only). */
  actions?: ChatAction[];
  /** Whether actions have been applied by the user. */
  actionsApplied?: boolean;
  /** Whether actions were dismissed by the user. */
  actionsDismissed?: boolean;
  /** Human-readable summary after applying actions. */
  actionsSummary?: string;
  /** User feedback on this response (null = not rated). Session-only. */
  feedback?: 'up' | 'down' | null;
  /** Suggested follow-up questions from the LLM. */
  followUpChips?: string[];
  /** Attached document metadata (user messages only). */
  attachment?: ChatAttachment;
}

/** PII warning state for display in the chat UI. */
export interface PIIWarningState {
  /** Whether a PII warning is currently showing. */
  active: boolean;
  /** The original message that triggered the warning. */
  originalMessage: string;
  /** The sanitized version of the message. */
  sanitizedMessage: string;
  /** Human-readable warnings. */
  warnings: string[];
  /** Types of PII detected. */
  detectedTypes: string[];
}

interface ChatState {
  // ── State ────────────────────────────────
  messages: ChatMessageUI[];
  isOpen: boolean;
  isLoading: boolean;
  hasAcceptedDisclaimer: boolean;
  isAvailable: boolean;
  modelName: string | null;
  error: string | null;
  chatReturnId: string | null;
  /** PII warning state (shown when PII is detected in a message). */
  piiWarning: PIIWarningState | null;

  // ── Actions ──────────────────────────────
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  acceptDisclaimer: () => void;
  sendMessage: (text: string) => Promise<void>;
  /** Send a message that was sanitized after a PII warning. */
  sendSanitizedMessage: () => Promise<void>;
  /** Dismiss the PII warning without sending. */
  dismissPIIWarning: () => void;
  markActionsApplied: (messageId: string, summary: string) => void;
  markActionsDismissed: (messageId: string) => void;
  /** Set thumbs up/down feedback on a message. Clicking the same thumb toggles it off. */
  setMessageFeedback: (messageId: string, feedback: 'up' | 'down') => void;
  /** Re-send the last user message with fresh context, replacing the last assistant response. */
  regenerateLastResponse: () => Promise<void>;
  /** Edit a user message: truncate conversation from that point and re-send with new text. */
  editAndResend: (messageId: string, newText: string) => Promise<void>;
  /** Retry a user message: truncate from the following assistant response and re-send. */
  retryMessage: (messageId: string) => Promise<void>;
  /** Abort the in-flight message request (stop button / Esc). */
  abortMessage: () => void;
  clearHistory: () => void;
  clearError: () => void;
  checkAvailability: () => Promise<void>;
  hydrateForReturn: (returnId: string) => void;
  /** Open the chat panel and send a pre-filled prompt (used by "Guide Me" buttons).
   *  Optional extraContext is injected into formsReviewContext for the LLM. */
  openWithPrompt: (prompt: string, extraContext?: string) => Promise<void>;
  /** Attach a document (PDF/image), run extraction, and propose import actions. */
  sendDocumentMessage: (file: File) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────

let idCounter = 0;
function generateMessageId(): string {
  return `msg_${Date.now()}_${++idCounter}`;
}

/** Extra context stashed by openWithPrompt, consumed by _doSendMessage. */
let _pendingExtraContext: string | null = null;

/** Active AbortController for the in-flight LLM request. */
let _activeAbortController: AbortController | null = null;

/** Persist current messages to encrypted localStorage (fire-and-forget). */
function _persistMessages(get: () => ChatState): void {
  const { chatReturnId, messages } = get();
  if (!chatReturnId || messages.length === 0) return;
  saveChatHistory(chatReturnId, messages.map(toPersisted));
}

// ─── Store ────────────────────────────────────────

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isOpen: false,
  isLoading: false,
  hasAcceptedDisclaimer: false,
  isAvailable: false,
  modelName: null,
  error: null,
  chatReturnId: null,
  piiWarning: null,

  togglePanel: () => set({ isOpen: !get().isOpen }),
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),

  acceptDisclaimer: () => set({ hasAcceptedDisclaimer: true }),

  abortMessage: () => {
    if (_activeAbortController) {
      _activeAbortController.abort();
      _activeAbortController = null;
    }
    set({ isLoading: false });
  },

  hydrateForReturn: (returnId: string) => {
    set({ chatReturnId: returnId, messages: [], error: null, piiWarning: null });
    // Load persisted history async — messages appear once decrypted
    loadChatHistory(returnId).then((persisted) => {
      // Only apply if we're still on the same return
      if (get().chatReturnId !== returnId) return;
      if (persisted.length > 0) {
        set({ messages: persisted as ChatMessageUI[] });
      }
    });
  },

  clearHistory: () => {
    const returnId = get().chatReturnId;
    set({ messages: [], error: null, piiWarning: null });
    if (returnId) deleteChatHistory(returnId);
  },
  clearError: () => set({ error: null }),

  checkAvailability: async () => {
    try {
      const status = await checkChatStatus();
      set({ isAvailable: status.enabled, modelName: status.model });
    } catch {
      set({ isAvailable: false, modelName: null });
    }
  },

  dismissPIIWarning: () => set({ piiWarning: null }),

  sendMessage: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || get().isLoading) return;

    const aiMode = useAISettingsStore.getState().mode;

    // ── PII Scanning (primary gate) ──
    // In Private mode, PII scanning is informational only (data stays local).
    // In BYOK modes, block and show warning if PII detected.
    if (aiMode !== 'private') {
      const piiResult = checkForPII(trimmed);
      if (piiResult.hasPII) {
        set({
          piiWarning: {
            active: true,
            originalMessage: trimmed,
            sanitizedMessage: piiResult.sanitized,
            warnings: piiResult.warnings,
            detectedTypes: piiResult.detectedTypes,
          },
        });
        return; // Don't send — show warning and let user decide
      }
    }

    // No PII detected (or Private mode) — send directly
    await _doSendMessage(trimmed, set, get);
  },

  sendSanitizedMessage: async () => {
    const warning = get().piiWarning;
    if (!warning) return;

    // Stash PII types so the transport can include them in the audit log
    stashPiiTypes(warning.detectedTypes);
    set({ piiWarning: null });
    await _doSendMessage(warning.sanitizedMessage, set, get);
  },

  markActionsApplied: (messageId: string, summary: string) => {
    set({
      messages: get().messages.map((m) =>
        m.id === messageId
          ? { ...m, actionsApplied: true, actionsSummary: summary }
          : m,
      ),
    });
    _persistMessages(get);
  },

  markActionsDismissed: (messageId: string) => {
    set({
      messages: get().messages.map((m) =>
        m.id === messageId ? { ...m, actionsDismissed: true } : m,
      ),
    });
    _persistMessages(get);
  },

  setMessageFeedback: (messageId: string, feedback: 'up' | 'down') => {
    set({
      messages: get().messages.map((m) =>
        m.id === messageId
          ? { ...m, feedback: m.feedback === feedback ? null : feedback }
          : m,
      ),
    });
    _persistMessages(get);
  },

  regenerateLastResponse: async () => {
    const state = get();
    if (state.isLoading) return;

    // Find the last assistant message
    const msgs = state.messages;
    let assistantIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') { assistantIdx = i; break; }
    }
    if (assistantIdx === -1) return;

    // Find the user message that prompted it
    let userIdx = -1;
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') { userIdx = i; break; }
    }
    if (userIdx === -1) return;

    const userText = msgs[userIdx].content;

    // Remove the assistant response (keep everything before it)
    set({ messages: msgs.slice(0, assistantIdx) });
    _persistMessages(get);

    // Re-send with fresh context (tax data may have changed)
    await _doSendMessage(userText, set, get);
  },

  editAndResend: async (messageId: string, newText: string) => {
    const state = get();
    if (state.isLoading) return;

    const msgs = state.messages;
    const idx = msgs.findIndex((m) => m.id === messageId);
    if (idx === -1 || msgs[idx].role !== 'user') return;

    // Truncate everything from this message onward
    set({ messages: msgs.slice(0, idx) });
    _persistMessages(get);

    // Send the edited text as a new message
    await _doSendMessage(newText.trim(), set, get);
  },

  retryMessage: async (messageId: string) => {
    const state = get();
    if (state.isLoading) return;

    const msgs = state.messages;
    const idx = msgs.findIndex((m) => m.id === messageId);
    if (idx === -1 || msgs[idx].role !== 'user') return;

    const userText = msgs[idx].content;

    // Keep the user message, remove everything after it
    set({ messages: msgs.slice(0, idx + 1) });
    _persistMessages(get);

    // Re-send with fresh context
    await _doSendMessage(userText, set, get);
  },

  openWithPrompt: async (prompt: string, extraContext?: string) => {
    // Open the panel and auto-accept disclaimer so the prompt sends immediately
    set({ isOpen: true, hasAcceptedDisclaimer: true });
    // Stash extra context for _doSendMessage to pick up
    if (extraContext) {
      _pendingExtraContext = extraContext;
    }
    // Small delay to let the panel render before sending
    await new Promise((r) => setTimeout(r, 50));
    await get().sendMessage(prompt);
  },

  sendDocumentMessage: async (file: File) => {
    if (get().isLoading) return;

    const isImage = isImageFile(file);
    const fileType: 'pdf' | 'image' = isImage ? 'image' : 'pdf';

    // Create user message with attachment in "extracting" state
    const userMsg: ChatMessageUI = {
      id: generateMessageId(),
      role: 'user',
      content: `Attached: ${file.name}`,
      timestamp: Date.now(),
      attachment: {
        fileName: file.name,
        fileType,
        status: 'extracting',
      },
    };

    set({ messages: [...get().messages, userMsg], isLoading: true, error: null });

    // Helper to update the attachment status on the user message
    const updateAttachment = (patch: Partial<ChatAttachment>) => {
      set({
        messages: get().messages.map((m) =>
          m.id === userMsg.id
            ? { ...m, attachment: { ...m.attachment!, ...patch } }
            : m,
        ),
      });
    };

    // OCR progress callback
    const onProgress = (stage: string, pct: number) => {
      updateAttachment({ status: 'ocr-processing', ocrStage: stage, ocrProgress: Math.round(pct) });
    };

    try {
      // Lazy-import extraction functions to avoid loading Syncfusion/Tesseract eagerly
      const { extractFromPDF, extractFromPDFWithOCR, extractFromImage } =
        await import('../services/pdfImporter');

      let result;
      if (isImage) {
        result = await extractFromImage(file, onProgress);
      } else {
        // Try digital extraction first
        result = await extractFromPDF(file);
        // If the PDF is scanned, auto-fallback to OCR (no confirmation dialog in chat)
        if (result.ocrAvailable && (result.confidence === 'low' || !result.formType)) {
          updateAttachment({ status: 'ocr-processing', ocrStage: 'loading', ocrProgress: 0 });
          result = await extractFromPDFWithOCR(file, onProgress);
        }
      }

      // Mark extraction complete on the user message
      updateAttachment({
        status: 'done',
        formType: result.formType || undefined,
      });

      const aiMode = useAISettingsStore.getState().mode;

      let response;
      if (aiMode === 'private') {
        // Private mode: generate synthetic response locally (no LLM)
        response = buildActionsFromExtraction(result);
      } else {
        // BYOK: send extraction context to LLM for a richer response.
        // Run through PII scanner to strip SSNs, names, addresses that OCR may have captured.
        const rawSummary = buildExtractionContextText(result);
        const piiCheck = checkForPII(rawSummary);
        const extractionSummary = piiCheck.hasPII ? piiCheck.sanitized : rawSummary;
        const llmMessage =
          `I've attached a tax document (${file.name}). Here's what was extracted:\n\n${extractionSummary}\n\nPlease review this and propose add_income actions to import this into my return. If any values look wrong or suspicious, flag them.`;

        // Use the existing send pipeline
        const taxStore = useTaxReturnStore.getState();
        const currentStep = taxStore.getCurrentStep();
        const visibleSteps = taxStore.getVisibleSteps();
        const activeToolId = taxStore.activeToolId;
        const stepId = activeToolId || currentStep?.id || 'unknown';
        const section = activeToolId ? 'tools' : (currentStep?.section || 'unknown');

        const context = buildChatContext(
          taxStore.taxReturn,
          stepId,
          section,
          taxStore.calculation,
          visibleSteps,
          WIZARD_STEPS,
        );

        // Include extraction data in context
        context.documentExtractionContext = extractionSummary;

        const history = get().messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }))
          .filter((m) => m.content.length > 0 && m.content.length <= 20_000);

        response = await sendChatMessage(llmMessage, history, context);
      }

      // Add assistant response with actions
      const assistantMsg: ChatMessageUI = {
        id: generateMessageId(),
        role: 'assistant',
        content: response.message,
        timestamp: Date.now(),
        actions:
          response.actions && response.actions.length > 0
            ? response.actions.filter((a) => a.type !== 'no_action')
            : undefined,
        followUpChips: response.followUpChips,
      };

      set({ messages: [...get().messages, assistantMsg], isLoading: false });
      _persistMessages(get);

      // Handle navigation suggestion
      if (
        response.suggestedStep &&
        (!response.actions || response.actions.every((a) => a.type === 'no_action'))
      ) {
        useTaxReturnStore.getState().goToStep(response.suggestedStep);
      }
    } catch (err: any) {
      updateAttachment({ status: 'error', errorMessage: err.message });
      set({
        isLoading: false,
        error: `Document extraction failed: ${err.message || 'Unknown error'}`,
      });
    }
  },
}));

// ─── Internal Send Logic ─────────────────────────

async function _doSendMessage(
  text: string,
  set: (partial: Partial<ChatState>) => void,
  get: () => ChatState,
) {
  // Add user message
  const userMsg: ChatMessageUI = {
    id: generateMessageId(),
    role: 'user',
    content: text,
    timestamp: Date.now(),
  };

  const updatedWithUser = [...get().messages, userMsg];
  set({ messages: updatedWithUser, isLoading: true, error: null });

  try {
    // ── Local intent detection (bypasses LLM for simple deterministic actions) ──
    const localResponse = detectLocalIntent(text);
    if (localResponse) {
      const assistantMsg: ChatMessageUI = {
        id: generateMessageId(),
        role: 'assistant',
        content: localResponse.message,
        timestamp: Date.now(),
        actions:
          localResponse.actions && localResponse.actions.length > 0
            ? localResponse.actions.filter((a) => a.type !== 'no_action')
            : undefined,
        followUpChips: localResponse.followUpChips,
      };
      set({ messages: [...get().messages, assistantMsg], isLoading: false });
      _persistMessages(get);
      return;
    }

    // Build conversation history (last 10, excluding the just-added user message)
    // Guard: filter out any messages with missing/oversized content (server caps at 20k)
    const allMsgs = get().messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    const history = allMsgs
      .slice(0, -1)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))
      .filter((m) => typeof m.content === 'string' && m.content.length > 0 && m.content.length <= 20_000);

    // Build PII-safe context from current tax return state
    const taxStore = useTaxReturnStore.getState();
    const currentStep = taxStore.getCurrentStep();
    const visibleSteps = taxStore.getVisibleSteps();

    // Use activeToolId when a tool view is open — otherwise the AI
    // thinks the user is on whatever wizard step they were last on.
    const activeToolId = taxStore.activeToolId;
    const stepId = activeToolId || currentStep?.id || 'unknown';
    const section = activeToolId ? 'tools' : (currentStep?.section || 'unknown');

    const context = buildChatContext(
      taxStore.taxReturn,
      stepId,
      section,
      taxStore.calculation,
      visibleSteps,
      WIZARD_STEPS,
    );

    // Inject extra context from openWithPrompt (e.g., Forms Mode review data)
    if (_pendingExtraContext) {
      context.formsReviewContext = _pendingExtraContext;
      _pendingExtraContext = null;
    }

    // Create AbortController for this request (enables stop button)
    _activeAbortController = new AbortController();

    // Call the active transport via chatService
    const response: ChatResponse = await sendChatMessage(text, history, context, _activeAbortController.signal);

    // Add assistant response
    const assistantMsg: ChatMessageUI = {
      id: generateMessageId(),
      role: 'assistant',
      content: response.message,
      timestamp: Date.now(),
      actions:
        response.actions && response.actions.length > 0
          ? response.actions.filter((a) => a.type !== 'no_action')
          : undefined,
      followUpChips: response.followUpChips,
    };

    const updatedWithAssistant = [...get().messages, assistantMsg];
    _activeAbortController = null;
    set({ messages: updatedWithAssistant, isLoading: false });
    _persistMessages(get);

    // Handle navigation suggestion
    if (
      response.suggestedStep &&
      (!response.actions || response.actions.every((a) => a.type === 'no_action'))
    ) {
      useTaxReturnStore.getState().goToStep(response.suggestedStep);
    }
  } catch (err: any) {
    _activeAbortController = null;
    // If the user aborted, don't show an error
    if (err.name === 'AbortError') {
      set({ isLoading: false });
      return;
    }
    set({
      isLoading: false,
      error: err.message || 'Something went wrong. Please try again.',
    });
  }
}
