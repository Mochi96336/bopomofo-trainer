import type { DependencyCountMap } from "./types.js";

/**
 * Source morphology is intentionally broader than the product runtime contract.
 * Every feature admitted here must have a reviewed construction-level consumer;
 * do not turn the compact catalog into a mirror of arbitrary UD FEATS.
 */
export const REVIEWED_RUNTIME_MORPHOLOGICAL_FEATURES = ["Voice=Cau"] as const;

const REVIEWED_RUNTIME_MORPHOLOGICAL_FEATURE_SET: ReadonlySet<string> = new Set(
  REVIEWED_RUNTIME_MORPHOLOGICAL_FEATURES,
);

/**
 * Project full source counts into the sparse runtime presence contract.
 * Absent reviewed evidence stays absent rather than materializing an empty map.
 */
export function projectRuntimeMorphologicalFeatureCounts(
  sourceCounts: DependencyCountMap,
): DependencyCountMap | undefined {
  const projected: Record<string, number> = {};
  for (const feature of REVIEWED_RUNTIME_MORPHOLOGICAL_FEATURES) {
    if ((sourceCounts[feature] ?? 0) > 0) projected[feature] = 1;
  }
  return Object.keys(projected).length === 0 ? undefined : projected;
}

/**
 * Runtime artifacts fail closed on morphology outside the reviewed allowlist.
 * Counts are presence-only, so every serialized value must be exactly 1.
 */
export function validRuntimeMorphologicalFeatureCounts(
  counts: DependencyCountMap | undefined,
): boolean {
  if (counts === undefined) return true;
  return Object.entries(counts).every(
    ([feature, count]) => REVIEWED_RUNTIME_MORPHOLOGICAL_FEATURE_SET.has(feature) && count === 1,
  );
}
