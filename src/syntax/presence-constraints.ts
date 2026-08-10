import { effectiveConstituentMaximum } from "./derivation-limits.js";
import type {
  DerivationBounds,
  ProductionConstraint,
  ProductionRule,
} from "./types.js";

export type ConstituentCounts = Readonly<Record<string, number>>;

function isPresent(counts: ConstituentCounts, key: string): boolean {
  return (counts[key] ?? 0) > 0;
}

export function presenceConstraintsSatisfied(
  constraints: readonly ProductionConstraint[],
  counts: ConstituentCounts,
): boolean {
  for (const constraint of constraints) {
    switch (constraint.kind) {
      case "requires-constituent":
        if (isPresent(counts, constraint.ifPresentKey)
          && !isPresent(counts, constraint.targetKey)) return false;
        break;
      case "forbids-cooccurrence":
        if (isPresent(counts, constraint.ifPresentKey)
          && isPresent(counts, constraint.targetKey)) return false;
        break;
      case "feature-equals":
      case "feature-not-equals":
        throw new Error(`feature constraint ${constraint.kind} is not executable`);
    }
  }
  return true;
}

export function* validConstituentCountAssignments(
  rule: ProductionRule,
  bounds: DerivationBounds,
  index = 0,
  current: ConstituentCounts = {},
): Generator<ConstituentCounts> {
  const constituent = rule.constituents[index];
  if (constituent === undefined) {
    if (presenceConstraintsSatisfied(rule.constraints, current)) yield current;
    return;
  }

  const maximum = effectiveConstituentMaximum(constituent, bounds);
  if (maximum < constituent.minimum) return;
  for (let count = constituent.minimum; count <= maximum; count += 1) {
    yield* validConstituentCountAssignments(
      rule,
      bounds,
      index + 1,
      { ...current, [constituent.key]: count },
    );
  }
}

/**
 * Presence-only assignments are enough for abstract rule-index reachability.
 * Multiplicity above one cannot change a structural presence constraint, so
 * collapsing present repetitions to one avoids multiplying equivalent states.
 */
export function* validPresenceAssignments(
  rule: ProductionRule,
  bounds: DerivationBounds,
  index = 0,
  current: ConstituentCounts = {},
): Generator<ConstituentCounts> {
  const constituent = rule.constituents[index];
  if (constituent === undefined) {
    if (presenceConstraintsSatisfied(rule.constraints, current)) yield current;
    return;
  }

  const maximum = effectiveConstituentMaximum(constituent, bounds);
  if (maximum < constituent.minimum) return;

  if (constituent.minimum > 0) {
    yield* validPresenceAssignments(
      rule,
      bounds,
      index + 1,
      { ...current, [constituent.key]: constituent.minimum },
    );
    return;
  }

  yield* validPresenceAssignments(
    rule,
    bounds,
    index + 1,
    { ...current, [constituent.key]: 0 },
  );
  if (maximum > 0) {
    yield* validPresenceAssignments(
      rule,
      bounds,
      index + 1,
      { ...current, [constituent.key]: 1 },
    );
  }
}
