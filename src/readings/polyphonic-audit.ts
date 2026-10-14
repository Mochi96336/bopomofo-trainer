import type { CatalogEntry } from "../core/model.js";
import type { GrammarUtteranceCandidate } from "../grammar/types.js";
import type { RuntimeSyntaxProfile, SyntacticFunction, Upos } from "../syntax/types.js";

/**
 * A written form is ambiguous when the *active catalog* has distinct reading
 * identities for that exact form. Multi-character entries are atomic here:
 * an occurrence of 東西 is not inferred from separate 東 and 西 entries.
 */
export function buildPolyphonicReadingIndex(
  entries: readonly CatalogEntry[],
): ReadonlyMap<string, readonly string[]> {
  const readingsByText = new Map<string, Set<string>>();
  for (const entry of entries) {
    const text = entry.prompt.text;
    const readings = readingsByText.get(text) ?? new Set<string>();
    readings.add(entry.id);
    readingsByText.set(text, readings);
  }
  return new Map(
    [...readingsByText.entries()]
      .filter(([, ids]) => ids.size > 1)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([text, ids]): readonly [string, readonly string[]] => [text, [...ids].sort()]),
  );
}

export interface PolyphonicContextHit {
  readonly seedIndex: number;
  readonly sentence: string;
  readonly punctuation: string | null;
  readonly syntaxRootRuleId: string | null;
  /** Position within the selected lexical entries, not a Hanzi character offset. */
  readonly entryIndex: number;
  readonly text: string;
  readonly selectedEntryId: string;
  readonly selectedProfileId: string | null;
  readonly selectedUpos: Upos | null;
  readonly selectedFunctions: readonly SyntacticFunction[];
  readonly alternativeEntryIds: readonly string[];
  readonly previousEntryText: string | null;
  readonly nextEntryText: string | null;
}

/**
 * Exposure != error. This captures actual generated reading identities and
 * immediate lexical neighbors for later manual/model evaluation; it does not
 * infer a pronunciation or claim that a particular usage is incorrect.
 */
export function auditPolyphonicCandidate(
  seedIndex: number,
  candidate: GrammarUtteranceCandidate,
  index: ReadonlyMap<string, readonly string[]>,
  profilesById?: ReadonlyMap<string, RuntimeSyntaxProfile>,
): readonly PolyphonicContextHit[] {
  const hits: PolyphonicContextHit[] = [];
  for (let entryIndex = 0; entryIndex < candidate.entries.length; entryIndex += 1) {
    const entry = candidate.entries[entryIndex]!;
    const readingIds = index.get(entry.prompt.text);
    if (readingIds === undefined) continue;
    if (!readingIds.includes(entry.id)) {
      throw new Error("candidate reading is absent from audit catalog: " + entry.id);
    }
    const profileId = candidate.syntaxProfileIds?.[entryIndex] ?? null;
    const profile = profileId === null ? undefined : profilesById?.get(profileId);
    if (profileId !== null && profilesById !== undefined && profile === undefined) {
      throw new Error("candidate syntax profile is absent from audit profiles: " + profileId);
    }
    if (profile !== undefined && profile.entryId !== entry.id) {
      throw new Error("candidate profile and reading identity disagree: " + entry.id);
    }
    hits.push({
      seedIndex,
      sentence: candidate.text,
      punctuation: candidate.punctuation,
      syntaxRootRuleId: candidate.syntaxRootRuleId ?? null,
      entryIndex,
      text: entry.prompt.text,
      selectedEntryId: entry.id,
      selectedProfileId: profileId,
      selectedUpos: profile?.upos ?? null,
      selectedFunctions: profile?.functions ?? [],
      alternativeEntryIds: readingIds.filter((id) => id !== entry.id),
      previousEntryText: candidate.entries[entryIndex - 1]?.prompt.text ?? null,
      nextEntryText: candidate.entries[entryIndex + 1]?.prompt.text ?? null,
    });
  }
  return hits;
}
