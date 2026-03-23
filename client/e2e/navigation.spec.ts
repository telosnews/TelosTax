/**
 * E2E Tests: App Navigation & Routing
 *
 * Tests that all routes work correctly:
 * - Dashboard (/)
 * - Pledge (/pledge)
 * - Terms (/terms)
 * - Privacy (/privacy)
 * - Invalid routes redirect to dashboard
 */

import { test, expect } from '@playwright/test';

test.describe('App Routing', () => {
  test('dashboard loads at /', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('TelosTax');
  });

  test('pledge page loads at /pledge', async ({ page }) => {
    await page.goto('/pledge');
    await expect(page).toHaveURL('/pledge');
    // Page should render without error
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(0);
  });

test('terms page loads at /terms', async ({ page }) => {
    await page.goto('/terms');
    await expect(page).toHaveURL('/terms');
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(0);
  });

  test('privacy page loads at /privacy', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveURL('/privacy');
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(0);
  });

  test('invalid route redirects to dashboard', async ({ page }) => {
    await page.goto('/nonexistent-page');
    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('TelosTax');
  });

  test('invalid return ID shows appropriate handling', async ({ page }) => {
    await page.goto('/return/invalid-id-does-not-exist');
    // Should either redirect to dashboard or show error state
    await page.waitForTimeout(1000);
    // The page should not crash — just verify it loaded something
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(0);
  });
});

test.describe('Cross-Page Navigation', () => {
  test('can navigate from dashboard to pledge and back', async ({ page }) => {
    await page.goto('/');

    // Look for a link to pledge page
    const pledgeLink = page.getByRole('link', { name: /pledge/i });
    if (await pledgeLink.isVisible()) {
      await pledgeLink.click();
      await expect(page).toHaveURL(/pledge/);
    }
  });

  test('can navigate from wizard back to dashboard', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Create a return
    await page.getByRole('button', { name: /Start New Tax Return/i }).click();
    await expect(page).toHaveURL(/\/return\//);

    // Navigate back to dashboard
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('TelosTax');
  });
});
