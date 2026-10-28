import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  selectFormalSyntaxUtterance,
} from "../../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
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
    const legalRedraw = composeFormalSyntaxUtterances({
      ...base,
      readingEligibility: reviewedRoleAndOrdinalLineReadingEligible,
    });
    const legalFirst = composeFormalSyntaxUtterances({
      ...base,
      readingEligibility: reviewedRoleAndOrdinalLineReadingEligible,
      preDrawReadingEligibility: (entry, profile, _slot, previousEntry) =>
        reviewedOrdinalLineReadingEligible(entry, profile, previousEntry),
    });
    expect(before.candidates[0]?.entries.map(x => x.id)).toEqual([ordinal.id, move.id]);
    expect(legalRedraw.candidates[0]?.entries.map(x => x.id)).toEqual([ordinal.id, different.id]);
    // An invalid high-weight 行/ㄒㄧㄥ2 candidate must not donate its
    // selection mass to 行/ㄏㄤ2. The legal 航 candidate can win by its
    // own weight without restarting the sentence or overriding its reading.
    expect(legalFirst.candidates[0]?.entries.map(x => x.id)).toEqual([ordinal.id, different.id]);
    expect(legalFirst.candidates[0]?.syntaxRootRuleId).toEqual(before.candidates[0]?.syntaxRootRuleId);
    expect(legalFirst.fallbackReasons).not.toContain("formal-syntax-no-candidate");
  });

  it("chooses 行/ㄏㄤ2 when it is the only legal candidate, with one structural attempt", () => {
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
      preDrawReadingEligibility: (entry, profile, _slot, previousEntry) =>
        reviewedOrdinalLineReadingEligible(entry, profile, previousEntry),
    });
    expect(result.candidates[0]?.entries.map(x => x.id)).toEqual([ordinal.id, row.id]);
    expect(result.candidates[0]?.text).toBe("第三行");
  });

  it("keeps 第N行 legal even when the learner repeatedly misses ㄒ", () => {
    // The production selector, not a hand-chosen entryWeight fixture, must
    // disallow the incorrectly pronounced 行 before applying weak-key weights.
    const moveWithActualTokens: CatalogEntry = {
      ...move,
      syllables: [{ tokens: ["zhuyin:ㄒ", "zhuyin:ㄧ", "zhuyin:ㄥ", "tone:2"] }],
    };
    const rowWithActualTokens: CatalogEntry = {
      ...row,
      syllables: [{ tokens: ["zhuyin:ㄏ", "zhuyin:ㄤ", "tone:2"] }],
    };
    const otherWithActualTokens: CatalogEntry = {
      ...different,
      syllables: [{ tokens: ["zhuyin:ㄏ", "zhuyin:ㄤ", "tone:2"] }],
    };
    const entries = [ordinal, moveWithActualTokens, rowWithActualTokens, otherWithActualTokens];
    const profiles = [
      { ...profile(ordinal, "NUM"), functions: ["subject" as const] },
      profile(move, "NOUN"), profile(row, "NOUN"), profile(different, "NOUN"),
    ];
    let originallyWrong = 0;
    let invalidAfter = 0;
    let validAfter = 0;
    for (let i = 0; i < 256; i += 1) {
      const base = {
        entries, profiles, mode: "guided" as const,
        layoutId: "standard",
        history: { recentEntryIds: [], recentUtteranceIds: [], recentTemplateIds: [] },
        policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
        formalSyntaxComposition: { rules: [rule], samplingMode: "raw" as const },
        bindingEvidence: [{
          scope: { mode: "guided" as const, layoutId: "standard", tokenId: "zhuyin:ㄒ" },
          attempts: 20, errors: 19, timingSamples: 0,
          currentTimeToTypeMs: null, bestTimeToTypeMs: null,
        }],
      };
      const seed = "ordinal-weak-incorrect-reading:" + i;
      const raw = selectFormalSyntaxUtterance({
        ...base, random: createSeededRandom(seed),
      }).utterance.entries[1]!;
      const licensed = selectFormalSyntaxUtterance({
        ...base, random: createSeededRandom(seed),
        readingEligibility: reviewedRoleAndOrdinalLineReadingEligible,
        preDrawReadingEligibility: (entry, selectedProfile, _slot, previousEntry) =>
          reviewedOrdinalLineReadingEligible(entry, selectedProfile, previousEntry),
      }).utterance.entries[1]!;
      originallyWrong += Number(raw.id === move.id);
      invalidAfter += Number(licensed.id === move.id);
      validAfter += Number(licensed.id === row.id || licensed.id === different.id);
    }
    expect(originallyWrong).toBeGreaterThan(0);
    expect(invalidAfter).toBe(0);
    expect(validAfter).toBe(256);
  });

  it("does not erase a non-ordinal 行 reading under learner weakness", () => {
    // Contrasting NON-ordinal frontiers are about eligibility, not asserting
    // that either reading is correct in a complete generated sentence.
    const bareNumber = entry("三", "ㄙㄢ1");
    const moveWithTokens: CatalogEntry = {
      ...move,
      syllables: [{ tokens: ["zhuyin:ㄒ", "zhuyin:ㄧ", "zhuyin:ㄥ", "tone:2"] }],
    };
    const rowWithTokens: CatalogEntry = {
      ...row,
      syllables: [{ tokens: ["zhuyin:ㄏ", "zhuyin:ㄤ", "tone:2"] }],
    };
    const baseline = {
      entries: [bareNumber, moveWithTokens, rowWithTokens],
      profiles: [
        { ...profile(bareNumber, "NUM"), functions: ["subject" as const] },
        profile(move, "NOUN"),
        profile(row, "NOUN"),
      ],
      mode: "guided" as const,
      layoutId: "standard",
      history: { recentEntryIds: [], recentUtteranceIds: [], recentTemplateIds: [] },
      policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
      formalSyntaxComposition: { rules: [rule], samplingMode: "raw" as const },
      bindingEvidence: [{
        scope: { mode: "guided" as const, layoutId: "standard", tokenId: "zhuyin:ㄒ" },
        attempts: 20, errors: 19, timingSamples: 0,
        currentTimeToTypeMs: null, bestTimeToTypeMs: null,
      }],
    };
    let moveSelected = 0;
    let rowSelected = 0;
    for (let i = 0; i < 64; i++) {
      const seed = "nonordinal-line-contrast:" + i;
      const before = selectFormalSyntaxUtterance({
        ...baseline, random: createSeededRandom(seed),
      }).utterance;
      const after = selectFormalSyntaxUtterance({
        ...baseline, random: createSeededRandom(seed),
        readingEligibility: reviewedRoleAndOrdinalLineReadingEligible,
        preDrawReadingEligibility: (entry, selectedProfile, _slot, previousEntry) =>
          reviewedOrdinalLineReadingEligible(entry, selectedProfile, previousEntry),
      }).utterance;
      // This branch of the reading gate must not decide a bare 三 + 行
      // sense, and must not consume extra randomness for that context.
      expect(after.entries.map(x => x.id)).toEqual(before.entries.map(x => x.id));
      moveSelected += Number(after.entries[1]?.id === move.id);
      rowSelected += Number(after.entries[1]?.id === row.id);
    }
    expect(moveSelected).toBeGreaterThan(0);
    expect(rowSelected).toBeGreaterThan(0);
  });

});
