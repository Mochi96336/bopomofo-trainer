import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import { compileExerciseInputPlan } from "../../src/practice/input-plan.js";
import { createInteractionSessionV2 } from "../../src/practice/interaction-session-v2.js";
import {
  auditAttestedTargetContextCoverage,
  buildAttestedFocusExercisePrototype,
  targetCandidatesForAttestedContext,
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
  it("can select a target without requiring every other source token to be in the catalog", () => {
    const result = targetCandidatesForAttestedContext(sentence, 9, entries, profiles);
    expect(result).toHaveLength(2);
    expect(result.map(x => x.focusEntryId)).toEqual([he.id, eats.id]);
    expect(result[1]).toMatchObject({
      sourceSentenceIndex: 9, sourceTokenId: 2, tokenIndex: 1,
      focusText: "吃", sourceTokenForms: ["他", "吃", "未知菜名", "。"],
    });
  });

  it("grades only the chosen target, not the surrounding unscored sentence", () => {
    const targets = targetCandidatesForAttestedContext(sentence, 9, entries, profiles);
    const focus = buildAttestedFocusExercisePrototype(targets[1]!, entries);
    expect(focus.sourceContext.sourceTokenForms).toEqual(["他", "吃", "未知菜名", "。"]);
    expect(focus.exercise.entries.map(e => e.id)).toEqual([eats.id]);
    expect(compileExerciseInputPlan(focus.exercise).syllables.map(x => x.entryId))
      .toEqual([eats.id]);
    expect(createInteractionSessionV2(focus.exercise, 0).plan.totalSlots)
      .toBe(eats.syllables[0]!.tokens.length);
    expect(() => buildAttestedFocusExercisePrototype({
      ...targets[1]!, focusText: "飯",
    }, entries)).toThrow("token boundary");
    expect(() => buildAttestedFocusExercisePrototype(
      targets[1]!, [...entries, entry("吃", "ㄔ2")],
    )).toThrow("no longer unique");
  });

  it("will not derive an ambiguous pronunciation from the corpus UPOS", () => {
    const anotherReading = entry("吃", "ㄔ2");
    const words = [...entries, anotherReading];
    const types = [...profiles, profile(anotherReading, "VERB")];
    expect(targetCandidatesForAttestedContext(sentence, 9, words, types)
      .map(x => x.focusText)).toEqual(["他"]);
    const report = auditAttestedTargetContextCoverage([sentence], words, types,
      { minLexicalTokens: 3, maxLexicalTokens: 8 });
    expect(report.skippedTargetTokens.ambiguousCatalogIdentity).toBe(1);
    expect(report.eligibleContextCount).toBe(1);
  });

  it("rejects an unsupported target UPOS without denying other ungraded context words", () => {
    const wrong = sentence.map(t => t.id === 2 ? { ...t, upos: "ADJ" } : t);
    const targets = targetCandidatesForAttestedContext(wrong, 3, entries, profiles);
    expect(targets.map(x => x.focusText)).toEqual(["他"]);
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
