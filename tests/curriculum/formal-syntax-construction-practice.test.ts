import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  createSentenceConstructionPracticePlan,
} from "../../src/curriculum/formal-syntax-construction-practice.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { CAUSATIVE_FINITE_CCOMP_VIEW } from "../../src/syntax/causative-construction-view.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY,
} from "../../src/syntax/runtime-occurrence-capabilities.js";
import type { ProductionRule, RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const STABLE_RANDOM = { next: () => 0 };

function entry(id: string, text: string): CatalogEntry {
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
      score: 1,
      selectionWeight: 1,
      confidence: "reviewed",
      reasons: [],
    },
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
  options: {
    readonly occurrenceCapability?: boolean;
    readonly morphologicalFeatureCounts?: Readonly<Record<string, number>>;
  } = {},
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions,
    valencyFrames,
    ...(options.occurrenceCapability
      ? { occurrenceCapabilities: [CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY] }
      : {}),
    provenanceIds: ["test"],
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
      ...(options.morphologicalFeatureCounts === undefined
        ? {}
        : { morphologicalFeatureCounts: options.morphologicalFeatureCounts }),
    },
  };
}

function canonicalRule(ruleId: string): ProductionRule {
  const rule = FORMAL_SYNTAX_RULES.find((candidate) => candidate.id === ruleId);
  if (rule === undefined) throw new Error(`missing canonical test rule ${ruleId}`);
  return rule;
}

/**
 * Keep the real canonical productions but order the two Clause alternatives so
 * random=0 shuffles `clause.intransitive` to the front for the embedded Clause.
 * The outer Clause is independently pinned to `clause.object-content` by the
 * construction-practice plan.
 */
const CAUSATIVE_PRACTICE_RULES: readonly ProductionRule[] = [
  canonicalRule("sentence.declarative"),
  canonicalRule("clause.object-content"),
  canonicalRule("clause.intransitive"),
  canonicalRule("content.clause"),
  canonicalRule("argument.subject.noun"),
  canonicalRule("phrase.noun.bare"),
  canonicalRule("phrase.nominal-head.noun"),
  canonicalRule("predicate.verb.lexical"),
];

