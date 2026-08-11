import { mergeSyntaxFeatureRequirements } from "./requirements.js";
import type { ProductionRule, SyntaxFeatureSet } from "./types.js";

export interface ProductionFeatureRequirementOverlay {
  readonly ruleId: string;
  readonly constituentKey: string;
  readonly requiredFeatures: SyntaxFeatureSet;
}

function targetKey(ruleId: string, constituentKey: string): string {
  return `${ruleId}\u0000${constituentKey}`;
}

/**
 * Build a stricter grammar view without adding or renaming productions.
 *
 * This is intentionally feature-only: predicate marking may refine an existing
 * embedding rule, but it cannot use this mechanism to invent functions,
 * valency, argument slots, surface orders, or another production ticket.
 */
export function applyProductionFeatureRequirementOverlays(
  rules: readonly ProductionRule[],
  overlays: readonly ProductionFeatureRequirementOverlay[],
): readonly ProductionRule[] {
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const mergedByTarget = new Map<string, SyntaxFeatureSet>();

  for (const overlay of overlays) {
    const rule = rulesById.get(overlay.ruleId);
    if (rule === undefined) {
      throw new Error(`feature requirement overlay references unknown rule: ${overlay.ruleId}`);
    }
    if (!rule.constituents.some((item) => item.key === overlay.constituentKey)) {
      throw new Error(
        `feature requirement overlay references unknown constituent: ${overlay.ruleId}:${overlay.constituentKey}`,
      );
    }
    if (Object.keys(overlay.requiredFeatures).length === 0) {
      throw new Error(
        `feature requirement overlay must add at least one feature: ${overlay.ruleId}:${overlay.constituentKey}`,
      );
    }

    const key = targetKey(overlay.ruleId, overlay.constituentKey);
    const merged = mergeSyntaxFeatureRequirements(
      mergedByTarget.get(key) ?? {},
      overlay.requiredFeatures,
    );
    if (merged === null) {
      throw new Error(
        `feature requirement overlays conflict: ${overlay.ruleId}:${overlay.constituentKey}`,
      );
    }
    mergedByTarget.set(key, merged);
  }

  return rules.map((rule) => {
    const targeted = rule.constituents.some(
      (item) => mergedByTarget.has(targetKey(rule.id, item.key)),
    );
    if (!targeted) return rule;

    return {
      ...rule,
      constituents: rule.constituents.map((constituent) => {
        const overlay = mergedByTarget.get(targetKey(rule.id, constituent.key));
        if (overlay === undefined) return constituent;
        const requiredFeatures = mergeSyntaxFeatureRequirements(
          constituent.requiredFeatures,
          overlay,
        );
        if (requiredFeatures === null) {
          throw new Error(
            `feature requirement overlay conflicts with rule: ${rule.id}:${constituent.key}`,
          );
        }
        return { ...constituent, requiredFeatures };
      }),
    };
  });
}
