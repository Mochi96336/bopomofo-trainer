import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import { catalogIdentityIndex } from "../../src/curriculum/attested-sentence-candidates.js";
import { findAttestedAmbiguousReadingCandidates } from "../../src/curriculum/attested-reading-review.js";
import { compareAttestedReadingPolicies } from "../../src/curriculum/attested-reading-policy-comparison.js";

function entry(text: string, reading: string): CatalogEntry {
  return {
    id: catalogEntryId(text, reading), prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄅ", "tone:1"] }], tags: [], provenanceIds: [],
  };
}
function profile(e: CatalogEntry, upos: Upos): RuntimeSyntaxProfile {
  return {
    id: e.id + ":" + upos, entryId: e.id, upos,
    functions: [], valencyFrames: [],
    dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
    provenanceIds: [],
  };
}
function token(id: number, form: string, upos: Upos): UdOccurrenceToken {
  return { id, form, upos, head: 0, relation: "root", feats: "_" };
}
const catalog = [
  entry("種", "ㄓㄨㄥ3"), entry("種", "ㄓㄨㄥ4"),
  entry("那", "ㄋㄚ4"), entry("那", "ㄋㄚ3"),
  entry("東西", "ㄉㄨㄥ1 ㄒㄧ1"), entry("東西", "ㄉㄨㄥ1 ㄒㄧ5"),
];
const profiles = catalog.flatMap(e => {
  if (e.prompt.text === "種") return [profile(e, "NOUN"), profile(e, "VERB")];
  if (e.prompt.text === "那") return [profile(e, "DET")];
  return [profile(e, "NOUN")];
});
const sentences = [
  [token(1, "這", "DET"), token(2, "種", "NOUN"), token(3, "花", "NOUN")],
  [token(1, "他", "PRON"), token(2, "種", "VERB"), token(3, "花", "NOUN")],
  [token(1, "那", "DET"), token(2, "個", "NOUN")],
  [token(1, "我", "PRON"), token(2, "買", "VERB"), token(3, "東西", "NOUN")],
];
const texts = ["這種花", "他種花", "那個", "我買東西"];
const candidates = sentences.flatMap((tokens, sourceSentenceIndex) =>
  findAttestedAmbiguousReadingCandidates(
    tokens, texts[sourceSentenceIndex]!, sourceSentenceIndex, catalogIdentityIndex(catalog),
  ));

describe("true-source polyphonic policy comparison, NOT contextual reading gold", () => {
  it("separates existing role rules, unshipped 種 rule and unresolved same-POS senses", () => {
    const report = compareAttestedReadingPolicies(candidates, sentences, catalog, profiles);
    expect(report.candidateCount).toBe(4);
    expect(report.existingProductPolicy).toEqual({
      noMatchingProfile: 0, noPermittedReading: 0,
      uniqueReadingProposal: 1, unresolvedMultipleReadings: 3,
    });
    expect(report.existingPlusUnshippedZhongPilot).toEqual({
      noMatchingProfile: 0, noPermittedReading: 0,
      uniqueReadingProposal: 3, unresolvedMultipleReadings: 1,
    });
    expect(report.newlyUniqueZhongOnly).toBe(2);
    expect(report.differentOrZeroAfterPilot).toBe(2);
    expect(report.interpretation).toBe("policy-only-source-upos-hypotheses-not-reading-gold");
  });

  it("abstains without matching source UPOS instead of forcing an answer", () => {
    const noMatchingProfile = profiles.filter(p => !(p.entryId === catalog[4]!.id || p.entryId === catalog[5]!.id));
    const report = compareAttestedReadingPolicies(candidates, sentences, catalog, noMatchingProfile);
    expect(report.existingProductPolicy.noMatchingProfile).toBe(1);
    expect(report.existingPlusUnshippedZhongPilot.noMatchingProfile).toBe(1);
  });

  it("rejects forged source token locations and unknown alternative identity IDs", () => {
    expect(() => compareAttestedReadingPolicies(
      [{ ...candidates[0]!, sourceTokenId: 99 }], sentences, catalog, profiles,
    )).toThrow("source token mismatch");
    expect(() => compareAttestedReadingPolicies(
      [{ ...candidates[0]!, possibleEntryIds: ["fake", catalog[1]!.id] }],
      sentences, catalog, profiles,
    )).toThrow("genuine competing");
  });
});
