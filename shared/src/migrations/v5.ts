/**
 * Migration v4 → v5: Full SSN collection support.
 *
 * No-op data migration — just bumps schemaVersion to 5.
 * Old returns keep `ssnLastFour` as-is; `ssn` will be `undefined`
 * until the user enters it at the review step.
 */

import type { Migration } from './runner.js';

export const migrationV5: Migration = {
  version: 5,
  description: 'Add full SSN field support (no data transform needed)',
  up(data: Record<string, unknown>): Record<string, unknown> {
    data.schemaVersion = 5;
    return data;
  },
};
