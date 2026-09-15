import type { NestedProductionTarget } from "../syntax/sample.js";
import type { ArgumentRealizationPracticeIntent } from "./formal-syntax-sampling-policy.js";

export const CORE_ARGUMENT_REALIZATION_RULE_IDS = [
  "clause.intransitive",
  "clause.transitive",
  "clause.ditransitive",
] as const;

export const OBJECT_ARGUMENT_REALIZATION_RULE_IDS = [
  "clause.transitive",
  "clause.ditransitive",
] as const;

export interface ArgumentRealizationStructuralPractice {
  readonly nestedProductionTargets: readonly NestedProductionTarget[];
  readonly requiredProductionRuleIdsAnyOf?: readonly string[];
}

const OVERT_CORE_TARGETS: readonly NestedProductionTarget[] = [
  { parentRuleId: "clause.intransitive", constituentKey: "subject", exactCount: 1 },
  { parentRuleId: "clause.transitive", constituentKey: "subject", exactCount: 1 },
  { parentRuleId: "clause.transitive", constituentKey: "object", exactCount: 1 },
  { parentRuleId: "clause.ditransitive", constituentKey: "subject", exactCount: 1 },
  { parentRuleId: "clause.ditransitive", constituentKey: "object", exactCount: 1 },
];

export function argumentRealizationStructuralPractice(
  intent: ArgumentRealizationPracticeIntent,
): ArgumentRealizationStructuralPractice {
  if (intent === "ordinary") {
    return { nestedProductionTargets: OVERT_CORE_TARGETS };
  }
  if (intent === "subject-omission") {
    return {
      nestedProductionTargets: [
        { parentRuleId: "clause.intransitive", constituentKey: "subject", exactCount: 0 },
        { parentRuleId: "clause.transitive", constituentKey: "subject", exactCount: 0 },
        { parentRuleId: "clause.transitive", constituentKey: "object", exactCount: 1 },
        { parentRuleId: "clause.ditransitive", constituentKey: "subject", exactCount: 0 },
        { parentRuleId: "clause.ditransitive", constituentKey: "object", exactCount: 1 },
      ],
      requiredProductionRuleIdsAnyOf: CORE_ARGUMENT_REALIZATION_RULE_IDS,
    };
  }
  return {
    nestedProductionTargets: [
      { parentRuleId: "clause.transitive", constituentKey: "subject", exactCount: 1 },
      { parentRuleId: "clause.transitive", constituentKey: "object", exactCount: 0 },
      { parentRuleId: "clause.ditransitive", constituentKey: "subject", exactCount: 1 },
      { parentRuleId: "clause.ditransitive", constituentKey: "object", exactCount: 0 },
    ],
    requiredProductionRuleIdsAnyOf: OBJECT_ARGUMENT_REALIZATION_RULE_IDS,
  };
}
