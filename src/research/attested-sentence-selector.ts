import type { CatalogEntry, RandomSource, TokenId } from "../core/model.js";
import type { LearnerBindingEvidence } from "../curriculum/types.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  scoreFrequencyFirstEntry,
  type UtteranceSelectionHistory,
} from "../curriculum/frequency-first-utterance.js";
import { weightedPick } from "../curriculum/random.js";

/**
 * Corpus-attested sentence, with a dictionary-verified reading for exactly
 * ONE marked character. We do not assert the rest of the sentence is
 * phonologically annotated or independently judged natural.
 */
export interface AttestedPolyphoneCase {
  readonly id: string;
  readonly character: string;
  readonly lexeme: string;
  readonly targetCharIndex: number;
  readonly expectedZhuyin: string;
  readonly expectedTokens: readonly TokenId[];
  readonly sentence: string;
  readonly moeWordUrl: string;
  readonly ud: {
    readonly split: "train" | "dev" | "test";
    readonly sentId: string;
    readonly sourceTokenUpos: string;
    /** Source-provided machine transliteration: deliberately NOT ground truth. */
    readonly rawTranslitUntrusted: string;
  };
  readonly annotation: {
    readonly targetReading: "dictionary_lexeme_verified";
    readonly completeSentenceReadings: "unreviewed";
    readonly naturalness: "corpus_attested_not_independently_rated";
  };
}

export interface AttestedPolyphoneBank {
  readonly schemaVersion: "attested-polyphone-candidate-pilot-v1";
  readonly cases: readonly AttestedPolyphoneCase[];
}

function isZhuyinToken(token: string): boolean {
  return /^zhuyin:[ㄅ-ㄩ]$/u.test(token);
}

/** Fail closed on forged text/reading joins before putting a sentence in any draw. */
export function validateAttestedPolyphoneBank(bank: AttestedPolyphoneBank): void {
  if (bank.schemaVersion !== "attested-polyphone-candidate-pilot-v1"
    || bank.cases.length < 4) throw new Error("missing/invalid attested pilot schema");
  const ids = new Set<string>();
  const readingByCharacter = new Map<string, Set<string>>();
  for (const item of bank.cases) {
    if (!item.id || ids.has(item.id)) throw new Error("duplicate or empty corpus case ID");
    ids.add(item.id);
    if (item.character.length !== 1
      || !Number.isInteger(item.targetCharIndex)
      || item.lexeme[item.targetCharIndex] !== item.character) {
      throw new Error("polyphone target is not a verified character in the supplied lexeme: " + item.id);
    }
    if (item.sentence.indexOf(item.lexeme) < 0
      || item.sentence.indexOf(item.lexeme) !== item.sentence.lastIndexOf(item.lexeme)) {
      throw new Error("target lexeme must occur exactly once in original source text: " + item.id);
    }
    if (!item.ud.sentId.startsWith(item.ud.split + "-s")
      || item.annotation.targetReading !== "dictionary_lexeme_verified"
      || item.annotation.completeSentenceReadings !== "unreviewed"
      || item.annotation.naturalness !== "corpus_attested_not_independently_rated"
      || !item.moeWordUrl.startsWith("https://dict.revised.moe.edu.tw/dictView.jsp?ID=")) {
      throw new Error("source provenance or reading review boundary missing: " + item.id);
    }
    if (!/^[ㄅ-ㄩ]+[1-5]$/u.test(item.expectedZhuyin)
      || item.expectedTokens.filter(t => t.startsWith("tone:")).length !== 1
      || !item.expectedTokens.includes("tone:" + item.expectedZhuyin.at(-1))
      || item.expectedTokens.filter(isZhuyinToken).length + 1 !== item.expectedTokens.length) {
      throw new Error("invalid target Zhuyin decomposition: " + item.id);
    }
    const expectedComponents = [...item.expectedZhuyin.slice(0, -1)]
      .map(char => "zhuyin:" + char);
    if (expectedComponents.join("|") !== item.expectedTokens.filter(t => t.startsWith("zhuyin:")).join("|")) {
      throw new Error("target Zhuyin tokens do not match the reviewed reading: " + item.id);
    }
    const set = readingByCharacter.get(item.character) ?? new Set<string>();
    set.add(item.expectedZhuyin);
    readingByCharacter.set(item.character, set);
  }
  if ([...readingByCharacter.values()].some(readings => readings.size < 2)) {
    throw new Error("the contrast corpus must exhibit real different readings of each character");
  }
}

/**
 * This projection deliberately exposes ONLY the one dictionary-reviewed
 * target syllable to the existing production scorer. It is NOT a complete
 * word/sentence pronunciation transcription and must not be shipped as an
 * Exercise until whole-sentence annotation is complete.
 */
export function attestedCaseTargetEntry(item: AttestedPolyphoneCase): CatalogEntry {
  return {
    id: "attested:" + item.id + ":" + item.expectedZhuyin,
    prompt: { text: item.lexeme, locale: "zh-TW" },
    syllables: [{ tokens: [...item.expectedTokens] }],
    tags: ["attested-research-only", "target-syllable-only"],
    provenanceIds: [item.ud.split + ":" + item.ud.sentId, item.moeWordUrl],
  };
}

export interface AttestedSentenceScore {
  readonly id: string;
  readonly sentence: string;
  readonly targetLexeme: string;
  readonly targetChar: string;
  readonly expectedZhuyin: string;
  readonly expectedTokens: readonly TokenId[];
  readonly weight: number;
}

export interface AttestedSentenceDraw {
  readonly selected: AttestedSentenceScore;
  readonly candidates: readonly AttestedSentenceScore[];
}

/**
 * Stage 1: independent approved target readings, immutable.
 * Stage 2: weight the already-approved alternatives with exactly the
 * production's per-entry frequency/learner-error scoring primitive.
 * NOTE: baseline commonness here is 1 for all entries; a future reviewed
 * corpus-specific commonness mapping would be a separate experiment.
 */
export function selectAttestedSentence(
  bank: AttestedPolyphoneBank,
  bindingEvidence: readonly LearnerBindingEvidence[],
  random: RandomSource,
  recentEntryIds: readonly string[] = [],
): AttestedSentenceDraw {
  validateAttestedPolyphoneBank(bank);
  const history: UtteranceSelectionHistory = {
    recentEntryIds,
    recentUtteranceIds: [],
    recentTemplateIds: [],
  };
  const candidates: AttestedSentenceScore[] = bank.cases.map(item => {
    const entry = attestedCaseTargetEntry(item);
    const score = scoreFrequencyFirstEntry(entry, {
      entries: [entry],
      bindingEvidence,
      mode: "guided",
      layoutId: "standard",
      history,
      policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
    });
    return {
      id: item.id,
      sentence: item.sentence,
      targetLexeme: item.lexeme,
      targetChar: item.character,
      expectedZhuyin: item.expectedZhuyin,
      expectedTokens: item.expectedTokens,
      weight: score.totalWeight,
    };
  });
  return {
    selected: weightedPick(candidates.map(c => ({ value: c, weight: c.weight })), random),
    candidates,
  };
}
