import { describe, expect, it } from "vitest";
import type { RandomSource } from "../../src/core/model.js";
import { countStructuralDerivationShapes } from "../../src/syntax/count.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  sampleStructuralDerivation,
  type NestedProductionTarget,
} from "../../src/syntax/sample.js";

class ConstantRandom implements RandomSource {
  next(): number { return 0; }
}

const NEGATIVE_INTRANSITIVE_TARGETS: readonly NestedProductionTarget[] = [
  {
    parentRuleId: "sentence.declarative",
    constituentKey: "clause",
    childRuleId: "clause.intransitive",
  },
  {
    parentRuleId: "clause.intransitive",
    constituentKey: "predicate",
    childRuleId: "predicate.verb.expanded",
  },
  {
    parentRuleId: "predicate.verb.expanded",
    constituentKey: "negation",
    exactCount: 1,
  },
  {
    parentRuleId: "predicate.verb.expanded",
    constituentKey: "modal",
    exactCount: 0,
  },
  {
    parentRuleId: "predicate.verb.expanded",
    constituentKey: "adverbial",
    exactCount: 0,
  },
  {
    parentRuleId: "predicate.verb.expanded",
    constituentKey: "complement",
    exactCount: 0,
  },
  {
    parentRuleId: "predicate.verb.expanded",
    constituentKey: "aspect",
    exactCount: 0,
  },
];

describe("Clause-model v2 negation axis migration", () => {
  it("retires the peer negative Clause production without retiring aspect or modal", () => {
    const clauseRuleIds = FORMAL_SYNTAX_RULES
      .filter((rule) => rule.output === "Clause")
      .map((rule) => rule.id);

    expect(clauseRuleIds).not.toContain("clause.negative");
    expect(clauseRuleIds).toContain("clause.aspect");
    expect(clauseRuleIds).toContain("clause.modal");
  });

  it("keeps explicit negative practice reachable through Predicate marking", () => {
    const count = countStructuralDerivationShapes({
      rootCategory: "Sentence",
      rules: FORMAL_SYNTAX_RULES,
      rootProductionRuleId: "sentence.declarative",
      nestedProductionTargets: NEGATIVE_INTRANSITIVE_TARGETS,
    });
    expect(BigInt(count)).toBeGreaterThan(0n);

    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules: FORMAL_SYNTAX_RULES,
      random: new ConstantRandom(),
      maximumAttempts: 64,
      rootProductionRuleId: "sentence.declarative",
      nestedProductionTargets: NEGATIVE_INTRANSITIVE_TARGETS,
    });

    expect(shape).not.toBeNull();
    expect(shape?.productionRulePath).toContain("clause.intransitive");
    expect(shape?.productionRulePath).toContain("predicate.verb.expanded");

    const negationSlots = shape?.lexicalSlots.filter(
      (slot) => slot.constituentKey === "negation",
    ) ?? [];
    expect(negationSlots).toHaveLength(1);
    expect(negationSlots[0]?.allowedUpos).toEqual(["ADV", "AUX", "PART", "VERB"]);
    expect(negationSlots[0]?.requiredFeatures).toEqual({ polarity: "negative" });

    expect(shape?.lexicalSlots.some((slot) => slot.constituentKey === "aspect")).toBe(false);
    expect(shape?.lexicalSlots.some((slot) => slot.constituentKey === "modal")).toBe(false);
  });
});
