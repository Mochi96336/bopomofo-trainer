import { lexicalCompatibilityMultiplier, dependencyCompatibilityScore, type LexicalCompatibilityIndex } from "../compatibility/lexical-pairs.js";
import type { CatalogEntry } from "../core/model.js";
import type { StructuralCompatibilityEdge } from "../syntax/compatibility-edges.js";

export interface DependencyCompatibilityContext {
  readonly currentSlotId: string;
  readonly selectedEntriesBySlotId: ReadonlyMap<string, CatalogEntry>;
  readonly edges: readonly StructuralCompatibilityEdge[];
}

/**
 * Apply positive-only corpus boosts for structural dependency pairs whose other
 * endpoint has already been selected. Missing pair evidence remains neutral.
 *
 * Multiple independently observed structural edges multiply their soft boosts;
 * this affects ranking only and never changes syntax legality or reachability.
 */
export function structuralDependencyCompatibilityMultiplier(
  index: LexicalCompatibilityIndex | undefined,
  candidate: CatalogEntry,
  context: DependencyCompatibilityContext,
  maximumBoost: number,
): number {
  if (index === undefined) return 1;
  let multiplier = 1;
  for (const edge of context.edges) {
    let head: CatalogEntry | undefined;
    let dependent: CatalogEntry | undefined;
    if (edge.headSlotId === context.currentSlotId) {
      head = candidate;
      dependent = context.selectedEntriesBySlotId.get(edge.dependentSlotId);
    } else if (edge.dependentSlotId === context.currentSlotId) {
      head = context.selectedEntriesBySlotId.get(edge.headSlotId);
      dependent = candidate;
    } else {
      continue;
    }
    if (head === undefined || dependent === undefined) continue;
    const score = dependencyCompatibilityScore(
      index,
      head.prompt.text,
      dependent.prompt.text,
      edge.relation,
    );
    multiplier *= lexicalCompatibilityMultiplier(score, maximumBoost);
  }
  return multiplier;
}
