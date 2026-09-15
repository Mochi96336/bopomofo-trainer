import { describe, expect, it } from "vitest";
import {
  argumentRealizationPracticeIntentForTicketUnit,
  argumentRealizationPracticeTicketUnitForTerminalUnit,
  createSentenceConstructionFamilyPlanSample,
  predicateMarkingPracticeIntentForTicketUnit,
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
} from "../../src/curriculum/formal-syntax-sampling-policy.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";

describe("argument realization practice ticket", () => {
  it("supports independently forced ordinary, subject-omission, and object-omission intents", () => {
    const base = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY;
    expect(argumentRealizationPracticeIntentForTicketUnit(0.5, {
      ...base,
      version: "argument-realization-always-ordinary",
      argumentRealizationPracticeWeights: { ordinary: 1, subjectOmission: 0, objectOmission: 0 },
    })).toBe("ordinary");
    expect(argumentRealizationPracticeIntentForTicketUnit(0.5, {
      ...base,
      version: "argument-realization-always-subject",
      argumentRealizationPracticeWeights: { ordinary: 0, subjectOmission: 1, objectOmission: 0 },
    })).toBe("subject-omission");
    expect(argumentRealizationPracticeIntentForTicketUnit(0.5, {
      ...base,
      version: "argument-realization-always-object",
      argumentRealizationPracticeWeights: { ordinary: 0, subjectOmission: 0, objectOmission: 1 },
    })).toBe("object-omission");
  });

  it("domain-separates the realization ticket without moving Predicate marking boundaries", () => {
    const terminal = 0.9;
    const projected = argumentRealizationPracticeTicketUnitForTerminalUnit(terminal);
    expect(projected).toBeGreaterThanOrEqual(0);
    expect(projected).toBeLessThan(1);
    expect(projected).not.toBe(terminal);
    expect(predicateMarkingPracticeIntentForTicketUnit(0.8309)).toBe("ordinary");
    expect(predicateMarkingPracticeIntentForTicketUnit(0.831)).toBe("modal");
    expect(predicateMarkingPracticeIntentForTicketUnit(0.888)).toBe("aspect");
    expect(predicateMarkingPracticeIntentForTicketUnit(0.943)).toBe("negation");
  });

  it("keeps ticket incidence aligned with the calibrated product-practice prior", () => {
    const sampleCount = 8192;
    let subject = 0;
    let object = 0;
    for (let round = 0; round < sampleCount; round += 1) {
      const sample = createSentenceConstructionFamilyPlanSample(
        FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Sentence"),
        createSeededRandom(`argument-realization-terminal-ticket:${round}`),
      );
      expect(sample.argumentRealizationTicketUnit).toBe(sample.predicateMarkingTicketUnit);
      const intent = argumentRealizationPracticeIntentForTicketUnit(sample.argumentRealizationTicketUnit);
      if (intent === "subject-omission") subject += 1;
      if (intent === "object-omission") object += 1;
    }
    const weights = PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.argumentRealizationPracticeWeights;
    const total = weights.ordinary + weights.subjectOmission + weights.objectOmission;
    expect(Math.abs(subject / sampleCount - weights.subjectOmission / total)).toBeLessThan(0.01);
    expect(Math.abs(object / sampleCount - weights.objectOmission / total)).toBeLessThan(0.01);
  });
});
