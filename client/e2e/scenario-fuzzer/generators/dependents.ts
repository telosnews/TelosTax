/**
 * Dependent generator — age-appropriate children, relatives, etc.
 */

import type { Rng } from './random';

const RELATIONSHIPS = ['son', 'daughter', 'stepchild', 'foster child', 'sibling', 'grandchild', 'niece', 'nephew'] as const;

export function generateDependents(rng: Rng, count: number): Record<string, unknown>[] {
  const deps: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const isChild = rng.chance(0.85);
    const age = isChild ? rng.int(0, 17) : rng.int(18, 24);
    const relationship = isChild ? rng.pick(['son', 'daughter'] as const) : rng.pick(RELATIONSHIPS);

    deps.push({
      id: rng.uuid(),
      firstName: rng.firstName(),
      lastName: rng.lastName(),
      ssn: rng.ssn(),
      relationship,
      dateOfBirth: rng.dateOfBirth(age, age),
      monthsLivedWithYou: rng.int(7, 12),
      isStudent: age >= 19 && age <= 24 ? rng.chance(0.7) : false,
      isDisabled: rng.chance(0.05),
    });
  }
  return deps;
}

/** Generate qualifying children only (under 17 for CTC). */
export function generateQualifyingChildren(rng: Rng, count: number): Record<string, unknown>[] {
  const deps: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    deps.push({
      id: rng.uuid(),
      firstName: rng.firstName(),
      lastName: rng.lastName(),
      ssn: rng.ssn(),
      relationship: rng.pick(['son', 'daughter'] as const),
      dateOfBirth: rng.dateOfBirth(1, 16),
      monthsLivedWithYou: 12,
      isStudent: false,
      isDisabled: false,
    });
  }
  return deps;
}
