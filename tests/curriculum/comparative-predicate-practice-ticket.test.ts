import { describe, expect, it } from "vitest";
import {
  comparativePracticeIntentForTicketUnit,
  comparativePracticeTicketUnitForTerminalUnit,
  createSentenceConstructionFamilyPlanSample,
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
} from "../../src/curriculum/formal-syntax-sampling-policy.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";

describe("comparative predicate practice ticket", () => {
  it("supports independently forced inactive, adjectival, and verbal intents", () => {
    const base = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY;
    expect(comparativePracticeIntentForTicketUnit(0.5, {
      ...base,
      version: "comparative-always-inactive",
      comparativePracticeWeights: { inactive: 1, adjectival: 0, verbal: 0 },
    })).toBe("inactive");
    expect(comparativePracticeIntentForTicketUnit(0.5, {
      ...base,
      version: "comparative-always-adjectival",
      comparativePracticeWeights: { inactive: 0, adjectival: 1, verbal: 0 },
    })).toBe("adjectival");
    expect(comparativePracticeIntentForTicketUnit(0.5, {
      ...base,
      version: "comparative-always-verbal",
      comparativePracticeWeights: { inactive: 0, adjectival: 0, verbal: 1 },
    })).toBe("verbal");
  });

  it("domain-separates comparative practice from the terminal family draw", () => {
    const terminal = 0.9;
    const projected = comparativePracticeTicketUnitForTerminalUnit(terminal);
    expect(projected).toBeGreaterThanOrEqual(0);
    expect(projected).toBeLessThan(1);
    expect(projected).not.toBe(terminal);
  });

  it("uses the explicit conservative product-practice prior", () => {
    expect(PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.comparativePracticeWeights).toEqual({
      inactive: 0.5,
      adjectival: 0.4,
      verbal: 0.1,
    });

    const sampleCount = 8192;
    let inactive = 0;
    let adjectival = 0;
    let verbal = 0;
    for (let round = 0; round < sampleCount; round += 1) {
      const sample = createSentenceConstructionFamilyPlanSample(
        FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Sentence"),
        createSeededRandom(`comparative-predicate-terminal-ticket:${round}`),
      );
      expect(sample.comparativePracticeTicketUnit).toBe(sample.predicateMarkingTicketUnit);
      const intent = comparativePracticeIntentForTicketUnit(
        sample.comparativePracticeTicketUnit,
      );
      if (intent === "inactive") inactive += 1;
      if (intent === "adjectival") adjectival += 1;
      if (intent === "verbal") verbal += 1;
    }
    expect(Math.abs(inactive / sampleCount - 0.5)).toBeLessThan(0.01);
    expect(Math.abs(adjectival / sampleCount - 0.4)).toBeLessThan(0.01);
    expect(Math.abs(verbal / sampleCount - 0.1)).toBeLessThan(0.01);
  });

  it("fails closed on invalid comparative practice weights", () => {
    expect(() => comparativePracticeIntentForTicketUnit(0.5, {
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      version: "comparative-predicate-zero",
      comparativePracticeWeights: { inactive: 0, adjectival: 0, verbal: 0 },
    })).toThrow(/require positive mass/u);
  });
});
