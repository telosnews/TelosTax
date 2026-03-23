/**
 * Privacy Audit Log — local-only IndexedDB log of every outbound AI request.
 *
 * Lets users verify exactly what data left their device: what was sent,
 * what PII was blocked, which context fields were included, and a truncated
 * response summary. Transforms the privacy promise from "trust us" to
 * "verify yourself."
 *
 * Security:
 *   - Never stores pre-redaction text (no PII in the log)
 *   - Only stores: redacted message, PII block summary, context keys, response preview
 *   - Encrypted with vault key via AES-256-GCM (same pattern as expense scanner)
 *   - Auto-caps at 200 entries (oldest pruned first)
 *   - Cleared by wipeAllData() (IndexedDB wipe already covers this)
 */

import {
  encrypt as encryptStr,
  decrypt as decryptStr,
  getActiveKey,
} from './crypto';

const DB_NAME = 'telostax-privacy-log';
const STORE_NAME = 'entries';
const DB_VERSION = 1;
const MAX_ENTRIES = 200;

// ─── Types ─────────────────────────────────────────

export interface PrivacyAuditEntry {
  id: string;
  timestamp: string;
  feature: 'chat' | 'expense-scanner' | 'document-extract';
  direction: 'outbound';
  provider: string;
  model: string;
  /** The redacted message that was actually sent (post-PII stripping). */
  redactedMessage: string;
  /** Summary of PII that was blocked, e.g. ["SSN ×1", "email ×2"]. Never the actual values. */
  piiBlocked: string[];
  /** Which context keys were included in the request. */
  contextKeysSent: string[];
  /** First 200 chars of the AI response (enough to identify the exchange). */
  responseTruncated: string;
}

// ─── IndexedDB Helpers ─────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllRaw(): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readonly');
    const store = txn.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
}

async function putRaw(id: string, blob: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite');
    const store = txn.objectStore(STORE_NAME);
    store.put({ id, blob });
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });
}

async function deleteRaw(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite');
    const store = txn.objectStore(STORE_NAME);
    store.delete(id);
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });
}

async function countRaw(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readonly');
    const store = txn.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Public API ────────────────────────────────────

/**
 * Log an outbound AI request to the privacy audit log.
 * Encrypts the entry with the vault key before storing.
 */
export async function logOutboundRequest(
  entry: Omit<PrivacyAuditEntry, 'id' | 'timestamp' | 'direction'>,
): Promise<void> {
  const key = getActiveKey();
  if (!key) return; // Vault locked — skip logging

  const full: PrivacyAuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    direction: 'outbound',
    // Truncate fields to prevent bloat
    redactedMessage: entry.redactedMessage.slice(0, 2000),
    responseTruncated: entry.responseTruncated.slice(0, 200),
  };

  try {
    const encrypted = await encryptStr(JSON.stringify(full), key);
    await putRaw(full.id, encrypted);

    // Prune if over limit
    const count = await countRaw();
    if (count > MAX_ENTRIES) {
      await pruneOldest(count - MAX_ENTRIES);
    }
  } catch {
    // Non-critical — don't break the AI feature if logging fails
  }
}

/**
 * Read all entries from the privacy audit log (decrypted).
 * Returns newest-first.
 */
export async function getAuditEntries(): Promise<PrivacyAuditEntry[]> {
  const key = getActiveKey();
  if (!key) return [];

  try {
    const rows = await getAllRaw();
    const entries: PrivacyAuditEntry[] = [];
    for (const row of rows) {
      try {
        const blob = (row as any).blob;
        const json = await decryptStr(blob, key);
        entries.push(JSON.parse(json));
      } catch {
        // Skip corrupted entries
      }
    }
    // Sort newest first
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return entries;
  } catch {
    return [];
  }
}

/**
 * Clear all entries from the privacy audit log.
 */
export async function clearAuditLog(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const txn = db.transaction(STORE_NAME, 'readwrite');
      const store = txn.objectStore(STORE_NAME);
      store.clear();
      txn.oncomplete = () => resolve();
      txn.onerror = () => reject(txn.error);
    });
  } catch {
    // Non-critical
  }
}

/** Remove the N oldest entries. */
async function pruneOldest(count: number): Promise<void> {
  const entries = await getAuditEntries();
  // Entries are newest-first, so oldest are at the end
  const toDelete = entries.slice(-count);
  for (const entry of toDelete) {
    await deleteRaw(entry.id);
  }
}

// ─── PII Type Stash ────────────────────────────────
// The chat store sets detected PII types before sending a sanitized message.
// The transport reads them when logging. This avoids changing the transport interface.

let _stashedPiiTypes: string[] = [];

/** Stash PII types detected by the client-side scanner (called by chatStore). */
export function stashPiiTypes(types: string[]): void {
  _stashedPiiTypes = types;
}

/** Consume stashed PII types (called by transport when logging). Clears the stash. */
export function consumePiiTypes(): string[] {
  const types = _stashedPiiTypes;
  _stashedPiiTypes = [];
  return types;
}

/**
 * Build PII block summary from a scanForPII result.
 * Returns human-readable strings like "SSN ×1", "email ×2".
 */
export function buildPiiBlockSummary(
  detectedTypes: string[],
): string[] {
  if (!detectedTypes.length) return [];

  const counts = new Map<string, number>();
  for (const t of detectedTypes) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }

  return Array.from(counts.entries()).map(
    ([type, count]) => count > 1 ? `${type} ×${count}` : type,
  );
}
