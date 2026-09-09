import { describe, expect, it } from "vitest";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";

const ASPECT_INTRANSITIVE_TARGETS = [
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
    exactCount: 0,
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
    exactCount: 1,
  },
] as const;

describe("Clause-model v2 aspect axis migration", () => {
  it("retires peer Clause aspect ownership while preserving the Predicate aspect slot", () => {
    expect(FORMAL_SYNTAX_RULES.some((rule) => rule.id === "clause.aspect")).toBe(false);
    const expanded = FORMAL_SYNTAX_RULES.find((rule) => rule.id === "predicate.verb.expanded");
    expect(expanded).toBeDefined();
    expect(expanded?.constituents.find((item) => item.key === "aspect")).toMatchObject({
      category: "Lexeme",
      allowedUpos: ["AUX", "PART"],
      minimum: 0,
      maximum: 1,
      requiredFeatures: { aspect: "marked" },
    });
  });

  it("keeps aspect practice reachable as predicate marking without a lexical predicate-role gate", () => {
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules: FORMAL_SYNTAX_RULES,
      random: { next: () => 0 },
      maximumAttempts: 64,
      rootProductionRuleId: "sentence.declarative",
      nestedProductionTargets: ASPECT_INTRANSITIVE_TARGETS,
      requiredLexicalSlot: {
        requiredFeatures: { aspect: "marked" },
        enclosingRequiredFunctions: ["predicate"],
      },
    });

    expect(shape).not.toBeNull();
    expect(shape?.productionRulePath).toContain("clause.intransitive");
    expect(shape?.productionRulePath).toContain("predicate.verb.expanded");
    expect(shape?.productionRulePath).not.toContain("clause.aspect");

    const aspectSlots = shape?.lexicalSlots.filter(
      (slot) => slot.requiredFeatures.aspect === "marked",
    ) ?? [];
    expect(aspectSlots).toHaveLength(1);
    expect(aspectSlots[0]).toMatchObject({
      allowedUpos: ["AUX", "PART"],
      requiredFunctions: [],
      requiredFeatures: { aspect: "marked" },
    });
  });
});
