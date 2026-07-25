import { describe, expect, it } from "vitest";
import {
  catalogEntryCommonnessTier,
  commonnessTierDescription,
  commonnessTierForWeight,
  commonnessTierShareLabel,
  commonnessTierThresholds,
  COMMONNESS_TIER_SHARES,
  type CommonnessTierThresholds,
} from "../../src/commonness/tiers.js";
import type { CatalogEntry } from "../../src/core/model.js";

function entry(id: string, selectionWeight?: number): CatalogEntry {
  return {
    id,
    prompt: { text: id, locale: "zh-TW" },
    syllables: [],
    tags: ["fixture"],
    provenanceIds: ["fixture"],
    ...(selectionWeight === undefined ? {} : {
      commonnessBase: {
        modelVersion: "commonness-v1",
        sourceId: "fixture",
        sourceVersion: "fixture-v1",
        sourceRowId: id,
        spokenPerMillion: null,
        writtenPerMillion: null,
        spokenStrength: null,
        writtenStrength: null,
        score: selectionWeight,
        selectionWeight,
        confidence: "reviewed",
        reasons: [],
      },
    }),
  };
}

// 100 evenly spaced weights make each tier's share directly countable.
const EVEN_WEIGHTS = Array.from({ length: 100 }, (_, index) => (index + 1) / 100);

describe("commonness tiers", () => {
  it("cuts thresholds at the configured catalog shares", () => {
    const thresholds = commonnessTierThresholds(EVEN_WEIGHTS);
    const tiers = EVEN_WEIGHTS.map((weight) => commonnessTierForWeight(weight, thresholds));
    const atOrAbove = (tier: number): number =>
      tiers.filter((value) => value <= tier).length;
    expect(atOrAbove(1) / EVEN_WEIGHTS.length).toBeCloseTo(COMMONNESS_TIER_SHARES[0], 2);
    expect(atOrAbove(2) / EVEN_WEIGHTS.length).toBeCloseTo(COMMONNESS_TIER_SHARES[1], 2);
    expect(atOrAbove(3) / EVEN_WEIGHTS.length).toBeCloseTo(COMMONNESS_TIER_SHARES[2], 2);
    expect(atOrAbove(4)).toBe(EVEN_WEIGHTS.length);
  });

  it("keeps the ordering of a skewed distribution", () => {
    // The shipped catalog is long-tailed: equal-width value bands would put
    // almost everything in one band, share-based cuts must not.
    const skewed = Array.from({ length: 200 }, (_, index) => 0.05 + 0.95 * ((index + 1) / 200) ** 4);
    const thresholds = commonnessTierThresholds(skewed);
    expect(thresholds[0]).toBeGreaterThan(thresholds[1]);
    expect(thresholds[1]).toBeGreaterThan(thresholds[2]);
    expect(commonnessTierForWeight(skewed.at(-1)!, thresholds)).toBe(1);
    expect(commonnessTierForWeight(skewed[0]!, thresholds)).toBe(4);
  });

  it("derives thresholds from a single weight without failing", () => {
    const thresholds = commonnessTierThresholds([0.4]);
    expect(thresholds).toEqual([0.4, 0.4, 0.4]);
    expect(commonnessTierForWeight(0.4, thresholds)).toBe(1);
    expect(commonnessTierForWeight(0.39, thresholds)).toBe(4);
  });

  it("rejects an empty or invalid weight set", () => {
    expect(() => commonnessTierThresholds([])).toThrow(RangeError);
    expect(() => commonnessTierThresholds([0])).toThrow(RangeError);
    expect(() => commonnessTierThresholds([1.4])).toThrow(RangeError);
    expect(() => commonnessTierThresholds([Number.NaN])).toThrow(RangeError);
  });

  it("has no tier for an entry without reviewed frequency evidence", () => {
    const thresholds: CommonnessTierThresholds = [0.4, 0.29, 0.18];
    expect(catalogEntryCommonnessTier(entry("測試", 0.9), thresholds)).toBe(1);
    expect(catalogEntryCommonnessTier(entry("測試", 0.2), thresholds)).toBe(3);
    expect(catalogEntryCommonnessTier(entry("測試"), thresholds)).toBeNull();
  });

  it("labels each tier with its share of the catalog", () => {
    expect(commonnessTierShareLabel(1)).toBe("前 10%");
    expect(commonnessTierShareLabel(2)).toBe("前 10–25%");
    expect(commonnessTierShareLabel(3)).toBe("前 25–50%");
    expect(commonnessTierShareLabel(4)).toBe("後 50%");
    expect(commonnessTierDescription(1)).toBe("高頻 · 前 10%");
  });
});
