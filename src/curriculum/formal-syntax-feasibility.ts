import { prepareStructuralDerivationCounter } from "../syntax/count.js";
import { compatibleProfilesForRequirements, type LexicalProfileIndex } from "../syntax/realize.js";
import type { DerivationBounds, ProductionRule } from "../syntax/types.js";

export interface FormalSyntaxFeasibility {
  readonly roots: readonly {
    readonly ruleId: string;
    readonly potentialShapeCount: string;
  }[];
  readonly eligibleRootRuleIds: ReadonlySet<string>;
}

const cache = new WeakMap<
  LexicalProfileIndex,
  WeakMap<readonly ProductionRule[], Map<string, FormalSyntaxFeasibility>>
>();

/** Exact zero under the bounded abstract grammar proves impossibility.
 * Positive counts do not yet prove joint uniqueness, binding or contextual
 * reading compatibility; those remain realization checks. No random probe is
 * used to classify a family as unavailable.
 */
export function prepareFormalSyntaxFeasibility(
  index: LexicalProfileIndex,
  rules: readonly ProductionRule[],
  bounds: DerivationBounds,
  minimumPracticeLexicalEntries: number,
): FormalSyntaxFeasibility {
  let byRules = cache.get(index);
  if (byRules === undefined) {
    byRules = new WeakMap();
    cache.set(index, byRules);
  }
  let byBounds = byRules.get(rules);
  if (byBounds === undefined) {
    byBounds = new Map();
    byRules.set(rules, byBounds);
  }
  const key = JSON.stringify([bounds, minimumPracticeLexicalEntries]);
  const cached = byBounds.get(key);
  if (cached !== undefined) return cached;
  const counter = prepareStructuralDerivationCounter({
    rootCategory: "Sentence",
    rules,
    bounds,
    minimumPracticeLexicalEntries,
    isLexicalRequirementsReachable: (constituent, requirements) =>
      constituent.formalLiteral !== undefined
      || (constituent.allowedUpos.length === 1 && constituent.allowedUpos[0] === "PUNCT")
      || compatibleProfilesForRequirements(constituent, requirements, index).length > 0,
  });
  const roots = rules.filter(rule => rule.output === "Sentence")
    .map(rule => ({ ruleId: rule.id, potentialShapeCount: counter.count(rule.id) }));
  const result: FormalSyntaxFeasibility = {
    roots,
    eligibleRootRuleIds: new Set(roots
      .filter(root => root.potentialShapeCount !== "0")
      .map(root => root.ruleId)),
  };
  byBounds.set(key, result);
  return result;
}
