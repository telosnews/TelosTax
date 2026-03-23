/**
 * Chat Persistence — encrypted per-return chat history in localStorage.
 *
 * Chat history is encrypted with the same AES-256-GCM key as the tax return
 * data (derived from the user's passphrase via PBKDF2). This means:
 * - History is unreadable without the passphrase
 * - History is cleared by wipeAllData() (nuclear delete)
 * - History is cleared when the associated return is deleted
 *
 * Full history is preserved (no cap) to support future conversation export
 * as PDF for tax records ("Why I chose itemized deductions").
 *
 * Raw action payloads are stripped before persistence — only the human-readable
 * actionsSummary is kept. This avoids duplicating structured tax data and keeps
 * the audit trail readable.
 */

import { encrypt, decrypt, getActiveKey } from './crypto';

const CHAT_KEY_PREFIX = 'telostax:chat:';

function chatKey(returnId: string): string {
  return `${CHAT_KEY_PREFIX}${returnId}`;
}

/** Persistable subset of ChatMessageUI — strips raw actions. */
export interface PersistedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  actionsApplied?: boolean;
  actionsDismissed?: boolean;
  actionsSummary?: string;
  feedback?: 'up' | 'down' | null;
  followUpChips?: string[];
  /** Minimal attachment metadata (file name + detected form type only). */
  attachment?: {
    fileName: string;
    fileType: 'pdf' | 'image';
    formType?: string;
  };
}

/**
 * Strip a ChatMessageUI down to its persistable form.
 * Removes raw `actions` array (contains structured tax data).
 */
export function toPersisted(msg: {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  actions?: unknown[];
  actionsApplied?: boolean;
  actionsDismissed?: boolean;
  actionsSummary?: string;
  feedback?: 'up' | 'down' | null;
  followUpChips?: string[];
  attachment?: { fileName: string; fileType: 'pdf' | 'image'; formType?: string; status?: string };
}): PersistedMessage {
  const p: PersistedMessage = {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
  };
  if (msg.actionsApplied) p.actionsApplied = true;
  if (msg.actionsDismissed) p.actionsDismissed = true;
  if (msg.actionsSummary) p.actionsSummary = msg.actionsSummary;
  if (msg.feedback) p.feedback = msg.feedback;
  if (msg.followUpChips?.length) p.followUpChips = msg.followUpChips;
  if (msg.attachment) {
    p.attachment = {
      fileName: msg.attachment.fileName,
      fileType: msg.attachment.fileType,
      ...(msg.attachment.formType ? { formType: msg.attachment.formType } : {}),
    };
  }
  return p;
}

/**
 * Save chat messages for a return. Encrypts and writes to localStorage.
 * Debounced externally — call after each message exchange.
 */
export async function saveChatHistory(
  returnId: string,
  messages: PersistedMessage[],
): Promise<void> {
  if (!getActiveKey()) return; // Locked — can't encrypt
  if (messages.length === 0) {
    localStorage.removeItem(chatKey(returnId));
    return;
  }

  try {
    const json = JSON.stringify(messages);
    const encrypted = await encrypt(json);
    localStorage.setItem(chatKey(returnId), encrypted);
  } catch {
    // Encryption failure or localStorage full — fail silently.
    // Chat persistence is best-effort; losing history is not catastrophic.
  }
}

/**
 * Load chat messages for a return. Decrypts from localStorage.
 * Returns empty array if no history or decryption fails.
 */
export async function loadChatHistory(
  returnId: string,
): Promise<PersistedMessage[]> {
  if (!getActiveKey()) return [];

  const raw = localStorage.getItem(chatKey(returnId));
  if (!raw) return [];

  try {
    const json = await decrypt(raw);
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    // Decryption failure (wrong key, corrupted data) — return empty.
    return [];
  }
}

/**
 * Delete chat history for a specific return.
 * Called when a return is deleted.
 */
export function deleteChatHistory(returnId: string): void {
  localStorage.removeItem(chatKey(returnId));
}

/**
 * Delete all chat history across all returns.
 * Called by wipeAllData().
 */
export function deleteAllChatHistory(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CHAT_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}
