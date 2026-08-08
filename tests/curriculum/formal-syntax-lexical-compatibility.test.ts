import { describe, expect, it } from "vitest";
import {
  buildLexicalCompatibilityIndex,
  type LexicalCompatibilityArtifact,
} from "../../src/compatibility/lexical-pairs.js";
import type { CatalogEntry, RandomSource } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import { sha256Canonical } from "../../src/reference/importers/canonical-json.js";
import type { ProductionRule, RuntimeSyntaxProfile } from "../../src/syntax/types.js";

class ConstantRandom implements RandomSource {
  public constructor(private readonly value: number) {}
  public next(): number {
    return this.value;
  }
}

function entry(id: string, text: string): CatalogEntry {
  return {
    id,
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄅ", "tone:1"] }],
    tags: ["test"],
    provenanceIds: ["test"],
  };
}

function profile(
  id: string,
  entryId: string,
  upos: RuntimeSyntaxProfile["upos"],
  functions: RuntimeSyntaxProfile["functions"],
  valencyFrames: RuntimeSyntaxProfile["valencyFrames"],
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions,
    valencyFrames,
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

const rule: ProductionRule = {
  id: "sentence.compatibility-test",
  grammarVersion: FORMAL_GRAMMAR_VERSION,
  output: "Sentence",
  constituents: [
    {
      key: "subject",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["PRON"],
      requiredFunctions: ["subject"],
      requiredValencyFrames: [],
      requiredFeatures: {},
    },
    {
      key: "predicate",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["VERB"],
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["transitive"],
      requiredFeatures: {},
    },
    {
      key: "object",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["NOUN"],
      requiredFunctions: ["object"],
      requiredValencyFrames: [],
      requiredFeatures: {},
    },
  ],
  surfaceOrders: [{
    id: "canonical",
    constituentKeys: ["subject", "predicate", "object"],
  }],
  constraints: [],
  positiveFixtureIds: ["fixture:positive"],
  negativeFixtureIds: ["fixture:negative"],
};

const punctuatedRule: ProductionRule = {
  ...rule,
  id: "sentence.compatibility-punctuation-test",
  constituents: [
    rule.constituents[0]!,
    rule.constituents[1]!,
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
    rule.constituents[2]!,
  ],
  surfaceOrders: [{
    id: "canonical",
    constituentKeys: ["subject", "predicate", "punctuation", "object"],
  }],
};

function compatibility() {
  const core = {
    adapterVersion: "fixture",
    schemaVersion: "ud-lexical-compatibility-v1" as const,
    source: { sourceId: "fixture" },
    candidateCount: 4,
    minimumPairCount: 1,
    surfaceObservationCount: 2,
    dependencyObservationCount: 0,
    surfacePairs: [{ leftText: "吃", rightText: "飯", count: 2, score: 1 }],
    dependencyPairs: [],
  } satisfies Omit<LexicalCompatibilityArtifact, "determinismDigest">;
  return buildLexicalCompatibilityIndex({
    ...core,
    determinismDigest: sha256Canonical(core),
  });
}

describe("formal syntax lexical compatibility weighting", () => {
  const subject = entry("entry:subject", "我");
  const verb = entry("entry:verb", "吃");
  const food = entry("entry:food", "飯");
  const theory = entry("entry:theory", "理論");
  const entries = [subject, verb, food, theory];
  const profiles = [
    profile("profile:subject", subject.id, "PRON", ["subject"], ["avalent"]),
    profile("profile:verb", verb.id, "VERB", ["predicate"], ["transitive"]),
    profile("profile:food", food.id, "NOUN", ["object"], ["avalent"]),
    profile("profile:theory", theory.id, "NOUN", ["object"], ["avalent"]),
  ];
  const weights = Object.fromEntries(entries.map((item) => [item.id, 1]));

  it("preserves the original selection when no compatibility evidence is supplied", () => {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: entries,
      profiles,
      entryWeightsById: weights,
      random: new ConstantRandom(0.6),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules: [rule],
    });
    expect(result.candidates[0]?.text).toBe("我吃理論");
  });

  it("boosts an observed pair without making the unseen pair illegal", () => {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: entries,
      profiles,
      entryWeightsById: weights,
      lexicalCompatibility: compatibility(),
      lexicalCompatibilityMaximumBoost: 4,
      random: new ConstantRandom(0.6),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules: [rule],
    });
    expect(result.candidates[0]?.text).toBe("我吃飯");
  });

  it("does not apply surface-pair evidence across punctuation", () => {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: entries,
      profiles,
      entryWeightsById: weights,
      lexicalCompatibility: compatibility(),
      lexicalCompatibilityMaximumBoost: 4,
      random: new ConstantRandom(0.6),
      maximumCandidates: 1,
      maximumAttempts: 1,
      rules: [punctuatedRule],
    });
    expect(result.candidates[0]?.text).toBe("我吃理論");
  });
});
