/**
 * Migration v0 → v1: Initial schema version.
 *
 * Existing returns created before the migration system have no schemaVersion.
 * This migration:
 *   1. Sets schemaVersion to 1
 *   2. Ensures all required array fields exist (prevents runtime crashes
 *      if new array fields were added after the return was first saved)
 *   3. Ensures incomeDiscovery exists (added mid-development)
 */

import type { Migration } from './runner.js';

/** Array fields and their empty defaults — these must always be present. */
const REQUIRED_ARRAYS: Record<string, unknown[]> = {
  dependents: [],
  w2Income: [],
  income1099NEC: [],
  income1099K: [],
  income1099INT: [],
  income1099DIV: [],
  income1099R: [],
  income1099G: [],
  income1099MISC: [],
  income1099B: [],
  rentalProperties: [],
  incomeK1: [],
  income1099SA: [],
  incomeW2G: [],
  income1099DA: [],
  income1099C: [],
  income1099Q: [],
  businesses: [],
  expenses: [],
  educationCredits: [],
};

export const migrationV1: Migration = {
  version: 1,
  description: 'Initial schema — backfill required arrays and defaults',
  up(data: Record<string, unknown>): Record<string, unknown> {
    // Ensure all required array fields exist
    for (const [key, defaultValue] of Object.entries(REQUIRED_ARRAYS)) {
      if (!Array.isArray(data[key])) {
        data[key] = defaultValue;
      }
    }

    // Ensure scalar defaults
    if (data.otherIncome === undefined) data.otherIncome = 0;
    if (data.deductionMethod === undefined) data.deductionMethod = 'standard';
    if (data.incomeDiscovery === undefined || typeof data.incomeDiscovery !== 'object') {
      data.incomeDiscovery = {};
    }

    data.schemaVersion = 1;
    return data;
  },
};
