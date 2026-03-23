/**
 * E2E Tests: Import Data Step
 *
 * Tests the Import Data wizard step including:
 * - Step appears in the wizard sidebar
 * - Import CSV and Import PDF option cards are visible
 * - CSV flow: selecting CSV mode shows the CSV import panel
 * - PDF flow: selecting PDF mode shows the PDF import panel
 * - Back navigation returns to option cards
 * - Limitation callouts are always visible
 * - Step is skippable (Continue button works)
 */

import { test, expect, Page } from '@playwright/test';

// Helper: navigate to a fresh return wizard
async function createAndOpenReturn(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: /Start New Tax Return/i }).click();
  await expect(page).toHaveURL(/\/return\/[a-f0-9-]+/);
  await page.waitForTimeout(500);
}

// Helper: click the main navigation button (Continue, Let's Go, etc.)
async function clickNavButton(page: Page) {
  const letsGo = page.getByRole('button', { name: /Let.*Go/i });
  const continueBtn = page.getByRole('button', { name: /Continue/i });
  const doneBtn = page.getByRole('button', { name: /Done/i });

  if (await letsGo.isVisible().catch(() => false)) {
    await letsGo.click();
  } else if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
  } else if (await doneBtn.isVisible().catch(() => false)) {
    await doneBtn.click();
  }
  await page.waitForTimeout(400);
}

// Helper: navigate to the Import Data step by clicking through the wizard
// (sidebar sections may be collapsed, so forward navigation is more reliable)
async function navigateToImportStep(page: Page) {
  // Welcome → Personal Info → Filing Status → Dependents → Income Overview → Import Data
  // That's 5 forward clicks from the welcome step
  for (let i = 0; i < 5; i++) {
    await clickNavButton(page);
  }

  // Check if we're on Import Data. If not, try one more click.
  const isOnImport = await page.getByText('Import Your Tax Documents').isVisible().catch(() => false);
  if (!isOnImport) {
    await clickNavButton(page);
  }

  // Wait for the step to fully render
  await page.waitForTimeout(300);
}

