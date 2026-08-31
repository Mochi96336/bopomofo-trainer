import type { FormalSyntaxConstructionView as ConstructionView } from "./construction-view.js";
import { SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY } from "./runtime-occurrence-capabilities.js";

/**
 * Reviewed short passive reuses canonical `clause.bei`, but its PassivePhrase
 * edge is structurally the AUX 被 / aux:pass variant rather than the long
 * ADP 被 + agent variant. Predicate licensing comes only from the reviewed
 * same-occurrence short-passive capability, replacing the legacy generic
 * transitive/ambitransitive aggregate gate in this derived view.
 */
export const SHORT_PASSIVE_CONSTRUCTION_VIEW: ConstructionView = {
  id: "passive.short",
  rootCategory: "Clause",
  rootProductionRuleId: "clause.bei",
  occurrenceCapabilityRequirements: [{
    ruleId: "clause.bei",
    constituentKey: "predicate",
    capability: SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
  }],
  occurrenceCapabilityInheritanceTargets: [{
    outputCategory: "Predicate",
    constituentKey: "head",
  }],
  valencyRequirementOverrides: [{
    ruleId: "clause.bei",
    constituentKey: "predicate",
    requiredValencyFrames: [],
  }],
  structuralProductionRequirements: [{
    parentRuleId: "clause.bei",
    constituentKey: "passive",
    childRuleId: "phrase.passive.short",
  }],
  evidenceContract: "same-predicate-aux-pass-bei-v1",
};

export const ACTIVE_PASSIVE_CONSTRUCTION_VIEWS: readonly ConstructionView[] = [
  SHORT_PASSIVE_CONSTRUCTION_VIEW,
];
