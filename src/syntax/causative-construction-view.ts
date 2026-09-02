import type { FormalSyntaxConstructionView as ConstructionView } from "./construction-view.js";
import { CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY } from "./runtime-occurrence-capabilities.js";

export {
  rulesForFormalSyntaxConstructionView,
  type FormalSyntaxConstructionView,
  type OccurrenceCapabilityInheritanceTarget,
  type OccurrenceCapabilityRequirementTarget,
} from "./construction-view.js";

/**
 * The finite-ccomp causative view reuses the ordinary content-complement shape.
 * Its causative license is one explicit same-occurrence capability, not an AND
 * of aggregate Voice=Cau morphology and aggregate ccomp valency at the consumer.
 * Predicate heads now inherit occurrence capabilities canonically, so this view
 * only adds the construction-specific requirement at the matrix predicate edge.
 */
export const CAUSATIVE_FINITE_CCOMP_VIEW: ConstructionView = {
  id: "causative.finite-ccomp",
  rootCategory: "Clause",
  rootProductionRuleId: "clause.object-content",
  occurrenceCapabilityRequirements: [{
    ruleId: "clause.object-content",
    constituentKey: "predicate",
    capability: CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY,
  }],
  occurrenceCapabilityInheritanceTargets: [],
  evidenceContract: "same-token-voice-cau-direct-ccomp-v1",
};

export const ACTIVE_CAUSATIVE_CONSTRUCTION_VIEWS: readonly ConstructionView[] = [
  CAUSATIVE_FINITE_CCOMP_VIEW,
];
