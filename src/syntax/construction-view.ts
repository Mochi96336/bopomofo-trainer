import {
  applyProductionFeatureRequirementOverlays,
  type ProductionFeatureRequirementOverlay,
} from "./feature-requirement-overlay.js";
import { FORMAL_SYNTAX_RULES } from "./grammar.js";
import type { ProductionRule, SyntaxCategory } from "./types.js";

export interface FormalSyntaxConstructionExecutionRequirements {
  /** Minimum recursive clause budget required to execute this construction view. */
  readonly minimumClauseNesting?: number;
}

/**
 * A construction view reuses one canonical production skeleton while adding
 * evidence-backed lexical feature requirements. It never creates a new grammar
 * production ticket or changes the underlying production identity.
 *
 * Execution requirements describe the minimum sampler budget needed by the
 * existing skeleton; they do not assign product probability or legalize grammar.
 */
export interface FormalSyntaxConstructionView {
  readonly id: string;
  readonly rootCategory: SyntaxCategory;
  readonly rootProductionRuleId: string;
  readonly featureRequirementOverlays: readonly ProductionFeatureRequirementOverlay[];
  readonly evidenceContract: string;
  readonly executionRequirements?: FormalSyntaxConstructionExecutionRequirements;
}

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