describe("formal syntax construction practice", () => {
  it("maps a reviewed Clause construction view onto one exact Sentence edge", () => {
    const plan = createSentenceConstructionPracticePlan(
      CAUSATIVE_FINITE_CCOMP_VIEW,
      { sentenceRuleId: "sentence.declarative", constituentKey: "clause" },
      CAUSATIVE_PRACTICE_RULES,
    );

    expect(plan.samplingMode).toBe("raw");
    expect(plan.structuralTarget).toEqual({
      rootProductionRuleId: "sentence.declarative",
      nestedProductionTargets: [{
        parentRuleId: "sentence.declarative",
        constituentKey: "clause",
        childRuleId: "clause.object-content",
      }],
    });
    expect(plan.rules).toHaveLength(CAUSATIVE_PRACTICE_RULES.length);
    const objectContent = plan.rules.find((rule) => rule.id === "clause.object-content");
    const matrixPredicate = objectContent?.constituents.find((item) => item.key === "predicate");
    expect(matrixPredicate).toMatchObject({
      requiredValencyFrames: ["clausal-complement"],
      requiredOccurrenceCapabilities: [CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY],
    });
    expect(matrixPredicate?.requiredFeatures.voice).toBeUndefined();
  });

  it("fails closed when the Sentence edge cannot host the view exactly once", () => {
    expect(() => createSentenceConstructionPracticePlan(
      CAUSATIVE_FINITE_CCOMP_VIEW,
      { sentenceRuleId: "missing.sentence", constituentKey: "clause" },
      CAUSATIVE_PRACTICE_RULES,
    )).toThrow(/invalid Sentence rule/u);

    expect(() => createSentenceConstructionPracticePlan(
      CAUSATIVE_FINITE_CCOMP_VIEW,
      { sentenceRuleId: "sentence.declarative", constituentKey: "missing" },
      CAUSATIVE_PRACTICE_RULES,
    )).toThrow(/missing Sentence constituent/u);

    expect(() => createSentenceConstructionPracticePlan(
      CAUSATIVE_FINITE_CCOMP_VIEW,
      { sentenceRuleId: "sentence.declarative", constituentKey: "punctuation" },
      CAUSATIVE_PRACTICE_RULES,
    )).toThrow(/category mismatch/u);

    const sentence = canonicalRule("sentence.declarative");
    const optionalClauseRules = CAUSATIVE_PRACTICE_RULES.map((rule) =>
      rule.id !== sentence.id
        ? rule
        : {
            ...rule,
            constituents: rule.constituents.map((item) =>
              item.key === "clause" ? { ...item, minimum: 0 } : item,
            ),
          },
    );
    expect(() => createSentenceConstructionPracticePlan(
      CAUSATIVE_FINITE_CCOMP_VIEW,
      { sentenceRuleId: "sentence.declarative", constituentKey: "clause" },
      optionalClauseRules,
    )).toThrow(/must occur exactly once/u);
  });

  it("realizes the explicit same-occurrence causative view as 讓他走", () => {
    const letEntry = entry("entry:let", "讓");
    const heEntry = entry("entry:he", "他");
    const walkEntry = entry("entry:walk", "走");
    const plan = createSentenceConstructionPracticePlan(
      CAUSATIVE_FINITE_CCOMP_VIEW,
      { sentenceRuleId: "sentence.declarative", constituentKey: "clause" },
      CAUSATIVE_PRACTICE_RULES,
    );

    const result = composeFormalSyntaxUtterances({
      ...plan,
      eligibleEntries: [letEntry, heEntry, walkEntry],
      profiles: [
        profile(
          "profile:let",
          letEntry.id,
          "VERB",
          ["predicate"],
          ["clausal-complement"],
          { occurrenceCapability: true },
        ),
        profile("profile:he", heEntry.id, "NOUN", ["subject"], ["avalent"]),
        profile("profile:walk", walkEntry.id, "VERB", ["predicate"], ["intransitive"]),
      ],
      random: STABLE_RANDOM,
      maximumCandidates: 1,
      maximumAttempts: 1,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      text: "讓他走",
      syntaxRootRuleId: "sentence.declarative",
      entries: [letEntry, heEntry, walkEntry],
    });
  });

  it("rejects aggregate Voice=Cau + ccomp when same-occurrence capability is absent", () => {
    const stopEntry = entry("entry:stop", "阻止");
    const heEntry = entry("entry:he", "他");
    const walkEntry = entry("entry:walk", "走");
    const plan = createSentenceConstructionPracticePlan(
      CAUSATIVE_FINITE_CCOMP_VIEW,
      { sentenceRuleId: "sentence.declarative", constituentKey: "clause" },
      CAUSATIVE_PRACTICE_RULES,
    );

    const result = composeFormalSyntaxUtterances({
      ...plan,
      eligibleEntries: [stopEntry, heEntry, walkEntry],
      profiles: [
        profile(
          "profile:stop",
          stopEntry.id,
          "VERB",
          ["predicate"],
          ["clausal-complement"],
          { morphologicalFeatureCounts: { "Voice=Cau": 1 } },
        ),
        profile("profile:he", heEntry.id, "NOUN", ["subject"], ["avalent"]),
        profile("profile:walk", walkEntry.id, "VERB", ["predicate"], ["intransitive"]),
      ],
      random: STABLE_RANDOM,
      maximumCandidates: 1,
      maximumAttempts: 1,
    });

    expect(result.candidates).toEqual([]);
    expect(result.fallbackReasons).toContain("formal-syntax-structural-sampling-exhausted");
    expect(result.fallbackReasons).toContain("formal-syntax-no-candidate");
  });
});
