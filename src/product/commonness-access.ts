import {
  catalogEntryCommonnessTier,
  COMMONNESS_TIERS,
  type CommonnessTier,
  type CommonnessTierThresholds,
} from "../commonness/tiers.js";
import type { MeasurementSummary } from "../measurement/types.js";
import type { ProductCatalogs } from "./types.js";

/**
 * How the rarer commonness levels are earned.
 *
 * The gate is keyboard breadth rather than practice volume, because rarer
 * words are built out of the rarer letters: a learner who has never typed ㄘ or
 * ㄖ has no way to meet the vocabulary the wider pool would draw from. Only
 * clean inputs count -- attempts that were not errors -- so accuracy shortens
 * the road without a separate accuracy bar to state.
 *
 * Counting clean inputs also makes the measure monotone, which is what lets the
 * unlocked set be derived from the measurements instead of stored: a level that
 * has been earned can never be taken back, so there is no high-water mark to
 * keep in sync with progress, and clearing progress honestly clears the levels.
 */
export const COMMONNESS_UNLOCK_POLICY = {
  /** Clean inputs one key needs before it counts as practised. */
  cleanInputsPerKey: 8,
  /**
   * Practised keys required for each level past the first, measured against a
   * simulated flawless learner on the shipped catalog: 20 keys lands near the
   * 34th sentence, 27 near the 60th, 33 near the 120th. The last bar stays
   * below 36 because the most common tenth of the catalog alone cannot practise
   * every key -- ㄦ and ㄆ barely occur in it -- and a bar the unlocked pool
   * cannot reach would be a permanent lock, not a level.
   */
  practisedKeysForTier: { 2: 20, 3: 27, 4: 33 },
} as const satisfies {
  readonly cleanInputsPerKey: number;
  readonly practisedKeysForTier: Readonly<Record<Exclude<CommonnessTier, 1>, number>>;
};

export interface CommonnessUnlockProgress {
  /** The next level still locked. */
  readonly tier: CommonnessTier;
  readonly practisedKeys: number;
  readonly requiredKeys: number;
}

/** Practised keys the level asks for; the first level asks for none. */
export function requiredPractisedKeys(tier: CommonnessTier): number {
  return tier === 1 ? 0 : COMMONNESS_UNLOCK_POLICY.practisedKeysForTier[tier];
}

/** Keys with enough clean inputs to count as practised. */
export function practisedKeyCount(measurements: MeasurementSummary): number {
  return Object.values(measurements.bindings).filter((binding) =>
    binding.attempts - binding.errors >= COMMONNESS_UNLOCK_POLICY.cleanInputsPerKey,
  ).length;
}

/**
 * The levels the learner has earned. The most common level is always open:
 * practice has to start somewhere, and it is the level a fresh learner is
 * already being given today.
 */
export function unlockedCommonnessTiers(
  measurements: MeasurementSummary,
): readonly CommonnessTier[] {
  const practised = practisedKeyCount(measurements);
  return COMMONNESS_TIERS.filter((tier) => practised >= requiredPractisedKeys(tier));
}

/** What the next locked level asks for, or `null` once every level is open. */
export function nextCommonnessUnlock(
  measurements: MeasurementSummary,
): CommonnessUnlockProgress | null {
  const practised = practisedKeyCount(measurements);
  const tier = COMMONNESS_TIERS.find((candidate) => practised < requiredPractisedKeys(candidate));
  if (tier === undefined) return null;
  return { tier, practisedKeys: practised, requiredKeys: requiredPractisedKeys(tier) };
}

/**
 * The levels actually practised: what the learner asked for, narrowed to what
 * is unlocked, and never empty -- an empty pool has no sentences to draw.
 *
 * Keeping the preference wider than the unlocked set is deliberate. A level the
 * learner never switched off joins practice on the round it unlocks, and a
 * level they did switch off stays off when a later one opens.
 */
export function effectiveCommonnessTiers(
  preferred: readonly CommonnessTier[],
  unlocked: readonly CommonnessTier[],
): readonly CommonnessTier[] {
  if (unlocked.length === 0) throw new RangeError("at least one commonness tier must be unlocked");
  const enabled = unlocked.filter((tier) => preferred.includes(tier));
  return enabled.length === 0 ? [unlocked[0]!] : enabled;
}

/**
 * The catalogs restricted to the given levels.
 *
 * The evaluation catalog is left whole: it is the fixed yardstick the product
 * measures against, and narrowing it by a practice preference would make its
 * readings mean different things at different settings. Syntax profiles are
 * filtered alongside the practice entries because the environment rejects a
 * profile that points at an entry it does not have.
 *
 * An entry with no reviewed frequency evidence has no level to filter by, so it
 * stays in every setting rather than being silently dropped by all of them.
 */
export function catalogsForCommonnessTiers(
  catalogs: ProductCatalogs,
  thresholds: CommonnessTierThresholds,
  tiers: readonly CommonnessTier[],
): ProductCatalogs {
  if (tiers.length === 0) throw new RangeError("at least one commonness tier must be practised");
  if (tiers.length === COMMONNESS_TIERS.length) return catalogs;
  const practice = catalogs.practice.filter((entry) => {
    const tier = catalogEntryCommonnessTier(entry, thresholds);
    return tier === null || tiers.includes(tier);
  });
  const entryIds = new Set([
    ...practice.map((entry) => entry.id),
    ...catalogs.evaluation.map((entry) => entry.id),
  ]);
  return {
    practice,
    evaluation: catalogs.evaluation,
    syntaxProfiles: catalogs.syntaxProfiles.filter((profile) => entryIds.has(profile.entryId)),
  };
}
