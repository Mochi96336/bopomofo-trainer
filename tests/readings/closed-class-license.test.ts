import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry, RandomSource } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { reviewedClosedClassReadingEligible } from "../../src/readings/closed-class-license.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import type { ProductionRule, RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

function entry(text: string, reading: string): CatalogEntry {
  return {
    id: catalogEntryId(text, reading),
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄏ", "tone:2"] }],
    tags: ["test"],
    provenanceIds: ["test"],
  };
}

function profile(
  entryId: string,
  upos: Upos,
  functions: RuntimeSyntaxProfile["functions"],
): RuntimeSyntaxProfile {
  return {
    id: "profile:" + entryId + ":" + upos,
    entryId,
    upos,
    functions,
    valencyFrames: ["avalent"],
    dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
    provenanceIds: ["test"],
  };
}

class ConstantRandom implements RandomSource {
  public constructor(private readonly value: number) {}
  public next(): number { return this.value; }
}

const rule: ProductionRule = {
  id: "sentence.closed-class-reading-trial",
  grammarVersion: FORMAL_GRAMMAR_VERSION,
  output: "Sentence",
  constituents: [
    {
      key: "subject", category: "Lexeme", minimum: 1, maximum: 1,
      recursive: false, allowedUpos: ["PRON"], requiredFunctions: ["subject"],
      requiredValencyFrames: [], requiredFeatures: {},
    },
    {
      key: "connector", category: "Lexeme", minimum: 1, maximum: 1,
      recursive: false, allowedUpos: ["CCONJ"], requiredFunctions: ["coordinator"],
      requiredValencyFrames: [], requiredFeatures: {},
    },
  ],
  surfaceOrders: [{ id: "canonical", constituentKeys: ["subject", "connector"] }],
  constraints: [],
  positiveFixtureIds: ["fixture:yes"],
  negativeFixtureIds: ["fixture:no"],
};

describe("reviewed closed-class reading eligibility (used in production via combined gate)", () => {
  it("uses already-pinned conjunction readings without removing homograph lexical identities", () => {
    const approved = entry("和", "ㄏㄜ2");
    const alternative = entry("和", "ㄏㄨㄛ4");
    expect(reviewedClosedClassReadingEligible(
      approved, profile(approved.id, "CCONJ", ["coordinator"]),
    )).toBe(true);
    expect(reviewedClosedClassReadingEligible(
      alternative, profile(alternative.id, "CCONJ", ["coordinator"]),
    )).toBe(false);
    expect(reviewedClosedClassReadingEligible(
      alternative, profile(alternative.id, "VERB", ["predicate"]),
    )).toBe(true);
  });

  it("also checks 與 as coordinator, but leaves unreviewed 那 alone", () => {
    const yuCorrect = entry("與", "ㄩ3");
    const yuOther = entry("與", "ㄩ2");
    expect(reviewedClosedClassReadingEligible(
      yuCorrect, profile(yuCorrect.id, "CCONJ", ["coordinator"]),
    )).toBe(true);
    expect(reviewedClosedClassReadingEligible(
      yuOther, profile(yuOther.id, "CCONJ", ["coordinator"]),
    )).toBe(false);
    const na = entry("那", "ㄋㄨㄛ2");
    expect(reviewedClosedClassReadingEligible(
      na, profile(na.id, "PRON", ["subject"]),
    )).toBe(true);
  });

  it("pins known auxiliary/disposal readings while leaving lexical use out of scope", () => {
    for (const [text, correct, other, upos] of [
      ["了", "ㄌㄜ5", "ㄌㄧㄠ4", "AUX"],
      ["著", "ㄓㄜ5", "ㄓㄠ1", "AUX"],
      ["把", "ㄅㄚ3", "ㄅㄚ4", "ADP"],
      ["將", "ㄐㄧㄤ1", "ㄑㄧㄤ1", "ADP"],
    ] as const) {
      const accepted = entry(text, correct);
      const rejected = entry(text, other);
      expect(reviewedClosedClassReadingEligible(
        accepted, profile(accepted.id, upos, ["marker"]),
      )).toBe(true);
      expect(reviewedClosedClassReadingEligible(
        rejected, profile(rejected.id, upos, ["marker"]),
      )).toBe(false);
      expect(reviewedClosedClassReadingEligible(
        rejected, profile(rejected.id, "VERB", ["predicate"]),
      )).toBe(true);
    }
  });

  it("rejects an entry/profile identity mismatch", () => {
    const accepted = entry("和", "ㄏㄜ2");
    const wrong = entry("和", "ㄏㄨㄛ4");
    expect(() => reviewedClosedClassReadingEligible(
      accepted, profile(wrong.id, "CCONJ", ["coordinator"]),
    )).toThrow("actually selected catalog identity");
  });

  it("does not consume extra randomness or change a valid original selection", () => {
    const subject = entry("我", "ㄨㄛ3");
    const correct = entry("和", "ㄏㄜ2");
    const wrong = entry("和", "ㄏㄨㄛ4");
    const entries = [subject, correct, wrong];
    const profiles = [
      profile(subject.id, "PRON", ["subject"]),
      profile(correct.id, "CCONJ", ["coordinator"]),
      profile(wrong.id, "CCONJ", ["coordinator"]),
    ];
    class CountedRandom implements RandomSource {
      public calls = 0;
      public next(): number { this.calls += 1; return 0; }
    }
    const ordinaryRandom = new CountedRandom();
    const trialRandom = new CountedRandom();
    const common = {
      eligibleEntries: entries,
      profiles,
      rules: [rule],
      samplingMode: "raw" as const,
      minimumLexicalEntries: 2,
      maximumCandidates: 1,
      maximumAttempts: 8,
    };
    const original = composeFormalSyntaxUtterances({
      ...common,
      random: ordinaryRandom,
    });
    const trial = composeFormalSyntaxUtterances({
      ...common,
      random: trialRandom,
      readingEligibility: reviewedClosedClassReadingEligible,
    });
    expect(original.candidates).toHaveLength(1);
    expect(trial.candidates).toEqual(original.candidates);
    expect(trialRandom.calls).toBe(ordinaryRandom.calls);
  });

  it("filters general lexical slots when explicitly opted in", () => {
    const subject = entry("我", "ㄨㄛ3");
    const correct = entry("和", "ㄏㄜ2");
    const wrong = entry("和", "ㄏㄨㄛ4");
    const composition = composeFormalSyntaxUtterances({
      eligibleEntries: [subject, correct, wrong],
      profiles: [
        profile(subject.id, "PRON", ["subject"]),
        profile(correct.id, "CCONJ", ["coordinator"]),
        profile(wrong.id, "CCONJ", ["coordinator"]),
      ],
      rules: [rule],
      samplingMode: "raw",
      random: new ConstantRandom(0.75),
      minimumLexicalEntries: 2,
      maximumCandidates: 1,
      maximumAttempts: 8,
      readingEligibility: reviewedClosedClassReadingEligible,
    });
    expect(composition.candidates).toHaveLength(1);
    expect(composition.candidates[0]?.entries.map((item) => item.id)).toEqual([
      subject.id,
      correct.id,
    ]);
  });
});
