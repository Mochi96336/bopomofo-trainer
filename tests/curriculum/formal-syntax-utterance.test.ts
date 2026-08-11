import { describe, expect, it } from "vitest";
import type { CatalogEntry, RandomSource } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import type { ProductionRule, SyntaxProfile } from "../../src/syntax/types.js";

class SequenceRandom implements RandomSource {
  private index = 0;
  constructor(private readonly values: readonly number[]) {}
  next(): number {
    const value = this.values[this.index % this.values.length] ?? 0;
    this.index += 1;
    return value;
  }
}

function entry(id: string, text: string, selectionWeight: number): CatalogEntry {
  return {
    id,
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄅ", "tone:1"] }],
    commonnessBase: {
      modelVersion: "commonness-v1",
      sourceId: "test",
      sourceVersion: "test-v1",
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
    tags: ["test"],
    provenanceIds: ["test"],
  };
}

function typedProfile(
  id: string,
  entryId: string,
  upos: SyntaxProfile["upos"],
  functions: SyntaxProfile["functions"],
  valencyFrames: SyntaxProfile["valencyFrames"],
  dependencyRelationCounts: Readonly<Record<string, number>>,
): SyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions,
    valencyFrames,
    provenanceIds: ["test"],
    dependencyEvidence: {
      evidenceScope: "per-upos",
      occurrenceCount: 1,
      dependencyRelationCounts,
      morphologicalFeatureCounts: {},
      parentUposCounts: {},
      headDirectionCounts: {},
      surfacePositionCounts: {},
      childRelationCounts: {},
      childDirectionRelationCounts: {},
      childRelationMultisetCounts: { none: 1 },
      valencyRelationCounts: {},
      valencySignatureCounts: { none: 1 },
      constructionRelationCounts: {},
      anonymousDependencySkeletons: [],
      rootCount: 0,
    },
  };
}

function profile(id: string, entryId: string): SyntaxProfile {
  return typedProfile(
    id,
    entryId,
    "NOUN",
    ["subject"],
    ["avalent"],
    { nsubj: 1 },
  );
}

const rules: readonly ProductionRule[] = [
  {
    id: "sentence.test",
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output: "Sentence",
    constituents: [{
      key: "subject",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["NOUN"],
      requiredFunctions: ["subject"],
      requiredValencyFrames: [],
      requiredFeatures: {},
    }],
    surfaceOrders: [{ id: "canonical", constituentKeys: ["subject"] }],
    constraints: [],
    positiveFixtureIds: ["sentence.test:positive"],
    negativeFixtureIds: ["sentence.test:negative"],
  },
];

const punctuatedRules: readonly ProductionRule[] = [{
  ...rules[0]!,
  id: "sentence.test-punctuated",
  constituents: [
    ...rules[0]!.constituents,
    {
      key: "punctuation",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["PUNCT"],
      requiredFunctions: [],
      requiredValencyFrames: [],
      requiredFeatures: {},
    },
  ],
  surfaceOrders: [{
    id: "canonical",
    constituentKeys: ["subject", "punctuation"],
  }],
  positiveFixtureIds: ["sentence.test-punctuated:positive"],
  negativeFixtureIds: ["sentence.test-punctuated:negative"],
}];

const twoSlotRules: readonly ProductionRule[] = [{
  ...rules[0]!,
  id: "sentence.test-two-slots",
  constituents: [
    { ...rules[0]!.constituents[0]!, key: "first" },
    { ...rules[0]!.constituents[0]!, key: "second" },
  ],
  surfaceOrders: [{
    id: "canonical",
    constituentKeys: ["first", "second"],
  }],
  positiveFixtureIds: ["sentence.test-two-slots:positive"],
  negativeFixtureIds: ["sentence.test-two-slots:negative"],
}];

