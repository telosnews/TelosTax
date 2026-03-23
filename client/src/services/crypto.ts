/**
 * Client-side encryption utilities using Web Crypto API.
 *
 * Encrypts TaxReturn data at rest in localStorage using AES-256-GCM
 * with a key derived from a user passphrase via PBKDF2.
 *
 * Key management:
 * - The user's passphrase is never stored
 * - A random salt is generated on first setup and stored in localStorage
 * - The CryptoKey is derived on unlock and held in memory only
 * - On lock/timeout, the key reference is cleared from memory
 */

const SALT_KEY = 'telostax:salt';
const VERIFY_KEY = 'telostax:verify';
const PBKDF2_ITERATIONS = 600_000;
const AAD = new TextEncoder().encode('telostax-v1');

// ─── Unlock Throttling (UX guard, not security control) ──────
// Prevents accidental lockout from typos. NOT a brute-force defense —
// an attacker with localStorage access can call deriveKey() directly.
// The actual brute-force defense is PBKDF2 iteration count (600K).

let failedAttempts = 0;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MS = 30_000; // 30 seconds
let lockoutUntil = 0;

// ─── In-memory Key ──────────────────────────────────

let activeKey: CryptoKey | null = null;

export function getActiveKey(): CryptoKey | null {
  return activeKey;
}

export function setActiveKey(key: CryptoKey | null): void {
  activeKey = key;
}

export function isUnlocked(): boolean {
  return activeKey !== null;
}

export function lock(): void {
  activeKey = null;
}

// ─── Setup Detection ────────────────────────────────

/** Returns true if encryption has been set up (salt + verify token exist). */
export function isEncryptionSetup(): boolean {
  return localStorage.getItem(SALT_KEY) !== null && localStorage.getItem(VERIFY_KEY) !== null;
}

// ─── Key Derivation ─────────────────────────────────

function getSalt(): Uint8Array {
  const stored = localStorage.getItem(SALT_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return new Uint8Array(parsed);
    } catch { /* corrupted salt */ }
    // Salt exists but is corrupted — do NOT overwrite.
    // Regenerating would orphan all encrypted data permanently.
    throw new Error('Encryption salt is corrupted. Your encrypted data cannot be decrypted.');
  }
  // No salt exists yet — first-time setup, safe to generate
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, JSON.stringify(Array.from(salt)));
  return salt;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
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

// ─── Setup & Unlock ─────────────────────────────────

/** Known plaintext used to verify the passphrase is correct. */
const VERIFY_PLAINTEXT = 'telostax-verify-v1';

/**
 * First-time setup: derive key from passphrase, store salt + encrypted verify token.
 * Returns the derived CryptoKey (also sets it as active).
 */
export async function setupEncryption(passphrase: string): Promise<CryptoKey> {
  // Guard: prevent overwriting an existing vault (would orphan encrypted data)
  if (isEncryptionSetup()) {
    throw new Error('Encryption is already set up. Use unlock() to access existing data, or wipe all data first.');
  }

  const salt = getSalt();
  const key = await deriveKey(passphrase, salt);

  // Store an encrypted verification token so we can check the passphrase later
  const verifyEncrypted = await encrypt(VERIFY_PLAINTEXT, key);
  localStorage.setItem(VERIFY_KEY, verifyEncrypted);

  activeKey = key;
  return key;
}

/**
 * Unlock: derive key from passphrase and verify against stored token.
 * Returns true if passphrase is correct, false otherwise.
 */
export async function unlock(passphrase: string): Promise<boolean> {
  // Throttle after too many consecutive failures
  if (failedAttempts >= LOCKOUT_THRESHOLD && Date.now() < lockoutUntil) {
    return false;
  }

  const salt = getSalt();
  const key = await deriveKey(passphrase, salt);

  const verifyEncrypted = localStorage.getItem(VERIFY_KEY);
  if (!verifyEncrypted) return false;

  try {
    const decrypted = await decrypt(verifyEncrypted, key);
    if (decrypted === VERIFY_PLAINTEXT) {
      activeKey = key;
      failedAttempts = 0;
      return true;
    }
    failedAttempts++;
    if (failedAttempts >= LOCKOUT_THRESHOLD) {
      lockoutUntil = Date.now() + LOCKOUT_MS;
    }
    return false;
  } catch {
    failedAttempts++;
    if (failedAttempts >= LOCKOUT_THRESHOLD) {
      lockoutUntil = Date.now() + LOCKOUT_MS;
    }
    return false; // Wrong passphrase — decryption fails
  }
}

// ─── Encrypt / Decrypt ──────────────────────────────

/** Encrypt a string using AES-256-GCM. Returns a base64-like JSON payload. */
export async function encrypt(plaintext: string, key?: CryptoKey): Promise<string> {
  const k = key || activeKey;
  if (!k) throw new Error('No encryption key available');

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD },
    k,
    encoded,
  );

  return JSON.stringify({
    v: 1,
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ciphertext)),
  });
}

/** Decrypt a payload encrypted with encrypt(). */
export async function decrypt(payload: string, key?: CryptoKey): Promise<string> {
  const k = key || activeKey;
  if (!k) throw new Error('No encryption key available');

  const { v, iv, ct } = JSON.parse(payload);
  const params: AesGcmParams = { name: 'AES-GCM', iv: new Uint8Array(iv) };
  // v1+ payloads were encrypted with AAD; legacy payloads were not
  if (v >= 1) {
    params.additionalData = AAD;
  }
  const decrypted = await crypto.subtle.decrypt(params, k, new Uint8Array(ct));

  return new TextDecoder().decode(decrypted);
}

// ─── Migration ──────────────────────────────────────

/**
 * Check if a stored value is encrypted (JSON with iv + ct keys)
 * vs plaintext (JSON with id, taxYear, etc. keys).
 * Accepts both legacy format (iv + ct only) and v1+ format (v + iv + ct).
 */
export function isEncryptedPayload(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw);
    const hasLegacyShape = parsed.iv !== undefined && parsed.ct !== undefined;
    const hasVersionedShape = parsed.v !== undefined && hasLegacyShape;
    return hasVersionedShape || hasLegacyShape;
  } catch {
    return false;
  }
}
