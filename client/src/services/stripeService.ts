/**
 * Stripe Service — client-side helpers for tip jar.
 *
 * Handles fetching tip jar Payment Link URLs from the server.
 * These are pre-configured Stripe Payment Links — clicking opens Stripe's hosted page.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

// ─── Tip Jar ─────────────────────────────────────

interface TipLinks {
  small: string | null;
  medium: string | null;
  large: string | null;
}

/**
 * Fetch tip jar Payment Link URLs from the server.
 * These are pre-configured Stripe Payment Links — clicking opens Stripe's hosted page.
 */
export async function getTipLinks(): Promise<TipLinks> {
  try {
    const res = await fetch(`${API_BASE}/api/tip-links`);
    if (!res.ok) return { small: null, medium: null, large: null };
    const json = await res.json();
    return json.data as TipLinks;
  } catch {
    return { small: null, medium: null, large: null };
  }
}
