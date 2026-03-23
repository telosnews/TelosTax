/**
 * Archetype registry — all 13 archetypes with selection weights.
 */

import type { Rng } from '../generators/random';
import type { FuzzerTaxReturn } from '../generators/base';
import { buildSimpleW2 } from './simple-w2';
import { buildDualIncomeFamily } from './dual-income-family';
import { buildSelfEmployedSingle } from './self-employed-single';
import { buildSelfEmployedCouple } from './self-employed-couple';
import { buildRetiree } from './retiree';
import { buildInvestor } from './investor';
import { buildGigWorker } from './gig-worker';
import { buildHighIncomeItemizer } from './high-income-itemizer';
import { buildLowIncomeCredits } from './low-income-credits';
import { buildMultiState } from './multi-state';
import { buildRentalLandlord } from './rental-landlord';
import { buildCryptoTrader } from './crypto-trader';
import { buildKitchenSink } from './kitchen-sink';

export interface ArchetypeBuilder {
  name: string;
  weight: number;
  build: (rng: Rng, tr: FuzzerTaxReturn) => void;
}

/**
 * All 13 archetypes with weights for random selection.
 * Higher weight = more likely to appear in a fuzzing run.
 */
export const ARCHETYPES: ArchetypeBuilder[] = [
  { name: 'simple-w2',              weight: 15, build: buildSimpleW2 },
  { name: 'dual-income-family',     weight: 12, build: buildDualIncomeFamily },
  { name: 'self-employed-single',   weight: 10, build: buildSelfEmployedSingle },
  { name: 'self-employed-couple',   weight: 8,  build: buildSelfEmployedCouple },
  { name: 'retiree',                weight: 8,  build: buildRetiree },
  { name: 'investor',               weight: 8,  build: buildInvestor },
  { name: 'gig-worker',             weight: 8,  build: buildGigWorker },
  { name: 'high-income-itemizer',   weight: 7,  build: buildHighIncomeItemizer },
  { name: 'low-income-credits',     weight: 7,  build: buildLowIncomeCredits },
  { name: 'multi-state',            weight: 5,  build: buildMultiState },
  { name: 'rental-landlord',        weight: 5,  build: buildRentalLandlord },
  { name: 'crypto-trader',          weight: 4,  build: buildCryptoTrader },
  { name: 'kitchen-sink',           weight: 3,  build: buildKitchenSink },
];

export const ARCHETYPE_NAMES = ARCHETYPES.map((a) => a.name);
