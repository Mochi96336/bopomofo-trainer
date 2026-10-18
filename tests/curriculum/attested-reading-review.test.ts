import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import { catalogIdentityIndex } from "../../src/curriculum/attested-sentence-candidates.js";
import {
  auditAttestedAmbiguousReadingCoverage,
  findAttestedAmbiguousReadingCandidates,
  prepareBlindedReadingReviewSample,
  preparePairedBlindedReadingReviewSample,
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

  it("samples two distinct contexts of the same form, including same-UPOS ambiguity", () => {
    const contextRows = [
      {
        tokens: [token(1, "街道", "NOUN"), token(2, "東西"), token(3, "延伸", "VERB")],
        text: "街道東西延伸",
      },
      {
        tokens: [token(1, "我們", "PRON"), token(2, "拿", "VERB"), token(3, "東西")],
        text: "我們拿東西",
      },
      {
        tokens: [token(1, "一", "NUM"), token(2, "種", "NOUN"), token(3, "花")],
        text: "一種花",
      },
      {
        tokens: [token(1, "農夫", "NOUN"), token(2, "種", "VERB"), token(3, "花")],
        text: "農夫種花",
      },
    ];
    const source = contextRows.flatMap((row, index) =>
      findAttestedAmbiguousReadingCandidates(
        row.tokens, row.text, index, catalogIdentityIndex(entries),
      ));
    const out = preparePairedBlindedReadingReviewSample(source, 4);
    expect(out.reviewerCases).toHaveLength(4);
    expect(out.organizerCases).toHaveLength(4);
    expect(out.eligiblePairedForms).toBe(2);
    expect(out.sameUposPairCount).toBe(1);
    expect(out.differentUposPairCount).toBe(1);
    const byPair = new Map<string, typeof out.organizerCases[number][]>();
    for (const row of out.organizerCases) {
      const prev = byPair.get(row.pairId) ?? [];
      prev.push(row);
      byPair.set(row.pairId, prev);
    }
    expect(byPair.size).toBe(2);
    expect([...byPair.values()].every(rows =>
      rows.length === 2 && rows[0]!.text === rows[1]!.text
      && rows[0]!.sourceSentenceIndex !== rows[1]!.sourceSentenceIndex)).toBe(true);
    expect(new Set(out.organizerCases.map(row => row.sourceSentenceIndex)).size).toBe(4);
    expect(out.organizerCases.every((row, i) =>
      i === 0 || row.pairId !== out.organizerCases[i - 1]!.pairId)).toBe(true);
    // Reviewer case ordering is not two aligned lists exposing which cases pair.
    expect(out.organizerCases.map(row => row.pairId)).not.toEqual([
      "P01", "P02", "P01", "P02",
    ]);
    const blind = JSON.stringify(out.reviewerCases);
    expect(blind).not.toContain("possibleEntryIds");
    expect(blind).not.toContain("sourceUpos");
    expect(blind).not.toContain("pairId");
    expect(blind).not.toContain("ㄓㄨㄥ");
    expect(blind).not.toContain("ㄉㄨㄥ");
    expect(() => preparePairedBlindedReadingReviewSample(source, 3)).toThrow("even");
  });

  it("prefers locally different context over distant but identical usage frames", () => {
    const contexts = [
      { text: "我買東西", tokens: [token(1, "我", "PRON"), token(2, "買", "VERB"), token(3, "東西")] },
      { text: "道路東西延伸", tokens: [token(1, "道路"), token(2, "東西"), token(3, "延伸", "VERB")] },
      { text: "昨天我買東西", tokens: [token(1, "昨天"), token(2, "我", "PRON"), token(3, "買", "VERB"), token(4, "東西")] },
    ];
    const rows = contexts.flatMap((row, sourceSentenceIndex) =>
      findAttestedAmbiguousReadingCandidates(
        row.tokens, row.text, sourceSentenceIndex, catalogIdentityIndex(entries),
      ));
    const result = preparePairedBlindedReadingReviewSample(rows, 2);
    expect(result.organizerCases).toHaveLength(2);
    const chosenIndices = result.organizerCases.map(row => row.sourceSentenceIndex).sort();
    // The old "maximum sentence-index distance" policy took 0 and 2, even
    // though both literally use 我買東西. Now the contrast includes 道路...延伸.
    expect(chosenIndices).toContain(1);
    expect(chosenIndices).not.toEqual([0, 2]);
    expect(preparePairedBlindedReadingReviewSample([...rows].reverse(), 2))
      .toEqual(result);
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
