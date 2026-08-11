import { describe, expect, it } from "vitest";
import { applyProductionFeatureRequirementOverlays } from "../../src/syntax/feature-requirement-overlay.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { PREDICATE_PRODUCTION_RULES } from "../../src/syntax/predicate-rules.js";
import {
  EMPTY_SYNTAX_REQUIREMENTS,
  requirementsForConstituent,
} from "../../src/syntax/requirements.js";

function rule(rules: typeof FORMAL_SYNTAX_RULES, ruleId: string) {
  const found = rules.find((item) => item.id === ruleId);
  expect(found, ruleId).toBeDefined();
  return found!;
}

describe("production feature requirement overlays", () => {
  it("tightens finite ccomp predicate marking without adding a production ticket", () => {
    const view = applyProductionFeatureRequirementOverlays(FORMAL_SYNTAX_RULES, [{
      ruleId: "clause.object-content",
      constituentKey: "predicate",
      requiredFeatures: { voice: "causative" },
    }]);

    expect(view).toHaveLength(FORMAL_SYNTAX_RULES.length);
    expect(view.map((item) => item.id)).toEqual(FORMAL_SYNTAX_RULES.map((item) => item.id));

    const original = rule(FORMAL_SYNTAX_RULES, "clause.object-content");
    const overlaid = rule(view, "clause.object-content");
    expect(overlaid.surfaceOrders).toBe(original.surfaceOrders);
    expect(overlaid.constraints).toBe(original.constraints);

    const originalPredicate = original.constituents.find((item) => item.key === "predicate")!;
    const predicate = overlaid.constituents.find((item) => item.key === "predicate")!;
    expect(originalPredicate.requiredFeatures).toEqual({});
    expect(predicate).toMatchObject({
      category: "Predicate",
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["clausal-complement"],
      requiredFeatures: { voice: "causative" },
    });
    expect(overlaid.constituents.find((item) => item.key === "objectClause"))
      .toEqual(original.constituents.find((item) => item.key === "objectClause"));

    const predicateRequirements = requirementsForConstituent(
      predicate,
      EMPTY_SYNTAX_REQUIREMENTS,
    );
    expect(predicateRequirements).not.toBeNull();
    const lexicalHead = PREDICATE_PRODUCTION_RULES[0]?.constituents
      .find((item) => item.key === "head");
    expect(lexicalHead).toBeDefined();
    expect(requirementsForConstituent(lexicalHead!, predicateRequirements!)).toEqual({
      requiredFunctions: [],
      requiredValencyFrames: ["clausal-complement"],
      requiredFeatures: { voice: "causative" },
    });
  });

  it("keeps controlled-xcomp embedding capability independent from predicate marking", () => {
    const view = applyProductionFeatureRequirementOverlays(FORMAL_SYNTAX_RULES, [{
      ruleId: "clause.xcomp-object-control",
      constituentKey: "predicate",
      requiredFeatures: { voice: "causative" },
    }]);
    const predicate = rule(view, "clause.xcomp-object-control").constituents
      .find((item) => item.key === "predicate");

    expect(predicate).toMatchObject({
      category: "Predicate",
      requiredValencyFrames: ["object-controlled-open-complement"],
      requiredFeatures: { voice: "causative" },
    });
  });

  it("combines compatible feature refinements deterministically", () => {
    const view = applyProductionFeatureRequirementOverlays(FORMAL_SYNTAX_RULES, [
      {
        ruleId: "clause.object-content",
        constituentKey: "predicate",
        requiredFeatures: { voice: "causative" },
      },
      {
        ruleId: "clause.object-content",
        constituentKey: "predicate",
        requiredFeatures: { polarity: "negative" },
      },
    ]);
    expect(rule(view, "clause.object-content").constituents
      .find((item) => item.key === "predicate")?.requiredFeatures).toEqual({
      polarity: "negative",
      voice: "causative",
    });
  });

  it("fails closed on conflicting or invalid overlay targets", () => {
    expect(() => applyProductionFeatureRequirementOverlays(FORMAL_SYNTAX_RULES, [
      {
        ruleId: "clause.object-content",
        constituentKey: "predicate",
        requiredFeatures: { voice: "causative" },
      },
      {
        ruleId: "clause.object-content",
        constituentKey: "predicate",
        requiredFeatures: { voice: "passive" },
      },
    ])).toThrow(/conflict/u);

    expect(() => applyProductionFeatureRequirementOverlays(FORMAL_SYNTAX_RULES, [{
      ruleId: "clause.missing",
      constituentKey: "predicate",
      requiredFeatures: { voice: "causative" },
    }])).toThrow(/unknown rule/u);

    expect(() => applyProductionFeatureRequirementOverlays(FORMAL_SYNTAX_RULES, [{
      ruleId: "clause.object-content",
      constituentKey: "missing",
      requiredFeatures: { voice: "causative" },
    }])).toThrow(/unknown constituent/u);

    expect(() => applyProductionFeatureRequirementOverlays(FORMAL_SYNTAX_RULES, [{
      ruleId: "clause.object-content",
      constituentKey: "predicate",
      requiredFeatures: {},
    }])).toThrow(/at least one feature/u);
  });
});
