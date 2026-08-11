import type { FormalSyntaxConstructionView } from "./construction-view.js";

export {
  rulesForFormalSyntaxConstructionView,
  type FormalSyntaxConstructionView,
} from "./construction-view.js";

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
