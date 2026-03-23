/**
 * E2E Tests: AI Chat Assistant
 *
 * Tests the chat panel UI behavior including:
 * - Chat button visibility (hidden when server unavailable)
 * - Chat panel open/close via toggle button
 * - Privacy disclaimer on first open
 * - Message sending and display
 * - Action preview cards
 * - Chat panel close on Escape key
 *
 * These tests mock the chat server responses using route interception
 * so they can run without a real OpenAI API key.
 */

import { test, expect, Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────

/** Navigate to a fresh return wizard. */
async function createAndOpenReturn(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: /Start New Tax Return/i }).click();
  await expect(page).toHaveURL(/\/return\/[a-f0-9-]+/);
  await page.waitForTimeout(500);
}

/** Mock the chat status endpoint to report chat as available. */
async function mockChatAvailable(page: Page) {
  await page.route('**/api/chat/status', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { enabled: true, model: 'gpt-4o-mini' },
      }),
    });
  });
}

/** Mock the chat status endpoint to report chat as unavailable. */
async function mockChatUnavailable(page: Page) {
  await page.route('**/api/chat/status', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { enabled: false, model: null },
      }),
    });
  });
}

/** Mock a chat message response (POST /api/chat). */
async function mockChatResponse(
  page: Page,
  response: {
    message: string;
    actions?: Array<Record<string, unknown>>;
    suggestedStep?: string | null;
  },
) {
  await page.route('**/api/chat', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            message: response.message,
            actions: response.actions || [],
            suggestedStep: response.suggestedStep || null,
          },
        }),
      });
    } else {
      route.continue();
    }
  });
}

// ═══════════════════════════════════════════════════
// CHAT BUTTON VISIBILITY
// ═══════════════════════════════════════════════════

