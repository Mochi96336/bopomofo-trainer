import { describe, expect, it } from "vitest";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY } from "../../src/syntax/runtime-occurrence-capabilities.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";

const MODAL_INTRANSITIVE_TARGETS = [
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
    exactCount: 1,
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
] as const;

describe("Clause-model v2 modal axis migration", () => {
  it("retires peer Clause modal ownership while preserving reviewed Predicate modal slots", () => {
    expect(FORMAL_SYNTAX_RULES.some((rule) => rule.id === "clause.modal")).toBe(false);

    const expanded = FORMAL_SYNTAX_RULES.find((rule) => rule.id === "predicate.verb.expanded");
    expect(expanded).toBeDefined();
    expect(expanded?.constituents.find((item) => item.key === "modal")).toMatchObject({
      category: "Lexeme",
      allowedUpos: ["AUX"],
      minimum: 0,
      maximum: 2,
      requiredOccurrenceCapabilities: [PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY],
    });
  });

  it("keeps reviewed modal practice reachable only through a Predicate-enclosed slot", () => {
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules: FORMAL_SYNTAX_RULES,
      random: { next: () => 0 },
      maximumAttempts: 64,
      rootProductionRuleId: "sentence.declarative",
      nestedProductionTargets: MODAL_INTRANSITIVE_TARGETS,
      requiredLexicalSlot: {
        requiredOccurrenceCapabilities: [PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY],
        enclosingRequiredFunctions: ["predicate"],
      },
    });

    expect(shape).not.toBeNull();
    expect(shape?.productionRulePath).toContain("clause.intransitive");
    expect(shape?.productionRulePath).toContain("predicate.verb.expanded");
    expect(shape?.productionRulePath).not.toContain("clause.modal");

    const modalSlots = shape?.lexicalSlots.filter((slot) =>
      slot.requiredOccurrenceCapabilities?.includes(
        PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY,
      ) ?? false,
    ) ?? [];
    expect(modalSlots).toHaveLength(1);
    expect(modalSlots[0]).toMatchObject({
      allowedUpos: ["AUX"],
      requiredOccurrenceCapabilities: [PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY],
    });
  });
});
