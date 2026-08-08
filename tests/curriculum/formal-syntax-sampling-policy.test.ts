import { describe, expect, it } from "vitest";
import type { RandomSource } from "../../src/core/model.js";
import {
  activeSentenceConstructionFamilies,
  chooseSentenceConstructionVariant,
  createSentenceConstructionFamilyPlan,
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  rootFamilyAttemptBudget,
  SENTENCE_CONSTRUCTION_FAMILIES,
  sentenceConstructionFamilyPrior,
  sentenceConstructionKind,
  validateFormalSyntaxSamplingPolicy,
} from "../../src/curriculum/formal-syntax-sampling-policy.js";
import { sentenceConstructionClassification } from "../../src/curriculum/formal-syntax-taxonomy.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";

class SequenceRandom implements RandomSource {
  private index = 0;
  constructor(private readonly values: readonly number[]) {}
  next(): number {
    const value = this.values[this.index % this.values.length] ?? 0;
    this.index += 1;
    return value;
  }
}

describe("formal syntax family sampling policy", () => {
  it("keeps product frequency outside the formal grammar and scopes policy to Sentence roots", () => {
    expect(() => validateFormalSyntaxSamplingPolicy(PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY))
      .not.toThrow();
    expect(FORMAL_SYNTAX_RULES.every((rule) => !("weight" in rule))).toBe(true);
    expect("clauseKindWeights" in PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY).toBe(false);
    expect("clauseFamilyWeights" in PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY).toBe(false);
  });

  it("derives family kinds from the canonical taxonomy instead of a second mapping", () => {
    for (const family of SENTENCE_CONSTRUCTION_FAMILIES) {
      const rule = FORMAL_SYNTAX_RULES.find((candidate) =>
        candidate.output === "Sentence"
        && sentenceConstructionClassification(candidate.id)?.family === family,
      );
      expect(rule, family).toBeDefined();
      expect(sentenceConstructionKind(family)).toBe(
        sentenceConstructionClassification(rule!.id)!.kind,
      );
    }
  });

  it("assigns A-not-A one family prior and leaves unreachable complex sentences inactive", () => {
    expect(sentenceConstructionFamilyPrior("question.a-not-a")).toBeCloseTo(0.065, 10);
    expect(sentenceConstructionFamilyPrior("question.polar")).toBeCloseTo(0.091, 10);
    expect(sentenceConstructionFamilyPrior("question.constituent")).toBeCloseTo(0.078, 10);
    expect(sentenceConstructionFamilyPrior("statement.declarative")).toBeCloseTo(0.64, 10);
    expect(sentenceConstructionFamilyPrior("statement.complex")).toBe(0);
    expect(activeSentenceConstructionFamilies()).not.toContain("statement.complex");
  });

  it("orders root fallback by joint family weight instead of grouping all families by kind", () => {
    const familyIndex = new Map(SENTENCE_CONSTRUCTION_FAMILIES.map((family, index) => [family, index]));
    const candidates = FORMAL_SYNTAX_RULES
      .filter((rule) => rule.output === "Sentence")
      .sort((left, right) => {
        const leftFamily = sentenceConstructionClassification(left.id)?.family;
        const rightFamily = sentenceConstructionClassification(right.id)?.family;
        if (leftFamily === undefined || rightFamily === undefined) return 0;
        return familyIndex.get(leftFamily)! - familyIndex.get(rightFamily)!;
      });
    const plan = createSentenceConstructionFamilyPlan(
      candidates,
      // 0.78 selects question.polar from the joint prior; 0 then selects the
      // highest-weight remaining family, statement.declarative. The old nested
      // kind permutation would have kept the remaining question families ahead.
      new SequenceRandom([0.78, 0]),
    );

    expect(plan[0]?.family).toBe("question.polar");
    expect(plan[1]?.family).toBe("statement.declarative");
    expect(plan.map((item) => item.family)).not.toContain("statement.complex");
  });

  it("keeps family variants as identity only until one attempt selects exactly one", () => {
    const candidates = FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Sentence");
    const plan = createSentenceConstructionFamilyPlan(
      candidates,
      new SequenceRandom([0.80, 0, 0, 0, 0.40, 0, 0, 0, 0]),
    );
    const aNotA = plan.find((item) => item.family === "question.a-not-a");
    expect(aNotA).toBeDefined();
    expect(aNotA?.productionRuleIds).toEqual([
      "sentence.a-not-a-question",
      "sentence.a-not-a-transitive-question",
    ]);
    expect(chooseSentenceConstructionVariant(aNotA!, new SequenceRandom([0])))
      .toBe("sentence.a-not-a-question");
    expect(chooseSentenceConstructionVariant(aNotA!, new SequenceRandom([0.99])))
      .toBe("sentence.a-not-a-transitive-question");
  });

  it("derives family-local search budget from the active family count", () => {
    const familyCount = activeSentenceConstructionFamilies().length;
    expect(familyCount).toBe(7);
    expect(rootFamilyAttemptBudget(64, familyCount)).toBe(9);
    expect(rootFamilyAttemptBudget(64, 9)).toBe(7);
    expect(() => rootFamilyAttemptBudget(8, 9)).toThrow(/cannot cover 9 root families/u);
  });

  it("can target exactly one root production without filtering descendant grammar", () => {
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules: FORMAL_SYNTAX_RULES,
      random: new SequenceRandom([0]),
      maximumAttempts: 1,
      rootProductionRuleId: "sentence.declarative",
    });
    expect(shape?.root.productionRuleId).toBe("sentence.declarative");
    expect(shape?.productionRulePath.length).toBeGreaterThan(1);
    expect(shape?.productionRulePath[1]?.startsWith("clause.")).toBe(true);
  });

  it("fails closed if an external rule orderer filters eligible grammar rules", () => {
    expect(() => sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules: FORMAL_SYNTAX_RULES,
      random: new SequenceRandom([0]),
      maximumAttempts: 1,
      ruleOrderer: ({ candidates }) => candidates.slice(1),
    })).toThrow(/must return every eligible production exactly once/u);
  });

  it("rejects an unknown root target instead of silently changing grammar", () => {
    expect(() => sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules: FORMAL_SYNTAX_RULES,
      random: new SequenceRandom([0]),
      rootProductionRuleId: "sentence.not-real",
    })).toThrow(/references non-root production/u);
  });

  it("rejects non-positive active policy weights", () => {
    expect(() => validateFormalSyntaxSamplingPolicy({
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      sentenceFamilyWeights: {
        ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.sentenceFamilyWeights,
        "question.a-not-a": 0,
      },
    })).toThrow(/question\.a-not-a must be finite and positive/u);
  });

  it("rejects a positive-mass kind with no active family", () => {
    const { request: _request, ...withoutRequest } = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.sentenceFamilyWeights;
    expect(() => validateFormalSyntaxSamplingPolicy({
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      sentenceFamilyWeights: withoutRequest,
    })).toThrow(/sentence kind request has positive mass but no active construction families/u);
  });
});
