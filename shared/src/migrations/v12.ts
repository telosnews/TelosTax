/**
 * Migration v11 → v12: Add expenseScanner field for Smart Expense Scanner.
 *
 * Initializes with empty defaults. Carries over existing deductionFinder
 * dismissed/addressed IDs if present.
 */

import type { Migration } from './runner.js';

export const migrationV12: Migration = {
  version: 12,
  description: 'Add expenseScanner field for Smart Expense Scanner',
  up(data: Record<string, unknown>): Record<string, unknown> {
    if (!data.expenseScanner) {
      // Carry over existing deductionFinder dismissed/addressed IDs
      const oldFinder = data.deductionFinder as Record<string, unknown> | undefined;
      data.expenseScanner = {
        enabledCategories: [],
        contextHints: {},
        dismissedInsightIds: Array.isArray(oldFinder?.dismissedInsightIds) ? oldFinder.dismissedInsightIds : [],
        addressedInsightIds: Array.isArray(oldFinder?.addressedInsightIds) ? oldFinder.addressedInsightIds : [],
      };
    }
    data.schemaVersion = 12;
    return data;
  },
};
