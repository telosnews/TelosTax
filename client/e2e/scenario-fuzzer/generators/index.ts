/**
 * Master orchestrator — picks an archetype, builds a TaxReturn, derives discovery flags.
 */

import { createRng, type Rng } from './random';
import { baseTaxReturn, type FuzzerTaxReturn } from './base';
import { deriveDiscoveryFlags } from './discovery';
import { ARCHETYPES, type ArchetypeBuilder } from '../archetypes';

export interface GeneratedScenario {
  seed: number;
  archetype: string;
  taxReturn: FuzzerTaxReturn;
}

/** Generate a single scenario from a seed. */
export function generateScenario(seed: number, archetypeName?: string): GeneratedScenario {
  const rng = createRng(seed);
  const base = baseTaxReturn(rng);

  let archetype: ArchetypeBuilder;
  let name: string;

  if (archetypeName) {
    const found = ARCHETYPES.find((a) => a.name === archetypeName);
    if (!found) throw new Error(`Unknown archetype: ${archetypeName}`);
    archetype = found;
    name = found.name;
  } else {
    archetype = pickWeightedArchetype(rng);
    name = archetype.name;
  }

  archetype.build(rng, base);
  deriveDiscoveryFlags(base);

  // Ensure highestStepVisited is high enough to allow navigation
  base.highestStepVisited = 999;

  return { seed, archetype: name, taxReturn: base };
}

/** Generate multiple scenarios starting from a base seed. */
export function generateScenarios(count: number, baseSeed: number, archetypeName?: string): GeneratedScenario[] {
  const scenarios: GeneratedScenario[] = [];
  for (let i = 0; i < count; i++) {
    scenarios.push(generateScenario(baseSeed + i, archetypeName));
  }
  return scenarios;
}

function pickWeightedArchetype(rng: Rng): ArchetypeBuilder {
  return rng.weighted(ARCHETYPES.map((a) => [a, a.weight] as [ArchetypeBuilder, number]));
}

export { createRng, type Rng, baseTaxReturn, type FuzzerTaxReturn, deriveDiscoveryFlags };