test.describe('Chat button visibility', () => {
  test('hides chat button when server reports chat unavailable', async ({ page }) => {
    await mockChatUnavailable(page);
    await createAndOpenReturn(page);

    // Wait for status check to complete
    await page.waitForTimeout(1000);

    // The "AI Assistant" button should NOT be visible
    const chatBtn = page.getByRole('button', { name: /AI Assistant/i });
    await expect(chatBtn).not.toBeVisible();
  });

  test('shows chat button when server reports chat available', async ({ page }) => {
    await mockChatAvailable(page);
    await createAndOpenReturn(page);

    // Wait for status check to complete
    await page.waitForTimeout(1000);

    // The "AI Assistant" button should be visible
    const chatBtn = page.getByRole('button', { name: /AI Assistant|Toggle AI/i });
    await expect(chatBtn).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════
// CHAT PANEL OPEN / CLOSE
// ═══════════════════════════════════════════════════

test.describe('Chat panel open/close', () => {
  test.beforeEach(async ({ page }) => {
    await mockChatAvailable(page);
    await createAndOpenReturn(page);
    await page.waitForTimeout(1000);
  });

  test('opens chat panel when toggle button is clicked', async ({ page }) => {
    const chatBtn = page.getByRole('button', { name: /AI Assistant|Toggle AI/i });
    await chatBtn.click();
    await page.waitForTimeout(400);

    // Panel should be visible with "AI Assistant" heading and privacy notice
    await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
    await expect(page.getByText('Privacy Notice')).toBeVisible();
  });

  test('closes chat panel when close button is clicked', async ({ page }) => {
    // Open panel
    const chatBtn = page.getByRole('button', { name: /AI Assistant|Toggle AI/i });
    await chatBtn.click();
    await page.waitForTimeout(400);

    // Click close button
    const closeBtn = page.getByRole('button', { name: /Close chat/i });
    await closeBtn.click();
    await page.waitForTimeout(400);

    // Panel should be hidden (invisible via CSS)
    const panel = page.getByTestId('chat-panel');
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
  });

  test('closes chat panel on Escape key', async ({ page }) => {
    // Open panel
    const chatBtn = page.getByRole('button', { name: /AI Assistant|Toggle AI/i });
    await chatBtn.click();
    await page.waitForTimeout(400);
    await expect(page.getByText('Privacy Notice')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Panel should be hidden
    const panel = page.getByTestId('chat-panel');
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
  });
});

// ═══════════════════════════════════════════════════
// PRIVACY DISCLAIMER
// ═══════════════════════════════════════════════════

test.describe('Privacy disclaimer', () => {
  test.beforeEach(async ({ page }) => {
    await mockChatAvailable(page);
    await createAndOpenReturn(page);
    await page.waitForTimeout(1000);
  });

  test('shows privacy disclaimer on first open', async ({ page }) => {
    const chatBtn = page.getByRole('button', { name: /AI Assistant|Toggle AI/i });
    await chatBtn.click();
    await page.waitForTimeout(400);

    // Should see the privacy notice
    await expect(page.getByText('Privacy Notice')).toBeVisible();
    await expect(page.getByText(/PII is stripped/i)).toBeVisible();
    await expect(page.getByText(/Data stays local/i)).toBeVisible();
    await expect(page.getByText(/You confirm actions/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /I Understand/i })).toBeVisible();
  });

  test('dismisses privacy disclaimer and shows chat after accepting', async ({ page }) => {
    const chatBtn = page.getByRole('button', { name: /AI Assistant|Toggle AI/i });
    await chatBtn.click();
    await page.waitForTimeout(400);

    // Accept disclaimer
    await page.getByRole('button', { name: /I Understand/i }).click();
    await page.waitForTimeout(400);

    // Should now see the chat interface (placeholder text)
    await expect(page.getByText(/How can I help with your taxes/i)).toBeVisible();
  });

  test('does not show disclaimer again after acceptance', async ({ page }) => {
    const chatBtn = page.getByRole('button', { name: /AI Assistant|Toggle AI/i });
    await chatBtn.click();
    await page.waitForTimeout(400);

    // Accept disclaimer
    await page.getByRole('button', { name: /I Understand/i }).click();
    await page.waitForTimeout(400);

    // Close panel
    await page.getByRole('button', { name: /Close chat/i }).click();
    await page.waitForTimeout(400);

    // Reopen — should NOT see disclaimer again
    await chatBtn.click();
    await page.waitForTimeout(400);

    await expect(page.getByText('Privacy Notice')).not.toBeVisible();
    await expect(page.getByText(/How can I help with your taxes/i)).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════
// CHAT MESSAGING
// ═══════════════════════════════════════════════════

test.describe('Chat messaging', () => {
  test.beforeEach(async ({ page }) => {
    await mockChatAvailable(page);
    await createAndOpenReturn(page);
    await page.waitForTimeout(1000);

    // Open chat and accept disclaimer
    const chatBtn = page.getByRole('button', { name: /AI Assistant|Toggle AI/i });
    await chatBtn.click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /I Understand/i }).click();
    await page.waitForTimeout(400);
  });

  test('shows placeholder text when no messages', async ({ page }) => {
    await expect(page.getByText(/How can I help with your taxes/i)).toBeVisible();
    await expect(page.getByText(/Try:.*I made \$75k/i)).toBeVisible();
  });

  test('has a text input with correct placeholder', async ({ page }) => {
    const input = page.getByPlaceholder(/Ask about your taxes/i);
    await expect(input).toBeVisible();
  });

  test('disables send button when input is empty', async ({ page }) => {
    const sendBtn = page.getByRole('button', { name: /Send message/i });
    await expect(sendBtn).toBeDisabled();
  });

  test('enables send button when text is entered', async ({ page }) => {
    const input = page.getByPlaceholder(/Ask about your taxes/i);
    await input.fill('Hello');

    const sendBtn = page.getByRole('button', { name: /Send message/i });
    await expect(sendBtn).toBeEnabled();
  });

  test('sends a message and displays the response', async ({ page }) => {
    // Mock a simple response
    await mockChatResponse(page, {
      message: 'I can help you with your taxes! What would you like to know?',
    });

    // Type and send
    const input = page.getByPlaceholder(/Ask about your taxes/i);
    await input.fill('Hello, I need help');
    await page.getByRole('button', { name: /Send message/i }).click();

    // Wait for response
    await page.waitForTimeout(1500);

    // Should see both user and assistant messages
    await expect(page.getByText('Hello, I need help')).toBeVisible();
    await expect(
      page.getByText('I can help you with your taxes! What would you like to know?'),
    ).toBeVisible();
  });

  test('shows character count when typing', async ({ page }) => {
    const input = page.getByPlaceholder(/Ask about your taxes/i);
    await input.fill('Test message');

    // Should show character count
    await expect(page.getByText(/12\/2000/)).toBeVisible();
  });

  test('sends message on Enter key', async ({ page }) => {
    await mockChatResponse(page, {
      message: 'Got it!',
    });

    const input = page.getByPlaceholder(/Ask about your taxes/i);
    await input.fill('Test via enter');
    await input.press('Enter');

    await page.waitForTimeout(1500);

    // Message should be sent
    await expect(page.getByText('Test via enter')).toBeVisible();
    await expect(page.getByText('Got it!')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════
// ACTION PREVIEWS
// ═══════════════════════════════════════════════════

test.describe('Action previews', () => {
  test.beforeEach(async ({ page }) => {
    await mockChatAvailable(page);
    await createAndOpenReturn(page);
    await page.waitForTimeout(1000);

    // Open chat and accept disclaimer
    const chatBtn = page.getByRole('button', { name: /AI Assistant|Toggle AI/i });
    await chatBtn.click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /I Understand/i }).click();
    await page.waitForTimeout(400);
  });

  test('shows action preview cards for data-entry responses', async ({ page }) => {
    // Mock a response with actions
    await mockChatResponse(page, {
      message: 'I\'ll add that W-2 for you.',
      actions: [
        {
          type: 'add_income',
          incomeType: 'w2',
          fields: { employerName: 'Acme Corp', wages: 75000, federalTaxWithheld: 12000 },
        },
      ],
    });

    // Send a message
    const input = page.getByPlaceholder(/Ask about your taxes/i);
    await input.fill('I made 75k from Acme Corp');
    await page.getByRole('button', { name: /Send message/i }).click();
    await page.waitForTimeout(1500);

    // Should see action preview
    await expect(page.getByText('Proposed changes:')).toBeVisible();
    await expect(page.getByText(/Add W-2.*Acme Corp/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Apply All/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Dismiss/i })).toBeVisible();
  });

  test('dismiss button removes action preview', async ({ page }) => {
    await mockChatResponse(page, {
      message: 'Here\'s the data.',
      actions: [
        {
          type: 'set_filing_status',
          status: 'single',
        },
      ],
    });

    const input = page.getByPlaceholder(/Ask about your taxes/i);
    await input.fill('I am single');
    await page.getByRole('button', { name: /Send message/i }).click();
    await page.waitForTimeout(1500);

    // Click dismiss
    await page.getByRole('button', { name: /Dismiss/i }).click();
    await page.waitForTimeout(400);

    // Should see "Skipped" indicator
    await expect(page.getByText('Skipped')).toBeVisible();
    // Apply button should be gone
    await expect(page.getByRole('button', { name: /Apply All/i })).not.toBeVisible();
  });

  test('apply button executes actions and shows confirmation', async ({ page }) => {
    await mockChatResponse(page, {
      message: 'Setting your filing status.',
      actions: [
        {
          type: 'set_filing_status',
          status: 'single',
        },
      ],
    });

    const input = page.getByPlaceholder(/Ask about your taxes/i);
    await input.fill('I am single');
    await page.getByRole('button', { name: /Send message/i }).click();
    await page.waitForTimeout(1500);

    // Click Apply All
    await page.getByRole('button', { name: /Apply All/i }).click();
    await page.waitForTimeout(500);

    // Should see "Applied" confirmation
    await expect(page.getByText('Applied')).toBeVisible();
    // Apply button should be gone
    await expect(page.getByRole('button', { name: /Apply All/i })).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════
// CHAT HISTORY MANAGEMENT
// ═══════════════════════════════════════════════════

test.describe('Chat history', () => {
  test.beforeEach(async ({ page }) => {
    await mockChatAvailable(page);
    await createAndOpenReturn(page);
    await page.waitForTimeout(1000);

    // Open chat and accept disclaimer
    const chatBtn = page.getByRole('button', { name: /AI Assistant|Toggle AI/i });
    await chatBtn.click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /I Understand/i }).click();
    await page.waitForTimeout(400);
  });

  test('preserves messages when panel is closed and reopened', async ({ page }) => {
    await mockChatResponse(page, { message: 'Hello there!' });

    // Send a message
    const input = page.getByPlaceholder(/Ask about your taxes/i);
    await input.fill('Hi from the chat');
    await page.getByRole('button', { name: /Send message/i }).click();
    await page.waitForTimeout(1500);

    // Close panel
    await page.getByRole('button', { name: /Close chat/i }).click();
    await page.waitForTimeout(400);

    // Reopen panel
    const chatBtn = page.getByRole('button', { name: /AI Assistant|Toggle AI/i });
    await chatBtn.click();
    await page.waitForTimeout(400);

    // Messages should still be there
    await expect(page.getByText('Hi from the chat')).toBeVisible();
    await expect(page.getByText('Hello there!')).toBeVisible();
  });

  test('clear history button removes all messages', async ({ page }) => {
    await mockChatResponse(page, { message: 'Response 1' });

    const input = page.getByPlaceholder(/Ask about your taxes/i);
    await input.fill('Message 1');
    await page.getByRole('button', { name: /Send message/i }).click();
    await page.waitForTimeout(1500);

    // Click clear history
    const clearBtn = page.getByRole('button', { name: /Clear chat/i });
    await clearBtn.click();
    await page.waitForTimeout(400);

    // Messages should be gone, placeholder should return
    await expect(page.getByText('Message 1')).not.toBeVisible();
    await expect(page.getByText(/How can I help with your taxes/i)).toBeVisible();
  });
});
