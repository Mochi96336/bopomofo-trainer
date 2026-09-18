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

const excludedClassesByConstituent = new WeakMap<
  ProductionConstituent,
  ReadonlySet<ProductionRuleClass>
>();

export function excludedClassesForConstituent(
  constituent: ProductionConstituent,
): ReadonlySet<ProductionRuleClass> {
  const cached = excludedClassesByConstituent.get(constituent);
  if (cached !== undefined) return cached;
  const created = new Set(constituent.excludedRuleClasses ?? []);
  excludedClassesByConstituent.set(constituent, created);
  return created;
}
