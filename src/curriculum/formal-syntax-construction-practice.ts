import {
  rulesForFormalSyntaxConstructionView,
  type FormalSyntaxConstructionView,
} from "../syntax/construction-view.js";
import { DEFAULT_DERIVATION_BOUNDS } from "../syntax/features.js";
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
  readonly minimumClauseNesting?: number;
}

function validatedMinimumClauseNesting(view: FormalSyntaxConstructionView): number | undefined {
  const minimum = view.executionRequirements?.minimumClauseNesting;
  if (minimum === undefined) return undefined;
  if (!Number.isInteger(minimum) || minimum < 0) {
    throw new RangeError(`construction view has invalid minimumClauseNesting: ${view.id}`);
  }
  if (minimum > DEFAULT_DERIVATION_BOUNDS.maximumClauseNesting) {
    throw new RangeError(
      `construction view minimumClauseNesting exceeds formal grammar default: ${view.id}`,
    );
  }
  return minimum;
}

/**
 * Embed one reviewed construction view at one exact Sentence constituent edge.
 *
 * Construction practice is deliberately explicit/raw instead of receiving
 * product-family sampling mass. The target edge must occur exactly once so a
 * requested construction cannot silently disappear or multiply within one
 * Sentence derivation.
 *
 * A view may additionally declare the minimum recursive clause budget required
 * by its existing skeleton. The planner forwards only that minimum; the selector
 * remains responsible for its normal bounds and may raise the opt-in practice
 * budget only as far as the formal grammar's global default permits.
 */
export function createSentenceConstructionPracticePlan(
  view: FormalSyntaxConstructionView,
  target: SentenceConstructionPracticeTarget,
  rules: readonly ProductionRule[] = FORMAL_SYNTAX_RULES,
): FormalSyntaxConstructionPracticePlan {
  const viewRules = rulesForFormalSyntaxConstructionView(view, rules);
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
  const minimumClauseNesting = validatedMinimumClauseNesting(view);

  return {
    rules: viewRules,
    samplingMode: "raw",
    structuralTarget: {
      rootProductionRuleId: target.sentenceRuleId,
      nestedProductionTargets: [{
        parentRuleId: target.sentenceRuleId,
        constituentKey: target.constituentKey,
        childRuleId: view.rootProductionRuleId,
      }],
    },
    ...(minimumClauseNesting === undefined ? {} : { minimumClauseNesting }),
  };
}
