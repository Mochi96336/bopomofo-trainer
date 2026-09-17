import { EVALUATION_CATALOG, PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createFreshProgressForEnvironment, createProductEnvironment, createProductState } from "../src/product/session.js";
import { readStableNestedVisitAttribution } from "../src/syntax/sample.js";

const sampleCount = Number(process.env.SAMPLE_COUNT ?? "256");
const environment = createProductEnvironment({
  practice: PRACTICE_CATALOG,
  evaluation: EVALUATION_CATALOG,
  syntaxProfiles: SYNTAX_PROFILES,
});
const baseProgress = createFreshProgressForEnvironment(
  environment,
  "post301-stable-nested-visits",
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
const stats = readStableNestedVisitAttribution();
console.log(JSON.stringify({
  sampleCount,
  attemptTotal,
  ...stats,
  avgItemsPerCall: stats.calls === 0 ? 0 : Number((stats.items / stats.calls).toFixed(2)),
  avgVisitsPerCall: stats.calls === 0 ? 0 : Number((stats.visits / stats.calls).toFixed(2)),
  visitedPctOfItems: stats.items === 0 ? 0 : Number((stats.visits / stats.items * 100).toFixed(2)),
  avoidedCandidateSubstreamsIfLazy: stats.items - stats.visits,
}, null, 2));
