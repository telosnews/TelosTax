/**
 * Lock screen handler — handles the encryption gate that appears when
 * the app finds plaintext data without encryption configured.
 *
 * Strategy:
 * 1. Inject plaintext return into localStorage
 * 2. Reload → encryption gate appears (no encryption configured yet)
 * 3. Programmatically set a passphrase via the UI
 * 4. App auto-encrypts the plaintext return on next loadAllReturns()
 */

import type { Page } from '@playwright/test';

const FUZZER_PASSPHRASE = 'fuzzer-test-pass-2025!';

/**
 * Handle the encryption gate:
 * - If "Set Passphrase" form is shown → fill it and submit
 * - If "Unlock" form is shown → enter the passphrase and unlock
 * - If no gate → already unlocked, proceed
 */
export async function handleEncryptionGate(page: Page): Promise<void> {
  // Wait for the page to settle
  await page.waitForTimeout(1000);

  // Check if we're on the encryption setup screen
  const setupButton = page.getByRole('button', { name: /Set Passphrase|Create Passphrase|Protect|Encrypt/i });
  const unlockButton = page.getByRole('button', { name: /Unlock|Decrypt|Open/i });

  const hasSetup = await setupButton.isVisible().catch(() => false);
  const hasUnlock = await unlockButton.isVisible().catch(() => false);

  if (hasSetup) {
    // First-time setup: fill passphrase fields and submit
    const passwordInputs = page.locator('input[type="password"]');
    const count = await passwordInputs.count();

    if (count >= 2) {
      await passwordInputs.nth(0).fill(FUZZER_PASSPHRASE);
      await passwordInputs.nth(1).fill(FUZZER_PASSPHRASE);
    } else if (count === 1) {
      await passwordInputs.nth(0).fill(FUZZER_PASSPHRASE);
    }

    await setupButton.click();
    await page.waitForTimeout(1500);
  } else if (hasUnlock) {
    // Returning: enter passphrase and unlock
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(FUZZER_PASSPHRASE);
    await unlockButton.click();
    await page.waitForTimeout(1500);
  } else {
    // No gate visible — already unlocked or no encryption needed
    return;
  }

  // Verify the gate was actually dismissed
  const gateStillVisible = await page.locator('input[type="password"]')
    .isVisible({ timeout: 1000 }).catch(() => false);
  if (gateStillVisible) {
    throw new Error(
      'Encryption gate not dismissed after handling — check button label patterns in lock-screen.ts'
    );
  }
}

/**
 * Skip the encryption gate entirely by setting up encryption via
 * browser evaluate (faster, no UI interaction needed).
 */
export async function setupEncryptionProgrammatically(page: Page): Promise<void> {
  await page.evaluate(async (passphrase) => {
    // Access the crypto module's setupEncryption function
    // This works because the module exposes setActiveKey and setupEncryption
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    localStorage.setItem('telostax:salt', JSON.stringify(Array.from(salt)));

    // Derive key from passphrase
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits', 'deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    // Encrypt verification token
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, enc.encode('telostax-verify-v1')
    );
    localStorage.setItem('telostax:verify', JSON.stringify({
      iv: Array.from(iv), ct: Array.from(new Uint8Array(ciphertext))
    }));

    // Store key reference for later use
    (window as unknown as Record<string, unknown>).__fuzzerCryptoKey = key;
  }, FUZZER_PASSPHRASE);
}

export { FUZZER_PASSPHRASE };
