import type { CatalogEntry } from "../core/model.js";
import type { CommonnessProjection } from "./types.js";

export interface AppliedCatalogCommonnessProjection {
  readonly entries: readonly CatalogEntry[];
  readonly appliedEntryIds: readonly string[];
  readonly unusedProjectionEntryIds: readonly string[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function applyCommonnessProjection(
  entries: readonly CatalogEntry[],
  projection: CommonnessProjection,
): AppliedCatalogCommonnessProjection {
  const byEntryId = new Map(projection.entries.map((item) => [item.catalogEntryId, item.base]));
  const appliedEntryIds: string[] = [];
  const projected = entries.map((entry) => {
    const base = byEntryId.get(entry.id);
    if (base === undefined) return entry;
    appliedEntryIds.push(entry.id);
    byEntryId.delete(entry.id);
    return { ...entry, commonnessBase: base };
  });
  return {
    entries: projected,
    appliedEntryIds: appliedEntryIds.sort(compareText),
    unusedProjectionEntryIds: [...byEntryId.keys()].sort(compareText),
  };
}

/**
 * Selection weight for one entry. Commonness evidence is the only source; a
 * catalog without it (fixtures, research subsets) weighs every entry equally
 * rather than carrying a second, parallel notion of how common a word is.
 */
export function catalogEntryFrequencyWeight(entry: CatalogEntry): number {
  const projected = entry.commonnessBase?.selectionWeight;
  if (projected === undefined) return 1;
  if (!Number.isFinite(projected) || projected <= 0 || projected > 1) {
    throw new RangeError(`invalid commonness selection weight for ${entry.id}`);
  }
  return projected;
}
