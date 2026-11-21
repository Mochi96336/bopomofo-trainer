import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import {
  auditAttestedSentenceEligibility, catalogIdentityIndex, catalogUposIndex,
  classifyAttestedSentence,
} from "../../src/curriculum/attested-sentence-candidates.js";

function entry(text: string, reading: string): CatalogEntry {
  return {
    id: "word:" + text + ":" + reading,
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄅ", "tone:1"] }],
    tags: [], provenanceIds: [],
  };
}
function profile(e: CatalogEntry, upos: RuntimeSyntaxProfile["upos"]): RuntimeSyntaxProfile {
  return {
    id: e.id + "#" + upos, entryId: e.id, upos,
    functions: [], valencyFrames: [],
    dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
    provenanceIds: [],
  };
}
function token(id: number, form: string, upos: string): UdOccurrenceToken {
  return { id, form, upos, feats: "_", head: 0, relation: "root" };
}
const subject = entry("我", "ㄨㄛ3");
const verb = entry("吃", "ㄔ1");
const object = entry("飯", "ㄈㄢ4");
const catalog = [subject, verb, object];
const profiles = [profile(subject, "PRON"), profile(verb, "VERB"), profile(object, "NOUN")];
const sentence = [token(1, "我", "PRON"), token(2, "吃", "VERB"), token(3, "飯", "NOUN"), token(4, "。", "PUNCT")];
const decide = (
  tokens: readonly UdOccurrenceToken[],
  entries: readonly CatalogEntry[] = catalog,
  syntaxProfiles: readonly RuntimeSyntaxProfile[] = profiles,
) => classifyAttestedSentence(tokens, 7, catalogIdentityIndex(entries), catalogUposIndex(syntaxProfiles));

describe("attested sentence identity coverage (research-only)", () => {
  it("recovers every original token and exact selected catalog identity", () => {
    expect(decide(sentence)).toEqual({
      kind: "candidate",
      candidate: {
        sourceSentenceIndex: 7, text: "我吃飯。",
        entryIds: [subject.id, verb.id, object.id],
        lexicalTokens: ["我", "吃", "飯"],
      },
    });
  });

  it("refuses guessed heteronym readings even if syntax POS suggests one", () => {
    const eatingOtherReading = entry("吃", "ㄔ2");
    const verdict = decide(sentence, [...catalog, eatingOtherReading], [...profiles, profile(eatingOtherReading, "VERB")]);
    expect(verdict).toEqual({ kind: "excluded", reason: "ambiguous-reading" });
  });

  it("refuses to hallucinate identities for unseen or split words", () => {
    expect(decide([token(1, "我", "PRON"), token(2, "吃飯", "VERB"), token(3, "飯", "NOUN")]))
      .toEqual({ kind: "excluded", reason: "unknown-surface" });
    expect(decide([token(1, "我", "PRON"), token(2, "吃", "NOUN"), token(3, "飯", "NOUN")]))
      .toEqual({ kind: "excluded", reason: "not-verbal-clause" });
    expect(decide([token(1, "我", "PRON"), token(2, "吃", "VERB"), token(3, "飯", "VERB")]))
      .toEqual({ kind: "excluded", reason: "incompatible-upos" });
  });

  it("rejects comma-ended and comma-prefixed source fragments, not full stops", () => {
    expect(decide([token(1, "我", "PRON"), token(2, "吃", "VERB"), token(3, "飯", "NOUN"), token(4, "，", "PUNCT")]))
      .toEqual({ kind: "excluded", reason: "nonterminal-punctuation" });
    expect(decide([token(1, "，", "PUNCT"), token(2, "我", "PRON"), token(3, "吃", "VERB"), token(4, "飯", "NOUN")]))
      .toEqual({ kind: "excluded", reason: "nonterminal-punctuation" });
    expect(decide(sentence).kind).toBe("candidate");
  });

  it("does not bridge punctuation, sentences, or arbitrary noun phrases", () => {
    expect(decide([token(1, "我", "PRON"), token(2, "，", "PUNCT"), token(3, "吃", "VERB"), token(4, "飯", "NOUN")]))
      .toEqual({ kind: "excluded", reason: "internal-punctuation" });
    expect(decide([token(1, "吃", "VERB"), token(2, "飯", "NOUN")]))
      .toEqual({ kind: "excluded", reason: "too-short-or-long" });
  });

  it("keeps full-text eligibility accounting separate from labels and correctness", () => {
    const report = auditAttestedSentenceEligibility([
      sentence,
      sentence.map(x => x.form === "飯" ? { ...x, form: "未知" } : x),
      [token(1, "我", "PRON"), token(2, "吃", "VERB"), token(3, "飯", "NOUN"), token(4, "，", "PUNCT"), token(5, "我", "PRON")],
    ], catalog, profiles);
    expect(report.sentenceCount).toBe(3);
    expect(report.eligibleCount).toBe(1);
    expect(report.candidateIndices).toEqual([0]);
    expect(report.excluded["unknown-surface"]).toBe(1);
    expect(report.excluded["internal-punctuation"]).toBe(1);
    expect(Object.values(report.excluded).reduce((a, b) => a + b, 0)).toBe(2);
  });
});
