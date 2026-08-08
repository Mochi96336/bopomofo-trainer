import {
  catalogEntryCommonnessTier,
  COMMONNESS_TIERS,
  type CommonnessTier,
  type CommonnessTierThresholds,
} from "../commonness/tiers.js";
import type { MeasurementSummaryV2 } from "../measurement-v2/aggregate.js";
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
  cleanInputsPerKey: 8,
  practisedKeysForTier: { 2: 20, 3: 27, 4: 33 },
} as const satisfies {
  readonly cleanInputsPerKey: number;
  readonly practisedKeysForTier: Readonly<Record<Exclude<CommonnessTier, 1>, number>>;
};

export interface CommonnessUnlockProgress {
  readonly tier: CommonnessTier;
  readonly practisedKeys: number;
  readonly requiredKeys: number;
}

export function requiredPractisedKeys(tier: CommonnessTier): number {
  return tier === 1 ? 0 : COMMONNESS_UNLOCK_POLICY.practisedKeysForTier[tier];
}

export function practisedKeyCount(measurements: MeasurementSummaryV2): number {
  return Object.values(measurements.semantic.bindings).filter((binding) =>
    binding.attempts - binding.errors >= COMMONNESS_UNLOCK_POLICY.cleanInputsPerKey,
  ).length;
}

export function unlockedCommonnessTiers(
  measurements: MeasurementSummaryV2,
): readonly CommonnessTier[] {
  const practised = practisedKeyCount(measurements);
  return COMMONNESS_TIERS.filter((tier) => practised >= requiredPractisedKeys(tier));
}

export function nextCommonnessUnlock(
  measurements: MeasurementSummaryV2,
): CommonnessUnlockProgress | null {
  const practised = practisedKeyCount(measurements);
  const tier = COMMONNESS_TIERS.find((candidate) => practised < requiredPractisedKeys(candidate));
  if (tier === undefined) return null;
  return { tier, practisedKeys: practised, requiredKeys: requiredPractisedKeys(tier) };
}

export function effectiveCommonnessTiers(
  preferred: readonly CommonnessTier[],
  unlocked: readonly CommonnessTier[],
): readonly CommonnessTier[] {
  if (unlocked.length === 0) throw new RangeError("at least one commonness tier must be unlocked");
  const enabled = unlocked.filter((tier) => preferred.includes(tier));
  return enabled.length === 0 ? [unlocked[0]!] : enabled;
}

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
