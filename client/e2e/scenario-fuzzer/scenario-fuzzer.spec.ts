/**
 * UI Scenario Fuzzer — Playwright E2E tests
 *
 * Generates diverse, realistic TaxReturn objects from 13 archetypes,
 * injects them into the wizard via localStorage, walks every visible step,
 * and validates both UI health and calculation results.
 *
 * Usage:
 *   cd client && npx playwright test e2e/scenario-fuzzer/ --project=chromium
 *
 * Environment variables:
 *   FUZZER_COUNT     — number of scenarios to generate (default: 20)
 *   FUZZER_SEED      — starting seed for PRNG (default: 1)
 *   FUZZER_ARCHETYPE — force a specific archetype (default: weighted random)
 */

import { test, expect } from '@playwright/test';
import { generateScenarios, type GeneratedScenario } from './generators';
import { injectAndOpen, walkAllSteps } from './helpers/navigator';
import { trackConsoleErrors, assertStepHealth } from './helpers/assertions';

// ─── Configuration ───────────────────────────────

const FUZZER_COUNT = parseInt(process.env.FUZZER_COUNT || '20', 10);
const FUZZER_SEED = parseInt(process.env.FUZZER_SEED || '1', 10);
const FUZZER_ARCHETYPE = process.env.FUZZER_ARCHETYPE || undefined;

// ─── Benign console error patterns (allowlist — everything else is a failure) ─
const BENIGN_PATTERNS = [
  /favicon/,
  /manifest\.json/,
  /ResizeObserver/,
  /third-party/,
  /Download the React DevTools/,
  /service-worker/,
  /workbox/,
  /hot-update/,
  /\[HMR\]/,
  /\[vite\]/,
  /frame-ancestors/,                   // CSP warning from browser
  /ERR_CONNECTION_REFUSED/,            // Dev server proxy failures
  /ERR_CONNECTION_RESET/,
  /cannot be a descendant/,             // React DOM nesting (button in a, etc.)
  /cannot contain a nested/,           // React DOM nesting (nested button, etc.)
  /validateDOMNesting/,                // React hydration nesting warnings
  /hydration/i,                        // React hydration mismatch warnings
  /Failed to load resource/,           // Missing assets in dev mode
  /Cross-Origin Request Blocked/,       // Firefox CORS on dev API
  /localhost:3001/,                      // Dev API server not running
];

// ─── Generate Scenarios ──────────────────────────

const scenarios: GeneratedScenario[] = generateScenarios(FUZZER_COUNT, FUZZER_SEED, FUZZER_ARCHETYPE);

// ─── Test Suite ──────────────────────────────────

test.describe('UI Scenario Fuzzer', () => {
  // Increase timeout for complex scenarios
  test.setTimeout(120_000);

  for (const scenario of scenarios) {
    test(`seed=${scenario.seed} archetype=${scenario.archetype}`, async ({ page }) => {
      const allFailures: string[] = [];

      // Set up console error tracking
      const tracker = trackConsoleErrors(page);
      tracker.start();

      // 1. Inject the generated return and open the wizard
      await injectAndOpen(page, scenario.taxReturn);

      // 2. Verify the wizard loaded — confirm the return ID is in the URL
      const currentUrl = page.url();
      if (!currentUrl.includes(scenario.taxReturn.id)) {
        // Try recovery: go to home page and open the return
        await page.goto('/');
        await page.waitForTimeout(1000);
        const returnLink = page.getByText(scenario.taxReturn.firstName as string).first();
        if (await returnLink.isVisible().catch(() => false)) {
          await returnLink.click();
          await page.waitForTimeout(1000);
        }
      }

      // 3. Walk through all visible steps
      const { visitedSteps, errors: walkErrors } = await walkAllSteps(page);

      // Include walk errors (error boundaries, disabled buttons detected during nav)
      allFailures.push(...walkErrors);

      // 4. Run per-step UI assertions on the final state
      const stepFailures = await assertStepHealth(page, visitedSteps.length);
      allFailures.push(...stepFailures);

      // 5. Check for JS errors captured during navigation
      tracker.stop();

      // Inverted filter: anything NOT matching benign patterns is a failure
      const criticalErrors = tracker.errors.filter((e) =>
        !BENIGN_PATTERNS.some((p) => p.test(e))
      );

      if (criticalErrors.length > 0) {
        allFailures.push(
          ...criticalErrors.map((e) => `Console error: ${e.slice(0, 200)}`)
        );
      }

      // Uncaught page errors are always failures
      if (tracker.pageErrors.length > 0) {
        allFailures.push(
          ...tracker.pageErrors.map((e) => `Uncaught error: ${e.slice(0, 200)}`)
        );
      }

      // 6. Capture screenshot on failure
      if (allFailures.length > 0) {
        await page.screenshot({
          path: `test-results/fuzzer-seed-${scenario.seed}.png`,
          fullPage: true,
        }).catch(() => { /* ignore screenshot failures */ });

        const report = [
          `\n${'='.repeat(60)}`,
          `FUZZER FAILURE -- seed=${scenario.seed} archetype=${scenario.archetype}`,
          `${'='.repeat(60)}`,
          `Steps visited: ${visitedSteps.length} (${visitedSteps.join(' -> ')})`,
          `Return ID: ${scenario.taxReturn.id}`,
          `Filing Status: ${scenario.taxReturn.filingStatus}`,
          ``,
          `Failures:`,
          ...allFailures.map((f) => `  x ${f}`),
          ``,
          `Screenshot: test-results/fuzzer-seed-${scenario.seed}.png`,
          `Reproduce: FUZZER_SEED=${scenario.seed} FUZZER_COUNT=1 npx playwright test e2e/scenario-fuzzer/ --debug`,
          `${'='.repeat(60)}`,
        ].join('\n');

        console.error(report);
      }

      // Assert no critical failures
      expect(allFailures, `Scenario failures (seed=${scenario.seed}):\n${allFailures.join('\n')}`).toHaveLength(0);
    });
  }
});

// ─── Calculation Engine Validation ───────────────
// Engine-level calc checks run via Vitest (not Playwright) since Vitest handles
// TypeScript imports natively. See: client/src/__tests__/fuzzerCalcValidation.test.ts
//
// Run with: npx vitest run src/__tests__/fuzzerCalcValidation
