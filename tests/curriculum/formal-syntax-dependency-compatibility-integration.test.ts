import { describe, expect, it } from "vitest";
import {
  buildLexicalCompatibilityIndex,
  type LexicalCompatibilityArtifact,
} from "../../src/compatibility/lexical-pairs.js";
import type { CatalogEntry, RandomSource } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { sha256Canonical } from "../../src/reference/importers/canonical-json.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

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
  valencyFrames: RuntimeSyntaxProfile["valencyFrames"],
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions: upos === "VERB" ? ["predicate"] : [],
    valencyFrames,
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

function dependencyCompatibility() {
  const core = {
    adapterVersion: "fixture",
    schemaVersion: "ud-lexical-compatibility-v1" as const,
    source: { sourceId: "fixture" },
    candidateCount: 4,
    minimumPairCount: 1,
    surfaceObservationCount: 0,
    dependencyObservationCount: 2,
    surfacePairs: [],
    dependencyPairs: [{
      headText: "吃",
      dependentText: "飯",
      relation: "obj",
      count: 2,
      score: 1,
    }],
  } satisfies Omit<LexicalCompatibilityArtifact, "determinismDigest">;
  return buildLexicalCompatibilityIndex({
    ...core,
    determinismDigest: sha256Canonical(core),
  });
}

const keep = new Set([
  "sentence.declarative",
  "clause.transitive",
  "argument.subject.noun",
  "argument.object.noun",
  "phrase.noun.bare",
  "phrase.nominal-head.noun",
  "predicate.verb.lexical",
  "phrase.punctuation.lexical",
]);
const RULES = FORMAL_SYNTAX_RULES.filter((rule) => keep.has(rule.id));
const SUBJECT = entry("entry:subject", "我");
const VERB = entry("entry:verb", "吃");
const FOOD = entry("entry:food", "飯");
const THEORY = entry("entry:theory", "理論");
const ENTRIES = [SUBJECT, VERB, FOOD, THEORY];
const PROFILES = [
  profile("profile:subject", SUBJECT.id, "NOUN", ["avalent"]),
  profile("profile:verb", VERB.id, "VERB", ["transitive"]),
  profile("profile:food", FOOD.id, "NOUN", ["avalent"]),
  profile("profile:theory", THEORY.id, "NOUN", ["avalent"]),
];
const WEIGHTS = {
  [SUBJECT.id]: 100,
  [VERB.id]: 1,
  [FOOD.id]: 1,
  [THEORY.id]: 1,
};

function compose(lexicalCompatibility?: ReturnType<typeof dependencyCompatibility>) {
  return composeFormalSyntaxUtterances({
    eligibleEntries: ENTRIES,
    profiles: PROFILES,
    entryWeightsById: WEIGHTS,
    ...(lexicalCompatibility === undefined ? {} : { lexicalCompatibility }),
    lexicalCompatibilityMaximumBoost: 4,
    random: new ConstantRandom(0.6),
    maximumCandidates: 1,
    maximumAttempts: 1,
    rules: RULES,
    samplingMode: "raw",
    structuralTarget: {
      rootProductionRuleId: "sentence.declarative",
      nestedProductionTargets: [{
        parentRuleId: "sentence.declarative",
        constituentKey: "clause",
        childRuleId: "clause.transitive",
      }],
    },
  });
}

describe("formal syntax dependency compatibility integration", () => {
  it("keeps the baseline choice when no lexical compatibility index is supplied", () => {
    expect(compose().candidates[0]?.text).toBe("我吃理論");
  });

  it("uses obj dependency evidence even when surface-pair evidence is empty", () => {
    expect(compose(dependencyCompatibility()).candidates[0]?.text).toBe("我吃飯");
  });
});