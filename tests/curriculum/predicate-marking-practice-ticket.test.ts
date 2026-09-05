import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import {
  createSentenceConstructionFamilyPlan,
  createSentenceConstructionFamilyPlanSample,
  predicateMarkingPracticeIntentForTicketUnit,
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
} from "../../src/curriculum/formal-syntax-sampling-policy.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";

const PRODUCT_BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;

class SequenceRandom {
  private index = 0;
  constructor(private readonly values: readonly number[]) {}
  next(): number {
    const value = this.values[this.index];
    if (value === undefined) throw new Error("sequence random exhausted");
    this.index += 1;
    return value;
  }
}

describe("predicate marking practice ticket", () => {
  it("supports explicit ordinary and negation practice tickets", () => {
    expect(predicateMarkingPracticeIntentForTicketUnit(0.5, {
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      version: "predicate-marking-ticket-test-always-ordinary",
      predicateMarkingPracticeWeights: { ordinary: 1, negation: 0 },
    })).toBe("ordinary");
    expect(predicateMarkingPracticeIntentForTicketUnit(0.5, {
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      version: "predicate-marking-ticket-test-always-negation",
      predicateMarkingPracticeWeights: { ordinary: 0, negation: 1 },
    })).toBe("negation");
  });

  it("uses the measured product marking prior", () => {
    expect(PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.version).toBe("formal-syntax-family-sampling-v5");
    expect(PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.predicateMarkingPracticeWeights).toEqual({
      ordinary: 0.943,
      negation: 0.057,
    });
  });

  it("maps the terminal unit directly through the configured weights", () => {
    expect(predicateMarkingPracticeIntentForTicketUnit(0.9429)).toBe("ordinary");
    expect(predicateMarkingPracticeIntentForTicketUnit(0.943)).toBe("negation");
    expect(() => predicateMarkingPracticeIntentForTicketUnit(1)).toThrow(/ticket unit/u);
  });

  it("reuses the existing terminal permutation draw without moving RNG trajectory", () => {
    const values = Array.from({ length: 32 }, (_, index) => (index + 1) / 40);
    const sampledRandom = new SequenceRandom(values);
    const wrappedRandom = new SequenceRandom(values);
    const sampled = createSentenceConstructionFamilyPlanSample(
      FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Sentence"),
      sampledRandom,
    );
    const wrapped = createSentenceConstructionFamilyPlan(
      FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Sentence"),
      wrappedRandom,
    );

    expect(sampled.plan).toEqual(wrapped);
    expect(sampled.predicateMarkingTicketUnit).toBe(values[sampled.plan.length - 1]);
    expect(sampledRandom.next()).toBe(values[sampled.plan.length]);
    expect(wrappedRandom.next()).toBe(values[sampled.plan.length]);
  });

  it("keeps terminal-ticket incidence close to the configured weight", () => {
    const sampleCount = 8192;
    let negationCount = 0;
    for (let round = 0; round < sampleCount; round += 1) {
      const sampled = createSentenceConstructionFamilyPlanSample(
        FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Sentence"),
        createSeededRandom(`predicate-marking-terminal-ticket:${round}`),
      );
      if (predicateMarkingPracticeIntentForTicketUnit(sampled.predicateMarkingTicketUnit) === "negation") {
        negationCount += 1;
      }
    }
    expect(Math.abs(negationCount / sampleCount - 0.057)).toBeLessThan(0.008);
  });

  it("fails closed on invalid marking practice weights", () => {
    expect(() => predicateMarkingPracticeIntentForTicketUnit(0.5, {
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
  }, 30_000);
});
