/**
 * Shared Rate Limiter — SQLite-backed, per-endpoint rate limiting.
 *
 * Centralizes rate limiting logic previously duplicated across chat.ts,
 * batch.ts, and extract.ts. Supports per-endpoint tracking and configurable
 * limits.
 */

import { Request } from 'express';
import { getDb } from '../db/connection.js';

/**
 * Initialize the rate_limits table with an endpoint column.
 * Safe to call multiple times (CREATE IF NOT EXISTS).
 */
export function initRateLimitTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      ip TEXT NOT NULL,
      endpoint TEXT NOT NULL DEFAULT 'default',
      request_time INTEGER NOT NULL
    )
  `);

  // Migration: add endpoint column to existing tables that lack it
  const cols = db.pragma('table_info(rate_limits)') as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'endpoint')) {
    db.exec("ALTER TABLE rate_limits ADD COLUMN endpoint TEXT NOT NULL DEFAULT 'default'");
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_ep_time ON rate_limits (ip, endpoint, request_time)`);
}

/**
 * Check if a request is within rate limits.
 * Returns true if the request is allowed, false if rate limited.
 *
 * @param ip - Client IP address
 * @param endpoint - Endpoint identifier (e.g., 'chat', 'batch', 'extract')
 * @param max - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 60s)
 */
export function checkRateLimit(
  ip: string,
  endpoint: string,
  max: number,
  windowMs: number = 60_000,
): boolean {
  const db = getDb();
  const now = Date.now();
  const windowStart = now - windowMs;

  // Run SELECT + INSERT atomically inside a transaction to prevent
  // TOCTOU races where concurrent requests both pass the count check.
  const result = db.transaction(() => {
    db.prepare('DELETE FROM rate_limits WHERE ip = ? AND endpoint = ? AND request_time < ?').run(ip, endpoint, windowStart);

    const row = db.prepare(
      'SELECT COUNT(*) as cnt FROM rate_limits WHERE ip = ? AND endpoint = ? AND request_time >= ?',
    ).get(ip, endpoint, windowStart) as { cnt: number } | undefined;

    if ((row?.cnt ?? 0) >= max) return false;

    db.prepare('INSERT INTO rate_limits (ip, endpoint, request_time) VALUES (?, ?, ?)').run(ip, endpoint, now);
    return true;
  })();

  return result as boolean;
}

/**
 * Send a standardized 429 response with Retry-After header.
 */
export function sendRateLimitResponse(
  res: import('express').Response,
  message: string,
  retryAfterSeconds: number = 60,
): void {
  res.set('Retry-After', String(retryAfterSeconds));
  res.status(429).json({
    error: { message, code: 'RATE_LIMITED' },
  });
}

/**
 * Extract client IP from an Express request.
 * Returns null for invalid or unrecognizable IPs (L3 fix).
 */
export function getClientIp(req: Request): string | null {
  const ip = req.ip || req.socket.remoteAddress;
  if (!ip) return null;
  if (ip.length > 45 || !/^[\d.:a-fA-F]+$/.test(ip)) return null;
  return ip;
}
