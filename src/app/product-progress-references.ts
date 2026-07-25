import type { ProductEnvironment, ProductProgress } from "../product/types.js";

export function productProgressReferencesAreKnown(
  progress: ProductProgress,
  environment: ProductEnvironment,
): boolean {
  const knownEntries = new Set([
    ...Object.keys(environment.practiceSupport.entriesById),
    ...Object.keys(environment.evaluationSupport.entriesById),
  ]);
  const knownFocusTokens = new Set(Object.keys(environment.practiceSupport.byToken));

  return progress.recentSummaries.every((summary) => {
    if (summary.entryIds.length === 0) return false;
    if (summary.entryIds.some((entryId) => !knownEntries.has(entryId))) return false;
    if (new Set(summary.entryIds).size !== summary.entryIds.length) return false;
    return summary.focusTokenId === null || knownFocusTokens.has(summary.focusTokenId);
  });
}
