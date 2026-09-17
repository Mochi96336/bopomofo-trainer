import { EVALUATION_CATALOG, PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createFreshProgressForEnvironment, createProductEnvironment, createProductState } from "../src/product/session.js";
import { readSamplerAllocationAttribution } from "../src/syntax/sample.js";

const sampleCount = Number(process.env.SAMPLE_COUNT ?? "256");
const environment = createProductEnvironment({
  practice: PRACTICE_CATALOG,
  evaluation: EVALUATION_CATALOG,
  syntaxProfiles: SYNTAX_PROFILES,
});
const baseProgress = createFreshProgressForEnvironment(
  environment,
  "post301-sampler-allocation-attribution",
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
const stats = readSamplerAllocationAttribution();
const pct = (part: number, total: number) => total === 0 ? 0 : Number((part / total * 100).toFixed(2));
console.log(JSON.stringify({
  sampleCount,
  attemptTotal,
  ...stats,
  ruleChildrenFailureCalls: stats.ruleChildrenCalls - stats.ruleChildrenSuccesses,
  ruleChildrenSuccessPct: pct(stats.ruleChildrenSuccesses, stats.ruleChildrenCalls),
  repeatedRequirementCallPct: pct(stats.repeatedRequirementCalls, stats.requirementCalls),
  averageRequirementCallsPerPositiveConstituent: stats.positiveCountConstituents === 0
    ? 0
    : Number((stats.requirementCalls / stats.positiveCountConstituents).toFixed(3)),
  callsNeverUsingChildren: stats.ruleChildrenCalls - stats.callsUsingChildren,
  callsNeverUsingSlots: stats.ruleChildrenCalls - stats.callsUsingSlots,
  callsNeverUsingSlotContexts: stats.ruleChildrenCalls - stats.callsUsingSlotContexts,
  callsNeverUsingRulePath: stats.ruleChildrenCalls - stats.callsUsingRulePath,
  callsNeverUsingChildrenPct: pct(stats.ruleChildrenCalls - stats.callsUsingChildren, stats.ruleChildrenCalls),
  callsNeverUsingSlotsPct: pct(stats.ruleChildrenCalls - stats.callsUsingSlots, stats.ruleChildrenCalls),
  callsNeverUsingSlotContextsPct: pct(stats.ruleChildrenCalls - stats.callsUsingSlotContexts, stats.ruleChildrenCalls),
  callsNeverUsingRulePathPct: pct(stats.ruleChildrenCalls - stats.callsUsingRulePath, stats.ruleChildrenCalls),
  averageChildSlotsPerCopy: stats.childSlotCopyOperations === 0 ? 0 : Number((stats.childSlotItemsCopied / stats.childSlotCopyOperations).toFixed(3)),
  averageChildRulePathPerCopy: stats.childRulePathCopyOperations === 0 ? 0 : Number((stats.childRulePathItemsCopied / stats.childRulePathCopyOperations).toFixed(3)),
  totalPathArrayBuilds: stats.lexicalPathBuilds + stats.recursivePathBuilds + stats.candidateRulePathBuilds,
  totalPathElementsCopied: stats.lexicalPathElements + stats.recursivePathElements + stats.candidateRulePathElements,
  averagePathElementsPerBuild: (stats.lexicalPathBuilds + stats.recursivePathBuilds + stats.candidateRulePathBuilds) === 0
    ? 0
    : Number(((stats.lexicalPathElements + stats.recursivePathElements + stats.candidateRulePathElements) /
      (stats.lexicalPathBuilds + stats.recursivePathBuilds + stats.candidateRulePathBuilds)).toFixed(3)),
}, null, 2));
