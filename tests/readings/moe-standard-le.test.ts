import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { reviewedMoeStandardLeReadingEligible } from "../../src/readings/moe-standard-le.js";
import {
  reviewedAdjacentReadingEligible,
  reviewedAdjacentPreDrawReadingEligible,
} from "../../src/readings/reviewed-adjacent-context.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import type { ProductionRule, RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

function entry(text: string, reading: string): CatalogEntry {
  return {
    id: catalogEntryId(text, reading),
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄌ", "tone:4"] }],
    tags: [], provenanceIds: [],
  };
}
function profile(x: CatalogEntry, upos: Upos): RuntimeSyntaxProfile {
  return {
    id: x.id + "/" + upos, entryId: x.id, upos,
    functions: ["predicate"],
    valencyFrames: ["avalent"],
    dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
    provenanceIds: [],
  };
}
const le = entry("了", "ㄌㄜ5");
const liao3 = entry("了", "ㄌㄧㄠ3");
const liao4 = entry("了", "ㄌㄧㄠ4");

describe("MOE Taiwan standard readings for standalone 了", () => {
  it("retains both approved sounds under every role; rejects only unapproved identity", () => {
    for (const upos of ["VERB", "AUX", "NOUN", "PART", "X"] as Upos[]) {
      expect(reviewedMoeStandardLeReadingEligible(le, profile(le, upos))).toBe(true);
      expect(reviewedMoeStandardLeReadingEligible(liao3, profile(liao3, upos))).toBe(true);
      expect(reviewedMoeStandardLeReadingEligible(liao4, profile(liao4, upos))).toBe(false);
    }
    const compound = entry("了解", "ㄌㄧㄠ3 ㄐㄧㄝ3");
    expect(reviewedMoeStandardLeReadingEligible(compound, profile(compound, "VERB"))).toBe(true);
    expect(() => reviewedMoeStandardLeReadingEligible(le, profile(liao4, "VERB")))
      .toThrow("actual selected catalog identity");
  });

  it("blocks unsupported fourth-tone before learner-frequency weights are sampled", () => {
    const subject = entry("幫助", "ㄅㄤ1 ㄓㄨ4");
    const goodOther = entry("能", "ㄋㄥ2");
    const p = (x: CatalogEntry, upos: Upos, fn: "subject" | "predicate") => ({
      ...profile(x, upos), functions: [fn] as const,
    });
    const rule: ProductionRule = {
      id: "sentence.le-source-reading-fixture",
      grammarVersion: FORMAL_GRAMMAR_VERSION,
      output: "Sentence",
      constituents: [
        {
          key: "subject", category: "Lexeme", minimum: 1, maximum: 1,
          recursive: false, allowedUpos: ["NOUN"], requiredFunctions: ["subject"],
          requiredValencyFrames: [], requiredFeatures: {},
        },
        {
          key: "predicate", category: "Lexeme", minimum: 1, maximum: 1,
          recursive: false, allowedUpos: ["VERB"], requiredFunctions: ["predicate"],
          requiredValencyFrames: [], requiredFeatures: {},
        },
      ],
      surfaceOrders: [{ id: "canonical", constituentKeys: ["subject", "predicate"] }],
      constraints: [], positiveFixtureIds: ["yes"], negativeFixtureIds: ["no"],
    };
    const base = {
      eligibleEntries: [subject, le, liao3, liao4, goodOther],
      profiles: [
        p(subject, "NOUN", "subject"),
        p(le, "VERB", "predicate"),
        p(liao3, "VERB", "predicate"),
        p(liao4, "VERB", "predicate"),
        p(goodOther, "VERB", "predicate"),
      ],
      rules: [rule], samplingMode: "raw" as const,
      random: { next: () => 0.5 },
      entryWeightsById: {
        [subject.id]: 1, [le.id]: 1, [liao3.id]: 1,
        [liao4.id]: 1000000, [goodOther.id]: 1000,
      },
      minimumLexicalEntries: 2, maximumCandidates: 1, maximumAttempts: 1,
    };
    const raw = composeFormalSyntaxUtterances(base).candidates[0]!;
    const reviewed = composeFormalSyntaxUtterances({
      ...base,
      readingEligibility: reviewedAdjacentReadingEligible,
      preDrawReadingEligibility: reviewedAdjacentPreDrawReadingEligible,
    }).candidates[0]!;
    expect(raw.entries[1]?.id).toBe(liao4.id);
    expect(reviewed.entries[1]?.id).toBe(goodOther.id);
    expect(reviewed.syntaxRootRuleId).toBe(raw.syntaxRootRuleId);
    expect(reviewed.entries[0]?.id).toBe(raw.entries[0]?.id);
  });

  it("preserves the other reviewed 多少種 and 第N行 rules", () => {
    const duo = entry("多少", "ㄉㄨㄛ1-ㄕㄠ3");
    const zhong4 = entry("種", "ㄓㄨㄥ4");
    expect(reviewedAdjacentPreDrawReadingEligible(
      zhong4, profile(zhong4, "NOUN"), null, duo,
    )).toBe(false);
    const ord = entry("第三", "ㄉㄧ4-ㄙㄢ1");
    const hangWrong = entry("行", "ㄒㄧㄥ2");
    expect(reviewedAdjacentPreDrawReadingEligible(
      hangWrong, profile(hangWrong, "NOUN"), null, ord,
    )).toBe(false);
  });
});
