import { describe, expect, it } from "vitest";
import {
  ACTIVE_CAUSATIVE_CONSTRUCTION_VIEWS,
  CAUSATIVE_FINITE_CCOMP_VIEW,
  rulesForFormalSyntaxConstructionView,
} from "../../src/syntax/causative-construction-view.js";
import { syntaxProfileMatchesRequirements } from "../../src/syntax/profile-match.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const STABLE_RANDOM = { next: () => 0.999 };

function profile(
  id: string,
  valencyFrames: RuntimeSyntaxProfile["valencyFrames"],
  causative: boolean,
): RuntimeSyntaxProfile {
  return {
    id,
    entryId: `entry:${id}`,
    upos: "VERB",
    functions: ["predicate"],
    valencyFrames,
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
      ...(causative ? { morphologicalFeatureCounts: { "Voice=Cau": 1 } } : {}),
    },
    provenanceIds: ["test"],
  };
}

describe("causative construction views", () => {
  it("activates only the evidence-backed finite-ccomp view", () => {
    expect(ACTIVE_CAUSATIVE_CONSTRUCTION_VIEWS).toEqual([CAUSATIVE_FINITE_CCOMP_VIEW]);
    expect(CAUSATIVE_FINITE_CCOMP_VIEW).toMatchObject({
      id: "causative.finite-ccomp",
      rootCategory: "Clause",
      rootProductionRuleId: "clause.object-content",
      evidenceContract: "causative-runtime-reachability-v1",
    });
    expect(CAUSATIVE_FINITE_CCOMP_VIEW.featureRequirementOverlays).toEqual([{
      ruleId: "clause.object-content",
      constituentKey: "predicate",
      requiredFeatures: { voice: "causative" },
    }]);
  });

  it("samples the existing ccomp skeleton with a causative matrix lexical head", () => {
    const rules = rulesForFormalSyntaxConstructionView(CAUSATIVE_FINITE_CCOMP_VIEW);
    const shape = sampleStructuralDerivation({
      rootCategory: CAUSATIVE_FINITE_CCOMP_VIEW.rootCategory,
      rootProductionRuleId: CAUSATIVE_FINITE_CCOMP_VIEW.rootProductionRuleId,
      rules,
      random: STABLE_RANDOM,
      maximumAttempts: 1,
    });

    expect(shape).not.toBeNull();
    expect(shape?.root.productionRuleId).toBe("clause.object-content");
    const markedSlots = shape?.lexicalSlots.filter(
      (slot) => slot.requiredFeatures.voice === "causative",
    ) ?? [];
    expect(markedSlots).toHaveLength(1);
    expect(markedSlots[0]).toMatchObject({
      allowedUpos: ["VERB"],
      requiredValencyFrames: ["clausal-complement"],
      requiredFeatures: { voice: "causative" },
    });
  });

  it("requires morphology and finite-ccomp valency independently at the matrix head", () => {
    const rules = rulesForFormalSyntaxConstructionView(CAUSATIVE_FINITE_CCOMP_VIEW);
    const shape = sampleStructuralDerivation({
      rootCategory: "Clause",
      rootProductionRuleId: "clause.object-content",
      rules,
      random: STABLE_RANDOM,
      maximumAttempts: 1,
    });
    const slot = shape?.lexicalSlots.find((item) => item.requiredFeatures.voice === "causative");
    expect(slot).toBeDefined();

    expect(syntaxProfileMatchesRequirements(
      profile("supported", ["clausal-complement"], true),
      slot!,
      "讓",
    )).toBe(true);
    expect(syntaxProfileMatchesRequirements(
      profile("no-morphology", ["clausal-complement"], false),
      slot!,
      "讓",
    )).toBe(false);
    expect(syntaxProfileMatchesRequirements(
      profile("no-ccomp", ["transitive"], true),
      slot!,
      "讓",
    )).toBe(false);
  });
});
