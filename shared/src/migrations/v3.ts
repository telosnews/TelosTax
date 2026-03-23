/**
 * Migration v2 → v3: Distribute estimatedPaymentsMade into per-quarter array.
 *
 * Pre-v3 data has `estimatedPaymentsMade` as a single aggregate number.
 * This migration creates `estimatedQuarterlyPayments` by distributing
 * the total evenly across four quarters. Rounding remainder goes to Q1.
 */

import type { Migration } from './runner.js';

export const migrationV3: Migration = {
  version: 3,
  description: 'Distribute estimatedPaymentsMade into estimatedQuarterlyPayments array',
  up(data: Record<string, unknown>): Record<string, unknown> {
    const total = data.estimatedPaymentsMade as number | undefined;
    const quarterly = data.estimatedQuarterlyPayments as number[] | undefined;

    // Only migrate if there's a total but no quarterly breakdown yet
    if (total && total > 0 && (!quarterly || !Array.isArray(quarterly) || quarterly.length !== 4)) {
      const perQuarter = Math.round((total / 4) * 100) / 100;
      // Put rounding remainder in Q1 so sum always equals original total
      const remainder = Math.round((total - perQuarter * 4) * 100) / 100;
      data.estimatedQuarterlyPayments = [
        Math.round((perQuarter + remainder) * 100) / 100,
        perQuarter,
        perQuarter,
        perQuarter,
      ];
    }

    data.schemaVersion = 3;
    return data;
  },
};
