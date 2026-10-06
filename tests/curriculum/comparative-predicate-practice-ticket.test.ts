import { describe, expect, it } from "vitest";
import {
  comparativePredicatePracticeIntentForTicketUnit,
  comparativePredicatePracticeTicketUnitForTerminalUnit,
  createSentenceConstructionFamilyPlanSample,
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
} from "../../src/curriculum/formal-syntax-sampling-policy.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";

describe("comparative predicate practice ticket", () => {
  it("supports independently forced adjectival and verbal intents", () => {
    const base = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY;
    expect(comparativePredicatePracticeIntentForTicketUnit(0.5, {
      ...base,
      version: "comparative-predicate-always-adjectival",
      comparativePredicatePracticeWeights: { adjectival: 1, verbal: 0 },
    })).toBe("adjectival");
    expect(comparativePredicatePracticeIntentForTicketUnit(0.5, {
      ...base,
      version: "comparative-predicate-always-verbal",
      comparativePredicatePracticeWeights: { adjectival: 0, verbal: 1 },
    })).toBe("verbal");
  });

  it("domain-separates comparative practice from the terminal family draw", () => {
    const terminal = 0.9;
    const projected = comparativePredicatePracticeTicketUnitForTerminalUnit(terminal);
    expect(projected).toBeGreaterThanOrEqual(0);
    expect(projected).toBeLessThan(1);
    expect(projected).not.toBe(terminal);
  });

  it("uses the explicit conservative product-practice prior", () => {
    expect(PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.comparativePredicatePracticeWeights).toEqual({
      adjectival: 0.8,
      verbal: 0.2,
    });

    const sampleCount = 8192;
    let verbal = 0;
    for (let round = 0; round < sampleCount; round += 1) {
      const sample = createSentenceConstructionFamilyPlanSample(
        FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Sentence"),
        createSeededRandom(`comparative-predicate-terminal-ticket:${round}`),
      );
      expect(sample.comparativePredicateTicketUnit).toBe(sample.predicateMarkingTicketUnit);
      if (comparativePredicatePracticeIntentForTicketUnit(
        sample.comparativePredicateTicketUnit,
      ) === "verbal") verbal += 1;
    }
    expect(Math.abs(verbal / sampleCount - 0.2)).toBeLessThan(0.01);
  });

  it("fails closed on invalid comparative practice weights", () => {
    expect(() => comparativePredicatePracticeIntentForTicketUnit(0.5, {
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      version: "comparative-predicate-zero",
      comparativePredicatePracticeWeights: { adjectival: 0, verbal: 0 },
    })).toThrow(/require positive mass/u);
  });
});
