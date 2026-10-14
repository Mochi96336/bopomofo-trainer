import type { CatalogEntry } from "../core/model.js";
import type { GrammarUtteranceCandidate } from "../grammar/types.js";

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
      .map(([text, ids]) => [text, [...ids].sort()]),
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
): readonly PolyphonicContextHit[] {
  const hits: PolyphonicContextHit[] = [];
  for (let entryIndex = 0; entryIndex < candidate.entries.length; entryIndex += 1) {
    const entry = candidate.entries[entryIndex]!;
    const readingIds = index.get(entry.prompt.text);
    if (readingIds === undefined) continue;
    if (!readingIds.includes(entry.id)) {
      throw new Error("candidate reading is absent from audit catalog: " + entry.id);
    }
    hits.push({
      seedIndex,
      sentence: candidate.text,
      punctuation: candidate.punctuation,
      syntaxRootRuleId: candidate.syntaxRootRuleId ?? null,
      entryIndex,
      text: entry.prompt.text,
      selectedEntryId: entry.id,
      alternativeEntryIds: readingIds.filter((id) => id !== entry.id),
      previousEntryText: candidate.entries[entryIndex - 1]?.prompt.text ?? null,
      nextEntryText: candidate.entries[entryIndex + 1]?.prompt.text ?? null,
    });
  }
  return hits;
}
