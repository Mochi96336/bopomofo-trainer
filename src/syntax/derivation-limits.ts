import type {
  DerivationBounds,
  ProductionConstituent,
  ProductionRule,
  ProductionRuleClass,
} from "./types.js";

export function effectiveConstituentMaximum(
  constituent: ProductionConstituent,
  bounds: DerivationBounds,
): number {
  switch (constituent.cardinalityBound) {
    case "consecutive-modifiers":
      return Math.min(constituent.maximum, bounds.maximumConsecutiveModifiers);
    case "complements-per-predicate":
      return Math.min(constituent.maximum, bounds.maximumComplementsPerPredicate);
    case undefined:
      return constituent.maximum;
    default:
      throw new Error(`unsupported constituent cardinality bound: ${String(constituent.cardinalityBound)}`);
  }
}

export function ruleAllowedByDerivationBounds(
  rule: ProductionRule,
  bounds: DerivationBounds,
  excludedRuleClasses: ReadonlySet<ProductionRuleClass> = new Set(),
): boolean {
  if (rule.ruleClass !== undefined && excludedRuleClasses.has(rule.ruleClass)) return false;
  if (rule.coordinationItems !== undefined
    && rule.coordinationItems > bounds.maximumCoordinationItems) return false;
  return true;
}

export function excludedClassesForConstituent(
  constituent: ProductionConstituent,
): ReadonlySet<ProductionRuleClass> {
  return new Set(constituent.excludedRuleClasses ?? []);
}
