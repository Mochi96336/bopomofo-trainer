import type { CatalogEntry, TokenId } from "../core/model.js";
import type { CatalogPartition } from "./types.js";

/**
 * Canonical adjacency from a reviewed syllable representation.
 *
 * This is linguistic/catalog structure. It says nothing about which physical
 * keys a learner pressed consecutively and must never be used as motor timing
 * evidence.
 */
export interface StructuralAdjacencyOccurrence {
  readonly kind: "structural-adjacency";
  readonly entryId: string;
  readonly syllableIndex: number;
  readonly fromCanonicalTokenIndex: number;
  readonly fromToken: TokenId;
  readonly toToken: TokenId;
  readonly partition: CatalogPartition;
}

export interface StructuralAdjacencyIndex {
  readonly occurrences: Readonly<Record<string, readonly StructuralAdjacencyOccurrence[]>>;
}

export function structuralAdjacencyKey(fromToken: TokenId, toToken: TokenId): string {
  return JSON.stringify(["structural-adjacency", fromToken, toToken]);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function indexStructuralAdjacencies(
  entries: readonly CatalogEntry[],
  partitionByEntryId: Readonly<Record<string, CatalogPartition>>,
): StructuralAdjacencyIndex {
  const byKey = new Map<string, StructuralAdjacencyOccurrence[]>();
  const seenEntryIds = new Set<string>();

  for (const entry of [...entries].sort((left, right) => compareText(left.id, right.id))) {
    if (seenEntryIds.has(entry.id)) throw new Error(`duplicate catalog entry id: ${entry.id}`);
    seenEntryIds.add(entry.id);
    const partition = partitionByEntryId[entry.id];
    if (partition === undefined) throw new Error(`missing catalog partition for entry: ${entry.id}`);

    entry.syllables.forEach((syllable, syllableIndex) => {
      for (let index = 0; index + 1 < syllable.tokens.length; index += 1) {
        const fromToken = syllable.tokens[index]!;
        const toToken = syllable.tokens[index + 1]!;
        const occurrence: StructuralAdjacencyOccurrence = {
          kind: "structural-adjacency",
          entryId: entry.id,
          syllableIndex,
          fromCanonicalTokenIndex: index,
          fromToken,
          toToken,
          partition,
        };
        const key = structuralAdjacencyKey(fromToken, toToken);
        byKey.set(key, [...(byKey.get(key) ?? []), occurrence]);
      }
    });
  }

  for (const entryId of Object.keys(partitionByEntryId)) {
    if (!seenEntryIds.has(entryId)) {
      throw new Error(`catalog partition references unknown entry: ${entryId}`);
    }
  }

  return {
    occurrences: Object.fromEntries(
      [...byKey.entries()].sort(([left], [right]) => compareText(left, right)),
    ),
  };
}
