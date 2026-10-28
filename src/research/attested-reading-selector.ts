import type { CatalogEntry, RandomSource } from "../core/model.js";
import type { LearnerBindingEvidence } from "../curriculum/types.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  scoreFrequencyFirstEntry,
  type EntrySelectionScore,
} from "../curriculum/frequency-first-utterance.js";
import { weightedPick } from "../curriculum/random.js";

/**
 * Research ONLY: each example is an externally sourced sentence *excerpt*
 * with a separately dictionary-checked pronunciation of ONE target character.
 * Neither full-sentence Zhuyin nor automatic contextual G2P is supplied.
 *
 * "SourceTransliterationUnverified" is deliberately never used to decide
 * labels or token weights; UD GSD's auto transliteration has known errors.
 */
export interface AttestedReadingCase {
  readonly id: string;
  readonly targetCharacter: string;
  readonly excerpt: string;
  readonly targetLexeme: string;
  readonly characterIndexInLexeme: number;
  readonly characterReading: string;
  readonly sense: string;
  readonly source: {
    readonly dataset: "UD_Chinese-GSD";
    readonly repoUrl: string;
    readonly split: "train" | "dev" | "test";
    readonly conlluFile: string;
    readonly blobSha: string;
    readonly sentenceId: string;
    readonly sourceUpos: string;
    readonly sourceTransliterationUnverified: string | null;
  };
  readonly readingEvidence: {
    readonly provider: string;
    readonly url: string;
    readonly assessment: string;
  };
  readonly labelScope: "target_character_only_not_full_sentence";
}

const toneMarks: Readonly<Record<string, string>> = {
  "ˊ": "2",
  "ˇ": "3",
  "ˋ": "4",
  "˙": "5",
};
export function targetReadingTokens(reading: string): readonly string[] {
  if (!/^[ㄅ-ㄩ]+[ˊˇˋ˙]?$/u.test(reading)) {
    throw new Error("expected a single Bopomofo syllable, not whole-word reading: " + reading);
  }
  const segments = [...reading];
  const final = segments[segments.length - 1]!;
  const tone = toneMarks[final] ?? "1";
  const letters = toneMarks[final] ? segments.slice(0, -1) : segments;
  return [...letters.map(letter => "zhuyin:" + letter), "tone:" + tone];
}
export function validateAttestedCases(cases: readonly AttestedReadingCase[]): void {
  if (cases.length < 8) throw new Error("pilot requires at least eight sourced examples");
  const ids = new Set<string>();
  const readingByCharacter = new Map<string, Set<string>>();
  let testCount = 0;
  for (const row of cases) {
    if (ids.has(row.id)) throw new Error("duplicate research example: " + row.id);
    ids.add(row.id);
    if (row.labelScope !== "target_character_only_not_full_sentence"
      || row.source.dataset !== "UD_Chinese-GSD"
      || !["train", "dev", "test"].includes(row.source.split)
      || row.source.conlluFile !== "zh_gsd-ud-" + row.source.split + ".conllu"
      || !/^[0-9a-f]{40}$/u.test(row.source.blobSha)
      || !/^(train|dev|test)-s[0-9]+$/u.test(row.source.sentenceId)
      || !row.readingEvidence.url.startsWith("https://dict.revised.moe.edu.tw/dictView.jsp?")
      || row.readingEvidence.assessment !== "dictionary-anchored/manual-context-mapping") {
      throw new Error("missing independent evidence and corpus provenance: " + row.id);
    }
    const symbols = [...row.targetLexeme];
    if (symbols[row.characterIndexInLexeme] !== row.targetCharacter
      || row.excerpt.indexOf(row.targetLexeme) < 0
      || row.excerpt.indexOf(row.targetLexeme) !== row.excerpt.lastIndexOf(row.targetLexeme)) {
      throw new Error("target word must occur once and contain the target character: " + row.id);
    }
    targetReadingTokens(row.characterReading);
    const readings = readingByCharacter.get(row.targetCharacter) ?? new Set<string>();
    readings.add(row.characterReading);
    readingByCharacter.set(row.targetCharacter, readings);
    if (row.source.split === "test") testCount++;
  }
  if (testCount === 0
    || [...readingByCharacter.values()].some(readings => readings.size < 2)) {
    throw new Error("pilot requires a held-out test split and contrasting readings for each character");
  }
}

/** This is a target-CHARACTER drill; the surrounding excerpt is read-only context. */
export function projectedTargetEntry(row: AttestedReadingCase): CatalogEntry {
  return {
    id: "attested-reading:" + row.id,
    prompt: { text: row.targetCharacter, locale: "zh-TW" },
    syllables: [{ tokens: targetReadingTokens(row.characterReading) }],
    tags: ["research", "attested-target-only", row.sense],
    provenanceIds: [row.source.sentenceId],
  };
}

export interface ScoredAttestedReading {
  readonly example: AttestedReadingCase;
  readonly score: EntrySelectionScore;
  readonly expectedTokens: readonly string[];
}
/**
 * Uses the ACTUAL production scoreFrequencyFirstEntry policy, including
 * minimum attempts and capped learner boosts. Corpus excerpts have NO
 * authorized commonness projection; baseline frequency is uniformly 1.
 *
 * Excludes test split: genuine holdout examples are never used as candidate
 * practice items in this demonstration.
 */
export function scoreAttestedReadingCandidates(
  rows: readonly AttestedReadingCase[],
  bindingEvidence: readonly LearnerBindingEvidence[],
): readonly ScoredAttestedReading[] {
  validateAttestedCases(rows);
  const pool = rows.filter(row => row.source.split !== "test");
  const entries = pool.map(projectedTargetEntry);
  return pool.map((example, index) => {
    const entry = entries[index]!;
    const score = scoreFrequencyFirstEntry(entry, {
      entries,
      bindingEvidence,
      mode: "guided",
      layoutId: "standard",
      history: { recentEntryIds: [], recentUtteranceIds: [], recentTemplateIds: [] },
      policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
    });
    return { example, score, expectedTokens: entry.syllables[0]!.tokens };
  });
}
export function selectAttestedReading(
  scored: readonly ScoredAttestedReading[],
  random: RandomSource,
): ScoredAttestedReading {
  if (scored.length === 0) throw new Error("no curated eligible target-reading candidates");
  return weightedPick(scored.map(row => ({
    value: row,
    weight: row.score.totalWeight,
  })), random);
}
