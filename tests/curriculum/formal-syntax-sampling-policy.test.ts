import { describe, expect, it } from "vitest";
import type { RandomSource } from "../../src/core/model.js";
import {
  createFormalSyntaxFamilyRuleOrderer,
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  sentenceConstructionFamilyPrior,
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
  it("keeps product frequency outside the formal grammar", () => {
    expect(() => validateFormalSyntaxSamplingPolicy(PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY))
      .not.toThrow();
    expect(FORMAL_SYNTAX_RULES.every((rule) => !("weight" in rule))).toBe(true);
  });

  it("assigns A-not-A one family prior instead of two production tickets", () => {
    expect(sentenceConstructionFamilyPrior("question.a-not-a")).toBeCloseTo(0.065, 10);
    expect(sentenceConstructionFamilyPrior("question.polar")).toBeCloseTo(0.091, 10);
    expect(sentenceConstructionFamilyPrior("question.constituent")).toBeCloseTo(0.078, 10);
  });

  it("keeps variants together after a family is selected", () => {
    const candidates = FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Sentence");
    const orderer = createFormalSyntaxFamilyRuleOrderer();
    const ordered = orderer({
      category: "Sentence",
      candidates,
      // First draw selects question (0.64..0.90). After the remaining kind
      // permutation is consumed, 0.40 selects A-not-A within question.
      random: new SequenceRandom([0.70, 0, 0, 0, 0.40, 0, 0, 0, 0, 0]),
    });
    expect(ordered).not.toBeNull();
    const firstTwo = ordered!.slice(0, 2).map((rule) =>
      sentenceConstructionClassification(rule.id)?.family,
    );
    expect(firstTwo).toEqual(["question.a-not-a", "question.a-not-a"]);
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

  it("rejects non-positive policy weights", () => {
    expect(() => validateFormalSyntaxSamplingPolicy({
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      sentenceFamilyWeights: {
        ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.sentenceFamilyWeights,
        "question.a-not-a": 0,
      },
    })).toThrow(/question\.a-not-a must be finite and positive/u);
  });
});
