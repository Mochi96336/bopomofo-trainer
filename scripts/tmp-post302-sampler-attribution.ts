import { EVALUATION_CATALOG, PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createFreshProgressForEnvironment, createProductEnvironment, createProductState } from "../src/product/session.js";
import { readSamplerPost302Attribution } from "../src/syntax/sample.js";

const sampleCount = Number(process.env.SAMPLE_COUNT ?? "256");
const environment = createProductEnvironment({
  practice: PRACTICE_CATALOG,
  evaluation: EVALUATION_CATALOG,
  syntaxProfiles: SYNTAX_PROFILES,
});
const baseProgress = createFreshProgressForEnvironment(
  environment,
  "post302-sampler-attribution",
  "guided",
  "standard",
);
let attemptTotal = 0;
for (let round = 0; round < sampleCount; round += 1) {
  const state = createProductState(
    environment,
    { ...baseProgress, practiceRoundsCompleted: round },
    0,
  );
  attemptTotal += state.round.selection.generationAttempts;
}
const stats = readSamplerPost302Attribution();
const pct = (part: number, total: number) => total === 0 ? 0 : Number((part / total * 100).toFixed(2));
console.log(JSON.stringify({
  sampleCount,
  attemptTotal,
  ...stats,
  ruleChildrenFailures: stats.ruleChildrenCalls - stats.ruleChildrenSuccesses,
  ruleChildrenSuccessPct: pct(stats.ruleChildrenSuccesses, stats.ruleChildrenCalls),
  repeatedRequirementCallPct: pct(stats.repeatedRequirementCalls, stats.requirementCalls),
  averageEligibleRulesPerCategoryCall: stats.sampleCategoryCalls === 0 ? 0 : Number((stats.eligibleRuleItems / stats.sampleCategoryCalls).toFixed(3)),
  averageShuffledItems: stats.shuffledCalls === 0 ? 0 : Number((stats.shuffledItems / stats.shuffledCalls).toFixed(3)),
  averageMaterializedPathLength: stats.pathMaterializations === 0 ? 0 : Number((stats.pathMaterializedElements / stats.pathMaterializations).toFixed(3)),
  averageChildSlotsPerCopy: stats.childSlotCopyOperations === 0 ? 0 : Number((stats.childSlotItemsCopied / stats.childSlotCopyOperations).toFixed(3)),
  averageChildRulePathPerCopy: stats.childRulePathCopyOperations === 0 ? 0 : Number((stats.childRulePathItemsCopied / stats.childRulePathCopyOperations).toFixed(3)),
  averageCategoryRulePathLength: stats.categoryRulePathBuilds === 0 ? 0 : Number((stats.categoryRulePathItemsCopied / stats.categoryRulePathBuilds).toFixed(3)),
  totalRulePathItemsCopied: stats.childRulePathItemsCopied + stats.categoryRulePathItemsCopied,
  totalStateCopies: stats.lexicalStateCopies + stats.depthStateCopies + stats.clauseStateCopies,
  totalPathExtensions: stats.lexicalPathExtensions + stats.recursivePathExtensions + stats.candidateRulePathExtensions + stats.rootPathExtensions,
}, null, 2));
