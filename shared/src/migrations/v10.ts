/**
 * Migration v9 → v10: Form 8582 Passive Activity Loss Limitations.
 *
 * Adds default values for new passive activity fields on existing
 * rental properties and K-1 entries:
 *   - RentalProperty.activeParticipation → true (common case)
 *   - IncomeK1.isPassiveActivity → false (Box 1 ordinary is non-passive by default)
 *
 * New optional fields (form8582Data, disposedDuringYear, dispositionGainLoss)
 * default to undefined until the user sets them.
 */

import type { Migration } from './runner.js';

export const migrationV10: Migration = {
  version: 10,
  description: 'Add Form 8582 passive activity loss fields — default activeParticipation=true on rentals',
  up(data: Record<string, unknown>): Record<string, unknown> {
    // Set activeParticipation = true on existing rental properties
    const rentals = data.rentalProperties;
    if (Array.isArray(rentals)) {
      for (const prop of rentals) {
        if (prop && typeof prop === 'object' && !('activeParticipation' in prop)) {
          (prop as Record<string, unknown>).activeParticipation = true;
        }
      }
    }

    // Set isPassiveActivity = false on existing K-1 entries
    const k1s = data.incomeK1;
    if (Array.isArray(k1s)) {
      for (const k1 of k1s) {
        if (k1 && typeof k1 === 'object' && !('isPassiveActivity' in k1)) {
          (k1 as Record<string, unknown>).isPassiveActivity = false;
        }
      }
    }

    data.schemaVersion = 10;
    return data;
  },
};
