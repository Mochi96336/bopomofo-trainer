import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import { catalogIdentityIndex } from "../../src/curriculum/attested-sentence-candidates.js";
import {
  auditAttestedAmbiguousReadingCoverage,
  findAttestedAmbiguousReadingCandidates,
  prepareBlindedReadingReviewSample,
} from "../../src/curriculum/attested-reading-review.js";

const entry = (text: string, reading: string): CatalogEntry => ({
  id: `word:${text}:${reading}`,
  prompt: { text, locale: "zh-TW" },
  syllables: [{ tokens: ["zhuyin:ㄅ", "tone:1"] }],
  tags: [], provenanceIds: [],
});
const entries = [
  entry("東西", "ㄉㄨㄥ1 ㄒㄧ1"),
  entry("東西", "ㄉㄨㄥ1 ㄒㄧ5"),
  entry("種", "ㄓㄨㄥ3"),
  entry("種", "ㄓㄨㄥ4"),
  entry("東", "ㄉㄨㄥ1"),
];
const token = (id: number, form: string, upos = "NOUN"): UdOccurrenceToken =>
  ({ id, form, upos, head: 0, relation: "root", feats: "_" });

describe("attested polyphonic reading review intake", () => {
  const tokens = [token(1, "這", "DET"), token(2, "東西"),
    token(3, "東西"), token(4, "很好", "ADJ"),
    token(5, "。", "PUNCT")];
  it("retains each occurrence and all competing identity IDs without assigning a reading", () => {
    const found = findAttestedAmbiguousReadingCandidates(
      tokens, "這東西東西很好。", 7, catalogIdentityIndex(entries));
    expect(found).toHaveLength(2);
    expect(found.map(x => [x.sourceTokenId, x.start, x.end]))
      .toEqual([[2, 1, 3], [3, 3, 5]]);
    expect(found[0]!.possibleEntryIds).toHaveLength(2);
    expect(found[0]!.possibleEntryIds).toContain("word:東西:ㄉㄨㄥ1 ㄒㄧ1");
    expect(found[0]!.possibleEntryIds).toContain("word:東西:ㄉㄨㄥ1 ㄒㄧ5");
    expect(found[0]).not.toHaveProperty("approvedEntryId");
  });

  it("never skips source words, guesses segments or treats single readings as ambiguous", () => {
    const byText = catalogIdentityIndex(entries);
    expect(findAttestedAmbiguousReadingCandidates(tokens, "這其他東西東西很好。", 7, byText))
      .toEqual([]);
    expect(findAttestedAmbiguousReadingCandidates(tokens, null, 7, byText)).toEqual([]);
    expect(findAttestedAmbiguousReadingCandidates(
      [token(1, "東西向")], "東西向", 7, byText)).toEqual([]);
    expect(findAttestedAmbiguousReadingCandidates(
      [token(1, "東")], "東", 7, byText)).toEqual([]);
  });

  it("separates an answer-free reviewer sample from organizer identity hypotheses", () => {
    const found = [
      ...findAttestedAmbiguousReadingCandidates(
        tokens, "這東西東西很好。", 7, catalogIdentityIndex(entries)),
      ...findAttestedAmbiguousReadingCandidates(
        [token(1, "他", "PRON"), token(2, "種", "VERB"), token(3, "花")],
        "他種花", 8, catalogIdentityIndex(entries)),
    ];
    const report = prepareBlindedReadingReviewSample(found, 5);
    expect(report.distinctTargetForms).toBe(2);
    expect(report.reviewerCases).toHaveLength(2);
    expect(report.organizerCases).toHaveLength(2);
    expect(report.reviewerCases[0]!.caseId).toBe("R01");
    expect(report.reviewerCases[0]!.rawAnswer.completeBopomofo).toBeNull();
    const onlyReviewer = JSON.stringify(report.reviewerCases);
    expect(onlyReviewer).not.toContain("possibleEntryIds");
    expect(onlyReviewer).not.toContain("ㄉㄨㄥ1");
    expect(onlyReviewer).not.toContain("ㄓㄨㄥ4");
    expect(JSON.stringify(report.organizerCases)).toContain("possibleEntryIds");
    expect(() => prepareBlindedReadingReviewSample(found, 0)).toThrow();
  });

  it("counts source ambiguity without promoting corpus UPOS to a label", () => {
    const sentences = [
      [token(1, "他", "PRON"), token(2, "種", "VERB"), token(3, "花", "NOUN")],
      [token(1, "他", "PRON"), token(2, "拿", "VERB"), token(3, "東西")],
      [token(1, "甲", "NOUN"), token(2, "乙", "NOUN"), token(3, "丙", "NOUN")],
    ];
    const audit = auditAttestedAmbiguousReadingCoverage(
      sentences, ["他種花", "他拿東西", "甲乙丙"], entries);
    expect(audit).toEqual({
      eligibleSourceSentenceCount: 2, ambiguousOccurrenceCount: 2,
      distinctAmbiguousForms: 2, contextSentenceCount: 2,
    });
    expect(() => auditAttestedAmbiguousReadingCoverage(sentences, [], entries)).toThrow();
  });
});
