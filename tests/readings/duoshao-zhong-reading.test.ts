import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  selectFormalSyntaxUtterance,
} from "../../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import {
  reviewedAdjacentPreDrawReadingEligible,
  reviewedAdjacentReadingEligible,
  reviewedDuoshaoZhongReadingEligible,
} from "../../src/readings/reviewed-adjacent-context.js";
import {
  reviewedOrdinalLineReadingEligible,
  reviewedRoleAndOrdinalLineReadingEligible,
} from "../../src/readings/ordinal-line-context.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import type { ProductionRule, RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

function word(text: string, reading: string, tokens: readonly string[]): CatalogEntry {
  return {
    id: catalogEntryId(text, reading),
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens }],
    tags: [], provenanceIds: [],
  };
}
function profile(item: CatalogEntry, upos: Upos, fn: "subject" | "predicate"): RuntimeSyntaxProfile {
  return {
    id: item.id + "/" + upos,
    entryId: item.id,
    upos, functions: [fn], valencyFrames: ["avalent"],
    dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
    provenanceIds: [],
  };
}
const prefix = word("多少", "ㄉㄨㄛ1 ㄕㄠ3", ["zhuyin:ㄉ", "tone:1"]);
const correct = word("種", "ㄓㄨㄥ3", ["zhuyin:ㄓ", "zhuyin:ㄨ", "zhuyin:ㄥ", "tone:3"]);
const planting = word("種", "ㄓㄨㄥ4", ["zhuyin:ㄓ", "zhuyin:ㄨ", "zhuyin:ㄥ", "tone:4"]);
const other = word("類", "ㄌㄟ4", ["zhuyin:ㄌ", "zhuyin:ㄟ", "tone:4"]);
const rule: ProductionRule = {
  id: "sentence.quantity-reading-test",
  grammarVersion: FORMAL_GRAMMAR_VERSION,
  output: "Sentence",
  constituents: [
    {
      key: "prefix", category: "Lexeme", minimum: 1, maximum: 1,
      recursive: false, allowedUpos: ["DET"], requiredFunctions: ["subject"],
      requiredValencyFrames: [], requiredFeatures: {},
    },
    {
      key: "next", category: "Lexeme", minimum: 1, maximum: 1,
      recursive: false, allowedUpos: ["NOUN"], requiredFunctions: ["predicate"],
      requiredValencyFrames: [], requiredFeatures: {},
    },
  ],
  surfaceOrders: [{ id: "canonical", constituentKeys: ["prefix", "next"] }],
  constraints: [], positiveFixtureIds: ["one"], negativeFixtureIds: ["two"],
};
const entries = [prefix, correct, planting, other];
const profiles = [
  profile(prefix, "DET", "subject"),
  profile(correct, "NOUN", "predicate"),
  profile(planting, "NOUN", "predicate"),
  profile(other, "NOUN", "predicate"),
];

