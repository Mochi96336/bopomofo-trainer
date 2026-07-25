import { catalogCommonnessTiers, type CommonnessTier } from "../commonness/tiers.js";
import type { CatalogEntry, TokenId } from "../core/model.js";
import type { CatalogSupportIndex, CatalogTokenSupport } from "./types.js";

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

interface EntryTokenContexts {
  readonly all: ReadonlySet<TokenId>;
  readonly binding: ReadonlySet<TokenId>;
  readonly motor: ReadonlySet<TokenId>;
}

export function entryTokenContexts(entry: CatalogEntry): EntryTokenContexts {
  const all = new Set<TokenId>();
  const binding = new Set<TokenId>();
  const motor = new Set<TokenId>();

  for (let syllableIndex = 0; syllableIndex < entry.syllables.length; syllableIndex += 1) {
    const syllable = entry.syllables[syllableIndex]!;
    for (let tokenIndex = 0; tokenIndex < syllable.tokens.length; tokenIndex += 1) {
      const tokenId = syllable.tokens[tokenIndex]!;
      all.add(tokenId);
      const entryBoundary = syllableIndex === 0 && tokenIndex === 0;
      if (!entryBoundary) binding.add(tokenId);
      if (tokenIndex > 0) motor.add(tokenId);
    }
  }

  return { all, binding, motor };
}

export function entryTokenSet(entry: CatalogEntry): ReadonlySet<TokenId> {
  return entryTokenContexts(entry).all;
}

interface TokenSupportAccumulator {
  readonly entryIds: string[];
  readonly bindingEntryIds: string[];
  readonly motorEntryIds: string[];
  readonly commonnessTierCounts: Record<CommonnessTier, number>;
  commonBindingEntryCount: number;
  commonMotorEntryCount: number;
}

export function createCatalogSupportIndex(entries: readonly CatalogEntry[]): CatalogSupportIndex {
  const entriesById: Record<string, CatalogEntry> = {};
  for (const entry of entries) {
    if (entriesById[entry.id] !== undefined) {
      throw new Error(`duplicate catalog entry id: ${entry.id}`);
    }
    entriesById[entry.id] = entry;
  }
  const tiers = catalogCommonnessTiers(entries);

  // Visiting the catalog in entry-id order leaves every per-token list sorted
  // without a sort of its own. Sorting each list separately instead meant one
  // comparator-driven sort per token per context -- three passes over roughly
  // 80,000 ids on the real catalog -- which dominated building this index, and
  // the index is rebuilt whenever the practised levels change.
  const ordered = [...entries].sort((left, right) => codeUnitCompare(left.id, right.id));

  const accumulators = new Map<TokenId, TokenSupportAccumulator>();
  const accumulatorFor = (tokenId: TokenId): TokenSupportAccumulator => {
    const existing = accumulators.get(tokenId);
    if (existing !== undefined) return existing;
    const created: TokenSupportAccumulator = {
      entryIds: [],
      bindingEntryIds: [],
      motorEntryIds: [],
      commonnessTierCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
      commonBindingEntryCount: 0,
      commonMotorEntryCount: 0,
    };
    accumulators.set(tokenId, created);
    return created;
  };

  for (const entry of ordered) {
    const contexts = entryTokenContexts(entry);
    const tier = tiers.get(entry.id)!;
    const common = tier === 1;
    for (const tokenId of contexts.all) {
      const accumulator = accumulatorFor(tokenId);
      accumulator.entryIds.push(entry.id);
      accumulator.commonnessTierCounts[tier] += 1;
    }
    for (const tokenId of contexts.binding) {
      const accumulator = accumulatorFor(tokenId);
      accumulator.bindingEntryIds.push(entry.id);
      if (common) accumulator.commonBindingEntryCount += 1;
    }
    for (const tokenId of contexts.motor) {
      const accumulator = accumulatorFor(tokenId);
      accumulator.motorEntryIds.push(entry.id);
      if (common) accumulator.commonMotorEntryCount += 1;
    }
  }

  const byToken: Record<string, CatalogTokenSupport> = {};
  for (const tokenId of [...accumulators.keys()].sort(codeUnitCompare)) {
    const accumulator = accumulators.get(tokenId)!;
    byToken[tokenId] = {
      tokenId,
      entryIds: accumulator.entryIds,
      entryCount: accumulator.entryIds.length,
      bindingEntryIds: accumulator.bindingEntryIds,
      bindingEntryCount: accumulator.bindingEntryIds.length,
      motorEntryIds: accumulator.motorEntryIds,
      motorEntryCount: accumulator.motorEntryIds.length,
      commonEntryCount: accumulator.commonnessTierCounts[1],
      commonBindingEntryCount: accumulator.commonBindingEntryCount,
      commonMotorEntryCount: accumulator.commonMotorEntryCount,
      commonnessTierCounts: accumulator.commonnessTierCounts,
    };
  }

  return { byToken, entriesById };
}
