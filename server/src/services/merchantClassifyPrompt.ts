/**
 * Merchant Classification Prompt & Response Parser
 *
 * System prompt for the batch merchant classification endpoint.
 * The AI identifies what each merchant IS (business type) — it NEVER
 * assesses tax deductibility or provides tax advice.
 *
 * Tax advice boundary: "Engine calculates, AI narrates, user decides."
 */

// ─── System Prompt ──────────────────────────────────

export const MERCHANT_CLASSIFY_PROMPT = `You are a merchant name classifier. Given merchant names from bank or credit card statements, identify what type of business each one is.

RULES:
1. Return ONLY what the business IS (its type). Use short, consistent labels.
   Good examples: "pharmacy", "airline", "software subscription", "fitness center", "grocery store", "gas station", "restaurant", "clothing retailer", "streaming service", "insurance company", "medical office", "charity/nonprofit", "coworking space", "office supply store", "hotel", "car rental", "rideshare service", "accounting/tax service", "online marketplace", "pet supply store".
2. Do NOT assess tax deductibility or tax relevance. Do NOT provide tax advice.
3. If you cannot determine what a merchant is, return businessType: "unknown".
4. Merchant names on statements are often abbreviated, truncated, or include location codes. Use your knowledge to identify the actual business. For example:
   - "AMZN MKTP US" → "online marketplace"
   - "SQ *JOES COFFEE" → "coffee shop"
   - "GOOGLE *WORKSPACE" → "software subscription"
5. Return valid JSON only. No markdown, no explanation, no commentary.

RESPONSE FORMAT:
{"classifications":[{"merchant":"MERCHANT NAME","businessType":"type label"},{"merchant":"ANOTHER","businessType":"type label"}]}`;

// ─── Types ──────────────────────────────────────────

export interface MerchantClassification {
  merchant: string;
  businessType: string;
}

export interface BatchClassifyResponse {
  classifications: MerchantClassification[];
}

// ─── Response Parser ────────────────────────────────

/**
 * Parse the LLM's JSON response into a typed array of classifications.
 * Returns an empty array on parse failure (defensive — never throws).
 */
export function parseClassificationResponse(raw: string): MerchantClassification[] {
  try {
    // Strip markdown fences if present (some models wrap JSON in ```json...```)
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      // JSON may be truncated (model hit max tokens). Try to salvage by:
      // 1. Finding all complete classification objects via regex
      console.warn(`[batch-parser] JSON.parse failed, attempting salvage. Error: ${parseErr}`);
      console.warn(`[batch-parser] Last 100 chars: ${cleaned.slice(-100)}`);
      const results: MerchantClassification[] = [];
      const regex = /\{\s*"merchant"\s*:\s*"([^"]+)"\s*,\s*"businessType"\s*:\s*"([^"]+)"\s*\}/g;
      let match;
      while ((match = regex.exec(cleaned)) !== null) {
        results.push({ merchant: match[1], businessType: match[2].toLowerCase().trim() });
      }
      console.log(`[batch-parser] Salvaged ${results.length} classifications from truncated response`);
      return results;
    }

    // Handle both { classifications: [...] } and bare [...]
    const arr = Array.isArray(parsed) ? parsed : parsed?.classifications;
    if (!Array.isArray(arr)) return [];

    return arr
      .filter(
        (item: any) =>
          typeof item?.merchant === 'string' &&
          typeof item?.businessType === 'string',
      )
      .map((item: any) => ({
        merchant: item.merchant,
        businessType: item.businessType.toLowerCase().trim(),
      }));
  } catch (outerErr) {
    console.error(`[batch-parser] Unexpected error:`, outerErr);
    return [];
  }
}

// ─── User Message Builder ───────────────────────────

/**
 * Build the user message for the classification request.
 * Includes minimal profile context for disambiguation only.
 */
export function buildClassifyUserMessage(
  merchants: string[],
  context: { hasScheduleC?: boolean; hasHomeOffice?: boolean; hasRentalIncome?: boolean },
): string {
  const profileParts: string[] = [];
  if (context.hasScheduleC) profileParts.push('self-employed (Schedule C)');
  if (context.hasHomeOffice) profileParts.push('has a home office');
  if (context.hasRentalIncome) profileParts.push('has rental properties');

  const profileLine = profileParts.length > 0
    ? `\n\nUser profile (for disambiguation only, NOT for tax advice): ${profileParts.join(', ')}.`
    : '';

  return `Classify these ${merchants.length} merchants:
${merchants.join('\n')}${profileLine}`;
}
