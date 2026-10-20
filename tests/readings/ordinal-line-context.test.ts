import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import {
  reviewedOrdinalLineReadingEligible,
  reviewedRoleAndOrdinalLineReadingEligible,
} from "../../src/readings/ordinal-line-context.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import type { ProductionRule, RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

function entry(text: string, reading: string): CatalogEntry {
  return {
    id: catalogEntryId(text, reading),
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄏ", "tone:2"] }],
    tags: [], provenanceIds: [],
  };
}
function profile(item: CatalogEntry, upos: Upos): RuntimeSyntaxProfile {
  return {
    id: item.id + "/" + upos,
    entryId: item.id,
    upos, functions: ["predicate"],
    valencyFrames: ["avalent"],
    dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
    provenanceIds: [],
  };
}
const ordinal = entry("第三", "ㄉㄧ4-ㄙㄢ1");
const row = entry("行", "ㄏㄤ2");
const move = entry("行", "ㄒㄧㄥ2");
const virtue = entry("行", "ㄒㄧㄥ4");
const different = entry("航", "ㄏㄤ2");

const rule: ProductionRule = {
  id: "sentence.numbered-row-fixture",
  grammarVersion: FORMAL_GRAMMAR_VERSION,
  output: "Sentence",
  constituents: [
    {
      key: "ordinal", category: "Lexeme", minimum: 1, maximum: 1,
      recursive: false, allowedUpos: ["NUM"], requiredFunctions: ["subject"],
      requiredValencyFrames: [], requiredFeatures: {},
    },
    {
      key: "row", category: "Lexeme", minimum: 1, maximum: 1,
      recursive: false, allowedUpos: ["NOUN"], requiredFunctions: ["predicate"],
      requiredValencyFrames: [], requiredFeatures: {},
    },
  ],
  surfaceOrders: [{ id: "canonical", constituentKeys: ["ordinal", "row"] }],
  constraints: [],
  positiveFixtureIds: ["reviewed:numbered-row"],
  negativeFixtureIds: ["reviewed:wrong-row-reading"],
};

describe("reviewed adjacent 第N行 reading", () => {
  it("limits only an immediate atomic ordinal + standalone 行", () => {
    for (const wrong of [move, virtue]) {
      expect(reviewedOrdinalLineReadingEligible(wrong, profile(wrong, "NOUN"), ordinal)).toBe(false);
      expect(reviewedOrdinalLineReadingEligible(wrong, profile(wrong, "VERB"), ordinal)).toBe(false);
      expect(reviewedOrdinalLineReadingEligible(wrong, profile(wrong, "NOUN"), entry("第十二", "test"))).toBe(false);
      expect(reviewedOrdinalLineReadingEligible(wrong, profile(wrong, "NOUN"), entry("第3", "test"))).toBe(false);
      expect(reviewedOrdinalLineReadingEligible(wrong, profile(wrong, "NOUN"), entry("三", "test"))).toBe(true);
      expect(reviewedOrdinalLineReadingEligible(wrong, profile(wrong, "NOUN"), entry("其他", "test"))).toBe(true);
      expect(reviewedOrdinalLineReadingEligible(wrong, profile(wrong, "NOUN"), null)).toBe(true);
    }
    expect(reviewedOrdinalLineReadingEligible(row, profile(row, "NOUN"), ordinal)).toBe(true);
    const compound = entry("行動", "ㄒㄧㄥ2-ㄉㄨㄥ4");
    expect(reviewedOrdinalLineReadingEligible(compound, profile(compound, "NOUN"), ordinal)).toBe(true);
    expect(() => reviewedOrdinalLineReadingEligible(row, profile(move, "NOUN"), ordinal))
      .toThrow("selected catalog identity");
  });

  it("redraws only the adjacent lexical slot using licensed entry weights", () => {
    const base = {
      eligibleEntries: [ordinal, move, row, different],
      profiles: [
        { ...profile(ordinal, "NUM"), functions: ["subject" as const] },
        profile(move, "NOUN"),
        profile(row, "NOUN"),
        profile(different, "NOUN"),
      ],
      rules: [rule],
      samplingMode: "raw" as const,
      random: { next: () => 0.5 },
      entryWeightsById: {
        [ordinal.id]: 1,
        [move.id]: 1_000_000,
        [row.id]: 1,
        [different.id]: 1_000,
      },
      maximumCandidates: 1,
      maximumAttempts: 1,
      minimumLexicalEntries: 2,
    };
    const before = composeFormalSyntaxUtterances(base);
    const after = composeFormalSyntaxUtterances({
      ...base,
      readingEligibility: reviewedRoleAndOrdinalLineReadingEligible,
    });
    expect(before.candidates[0]?.entries.map(x => x.id)).toEqual([ordinal.id, move.id]);
    expect(after.candidates[0]?.entries.map(x => x.id)).toEqual([ordinal.id, different.id]);
    expect(after.candidates[0]?.syntaxRootRuleId).toEqual(before.candidates[0]?.syntaxRootRuleId);
    expect(after.fallbackReasons).not.toContain("formal-syntax-no-candidate");
  });

  it("retains 行 when its only legal lexical identity wins, with one structural attempt", () => {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: [ordinal, move, row],
      profiles: [
        { ...profile(ordinal, "NUM"), functions: ["subject" as const] },
        profile(move, "NOUN"),
        profile(row, "NOUN"),
      ],
      rules: [rule],
      samplingMode: "raw",
      random: { next: () => 0.5 },
      entryWeightsById: {
        [ordinal.id]: 1, [move.id]: 1_000_000, [row.id]: 1,
      },
      minimumLexicalEntries: 2,
      maximumCandidates: 1,
      maximumAttempts: 1,
      readingEligibility: reviewedRoleAndOrdinalLineReadingEligible,
    });
    expect(result.candidates[0]?.entries.map(x => x.id)).toEqual([ordinal.id, row.id]);
    expect(result.candidates[0]?.text).toBe("第三行");
  });
});