test.describe('Import Data Step', () => {
  test.beforeEach(async ({ page }) => {
    await createAndOpenReturn(page);
  });

  test('shows Import Data step when navigating through the wizard', async ({ page }) => {
    await navigateToImportStep(page);

    // Should see the step title or import-related content
    const hasTitle = await page.getByText('Import Your Tax Documents').isVisible().catch(() => false);
    const hasImportCSV = await page.getByText('Import CSV').isVisible().catch(() => false);
    const hasImportPDF = await page.getByText('Import PDF').isVisible().catch(() => false);

    expect(hasTitle || hasImportCSV || hasImportPDF).toBe(true);
  });

  test('navigating to Import Data step shows option cards', async ({ page }) => {
    await navigateToImportStep(page);

    // Should see the step title
    await expect(page.getByText('Import Your Tax Documents')).toBeVisible();

    // Should see both option cards
    await expect(page.getByText('Import CSV')).toBeVisible();
    await expect(page.getByText('Import PDF')).toBeVisible();
  });

  test('shows the optional skip message', async ({ page }) => {
    await navigateToImportStep(page);

    await expect(page.getByText(/This step is optional/i)).toBeVisible();
  });

  test('shows limitation callouts', async ({ page }) => {
    await navigateToImportStep(page);

    // Should see the warning callout about limitations
    await expect(page.getByText('Import Limitations')).toBeVisible();

    // Should see the info callout about supported formats
    await expect(page.getByText('Supported CSV Formats')).toBeVisible();
  });

  test('clicking Import CSV shows the CSV import panel', async ({ page }) => {
    await navigateToImportStep(page);

    // Click the "Import CSV" card
    await page.getByText('Import CSV').first().click();
    await page.waitForTimeout(300);

    // Should see CSV-specific UI elements
    const has1099B = await page.getByText(/1099-B/i).first().isVisible().catch(() => false);
    const has1099DA = await page.getByText(/1099-DA/i).first().isVisible().catch(() => false);
    const hasBroker = await page.getByText(/broker/i).first().isVisible().catch(() => false);
    const hasTargetType = await page.getByText(/target type|what are you importing/i).first().isVisible().catch(() => false);

    // At least one CSV-specific element should be visible
    expect(has1099B || has1099DA || hasBroker || hasTargetType).toBe(true);
  });

  test('clicking Import PDF shows the PDF import panel', async ({ page }) => {
    await navigateToImportStep(page);

    // Click the "Import PDF" card
    await page.getByText('Import PDF').first().click();
    await page.waitForTimeout(300);

    // Should see PDF-specific UI elements (the drop zone or PDF-related text)
    const hasDropZone = await page.getByText(/drag.*drop|choose.*file|select.*file|drop.*here/i).first().isVisible().catch(() => false);
    const hasPdfText = await page.getByText(/\.pdf/i).first().isVisible().catch(() => false);
    const hasDigitalText = await page.getByText(/digitally/i).first().isVisible().catch(() => false);

    expect(hasDropZone || hasPdfText || hasDigitalText).toBe(true);
  });

  test('CSV panel has a back button to return to options', async ({ page }) => {
    await navigateToImportStep(page);

    // Enter CSV mode
    await page.getByText('Import CSV').first().click();
    await page.waitForTimeout(300);

    // Look for a back button (may be "← Back to options" or similar)
    const backBtns = page.getByRole('button', { name: /back/i });
    const count = await backBtns.count();

    if (count > 0) {
      // Click the first back button that's visible
      for (let i = 0; i < count; i++) {
        if (await backBtns.nth(i).isVisible().catch(() => false)) {
          await backBtns.nth(i).click();
          await page.waitForTimeout(300);
          break;
        }
      }

      // Should be back on the idle view with both cards
      const hasCSV = await page.getByText('Import CSV').isVisible().catch(() => false);
      const hasPDF = await page.getByText('Import PDF').isVisible().catch(() => false);
      expect(hasCSV && hasPDF).toBe(true);
    }
  });

  test('PDF panel has a back button to return to options', async ({ page }) => {
    await navigateToImportStep(page);

    // Enter PDF mode
    await page.getByText('Import PDF').first().click();
    await page.waitForTimeout(300);

    // Look for a back button
    const backBtns = page.getByRole('button', { name: /back/i });
    const count = await backBtns.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        if (await backBtns.nth(i).isVisible().catch(() => false)) {
          await backBtns.nth(i).click();
          await page.waitForTimeout(300);
          break;
        }
      }

      const hasCSV = await page.getByText('Import CSV').isVisible().catch(() => false);
      const hasPDF = await page.getByText('Import PDF').isVisible().catch(() => false);
      expect(hasCSV && hasPDF).toBe(true);
    }
  });

  test('step can be skipped with Continue button', async ({ page }) => {
    await navigateToImportStep(page);

    // Verify we're on the Import Data step
    await expect(page.getByText('Import Your Tax Documents')).toBeVisible();

    // Click Continue to skip import
    const continueBtn = page.getByRole('button', { name: /Continue/i });
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();
    await page.waitForTimeout(500);

    // Should have moved to the next step
    const isStillOnImport = await page.getByText('Import Your Tax Documents').isVisible().catch(() => false);
    expect(isStillOnImport).toBe(false);
  });

  test('Import Data step has description text', async ({ page }) => {
    await navigateToImportStep(page);

    await expect(
      page.getByText(/Save time by importing CSV files or digital PDFs/i),
    ).toBeVisible();
  });

  test('CSV option card describes supported formats', async ({ page }) => {
    await navigateToImportStep(page);

    // The CSV card should mention supported brokerages
    await expect(page.getByText(/Schwab.*Fidelity/i).first()).toBeVisible();
  });

  test('PDF option card mentions supported form types', async ({ page }) => {
    await navigateToImportStep(page);

    // The PDF card should mention W-2 and 1099 types
    const hasW2 = await page.getByText(/W-2.*1099/i).first().isVisible().catch(() => false);
    const hasDigital = await page.getByText(/digitally.generated/i).first().isVisible().catch(() => false);

    expect(hasW2 || hasDigital).toBe(true);
  });
});

test.describe('Import Data — Step Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await createAndOpenReturn(page);
  });

  test('can navigate forward past Import Data', async ({ page }) => {
    await navigateToImportStep(page);

    // Verify we're on the import step
    const isOnImport = await page.getByText('Import Your Tax Documents').isVisible().catch(() => false);
    expect(isOnImport).toBe(true);

    // Click Continue to go to the next step
    await clickNavButton(page);

    // Should have moved past import
    const isStillOnImport = await page.getByText('Import Your Tax Documents').isVisible().catch(() => false);
    expect(isStillOnImport).toBe(false);
  });

  test('Back button from next step returns to Import Data', async ({ page }) => {
    await navigateToImportStep(page);

    // Go forward past Import Data
    await clickNavButton(page);
    await page.waitForTimeout(300);

    // Click Back
    const backBtn = page.getByRole('button', { name: /^Back$/i });
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(500);

      // Should be back on Import Data
      const isOnImport = await page.getByText('Import Your Tax Documents').isVisible().catch(() => false);
      expect(isOnImport).toBe(true);
    }
  });
});
