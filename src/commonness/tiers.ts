import type { CatalogEntry } from "../core/model.js";

/** A displayed commonness level. 1 is the most common band, 4 the rarest. */
export type CommonnessTier = 1 | 2 | 3 | 4;

export const COMMONNESS_TIERS = [1, 2, 3, 4] as const;

/**
 * Cumulative share of the projected catalog at each tier boundary: the most
 * common tenth, then up to a quarter, then up to a half, then the rest.
 *
 * Tiers are cut by share, not by weight value. `selectionWeight` is a
 * log-normalized frequency, so on the shipped catalog its median sits near
 * 0.18 and only about 4% of entries reach 0.5; equal-width value bands would
 * leave nearly every word in one band and read as no level at all.
 */
export const COMMONNESS_TIER_SHARES = [0.1, 0.25, 0.5] as const;

/** Selection-weight cut points, most common first, one per tier boundary. */
export type CommonnessTierThresholds = readonly [number, number, number];

export const COMMONNESS_TIER_LABELS: Readonly<Record<CommonnessTier, string>> = {
  1: "最常用",
  2: "常用",
  3: "一般",
  4: "少見",
};

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function boundaryAt(index: number): number | undefined {
  return index < 0 ? undefined : COMMONNESS_TIER_SHARES[index];
}

/**
 * Derives the cut points from the weights actually shipped, so the levels keep
 * describing the packaged catalog when the commonness model or the source
 * version changes instead of drifting away from fixed numbers.
 */
export function commonnessTierThresholds(
  weights: readonly number[],
): CommonnessTierThresholds {
  if (weights.length === 0) {
    throw new RangeError("commonness tiers need at least one selection weight");
  }
  for (const weight of weights) {
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1) {
      throw new RangeError(`invalid commonness selection weight: ${weight}`);
    }
  }
  const descending = [...weights].sort((left, right) => right - left);
  const cut = (share: number): number => {
    const index = Math.min(
      descending.length - 1,
      Math.max(0, Math.ceil(share * descending.length) - 1),
    );
    return descending[index]!;
  };
  return [
    cut(COMMONNESS_TIER_SHARES[0]),
    cut(COMMONNESS_TIER_SHARES[1]),
    cut(COMMONNESS_TIER_SHARES[2]),
  ];
}

export function commonnessTierForWeight(
  weight: number,
  thresholds: CommonnessTierThresholds,
): CommonnessTier {
  if (weight >= thresholds[0]) return 1;
  if (weight >= thresholds[1]) return 2;
  if (weight >= thresholds[2]) return 3;
  return 4;
}

/**
 * `null` for an entry without reviewed frequency evidence: it has no measured
 * position in the catalog, and drawing it as the rarest tier would state
 * something the data does not say.
 */
export function catalogEntryCommonnessTier(
  entry: CatalogEntry,
  thresholds: CommonnessTierThresholds,
): CommonnessTier | null {
  const weight = entry.commonnessBase?.selectionWeight;
  if (weight === undefined) return null;
  return commonnessTierForWeight(weight, thresholds);
}

/**
 * Every entry's tier for one catalog, cut against that catalog's own weights.
 *
 * Total where the display path is not: analysis code stratifies whole catalogs
 * and cannot carry a "no level" case through every count. A catalog with no
 * commonness evidence at all is flat -- nothing distinguishes its entries, so
 * they all read as tier 1. In a catalog that does have evidence, an entry
 * without it groups with the rarest tier rather than inflating the common one.
 */
export function catalogCommonnessTiers(
  entries: readonly CatalogEntry[],
): ReadonlyMap<string, CommonnessTier> {
  const weights = entries
    .map((entry) => entry.commonnessBase?.selectionWeight)
    .filter((weight): weight is number => weight !== undefined);
  const rarest = COMMONNESS_TIERS[COMMONNESS_TIERS.length - 1]!;
  if (weights.length === 0) {
    return new Map(entries.map((entry) => [entry.id, COMMONNESS_TIERS[0]!]));
  }
  const thresholds = commonnessTierThresholds(weights);
  return new Map(entries.map((entry) => [
    entry.id,
    catalogEntryCommonnessTier(entry, thresholds) ?? rarest,
  ]));
}

/** Where the tier sits in the catalog, e.g. `前 10–25%`. */
export function commonnessTierShareLabel(tier: CommonnessTier): string {
  const upper = boundaryAt(tier - 2);
  const lower = boundaryAt(tier - 1);
  if (lower === undefined) {
    const last = COMMONNESS_TIER_SHARES[COMMONNESS_TIER_SHARES.length - 1]!;
    return `後 ${percent(1 - last)}`;
  }
  if (upper === undefined) return `前 ${percent(lower)}`;
  return `前 ${Math.round(upper * 100)}–${percent(lower)}`;
}

export function commonnessTierDescription(tier: CommonnessTier): string {
  return `${COMMONNESS_TIER_LABELS[tier]} · ${commonnessTierShareLabel(tier)}`;
}
