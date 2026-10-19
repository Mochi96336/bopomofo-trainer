import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { reviewedAdjectiveReadingEligible } from "../../src/readings/adjective-role-license.js";
import { reviewedRoleReadingEligible } from "../../src/readings/pronominal-role-license.js";
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

  it("does not infer a reading from a mismatched entry/profile join", () => {
    expect(() => reviewedAdjectiveReadingEligible(good, profile(fond, "ADJ")))
      .toThrow("actually selected catalog identity");
  });
});