describe("reviewed 多少 + standalone 種 reading", () => {
  it("licenses only the attested classifier without inferring every 種/NOUN or VERB", () => {
    expect(reviewedDuoshaoZhongReadingEligible(correct, profiles[1]!, prefix)).toBe(true);
    expect(reviewedDuoshaoZhongReadingEligible(planting, profiles[2]!, prefix)).toBe(false);
    for (const previous of [null, word("其他", "ㄑㄧ2 ㄊㄚ1", []), word("三", "ㄙㄢ1", [])]) {
      expect(reviewedDuoshaoZhongReadingEligible(correct, profiles[1]!, previous)).toBe(true);
      expect(reviewedDuoshaoZhongReadingEligible(planting, profiles[2]!, previous)).toBe(true);
    }
    const compound = word("種花", "ㄓㄨㄥ4 ㄏㄨㄚ1", []);
    expect(reviewedDuoshaoZhongReadingEligible(compound, profile(compound, "VERB", "predicate"), prefix)).toBe(true);
    expect(() => reviewedDuoshaoZhongReadingEligible(planting, profiles[1]!, prefix))
      .toThrow("selected catalog identity");
  });

  it("filters an invalid high-weight ㄓㄨㄥ4 BEFORE the lexical draw", () => {
    const base = {
      eligibleEntries: [prefix, correct, planting],
      profiles: profiles.slice(0, 3),
      rules: [rule], samplingMode: "raw" as const,
      random: { next: () => 0.5 },
      entryWeightsById: {
        [prefix.id]: 1, [correct.id]: 1, [planting.id]: 1_000_000,
      },
      minimumLexicalEntries: 2, maximumCandidates: 1, maximumAttempts: 1,
    };
    expect(composeFormalSyntaxUtterances(base).candidates[0]?.entries.map(x => x.id))
      .toEqual([prefix.id, planting.id]);
    const fixed = composeFormalSyntaxUtterances({
      ...base,
      preDrawReadingEligibility: reviewedAdjacentPreDrawReadingEligible,
      readingEligibility: reviewedAdjacentReadingEligible,
    });
    expect(fixed.candidates[0]?.entries.map(x => x.id))
      .toEqual([prefix.id, correct.id]);
    expect(fixed.fallbackReasons).not.toContain("formal-syntax-no-candidate");
  });

  it("does not let fourth-tone weakness re-license the wrong classifier reading", () => {
    let unguardedBad = 0;
    for (let i = 0; i < 128; i++) {
      const input = {
        entries, profiles, mode: "guided" as const, layoutId: "standard",
        history: { recentEntryIds: [], recentUtteranceIds: [], recentTemplateIds: [] },
        policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
        formalSyntaxComposition: { rules: [rule], samplingMode: "raw" as const },
        bindingEvidence: [{
          scope: { mode: "guided" as const, layoutId: "standard", tokenId: "tone:4" },
          attempts: 20, errors: 19, timingSamples: 0,
          currentTimeToTypeMs: null, bestTimeToTypeMs: null,
        }],
      };
      const seed = "weak-tone4-quantity:" + i;
      const raw = selectFormalSyntaxUtterance({
        ...input, random: createSeededRandom(seed),
      }).utterance.entries[1]!;
      const licensed = selectFormalSyntaxUtterance({
        ...input, random: createSeededRandom(seed),
        readingEligibility: reviewedAdjacentReadingEligible,
        preDrawReadingEligibility: reviewedAdjacentPreDrawReadingEligible,
      }).utterance.entries[1]!;
      unguardedBad += Number(raw.id === planting.id);
      expect(licensed.id).not.toBe(planting.id);
      expect([correct.id, other.id]).toContain(licensed.id);
    }
    expect(unguardedBad).toBeGreaterThan(0);
  });

  it("repairs the actual previously observed 2048-audit seed 443 locally", () => {
    const bounds = {
      maximumPhraseDepth: 3,
      maximumClauseNesting: 1,
      maximumClausesPerSentence: 2,
      maximumCoordinationItems: 2,
      maximumConsecutiveModifiers: 2,
      maximumComplementsPerPredicate: 1,
      maximumLexicalEntriesPerUtterance: 6,
    };
    const config = {
      eligibleEntries: PRACTICE_CATALOG,
      profiles: SYNTAX_PROFILES,
      samplingMode: "product-family" as const,
      minimumLexicalEntries: 2,
      maximumCandidates: 1, maximumAttempts: 64, bounds,
    };
    const seed = "formal-syntax-v2-phase1-product-baseline-v1:443";
    const before = composeFormalSyntaxUtterances({
      ...config, random: createSeededRandom(seed),
      readingEligibility: reviewedRoleAndOrdinalLineReadingEligible,
      preDrawReadingEligibility: (entry: CatalogEntry, selectedProfile: RuntimeSyntaxProfile, _slot: unknown, previous: CatalogEntry | null) =>
        reviewedOrdinalLineReadingEligible(entry, selectedProfile, previous),
    }).candidates[0]!;
    const after = composeFormalSyntaxUtterances({
      ...config, random: createSeededRandom(seed),
      readingEligibility: reviewedAdjacentReadingEligible,
      preDrawReadingEligibility: reviewedAdjacentPreDrawReadingEligible,
    }).candidates[0]!;
    const wrongIndex = before.entries.findIndex((e,i) =>
      i>0 && before.entries[i-1]?.prompt.text === "多少" && e.id === planting.id);
    expect(wrongIndex).toBeGreaterThan(0);
    expect(after.entries[wrongIndex]?.id).not.toBe(planting.id);
    expect(after.entries[wrongIndex]?.id).toBeDefined();
    expect(after.syntaxRootRuleId).toBe(before.syntaxRootRuleId);
    expect(after.entries.length).toBe(before.entries.length);
    for(let i=0;i<before.entries.length;i++) {
      if(i!==wrongIndex) expect(after.entries[i]?.id).toBe(before.entries[i]?.id);
    }
  });
});
