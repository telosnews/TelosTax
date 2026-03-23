/**
 * Migration v8 → v9: Schedule B Part III (Foreign Accounts and Trusts) support.
 *
 * No-op data migration — just bumps schemaVersion to 9.
 * New optional field (scheduleBPartIII) defaults to undefined until the user sets it.
 */

import type { Migration } from './runner.js';

export const migrationV9: Migration = {
  version: 9,
  description: 'Add Schedule B Part III foreign accounts fields (no data transform needed)',
  up(data: Record<string, unknown>): Record<string, unknown> {
    data.schemaVersion = 9;
    return data;
  },
};
