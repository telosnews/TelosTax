/**
 * Migration v6 → v7: W-2 Box 12 and Box 13 fields.
 *
 * No-op data migration — just bumps schemaVersion to 7.
 * New optional fields (box12, box13) on W2Income default to
 * undefined until the user provides them.
 *
 * DB-level: server migration adds box12_json, box13_statutory_employee,
 * box13_retirement_plan, box13_third_party_sick_pay columns to w2_income.
 */

import type { Migration } from './runner.js';

export const migrationV7: Migration = {
  version: 7,
  description: 'Add W-2 Box 12 and Box 13 fields (no data transform needed)',
  up(data: Record<string, unknown>): Record<string, unknown> {
    data.schemaVersion = 7;
    return data;
  },
};
