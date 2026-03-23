/**
 * Migration v10 → v11: Add dismissedNudges for proactive AI nudge system.
 *
 * Adds `dismissedNudges: []` default. No-op for existing data since the
 * field is optional and defaults to empty array when undefined.
 */

import type { Migration } from './runner.js';

export const migrationV11: Migration = {
  version: 11,
  description: 'Add dismissedNudges array for proactive AI nudge tracking',
  up(data: Record<string, unknown>): Record<string, unknown> {
    if (!Array.isArray(data.dismissedNudges)) {
      data.dismissedNudges = [];
    }
    data.schemaVersion = 11;
    return data;
  },
};
