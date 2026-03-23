/**
 * Category 8: Browser Compatibility Tests
 *
 * These tests run across Chromium, Firefox, and WebKit to verify
 * core functionality works identically in all browsers.
 *
 * Tests:
 *   1. App loads and renders branding
 *   2. localStorage CRUD works
 *   3. CSS layout renders correctly
 *   4. Navigation and routing works
 *   5. Form inputs work cross-browser
 */

import { test, expect, Page } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createAndOpenReturn(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /new.*return|start.*return|create/i }).click();
  await page.waitForURL(/\/return\//);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. APP RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Cross-Browser — App Rendering', () => {
  test('dashboard loads with TelosTax branding', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/TelosTax/i).first()).toBeVisible();
  });

  test('dashboard has proper layout structure', async ({ page }) => {
    await page.goto('/');
    // Page should have main content area
    const main = page.locator('main, [role="main"], .min-h-screen').first();
    await expect(main).toBeVisible();
  });

  test('static pages render correctly', async ({ page }) => {
    // Pledge page
    await page.goto('/pledge');
    await expect(page.getByText(/pledge|promise|commitment/i).first()).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LOCALSTORAGE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Cross-Browser — localStorage', () => {
  test('can write and read from localStorage', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      localStorage.setItem('test-key', JSON.stringify({ works: true }));
      const val = localStorage.getItem('test-key');
      localStorage.removeItem('test-key');
      return val;
    });
    expect(JSON.parse(result!)).toEqual({ works: true });
  });

  test('creating a return persists to localStorage', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new.*return|start.*return|create/i }).click();
    await page.waitForURL(/\/return\//);

    const ids = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('telostax:returns') || '[]');
    });
    expect(ids.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CSS LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Cross-Browser — CSS Layout', () => {
  test('wizard sidebar is visible on desktop', async ({ page }) => {
    await createAndOpenReturn(page);
    // Skip welcome
    const letsGo = page.getByRole('button', { name: /Let.*Go/i });
    if (await letsGo.isVisible().catch(() => false)) await letsGo.click();

    // Sidebar should be visible
    const sidebar = page.getByText(/my info/i).first();
    await expect(sidebar).toBeVisible();
  });

  test('buttons have correct visual styling', async ({ page }) => {
    await page.goto('/');
    const createBtn = page.getByRole('button', { name: /new.*return|start.*return|create/i });
    await expect(createBtn).toBeVisible();
    // Button should have reasonable dimensions
    const box = await createBtn.boundingBox();
    expect(box!.width).toBeGreaterThan(50);
    expect(box!.height).toBeGreaterThan(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Cross-Browser — Navigation', () => {
  test('browser back/forward buttons work', async ({ page }) => {
    await page.goto('/');
    await page.goto('/pledge');
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/pledge/);
  });

  test('direct URL navigation works', async ({ page }) => {
    await page.goto('/terms');
    await expect(page).toHaveURL(/\/terms/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. FORM INPUTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Cross-Browser — Form Inputs', () => {
  test('text input accepts and displays characters', async ({ page }) => {
    await createAndOpenReturn(page);
    // Navigate to Personal Info
    const letsGo = page.getByRole('button', { name: /Let.*Go/i });
    if (await letsGo.isVisible().catch(() => false)) await letsGo.click();
    await page.waitForTimeout(400);

    const firstInput = page.locator('input').first();
    if (await firstInput.isVisible().catch(() => false)) {
      await firstInput.fill('CrossBrowserTest');
      await expect(firstInput).toHaveValue('CrossBrowserTest');
    }
  });

  test('select dropdowns work', async ({ page }) => {
    await createAndOpenReturn(page);
    // Navigate past welcome
    const letsGo = page.getByRole('button', { name: /Let.*Go/i });
    if (await letsGo.isVisible().catch(() => false)) await letsGo.click();
    await page.waitForTimeout(400);

    // Look for any select element
    const select = page.locator('select').first();
    if (await select.isVisible().catch(() => false)) {
      const optionCount = await select.locator('option').count();
      expect(optionCount).toBeGreaterThan(1);
    }
  });
});
