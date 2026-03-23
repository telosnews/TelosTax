/**
 * Migration v1 → v2: Promote singular `business` to `businesses[]` array.
 *
 * Pre-routing data has `business` (singular) for single-business users and
 * an empty `businesses[]` array. This migration copies `business` into
 * `businesses[0]` so the engine and UI can use the array path consistently.
 * Also ensures every business has an `id` field.
 */

import type { Migration } from './runner.js';

export const migrationV2: Migration = {
  version: 2,
  description: 'Promote singular business to businesses array for multi-business routing',
  up(data: Record<string, unknown>): Record<string, unknown> {
    const businesses = data.businesses as unknown[] | undefined;
    const business = data.business as Record<string, unknown> | undefined;

    // If `business` exists but `businesses` is empty or missing, promote it
    if (business && (!businesses || !Array.isArray(businesses) || businesses.length === 0)) {
      // Ensure the business has an id
      if (!business.id) {
        business.id = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `biz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }
      data.businesses = [{ ...business }];
    }

    // Ensure any existing businesses in the array have ids
    if (Array.isArray(data.businesses)) {
      for (const biz of data.businesses as Record<string, unknown>[]) {
        if (!biz.id) {
          biz.id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `biz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }
      }
    }

    data.schemaVersion = 2;
    return data;
  },
};