describe("frequency-first formal syntax compatibility composer", () => {
  it("uses only stage-eligible entries and returns a formal candidate", () => {
    const eligible = entry("entry:eligible", "甲", 0.9);
    const excluded = entry("entry:excluded", "乙", 0.1);
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: [eligible],
      profiles: [
        profile("profile:eligible", eligible.id),
        profile("profile:excluded", excluded.id),
      ],
      random: new SequenceRandom([0]),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules,
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      kind: "formal-syntax",
      text: "甲",
      templateId: null,
    });
    expect(result.candidates[0]?.entries.map((item) => item.id)).toEqual([eligible.id]);
  });

  it("keeps punctuation separate from candidate text", () => {
    const eligible = entry("entry:eligible", "甲", 0.9);
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: [eligible],
      profiles: [profile("profile:eligible", eligible.id)],
      random: new SequenceRandom([0]),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules: punctuatedRules,
    });
    expect(result.candidates[0]).toMatchObject({
      text: "甲",
      punctuation: "。",
    });
  });

  it("applies explicit post-eligibility entry weights", () => {
    const first = entry("entry:first", "甲", 0.9);
    const second = entry("entry:second", "乙", 0.9);
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: [first, second],
      profiles: [profile("profile:first", first.id), profile("profile:second", second.id)],
      entryWeightsById: { [first.id]: 0, [second.id]: 1 },
      random: new SequenceRandom([0]),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules,
    });
    expect(result.candidates[0]?.entries.map((item) => item.id)).toEqual([second.id]);
  });

  it("does not multiply entry weight by compatible profile count", () => {
    const first = entry("entry:first", "甲", 0.9);
    const second = entry("entry:second", "乙", 0.9);
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: [first, second],
      profiles: [
        profile("profile:first-a", first.id),
        profile("profile:first-b", first.id),
        profile("profile:second", second.id),
      ],
      random: new SequenceRandom([0, 0, 0.6]),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules,
    });
    expect(result.candidates[0]?.entries.map((item) => item.id)).toEqual([second.id]);
  });

  it("does not reuse one entry in multiple lexical slots", () => {
    const first = entry("entry:first", "甲", 0.9);
    const second = entry("entry:second", "乙", 0.9);
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: [first, second],
      profiles: [profile("profile:first", first.id), profile("profile:second", second.id)],
      random: new SequenceRandom([0]),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules: twoSlotRules,
    });
    expect(result.candidates[0]?.entries.map((item) => item.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it("keeps an intransitive verb out of a transitive predicate even when it is heavily weighted", () => {
    const subject = entry("entry:subject", "我", 1);
    const transitive = entry("entry:transitive", "吃", 0.01);
    const intransitive = entry("entry:intransitive", "睡", 1);
    const object = entry("entry:object", "飯", 1);
    const keep = new Set([
      "sentence.declarative",
      "clause.transitive",
      "argument.subject.noun",
      "argument.object.noun",
      "phrase.noun.bare",
      "phrase.nominal-head.noun",
      "predicate.verb.lexical",
    ]);
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: [subject, transitive, intransitive, object],
      profiles: [
        typedProfile("profile:subject", subject.id, "NOUN", ["subject"], ["avalent"], { nsubj: 1 }),
        typedProfile("profile:transitive", transitive.id, "VERB", ["predicate"], ["transitive"], { root: 1 }),
        typedProfile("profile:intransitive", intransitive.id, "VERB", ["predicate"], ["intransitive"], { root: 1 }),
        typedProfile("profile:object", object.id, "NOUN", ["object"], ["avalent"], { obj: 1 }),
      ],
      entryWeightsById: {
        [subject.id]: 1,
        [transitive.id]: 0.01,
        [intransitive.id]: 100,
        [object.id]: 1,
      },
      random: new SequenceRandom([0]),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules: FORMAL_SYNTAX_RULES.filter((rule) => keep.has(rule.id)),
    });
    const candidateIds = result.candidates[0]?.entries.map((item) => item.id);
    expect(candidateIds).toBeDefined();
    expect(candidateIds?.[1]).toBe(transitive.id);
    expect(candidateIds).not.toContain(intransitive.id);
    expect([candidateIds?.[0], candidateIds?.[2]].sort()).toEqual([subject.id, object.id].sort());
  });

  it("fails closed without silently assigning a missing profile", () => {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: [entry("entry:eligible", "甲", 0.9)],
      profiles: [],
      random: new SequenceRandom([0]),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules,
    });
    expect(result.candidates).toEqual([]);
    expect(result.fallbackReasons).toContain("formal-syntax-no-candidate");
    expect(result.fallbackReasons).toContain("formal-syntax-structural-sampling-exhausted");
  });
});