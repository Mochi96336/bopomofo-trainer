import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { reviewedAdjectiveReadingEligible } from "../../src/readings/adjective-role-license.js";
import { reviewedRoleReadingEligible } from "../../src/readings/pronominal-role-license.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import type { ProductionRule } from "../../src/syntax/types.js";
import type { RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

function entry(text: string, reading: string): CatalogEntry {
  return {
    id: catalogEntryId(text, reading),
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄏ", "tone:3"] }],
    tags: ["test"],
    provenanceIds: ["test"],
  };
}

function profile(item: CatalogEntry, upos: Upos): RuntimeSyntaxProfile {
  return {
    id: item.id + "/" + upos,
    entryId: item.id,
    upos,
    functions: ["predicate"],
    valencyFrames: ["avalent"],
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

describe("reviewed standalone 好 as adjective (productive gate)", () => {
  const good = entry("好", "ㄏㄠ3");
  const fond = entry("好", "ㄏㄠ4");

  it("keeps only ㄏㄠ3 when standalone 好 fills the adjective slot", () => {
    expect(reviewedAdjectiveReadingEligible(good, profile(good, "ADJ"))).toBe(true);
    expect(reviewedAdjectiveReadingEligible(fond, profile(fond, "ADJ"))).toBe(false);
    expect(reviewedRoleReadingEligible(good, profile(good, "ADJ"))).toBe(true);
    expect(reviewedRoleReadingEligible(fond, profile(fond, "ADJ"))).toBe(false);
  });

  it("does not globally suppress fondness reading or whole-word compounds", () => {
    for (const role of ["VERB", "NOUN", "ADV", "X"] as Upos[]) {
      expect(reviewedRoleReadingEligible(fond, profile(fond, role))).toBe(true);
    }
    const loveLearning = entry("好學", "ㄏㄠ4-ㄒㄩㄝ2");
    expect(reviewedRoleReadingEligible(loveLearning, profile(loveLearning, "ADJ"))).toBe(true);
  });

  it("preserves the already-active other role restrictions", () => {
    const wrong = entry("和", "ㄏㄨㄛ4");
    const right = entry("和", "ㄏㄜ2");
    expect(reviewedRoleReadingEligible(wrong, profile(wrong, "CCONJ"))).toBe(false);
    expect(reviewedRoleReadingEligible(right, profile(right, "CCONJ"))).toBe(true);
  });

  it("keeps the learner's written word instead of redrawing an unrelated word", () => {
    const he = entry("他", "ㄊㄚ1");
    const wrong = entry("好", "ㄏㄠ4");
    const correct = entry("好", "ㄏㄠ3");
    const unrelated = entry("壞", "ㄏㄨㄞ4");
    const rule: ProductionRule = {
      id: "sentence.keep-licensed-lexeme",
      grammarVersion: FORMAL_GRAMMAR_VERSION,
      output: "Sentence",
      constituents: [
        {
          key: "subject", category: "Lexeme", minimum: 1, maximum: 1,
          recursive: false, allowedUpos: ["PRON"], requiredFunctions: ["subject"],
          requiredValencyFrames: [], requiredFeatures: {},
        },
        {
          key: "predicate", category: "Lexeme", minimum: 1, maximum: 1,
          recursive: false, allowedUpos: ["ADJ"], requiredFunctions: ["predicate"],
          requiredValencyFrames: [], requiredFeatures: {},
        },
      ],
      surfaceOrders: [{ id: "canonical", constituentKeys: ["subject", "predicate"] }],
      constraints: [],
      positiveFixtureIds: ["yes"],
      negativeFixtureIds: ["no"],
    };
    const common = {
      eligibleEntries: [he, wrong, unrelated, correct],
      profiles: [
        { ...profile(he, "PRON"), functions: ["subject" as const] },
        profile(wrong, "ADJ"),
        profile(unrelated, "ADJ"),
        profile(correct, "ADJ"),
      ],
      rules: [rule],
      samplingMode: "raw" as const,
      random: { next: () => 0 },
      minimumLexicalEntries: 2,
      maximumCandidates: 1,
      maximumAttempts: 8,
    };
    const baseline = composeFormalSyntaxUtterances(common).candidates[0]!;
    const reviewed = composeFormalSyntaxUtterances({
      ...common,
      readingEligibility: reviewedRoleReadingEligible,
    }).candidates[0]!;
    // Before gating the draw chose the wrong reading for the correct surface.
    expect(baseline.entries.map((item) => item.id)).toEqual([he.id, wrong.id]);
    // The next global licensed candidate is "壞"; it must not replace "好".
    expect(reviewed.entries.map((item) => item.id)).toEqual([he.id, correct.id]);
    expect(reviewed.text).toBe(baseline.text);
    expect(reviewed.id).not.toBe(baseline.id);
  });

  it("does not infer a reading from a mismatched entry/profile join", () => {
    expect(() => reviewedAdjectiveReadingEligible(good, profile(fond, "ADJ")))
      .toThrow("actually selected catalog identity");
  });
});
