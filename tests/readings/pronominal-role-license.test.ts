import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  reviewedPronominalReadingEligible,
  reviewedRoleReadingEligible,
} from "../../src/readings/pronominal-role-license.js";
import type { RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

function entry(text: string, reading: string): CatalogEntry {
  return {
    id: catalogEntryId(text, reading),
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄋ", "tone:3"] }],
    tags: ["test"],
    provenanceIds: ["test"],
  };
}

function profile(item: CatalogEntry, upos: Upos): RuntimeSyntaxProfile {
  return {
    id: item.id + "/" + upos,
    entryId: item.id,
    upos,
    functions: ["subject"],
    valencyFrames: ["avalent"],
    dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
    provenanceIds: ["test"],
  };
}

describe("reviewed pronoun / determiner reading evidence", () => {
  it("limits 哪 as a question pronoun to the two reviewed question readings", () => {
    for (const reading of ["ㄋㄚ3", "ㄋㄟ3"]) {
      const item = entry("哪", reading);
      expect(reviewedPronominalReadingEligible(item, profile(item, "PRON"))).toBe(true);
    }
    for (const reading of ["ㄋㄜ2", "ㄋㄚ5"]) {
      const item = entry("哪", reading);
      expect(reviewedPronominalReadingEligible(item, profile(item, "PRON"))).toBe(false);
      // The neutral-tone question particle is not globally deleted.
      expect(reviewedPronominalReadingEligible(item, profile(item, "PART"))).toBe(true);
    }
  });

  it("limits 那 as a demonstrative determiner without overwriting interrogative pronouns", () => {
    const demonstrative = entry("那", "ㄋㄚ4");
    const interrogative = entry("那", "ㄋㄚ3");
    const surname = entry("那", "ㄋㄚ1");
    const archaic = entry("那", "ㄋㄨㄛ2");
    expect(reviewedPronominalReadingEligible(demonstrative, profile(demonstrative, "DET"))).toBe(true);
    for (const alternative of [interrogative, surname, archaic]) {
      expect(reviewedPronominalReadingEligible(alternative, profile(alternative, "DET"))).toBe(false);
      // A different part of speech needs its own separate evidence.
      expect(reviewedPronominalReadingEligible(alternative, profile(alternative, "PRON"))).toBe(true);
    }
  });

  it("preserves the prior closed-class conjunction gate in the composed trial", () => {
    const wrong = entry("和", "ㄏㄨㄛ4");
    const correct = entry("和", "ㄏㄜ2");
    expect(reviewedRoleReadingEligible(wrong, profile(wrong, "CCONJ"))).toBe(false);
    expect(reviewedRoleReadingEligible(correct, profile(correct, "CCONJ"))).toBe(true);
    const unknown = entry("種", "ㄓㄨㄥ3");
    expect(reviewedRoleReadingEligible(unknown, profile(unknown, "NOUN"))).toBe(true);
  });

  it("rejects mismatched identities and does not infer permissions from bare surface text", () => {
    const text = entry("哪", "ㄋㄚ3");
    const other = entry("哪", "ㄋㄟ3");
    expect(() => reviewedPronominalReadingEligible(text, profile(other, "PRON")))
      .toThrow("actually selected catalog identity");
  });
});
