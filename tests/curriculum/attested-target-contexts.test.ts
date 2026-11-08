import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import {
  auditAttestedTargetContextCoverage,
} from "../../src/curriculum/attested-target-contexts.js";

function entry(text: string, reading: string): CatalogEntry {
  return {
    id: `word:${text}:${reading}`,
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄅ", "tone:1"] }],
    tags: [], provenanceIds: [],
  };
}
function profile(word: CatalogEntry, upos: RuntimeSyntaxProfile["upos"]): RuntimeSyntaxProfile {
  return {
    id: `${word.id}:${upos}`, entryId: word.id, upos,
    functions: [], valencyFrames: [],
    dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
    provenanceIds: [],
  };
}
function token(id: number, form: string, upos: string): UdOccurrenceToken {
  return { id, form, upos, feats: "_", head: 0, relation: "root" };
}
const eats = entry("吃", "ㄔ1");
const he = entry("他", "ㄊㄚ1");
const thing = entry("飯", "ㄈㄢ4");
const entries = [he, eats, thing];
const profiles = [profile(he, "PRON"), profile(eats, "VERB"), profile(thing, "NOUN")];
const sentence = [token(1, "他", "PRON"), token(2, "吃", "VERB"),
  token(3, "未知菜名", "NOUN"), token(4, "。", "PUNCT")];

describe("source context vs graded entry identity", () => {
  it("will not derive an ambiguous pronunciation from the corpus UPOS", () => {
    const anotherReading = entry("吃", "ㄔ2");
    const words = [...entries, anotherReading];
    const types = [...profiles, profile(anotherReading, "VERB")];
    const report = auditAttestedTargetContextCoverage([sentence], words, types,
      { minLexicalTokens: 3, maxLexicalTokens: 8 });
    expect(report.skippedTargetTokens.ambiguousCatalogIdentity).toBe(1);
    expect(report.eligibleContextCount).toBe(1);
  });

  it("rejects an unsupported target UPOS without denying other ungraded context words", () => {
    const wrong = sentence.map(t =>
      t.id === 2 ? { ...t, upos: "ADJ" }
        : t.id === 3 ? { ...t, upos: "VERB" } : t,
    );
    const report = auditAttestedTargetContextCoverage([wrong], entries, profiles, {
      minLexicalTokens: 3, maxLexicalTokens: 8,
    });
    // The supported PRON may still be focused; the ADJ is never mistaken
    // for the cataloged verb even though another token forms a verbal clause.
    expect(report.eligibleContextCount).toBe(1);
    expect(report.focusOccurrences).toBe(1);
    expect(report.skippedTargetTokens.unsupportedUpos).toBe(1);
  });

  it("counts unique context sentences and target occurrences separately", () => {
    const report = auditAttestedTargetContextCoverage([
      sentence,
      [token(1, "未知", "NOUN"), token(2, "執行", "VERB"), token(3, "過程", "NOUN")],
      [token(1, "他", "PRON"), token(2, "吃", "VERB"), token(3, "飯", "NOUN")],
    ], entries, profiles, { minLexicalTokens: 3, maxLexicalTokens: 8 });
    expect(report.sentenceCount).toBe(3);
    expect(report.consideredShortVerbalContexts).toBe(3);
    expect(report.eligibleContextCount).toBe(2);
    expect(report.focusOccurrences).toBe(5);
    expect(report.uniqueFocusEntryCount).toBe(3);
    expect(report.skippedTargetTokens.absentFromCatalog).toBe(4);
    expect(() => auditAttestedTargetContextCoverage([sentence], entries, profiles,
      { minLexicalTokens: 8, maxLexicalTokens: 3 })).toThrow("invalid context token window");
  });
});
