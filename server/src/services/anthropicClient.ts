/**
 * Anthropic Client — BYOK adapter for Claude models.
 *
 * Creates a one-shot Anthropic client using the user's API key.
 * The key is never stored, logged, or cached.
 *
 * Tuning:
 *   - Assistant prefill: for Claude 3.x models, appends { role: "assistant",
 *     content: "{" } to force JSON output. Claude 4+ models don't support
 *     prefill, so we rely on the system prompt instruction instead.
 *   - Prompt caching: the static system prompt is marked with cache_control
 *     to get a 90% input token discount on subsequent messages in a session.
 */

import Anthropic from '@anthropic-ai/sdk';
import { parseResponse, buildIrsReferenceData } from '@telostax/engine';
import type { ChatResponse } from '@telostax/engine';

/** Claude 3.x models support assistant prefill; 4+ do not. */
function supportsAssistantPrefill(model: string): boolean {
  return model.includes('claude-3');
}

/**
 * Send a chat completion request using a user-provided Anthropic API key (BYOK mode).
 * Creates a one-shot client — the key is never stored or cached.
 */
export async function anthropicCompletionWithKey(
  apiKey: string,
  model: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: Record<string, unknown>,
  systemPrompt: string,
): Promise<ChatResponse> {
  // Anthropic's API data usage policy: API data is not used for model training.
  // See https://docs.anthropic.com/en/docs/data-usage-policy
  const client = new Anthropic({
    apiKey,
    timeout: 120_000, // 2 minute timeout
    defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
  });

  const referenceData = buildIrsReferenceData({
    filingStatus: context.filingStatus as string | undefined,
    currentSection: context.currentSection as string | undefined,
    incomeDiscovery: context.incomeDiscovery as Record<string, string> | undefined,
    deductionMethod: context.deductionMethod as string | undefined,
    dependentCount: context.dependentCount as number | undefined,
  });
  const contextSuffix = `\n\n${referenceData}\n\nCURRENT CONTEXT:\n${JSON.stringify(context, null, 2)}`;

  const usePrefill = supportsAssistantPrefill(model);

  const mappedMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  // Claude 3.x: assistant prefill forces JSON output
  if (usePrefill) {
    mappedMessages.push({ role: 'assistant', content: '{' });
  }

  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    temperature: 0.3,
    // Split system prompt into cacheable (static) + dynamic (context) blocks
    system: [
      {
        type: 'text' as const,
        text: systemPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
      {
        type: 'text' as const,
        text: contextSuffix,
      },
    ],
    messages: mappedMessages,
  });

  // Anthropic returns content as an array of blocks — extract text
  const raw = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  // With prefill the "{" is NOT echoed in the response — prepend it
  return parseResponse(usePrefill ? '{' + raw : raw);
}

/**
 * Send a completion request using a user-provided Anthropic key and return the raw text.
 * Used by batch endpoints where the response isn't in chat JSON format.
 */
export async function rawAnthropicCompletionWithKey(
  apiKey: string,
  model: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
): Promise<string> {
  const client = new Anthropic({
    apiKey,
    timeout: 120_000, // 2 minute timeout
    defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
  });

  const usePrefill = supportsAssistantPrefill(model);

  const mappedMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  if (usePrefill) {
    mappedMessages.push({ role: 'assistant', content: '{' });
  }

  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    temperature: 0.3,
    system: systemPrompt,
    messages: mappedMessages,
  });

  const raw = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  return usePrefill ? '{' + raw : raw;
}
