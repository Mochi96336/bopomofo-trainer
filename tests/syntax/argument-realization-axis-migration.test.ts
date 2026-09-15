import { describe, expect, it } from "vitest";
import { argumentRealizationStructuralPractice } from "../../src/curriculum/argument-realization-practice.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { RETIRED_CLAUSE_RULE_V2_DECISIONS } from "../../src/syntax/clause-model-v2.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";
import type { StructuralSyntaxNode } from "../../src/syntax/derive.js";

const ZERO_RANDOM = { next: () => 0 };

function childCategories(root: StructuralSyntaxNode): readonly string[] {
  return root.children
    .filter((child): child is StructuralSyntaxNode => child.kind === "syntax-node")
    .map((child) => child.category);
}

describe("Clause Model V2 argument realization axis", () => {
  it("retires omission peer-Clause rules and preserves the evidence decision", () => {
    expect(FORMAL_SYNTAX_RULES.some((rule) => rule.id === "clause.subject-omission")).toBe(false);
    expect(FORMAL_SYNTAX_RULES.some((rule) => rule.id === "clause.object-omission")).toBe(false);
    expect(RETIRED_CLAUSE_RULE_V2_DECISIONS["clause.subject-omission"]).toMatchObject({
      targetAxes: ["argument-realization"],
      evidenceContract: "pinned-gsd-argument-realization-alternation-v1",
    });
    expect(RETIRED_CLAUSE_RULE_V2_DECISIONS["clause.object-omission"]).toMatchObject({
      targetAxes: ["argument-realization"],
      evidenceContract: "pinned-gsd-argument-realization-alternation-v1",
    });
  });

  it("keeps core frame identity while subject realization is absent", () => {
    const practice = argumentRealizationStructuralPractice("subject-omission");
    const shape = sampleStructuralDerivation({
      rootCategory: "Clause",
      rules: FORMAL_SYNTAX_RULES,
      random: ZERO_RANDOM,
      rootProductionRuleId: "clause.transitive",
      nestedProductionTargets: practice.nestedProductionTargets,
      ...(practice.requiredProductionRuleIdsAnyOf === undefined
        ? {}
        : { requiredProductionRuleIdsAnyOf: practice.requiredProductionRuleIdsAnyOf }),
    });
    expect(shape).not.toBeNull();
    expect(shape!.root.productionRuleId).toBe("clause.transitive");
    expect(childCategories(shape!.root)).toContain("Predicate");
    expect(childCategories(shape!.root)).toContain("Object");
    expect(childCategories(shape!.root)).not.toContain("Subject");
  });

  it("keeps transitive identity while direct object realization is absent", () => {
    const practice = argumentRealizationStructuralPractice("object-omission");
    const shape = sampleStructuralDerivation({
      rootCategory: "Clause",
      rules: FORMAL_SYNTAX_RULES,
      random: ZERO_RANDOM,
      rootProductionRuleId: "clause.transitive",
      nestedProductionTargets: practice.nestedProductionTargets,
      ...(practice.requiredProductionRuleIdsAnyOf === undefined
        ? {}
        : { requiredProductionRuleIdsAnyOf: practice.requiredProductionRuleIdsAnyOf }),
    });
    expect(shape).not.toBeNull();
    expect(shape!.root.productionRuleId).toBe("clause.transitive");
    expect(childCategories(shape!.root)).toContain("Subject");
    expect(childCategories(shape!.root)).toContain("Predicate");
    expect(childCategories(shape!.root)).not.toContain("Object");
  });

  it("keeps the ditransitive indirect object required on object practice", () => {
    const practice = argumentRealizationStructuralPractice("object-omission");
    const shape = sampleStructuralDerivation({
      rootCategory: "Clause",
      rules: FORMAL_SYNTAX_RULES,
      random: ZERO_RANDOM,
      rootProductionRuleId: "clause.ditransitive",
      nestedProductionTargets: practice.nestedProductionTargets,
      ...(practice.requiredProductionRuleIdsAnyOf === undefined
        ? {}
        : { requiredProductionRuleIdsAnyOf: practice.requiredProductionRuleIdsAnyOf }),
    });
    expect(shape).not.toBeNull();
    expect(childCategories(shape!.root)).toContain("IndirectObject");
    expect(childCategories(shape!.root)).not.toContain("Object");
  });

  it("fails closed when a realization practice target never appears in the sampled path", () => {
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules: FORMAL_SYNTAX_RULES,
      random: ZERO_RANDOM,
      maximumAttempts: 2,
      rootProductionRuleId: "sentence.a-not-a-question",
      requiredProductionRuleIdsAnyOf: ["clause.transitive", "clause.ditransitive"],
    });
    expect(shape).toBeNull();
  });
});
