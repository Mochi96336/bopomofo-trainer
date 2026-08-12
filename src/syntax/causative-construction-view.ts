import { FORMAL_SYNTAX_RULES } from "./grammar.js";
import { CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY } from "./runtime-occurrence-capabilities.js";
import type {
  ProductionRule,
  RuntimeOccurrenceCapability,
  SyntaxCategory,
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

export interface FormalSyntaxConstructionView {
  readonly id: string;
  readonly rootCategory: SyntaxCategory;
  readonly rootProductionRuleId: string;
  readonly occurrenceCapabilityRequirements: readonly OccurrenceCapabilityRequirementTarget[];
  readonly occurrenceCapabilityInheritanceTargets: readonly OccurrenceCapabilityInheritanceTarget[];
  readonly evidenceContract: string;
}

/**
 * The finite-ccomp causative view reuses the ordinary content-complement shape.
 * Its causative license is one explicit same-occurrence capability, not an AND
 * of aggregate Voice=Cau morphology and aggregate ccomp valency at the consumer.
 */
export const CAUSATIVE_FINITE_CCOMP_VIEW: FormalSyntaxConstructionView = {
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

export const ACTIVE_CAUSATIVE_CONSTRUCTION_VIEWS: readonly FormalSyntaxConstructionView[] = [
  CAUSATIVE_FINITE_CCOMP_VIEW,
];

function applyRequirement(
  rules: readonly ProductionRule[],
  target: OccurrenceCapabilityRequirementTarget,
): readonly ProductionRule[] {
  const rule = rules.find((candidate) => candidate.id === target.ruleId);
  if (rule === undefined) {
    throw new Error(`occurrence capability requirement references unknown rule: ${target.ruleId}`);
  }
  const constituent = rule.constituents.find((candidate) => candidate.key === target.constituentKey);
  if (constituent === undefined) {
    throw new Error(
      `occurrence capability requirement references unknown constituent: ${target.ruleId}:${target.constituentKey}`,
    );
  }
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

export function rulesForFormalSyntaxConstructionView(
  view: FormalSyntaxConstructionView,
  rules: readonly ProductionRule[] = FORMAL_SYNTAX_RULES,
): readonly ProductionRule[] {
  const rootRule = rules.find((rule) => rule.id === view.rootProductionRuleId);
  if (rootRule === undefined || rootRule.output !== view.rootCategory) {
    throw new Error(`construction view references invalid root production: ${view.id}`);
  }

  let result = rules;
  for (const target of view.occurrenceCapabilityRequirements) {
    result = applyRequirement(result, target);
  }
  for (const target of view.occurrenceCapabilityInheritanceTargets) {
    result = applyInheritance(result, target);
  }
  return result;
}
