/**
 * Schema Migration Runner
 *
 * Applies sequential migrations to bring a TaxReturn from any schema version
 * to the current version. Migrations are lazy — they run when data is read,
 * not on app startup. This avoids rewriting all of localStorage on upgrade.
 *
 * Usage (in the data layer):
 *   const raw = JSON.parse(localStorage.getItem(key));
 *   const migrated = migrateReturn(raw);   // applies pending migrations
 *   // migrated is now at CURRENT_SCHEMA_VERSION
 *
 * Adding a new migration:
 *   1. Create shared/src/migrations/v{N}.ts with a Migration export
 *   2. Register it in the MIGRATIONS array below
 *   3. Bump CURRENT_SCHEMA_VERSION to N
 *   4. Add/modify TaxReturn fields as needed in types/index.ts
 */

// ─── Types ────────────────────────────────────────

export interface Migration {
  /** The schema version this migration produces. */
  version: number;
  /** Human-readable description for debugging. */
  description: string;
  /** Transform the raw data object in place and return it. */
  up(data: Record<string, unknown>): Record<string, unknown>;
}

// ─── Registry ─────────────────────────────────────

import { migrationV1 } from './v1.js';
import { migrationV2 } from './v2.js';
import { migrationV3 } from './v3.js';
import { migrationV4 } from './v4.js';
import { migrationV5 } from './v5.js';
import { migrationV6 } from './v6.js';
import { migrationV7 } from './v7.js';
import { migrationV8 } from './v8.js';
import { migrationV9 } from './v9.js';
import { migrationV10 } from './v10.js';
import { migrationV11 } from './v11.js';
import { migrationV12 } from './v12.js';

/**
 * Ordered list of all migrations. Each entry upgrades from (version - 1) → version.
 * MUST be sorted by version ascending.
 */
const MIGRATIONS: Migration[] = [
  migrationV1,
  migrationV2,
  migrationV3,
  migrationV4,
  migrationV5,
  migrationV6,
  migrationV7,
  migrationV8,
  migrationV9,
  migrationV10,
  migrationV11,
  migrationV12,
];

/** The latest schema version. Returns at this version need no migration. */
export const CURRENT_SCHEMA_VERSION = 12;

// ─── Runner ───────────────────────────────────────

/**
 * Migrate a raw TaxReturn object to the current schema version.
 *
 * @param data - The raw parsed JSON (may have any/no schemaVersion)
 * @returns The same object reference, mutated to current schema version.
 *          Returns null if data is falsy or not an object.
 */
export function migrateReturn(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;
  const currentVersion = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 0;

  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    return obj; // Already up to date
  }

  // Apply each pending migration in order
  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      migration.up(obj);
    }
  }

  return obj;
}

/**
 * Check whether a raw TaxReturn needs migration.
 * Useful for deciding whether to re-persist after read.
 */
export function needsMigration(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  const version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 0;
  return version < CURRENT_SCHEMA_VERSION;
}
