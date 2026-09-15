import {
  applyFormalSyntaxConstructionView,
  type FormalSyntaxConstructionView,
} from "../syntax/construction-view.js";
import { FORMAL_SYNTAX_RULES } from "../syntax/grammar.js";
import type { ProductionRule } from "../syntax/types.js";
import type { FormalSyntaxStructuralTarget } from "./formal-syntax-utterance.js";

export interface SentenceConstructionPracticeTarget {
  readonly sentenceRuleId: string;
  readonly constituentKey: string;
}

export interface FormalSyntaxConstructionPracticePlan {
  readonly rules: readonly ProductionRule[];
  readonly samplingMode: "raw";
  readonly structuralTarget: FormalSyntaxStructuralTarget;
}

/**
 * Embed one reviewed construction view at one exact Sentence constituent edge.
 *
 * Construction practice is deliberately explicit/raw instead of receiving
 * product-family sampling mass. The target edge must occur exactly once so a
 * requested construction cannot silently disappear or multiply within one
 * Sentence derivation.
 *
 * Internal structural requirements belong to the reviewed construction view;
 * this curriculum adapter only translates those grammar-level requirements into
 * the sampler's edge-target representation.
 */
export function createSentenceConstructionPracticePlan(
  view: FormalSyntaxConstructionView,
  target: SentenceConstructionPracticeTarget,
  rules: readonly ProductionRule[] = FORMAL_SYNTAX_RULES,
): FormalSyntaxConstructionPracticePlan {
  const appliedView = applyFormalSyntaxConstructionView(view, rules);
  const viewRules = appliedView.rules;
  const sentenceRule = viewRules.find((rule) => rule.id === target.sentenceRuleId);
  if (sentenceRule === undefined || sentenceRule.output !== "Sentence") {
    throw new Error(`construction practice references invalid Sentence rule: ${target.sentenceRuleId}`);
  }
  const constituent = sentenceRule.constituents.find((item) => item.key === target.constituentKey);
  if (constituent === undefined) {
    throw new Error(
      `construction practice references missing Sentence constituent: ${target.sentenceRuleId}:${target.constituentKey}`,
    );
  }
  if (constituent.category !== view.rootCategory) {
    throw new Error(
      `construction practice category mismatch: ${target.sentenceRuleId}:${target.constituentKey} cannot host ${view.id}`,
    );
  }
  if (constituent.minimum !== 1 || constituent.maximum !== 1) {
    throw new Error(
      `construction practice target must occur exactly once: ${target.sentenceRuleId}:${target.constituentKey}`,
    );
  }

  const nestedProductionTargets = [{
    parentRuleId: target.sentenceRuleId,
    constituentKey: target.constituentKey,
    childRuleId: view.rootProductionRuleId,
  }, ...appliedView.structuralProductionRequirements];
  const seenEdges = new Set<string>();
  for (const nestedTarget of nestedProductionTargets) {
    const edge = `${nestedTarget.parentRuleId}\u0000${nestedTarget.constituentKey}`;
    if (seenEdges.has(edge)) {
      throw new Error(
        `construction practice duplicates structural target edge: ${nestedTarget.parentRuleId}:${nestedTarget.constituentKey}`,
      );
    }
    seenEdges.add(edge);
  }

  return {
    rules: viewRules,
    samplingMode: "raw",
    structuralTarget: {
      rootProductionRuleId: target.sentenceRuleId,
      nestedProductionTargets,
    },
  };
}
