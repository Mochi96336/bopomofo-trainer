import {
  applyProductionFeatureRequirementOverlays,
  type ProductionFeatureRequirementOverlay,
} from "./feature-requirement-overlay.js";
import { FORMAL_SYNTAX_RULES } from "./grammar.js";
import type { ProductionRule, SyntaxCategory } from "./types.js";

/**
 * A construction view reuses one canonical production skeleton while adding
 * evidence-backed lexical feature requirements. It never creates a new grammar
 * production ticket or changes the underlying production identity.
 */
export interface FormalSyntaxConstructionView {
  readonly id: string;
  readonly rootCategory: SyntaxCategory;
  readonly rootProductionRuleId: string;
  readonly featureRequirementOverlays: readonly ProductionFeatureRequirementOverlay[];
  readonly evidenceContract: string;
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
