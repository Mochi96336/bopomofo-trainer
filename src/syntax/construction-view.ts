import { FORMAL_SYNTAX_RULES } from "./grammar.js";
import type {
  ProductionRule,
  RuntimeOccurrenceCapability,
  SyntaxCategory,
  ValencyFrame,
} from "./types.js";

export interface OccurrenceCapabilityRequirementTarget {
  readonly ruleId: string;
  readonly constituentKey: string;
  readonly capability: RuntimeOccurrenceCapability;
}

export interface OccurrenceCapabilityInheritanceTarget {
  readonly outputCategory: SyntaxCategory;
  readonly constituentKey: string;
}

/**
 * A construction-local correction to a legacy aggregate valency requirement.
 * This does not mutate canonical grammar: the derived construction view may
 * replace an old generic gate when stronger reviewed same-occurrence evidence
 * is the authoritative license for that exact construction.
 */
export interface ConstructionValencyRequirementOverride {
  readonly ruleId: string;
  readonly constituentKey: string;
  readonly requiredValencyFrames: readonly ValencyFrame[];
}

/**
 * A structural choice that is part of the reviewed construction itself rather
 * than a sampling preference. The requirement is scoped to one parent
 * constituent edge, so another occurrence of the same child category remains
 * unconstrained.
 */
export interface ConstructionProductionRequirement {
  readonly parentRuleId: string;
  readonly constituentKey: string;
  readonly childRuleId: string;
}

/**
 * A reviewed construction view reuses canonical production identities while
 * adding evidence-backed lexical requirements and, when necessary, exact
 * construction-local structural/valency constraints. The view is a derived
 * constraint set, not a second grammar inventory, and applying it preserves
 * canonical rule identity/order for downstream structural targeting.
 */
export interface FormalSyntaxConstructionView {
  readonly id: string;
  readonly rootCategory: SyntaxCategory;
  readonly rootProductionRuleId: string;
  readonly occurrenceCapabilityRequirements: readonly OccurrenceCapabilityRequirementTarget[];
  readonly occurrenceCapabilityInheritanceTargets: readonly OccurrenceCapabilityInheritanceTarget[];
  readonly valencyRequirementOverrides?: readonly ConstructionValencyRequirementOverride[];
  readonly structuralProductionRequirements?: readonly ConstructionProductionRequirement[];
  readonly evidenceContract: string;
}

export interface AppliedFormalSyntaxConstructionView {
  readonly rules: readonly ProductionRule[];
  readonly structuralProductionRequirements: readonly ConstructionProductionRequirement[];
}

function requireConstituent(
  rules: readonly ProductionRule[],
  ruleId: string,
  constituentKey: string,
  requirementKind: string,
): ProductionRule["constituents"][number] {
  const rule = rules.find((candidate) => candidate.id === ruleId);
  if (rule === undefined) {
    throw new Error(`${requirementKind} references unknown rule: ${ruleId}`);
  }
  const constituent = rule.constituents.find((candidate) => candidate.key === constituentKey);
  if (constituent === undefined) {
    throw new Error(`${requirementKind} references unknown constituent: ${ruleId}:${constituentKey}`);
  }
  return constituent;
}

function applyValencyOverride(
  rules: readonly ProductionRule[],
  target: ConstructionValencyRequirementOverride,
): readonly ProductionRule[] {
  requireConstituent(
    rules,
    target.ruleId,
    target.constituentKey,
    "construction valency override",
  );
  return rules.map((candidate) => candidate.id !== target.ruleId ? candidate : {
    ...candidate,
    constituents: candidate.constituents.map((item) => item.key !== target.constituentKey ? item : {
      ...item,
      requiredValencyFrames: target.requiredValencyFrames,
    }),
  });
}

function applyRequirement(
  rules: readonly ProductionRule[],
  target: OccurrenceCapabilityRequirementTarget,
): readonly ProductionRule[] {
  requireConstituent(
    rules,
    target.ruleId,
    target.constituentKey,
    "occurrence capability requirement",
  );
  return rules.map((candidate) => candidate.id !== target.ruleId ? candidate : {
    ...candidate,
    constituents: candidate.constituents.map((item) => item.key !== target.constituentKey ? item : {
      ...item,
      requiredOccurrenceCapabilities: [...new Set([
        ...(item.requiredOccurrenceCapabilities ?? []),
        target.capability,
      ])].sort(),
    }),
  });
}

