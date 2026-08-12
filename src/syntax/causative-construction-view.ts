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
  // Predicate requirements reach only the lexical head. The derived view adds
  // this inheritance marker without mutating the canonical Predicate rules or
  // their runtime-lock digest.
  occurrenceCapabilityInheritanceTargets: [{
    outputCategory: "Predicate",
    constituentKey: "head",
  }],
  evidenceContract: "same-token-voice-cau-direct-ccomp-v1",
};

export const ACTIVE_CAUSATIVE_CONSTRUCTION_VIEWS: readonly ConstructionView[] = [
  CAUSATIVE_FINITE_CCOMP_VIEW,
];
