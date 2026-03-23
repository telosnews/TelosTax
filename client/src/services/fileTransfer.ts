/**
 * Encrypted file transfer — export/import TaxReturn as a portable .telostax file.
 *
 * File format: JSON with { format, version, exportedAt, salt, iv, ct }
 * Encryption: AES-256-GCM with PBKDF2-derived key (600k iterations, SHA-256)
 *
 * The decrypted ciphertext is a JSON-stringified TaxReturn.
 */

import type { TaxReturn } from '@telostax/engine';
import { migrateReturn, needsMigration } from '@telostax/engine';

const FORMAT_MARKER = 'telostax-transfer';
const FORMAT_VERSION = 1;
const PBKDF2_ITERATIONS = 600_000;

export interface TelosTaxFile {
  format: typeof FORMAT_MARKER;
  version: number;
  exportedAt: string;
  salt: number[];
  iv: number[];
  ct: number[];
}

function isTelosTaxFile(obj: unknown): obj is TelosTaxFile {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return o.format === FORMAT_MARKER
    && typeof o.version === 'number'
    && Array.isArray(o.salt)
    && Array.isArray(o.iv)
    && Array.isArray(o.ct);
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt a TaxReturn into a downloadable .telostax Blob. */
export async function exportReturnToFile(taxReturn: TaxReturn, password: string): Promise<Blob> {
  const plaintext = JSON.stringify(taxReturn);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  const file: TelosTaxFile = {
    format: FORMAT_MARKER,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    salt: Array.from(salt),
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ciphertext)),
  };

  return new Blob([JSON.stringify(file)], { type: 'application/octet-stream' });
}

export type ImportResult =
  | { ok: true; taxReturn: TaxReturn }
  | { ok: false; error: 'invalid_file' | 'wrong_password' | 'corrupted' | 'read_error'; message: string };

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/** Read and decrypt a .telostax file. Returns the TaxReturn or an error. */
export async function importReturnFromFile(file: File, password: string): Promise<ImportResult> {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: 'invalid_file', message: 'File is too large. Maximum size is 50 MB.' };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: 'read_error', message: 'Could not read the file.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid_file', message: 'This is not a valid .telostax file.' };
  }

  if (!isTelosTaxFile(parsed)) {
    return { ok: false, error: 'invalid_file', message: 'This is not a valid .telostax file.' };
  }

  if (parsed.version !== FORMAT_VERSION) {
    return { ok: false, error: 'invalid_file', message: `Unsupported file version (v${parsed.version}). This app supports v${FORMAT_VERSION}.` };
  }

  let decryptedText: string;
  try {
    const salt = new Uint8Array(parsed.salt);
    const iv = new Uint8Array(parsed.iv);
    const ct = new Uint8Array(parsed.ct);
    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    decryptedText = new TextDecoder().decode(decrypted);
  } catch {
    return { ok: false, error: 'wrong_password', message: 'Incorrect password. Please try again.' };
  }

  let taxReturn: TaxReturn;
  try {
    const parsed2 = JSON.parse(decryptedText);
    if (
      typeof parsed2 !== 'object' ||
      parsed2 === null ||
      typeof parsed2.taxYear !== 'number' ||
      typeof parsed2.createdAt !== 'string'
    ) {
      return { ok: false, error: 'corrupted', message: 'The file data is not a valid tax return.' };
    }
    taxReturn = parsed2;
  } catch {
    return { ok: false, error: 'corrupted', message: 'The file data is corrupted.' };
  }

  // Assign a new ID so it doesn't collide with an existing return
  taxReturn.id = crypto.randomUUID();
  taxReturn.updatedAt = new Date().toISOString();

  // Require schemaVersion — files without it are too old or invalid to migrate safely
  if (typeof taxReturn.schemaVersion !== 'number') {
    return { ok: false, error: 'corrupted', message: 'The file is missing a schema version and cannot be imported.' };
  }

  // Run schema migration if needed
  if (needsMigration(taxReturn)) {
    const migrated = migrateReturn(taxReturn) as unknown as TaxReturn;
    if (migrated) taxReturn = migrated;
  }

  return { ok: true, taxReturn };
}
