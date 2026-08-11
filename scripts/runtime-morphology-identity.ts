export interface RuntimeMorphologyIdentityCandidate {
  readonly sourceKey: string;
  readonly entryId: string;
}

export interface RuntimeMorphologyIdentityClassification {
  readonly matchedSourceKeys: ReadonlySet<string>;
  readonly ambiguousSourceKeys: ReadonlySet<string>;
  readonly activatableSourceKeys: ReadonlySet<string>;
}

/**
 * UD morphology is keyed by written form + UPOS, while catalog entries are
 * reading-specific identities. A source key is safe to project only when every
 * active runtime candidate for that key belongs to the same catalog entry.
 * Multiple runtime profiles for one entry remain valid; multiple entry IDs are
 * an unresolved reading ambiguity and therefore fail closed.
 */
export function classifyRuntimeMorphologyIdentityMatches(
  candidates: readonly RuntimeMorphologyIdentityCandidate[],
  sourceEvidenceKeys: ReadonlySet<string>,
): RuntimeMorphologyIdentityClassification {
  const entryIdsBySourceKey = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    if (!sourceEvidenceKeys.has(candidate.sourceKey)) continue;
    const entryIds = entryIdsBySourceKey.get(candidate.sourceKey) ?? new Set<string>();
    entryIds.add(candidate.entryId);
    entryIdsBySourceKey.set(candidate.sourceKey, entryIds);
  }

  const matchedSourceKeys = new Set(entryIdsBySourceKey.keys());
  const ambiguousSourceKeys = new Set<string>();
  const activatableSourceKeys = new Set<string>();
  for (const [sourceKey, entryIds] of entryIdsBySourceKey) {
    if (entryIds.size === 1) activatableSourceKeys.add(sourceKey);
    else ambiguousSourceKeys.add(sourceKey);
  }

  return { matchedSourceKeys, ambiguousSourceKeys, activatableSourceKeys };
}
