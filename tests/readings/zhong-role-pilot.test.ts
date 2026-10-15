import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { reviewedZhongRolePilotEligible } from "../../src/readings/zhong-role-pilot.js";
import type { RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

const make = (text: string, reading: string): CatalogEntry => ({
  id: catalogEntryId(text, reading),
  prompt: { text, locale: "zh-TW" },
  syllables: [{ tokens: ["zhuyin:ㄓ", "tone:3"] }],
  tags: [], provenanceIds: [],
});
const asRole = (entry: CatalogEntry, upos: Upos): RuntimeSyntaxProfile => ({
  id: entry.id + "#" + upos,
  entryId: entry.id,
  upos, functions: ["predicate"],
  valencyFrames: ["avalent"],
  dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
  provenanceIds: [],
});

describe("opt-in, not product-active 種 lexical-role experiment", () => {
  const noun = make("種", "ㄓㄨㄥ3");
  const verb = make("種", "ㄓㄨㄥ4");

  it("licenses reviewed NOUN and VERB roles but does not decide unknown functions", () => {
    expect(reviewedZhongRolePilotEligible(noun, asRole(noun, "NOUN"))).toBe(true);
    expect(reviewedZhongRolePilotEligible(verb, asRole(verb, "VERB"))).toBe(true);
    expect(reviewedZhongRolePilotEligible(noun, asRole(noun, "VERB"))).toBe(false);
    expect(reviewedZhongRolePilotEligible(verb, asRole(verb, "NOUN"))).toBe(false);
    for (const upos of ["NUM", "DET", "X", "ADJ"] as Upos[]) {
      expect(reviewedZhongRolePilotEligible(noun, asRole(noun, upos))).toBe(true);
      expect(reviewedZhongRolePilotEligible(verb, asRole(verb, upos))).toBe(true);
    }
  });

  it("does not disturb unrelated readings and preserves the existing role gate", () => {
    const wrongConjunction = make("和", "ㄏㄨㄛ4");
    const validConjunction = make("和", "ㄏㄜ2");
    const unseen = make("東西", "ㄉㄨㄥ1 ㄒㄧ5");
    expect(reviewedZhongRolePilotEligible(wrongConjunction, asRole(wrongConjunction, "CCONJ"))).toBe(false);
    expect(reviewedZhongRolePilotEligible(validConjunction, asRole(validConjunction, "CCONJ"))).toBe(true);
    expect(reviewedZhongRolePilotEligible(unseen, asRole(unseen, "NOUN"))).toBe(true);
  });

  it("rejects mismatched entry/profile joins", () => {
    expect(() => reviewedZhongRolePilotEligible(noun, asRole(verb, "NOUN")))
      .toThrow("selected catalog entry identity");
  });
});