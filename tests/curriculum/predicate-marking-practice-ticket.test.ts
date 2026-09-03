import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import {
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  predicateMarkingPracticeIntentForFamilyPlan,
  type SentenceConstructionFamilyPlan,
} from "../../src/curriculum/formal-syntax-sampling-policy.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";

const PRODUCT_BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;

const PLAN: readonly SentenceConstructionFamilyPlan[] = [{
  kind: "statement",
  family: "statement.declarative",
  productionRuleIds: ["sentence.declarative"],
}];

describe("predicate marking practice ticket", () => {
  it("keeps the mechanism-first default ordinary and supports an explicit negation ticket", () => {
    expect(predicateMarkingPracticeIntentForFamilyPlan(PLAN)).toBe("ordinary");
    expect(predicateMarkingPracticeIntentForFamilyPlan(PLAN, {
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      version: "predicate-marking-ticket-test-always-negation",
      predicateMarkingPracticeWeights: { ordinary: 0, negation: 1 },
    })).toBe("negation");
  });

  it("fails closed on invalid marking practice weights", () => {
    expect(() => predicateMarkingPracticeIntentForFamilyPlan(PLAN, {
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      version: "predicate-marking-ticket-test-zero",
      predicateMarkingPracticeWeights: { ordinary: 0, negation: 0 },
    })).toThrow(/require positive mass/u);
  });

  it("accepts only overt negative surfaces when the product ticket always requires negation", () => {
    const policy = {
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      version: "predicate-marking-ticket-test-product",
      predicateMarkingPracticeWeights: { ordinary: 0, negation: 1 },
    } as const;
    for (let round = 0; round < 16; round += 1) {
      const composition = composeFormalSyntaxUtterances({
        eligibleEntries: PRACTICE_CATALOG,
        profiles: SYNTAX_PROFILES,
        random: createSeededRandom(`predicate-marking-ticket:${round}`),
        samplingMode: "product-family",
        samplingPolicy: policy,
        minimumLexicalEntries: 2,
        maximumCandidates: 1,
        maximumAttempts: 64,
        bounds: PRODUCT_BOUNDS,
      });
      expect(composition.candidates, JSON.stringify(composition.fallbackReasons)).toHaveLength(1);
      expect(composition.candidates[0]!.text).toMatch(/[不未別沒非無]/u);
    }
  });
});
