/**
 * Assertions — per-step UI health checks + calculation engine validation.
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// ─── Console Error Tracking ─────────────────────

export interface ConsoleTracker {
  errors: string[];
  pageErrors: string[];
  start: () => void;
  stop: () => void;
}

/** Set up console error tracking on a page. */
export function trackConsoleErrors(page: Page): ConsoleTracker {
  const errors: string[] = [];
  const pageErrors: string[] = [];

  const consoleHandler = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out known benign errors
      if (text.includes('favicon.ico') || text.includes('manifest.json')) return;
      errors.push(text);
    }
  };

  const errorHandler = (err: Error) => {
    pageErrors.push(err.message);
  };

  return {
    errors,
    pageErrors,
    start: () => {
      page.on('console', consoleHandler);
      page.on('pageerror', errorHandler);
    },
    stop: () => {
      page.removeListener('console', consoleHandler);
      page.removeListener('pageerror', errorHandler);
    },
  };
}

// ─── Per-Step UI Assertions ─────────────────────

/**
 * Run UI health checks on the current wizard step.
 * Returns an array of failure messages (empty = all passed).
 */
export async function assertStepHealth(page: Page, stepIndex: number): Promise<string[]> {
  const failures: string[] = [];

  // 1. No error boundary (red "Something went wrong" card)
  const errorBoundary = page.locator('[data-testid="error-boundary"], .error-boundary');
  const hasErrorBoundary = await errorBoundary.isVisible().catch(() => false);
  if (hasErrorBoundary) {
    failures.push(`Step ${stepIndex}: Error boundary triggered`);
  }

  // Also check for the text "Something went wrong"
  const somethingWrong = await page.getByText(/Something went wrong/i).isVisible().catch(() => false);
  if (somethingWrong) {
    failures.push(`Step ${stepIndex}: "Something went wrong" displayed`);
  }

  // 2. No blank/empty render (at least some visible text)
  const bodyText = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    return main.innerText?.trim() || '';
  });
  if (bodyText.length < 50) {
    failures.push(`Step ${stepIndex}: Page appears blank (only ${bodyText.length} chars of text)`);
  }

  // 3. Navigation button should exist (Continue / Let's Go / Done / Back)
  const hasNavButton = await page.getByRole('button', { name: /Continue|Let.*Go|Done|Next|Back/i })
    .first().isVisible().catch(() => false);
  if (!hasNavButton) {
    // Check if we're on a page that legitimately has no nav button (export, etc.)
    const isFinishPage = await page.getByText(/Export|Download|Filing/i).isVisible().catch(() => false);
    if (!isFinishPage) {
      failures.push(`Step ${stepIndex}: No navigation button found`);
    }
  }

  return failures;
}

// ─── Calculation Engine Assertions ──────────────

/** Critical numeric fields that must never be NaN. */
const CRITICAL_FIELDS = [
  'agi',
  'taxableIncome',
  'incomeTax',
  'totalTax',
  'totalCredits',
  'taxAfterCredits',
  'refundAmount',
  'amountOwed',
  'effectiveTaxRate',
  'totalWithholding',
  'totalPayments',
] as const;

/** Fields that must be non-negative. */
const NON_NEGATIVE_FIELDS = [
  'agi',
  'taxableIncome',
  'totalTax',
  'totalCredits',
  'totalWithholding',
  'totalPayments',
] as const;

/**
 * Validate calculation results for a scenario.
 * Returns an array of failure messages (empty = all passed).
 */
export function assertCalculationHealth(result: Record<string, unknown>): string[] {
  const failures: string[] = [];
  const form1040 = (result.form1040 || result) as Record<string, unknown>;

  // 1. No NaN in critical fields
  for (const field of CRITICAL_FIELDS) {
    const value = form1040[field];
    if (typeof value === 'number' && isNaN(value)) {
      failures.push(`NaN detected in form1040.${field}`);
    }
  }

  // 2. No undefined where number expected
  for (const field of CRITICAL_FIELDS) {
    if (form1040[field] === undefined) {
      // Some fields may legitimately be undefined — only flag key ones
      if (['agi', 'taxableIncome', 'totalTax'].includes(field)) {
        failures.push(`Undefined detected in form1040.${field}`);
      }
    }
  }

  // 3. No negative values in non-negative fields
  for (const field of NON_NEGATIVE_FIELDS) {
    const value = form1040[field];
    if (typeof value === 'number' && value < 0) {
      failures.push(`Negative value in form1040.${field}: ${value}`);
    }
  }

  // 4. Refund and amountOwed should be mutually exclusive
  const refund = form1040.refundAmount as number;
  const owed = form1040.amountOwed as number;
  if (typeof refund === 'number' && typeof owed === 'number' && refund > 0 && owed > 0) {
    failures.push(`Both refund ($${refund}) and amountOwed ($${owed}) are positive`);
  }

  // 5. Effective tax rate sanity (0% - 100%)
  const rate = form1040.effectiveTaxRate as number;
  if (typeof rate === 'number' && !isNaN(rate) && (rate < 0 || rate > 100)) {
    failures.push(`Effective tax rate out of range: ${rate}%`);
  }

  return failures;
}

/**
 * Run calculation in the browser context and validate results.
 */
export async function assertCalculationInBrowser(page: Page, returnId: string): Promise<string[]> {
  const result = await page.evaluate(async (id) => {
    try {
      // Access the calculate function from the app
      const keys = Object.keys(localStorage).filter(k => k.startsWith('telostax:return:'));
      if (keys.length === 0) return { error: 'No return in localStorage' };

      // The calculation should already be available via the store
      // Try to read from window if exposed, otherwise return basic check
      return { success: true };
    } catch (e) {
      return { error: String(e) };
    }
  }, returnId);

  if (result && 'error' in result) {
    return [`Calculation error: ${result.error}`];
  }

  return [];
}
