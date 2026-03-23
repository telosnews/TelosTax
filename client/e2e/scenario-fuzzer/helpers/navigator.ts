/**
 * Navigator — injects a generated TaxReturn into localStorage,
 * handles encryption, and walks through all visible wizard steps.
 */

import type { Page } from '@playwright/test';
import type { FuzzerTaxReturn } from '../generators/base';
import { handleEncryptionGate, setupEncryptionProgrammatically, FUZZER_PASSPHRASE } from './lock-screen';

const USE_PROGRAMMATIC_ENCRYPTION = process.env.FUZZER_ENCRYPTION === 'programmatic';

/**
 * Inject a TaxReturn into the app via localStorage and navigate to the wizard.
 */
export async function injectAndOpen(page: Page, taxReturn: FuzzerTaxReturn): Promise<void> {
  // 1. Clear everything
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());

  if (USE_PROGRAMMATIC_ENCRYPTION) {
    // Fast path: set up encryption via Web Crypto API directly (no UI)
    await setupEncryptionProgrammatically(page);

    // Inject plaintext return (app will encrypt on loadAllReturns)
    await page.evaluate(({ tr, id }) => {
      localStorage.setItem(`telostax:return:${id}`, JSON.stringify(tr));
      localStorage.setItem('telostax:returns', JSON.stringify([id]));
    }, { tr: taxReturn, id: taxReturn.id });

    // Navigate to return — encryption is already configured
    await page.goto(`/return/${taxReturn.id}`);
    await page.waitForTimeout(1500);

    // Handle unlock if needed (key is in localStorage but not in memory after nav)
    await handleEncryptionGate(page);
  } else {
    // UI path: inject plaintext, let the encryption gate appear, fill it in
    await page.evaluate(({ tr, id }) => {
      localStorage.setItem(`telostax:return:${id}`, JSON.stringify(tr));
      localStorage.setItem('telostax:returns', JSON.stringify([id]));
    }, { tr: taxReturn, id: taxReturn.id });

    // Reload to trigger the encryption gate
    await page.reload();
    await page.waitForTimeout(500);

    // Handle encryption gate (set passphrase for the first time)
    await handleEncryptionGate(page);

    // Navigate to the return
    await page.goto(`/return/${taxReturn.id}`);
    await page.waitForTimeout(1000);

    // If encryption gate appears again on the return page, handle it
    await handleEncryptionGate(page);
  }

  // Wait for wizard to fully load
  await page.waitForTimeout(500);
}

/**
 * Walk through all visible wizard steps by clicking the nav button.
 * Returns the list of step IDs that were visited and any errors found.
 */
export async function walkAllSteps(page: Page): Promise<{ visitedSteps: string[]; errors: string[] }> {
  const visitedSteps: string[] = [];
  const errors: string[] = [];
  let stuckCount = 0;
  let lastStepLabel = '';

  for (let i = 0; i < 100; i++) { // safety cap
    // Extract current step label from DOM (sidebar active item or page heading)
    const stepLabel = await extractStepLabel(page, i);
    visitedSteps.push(stepLabel);

    // Check for error boundary DURING walk (not just after)
    const hasErrorBoundary = await page.getByText(/Something went wrong/i).isVisible({ timeout: 200 }).catch(() => false);
    if (hasErrorBoundary) {
      errors.push(`Error boundary triggered at step ${i} (${stepLabel})`);
      break;
    }

    // Check for stuck navigation (same step label twice)
    if (stepLabel === lastStepLabel && stepLabel !== `step-${i}`) {
      stuckCount++;
      if (stuckCount >= 3) break;
    } else {
      stuckCount = 0;
    }
    lastStepLabel = stepLabel;

    // Try to click the navigation button
    const clicked = await clickNavButton(page);
    if (!clicked) {
      // Check if Continue exists but is disabled (validation blocking)
      const disabledContinue = await page.locator('button:has-text("Continue"):disabled').isVisible({ timeout: 200 }).catch(() => false);
      if (disabledContinue) {
        errors.push(`Continue button disabled at step ${i} (${stepLabel}) — validation may be blocking`);
        // Try to skip past by clicking sidebar next section
        break;
      }

      // Check if we're on the last step (export/finish)
      const hasExport = await page.getByText(/Export|Download|Filing Instructions/i).isVisible().catch(() => false);
      if (hasExport) break;

      // No nav button found — might be stuck
      stuckCount++;
      if (stuckCount >= 3) break;
    }

    await page.waitForTimeout(300);
  }

  return { visitedSteps, errors };
}

/**
 * Extract the current step label from the DOM.
 * Tries: active sidebar item → page heading → fallback to index.
 */
async function extractStepLabel(page: Page, index: number): Promise<string> {
  // Try 1: Active sidebar item (highlighted/current step)
  const sidebarLabel = await page.evaluate(() => {
    // Look for active/current sidebar link
    const selectors = [
      '[aria-current="step"]',
      '[aria-current="true"]',
      '[data-active="true"]',
      '.active-step',
      'nav a[class*="active"]',
      'nav button[class*="active"]',
      // Fallback: look for a highlighted sidebar item with distinct styling
      'nav li[class*="current"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    return null;
  }).catch(() => null);

  if (sidebarLabel) return sidebarLabel;

  // Try 2: Main content heading (h1, h2, or step title)
  const heading = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const h = main.querySelector('h1, h2, [class*="step-title"], [class*="stepTitle"]');
    return h?.textContent?.trim() || null;
  }).catch(() => null);

  if (heading) return heading.slice(0, 60); // truncate long headings

  // Fallback
  return `step-${index}`;
}

/**
 * Click the main navigation button. Returns true if a button was found and clicked.
 */
async function clickNavButton(page: Page): Promise<boolean> {
  // The welcome step has "Let's Go", other steps have "Continue" or "Done"
  const buttons = [
    page.getByRole('button', { name: /Let.*Go/i }),
    page.getByRole('button', { name: /Continue/i }),
    page.getByRole('button', { name: /Done/i }),
    page.getByRole('button', { name: /Next/i }),
  ];

  for (const btn of buttons) {
    try {
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click();
        await page.waitForTimeout(400);
        return true;
      }
    } catch {
      // Button not found, try next
    }
  }

  return false;
}

/**
 * Navigate via sidebar to a specific section and walk its steps.
 */
export async function navigateToSection(page: Page, sectionLabel: string): Promise<void> {
  const sectionLink = page.getByText(sectionLabel, { exact: false }).first();
  if (await sectionLink.isVisible().catch(() => false)) {
    await sectionLink.click();
    await page.waitForTimeout(500);
  }
}
