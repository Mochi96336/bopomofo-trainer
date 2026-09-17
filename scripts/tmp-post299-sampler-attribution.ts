import { EVALUATION_CATALOG, PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createFreshProgressForEnvironment, createProductEnvironment, createProductState } from "../src/product/session.js";
import { readSamplerAttribution } from "../src/syntax/sample.js";

const sampleCount = Number(process.env.SAMPLE_COUNT ?? "256");
const environment = createProductEnvironment({
  practice: PRACTICE_CATALOG,
  evaluation: EVALUATION_CATALOG,
  syntaxProfiles: SYNTAX_PROFILES,
});
const baseProgress = createFreshProgressForEnvironment(
  environment,
  "post299-sampler-attribution",
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
const stats = readSamplerAttribution();
const pct = (a: number, b: number) => b === 0 ? 0 : Number((a / b * 100).toFixed(2));
const childFailureTotal = stats.childFailMaximumBelowMinimum
  + stats.childFailCountBounds
  + stats.childFailExactCount
  + stats.childFailDepth
  + stats.childFailRequirements
  + stats.childFailLexicalLimit
  + stats.childFailReachability
  + stats.childFailRecursiveChild;
console.log(JSON.stringify({
  sampleCount,
  attemptTotal,
  ...stats,
  structuralAttemptsPerCall: Number((stats.structuralAttempts / stats.structuralCalls).toFixed(2)),
  categoryCallsPerStructuralAttempt: Number((stats.sampleCategoryCalls / stats.structuralAttempts).toFixed(2)),
  candidateVisitsPerCategoryCall: Number((stats.candidateVisits / stats.sampleCategoryCalls).toFixed(2)),
  avgRulePoolPerCategoryCall: Number((stats.categoryRulePoolItems / stats.sampleCategoryCalls).toFixed(2)),
  avgEligibleRulesPerCategoryCall: Number((stats.eligibleRuleItems / stats.sampleCategoryCalls).toFixed(2)),
  categorySuccessPct: pct(stats.categorySuccesses, stats.sampleCategoryCalls),
  categoryExhaustedPct: pct(stats.categoryExhaustedNulls, stats.sampleCategoryCalls),
  childrenSuccessPct: pct(stats.sampleRuleChildrenSuccesses, stats.sampleRuleChildrenCalls),
  childFailureTotal,
  childFailureBreakdownPct: {
    maximumBelowMinimum: pct(stats.childFailMaximumBelowMinimum, childFailureTotal),
    countBounds: pct(stats.childFailCountBounds, childFailureTotal),
    exactCount: pct(stats.childFailExactCount, childFailureTotal),
    depth: pct(stats.childFailDepth, childFailureTotal),
    requirements: pct(stats.childFailRequirements, childFailureTotal),
    lexicalLimit: pct(stats.childFailLexicalLimit, childFailureTotal),
    reachability: pct(stats.childFailReachability, childFailureTotal),
    recursiveChild: pct(stats.childFailRecursiveChild, childFailureTotal),
  },
  reachabilityRejectPctOfSlots: pct(stats.childFailReachability, stats.lexicalSlotsBuilt),
  stableNestedAvgItems: stats.stableNestedCandidateCalls === 0 ? 0 : Number((stats.stableNestedCandidateItems / stats.stableNestedCandidateCalls).toFixed(2)),
  nestedKeyCalls: stats.nestedKeyPriorityCalls + stats.nestedKeyCandidateCalls,
  avgNestedKeyChars: stats.nestedKeyPriorityCalls + stats.nestedKeyCandidateCalls === 0 ? 0 : Number((stats.nestedKeyChars / (stats.nestedKeyPriorityCalls + stats.nestedKeyCandidateCalls)).toFixed(2)),
}, null, 2));
