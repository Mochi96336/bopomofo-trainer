import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  buildDongxiContextReview,
  DONGXI_SENSE_READINGS,
  type DongxiContextOrigin,
} from "../../src/readings/dongxi-context-review.js";
import type { PolyphonicContextHit } from "../../src/readings/polyphonic-audit.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const [DIRECTION, OBJECTS] = DONGXI_SENSE_READINGS.map(x => x.id);
const entry = (reading: string): CatalogEntry => ({
  id: catalogEntryId("東西", reading),
  prompt: { text: "東西", locale: "zh-TW" },
  syllables: [{ tokens: ["zhuyin:ㄉ", "tone:1"] }],
  tags: [],
  provenanceIds: [],
});
const catalog = [entry("ㄉㄨㄥ1 ㄒㄧ1"), entry("ㄉㄨㄥ1 ㄒㄧ5")];
const profile = (id: string, extras: readonly string[] = []): RuntimeSyntaxProfile => ({
  id: "profile:" + id,
  entryId: id,
  upos: "NOUN",
  functions: ["subject", "object", ...extras] as RuntimeSyntaxProfile["functions"],
  valencyFrames: ["avalent"],
  dependencyEvidence: {
    dependencyRelationCounts: { nsubj: 2, obj: 4 },
    surfacePositionCounts: { medial: 6 },
  },
  provenanceIds: [],
});
const profiles = [profile(DIRECTION), profile(OBJECTS)];
function hit(readingId: string, seed: number, sentence: string): PolyphonicContextHit {
  return {
    seedIndex: seed,
    entryIndex: 1,
    sentence,
    text: "東西",
    punctuation: "。",
    syntaxRootRuleId: "sentence.declarative",
    selectedEntryId: readingId,
    selectedProfileId: "profile:" + readingId,
    selectedUpos: "NOUN",
    selectedFunctions: ["object"],
    alternativeEntryIds: [readingId === DIRECTION ? OBJECTS : DIRECTION],
    previousEntryText: "買",
    nextEntryText: null,
  };
}
const occurrence = (
  origin: DongxiContextOrigin["origin"], id: string, seed: number, sentence: string,
): DongxiContextOrigin => ({ origin, hit: hit(id, seed, sentence) });

describe("東西 same-POS dictionary identities are NOT reviewed sentence senses", () => {
  it("keeps chosen exact entry, contextual reading, sense and naturalness separate", () => {
    const review = buildDongxiContextReview(catalog, profiles, [
      occurrence("unbiased-reviewed-roles", DIRECTION, 5, "街道呈東西走向。"),
      occurrence("biased-research-probe", OBJECTS, 0, "我買了一些東西。"),
      occurrence("biased-research-probe", DIRECTION, 0, "不自然的東西。"),
      occurrence("biased-research-probe", OBJECTS, 1, "物品東西。"),
    ], 2);
    expect(review.schemaVersion).toBe("dongxi-same-upos-sense-review-v1");
    expect(review.profileSignaturesEqualIgnoringIdentity).toBe(true);
    expect(review.observed[DIRECTION]).toEqual({
      unbiasedHits: 1, biasedHits: 1, reviewItems: 2, profileCount: 1,
    });
    expect(review.observed[OBJECTS]).toEqual({
      unbiasedHits: 0, biasedHits: 2, reviewItems: 2, profileCount: 1,
    });
    for (const item of review.reviewItems) {
      expect(item.lexicalBoundary).toBe("selected-atomic-host-entry");
      expect(item.actualContextualSense).toBe("pending");
      expect(item.contextualReadingReview).toBe("pending");
      expect(item.sentenceNaturalnessReview).toBe("pending");
      expect(item.notTrainingGroundTruth).toBe(true);
      expect(item.notProductRule).toBe(true);
    }
    expect(review.reviewItems.find(x => x.selectedEntryId === OBJECTS)?.dictionarySenseFamily)
      .toBe("objects");
    expect(review.reviewItems.find(x => x.selectedEntryId === DIRECTION)?.dictionarySenseFamily)
      .toBe("cardinal-directions");
  });

  it("truncates only the review shortlist, not exposure totals", () => {
    const report = buildDongxiContextReview(catalog, profiles, [
      occurrence("biased-research-probe", OBJECTS, 0, "這是東西"),
      occurrence("biased-research-probe", OBJECTS, 1, "那是東西"),
    ], 1);
    expect(report.reviewItems).toHaveLength(1);
    expect(report.observed[OBJECTS]?.biasedHits).toBe(2);
    expect(report.observed[OBJECTS]?.reviewItems).toBe(1);
    expect(report.observed[DIRECTION]?.reviewItems).toBe(0);
  });

  it("abstains even with identical noun profiles and rejects identity mismatches", () => {
    expect(buildDongxiContextReview(catalog, profiles, []).profileSignaturesEqualIgnoringIdentity)
      .toBe(true);
    expect(buildDongxiContextReview(catalog, [
      profile(DIRECTION), profile(OBJECTS, ["modifier"]),
    ], []).profileSignaturesEqualIgnoringIdentity).toBe(false);
    expect(() => buildDongxiContextReview(catalog.slice(0, 1), profiles, []))
      .toThrow("exactly two");
    expect(() => buildDongxiContextReview(catalog, profiles, [
      occurrence("biased-research-probe", DIRECTION, 0, "東西"),
      occurrence("biased-research-probe", DIRECTION, 0, "東西"),
    ])).toThrow("duplicate");
    expect(() => buildDongxiContextReview(catalog, profiles, [
      { origin: "biased-research-probe", hit: { ...hit(OBJECTS, 0, "東西"), selectedProfileId: "profile:" + DIRECTION } },
    ])).toThrow("identity mismatch");
    expect(() => buildDongxiContextReview(catalog, profiles, [
      { origin: "biased-research-probe", hit: { ...hit(OBJECTS, 0, "東西"), text: "說" } },
    ])).toThrow("non-東西");
    expect(() => buildDongxiContextReview(catalog, profiles, [], 0))
      .toThrow("positive integer");
  });

  it("pins actual active catalog structure without claiming correctness", () => {
    const report = buildDongxiContextReview(PRACTICE_CATALOG, SYNTAX_PROFILES, []);
    expect(report.profileSignaturesEqualIgnoringIdentity).toBe(true);
    expect(report.observed[DIRECTION]?.profileCount).toBeGreaterThan(0);
    expect(report.observed[OBJECTS]?.profileCount).toBeGreaterThan(0);
    expect(report.noAutomaticSenseDecision).toBe(true);
  });
});
