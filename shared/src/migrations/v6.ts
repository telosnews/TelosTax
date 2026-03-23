/**
 * Migration v5 → v6: Military status and moving expenses support.
 *
 * No-op data migration — just bumps schemaVersion to 6.
 * New optional fields (isActiveDutyMilitary, nontaxableCombatPay, movingExpenses)
 * default to undefined until the user sets them.
 */

import type { Migration } from './runner.js';

export const migrationV6: Migration = {
  version: 6,
  description: 'Add military status and moving expenses fields (no data transform needed)',
  up(data: Record<string, unknown>): Record<string, unknown> {
    data.schemaVersion = 6;
    return data;
  },
};