function applyInheritance(
  rules: readonly ProductionRule[],
  target: OccurrenceCapabilityInheritanceTarget,
): readonly ProductionRule[] {
  const matchingRules = rules.filter((rule) => rule.output === target.outputCategory);
  if (matchingRules.length === 0) {
    throw new Error(
      `occurrence capability inheritance references empty category: ${target.outputCategory}`,
    );
  }
  for (const rule of matchingRules) {
    const constituent = rule.constituents.find((candidate) => candidate.key === target.constituentKey);
    if (constituent === undefined || constituent.category !== "Lexeme") {
      throw new Error(
        `occurrence capability inheritance requires lexical constituent: ${rule.id}:${target.constituentKey}`,
      );
    }
  }
  return rules.map((rule) => rule.output !== target.outputCategory ? rule : {
    ...rule,
    constituents: rule.constituents.map((item) => item.key !== target.constituentKey ? item : {
      ...item,
      inheritOccurrenceCapabilities: true,
    }),
  });
}

function validatedStructuralProductionRequirements(
  rules: readonly ProductionRule[],
  view: FormalSyntaxConstructionView,
): readonly ConstructionProductionRequirement[] {
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const seenEdges = new Set<string>();
  const requirements = view.structuralProductionRequirements ?? [];
  for (const target of requirements) {
    const parent = rulesById.get(target.parentRuleId);
    if (parent === undefined) {
      throw new Error(
        `construction structural requirement references missing parent: ${target.parentRuleId}`,
      );
    }
    const constituent = parent.constituents.find((item) => item.key === target.constituentKey);
    if (constituent === undefined) {
      throw new Error(
        `construction structural requirement references missing constituent: ${target.parentRuleId}:${target.constituentKey}`,
      );
    }
    if (constituent.category === "Lexeme") {
      throw new Error(
        `construction structural requirement cannot target lexical constituent: ${target.parentRuleId}:${target.constituentKey}`,
      );
    }
    const child = rulesById.get(target.childRuleId);
    if (child === undefined) {
      throw new Error(
        `construction structural requirement references missing child: ${target.childRuleId}`,
      );
    }
    if (child.output !== constituent.category) {
      throw new Error(
        `construction structural requirement child category mismatch: ${target.parentRuleId}:${target.constituentKey} -> ${target.childRuleId}`,
      );
    }
    const edge = `${target.parentRuleId}\u0000${target.constituentKey}`;
    if (seenEdges.has(edge)) {
      throw new Error(
        `construction structural requirement duplicates parent constituent: ${target.parentRuleId}:${target.constituentKey}`,
      );
    }
    seenEdges.add(edge);
  }
  return requirements;
}

/**
 * Materialize every reviewed constraint carried by a construction view. The
 * derived rules carry lexical/valency constraints; internal production choices
 * stay explicit so an execution adapter can preserve their parent-edge scope.
 */
export function applyFormalSyntaxConstructionView(
  view: FormalSyntaxConstructionView,
  rules: readonly ProductionRule[] = FORMAL_SYNTAX_RULES,
): AppliedFormalSyntaxConstructionView {
  const rootRule = rules.find((rule) => rule.id === view.rootProductionRuleId);
  if (rootRule === undefined || rootRule.output !== view.rootCategory) {
    throw new Error(`construction view references invalid root production: ${view.id}`);
  }
  const structuralProductionRequirements = validatedStructuralProductionRequirements(rules, view);

  let result = rules;
  for (const target of view.valencyRequirementOverrides ?? []) {
    result = applyValencyOverride(result, target);
  }
  for (const target of view.occurrenceCapabilityRequirements) {
    result = applyRequirement(result, target);
  }
  for (const target of view.occurrenceCapabilityInheritanceTargets) {
    result = applyInheritance(result, target);
  }
  return { rules: result, structuralProductionRequirements };
}

/**
 * Compatibility helper for views whose complete meaning can be represented by
 * a derived rule set alone. Fail closed rather than silently dropping a scoped
 * structural production requirement.
 */
export function rulesForFormalSyntaxConstructionView(
  view: FormalSyntaxConstructionView,
  rules: readonly ProductionRule[] = FORMAL_SYNTAX_RULES,
): readonly ProductionRule[] {
  const applied = applyFormalSyntaxConstructionView(view, rules);
  if (applied.structuralProductionRequirements.length > 0) {
    throw new Error(
      `construction view ${view.id} has structural production requirements; use applyFormalSyntaxConstructionView`,
    );
  }
  return applied.rules;
}
