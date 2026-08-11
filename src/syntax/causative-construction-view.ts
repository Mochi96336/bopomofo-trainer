import {
  applyProductionFeatureRequirementOverlays,
  type ProductionFeatureRequirementOverlay,
} from "./feature-requirement-overlay.js";
import { FORMAL_SYNTAX_RULES } from "./grammar.js";
import type { ProductionRule, SyntaxCategory } from "./types.js";

export interface FormalSyntaxConstructionView {
  readonly id: string;
  readonly rootCategory: SyntaxCategory;
  readonly rootProductionRuleId: string;
  readonly featureRequirementOverlays: readonly ProductionFeatureRequirementOverlay[];
  readonly evidenceContract: string;
}

/**
 * Reviewed causative support is currently an intersection of predicate marking
 * and an independently evidenced embedding capability. The packaged runtime
 * audit in #196 finds support only for finite ccomp; typed controller xcomp
 * intersections are zero and therefore intentionally have no construction view.
 */
export const CAUSATIVE_FINITE_CCOMP_VIEW: FormalSyntaxConstructionView = {
  id: "causative.finite-ccomp",
  rootCategory: "Clause",
  rootProductionRuleId: "clause.object-content",
  featureRequirementOverlays: [{
    ruleId: "clause.object-content",
    constituentKey: "predicate",
    requiredFeatures: { voice: "causative" },
  }],
  evidenceContract: "causative-runtime-reachability-v1",
};

export const ACTIVE_CAUSATIVE_CONSTRUCTION_VIEWS: readonly FormalSyntaxConstructionView[] = [
  CAUSATIVE_FINITE_CCOMP_VIEW,
];

export function rulesForFormalSyntaxConstructionView(
  view: FormalSyntaxConstructionView,
  rules: readonly ProductionRule[] = FORMAL_SYNTAX_RULES,
): readonly ProductionRule[] {
  const rootRule = rules.find((rule) => rule.id === view.rootProductionRuleId);
  if (rootRule === undefined || rootRule.output !== view.rootCategory) {
    throw new Error(`construction view references invalid root production: ${view.id}`);
  }
  return applyProductionFeatureRequirementOverlays(rules, view.featureRequirementOverlays);
}
